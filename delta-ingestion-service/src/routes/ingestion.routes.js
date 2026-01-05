const express = require('express');
const router = express.Router();
const ingestionController = require('../controllers/ingestionController');
const { asyncHandler } = require('../middleware/errorHandler');
const { 
    validateJsonBody, 
    validateContentType, 
    validateBatchSize 
} = require('../middleware/requestValidator');

/**
 * POST /customers/ingest
 * Ingest customer data with delta detection
 * 
 * Request Body: Array of customer objects
 * [
 *   {
 *     "external_id": "cust_001",
 *     "name": "Alice",
 *     "email": "alice@example.com",
 *     "country_code": "US",
 *     "status_code": "ACTIVE"
 *   }
 * ]
 * 
 * Response:
 * {
 *   "received": 1000,
 *   "inserted": 120,
 *   "skipped_existing": 880,
 *   "failed": 0
 * }
 */
router.post(
    '/customers/ingest',
    validateContentType,
    validateJsonBody,
    validateBatchSize,
    asyncHandler(ingestionController.ingestCustomers.bind(ingestionController))
);

/**
 * POST /customers/ingest/dry-run
 * Dry run - show what would be inserted without writing
 */
router.post(
    '/customers/ingest/dry-run',
    validateContentType,
    validateJsonBody,
    validateBatchSize,
    asyncHandler(ingestionController.dryRun.bind(ingestionController))
);

/**
 * GET /health
 * Health check endpoint
 */
router.get(
    '/health',
    asyncHandler(ingestionController.healthCheck.bind(ingestionController))
);

/**
 * GET /stats
 * Get database statistics
 */
router.get(
    '/stats',
    asyncHandler(ingestionController.getStats.bind(ingestionController))
);

module.exports = router;