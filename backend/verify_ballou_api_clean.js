const http = require('http');

const numParcel = '0512030103640';
const url = `http://localhost:4000/api/parcels/${numParcel}`;

http.get(url, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            const props = json.properties;
            console.log('--- API RESPONSE ---');
            console.log(`Parcel: ${props.num_parcel}`);
            console.log(`Region: ${props.region}`);
            console.log(`Department: ${props.department}`);
            console.log(`Arrondissement: ${props.arrondissement}`);
            console.log(`Commune: ${props.commune}`);
            console.log(`Village: ${props.village}`);
            console.log('--------------------');
        } catch (e) {
            console.error('Error:', e);
        }
    });
});
