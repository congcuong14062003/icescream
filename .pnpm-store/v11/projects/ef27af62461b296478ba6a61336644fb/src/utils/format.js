import dayjs from "dayjs";
import "dayjs/locale/vi";

dayjs.locale("vi");

export function formatMoney(value) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

export function formatDate(value, includeTime = false) {
  if (!value) return "—";
  return dayjs(value).format(includeTime ? "DD/MM/YYYY HH:mm" : "DD/MM/YYYY");
}

export function todayInput() {
  return dayjs().format("YYYY-MM-DD");
}

export function daysAgoInput(days) {
  return dayjs().subtract(days, "day").format("YYYY-MM-DD");
}

export const paymentMethodLabels = {
  CASH: "Tiền mặt",
  BANK_TRANSFER: "Chuyển khoản",
  CARD: "Thẻ ngân hàng",
  EWALLET: "Ví điện tử",
  MIXED: "Kết hợp",
};

export const orderStatusLabels = {
  DRAFT: "Đơn tạm",
  PENDING: "Chờ xác nhận",
  MAKING: "Đang làm kem",
  READY: "Đã làm xong",
  COMPLETED: "Hoàn thành",
  CANCELLED: "Đã hủy",
};

