// const customerRepository = require('../repositories/customerRepository');
// const lookupService = require('./lookupService');
// const validationService = require('./validationService');
// const { chunkArray } = require('../utils/chunker');
// const MetricsCollector = require('../utils/metrics');
// const logger = require('../utils/logger');
// const { CHUNK_SIZE, MAX_BATCH_SIZE } = require('../config/constants');

// /**
//  * Delta Service - Core business logic for delta ingestion
//  * Handles the complete flow: validation -> delta detection -> lookup resolution -> insert
//  */
// class DeltaService {
//     /**
//      * Main ingestion method
//      * @param {Array<Object>} incomingCustomers - Array of customer records from external source
//      * @param {Object} options - Processing options
//      * @returns {Promise<Object>} Ingestion result with metrics
//      */
//     async ingestCustomers(incomingCustomers, options = {}) {
//         const metrics = new MetricsCollector();
//         metrics.start();

//         try {
//             logger.info(`Starting ingestion of ${incomingCustomers.length} customers`);
//             metrics.recordReceived(incomingCustomers.length);

//             // Step 1: Validate batch size
//             const sizeValidation = validationService.validateBatchSize(
//                 incomingCustomers, 
//                 options.maxBatchSize || MAX_BATCH_SIZE
//             );

//             if (!sizeValidation.isValid) {
//                 throw new Error(
//                     `Batch size ${sizeValidation.size} exceeds maximum ${sizeValidation.maxSize}`
//                 );
//             }

//             // Step 2: Validate and sanitize input data
//             const validation = validationService.validateBatch(incomingCustomers);
            
//             if (validation.invalid.length > 0) {
//                 logger.warn(`Found ${validation.invalid.length} invalid records`);
//                 metrics.recordFailed(validation.invalid.length);
//             }

//             if (validation.valid.length === 0) {
//                 metrics.end();
//                 return {
//                     success: false,
//                     ...metrics.getSummary(),
//                     errors: validation.errors
//                 };
//             }

//             // Step 3: Remove duplicates within the batch
//             const uniqueCustomers = validationService.removeDuplicates(validation.valid);
//             const duplicatesRemoved = validation.valid.length - uniqueCustomers.length;
            
//             if (duplicatesRemoved > 0) {
//                 metrics.recordFailed(duplicatesRemoved);
//             }

//             // Step 4: Initialize lookup caches
//             if (!lookupService.isCacheInitialized()) {
//                 await lookupService.initializeCaches();
//             }

//             // Step 5: Resolve lookup codes (country_code -> country_id, status_code -> status_id)
//             const lookupResult = lookupService.resolveCustomerLookups(uniqueCustomers, metrics);

//             if (lookupResult.failed.length > 0) {
//                 logger.warn(`Failed to resolve lookups for ${lookupResult.failed.length} records`);
//                 metrics.recordFailed(lookupResult.failed.length);
//             }

//             if (lookupResult.resolved.length === 0) {
//                 metrics.end();
//                 return {
//                     success: false,
//                     ...metrics.getSummary(),
//                     errors: lookupResult.failed.map(f => f.reason)
//                 };
//             }

//             // Step 6: Delta detection - find which customers are new
//             const deltaResult = await this.detectDelta(lookupResult.resolved, metrics);

//             logger.info(`Delta detected: ${deltaResult.newCustomers.length} new, ${deltaResult.existingCustomers.length} existing`);
//             metrics.recordSkipped(deltaResult.existingCustomers.length);

//             if (deltaResult.newCustomers.length === 0) {
//                 logger.info('No new customers to insert');
//                 metrics.end();
//                 return {
//                     success: true,
//                     ...metrics.getSummary(),
//                     message: 'All customers already exist'
//                 };
//             }

//             // Step 7: Bulk insert new customers
//             const insertResult = await this.insertNewCustomers(
//                 deltaResult.newCustomers, 
//                 metrics,
//                 options
//             );

