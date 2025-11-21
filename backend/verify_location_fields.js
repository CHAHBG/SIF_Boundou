const http = require('http');

const numParcel = '0522030303488';
const url = `http://localhost:4000/api/parcels/${numParcel}`;

http.get(url, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            const props = json.properties;
            console.log('Parcel:', props.num_parcel);
            console.log('Type:', props.type);
            console.log('\nLocation Fields:');
            console.log('  Region:', props.region || 'null');
            console.log('  Department:', props.department || 'null');
            console.log('  Arrondissement:', props.arrondissement || 'null');
            console.log('  Commune:', props.commune || 'null');
            console.log('  Village:', props.village || 'null');
        } catch (e) {
            console.error('Error parsing JSON:', e);
            console.log('Raw data:', data.substring(0, 200));
        }
    });
}).on('error', (err) => {
    console.error('Error fetching URL:', err);
});
