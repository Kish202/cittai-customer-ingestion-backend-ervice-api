/**
 * Metrics tracking utility for monitoring ingestion performance
 */

class MetricsCollector {
    constructor() {
        this.metrics = {
            startTime: null,
            endTime: null,
            duration: null,
            totalReceived: 0,
            totalInserted: 0,
            totalSkipped: 0,
            totalFailed: 0,
            chunksProcessed: 0,
            lookupCacheHits: 0,
            lookupCacheMisses: 0,
            dbQueriesExecuted: 0,
            errors: []
        };
    }

    start() {
        this.metrics.startTime = Date.now();
    }

    end() {
        this.metrics.endTime = Date.now();
        this.metrics.duration = this.metrics.endTime - this.metrics.startTime;
    }

    recordReceived(count) {
        this.metrics.totalReceived += count;
    }

    recordInserted(count) {
        this.metrics.totalInserted += count;
    }

    recordSkipped(count) {
        this.metrics.totalSkipped += count;
    }

    recordFailed(count) {
        this.metrics.totalFailed += count;
    }

    recordChunkProcessed() {
        this.metrics.chunksProcessed += 1;
    }

    recordCacheHit() {
        this.metrics.lookupCacheHits += 1;
    }

    recordCacheMiss() {
        this.metrics.lookupCacheMisses += 1;
    }

    recordDbQuery() {
        this.metrics.dbQueriesExecuted += 1;
    }

    recordError(error) {
        this.metrics.errors.push({
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }

    getCacheHitRatio() {
        const total = this.metrics.lookupCacheHits + this.metrics.lookupCacheMisses;
        return total > 0 ? (this.metrics.lookupCacheHits / total * 100).toFixed(2) : 0;
    }

    getMetrics() {
        return {
            ...this.metrics,
            durationSeconds: this.metrics.duration ? (this.metrics.duration / 1000).toFixed(2) : null,
            cacheHitRatio: `${this.getCacheHitRatio()}%`,
            recordsPerSecond: this.metrics.duration ? 
                (this.metrics.totalReceived / (this.metrics.duration / 1000)).toFixed(2) : null
        };
    }

    getSummary() {
        return {
            received: this.metrics.totalReceived,
            inserted: this.metrics.totalInserted,
            skipped_existing: this.metrics.totalSkipped,
            failed: this.metrics.totalFailed,
            duration_seconds: this.metrics.duration ? (this.metrics.duration / 1000).toFixed(2) : null,
            chunks_processed: this.metrics.chunksProcessed,
            cache_hit_ratio: `${this.getCacheHitRatio()}%`,
            records_per_second: this.metrics.duration ? 
                (this.metrics.totalReceived / (this.metrics.duration / 1000)).toFixed(2) : null
        };
    }

    reset() {
        this.metrics = {
            startTime: null,
            endTime: null,
            duration: null,
            totalReceived: 0,
            totalInserted: 0,
            totalSkipped: 0,
            totalFailed: 0,
            chunksProcessed: 0,
            lookupCacheHits: 0,
            lookupCacheMisses: 0,
            dbQueriesExecuted: 0,
            errors: []
        };
    }
}

module.exports = MetricsCollector;