const http = require('http');

const numParcel = '0512030103640';
const url = `http://localhost:4000/api/parcels/${numParcel}`;

console.log(`Fetching ${url}...`);

http.get(url, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            const props = json.properties;
            console.log('Parcel:', props.num_parcel);
            console.log('Region:', props.region);
            console.log('Department:', props.department);
            console.log('Arrondissement:', props.arrondissement);
            console.log('Commune:', props.commune);
            console.log('Village:', props.village);

            // Check raw keys just in case
            console.log('\nRaw Keys:', Object.keys(props).filter(k => k.includes('department') || k.includes('arrondissement')));

        } catch (e) {
            console.error('Error parsing JSON:', e);
            console.log('Raw data:', data.substring(0, 200));
        }
    });
}).on('error', (err) => {
    console.error('Error fetching URL:', err);
});
