const http = require('http');

const BASE_URL = 'http://localhost:3000';

// Helper function to make HTTP requests
function makeRequest(path, method = 'GET', data = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, BASE_URL);
        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname,
            method: method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    const response = JSON.parse(body);
                    resolve({ status: res.statusCode, data: response });
                } catch (e) {
                    resolve({ status: res.statusCode, data: body });
                }
            });
        });

        req.on('error', reject);

        if (data) {
            req.write(JSON.stringify(data));
        }

        req.end();
    });
}

// Test data
const testCustomers = [
    {
        external_id: "test_001",
        name: "Test User 1",
        email: "test1@example.com",
        country_code: "US",
        status_code: "ACTIVE"
    },
    {
        external_id: "test_002",
        name: "Test User 2",
        email: "test2@example.com",
        country_code: "IN",
        status_code: "ACTIVE"
    },
    {
        external_id: "cust_001", // This already exists in seed data
        name: "Alice Johnson",
        email: "alice@example.com",
        country_code: "US",
        status_code: "ACTIVE"
    }
];

// Run tests
async function runTests() {
    console.log('🧪 Delta Ingestion Service - Test Suite\n');
    console.log('=' .repeat(50));

    try {
        // Test 1: Health Check
        console.log('\n📋 Test 1: Health Check');
        const health = await makeRequest('/api/health');
        console.log(`Status: ${health.status}`);
        console.log('Response:', JSON.stringify(health.data, null, 2));

        // Test 2: Get Stats
        console.log('\n📋 Test 2: Get Statistics');
        const stats = await makeRequest('/api/stats');
        console.log(`Status: ${stats.status}`);
        console.log('Response:', JSON.stringify(stats.data, null, 2));

        // Test 3: Dry Run
        console.log('\n📋 Test 3: Dry Run (no data written)');
        const dryRun = await makeRequest('/api/customers/ingest/dry-run', 'POST', testCustomers);
        console.log(`Status: ${dryRun.status}`);
        console.log('Response:', JSON.stringify(dryRun.data, null, 2));

        // Test 4: Actual Ingestion
        console.log('\n📋 Test 4: Actual Ingestion');
        const ingest = await makeRequest('/api/customers/ingest', 'POST', testCustomers);
        console.log(`Status: ${ingest.status}`);
        console.log('Response:', JSON.stringify(ingest.data, null, 2));

        // Test 5: Idempotency - Run same data again
        console.log('\n📋 Test 5: Idempotency Test (run same data again)');
        const ingest2 = await makeRequest('/api/customers/ingest', 'POST', testCustomers);
        console.log(`Status: ${ingest2.status}`);
        console.log('Response:', JSON.stringify(ingest2.data, null, 2));

        // Test 6: Invalid Data
        console.log('\n📋 Test 6: Invalid Data Handling');
        const invalidCustomers = [
            {
                external_id: "invalid_001",
                name: "Invalid User",
                email: "not-an-email",
                country_code: "INVALID",
                status_code: "ACTIVE"
            }
        ];
        const invalidTest = await makeRequest('/api/customers/ingest', 'POST', invalidCustomers);
        console.log(`Status: ${invalidTest.status}`);
        console.log('Response:', JSON.stringify(invalidTest.data, null, 2));

        // Test 7: Final Stats
        console.log('\n📋 Test 7: Final Statistics');
        const finalStats = await makeRequest('/api/stats');
        console.log(`Status: ${finalStats.status}`);
        console.log('Response:', JSON.stringify(finalStats.data, null, 2));

        console.log('\n' + '='.repeat(50));
        console.log('✅ All tests completed!\n');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        process.exit(1);
    }
}

// Wait for server to be ready
async function waitForServer(maxAttempts = 10) {
    for (let i = 0; i < maxAttempts; i++) {
        try {
            await makeRequest('/api/health');
            console.log('✅ Server is ready!\n');
            return true;
        } catch (error) {
            console.log(`⏳ Waiting for server... (attempt ${i + 1}/${maxAttempts})`);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
    throw new Error('Server did not start in time');
}

// Main execution
(async () => {
    try {
        await waitForServer();
        await runTests();
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
})();