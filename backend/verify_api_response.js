
const http = require('http');

const numParcel = '1312010100753';
// Try list endpoint
const url = `http://localhost:4000/api/parcels?num_parcel=${numParcel}`;

http.get(url, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            console.log('Features found:', json.features.length);
            if (json.features.length > 0) {
                const props = json.features[0].properties;
                console.log('Parcel:', props.num_parcel);
                console.log('Type:', props.type);
                console.log('Survey Data:', props.survey_data ? 'Yes' : 'No');
            }
        } catch (e) {
            console.error('Error parsing JSON:', e);
            console.log('Raw data:', data);
        }
    });
}).on('error', (err) => {
    console.error('Error fetching URL:', err);
});
