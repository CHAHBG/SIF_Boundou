const XLSX = require('xlsx');
const path = require('path');

const filepath = path.join(__dirname, '../data/Nicads/Parcelles_Nicad.xlsx');

try {
    const workbook = XLSX.readFile(filepath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    if (data.length > 0) {
        console.log('--- Columns ---');
        console.log(Object.keys(data[0]));
        console.log('\n--- First 3 Rows ---');
        console.log(data.slice(0, 3));
    } else {
        console.log('File is empty');
    }
} catch (err) {
    console.error('Error reading file:', err.message);
}
