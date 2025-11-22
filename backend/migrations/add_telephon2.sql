-- Add Telephon2 column to individual_surveys and collective_surveys
ALTER TABLE individual_surveys ADD COLUMN IF NOT EXISTS telephon2 character varying(50);
ALTER TABLE collective_surveys ADD COLUMN IF NOT EXISTS telephon2 character varying(50);
-- Optionally, add to beneficiaries and mandataries if needed
ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS telephon2 character varying(50);
ALTER TABLE mandataries ADD COLUMN IF NOT EXISTS telephon2 character varying(50);