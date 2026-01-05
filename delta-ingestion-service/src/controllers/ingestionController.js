const deltaService = require('../services/deltaService');
const logger = require('../utils/logger');
const { HTTP_STATUS } = require('../config/constants');

class IngestionController {
    /**
     * Main ingestion endpoint
     */
    async ingestCustomers(req, res) {
        try {
            const customers = req.body;

            // Basic input validation
            if (!Array.isArray(customers)) {
                return res.status(HTTP_STATUS.BAD_REQUEST).json({
                    success: false,
                    error: 'Request body must be an array of customer objects'
                });
            }

            logger.info(`Received ingestion request with ${customers.length} customers`);

            // Process ingestion
            const result = await deltaService.ingestCustomers(customers);

            // Return appropriate status code
            const statusCode = result.success ? HTTP_STATUS.OK : HTTP_STATUS.BAD_REQUEST;

            return res.status(statusCode).json(result);

        } catch (error) {
            logger.error('Controller error:', error);
            return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
                success: false,
                error: 'Internal server error',
                message: error.message
            });
        }
    }

    /**
     * Dry run endpoint - shows what would be inserted without writing
     */
    async dryRun(req, res) {
        try {
            const customers = req.body;

            if (!Array.isArray(customers)) {
                return res.status(HTTP_STATUS.BAD_REQUEST).json({
                    success: false,
                    error: 'Request body must be an array of customer objects'
                });
            }

            logger.info(`Received dry-run request with ${customers.length} customers`);

            // Process dry run
            const result = await deltaService.dryRun(customers);

            return res.status(HTTP_STATUS.OK).json(result);

        } catch (error) {
            logger.error('Dry run controller error:', error);
            return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
                success: false,
                error: 'Internal server error',
                message: error.message
            });
        }
    }

    /**
        * GET /health
     * Health check endpoint
     */
    async healthCheck(req, res) {
        try {
            const { neonConnection } = require('../config/database');
            const dbConnected = await neonConnection();
            const lookupService = require('../services/lookupService');
            const cacheStats = lookupService.getCacheStats();

            return res.status(HTTP_STATUS.OK).json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                database: {
                    connected: dbConnected
                },
                cache: cacheStats
            });

        } catch (error) {
            logger.error('Health check failed:', error);
            return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
                status: 'unhealthy',
                error: error.message
            });
        }
    }

    /**
   
     * Get database statistics
     */
    async getStats(req, res) {
        try {
            const customerRepository = require('../repositories/customerRepository');
            const customerCount = await customerRepository.getCount();
            const lookupService = require('../services/lookupService');
            const cacheStats = lookupService.getCacheStats();

            return res.status(HTTP_STATUS.OK).json({
                customers: {
                    total: customerCount
                },
                cache: cacheStats
            });

        } catch (error) {
            logger.error('Stats error:', error);
            return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
                success: false,
                error: error.message
            });
        }
    }
}

module.exports = new IngestionController();