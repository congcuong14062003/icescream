import { Router } from "express";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { authenticate, requirePermission } from "../../middlewares/auth.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { success } from "../../utils/response.js";
import { buildReport, reportRange } from "./reports.service.js";

const router = Router();
router.use(authenticate, requirePermission("reports.view", "dashboard.view"));

router.get(
  "/dashboard",
  asyncHandler(async (request, response) => {
    const range = reportRange(request.query);
    const branchId =
      ["ADMIN", "MANAGER"].includes(request.user.role.code)
        ? request.query.branchId || undefined
        : request.user.branch?.id;
    const report = await buildReport({ ...range, branchId });
    return success(response, report, "Lấy dữ liệu dashboard thành công");
  }),
);

router.get(
  "/export.xlsx",
  requirePermission("reports.view"),
  asyncHandler(async (request, response) => {
    const range = reportRange(request.query);
    const report = await buildReport({ ...range, branchId: request.query.branchId || undefined });
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "IceCream POS";
    const summary = workbook.addWorksheet("Tổng quan");
    summary.columns = [
      { header: "Chỉ số", key: "metric", width: 32 },
      { header: "Giá trị", key: "value", width: 22 },
    ];
    summary.addRows([
      { metric: "Doanh thu thuần", value: report.summary.revenue },
      { metric: "Số đơn hoàn thành", value: report.summary.orders },
      { metric: "Giá trị đơn trung bình", value: report.summary.averageOrderValue },
      { metric: "Khách hàng mới", value: report.summary.newCustomers },
      { metric: "Lợi nhuận ước tính", value: report.summary.estimatedProfit },
      { metric: "Tỷ lệ hoàn thành (%)", value: report.summary.completionRate },
      { metric: "Tỷ lệ hủy (%)", value: report.summary.cancellationRate },
    ]);
    summary.getColumn("value").numFmt = '#,##0" ₫"';
    summary.getRow(1).font = { bold: true };

    const daily = workbook.addWorksheet("Doanh thu theo ngày");
    daily.columns = [
      { header: "Ngày", key: "date", width: 18 },
      { header: "Doanh thu", key: "revenue", width: 22 },
      { header: "Số đơn", key: "orders", width: 12 },
    ];
    daily.addRows(report.revenueSeries);
    daily.getColumn("revenue").numFmt = '#,##0" ₫"';
    daily.getRow(1).font = { bold: true };

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
    const report = await buildReport({ ...range, branchId: request.query.branchId || undefined });
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
      ["Doanh thu thuan", `${report.summary.revenue.toLocaleString("vi-VN")} VND`],
      ["So don hoan thanh", report.summary.orders],
      ["Gia tri don trung binh", `${report.summary.averageOrderValue.toLocaleString("vi-VN")} VND`],
      ["Khach hang moi", report.summary.newCustomers],
      ["Loi nhuan uoc tinh", `${report.summary.estimatedProfit.toLocaleString("vi-VN")} VND`],
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

