-- Migration: widen market trend decimal precision
-- Purpose: Preserve decimal indicators from France Travail/Data Emploi without rounding to two decimals.

ALTER TABLE market_trends
    ALTER COLUMN value TYPE NUMERIC(18,6) USING value::NUMERIC(18,6),
    ALTER COLUMN previous_value TYPE NUMERIC(18,6) USING previous_value::NUMERIC(18,6);

COMMENT ON COLUMN market_trends.value IS 'Numeric trend value, including decimal indicators from France Travail/Data Emploi';
COMMENT ON COLUMN market_trends.previous_value IS 'Previous numeric trend value before update, with decimal precision preserved';
