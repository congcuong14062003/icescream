export async function writeAudit(prismaClient, request, action, entityType, entityId, oldData, newData) {
  return prismaClient.auditLog.create({
    data: {
      userId: request.user?.id,
      action,
      entityType,
      entityId,
      oldData: oldData ?? undefined,
      newData: newData ?? undefined,
      ipAddress: request.ip,
      userAgent: request.get("user-agent"),
    },
  });
}

