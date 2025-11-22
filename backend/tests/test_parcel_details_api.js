// Simple smoke test for /api/parcels/:id
// Usage: BACKEND_URL=http://localhost:4000 PARCEL_ID=<id> node tests/test_parcel_details_api.js

const assert = require('assert');

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:4000';
const PARCEL_ID = process.env.PARCEL_ID;

if (!PARCEL_ID) {
  console.error('Please set PARCEL_ID env var to a valid parcel id or num_parcel.');
  process.exit(2);
}

(async () => {
  try {
    const res = await fetch(`${BACKEND_URL}/api/parcels/${encodeURIComponent(PARCEL_ID)}`);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }
    const json = await res.json();
    const props = json.properties || json;

    // Assertions
    assert.ok(props.vocation !== undefined, 'vocation missing');
    assert.ok(props.superficie_reelle !== undefined, 'superficie_reelle missing');
    assert.ok(props.surface !== undefined, 'surface missing');

    const sup = parseFloat(props.superficie_reelle || props.surface || 0);
    assert.ok(!Number.isNaN(sup), 'superficie is not numeric');

    console.log('PASS: parcel details include vocation, superficie_reelle and surface.');
    process.exit(0);
  } catch (err) {
    console.error('TEST FAILED:', err);
    process.exit(1);
  }
})();
