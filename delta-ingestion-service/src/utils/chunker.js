/**
 * Utility for chunking large arrays into smaller batches
 * Critical for handling 10M records without memory overflow
 */

/**
 * Split an array into chunks of specified size
 * @param {Array} array - Array to chunk
 * @param {number} chunkSize - Size of each chunk
 * @returns {Array<Array>} Array of chunks
 */
function chunkArray(array, chunkSize) {
    if (!Array.isArray(array)) {
        throw new Error('Input must be an array');
    }
    
    if (!chunkSize || chunkSize <= 0) {
        throw new Error('Chunk size must be a positive number');
    }
    
    const chunks = [];
    for (let i = 0; i < array.length; i += chunkSize) {
        chunks.push(array.slice(i, i + chunkSize));
    }
    
    return chunks;
}

/**
 * Process array in chunks with a callback function
 * Useful for processing large datasets incrementally
 * @param {Array} array - Array to process
 * @param {number} chunkSize - Size of each chunk
 * @param {Function} callback - Async function to process each chunk
 * @returns {Promise<Array>} Results from all chunks
 */
async function processInChunks(array, chunkSize, callback) {
    const chunks = chunkArray(array, chunkSize);
    const results = [];
    
    for (let i = 0; i < chunks.length; i++) {
        const chunkResult = await callback(chunks[i], i, chunks.length);
        results.push(chunkResult);
    }
    
    return results;
}

/**
 * Calculate optimal chunk size based on available memory and data size
 * @param {number} totalRecords - Total number of records
 * @param {number} maxChunkSize - Maximum chunk size
 * @returns {number} Optimal chunk size
 */
function calculateOptimalChunkSize(totalRecords, maxChunkSize = 100000) {
    if (totalRecords <= maxChunkSize) {
        return totalRecords;
    }
    
    // Calculate number of chunks needed
    const numChunks = Math.ceil(totalRecords / maxChunkSize);
    
    // Return evenly distributed chunk size
    return Math.ceil(totalRecords / numChunks);
}

module.exports = {
    chunkArray,
    processInChunks,
    calculateOptimalChunkSize
};