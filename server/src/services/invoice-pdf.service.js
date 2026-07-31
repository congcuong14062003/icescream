import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));

const colors = {
  ink: "#15312c",
  muted: "#647b75",
  line: "#dce9e5",
  panel: "#f4f8f7",
  mint: "#1b8a75",
  mintDark: "#0b3d35",
  mintSoft: "#dff5ee",
  white: "#ffffff",
  danger: "#c2415d",
};

const paymentLabels = {
  CASH: "Tiền mặt",
  BANK_TRANSFER: "Chuyển khoản",
  CARD: "Thẻ ngân hàng",
  EWALLET: "Ví điện tử",
  MIXED: "Kết hợp",
};

const statusLabels = {
  DRAFT: "Đơn tạm",
  PENDING: "Chờ xác nhận",
  MAKING: "Đang làm kem",
  READY: "Sẵn sàng",
  COMPLETED: "Hoàn thành",
  CANCELLED: "Đã hủy",
};

function firstExisting(paths) {
  return paths.find((candidate) => fs.existsSync(candidate));
}

function registerInvoiceFonts(document) {
  const regular = firstExisting([
    path.resolve(directory, "../../assets/fonts/BeVietnamPro-Regular.ttf"),
    path.resolve(directory, "../../node_modules/@fontsource/be-vietnam-pro/files/be-vietnam-pro-vietnamese-400-normal.woff"),
    "C:\\Windows\\Fonts\\arial.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf",
  ]);
  const bold = firstExisting([
    path.resolve(directory, "../../assets/fonts/BeVietnamPro-Bold.ttf"),
    path.resolve(directory, "../../node_modules/@fontsource/be-vietnam-pro/files/be-vietnam-pro-vietnamese-700-normal.woff"),
    "C:\\Windows\\Fonts\\arialbd.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf",
  ]);

  if (regular) document.registerFont("InvoiceRegular", regular);
  if (bold) document.registerFont("InvoiceBold", bold);

  return {
    regular: regular ? "InvoiceRegular" : "Helvetica",
    bold: bold ? "InvoiceBold" : "Helvetica-Bold",
  };
}

function money(value) {
  return `${Number(value || 0).toLocaleString("vi-VN")} đ`;
}