//             metrics.recordInserted(insertResult.inserted);
//             metrics.end();

//             logger.info('Ingestion completed successfully', metrics.getSummary());

//             return {
//                 success: true,
//                 ...metrics.getSummary(),
//                 validationErrors: validation.invalid.length > 0 ? 
//                     validation.invalid.map(i => ({ index: i.index, errors: i.errors })) : undefined,
//                 lookupErrors: lookupResult.failed.length > 0 ?
//                     lookupResult.failed.map(f => ({ index: f.index, reason: f.reason })) : undefined
//             };

//         } catch (error) {
//             metrics.end();
//             metrics.recordError(error);
//             logger.error('Ingestion failed:', error);
            
//             return {
//                 success: false,
//                 ...metrics.getSummary(),
//                 error: error.message
//             };
//         }
//     }

//     /**
//      * Detect delta - identify new customers vs existing customers
//      * Uses bulk query to avoid N+1 problem
//      * @param {Array<Object>} customers - Customers with resolved lookup IDs
//      * @param {Object} metrics - Metrics collector
//      * @returns {Promise<Object>} Delta result
//      */
//     async detectDelta(customers, metrics) {
//         try {
//             // Extract all external_ids
//             const externalIds = customers.map(c => c.external_id);

//             // Bulk check which ones already exist (single query)
//             const existingIds = await customerRepository.getExistingExternalIds(externalIds);
//             metrics.recordDbQuery();

//             // Partition into new vs existing
//             const newCustomers = [];
//             const existingCustomers = [];

//             customers.forEach(customer => {
//                 if (existingIds.has(customer.external_id)) {
//                     existingCustomers.push(customer);
//                 } else {
//                     newCustomers.push(customer);
//                 }
//             });

//             return {
//                 newCustomers,
//                 existingCustomers,
//                 totalChecked: customers.length
//             };

//         } catch (error) {
//             logger.error('Error detecting delta:', error);
//             throw error;
//         }
//     }

//     /**
//      * Insert new customers with chunking for large datasets
//      * @param {Array<Object>} customers - New customers to insert
//      * @param {Object} metrics - Metrics collector
//      * @param {Object} options - Processing options
//      * @returns {Promise<Object>} Insert result
//      */
//     async insertNewCustomers(customers, metrics, options = {}) {
//         try {
//             const chunkSize = options.chunkSize || CHUNK_SIZE;

//             // For small batches, insert directly
//             if (customers.length <= chunkSize) {
//                 metrics.recordChunkProcessed();
//                 metrics.recordDbQuery();
//                 return await customerRepository.bulkInsert(customers);
//             }

//             // For large batches, chunk and process
//             const chunks = chunkArray(customers, chunkSize);
//             logger.info(`Processing ${customers.length} customers in ${chunks.length} chunks`);

//             let totalInserted = 0;
//             let totalFailed = 0;
//             let totalSkipped = 0;

//             for (let i = 0; i < chunks.length; i++) {
//                 const chunk = chunks[i];
//                 logger.info(`Processing chunk ${i + 1}/${chunks.length} (${chunk.length} records)`);

//                 const result = await customerRepository.bulkInsert(chunk);
//                 metrics.recordChunkProcessed();
//                 metrics.recordDbQuery();

//                 totalInserted += result.inserted;
//                 totalFailed += result.failed;
//                 totalSkipped += result.skipped;
//             }

//             return {
//                 inserted: totalInserted,
//                 failed: totalFailed,
//                 skipped: totalSkipped
//             };

//         } catch (error) {
//             logger.error('Error inserting customers:', error);
//             throw error;
//         }
//     }

//     /**
//      * Dry run mode - show what would be inserted without actually writing
//      * @param {Array<Object>} incomingCustomers
//      * @param {Object} options
//      * @returns {Promise<Object>}
//      */
//     async dryRun(incomingCustomers, options = {}) {
//         const metrics = new MetricsCollector();
//         metrics.start();

