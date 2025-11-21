
const http = require('http');

const id = '0522030303684';
const url = `http://localhost:4000/api/parcels/${id}`;

console.log(`Testing URL: ${url}`);

http.get(url, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
        console.log('Status:', res.statusCode);
        console.log('Body:', data);
    });
}).on('error', (err) => {
    console.error('Error:', err.message);
});