function dateTime(value) {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function drawText(document, fonts, text, x, y, options = {}) {
  const { bold = false, color = colors.ink, size = 8.5, ...textOptions } = options;
  document
    .font(bold ? fonts.bold : fonts.regular)
    .fontSize(size)
    .fillColor(color)
    .text(String(text ?? ""), x, y, textOptions);
}

function drawBrandHeader(document, fonts, order, compact = false) {
  const pageWidth = document.page.width;
  const x = 24;
  const width = pageWidth - 48;
  const height = compact ? 66 : 104;

  document.roundedRect(x, 22, width, height, 16).fill(colors.mintDark);
  document.circle(x + 28, compact ? 49 : 52, compact ? 15 : 18).fill(colors.white);
  drawText(document, fonts, "IC", x + (compact ? 19 : 17), compact ? 42 : 43, {
    bold: true,
    color: colors.mintDark,
    size: compact ? 9 : 11,
    width: compact ? 18 : 22,
    align: "center",
  });
  drawText(document, fonts, "IceCream POS", x + 54, compact ? 36 : 38, {
    bold: true,
    color: colors.white,
    size: compact ? 13 : 17,
  });
  drawText(document, fonts, compact ? "HÓA ĐƠN BÁN HÀNG" : "Kem ngon mỗi ngày - Phục vụ bằng cả niềm vui", x + 54, compact ? 55 : 61, {
    color: "#bce7dc",
    size: compact ? 7 : 7.5,
  });

  drawText(document, fonts, order.code, pageWidth - 154, compact ? 36 : 40, {
    bold: true,
    color: colors.white,
    size: compact ? 9 : 10,
    width: 106,
    align: "right",
  });
  drawText(document, fonts, statusLabels[order.status] || order.status, pageWidth - 154, compact ? 54 : 61, {
    color: "#bce7dc",
    size: 7,
    width: 106,
    align: "right",
  });

  if (!compact) {
    drawText(document, fonts, order.branch.name, x + 18, 86, {
      bold: true,
      color: colors.white,
      size: 8.5,
      width: width - 36,
    });
    drawText(document, fonts, `${order.branch.address}  •  ${order.branch.phone}`, x + 18, 103, {
      color: "#cdece4",
      size: 7,
      width: width - 36,
    });
  }

  return 22 + height;
}

function drawMeta(document, fonts, order, startY) {
  const x = 24;
  const gap = 8;
  const width = document.page.width - 48;
  const columnWidth = (width - gap) / 2;
  const customer = order.customer
    ? `${order.customer.fullName}${order.customer.phone ? ` - ${order.customer.phone}` : ""}`
    : "Khách lẻ";
  const payment = order.payments?.length
    ? [...new Set(order.payments.map((item) => paymentLabels[item.method] || item.method))].join(", ")
    : "Chưa ghi nhận";

  const fields = [
    ["THỜI GIAN", dateTime(order.createdAt)],
    ["THU NGÂN", order.createdBy.fullName],
    ["KHÁCH HÀNG", customer],
    ["THANH TOÁN", payment],
  ];

  fields.forEach(([label, value], index) => {
    const boxX = x + (index % 2) * (columnWidth + gap);
    const boxY = startY + Math.floor(index / 2) * 46;
    document.roundedRect(boxX, boxY, columnWidth, 38, 9).fill(colors.panel);
    drawText(document, fonts, label, boxX + 10, boxY + 7, {
      bold: true,
      color: colors.muted,
      size: 6.5,
    });
    drawText(document, fonts, value, boxX + 10, boxY + 20, {
      bold: true,
      size: 7.5,
      width: columnWidth - 20,
      ellipsis: true,
    });
  });

  return startY + 92;
}

function drawTableHeader(document, fonts, y) {
  const x = 24;
  const width = document.page.width - 48;
  document.roundedRect(x, y, width, 24, 7).fill(colors.mintSoft);
  drawText(document, fonts, "SẢN PHẨM", x + 9, y + 8, { bold: true, color: colors.mintDark, size: 6.6 });
  drawText(document, fonts, "SL", x + 212, y + 8, { bold: true, color: colors.mintDark, size: 6.6, width: 28, align: "center" });
  drawText(document, fonts, "ĐƠN GIÁ", x + 242, y + 8, { bold: true, color: colors.mintDark, size: 6.6, width: 58, align: "right" });
  drawText(document, fonts, "THÀNH TIỀN", x + 302, y + 8, { bold: true, color: colors.mintDark, size: 6.6, width: width - 310, align: "right" });
  return y + 28;
}

function itemDescription(item) {
  const flavors = item.flavors?.map((entry) => entry.flavor.name) || [];
  const toppings = item.toppings?.map((entry) => {
    const suffix = entry.quantity > 1 ? ` x${entry.quantity}` : "";
    return `${entry.topping.name}${suffix}`;
  }) || [];
  const details = [];
  if (item.variantName) details.push(item.variantName);
  if (flavors.length) details.push(`Vị: ${flavors.join(", ")}`);
  if (toppings.length) details.push(`Topping: ${toppings.join(", ")}`);
  if (item.note) details.push(`Ghi chú: ${item.note}`);
  return details.join("  •  ");
}

function drawItems(document, fonts, order, startY) {
  let y = drawTableHeader(document, fonts, startY);
  const x = 24;
  const width = document.page.width - 48;

  order.items.forEach((item, index) => {
    const detail = itemDescription(item);
    document.font(fonts.regular).fontSize(7);
    const detailHeight = detail
      ? document.heightOfString(detail, { width: 194, lineGap: 1 })
      : 0;
    const rowHeight = Math.max(34, 25 + detailHeight);

    if (y + rowHeight > document.page.height - 80) {
      document.addPage();
      const headerBottom = drawBrandHeader(document, fonts, order, true);
      y = drawTableHeader(document, fonts, headerBottom + 14);
    }

    if (index % 2 === 1) {
      document.rect(x, y - 1, width, rowHeight).fill("#f9fbfa");
    }
    drawText(document, fonts, item.productName, x + 9, y + 6, {
      bold: true,
      size: 8,
      width: 194,
      ellipsis: true,
    });
    if (detail) {
      drawText(document, fonts, detail, x + 9, y + 19, {
        color: colors.muted,
        size: 6.8,
        width: 194,
        lineGap: 1,
      });
    }
    drawText(document, fonts, item.quantity, x + 212, y + 9, {
      bold: true,
      size: 7.5,
      width: 28,
      align: "center",
    });
    drawText(document, fonts, money(item.unitPrice), x + 242, y + 9, {
      size: 7.5,
      width: 58,
      align: "right",
    });
    drawText(document, fonts, money(item.lineTotal), x + 302, y + 9, {
      bold: true,
      size: 7.5,
      width: width - 310,
      align: "right",
    });
    document.moveTo(x, y + rowHeight - 1).lineTo(x + width, y + rowHeight - 1).strokeColor(colors.line).lineWidth(0.5).stroke();
    y += rowHeight;
  });

  return y;
}

function drawTotals(document, fonts, order, startY) {
  const rows = [
    ["Tạm tính", order.originalAmount],
    ...(order.discountAmount ? [["Khuyến mãi", -order.discountAmount]] : []),
    ...(order.voucherDiscount
      ? [[
          order.usedVoucher?.code
            ? `Voucher ${order.usedVoucher.code}`
            : "Voucher khách hàng",
          -order.voucherDiscount,
        ]]
      : []),
    ...(order.membershipDiscount ? [["Quyền lợi hội viên", -order.membershipDiscount]] : []),
    ...(order.pointsDiscount ? [["Điểm đã dùng (dữ liệu cũ)", -order.pointsDiscount]] : []),
    ...(order.taxAmount ? [[`VAT ${order.vatRate || 0}%`, order.taxAmount]] : []),
    ...(order.deliveryFee ? [["Phí giao hàng", order.deliveryFee]] : []),
  ];
  const panelHeight = 48 + rows.length * 17;

  if (startY + panelHeight + 86 > document.page.height) {
    document.addPage();
    const headerBottom = drawBrandHeader(document, fonts, order, true);
    startY = headerBottom + 14;
  }

  const x = 24;
  const width = document.page.width - 48;
  document.roundedRect(x, startY + 8, width, panelHeight, 12).fill(colors.panel);
  let y = startY + 20;
  rows.forEach(([label, value]) => {
    drawText(document, fonts, label, x + 14, y, { color: colors.muted, size: 8 });
    drawText(document, fonts, money(value), x + 190, y, {
      color: value < 0 ? colors.danger : colors.ink,
      size: 8,
      width: width - 204,
      align: "right",
    });
    y += 17;
  });
  document.moveTo(x + 14, y + 1).lineTo(x + width - 14, y + 1).strokeColor(colors.line).lineWidth(1).stroke();
  drawText(document, fonts, "TỔNG THANH TOÁN", x + 14, y + 12, {
    bold: true,
    color: colors.mintDark,
    size: 9,
  });
  drawText(document, fonts, money(order.totalAmount), x + 170, y + 8, {
    bold: true,
    color: colors.mint,
    size: 14,
    width: width - 184,
    align: "right",
  });

  y = startY + panelHeight + 18;
  drawText(document, fonts, `Khách đưa: ${money(order.customerPaid)}`, x + 2, y, {
    color: colors.muted,
    size: 7.5,
    width: width / 2,
  });
  drawText(document, fonts, `Tiền thừa: ${money(order.changeAmount)}`, x + width / 2, y, {
    bold: true,
    size: 7.5,
    width: width / 2 - 2,
    align: "right",
  });

  if (order.note) {
    y += 18;
    drawText(document, fonts, `Ghi chú đơn: ${order.note}`, x + 2, y, {
      color: colors.muted,
      size: 7,
      width,
    });
    y += document.heightOfString(`Ghi chú đơn: ${order.note}`, { width, size: 7 }) + 3;
  }

  drawText(document, fonts, "Cảm ơn quý khách và hẹn gặp lại!", x, y + 18, {
    bold: true,
    color: colors.mintDark,
    size: 9,
    width,
    align: "center",
  });
  drawText(document, fonts, "Vui lòng giữ hóa đơn để được hỗ trợ khi cần.", x, y + 34, {
    color: colors.muted,
    size: 7,
    width,
    align: "center",
  });
}

function drawPageFooters(document, fonts) {
  const range = document.bufferedPageRange();
  for (let index = 0; index < range.count; index += 1) {
    document.switchToPage(range.start + index);
    const y = document.page.height - 38;
    document.moveTo(24, y - 7).lineTo(document.page.width - 24, y - 7).strokeColor(colors.line).lineWidth(0.5).stroke();
    drawText(document, fonts, `IceCream POS  •  Trang ${index + 1}/${range.count}`, 24, y, {
      color: colors.muted,
      size: 6.5,
      width: document.page.width - 48,
      align: "center",
    });
  }
}

export function renderInvoicePdf(document, order) {
  const fonts = registerInvoiceFonts(document);
  document.info.Title = `Hóa đơn ${order.code}`;
  document.info.Author = "IceCream POS";
  document.info.Subject = "Hóa đơn bán hàng";

  const headerBottom = drawBrandHeader(document, fonts, order);
  const metaBottom = drawMeta(document, fonts, order, headerBottom + 12);
  const itemsBottom = drawItems(document, fonts, order, metaBottom + 8);
  drawTotals(document, fonts, order, itemsBottom + 5);
  drawPageFooters(document, fonts);
}
