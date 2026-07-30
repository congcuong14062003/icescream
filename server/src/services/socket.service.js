let ioInstance;

export function setSocketServer(io) {
  ioInstance = io;
}

export function emitOrderEvent(branchId, event, data) {
  if (!ioInstance) return;
  ioInstance.to(`branch:${branchId}`).emit(event, data);
}