//         try {
//             logger.info(`Starting DRY RUN for ${incomingCustomers.length} customers`);

//             // Validate
//             const validation = validationService.validateBatch(incomingCustomers);
//             const uniqueCustomers = validationService.removeDuplicates(validation.valid);

//             // Initialize lookups
//             if (!lookupService.isCacheInitialized()) {
//                 await lookupService.initializeCaches();
//             }

//             // Resolve lookups
//             const lookupResult = lookupService.resolveCustomerLookups(uniqueCustomers, metrics);

//             // Detect delta
//             const deltaResult = await this.detectDelta(lookupResult.resolved, metrics);

//             metrics.end();

//             return {
//                 dryRun: true,
//                 wouldInsert: deltaResult.newCustomers.length,
//                 wouldSkip: deltaResult.existingCustomers.length,
//                 validationErrors: validation.invalid.length,
//                 lookupErrors: lookupResult.failed.length,
//                 newCustomers: deltaResult.newCustomers.map(c => c.external_id),
//                 existingCustomers: deltaResult.existingCustomers.map(c => c.external_id),
//                 ...metrics.getSummary()
//             };

//         } catch (error) {
//             metrics.end();
//             logger.error('Dry run failed:', error);
//             throw error;
//         }
//     }
// }

// module.exports = new DeltaService();


const customerRepository = require('../repositories/customerRepository');
const lookupService = require('./lookupService');
const validationService = require('./validationService');
const { chunkArray } = require('../utils/chunker');
const MetricsCollector = require('../utils/metrics');
const logger = require('../utils/logger');
const { CHUNK_SIZE, MAX_BATCH_SIZE } = require('../config/constants');

/**
 * Delta Service - Core business logic for delta ingestion
 * Handles the complete flow: validation -> delta detection -> lookup resolution -> insert
 */
class DeltaService {
    /**
     * Main ingestion method
     * @param {Array<Object>} incomingCustomers - Array of customer records from external source
     * @param {Object} options - Processing options
     * @returns {Promise<Object>} Ingestion result with metrics
     */
    async ingestCustomers(incomingCustomers, options = {}) {
        const metrics = new MetricsCollector();
        metrics.start();

        try {
            logger.info(`Starting ingestion of ${incomingCustomers.length} customers`);
            metrics.recordReceived(incomingCustomers.length);

            // Step 1: Validate batch size
            const sizeValidation = validationService.validateBatchSize(
                incomingCustomers, 
                options.maxBatchSize || MAX_BATCH_SIZE
            );

            if (!sizeValidation.isValid) {
                throw new Error(
                    `Batch size ${sizeValidation.size} exceeds maximum ${sizeValidation.maxSize}`
                );
            }

            // Step 2: Validate and sanitize input data
            const validation = validationService.validateBatch(incomingCustomers);
            
            if (validation.invalid.length > 0) {
                logger.warn(`Found ${validation.invalid.length} invalid records`);
                metrics.recordFailed(validation.invalid.length);
            }

            if (validation.valid.length === 0) {
                metrics.end();
                return {
                    success: false,
                    ...metrics.getSummary(),
                    errors: validation.errors
                };
            }

            // Step 3: Remove duplicates within the batch
            const uniqueCustomers = validationService.removeDuplicates(validation.valid);
            const duplicatesRemoved = validation.valid.length - uniqueCustomers.length;
            
            if (duplicatesRemoved > 0) {
                metrics.recordFailed(duplicatesRemoved);
            }

            // Step 4: Initialize lookup caches
            if (!lookupService.isCacheInitialized()) {
                await lookupService.initializeCaches();
            }

            // Step 5: Resolve lookup codes (country_code -> country_id, status_code -> status_id)
            const lookupResult = lookupService.resolveCustomerLookups(uniqueCustomers, metrics);

            if (lookupResult.failed.length > 0) {
                logger.warn(`Failed to resolve lookups for ${lookupResult.failed.length} records`);
                metrics.recordFailed(lookupResult.failed.length);
            }

            if (lookupResult.resolved.length === 0) {
                metrics.end();
                return {
                    success: false,
                    ...metrics.getSummary(),
                    errors: lookupResult.failed.map(f => f.reason)
                };
            }

            // Step 6: Delta detection - find which customers are new
            const deltaResult = await this.detectDelta(lookupResult.resolved, metrics);

            logger.info(`Delta detected: ${deltaResult.newCustomers.length} new, ${deltaResult.existingCustomers.length} existing`);
            metrics.recordSkipped(deltaResult.existingCustomers.length);

            if (deltaResult.newCustomers.length === 0) {
                logger.info('No new customers to insert');
                metrics.end();
                return {
                    success: true,
                    ...metrics.getSummary(),
                    message: 'All customers already exist'
                };
            }

            // Step 7: Bulk insert new customers
            const insertResult = await this.insertNewCustomers(
                deltaResult.newCustomers, 
                metrics,
                options
            );

            metrics.recordInserted(insertResult.inserted);
            metrics.end();

            logger.info('Ingestion completed successfully', metrics.getSummary());

            return {
                success: true,
                ...metrics.getSummary(),
                validationErrors: validation.invalid.length > 0 ? 
                    validation.invalid.map(i => ({ index: i.index, errors: i.errors })) : undefined,
                lookupErrors: lookupResult.failed.length > 0 ?
                    lookupResult.failed.map(f => ({ index: f.index, reason: f.reason })) : undefined
            };

        } catch (error) {
            metrics.end();
            metrics.recordError(error);
            logger.error('Ingestion failed:', error);
            
            return {
                success: false,
                ...metrics.getSummary(),
                error: error.message
            };
        }
    }

