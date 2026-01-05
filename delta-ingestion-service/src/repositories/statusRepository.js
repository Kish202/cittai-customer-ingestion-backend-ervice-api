const { pool } = require('../config/database');
const logger = require('../utils/logger');

class CustomerStatusRepository {
    /**
     * Fetch all customer statuses with their codes and IDs
     * Used for building in-memory lookup cache
     * @returns {Promise<Map>} Map of status_code -> status_id
     */
    async getAllStatuses() {
        try {
            const query = 'SELECT id, code, name FROM customer_status';
            const result = await pool.query(query);
            
            // Build a Map for O(1) lookup
            const statusMap = new Map();
            result.rows.forEach(row => {
                statusMap.set(row.code, {
                    id: row.id,
                    name: row.name
                });
            });
            
            logger.info(`Loaded ${statusMap.size} customer statuses into cache`);
            return statusMap;
        } catch (error) {
            logger.error('Error fetching customer statuses:', error);
            throw error;
        }
    }

    /**
     * Get status ID by code
     * @param {string} code - Status code (e.g., "ACTIVE")
     * @returns {Promise<number|null>} Status ID or null if not found
     */
    async getStatusIdByCode(code) {
        try {
            const query = 'SELECT id FROM customer_status WHERE code = $1';
            const result = await pool.query(query, [code]);
            
            return result.rows.length > 0 ? result.rows[0].id : null;
        } catch (error) {
            logger.error(`Error fetching status by code ${code}:`, error);
            throw error;
        }
    }

    /**
     * Bulk fetch status IDs by codes
     * @param {Array<string>} codes - Array of status codes
     * @returns {Promise<Map>} Map of code -> id
     */
    async getStatusIdsByCodes(codes) {
        try {
            if (!codes || codes.length === 0) {
                return new Map();
            }

            const query = 'SELECT id, code FROM customer_status WHERE code = ANY($1::text[])';
            const result = await pool.query(query, [codes]);
            
            const statusMap = new Map();
            result.rows.forEach(row => {
                statusMap.set(row.code, row.id);
            });
            
            return statusMap;
        } catch (error) {
            logger.error('Error bulk fetching statuses:', error);
            throw error;
        }
    }

    /**
     * Check if status code exists
     * @param {string} code - Status code
     * @returns {Promise<boolean>}
     */
    async exists(code) {
        try {
            const query = 'SELECT 1 FROM customer_status WHERE code = $1';
            const result = await pool.query(query, [code]);
            return result.rows.length > 0;
        } catch (error) {
            logger.error(`Error checking status existence ${code}:`, error);
            throw error;
        }
    }
}


module.exports = new CustomerStatusRepository();