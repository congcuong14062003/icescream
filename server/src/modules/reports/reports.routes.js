import { Router } from "express";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { authenticate, requirePermission } from "../../middlewares/auth.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { success } from "../../utils/response.js";
import { ApiError } from "../../utils/api-error.js";
import { prisma } from "../../config/prisma.js";
import { getManagedBranchIds } from "../../services/branch-access.service.js";
import { buildReport, reportRange } from "./reports.service.js";

const router = Router();
router.use(authenticate, requirePermission("reports.view", "dashboard.view"));

function canViewFinancials(user) {
  return user.role.code === "ADMIN" || user.permissions.includes("reports.view");
}

function reportForUser(report, user) {
  if (canViewFinancials(user)) return report;
  const {
    financials: _financials,
    branchProfitability: _branchProfitability,
    ...safeReport
  } = report;
  const {
    estimatedCost: _estimatedCost,
    estimatedProfit: _estimatedProfit,
    ...safeSummary
  } = safeReport.summary;
  return {
    ...safeReport,
    summary: safeSummary,
    revenueSeries: safeReport.revenueSeries.map(
      ({ cost: _cost, profit: _profit, margin: _margin, ...item }) => item,
    ),
  };
}

async function resolveReportBranchIds(request) {
  const requestedBranchId = request.query.branchId || null;
  const allowedBranchIds = await getManagedBranchIds(prisma, request.user);
  if (allowedBranchIds === null) {
    return requestedBranchId ? [requestedBranchId] : null;
  }
  if (requestedBranchId && !allowedBranchIds.includes(requestedBranchId)) {
    throw new ApiError(403, "Bạn không được xem báo cáo của chi nhánh này");
  }
  return requestedBranchId ? [requestedBranchId] : allowedBranchIds;
}

router.get(
  "/dashboard",
  asyncHandler(async (request, response) => {
    const range = reportRange(request.query);
    const branchIds = await resolveReportBranchIds(request);
    const report = await buildReport({ ...range, branchIds });
    return success(
      response,
      reportForUser(report, request.user),
      "Lấy dữ liệu dashboard thành công",
    );
  }),
);

router.get(
  "/export.xlsx",
  requirePermission("reports.view"),
  asyncHandler(async (request, response) => {
    const range = reportRange(request.query);
    const branchIds = await resolveReportBranchIds(request);
    const report = await buildReport({ ...range, branchIds });
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "IceCream POS";
    const summary = workbook.addWorksheet("Tổng quan");
    summary.columns = [
      { header: "Chỉ số", key: "metric", width: 32 },
      { header: "Giá trị", key: "value", width: 22 },
      { header: "Đơn vị", key: "unit", width: 14 },
    ];
    summary.addRows([
      { metric: "Doanh số trước ưu đãi", value: report.financials.salesBeforeDiscount, unit: "VNĐ" },
      { metric: "Giảm giá và điểm", value: report.financials.discounts, unit: "VNĐ" },
      { metric: "Doanh thu thuần chưa VAT", value: report.financials.netRevenue, unit: "VNĐ" },
      { metric: "Thuế VAT đã thu", value: report.financials.taxCollected, unit: "VNĐ" },
      { metric: "Tiền hoàn trả", value: report.financials.refunds, unit: "VNĐ" },
      { metric: "Giá vốn hàng bán", value: report.financials.costOfGoods, unit: "VNĐ" },
      { metric: "Lợi nhuận gộp", value: report.financials.grossProfit, unit: "VNĐ" },
      { metric: "Biên lợi nhuận gộp", value: report.financials.grossMargin, unit: "%" },
      { metric: "Số đơn hoàn thành", value: report.summary.orders, unit: "đơn" },
      { metric: "Giá trị đơn trung bình", value: report.summary.averageOrderValue, unit: "VNĐ" },
      { metric: "Khách hàng mới", value: report.summary.newCustomers, unit: "khách" },
      { metric: "Tỷ lệ hoàn thành", value: report.summary.completionRate, unit: "%" },
      { metric: "Tỷ lệ hủy", value: report.summary.cancellationRate, unit: "%" },
    ]);
    for (let rowIndex = 2; rowIndex <= summary.rowCount; rowIndex += 1) {
      const unit = summary.getCell(rowIndex, 3).value;
      summary.getCell(rowIndex, 2).numFmt = unit === "%"
        ? '0.0"%"'
        : "#,##0";
    }
    summary.getRow(1).font = { bold: true };

    const daily = workbook.addWorksheet("Doanh thu theo ngày");
    daily.columns = [
      { header: "Ngày", key: "date", width: 18 },
      { header: "Doanh thu", key: "revenue", width: 22 },
      { header: "Giá vốn", key: "cost", width: 22 },
      { header: "Lợi nhuận", key: "profit", width: 22 },
      { header: "Biên lợi nhuận (%)", key: "margin", width: 20 },
      { header: "Số đơn", key: "orders", width: 12 },
    ];
    daily.addRows(report.revenueSeries);
    for (const column of ["revenue", "cost", "profit"]) {
      daily.getColumn(column).numFmt = '#,##0" ₫"';
    }
    daily.getColumn("margin").numFmt = '0.0"%"';
    daily.getRow(1).font = { bold: true };

    const branches = workbook.addWorksheet("Lợi nhuận chi nhánh");
    branches.columns = [
      { header: "Chi nhánh", key: "name", width: 32 },
      { header: "Doanh thu", key: "revenue", width: 22 },
      { header: "Giá vốn", key: "cost", width: 22 },
      { header: "Lợi nhuận", key: "profit", width: 22 },
      { header: "Biên lợi nhuận (%)", key: "margin", width: 20 },
      { header: "Số đơn", key: "orders", width: 12 },
    ];
    branches.addRows(report.branchProfitability);
    for (const column of ["revenue", "cost", "profit"]) {
      branches.getColumn(column).numFmt = '#,##0" ₫"';
    }
    branches.getColumn("margin").numFmt = '0.0"%"';
    branches.getRow(1).font = { bold: true };

    const products = workbook.addWorksheet("Sản phẩm bán chạy");
    products.columns = [
      { header: "Sản phẩm", key: "name", width: 36 },
      { header: "Số lượng", key: "quantity", width: 14 },
      { header: "Doanh thu", key: "revenue", width: 22 },
    ];
    products.addRows(report.topProducts);
    products.getColumn("revenue").numFmt = '#,##0" ₫"';
    products.getRow(1).font = { bold: true };

    response.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    response.setHeader(
      "Content-Disposition",
      `attachment; filename="icecream-report-${range.from.toISOString().slice(0, 10)}.xlsx"`,
    );
    await workbook.xlsx.write(response);
    response.end();
  }),
);

