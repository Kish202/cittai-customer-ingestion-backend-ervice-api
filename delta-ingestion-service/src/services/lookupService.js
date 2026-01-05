const countryRepository = require('../repositories/countryRepository');
const statusRepository = require('../repositories/statusRepository');
const logger = require('../utils/logger');


class LookupService {
    constructor() {
        this.countryCache = null;
        this.statusCache = null;
        this.cacheTimestamp = null;
    }

    /**
     * Initialize lookup caches
     * Should be called at service startup or before each ingestion batch
     * @returns {Promise<void>}
     */
    async initializeCaches() {
        try {
            logger.info('Initializing lookup caches...');
            
            const [countryMap, statusMap] = await Promise.all([
                countryRepository.getAllCountries(),
                statusRepository.getAllStatuses()
            ]);

            this.countryCache = countryMap;
            this.statusCache = statusMap;
            this.cacheTimestamp = Date.now();

            logger.info('Lookup caches initialized successfully', {
                countries: this.countryCache.size,
                statuses: this.statusCache.size
            });
        } catch (error) {
            logger.error('Error initializing lookup caches:', error);
            throw error;
        }
    }

    /**
     * Resolve country code to country ID
     * @param {string} countryCode - Country code (e.g., "US")
     * @param {Object} metrics - Metrics collector
     * @returns {number|null} Country ID or null if not found
     */
    resolveCountryCode(countryCode, metrics = null) {
        if (!this.countryCache) {
            throw new Error('Country cache not initialized. Call initializeCaches() first.');
        }

        const country = this.countryCache.get(countryCode);
        
        if (country) {
            if (metrics) metrics.recordCacheHit();
            return country.id;
        }

        if (metrics) metrics.recordCacheMiss();
        return null;
    }

    /**
     * Resolve status code to status ID
     * @param {string} statusCode - Status code (e.g., "ACTIVE")
     * @param {Object} metrics - Metrics collector
     * @returns {number|null} Status ID or null if not found
     */
    resolveStatusCode(statusCode, metrics = null) {
        if (!this.statusCache) {
            throw new Error('Status cache not initialized. Call initializeCaches() first.');
        }

        const status = this.statusCache.get(statusCode);
        
        if (status) {
            if (metrics) metrics.recordCacheHit();
            return status.id;
        }

        if (metrics) metrics.recordCacheMiss();
        return null;
    }

    /**
     * Resolve multiple customer records
     * Converts country_code and status_code to their respective IDs
     * @param {Array<Object>} customers - Array of customer records with codes
     * @param {Object} metrics - Metrics collector
     * @returns {Object} Object with resolved and failed records
     */
    resolveCustomerLookups(customers, metrics = null) {
        const resolved = [];
        const failed = [];

        customers.forEach((customer, index) => {
            const countryId = this.resolveCountryCode(customer.country_code, metrics);
            const statusId = this.resolveStatusCode(customer.status_code, metrics);

            if (countryId === null) {
                failed.push({
                    record: customer,
                    reason: `Invalid country code: ${customer.country_code}`,
                    index
                });
                return;
            }

            if (statusId === null) {
                failed.push({
                    record: customer,
                    reason: `Invalid status code: ${customer.status_code}`,
                    index
                });
                return;
            }

            resolved.push({
                external_id: customer.external_id,
                name: customer.name,
                email: customer.email,
                country_id: countryId,
                status_id: statusId
            });
        });

        logger.info(`Lookup resolution: ${resolved.length} resolved, ${failed.length} failed`);

        return { resolved, failed };
    }

    /**
     * Check if caches are initialized
     * @returns {boolean}
     */
    isCacheInitialized() {
        return this.countryCache !== null && this.statusCache !== null;
    }

    /**
     * Get cache statistics
     * @returns {Object}
     */
    getCacheStats() {
        return {
            initialized: this.isCacheInitialized(),
            countries: this.countryCache ? this.countryCache.size : 0,
            statuses: this.statusCache ? this.statusCache.size : 0,
            timestamp: this.cacheTimestamp ? new Date(this.cacheTimestamp).toISOString() : null
        };
    }

    /**
     * Clear caches (useful for testing or forced refresh)
     */
    clearCaches() {
        this.countryCache = null;
        this.statusCache = null;
        this.cacheTimestamp = null;
        logger.info('Lookup caches cleared');
    }

    /**
     * Validate if all required lookup codes exist
     * Useful for pre-validation before processing
     * @param {Array<Object>} customers
     * @returns {Object} Validation result
     */
    validateLookupCodes(customers) {
        const invalidCountries = new Set();
        const invalidStatuses = new Set();

        customers.forEach(customer => {
            if (!this.countryCache.has(customer.country_code)) {
                invalidCountries.add(customer.country_code);
            }
            if (!this.statusCache.has(customer.status_code)) {
                invalidStatuses.add(customer.status_code);
            }
        });

        const isValid = invalidCountries.size === 0 && invalidStatuses.size === 0;

        return {
            isValid,
            invalidCountries: Array.from(invalidCountries),
            invalidStatuses: Array.from(invalidStatuses)
        };
    }
}

module.exports = new LookupService();