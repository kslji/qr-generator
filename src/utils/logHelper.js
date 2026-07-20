const LOGGER_SERVICE_URL = process.env.LOGGER_SERVICE_URL || "http://localhost:8013";
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || "ts_internal_secret_key_change_me";

/**
 * Sends a log entry asynchronously to the central logger-service.
 */
function logToCentral(payload) {
  fetch(`${LOGGER_SERVICE_URL}/logs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-key": INTERNAL_API_KEY,
    },
    body: JSON.stringify(payload),
  }).catch((err) => {
    console.warn(`Failed to send log to central logger-service: ${err.message}`);
  });
}

/**
 * Express Middleware to log incoming API requests and execution times.
 */
function centralLoggerMiddleware(serviceName) {
  return (req, res, next) => {
    const startTime = performance.now();
    req._startTime = startTime;

    res.on("finish", () => {
      if (req.originalUrl === "/health" || req.originalUrl === "/") {
        return;
      }

      const durationMs = Math.round(performance.now() - startTime);
      const level = res.statusCode >= 400 ? "error" : "info";
      
      logToCentral({
        serviceName,
        functionName: `${req.method} ${req.route?.path || req.path}`,
        level,
        message: `${req.method} ${req.originalUrl} responded with status ${res.statusCode}`,
        durationMs,
        metadata: {
          method: req.method,
          url: req.originalUrl,
          statusCode: res.statusCode,
          ip: req.ip,
          userId: req.user?.userId,
        },
      });
    });

    next();
  };
}

/**
 * Express Error-handling Middleware to log uncaught errors and stack traces.
 */
function centralErrorLoggerMiddleware(serviceName) {
  return (err, req, res, next) => {
    const durationMs = req._startTime ? Math.round(performance.now() - req._startTime) : undefined;
    
    logToCentral({
      serviceName,
      functionName: `${req.method} ${req.route?.path || req.path}`,
      level: "error",
      message: `Unhandled error in ${req.method} ${req.originalUrl}: ${err.message || err}`,
      durationMs,
      metadata: {
        method: req.method,
        url: req.originalUrl,
        ip: req.ip,
        userId: req.user?.userId,
        error: {
          message: err.message,
          stack: err.stack,
        },
      },
    });

    next(err);
  };
}

module.exports = {
  logToCentral,
  centralLoggerMiddleware,
  centralErrorLoggerMiddleware,
};
