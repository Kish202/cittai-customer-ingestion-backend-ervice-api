const { pool } = require('../config/database');
const logger = require('../utils/logger');

class CountryRepository {
    /**
     * Fetch all countries with their codes and IDs
     * Used for building in-memory lookup cache
     * @returns {Promise<Map>} Map of country_code -> country_id
     */
    async getAllCountries() {
        try {
            const query = 'SELECT id, code, name FROM countries';
            const result = await pool.query(query);
            
            // Build a Map for O(1) lookup
            const countryMap = new Map();
            result.rows.forEach(row => {
                countryMap.set(row.code, {
                    id: row.id,
                    name: row.name
                });
            });
            
            logger.info(`Loaded ${countryMap.size} countries into cache`);
            return countryMap;
        } catch (error) {
            logger.error('Error fetching countries:', error);
            throw error;
        }
    }

    /**
     * Get country ID by code
     * @param {string} code - Country code (e.g., "US")
     * @returns {Promise<number|null>} Country ID or null if not found
     */
    async getCountryIdByCode(code) {
        try {
            const query = 'SELECT id FROM countries WHERE code = $1';
            const result = await pool.query(query, [code]);
            
            return result.rows.length > 0 ? result.rows[0].id : null;
        } catch (error) {
            logger.error(`Error fetching country by code ${code}:`, error);
            throw error;
        }
    }

    /**
     * Bulk fetch country IDs by codes
     * @param {Array<string>} codes - Array of country codes
     * @returns {Promise<Map>} Map of code -> id
     */
    async getCountryIdsByCodes(codes) {
        try {
            if (!codes || codes.length === 0) {
                return new Map();
            }

            const query = 'SELECT id, code FROM countries WHERE code = ANY($1::text[])';
            const result = await pool.query(query, [codes]);
            
            const countryMap = new Map();
            result.rows.forEach(row => {
                countryMap.set(row.code, row.id);
            });
            
            return countryMap;
        } catch (error) {
            logger.error('Error bulk fetching countries:', error);
            throw error;
        }
    }

    /**
     * Check if country code exists
     * @param {string} code - Country code
     * @returns {Promise<boolean>}
     */
    async exists(code) {
        try {
            const query = 'SELECT 1 FROM countries WHERE code = $1';
            const result = await pool.query(query, [code]);
            return result.rows.length > 0;
        } catch (error) {
            logger.error(`Error checking country existence ${code}:`, error);
            throw error;
        }
    }
}


module.exports = new CountryRepository();