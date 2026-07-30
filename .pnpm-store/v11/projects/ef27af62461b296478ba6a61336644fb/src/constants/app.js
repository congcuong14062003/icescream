export const APP_NAME = "IceCream POS";

export const roleLabels = {
  ADMIN: "Quản trị viên",
  MANAGER: "Quản lý",
  CASHIER: "Thu ngân",
  WAREHOUSE: "Nhân viên kho",
  STAFF: "Nhân viên",
};

export const orderTransitions = {
  DRAFT: ["PENDING", "CANCELLED"],
  PENDING: ["MAKING", "CANCELLED"],
  MAKING: ["READY", "CANCELLED"],
  READY: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

