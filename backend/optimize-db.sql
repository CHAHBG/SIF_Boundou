-- SQL script to optimize database performance for faster parcel detail fetching
-- Run this script to add indexes that will speed up queries

-- Index on num_parcel for parcels table (primary lookup field)
CREATE INDEX IF NOT EXISTS idx_parcels_num_parcel ON parcels(num_parcel);
CREATE INDEX IF NOT EXISTS idx_parcels_id ON parcels(id);

-- Index on num_parcel for individual_surveys (JOIN optimization)
CREATE INDEX IF NOT EXISTS idx_individual_surveys_num_parcel ON individual_surveys(num_parcel);

-- Index on num_parcel for collective_surveys (JOIN optimization)
CREATE INDEX IF NOT EXISTS idx_collective_surveys_num_parcel ON collective_surveys(num_parcel);

-- Index on num_parcel for mandataries (subquery optimization)
CREATE INDEX IF NOT EXISTS idx_mandataries_num_parcel ON mandataries(num_parcel);

-- Index on num_parcel for beneficiaries (subquery optimization)
CREATE INDEX IF NOT EXISTS idx_beneficiaries_num_parcel ON beneficiaries(num_parcel);

-- Analyze tables to update statistics
ANALYZE parcels;
ANALYZE individual_surveys;
ANALYZE collective_surveys;
ANALYZE mandataries;
ANALYZE beneficiaries;

-- Display index information
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
