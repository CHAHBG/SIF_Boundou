const XLSX = require('xlsx');
const path = require('path');

const filepath = path.join(__dirname, '../data/Nicads/Parcelles_Nicad.xlsx');

try {
    console.log(`Reading file: ${filepath}`);
    const workbook = XLSX.readFile(filepath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    if (data.length > 0) {
        console.log('Columns found:', data[0]);
        console.log('First row data:', data[1]);
    } else {
        console.log('File is empty');
    }
} catch (err) {
    console.error('Error reading file:', err.message);
}
