let ioInstance;

export function setSocketServer(io) {
  ioInstance = io;
}

export function emitOrderEvent(branchId, event, data) {
  if (!ioInstance) return;
  ioInstance.to(`branch:${branchId}`).to("orders:admin").emit(event, data);
}

export function emitCatalogEvent(event, data) {
  if (!ioInstance) return;
  ioInstance.emit(event, data);
}
