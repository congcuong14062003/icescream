import { ApiError } from "../utils/api-error.js";

export function notFound(request, response) {
  response.status(404).json({
    success: false,
    message: `Không tìm thấy tài nguyên ${request.method} ${request.originalUrl}`,
    data: null,
  });
}

export function errorHandler(error, request, response, next) {
  if (response.headersSent) return next(error);

  if (error?.code === "P2002") {
    return response.status(409).json({
      success: false,
      message: "Dữ liệu bị trùng với bản ghi đã tồn tại",
      data: null,
      errors: error.meta?.target,
    });
  }

  if (error?.code === "P2025") {
    return response.status(404).json({
      success: false,
      message: "Không tìm thấy dữ liệu cần thao tác",
      data: null,
    });
  }

  if (error?.name === "ZodError") {
    return response.status(422).json({
      success: false,
      message: "Dữ liệu không hợp lệ",
      data: null,
      errors: error.flatten(),
    });
  }

  const statusCode = error instanceof ApiError ? error.statusCode : 500;
  const message =
    error instanceof ApiError
      ? error.message
      : process.env.NODE_ENV === "production"
        ? "Đã xảy ra lỗi hệ thống"
        : error.message;

  if (statusCode >= 500) console.error(error);

  return response.status(statusCode).json({
    success: false,
    message,
    data: null,
    ...(error.details ? { errors: error.details } : {}),
  });
}

