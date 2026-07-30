import { prisma } from "../config/prisma.js";
import { verifyAccessToken } from "../services/token.service.js";
import { ApiError } from "../utils/api-error.js";
import { normalizeUser, safeUserSelect } from "../utils/serializers.js";

export async function authenticate(request, response, next) {
  try {
    const authorization = request.get("authorization");
    if (!authorization?.startsWith("Bearer ")) {
      throw new ApiError(401, "Vui lòng đăng nhập để tiếp tục");
    }
    const payload = verifyAccessToken(authorization.slice(7));
    const user = await prisma.user.findFirst({
      where: { id: payload.sub, deletedAt: null },
      select: safeUserSelect,
    });
    if (!user || user.status !== "ACTIVE") {
      throw new ApiError(401, "Tài khoản không tồn tại hoặc đã bị khóa");
    }
    request.user = normalizeUser(user);
    return next();
  } catch (error) {
    if (error instanceof ApiError) return next(error);
    return next(new ApiError(401, "Phiên đăng nhập không hợp lệ hoặc đã hết hạn"));
  }
}

export function allowRoles(...roles) {
  return (request, response, next) => {
    if (!request.user || !roles.includes(request.user.role.code)) {
      return next(new ApiError(403, "Bạn không có quyền thực hiện thao tác này"));
    }
    return next();
  };
}

export function requirePermission(...permissions) {
  return (request, response, next) => {
    if (!request.user) return next(new ApiError(401, "Vui lòng đăng nhập"));
    if (
      request.user.role.code !== "ADMIN" &&
      !permissions.some((permission) => request.user.permissions.includes(permission))
    ) {
      return next(new ApiError(403, "Bạn không có quyền thực hiện thao tác này"));
    }
    return next();
  };
}

