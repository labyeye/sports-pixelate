// Turns any error into a short, plain-language message the app can show in a
// popup. Mongoose / multer / body-parser errors are translated so users never
// see technical text like "Path `name` is required." or "CastError".

// "firstName" -> "First name", "guardians.0.phone" -> "Phone"
function humanizeField(path = "") {
  const last = String(path).split(".").filter((p) => !/^\d+$/.test(p)).pop() || "";
  const spaced = last.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").trim().toLowerCase();
  return spaced ? spaced.charAt(0).toUpperCase() + spaced.slice(1) : "This field";
}

// One readable sentence per invalid field (max 3), e.g. "First name is required".
function validationMessage(err) {
  const lines = Object.values(err.errors || {}).map((e) => {
    const field = humanizeField(e.path);
    switch (e.kind) {
      case "required":
        return `${field} is required`;
      case "enum":
        return `${field} has an invalid value`;
      case "minlength":
        return `${field} is too short`;
      case "maxlength":
        return `${field} is too long`;
      case "min":
        return `${field} is too small`;
      case "max":
        return `${field} is too large`;
      case "ObjectId":
      case "Number":
      case "Date":
      case "Boolean":
        return `${field} is not valid`;
      default:
        // Custom validator messages written by us are already readable;
        // Mongoose's own default text is not.
        return e.message && !/^Path `|Validator failed|Cast to/.test(e.message)
          ? e.message
          : `${field} is not valid`;
    }
  });
  if (!lines.length) return "Please check the information you entered";
  const shown = lines.slice(0, 3).join(". ");
  return lines.length > 3 ? `${shown}. And ${lines.length - 3} more.` : shown;
}

const errorHandler = (err, req, res, next) => {
  let status = res.statusCode !== 200 ? res.statusCode : 500;

  // Errors that are the client's fault but arrive here without a status set.
  const isClientError =
    err.name === "ValidationError" ||
    err.name === "CastError" ||
    err.code === 11000 ||
    err.type === "entity.parse.failed" ||
    err.type === "entity.too.large" ||
    (err.name === "MulterError");
  if (status === 500 && isClientError) {
    status = err.type === "entity.too.large" || err.code === "LIMIT_FILE_SIZE" ? 413 : 400;
  }

  if (process.env.NODE_ENV !== "test") {
    console.error(
      `[${new Date().toISOString()}] ${req.method} ${req.originalUrl} — ${status} ${err.message}`,
    );
    if (status === 500 && process.env.NODE_ENV !== "production") {
      console.error(err.stack);
    }
  }

  let message = err.message || "An unexpected error occurred";
  // Never leak internal/DB error text to clients on server errors in production.
  if (status >= 500 && process.env.NODE_ENV === "production") {
    message = "Something went wrong. Please try again.";
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0];
    message =
      field === "email"
        ? "An account with this email already exists"
        : field
          ? `${humanizeField(field)} already exists. Please use a different one`
          : "A record with this value already exists";
  }

  if (err.name === "CastError") {
    message = `${humanizeField(err.path)} is not valid`;
  }

  if (err.name === "ValidationError") message = validationMessage(err);

  if (err.type === "entity.parse.failed") {
    message = "The information sent could not be read. Please check it and try again";
  }
  if (err.type === "entity.too.large") {
    message = "The data you sent is too large";
  }
  if (err.name === "MulterError") {
    message =
      err.code === "LIMIT_FILE_SIZE"
        ? "That file is too large. Please choose a smaller one"
        : err.code === "LIMIT_UNEXPECTED_FILE"
          ? "Unexpected file was attached. Please try again"
          : "The file could not be uploaded. Please try again";
  }

  if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
    message = "Not authorized, please log in again";
  }

  res.status(status).json({
    success: false,
    message,
    ...(err.code === "FEE_OVERDUE" && { code: err.code, details: err.details }),
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
};

module.exports = errorHandler;
