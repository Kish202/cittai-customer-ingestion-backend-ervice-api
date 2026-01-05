const express = require('express');
const dotenv = require('dotenv');
const { neonConnection, closePool } = require('./config/database');
const lookupService = require('./services/lookupService');
const logger = require('./utils/logger');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { requestLogger } = require('./middleware/requestValidator');
const ingestionRoutes = require('./routes/ingestion.routes');
const { PORT } = require('./config/constants');

// Load environment variables
dotenv.config();

// Create Express app
const app = express();
const path = require('path');

// Middleware
app.use(express.json({ limit: '50mb' })); // Support large JSON payloads
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

// Serve static files (frontend)
app.use(express.static(path.join(__dirname, '../public')));


// Routes
app.use('/api', ingestionRoutes);
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});


// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Initialize service
async function initialize() {
    try {
        logger.info('Initializing Delta Ingestion Service...');

        // Test database connection
        const dbConnected = await neonConnection();
        if (!dbConnected) {
            throw new Error('Database connection failed');
        }

        // Initialize lookup caches
        await lookupService.initializeCaches();

        logger.info('Service initialized successfully');
        return true;
    } catch (error) {
        logger.error('Initialization failed:', error);
        return false;
    }
}

// Start server
async function start() {
    const initialized = await initialize();
    
    if (!initialized) {
        logger.error('Failed to initialize service. Exiting...');
        process.exit(1);
    }

    // const server = app.listen(PORT, () => {
    //     logger.info(`Server running on port ${PORT}`);
    //     logger.info(`Environment: ${process.env.NODE_ENV || 'production'}`);
    // });

    // Graceful shutdown
    const gracefulShutdown = async (signal) => {
        logger.info(`${signal} received. Starting graceful shutdown...`);
        
        server.close(async () => {
            logger.info('HTTP server closed');
            
            // Close database pool
            await closePool();
            
            logger.info('Graceful shutdown completed');
            process.exit(0);
        });

        // Force shutdown after 10 seconds
        setTimeout(() => {
            logger.error('Forced shutdown after timeout');
            process.exit(1);
        }, 10000);
    };

    // Handle shutdown signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Handle uncaught errors
    process.on('uncaughtException', (error) => {
        logger.error('Uncaught Exception:', error);
        gracefulShutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason, promise) => {
        logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
        gracefulShutdown('unhandledRejection');
    });
}

// Start the application
if (require.main === module) {
    start();
}

module.exports = app;