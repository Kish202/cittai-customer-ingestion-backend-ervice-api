const logger = require('../utils/logger');
const { HTTP_STATUS, MAX_BATCH_SIZE } = require('../config/constants');

/**
 * Request validation middleware
 */

/**
 * Validate JSON body exists
 */
function validateJsonBody(req, res, next) {
    if (!req.body || Object.keys(req.body).length === 0) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
            success: false,
            error: 'Request body is required'
        });
    }
    next();
}

/**
 * Validate content type is JSON
 */
function validateContentType(req, res, next) {
    if (!req.is('application/json')) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
            success: false,
            error: 'Content-Type must be application/json'
        });
    }
    next();
}

/**
 * Validate batch size doesn't exceed limit
 */
function validateBatchSize(req, res, next) {
    if (Array.isArray(req.body) && req.body.length > MAX_BATCH_SIZE) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
            success: false,
            error: `Batch size ${req.body.length} exceeds maximum allowed ${MAX_BATCH_SIZE}`,
            received: req.body.length,
            max_allowed: MAX_BATCH_SIZE
        });
    }
    next();
}

/**
 * Request logger middleware
 */
function requestLogger(req, res, next) {
    const start = Date.now();
    
    res.on('finish', () => {
        const duration = Date.now() - start;
        logger.info(`${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
    });
    
    next();
}

module.exports = {
    validateJsonBody,
    validateContentType,
    validateBatchSize,
    requestLogger
};