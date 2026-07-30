export function success(response, data = {}, message = "Thao tác thành công", meta) {
  const payload = { success: true, message, data };
  if (meta) payload.meta = meta;
  return response.json(payload);
}

export function created(response, data = {}, message = "Tạo mới thành công") {
  return response.status(201).json({ success: true, message, data });
}

