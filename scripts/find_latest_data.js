const fs = require('fs');
const path = require('path');

// Base directories
const DOCUMENTS_DIR = path.join(process.env.USERPROFILE || 'C:\\Users\\USER', 'Documents');

// Known paths from verification
const KNOWN_PATHS = {
    individual: path.join(DOCUMENTS_DIR, 'Process Data', 'Lot 65', 'Excel', 'Enquete_Foncière-Parcelles_Individuelles_09022026.xlsx'),
    collective: path.join(DOCUMENTS_DIR, 'Process Data', 'Lot 65', 'Excel', 'Enquete_Foncière-Parcelles_Collectives_09022026.xlsx'),
    // Updated to the consolidated file
    nicad: path.join(DOCUMENTS_DIR, 'Nicads', '3.a Validation par URM', 'TousLesNicads.gpkg'),
    geometry: path.join(DOCUMENTS_DIR, 'Lots par communes', 'parcelle post traités totaux.gpkg')
};

function findLatestSurveyFiles() {
    console.log("Using known survey files (Lot 65)...");
    return {
        individual: KNOWN_PATHS.individual,
        collective: KNOWN_PATHS.collective
    };
}

function findLatestNicadFile() {
    console.log("Using known Nicad file (TousLesNicads)...");
    return KNOWN_PATHS.nicad;
}

function findGeometryFile() {
    console.log("Using known Geometry file...");
    return KNOWN_PATHS.geometry;
}

if (require.main === module) {
    console.log(findLatestSurveyFiles());
    console.log(findLatestNicadFile());
    console.log(findGeometryFile());
}

module.exports = { findLatestSurveyFiles, findLatestNicadFile, findGeometryFile };
