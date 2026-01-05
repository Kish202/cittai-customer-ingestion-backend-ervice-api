
const { pool } = require('../config/database');
const logger = require('../utils/logger');

class CustomerRepository {
    /**
     * Bulk check which external_ids already exist in the database
     * This is critical for delta detection - avoids N+1 queries
     * @param {Array<string>} externalIds - Array of external IDs to check
     * @returns {Promise<Set>} Set of existing external IDs
     */
    async getExistingExternalIds(externalIds) {
        try {
            if (!externalIds || externalIds.length === 0) {
                return new Set();
            }

            const query = `
                SELECT external_id 
                FROM customers 
                WHERE external_id = ANY($1::text[])
            `;
            
            const result = await pool.query(query, [externalIds]);
            
            // Return as Set for O(1) lookup
            const existingIds = new Set(result.rows.map(row => row.external_id));
            
            logger.info(`Found ${existingIds.size} existing customers out of ${externalIds.length} checked`);
            return existingIds;
        } catch (error) {
            logger.error('Error checking existing external IDs:', error);
            throw error;
        }
    }

    /**
     * Bulk insert customers with proper transaction handling
     * Uses PostgreSQL's multi-row INSERT for efficiency
     * ON CONFLICT ensures idempotency
     * @param {Array<Object>} customers - Array of customer objects with resolved IDs
     * @returns {Promise<Object>} Result with inserted count
     */
    async bulkInsert(customers) {
        const client = await pool.connect();
        
        try {
            if (!customers || customers.length === 0) {
                return { inserted: 0, failed: 0 };
            }

            await client.query('BEGIN');

            // Build parameterized query for bulk insert
            // This prevents SQL injection and is more efficient than individual inserts
            const values = [];
            const placeholders = [];
            
            customers.forEach((customer, index) => {
                const offset = index * 5;
                placeholders.push(
                    `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5})`
                );
                values.push(
                    customer.external_id,
                    customer.name,
                    customer.email,
                    customer.country_id,
                    customer.status_id
                );
            });

            const query = `
                INSERT INTO customers (external_id, name, email, country_id, status_id)
                VALUES ${placeholders.join(', ')}
                ON CONFLICT (external_id) DO NOTHING
                RETURNING customer_id
            `;

            const result = await client.query(query, values);
            
            await client.query('COMMIT');

            const inserted = result.rowCount;
            const skipped = customers.length - inserted;

            logger.info(`Bulk insert: ${inserted} inserted, ${skipped} skipped (existing)`);

            return { 
                inserted,
                failed: 0,
                skipped
            };
        } catch (error) {
            await client.query('ROLLBACK');
            logger.error('Error during bulk insert:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Bulk insert with chunk support for very large datasets
     * Processes inserts in manageable chunks to avoid parameter limits
     * @param {Array<Object>} customers - Array of customer objects
     * @param {number} chunkSize - Size of each chunk (default 10000)
     * @returns {Promise<Object>} Aggregate results
     */
    async bulkInsertChunked(customers, chunkSize = 10000) {
        try {
            const totalInserted = { inserted: 0, failed: 0, skipped: 0 };
            
        
            for (let i = 0; i < customers.length; i += chunkSize) {
                const chunk = customers.slice(i, i + chunkSize);
                const result = await this.bulkInsert(chunk);
                
                totalInserted.inserted += result.inserted;
                totalInserted.failed += result.failed;
                totalInserted.skipped += result.skipped;
            }
            
            return totalInserted;
        } catch (error) {
            logger.error('Error during chunked bulk insert:', error);
            throw error;
        }
    }

    /**
     * Get customer count for monitoring
     * @returns {Promise<number>}
     */
    async getCount() {
        try {
            const query = 'SELECT COUNT(*) as count FROM customers';
            const result = await pool.query(query);
            return parseInt(result.rows[0].count);
        } catch (error) {
            logger.error('Error getting customer count:', error);
            throw error;
        }
    }

    /**
     * Get customer by external ID
     * @param {string} externalId
     * @returns {Promise<Object|null>}
     */ 
    async getByExternalId(externalId) {
        try {
            const query = `
                SELECT c.*, 
                       co.code as country_code, co.name as country_name,
                       cs.code as status_code, cs.name as status_name
                FROM customers c
                JOIN countries co ON c.country_id = co.id
                JOIN customer_status cs ON c.status_id = cs.id
                WHERE c.external_id = $1
            `;
            const result = await pool.query(query, [externalId]);
            return result.rows.length > 0 ? result.rows[0] : null;
        } catch (error) {
            logger.error(`Error fetching customer ${externalId}:`, error);
            throw error;
        }
    }
}

module.exports = new CustomerRepository();
