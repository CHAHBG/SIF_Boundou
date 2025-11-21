
const http = require('http');

const numParcel = '1312010100753';
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
            console.log('Mandataries:', props.mandataries ? props.mandataries.length : 0);
            console.log('Beneficiaries:', props.beneficiaries ? props.beneficiaries.length : 0);

            if (props.mandataries && props.mandataries.length > 0) {
                const m = props.mandataries[0];
                console.log('First Mandatary:', m.prenom, m.nom, '- Contact:', m.contact);
            }

            if (props.beneficiaries && props.beneficiaries.length > 0) {
                const b = props.beneficiaries[0];
                console.log('First Beneficiary:', b.prenom, b.nom, '- Sexe:', b.sexe);
            }
        } catch (e) {
            console.error('Error parsing JSON:', e);
            console.log('Raw data:', data);
        }
    });
}).on('error', (err) => {
    console.error('Error fetching URL:', err);
});
