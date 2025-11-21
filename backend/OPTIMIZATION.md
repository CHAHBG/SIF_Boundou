# Database Optimization Guide

## Performance Improvements Made

### 1. Database Indexes
Created indexes on frequently queried columns to speed up data fetching:
- `idx_parcels_num_parcel` - Fast lookup by parcel number
- `idx_parcels_id` - Fast lookup by ID
- `idx_individual_surveys_num_parcel` - Optimizes JOIN operations
- `idx_collective_surveys_num_parcel` - Optimizes JOIN operations
- `idx_mandataries_num_parcel` - Speeds up mandataries subquery
- `idx_beneficiaries_num_parcel` - Speeds up beneficiaries subquery

### 2. Query Optimization
- Simplified centroid calculation using `json_build_array()` instead of `ST_AsGeoJSON()`
- Used `COALESCE()` to return empty arrays instead of NULL for mandataries/beneficiaries
- Optimized JSON aggregation with more efficient queries

### 3. Frontend Optimizations
- Instant panel opening with loading skeleton (already implemented)
- Non-blocking data fetch with background population
- Optimized field mapping to use correct database column names

## Running the Optimization

To run the database optimization on your environment:

```bash
cd backend
node optimize-database.js
```

This will:
1. Create all necessary indexes
2. Update table statistics with ANALYZE
3. Display a summary of created indexes

## Expected Performance Improvements

Before optimization:
- Parcel detail fetch: 1-3 seconds
- Complex queries with mandataries/beneficiaries: 2-5 seconds

After optimization:
- Parcel detail fetch: 200-500ms
- Complex queries with mandataries/beneficiaries: 500-1000ms

## Field Mappings

### Individual Parcels
- `num_piece` → CNI number
- `lieu_naiss` → Birth place
- `superficie_reelle` → Actual surface area
- `vocation` → Land use purpose

### Collective Parcels
- `nombre_affectata` → Number of beneficiaries
- `superficie_reelle` → Actual surface area
- `vocation` → Land use purpose

### Location Fields (All Parcels)
- `region_senegal` → Region
- `department_senegal` → Department
- `arrondissement_senegal` → District
- `commune_senegal` → Commune
- `village` → Village

## Monitoring Performance

Check query performance in PostgreSQL:
```sql
EXPLAIN ANALYZE
SELECT * FROM parcels WHERE num_parcel = '0532010100449';
```

The execution time should now be under 100ms for indexed queries.
