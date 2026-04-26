import { HttpError } from "../lib/http-error.js";
import { logger } from "../lib/logger.js";

export function errorMiddleware(error, req, res, _) {
  const statusCode = error instanceof HttpError ? error.statusCode : 500;

  logger.error(
    {
      err: error,
      path: req.originalUrl,
      method: req.method,
      statusCode,
    },
    "request_failed",
  );

  res.status(statusCode).json({
    error: error.name || "InternalServerError",
    message: error.message || "Unexpected error",
    details: error.details || null,
  });
}
