

module.exports = {
    // Chunking configuration
    CHUNK_SIZE: parseInt(process.env.CHUNK_SIZE) || 100000,
    MAX_BATCH_SIZE: parseInt(process.env.MAX_BATCH_SIZE) || 100000,
    

    MAX_PARAMS_PER_QUERY: 65535, // PostgreSQL parameter limit
    
    // Performance tuning
    LOOKUP_CACHE_TTL: 3600000, // 1 hour in milliseconds
    
    // Server configuration
    PORT: parseInt(process.env.PORT) || 3000,
    
   
    MAX_EMAIL_LENGTH: 255,
    MAX_NAME_LENGTH: 255,
    MAX_EXTERNAL_ID_LENGTH: 255,
    
    // Status codes
    HTTP_STATUS: {
        OK: 200,
        BAD_REQUEST: 400,
        INTERNAL_SERVER_ERROR: 500
    },
    
    // Error messages
    ERRORS: {
        INVALID_INPUT: 'Invalid input data',
        MISSING_LOOKUP: 'Missing lookup value',
        DB_ERROR: 'Database error occurred',
        BATCH_TOO_LARGE: 'Batch size exceeds maximum allowed'
    }
};