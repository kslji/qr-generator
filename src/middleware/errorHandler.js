const logger = require('../utils/logger');
const AppError = require('../utils/AppError');

function notFoundHandler(req, res, next) {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404, 'NOT_FOUND'));
}

// Must be registered last, and must have 4 args for Express to treat it
// as an error handler.
function errorHandler(err, req, res, _next) {
  const isAppError = err instanceof AppError;
  const statusCode = isAppError ? err.statusCode : 500;
  const code = isAppError ? err.code : 'INTERNAL_ERROR';

  if (!isAppError || statusCode >= 500) {
    logger.error(err.message, { stack: err.stack, path: req.originalUrl });
  } else {
    logger.warn(err.message, { path: req.originalUrl, code });
  }

  res.status(statusCode).json({
    error: {
      code,
      message: isAppError ? err.message : 'An unexpected error occurred.'
    }
  });
}

module.exports = { notFoundHandler, errorHandler };
