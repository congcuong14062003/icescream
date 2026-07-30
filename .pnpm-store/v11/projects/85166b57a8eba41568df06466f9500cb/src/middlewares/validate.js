export const validate =
  (schema, source = "body") =>
  (request, response, next) => {
    const parsed = schema.safeParse(request[source]);
    if (!parsed.success) {
      return response.status(422).json({
        success: false,
        message: "Dữ liệu không hợp lệ",
        data: null,
        errors: parsed.error.flatten(),
      });
    }
    request[source] = parsed.data;
    return next();
  };