router.get(
  "/export.pdf",
  requirePermission("reports.view"),
  asyncHandler(async (request, response) => {
    const range = reportRange(request.query);
    const branchIds = await resolveReportBranchIds(request);
    const report = await buildReport({ ...range, branchIds });
    response.setHeader("Content-Type", "application/pdf");
    response.setHeader(
      "Content-Disposition",
      `attachment; filename="icecream-report-${range.from.toISOString().slice(0, 10)}.pdf"`,
    );
    const document = new PDFDocument({ size: "A4", margin: 48 });
    document.pipe(response);
    document.fontSize(22).text("IceCream POS - Bao cao kinh doanh", { align: "center" });
    document
      .fontSize(10)
      .text(
        `Tu ${range.from.toLocaleDateString("vi-VN")} den ${range.to.toLocaleDateString("vi-VN")}`,
        { align: "center" },
      );
    document.moveDown(2).fontSize(13).text("Tong quan");
    for (const [label, value] of [
      ["Doanh thu thuan chua VAT", `${report.financials.netRevenue.toLocaleString("vi-VN")} VND`],
      ["Gia von hang ban", `${report.financials.costOfGoods.toLocaleString("vi-VN")} VND`],
      ["Loi nhuan gop", `${report.financials.grossProfit.toLocaleString("vi-VN")} VND`],
      ["Bien loi nhuan", `${report.financials.grossMargin}%`],
      ["Giam gia va diem", `${report.financials.discounts.toLocaleString("vi-VN")} VND`],
      ["Tien hoan tra", `${report.financials.refunds.toLocaleString("vi-VN")} VND`],
      ["So don hoan thanh", report.summary.orders],
      ["Gia tri don trung binh", `${report.summary.averageOrderValue.toLocaleString("vi-VN")} VND`],
      ["Khach hang moi", report.summary.newCustomers],
      ["Ty le hoan thanh", `${report.summary.completionRate}%`],
    ]) {
      document.fontSize(10).text(`${label}: ${value}`);
    }
    document.moveDown().fontSize(13).text("San pham ban chay");
    report.topProducts.forEach((item, index) => {
      document.fontSize(10).text(`${index + 1}. ${item.name}: ${item.quantity} - ${item.revenue.toLocaleString("vi-VN")} VND`);
    });
    document.end();
  }),
);

export default router;
