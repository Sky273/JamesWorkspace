-- Migration: Add audit/traceability columns to market_trends table
-- Date: 2026-02-28
-- Purpose: Enable data verification and freshness tracking

-- Add audit columns for traceability
ALTER TABLE market_trends 
ADD COLUMN IF NOT EXISTS collected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS api_endpoint VARCHAR(255),
ADD COLUMN IF NOT EXISTS quarter_period VARCHAR(20),
ADD COLUMN IF NOT EXISTS api_response_hash VARCHAR(64),
ADD COLUMN IF NOT EXISTS previous_value DECIMAL(15,2);

-- Add index for freshness queries
CREATE INDEX IF NOT EXISTS idx_market_trends_collected_at ON market_trends(collected_at DESC);

-- Add index for verification queries
CREATE INDEX IF NOT EXISTS idx_market_trends_audit ON market_trends(type, region_code, code_rome, collected_at DESC);

-- Comment on columns
COMMENT ON COLUMN market_trends.collected_at IS 'Timestamp when data was collected from API';
COMMENT ON COLUMN market_trends.api_endpoint IS 'API endpoint used for collection (e.g., stat-offres, stat-embauches)';
COMMENT ON COLUMN market_trends.quarter_period IS 'Quarter period covered by the data (e.g., Q4 2025)';
COMMENT ON COLUMN market_trends.api_response_hash IS 'MD5 hash of raw API response for verification';
COMMENT ON COLUMN market_trends.previous_value IS 'Previous value before update, for change tracking';
