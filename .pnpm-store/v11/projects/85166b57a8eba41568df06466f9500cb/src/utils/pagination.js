export function getPagination(query) {
  const page = Math.max(1, Number.parseInt(query.page || "1", 10));
  const size = Math.min(100, Math.max(1, Number.parseInt(query.size || "20", 10)));
  return { page, size, skip: (page - 1) * size };
}

export function paginationMeta(page, size, total) {
  return {
    page,
    size,
    total,
    pages: Math.max(1, Math.ceil(total / size)),
  };
}

