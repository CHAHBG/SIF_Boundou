-- Insert sample parcels for testing
INSERT INTO parcels (num_parcel, geom, status, type, region_senegal, commune_senegal, village)
VALUES 
    ('P001', ST_GeomFromText('POLYGON((-12.5 12.5, -12.5 12.51, -12.49 12.51, -12.49 12.5, -12.5 12.5))', 4326), 'Survey', 'Individual', 'Tambacounda', 'Boundou', 'Village1'),
    ('P002', ST_GeomFromText('POLYGON((-12.51 12.5, -12.51 12.51, -12.50 12.51, -12.50 12.5, -12.51 12.5))', 4326), 'NICAD', 'Collective', 'Tambacounda', 'Boundou', 'Village2'),
    ('P003', ST_GeomFromText('POLYGON((-12.52 12.5, -12.52 12.51, -12.51 12.51, -12.51 12.5, -12.52 12.5))', 4326), 'Approved', 'Individual', 'Tambacounda', 'Boundou', 'Village3'),
    ('P004', ST_GeomFromText('POLYGON((-12.50 12.51, -12.50 12.52, -12.49 12.52, -12.49 12.51, -12.50 12.51))', 4326), 'Survey', 'Collective', 'Tambacounda', 'Boundou', 'Village1'),
    ('P005', ST_GeomFromText('POLYGON((-12.51 12.51, -12.51 12.52, -12.50 12.52, -12.50 12.51, -12.51 12.51))', 4326), 'NICAD', 'Individual', 'Tambacounda', 'Boundou', 'Village2');

-- Insert individual survey data
INSERT INTO individual_surveys (num_parcel, prenom, nom, telephone, sexe, vocation, sup_declar, sup_reelle)
VALUES 
    ('P001', 'Amadou', 'Diallo', '+221771234567', 'M', 'Agriculture', 2.5, 2.3),
    ('P003', 'Fatou', 'Sall', '+221779876543', 'F', 'Maraîchage', 1.8, 1.7),
    ('P005', 'Ousmane', 'Ba', '+221775555555', 'M', 'Élevage', 3.2, 3.0);

-- Insert collective survey data
INSERT INTO collective_surveys (num_parcel, nombre_affectata, vocation, sup_declar, sup_reelle)
VALUES 
    ('P002', 15, 'Agriculture collective', 5.0, 4.8),
    ('P004', 8, 'Pâturage commun', 10.0, 9.5);

-- Update NICAD parcels with additional data
UPDATE parcels SET nicad = 'NICAD-TB-2024-001', id_sif = 'SIF001', superficie = 4.8 WHERE num_parcel = 'P002';
UPDATE parcels SET nicad = 'NICAD-TB-2024-002', id_sif = 'SIF002', superficie = 3.0 WHERE num_parcel = 'P005';

-- Update approved parcel with deliberation info
UPDATE parcels SET n_deliberation = 'DEL-2024-045', n_approbation = 'APP-2024-032' WHERE num_parcel = 'P003';
