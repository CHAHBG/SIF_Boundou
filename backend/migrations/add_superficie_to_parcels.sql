-- Add superficie column to parcels table
ALTER TABLE parcels ADD COLUMN IF NOT EXISTS superficie double precision;

-- Update superficie for all parcels based on geometry (in square meters)
UPDATE parcels SET superficie = ST_Area(geometry::geography);
