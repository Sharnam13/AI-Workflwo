/** Replaces req.body with the parsed (coerced, trimmed) value or throws a ZodError. */
export const validateBody = (schema) => (req, res, next) => {
  req.body = schema.parse(req.body ?? {});
  next();
};