    /**
     * Detect delta - identify new customers vs existing customers
     * Uses bulk query to avoid N+1 problem
     * @param {Array<Object>} customers - Customers with resolved lookup IDs
     * @param {Object} metrics - Metrics collector
     * @returns {Promise<Object>} Delta result
     */
    async detectDelta(customers, metrics) {
        try {
            // Extract all external_ids
            const externalIds = customers.map(c => c.external_id);

            // Bulk check which ones already exist (single query)
            const existingIds = await customerRepository.getExistingExternalIds(externalIds);
            metrics.recordDbQuery();

            // Partition into new vs existing
            const newCustomers = [];
            const existingCustomers = [];

            customers.forEach(customer => {
                if (existingIds.has(customer.external_id)) {
                    existingCustomers.push(customer);
                } else {
                    newCustomers.push(customer);
                }
            });

            return {
                newCustomers,
                existingCustomers,
                totalChecked: customers.length
            };

        } catch (error) {
            logger.error('Error detecting delta:', error);
            throw error;
        }
    }

    /**
     * Insert new customers with chunking for large datasets
     * @param {Array<Object>} customers - New customers to insert
     * @param {Object} metrics - Metrics collector
     * @param {Object} options - Processing options
     * @returns {Promise<Object>} Insert result
     */
    async insertNewCustomers(customers, metrics, options = {}) {
        try {
            const chunkSize = options.chunkSize || CHUNK_SIZE;

            // For small batches, insert directly
            if (customers.length <= chunkSize) {
                metrics.recordChunkProcessed();
                metrics.recordDbQuery();
                return await customerRepository.bulkInsert(customers);
            }

            // For large batches, chunk and process
            const chunks = chunkArray(customers, chunkSize);
            logger.info(`Processing ${customers.length} customers in ${chunks.length} chunks`);

            let totalInserted = 0;
            let totalFailed = 0;
            let totalSkipped = 0;

            for (let i = 0; i < chunks.length; i++) {
                const chunk = chunks[i];
                logger.info(`Processing chunk ${i + 1}/${chunks.length} (${chunk.length} records)`);

                const result = await customerRepository.bulkInsert(chunk);
                metrics.recordChunkProcessed();
                metrics.recordDbQuery();

                totalInserted += result.inserted;
                totalFailed += result.failed;
                totalSkipped += result.skipped;
            }

            return {
                inserted: totalInserted,
                failed: totalFailed,
                skipped: totalSkipped
            };

        } catch (error) {
            logger.error('Error inserting customers:', error);
            throw error;
        }
    }

