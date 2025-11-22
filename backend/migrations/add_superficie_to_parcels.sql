-- Add superficie column to parcels table
ALTER TABLE parcels ADD COLUMN IF NOT EXISTS superficie double precision;
-- Compute and populate superficie for all parcels using projected area (square meters)
-- We transform to EPSG:3857 (Web Mercator) and compute planar area which approximates area in m².
-- This avoids geography cast pitfalls for some geometries.
UPDATE parcels SET superficie = ST_Area(ST_Transform(geometry, 3857));

-- Create function to keep superficie up to date when geometry changes
CREATE OR REPLACE FUNCTION update_parcel_superficie()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
	NEW.superficie := ST_Area(ST_Transform(NEW.geometry, 3857));
	RETURN NEW;
END;
$$;

-- Attach trigger to update superficie before insert or update of geometry
DROP TRIGGER IF EXISTS trg_update_parcel_superficie ON parcels;
CREATE TRIGGER trg_update_parcel_superficie
BEFORE INSERT OR UPDATE OF geometry ON parcels
FOR EACH ROW
EXECUTE PROCEDURE update_parcel_superficie();
