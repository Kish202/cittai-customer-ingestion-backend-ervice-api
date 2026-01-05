const { MAX_EMAIL_LENGTH, MAX_NAME_LENGTH, MAX_EXTERNAL_ID_LENGTH } = require('../config/constants');
const logger = require('../utils/logger');

class ValidationService {
    /**
     * Validate a single customer record
     * @param {Object} customer - Customer object
     * @param {number} index - Record index for error reporting
     * @returns {Object} Validation result
     */
    validateCustomer(customer, index) {
        const errors = [];

        // Required fields check
        if (!customer.external_id || typeof customer.external_id !== 'string') {
            errors.push(`Missing or invalid external_id at index ${index}`);
        }

        if (!customer.name || typeof customer.name !== 'string') {
            errors.push(`Missing or invalid name at index ${index}`);
        }

        if (!customer.email || typeof customer.email !== 'string') {
            errors.push(`Missing or invalid email at index ${index}`);
        }

        if (!customer.country_code || typeof customer.country_code !== 'string') {
            errors.push(`Missing or invalid country_code at index ${index}`);
        }

        if (!customer.status_code || typeof customer.status_code !== 'string') {
            errors.push(`Missing or invalid status_code at index ${index}`);
        }

        // Length validation
        if (customer.external_id && customer.external_id.length > MAX_EXTERNAL_ID_LENGTH) {
            errors.push(`external_id too long at index ${index} (max ${MAX_EXTERNAL_ID_LENGTH})`);
        }

        if (customer.name && customer.name.length > MAX_NAME_LENGTH) {
            errors.push(`name too long at index ${index} (max ${MAX_NAME_LENGTH})`);
        }

        if (customer.email && customer.email.length > MAX_EMAIL_LENGTH) {
            errors.push(`email too long at index ${index} (max ${MAX_EMAIL_LENGTH})`);
        }

        // Email format validation (basic)
        if (customer.email && !this.isValidEmail(customer.email)) {
            errors.push(`Invalid email format at index ${index}: ${customer.email}`);
        }

        // Trim whitespace
        if (customer.external_id) customer.external_id = customer.external_id.trim();
        if (customer.name) customer.name = customer.name.trim();
        if (customer.email) customer.email = customer.email.trim().toLowerCase();
        if (customer.country_code) customer.country_code = customer.country_code.trim().toUpperCase();
        if (customer.status_code) customer.status_code = customer.status_code.trim().toUpperCase();

        return {
            isValid: errors.length === 0,
            errors,
            customer
        };
    }

    /**
     * Validate batch of customers
     * @param {Array<Object>} customers - Array of customer objects
     * @returns {Object} Validation result with valid and invalid records
     */
    validateBatch(customers) {
        if (!Array.isArray(customers)) {
            return {
                isValid: false,
                valid: [],
                invalid: [],
                errors: ['Input must be an array']
            };
        }

        if (customers.length === 0) {
            return {
                isValid: false,
                valid: [],
                invalid: [],
                errors: ['Input array is empty']
            };
        }

        const valid = [];
        const invalid = [];
        const allErrors = [];

        customers.forEach((customer, index) => {
            const validation = this.validateCustomer(customer, index);
            
            if (validation.isValid) {
                valid.push(validation.customer);
            } else {
                invalid.push({
                    customer,
                    errors: validation.errors,
                    index
                });
                allErrors.push(...validation.errors);
            }
        });

        logger.info(`Validation: ${valid.length} valid, ${invalid.length} invalid out of ${customers.length}`);

        return {
            isValid: invalid.length === 0,
            valid,
            invalid,
            errors: allErrors
        };
    }

    /**
     * Check for duplicate external_ids within the batch
     * @param {Array<Object>} customers
     * @returns {Object} Duplicate detection result
     */
    findDuplicates(customers) {
        const seen = new Map();
        const duplicates = [];

        customers.forEach((customer, index) => {
            const id = customer.external_id;
            
            if (seen.has(id)) {
                duplicates.push({
                    external_id: id,
                    firstIndex: seen.get(id),
                    duplicateIndex: index
                });
            } else {
                seen.set(id, index);
            }
        });

        if (duplicates.length > 0) {
            logger.warn(`Found ${duplicates.length} duplicate external_ids in batch`);
        }

        return {
            hasDuplicates: duplicates.length > 0,
            duplicates,
            uniqueCount: seen.size
        };
    }

    /**
     * Remove duplicates from batch, keeping first occurrence
     * @param {Array<Object>} customers
     * @returns {Array<Object>} Deduplicated array
     */
    removeDuplicates(customers) {
        const seen = new Set();
        const unique = [];

        customers.forEach(customer => {
            if (!seen.has(customer.external_id)) {
                seen.add(customer.external_id);
                unique.push(customer);
            }
        });

        if (unique.length < customers.length) {
            logger.info(`Removed ${customers.length - unique.length} duplicates from batch`);
        }

        return unique;
    }

    /**
     * Basic email validation
     * @param {string} email
     * @returns {boolean}
     */
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    /**
     * Validate batch size
     * @param {Array} customers
     * @param {number} maxSize
     * @returns {Object}
     */
    validateBatchSize(customers, maxSize) {
        const isValid = customers.length <= maxSize;
        
        if (!isValid) {
            logger.warn(`Batch size ${customers.length} exceeds maximum ${maxSize}`);
        }

        return {
            isValid,
            size: customers.length,
            maxSize,
            exceededBy: isValid ? 0 : customers.length - maxSize
        };
    }
}

module.exports = new ValidationService();