    /**
     * Dry run mode - show what would be inserted without actually writing
     * WITH IMPROVED, READABLE ERROR MESSAGES
     * @param {Array<Object>} incomingCustomers
     * @param {Object} options
     * @returns {Promise<Object>}
     */
    async dryRun(incomingCustomers, options = {}) {
        const metrics = new MetricsCollector();
        metrics.start();

        try {
            logger.info(`Starting DRY RUN for ${incomingCustomers.length} customers`);

            // Validate
            const validation = validationService.validateBatch(incomingCustomers);
            const uniqueCustomers = validationService.removeDuplicates(validation.valid);

            // Track duplicates removed
            const duplicatesRemoved = validation.valid.length - uniqueCustomers.length;

            // Initialize lookups
            if (!lookupService.isCacheInitialized()) {
                await lookupService.initializeCaches();
            }

            // Resolve lookups
            const lookupResult = lookupService.resolveCustomerLookups(uniqueCustomers, metrics);

            // Detect delta
            const deltaResult = await this.detectDelta(lookupResult.resolved, metrics);

            metrics.end();

            // Build detailed, readable response
            const response = {
                dryRun: true,
                summary: {
                    totalReceived: incomingCustomers.length,
                    wouldInsert: deltaResult.newCustomers.length,
                    wouldSkip: deltaResult.existingCustomers.length,
                    validationErrors: validation.invalid.length,
                    lookupErrors: lookupResult.failed.length,
                    duplicatesInBatch: duplicatesRemoved
                },
                details: {}
            };

            // Add validation errors if any (with full details)
            if (validation.invalid.length > 0) {
                response.details.validationErrors = validation.invalid.map(item => ({
                    recordIndex: item.index,
                    externalId: item.customer.external_id || 'N/A',
                    issues: item.errors,
                    problematicRecord: item.customer
                }));
            }

            // Add lookup errors if any (with full details)
            if (lookupResult.failed.length > 0) {
                response.details.lookupErrors = lookupResult.failed.map(item => ({
                    recordIndex: item.index,
                    externalId: item.record.external_id,
                    issue: item.reason,
                    invalidCode: this.extractInvalidCode(item.reason),
                    problematicRecord: item.record
                }));
                
                // Add hint about valid codes
                response.details.validCodesHint = {
                    message: "Valid codes are loaded in the system. Check countries and statuses tables.",
                    countries: "Valid country codes: US, IN, UK, CA, AU, DE, FR, JP, CN, BR",
                    statuses: "Valid status codes: ACTIVE, INACTIVE, PENDING, SUSPENDED"
                };
            }

            // Add duplicate info if any
            if (duplicatesRemoved > 0) {
                response.details.duplicatesInfo = {
                    count: duplicatesRemoved,
                    message: `Found ${duplicatesRemoved} duplicate external_id(s) within your batch.`,
                    action: 'Duplicates automatically removed. Only first occurrence kept.'
                };
            }

            // Add sample of new customers (limit to first 10 for readability)
            if (deltaResult.newCustomers.length > 0) {
                const sampleSize = Math.min(10, deltaResult.newCustomers.length);
                response.details.newCustomersSample = deltaResult.newCustomers
                    .slice(0, sampleSize)
                    .map(c => c.external_id);
                
                if (deltaResult.newCustomers.length > 10) {
                    response.details.newCustomersSample.push(
                        `... and ${deltaResult.newCustomers.length - 10} more`
                    );
                }
            }

            // Add sample of existing customers (limit to first 10)
            if (deltaResult.existingCustomers.length > 0) {
                const sampleSize = Math.min(10, deltaResult.existingCustomers.length);
                response.details.existingCustomersSample = deltaResult.existingCustomers
                    .slice(0, sampleSize)
                    .map(c => c.external_id);
                
                if (deltaResult.existingCustomers.length > 10) {
                    response.details.existingCustomersSample.push(
                        `... and ${deltaResult.existingCustomers.length - 10} more`
                    );
                }
            }

            // Add clear recommendation
            response.recommendation = this.getDryRunRecommendation(response.summary);

            // Add metrics
            response.metrics = {
                durationSeconds: metrics.getSummary().duration_seconds,
                cacheHitRatio: metrics.getSummary().cache_hit_ratio,
                recordsPerSecond: metrics.getSummary().records_per_second
            };

            return response;

        } catch (error) {
            metrics.end();
            logger.error('Dry run failed:', error);
            
            // Return user-friendly error
            return {
                dryRun: true,
                success: false,
                error: {
                    message: error.message,
                    type: 'SYSTEM_ERROR',
                    hint: 'This is a system error. Check your database connection and server logs.'
                }
            };
        }
    }

