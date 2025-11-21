const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const files = [
    '../data/Final Status/Formalise_collective.xlsx',
    '../data/Final Status/Formalise_indiviuelle.xlsx'
];

files.forEach(file => {
    const filePath = path.join(__dirname, file);
    if (fs.existsSync(filePath)) {
        console.log(`\nReading ${file}...`);
        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(sheet);

        if (data.length > 0) {
            console.log('Columns:', Object.keys(data[0]));
            console.log('First row sample:', data[0]);
        } else {
            console.log('File is empty or could not be read.');
        }
    } else {
        console.log(`File not found: ${filePath}`);
    }
});
