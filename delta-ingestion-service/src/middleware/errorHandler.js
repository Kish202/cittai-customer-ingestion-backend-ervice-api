const logger = require('../utils/logger');
const { HTTP_STATUS } = require('../config/constants');

/**
 * Global error handler middleware
 * Catches all unhandled errors and returns consistent error responses
 */
function errorHandler(err, req, res, next) {
    // Log the error
    logger.error('Unhandled error:', {
        message: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method
    });

    // Determine status code
    const statusCode = err.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR;

    // Send error response
    res.status(statusCode).json({
        success: false,
        error: err.message || 'Internal server error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
}

/**
 * 404 handler for unknown routes
 */
function notFoundHandler(req, res) {
    res.status(404).json({
        success: false,
        error: 'Route not found',
        path: req.path
    });
}

/**
 * Async route handler wrapper
 * Catches async errors and passes them to error handler
 */
function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

module.exports = {
    errorHandler,
    notFoundHandler,
    asyncHandler
};