    /**
     * Extract invalid code from error message for better error display
     * @param {string} reason - Error reason like "Invalid country code: MARS"
     * @returns {Object|null} - Extracted code info or null
     */
    extractInvalidCode(reason) {
        const match = reason.match(/Invalid (country|status) code: (\w+)/);
        if (match) {
            return { 
                type: match[1], 
                code: match[2],
                field: match[1] === 'country' ? 'country_code' : 'status_code'
            };
        }
        return null;
    }

    /**
     * Generate smart recommendation based on dry run results
     * @param {Object} summary - Summary object with counts
     * @returns {Object} - Recommendation with action and next steps
     */
    getDryRunRecommendation(summary) {
        const { wouldInsert, validationErrors, lookupErrors, wouldSkip, totalReceived } = summary;

        // Case 1: Has errors - DO NOT PROCEED
        if (validationErrors > 0 || lookupErrors > 0) {
            return {
                action: '❌ DO NOT PROCEED',
                reason: `Found ${validationErrors} validation error(s) and ${lookupErrors} lookup error(s)`,
                severity: 'HIGH',
                nextSteps: [
                    '1. Review error details in the "details" section above',
                    '2. Fix all invalid records in your data file/source',
                    '3. Verify country codes and status codes are valid',
                    '4. Run dry-run again to confirm all issues are resolved',
                    '5. Only then proceed with actual ingestion'
                ]
            };
        }

        // Case 2: No new records - NO ACTION NEEDED
        if (wouldInsert === 0 && wouldSkip > 0) {
            return {
                action: '⚠️  NO ACTION NEEDED',
                reason: 'All records already exist in the database',
                severity: 'INFO',
                nextSteps: [
                    'No new customers to insert',
                    'If this is unexpected, verify your data contains new external_ids',
                    'Check if you\'re using the correct data file'
                ]
            };
        }

        // Case 3: Empty result
        if (wouldInsert === 0 && wouldSkip === 0) {
            return {
                action: '⚠️  NO VALID RECORDS',
                reason: 'No valid records found after processing',
                severity: 'WARNING',
                nextSteps: [
                    'Check validation and lookup errors above',
                    'Ensure your data has valid records'
                ]
            };
        }

        // Case 4: All good - SAFE TO PROCEED
        return {
            action: '✅ SAFE TO PROCEED',
            reason: `${wouldInsert} new customer(s) ready to be inserted${wouldSkip > 0 ? `, ${wouldSkip} will be skipped (already exist)` : ''}`,
            severity: 'SUCCESS',
            nextSteps: [
                `Run actual ingestion to insert ${wouldInsert} customer(s)`,
                'Use: POST /api/customers/ingest',
                'Send the same data you used for this dry-run'
            ],
            estimatedTime: `Estimated processing time: ~${Math.ceil(totalReceived / 1000)}s`
        };
    }
}

module.exports = new DeltaService();