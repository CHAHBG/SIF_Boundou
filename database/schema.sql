-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- Main parcels table with geometry
CREATE TABLE IF NOT EXISTS parcels (
    id SERIAL PRIMARY KEY,
    num_parcel VARCHAR(50) UNIQUE NOT NULL,
    geom GEOMETRY(Polygon, 4326),
    
    -- Workflow status and type
    status VARCHAR(50) DEFAULT 'Survey', -- 'Survey', 'NICAD', 'Approved'
    type VARCHAR(50) DEFAULT 'Individual', -- 'Individual', 'Collective'
    
    -- Administrative location
    grappe_senegal VARCHAR(100),
    region_senegal VARCHAR(100),
    department_senegal VARCHAR(100),
    arrondissement_senegal VARCHAR(100),
    commune_senegal VARCHAR(100),
    village VARCHAR(100),
    
    -- NICAD Stage (Stage 2)
    nicad VARCHAR(50),
    id_sif VARCHAR(50),
    superficie FLOAT,
    x_centroid FLOAT,
    y_centroid FLOAT,
    
    -- Approval Stage (Stage 3)
    n_deliberation VARCHAR(50),
    n_approbation VARCHAR(50),
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Individual survey data (Stage 1)
CREATE TABLE IF NOT EXISTS individual_surveys (
    id SERIAL PRIMARY KEY,
    num_parcel VARCHAR(50) UNIQUE NOT NULL REFERENCES parcels(num_parcel) ON DELETE CASCADE,
    
    -- Survey metadata
    start_time TIMESTAMP,
    today DATE,
    
    -- Personal information
    prenom VARCHAR(100),
    nom VARCHAR(100),
    sexe VARCHAR(20),
    date_naiss DATE,
    lieu_naiss VARCHAR(100),
    telephone VARCHAR(20),
    email VARCHAR(100),
    nat VARCHAR(50),
    autres_nat VARCHAR(100),
    
    -- Identity documentation
    type_piece VARCHAR(50),
    num_piece VARCHAR(100),
    date_deliv DATE,
    photo_rec TEXT,
    photo_rec_url TEXT,
    photo_ver TEXT,
    photo_ver_url TEXT,
    
    -- Parcel details
    num_tel VARCHAR(50),
    vocation VARCHAR(100),
    occup_nord VARCHAR(100),
    occup_sud VARCHAR(100),
    occup_est VARCHAR(100),
    occup_ouest VARCHAR(100),
    type_usag VARCHAR(100),
    
    -- Agricultural information
    syst_cultu VARCHAR(100),
    type_cult_001 VARCHAR(100),
    source_ali VARCHAR(100),
    irrigation VARCHAR(50),
    sup_declar FLOAT,
    sup_exploi FLOAT,
    sup_reelle FLOAT,
    sup_affect FLOAT,
    
    -- Geographic coordinates
    coord_x FLOAT,
    coord_y FLOAT,
    centro_de_latitude FLOAT,
    centro_de_longitude FLOAT,
    centro_de_altitude FLOAT,
    centro_de_precision FLOAT,
    
    -- Access and documentation
    mode_acces VARCHAR(100),
    type_doc VARCHAR(100),
    deliv_recu VARCHAR(50),
    num_decise VARCHAR(100),
    date_decise DATE,
    
    -- Conflicts and resolution
    conflit_f VARCHAR(50),
    cause_conf TEXT,
    comnt_conf TEXT,
    date_conf DATE,
    prota_conf TEXT,
    resol_conf TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Collective survey data (Stage 1)
CREATE TABLE IF NOT EXISTS collective_surveys (
    id SERIAL PRIMARY KEY,
    num_parcel VARCHAR(50) UNIQUE NOT NULL REFERENCES parcels(num_parcel) ON DELETE CASCADE,
    
    -- Survey metadata
    start_time TIMESTAMP,
    today DATE,
    
    -- Group information
    cas_de_personne_001 VARCHAR(100),
    nombre_affectata INTEGER,
    
    -- Parcel details (similar to individual)
    vocation VARCHAR(100),
    occup_nord VARCHAR(100),
    occup_sud VARCHAR(100),
    occup_est VARCHAR(100),
    occup_ouest VARCHAR(100),
    type_usag VARCHAR(100),
    
    -- Agricultural information
    syst_cultu VARCHAR(100),
    type_cult_001 VARCHAR(100),
    source_ali VARCHAR(100),
    irrigation VARCHAR(50),
    sup_declar FLOAT,
    sup_exploi FLOAT,
    sup_reelle FLOAT,
    sup_affect FLOAT,
    
    -- Geographic coordinates
    coord_x FLOAT,
    coord_y FLOAT,
    centro_de_latitude FLOAT,
    centro_de_longitude FLOAT,
    centro_de_altitude FLOAT,
    centro_de_precision FLOAT,
    
    -- Access and documentation
    mode_acces VARCHAR(100),
    type_doc VARCHAR(100),
    deliv_recu VARCHAR(50),
    num_decise VARCHAR(100),
    date_decise DATE,
    
    -- Conflicts and resolution
    conflit_f VARCHAR(50),
    cause_conf TEXT,
    comnt_conf TEXT,
    date_conf DATE,
    prota_conf TEXT,
    resol_conf TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Beneficiaries for collective surveys (up to 27)
CREATE TABLE IF NOT EXISTS beneficiaries (
    id SERIAL PRIMARY KEY,
    collective_survey_id INTEGER REFERENCES collective_surveys(id) ON DELETE CASCADE,
    num_parcel VARCHAR(50) REFERENCES parcels(num_parcel) ON DELETE CASCADE,
    
    beneficiary_number INTEGER, -- 1-27
    prenom VARCHAR(100),
    nom VARCHAR(100),
    sexe VARCHAR(20),
    date_naiss DATE,
    type_piece VARCHAR(50),
    num_piece VARCHAR(100),
    signature TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Mandataries for collective surveys (up to 10)
CREATE TABLE IF NOT EXISTS mandataries (
    id SERIAL PRIMARY KEY,
    collective_survey_id INTEGER REFERENCES collective_surveys(id) ON DELETE CASCADE,
    num_parcel VARCHAR(50) REFERENCES parcels(num_parcel) ON DELETE CASCADE,
    
    mandatary_number INTEGER, -- 1-10
    typ_per VARCHAR(100),
    contact VARCHAR(100),
    authorization_details TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_parcels_geom ON parcels USING GIST (geom);
CREATE INDEX idx_parcels_num_parcel ON parcels (num_parcel);
CREATE INDEX idx_parcels_status ON parcels (status);
CREATE INDEX idx_parcels_type ON parcels (type);
CREATE INDEX idx_individual_surveys_num_parcel ON individual_surveys (num_parcel);
CREATE INDEX idx_collective_surveys_num_parcel ON collective_surveys (num_parcel);
CREATE INDEX idx_beneficiaries_num_parcel ON beneficiaries (num_parcel);
CREATE INDEX idx_mandataries_num_parcel ON mandataries (num_parcel);

-- Sample data for testing (optional)
-- Uncomment to insert test parcels

/*
INSERT INTO parcels (num_parcel, geom, status, type, region_senegal, commune_senegal, village)
VALUES 
    ('P001', ST_GeomFromText('POLYGON((-12.5 12.5, -12.5 12.51, -12.49 12.51, -12.49 12.5, -12.5 12.5))', 4326), 'Survey', 'Individual', 'Tambacounda', 'Boundou', 'Village1'),
    ('P002', ST_GeomFromText('POLYGON((-12.51 12.5, -12.51 12.51, -12.50 12.51, -12.50 12.5, -12.51 12.5))', 4326), 'NICAD', 'Collective', 'Tambacounda', 'Boundou', 'Village2'),
    ('P003', ST_GeomFromText('POLYGON((-12.52 12.5, -12.52 12.51, -12.51 12.51, -12.51 12.5, -12.52 12.5))', 4326), 'Approved', 'Individual', 'Tambacounda', 'Boundou', 'Village3');

INSERT INTO individual_surveys (num_parcel, prenom, nom, telephone, sexe)
VALUES 
    ('P001', 'Amadou', 'Diallo', '+221771234567', 'M'),
    ('P003', 'Fatou', 'Sall', '+221779876543', 'F');

INSERT INTO collective_surveys (num_parcel, nombre_affectata)
VALUES ('P002', 15);
*/
