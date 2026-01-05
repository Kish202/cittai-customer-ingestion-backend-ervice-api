const { neonConfig, Pool } = require('@neondatabase/serverless');
const dotenv = require('dotenv');


dotenv.config();


neonConfig.fetchConnectionCache = true;


const pool = new Pool({
    // connectionString: process.env.DATABASE_URL,
    connectionString: 'postgresql://neondb_owner:fO0T8SehEXrG@ep-restless-credit-a1u72yep-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
    max: 20, 
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
});


pool.on('error', (err) => {
    console.error('Unexpected database pool error:', err);
});


async function neonConnection() {
    try {
        const client = await pool.connect();
        const result = await client.query('SELECT NOW()');
        console.log('Database connected successfully at:', result.rows[0].now);
        client.release();
        return true;
    } catch (error) {
        console.error('Database connection failed:', error.message);
        return false;
    }
}

// Graceful shutdown
async function closePool() {
    try {
        await pool.end();
        console.log('Database pool closed');
    } catch (error) {
        console.error('Error closing database pool:', error);
    }
}

module.exports = {
    pool,
    neonConnection,
    closePool
};