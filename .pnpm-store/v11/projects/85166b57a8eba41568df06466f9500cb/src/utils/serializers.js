export const safeUserSelect = {
  id: true,
  username: true,
  email: true,
  fullName: true,
  phone: true,
  avatarUrl: true,
  status: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  role: {
    select: {
      id: true,
      code: true,
      name: true,
      permissions: {
        select: {
          permission: { select: { code: true, name: true, module: true } },
        },
      },
    },
  },
  branch: {
    select: { id: true, code: true, name: true, address: true },
  },
};

export function normalizeUser(user) {
  if (!user) return null;
  return {
    ...user,
    permissions:
      user.role?.permissions?.map((item) => item.permission.code) || [],
    role: user.role
      ? {
          id: user.role.id,
          code: user.role.code,
          name: user.role.name,
        }
      : null,
  };
}

