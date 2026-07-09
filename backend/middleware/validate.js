const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+\d\s\-().]{7,20}$/;
const MONGO_ID_RE = /^[a-f\d]{24}$/i;

function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function safePagination(query, defaultLimit = 20, maxLimit = 100) {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(
    Math.max(1, parseInt(query.limit) || defaultLimit),
    maxLimit,
  );
  return { page, limit, skip: (page - 1) * limit };
}

function checkField(value, rule, fieldName, errors) {
  const isEmpty = value === undefined || value === null || value === "";

  if (rule.required && isEmpty) {
    errors.push(`${fieldName} is required`);
    return;
  }
  if (isEmpty) return;

  const str = String(value);

  if (rule.type === "string" && typeof value !== "string") {
    errors.push(`${fieldName} must be a string`);
    return;
  }
  if (rule.type === "number") {
    const n = Number(value);
    if (isNaN(n)) {
      errors.push(`${fieldName} must be a number`);
      return;
    }
    if (rule.min !== undefined && n < rule.min)
      errors.push(`${fieldName} must be at least ${rule.min}`);
    if (rule.max !== undefined && n > rule.max)
      errors.push(`${fieldName} must be at most ${rule.max}`);
    return;
  }
  if (rule.minLength && str.length < rule.minLength)
    errors.push(`${fieldName} must be at least ${rule.minLength} characters`);
  if (rule.maxLength && str.length > rule.maxLength)
    errors.push(`${fieldName} must be at most ${rule.maxLength} characters`);
  if (rule.email && !EMAIL_RE.test(str))
    errors.push(`${fieldName} must be a valid email`);
  if (rule.phone && !PHONE_RE.test(str))
    errors.push(`${fieldName} must be a valid phone number`);
  if (rule.mongoId && !MONGO_ID_RE.test(str))
    errors.push(`${fieldName} must be a valid ID`);
  if (rule.enum && !rule.enum.includes(value))
    errors.push(`${fieldName} must be one of: ${rule.enum.join(", ")}`);
  if (rule.pattern && !rule.pattern.test(str))
    errors.push(`${fieldName} format is invalid`);
}

function validateBody(schema) {
  return (req, res, next) => {
    const errors = [];
    for (const [field, rule] of Object.entries(schema)) {
      checkField(req.body[field], rule, field, errors);
    }
    if (errors.length > 0) {
      res.status(400);
      return next(new Error(errors[0]));
    }
    next();
  };
}

function validateQuery(schema) {
  return (req, res, next) => {
    const errors = [];
    for (const [field, rule] of Object.entries(schema)) {
      checkField(req.query[field], rule, field, errors);
    }
    if (errors.length > 0) {
      res.status(400);
      return next(new Error(errors[0]));
    }
    next();
  };
}

function validateMongoId(...paramNames) {
  return (req, res, next) => {
    for (const name of paramNames) {
      if (req.params[name] && !MONGO_ID_RE.test(req.params[name])) {
        res.status(400);
        return next(new Error(`Invalid ${name}`));
      }
    }
    next();
  };
}

module.exports = {
  validateBody,
  validateQuery,
  validateMongoId,
  escapeRegex,
  safePagination,
};
