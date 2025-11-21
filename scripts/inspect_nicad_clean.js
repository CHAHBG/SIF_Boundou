const XLSX = require('xlsx');
const path = require('path');

const filepath = path.join(__dirname, '../data/Nicads/Parcelles_Nicad.xlsx');

try {
    const workbook = XLSX.readFile(filepath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const headers = XLSX.utils.sheet_to_json(worksheet, { header: 1 })[0];

    console.log('EXCEL COLUMNS:', JSON.stringify(headers, null, 2));

} catch (err) {
    console.error('Error:', err.message);
}
