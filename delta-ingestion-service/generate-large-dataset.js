/**
 * Generate large test datasets for performance testing
 * Usage: node generate-large-dataset.js <count>
 * Example: node generate-large-dataset.js 100000
 */

const fs = require('fs');
const path = require('path');

const COUNTRIES = ['US', 'IN', 'UK', 'CA', 'AU'];
const STATUSES = ['ACTIVE', 'INACTIVE', 'PENDING', 'SUSPENDED'];
const FIRST_NAMES = [
    'Alice', 'Bob', 'Charlie', 'David', 'Emma', 'Frank', 'Grace', 'Henry', 
    'Iris', 'Jack', 'Kate', 'Liam', 'Mary', 'Nathan', 'Olivia', 'Peter'
];
const LAST_NAMES = [
    'Johnson', 'Smith', 'Brown', 'Lee', 'Wilson', 'Zhang', 'Kumar', 'Martinez',
    'Thompson', 'Garcia', 'Rodriguez', 'Chen', 'Patel', 'Anderson', 'Taylor'
];

function randomElement(array) {
    return array[Math.floor(Math.random() * array.length)];
}

function generateCustomer(index) {
    const firstName = randomElement(FIRST_NAMES);
    const lastName = randomElement(LAST_NAMES);
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${index}@example.com`;

    return {
        external_id: `perf_${String(index).padStart(10, '0')}`,
        name: `${firstName} ${lastName}`,
        email: email,
        country_code: randomElement(COUNTRIES),
        status_code: randomElement(STATUSES)
    };
}

function generateDataset(count) {
    console.log(`📊 Generating ${count.toLocaleString()} customer records...`);
    
    const customers = [];
    const batchSize = 10000;
    
    for (let i = 0; i < count; i++) {
        customers.push(generateCustomer(i + 1));
        
        if ((i + 1) % batchSize === 0) {
            console.log(`   Generated ${(i + 1).toLocaleString()} / ${count.toLocaleString()}`);
        }
    }
    
    return customers;
}

function saveToFile(data, filename) {
    const filepath = path.join(__dirname, filename);
    console.log(`💾 Saving to ${filename}...`);
    
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
    
    const stats = fs.statSync(filepath);
    const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    
    console.log(`✅ Saved ${data.length.toLocaleString()} records (${sizeMB} MB)`);
    console.log(`   File: ${filepath}`);
}

// Main execution
const count = parseInt(process.argv[2]) || 10000;

if (count < 1 || count > 1000000) {
    console.error('❌ Please provide a count between 1 and 1,000,000');
    process.exit(1);
}

console.log('\n🚀 Large Dataset Generator');
console.log('='.repeat(50));

const dataset = generateDataset(count);
const filename = `test-data-${count}.json`;
saveToFile(dataset, filename);

console.log('\n📋 Usage:');
console.log(`   curl -X POST http://localhost:3000/api/customers/ingest \\`);
console.log(`     -H "Content-Type: application/json" \\`);
console.log(`     -d @${filename}`);
console.log('\n✅ Done!\n');