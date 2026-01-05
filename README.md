# Delta Ingestion Service

The Node.js microservice that efficiently ingests customer data with automatic delta detection to prevent duplicates. Handles millions of records with high performance through bulk operations and intelligent caching.

## Problem Statement

Organizations receive customer data files daily that contain both new and existing records. Simply inserting all records creates duplicates and data inconsistency.

This service solves that by automatically identifying which customers are new versus existing, and only inserts the new ones.

## Features

- **Automatic Delta Detection** - Identifies new vs existing customers in a single bulk query
- **Bulk Operations** - Processes 10K records in one query instead of 10K individual queries (10-20x faster)
- **Smart Caching** - Lookups resolved in memory (1000x faster than database queries)
- **Idempotent** - Safe to run multiple times with same data
- **Handles Scale** - Processes 10M+ records through chunking without memory overflow
- **Dry Run Mode** - Preview changes before applying them
- **Clear Error Messages** - Detailed validation feedback with actionable recommendations

<img width="2530" height="1654" alt="image" src="https://github.com/user-attachments/assets/9bc1f48c-1c15-4b0f-8941-4810cbbd8900" />
<img width="2530" height="1654" alt="image" src="https://github.com/user-attachments/assets/36b09cb9-8658-4326-8df5-3087f5cbae3d" />
<img width="2530" height="1654" alt="image" src="https://github.com/user-attachments/assets/459e34a0-6aec-4a3a-b9e2-80f2fe31568b" />

<img width="2692" height="1536" alt="image" src="https://github.com/user-attachments/assets/e6563bed-9dd6-4d20-b7ae-2b14b1ef428c" />


<img width="2530" height="1654" alt="image" src="https://github.com/user-attachments/assets/29802633-87a8-4a52-901b-913d0cbd6c0d" />

<img width="2380" height="1392" alt="image" src="https://github.com/user-attachments/assets/a63f9c4e-b816-453f-bb4c-9e5f5678333f" />



## Tech Stack

- Node.js 18+ with Express.js
- PostgreSQL (Neon)
- Repository Pattern architecture
- Connection pooling with bulk operations

## Quick Start

```bash
# Install
npm install

# Configure
cp .env.example .env
# Add your DATABASE_URL to .env

# Setup database
using seed.sql file

# Start
npm start
```

## API Usage

**Ingest customers:**
```bash
curl -X POST http://localhost:3000/api/customers/ingest \
  -H "Content-Type: application/json" \
  -d '[
    {
      "external_id": "cust_001",
      "name": "John Doe",
      "email": "john@example.com",
      "country_code": "US",
      "status_code": "ACTIVE"
    }
  ]'
```

**Response:**
```json
{
  "success": true,
  "received": 1,
  "inserted": 1,
  "skipped_existing": 0,
  "duration_seconds": "0.15"
}
```

**Other endpoints:**
- `GET /api/health` - Health check
- `GET /api/stats` - Database statistics
- `POST /api/customers/ingest/dry-run` - Preview without writing

## Architecture

```
Client → API Layer → Business Logic → Data Access → Database
          ↓              ↓                ↓
      Validation    Delta Detection   Bulk Insert
                    Lookup Cache      Connection Pool
```

**Key Design Decisions:**

1. **Repository Pattern** - Clean separation between business logic and data access
2. **Bulk Operations** - Single query for entire batch instead of N queries
3. **In-Memory Cache** - Lookup tables loaded once at startup (countries, statuses)
4. **ON CONFLICT DO NOTHING** - Database-level idempotency guarantee
5. **Chunking** - Process large datasets in 10K chunks to manage memory

## Performance

- 100K records in ~30 seconds (3,333 records/sec)
- Constant memory usage (~100MB) regardless of dataset size
- Single query for delta detection vs N+1 queries
- Zero database queries for lookup resolution (cached)

## Testing

**Generate test data:**
```bash
node generate-large-dataset.js 1000
```

**Test ingestion:**
```bash
curl -X POST http://localhost:3000/api/customers/ingest \
  -d @test-data-1000.json
```

**Test idempotency (run same data twice):**
```bash
# First run: inserted: 1000
# Second run: inserted: 0, skipped_existing: 1000
```

## Project Structure

```
src/
├── config/          # Database connection, constants
├── controllers/     # HTTP request handlers
├── services/        # Business logic (delta, lookup, validation)
├── repositories/    # Database operations
├── utils/           # Helpers (chunking, logging, metrics)
├── middleware/      # Error handling, validation
├── routes/          # API routes
└── db/              # Schema and setup scripts
```

## How It Works

**Delta Detection Algorithm:**

1. Extract all external_ids from incoming data
2. Query database once: `WHERE external_id = ANY($1::text[])`
3. Partition results into NEW vs EXISTING
4. Bulk insert only NEW customers
5. Return metrics

**Why It's Fast:**
- 1 query checks 100K records instead of 100K queries
- Lookup cache eliminates repeated database calls
- Bulk INSERT is 10-20x faster than individual inserts
- Connection pooling reuses database connections

## Error Handling

**Validation errors show exactly what's wrong:**
```json
{
  "details": {
    "validationErrors": [
      {
        "recordIndex": 0,
        "externalId": "invalid_001",
        "issues": ["Invalid email format"],
        "problematicRecord": { ... }
      }
    ]
  },
  "recommendation": {
    "action": "DO NOT PROCEED",
    "nextSteps": ["Fix invalid records", "Run dry-run again"]
  }
}
```

## Production Considerations

**Current implementation is assignment-focused. For production, I would add:**

- Migration system (Knex.js or Flyway) instead of setup script
- Redis for shared cache across multiple instances
- Message queue (RabbitMQ/Kafka) for async processing
- Database read replicas for scaling delta detection
- Monitoring and alerting (Prometheus/Grafana)
- Rate limiting and authentication
- Comprehensive test suite with CI/CD

## Data Format

**Required fields:**
- `external_id` - Unique identifier (string)
- `name` - Customer name (string)
- `email` - Valid email format (string)
- `country_code` - Valid country code (US, IN, UK, CA, AU, DE, FR, JP, CN, BR)
- `status_code` - Valid status (ACTIVE, INACTIVE, PENDING, SUSPENDED)

## License

MIT

## Author

**Tania Kesh**
- GitHub: [@taniakesh](https://github.com/Kish202/)
- LinkedIn: [Tania Kesh](https://www.linkedin.com/in/tania-t-4625252ab/)

---

Built as a technical assignment demonstrating clean architecture, performance optimization, and production-ready practices.
