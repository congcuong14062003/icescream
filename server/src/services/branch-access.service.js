import { ApiError } from "../utils/api-error.js";

export async function getManagedBranchIds(tx, user) {
  if (user.role.code === "ADMIN") return null;
  if (user.role.code === "MANAGER") {
    const branches = await tx.branch.findMany({
      where: {
        deletedAt: null,
        isActive: true,
        OR: [
          { managerId: user.id },
          ...(user.branch?.id ? [{ id: user.branch.id }] : []),
        ],
      },
      select: { id: true },
    });
    return [...new Set(branches.map((branch) => branch.id))];
  }
  return user.branch?.id ? [user.branch.id] : [];
}

export async function assertBranchAccess(
  tx,
  user,
  branchId,
  message = "Bạn chỉ được truy cập dữ liệu tại chi nhánh được phân công",
) {
  if (!branchId) {
    throw new ApiError(422, "Vui lòng chọn chi nhánh");
  }
  const allowedBranchIds = await getManagedBranchIds(tx, user);
  if (allowedBranchIds && !allowedBranchIds.includes(branchId)) {
    throw new ApiError(403, message);
  }
  return branchId;
}

export async function resolveBranchIds(tx, user, requestedBranchId = null) {
  const allowedBranchIds = await getManagedBranchIds(tx, user);
  if (requestedBranchId) {
    if (allowedBranchIds && !allowedBranchIds.includes(requestedBranchId)) {
      throw new ApiError(
        403,
        "Bạn chỉ được truy cập dữ liệu tại chi nhánh được phân công",
      );
    }
    return [requestedBranchId];
  }
  return allowedBranchIds;
}

export function branchWhere(branchIds) {
  return branchIds === null ? {} : { branchId: { in: branchIds } };
}

export async function assertVoucherBranchAccess(tx, user, branchIds) {
  const uniqueBranchIds = [...new Set(branchIds.filter(Boolean))];
  if (!uniqueBranchIds.length) {
    throw new ApiError(422, "Vui lòng chọn ít nhất một chi nhánh phát hành");
  }

  const activeBranches = await tx.branch.findMany({
    where: {
      id: { in: uniqueBranchIds },
      deletedAt: null,
      isActive: true,
    },
    select: { id: true, code: true, name: true },
    orderBy: { name: "asc" },
  });
  if (activeBranches.length !== uniqueBranchIds.length) {
    throw new ApiError(422, "Một chi nhánh đã ngừng hoạt động hoặc không tồn tại");
  }

  const allowedBranchIds = await getManagedBranchIds(tx, user);
  if (
    allowedBranchIds &&
    uniqueBranchIds.some((branchId) => !allowedBranchIds.includes(branchId))
  ) {
    throw new ApiError(
      403,
      "Quản lý chỉ được phát hành voucher tại chi nhánh mình quản lý",
    );
  }
  return activeBranches;
}
