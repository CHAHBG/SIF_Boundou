// Configuration
const API_URL = 'http://localhost:4000/api';

// Basemap styles
const BASEMAP_STYLES = {
    'streets': 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
    'satellite': 'https://api.maptiler.com/maps/hybrid/style.json?key=get_your_own_OpIi9ZULNHzrESv6T2vL',
    'terrain': 'https://api.maptiler.com/maps/outdoor/style.json?key=get_your_own_OpIi9ZULNHzrESv6T2vL',
    'dark': 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
};

// Status colors for map styling (Workflow)
const STATUS_COLORS = {
    'Survey': '#eab308',    // Yellow
    'NICAD': '#3b82f6',     // Blue
    'Approved': '#10b981'   // Emerald
};

// Type colors (Individual vs Collective)
const TYPE_COLORS = {
    'individual': '#8b5cf6', // Violet
    'collective': '#f43f5e', // Rose
    'unknown': '#94a3b8'     // Slate
};

// Global state
let map;
let currentBasemap = 'streets';
let is3DMode = true;
let currentFilters = {
    type: '',
    status: ''
};

/**
 * APPLICATION OBJECT
 */
const app = {

    init() {
        // Initialize Lucide Icons
        lucide.createIcons();

        // Initialize map
        this.initMap();

        // Setup event listeners
        this.setupListeners();
    },

    initMap() {
        map = new maplibregl.Map({
            container: 'map',
            style: BASEMAP_STYLES[currentBasemap],
            center: [-13.6773, 13.7671], // Tambacounda, Senegal
            zoom: 10,
            pitch: 45, // Tilt for 3D effect
            bearing: -17.6,
            antialias: true
        });

        map.on('load', () => {
            // Add Vector Source
            map.addSource('parcels-source', {
                type: 'vector',
                tiles: [`${API_URL}/tiles/{z}/{x}/{y}`],
                minzoom: 10,
                maxzoom: 20
            });

            // 1. Fill Layer (Base 2D)
            map.addLayer({
                'id': 'parcels-fill',
                'type': 'fill',
                'source': 'parcels-source',
                'source-layer': 'parcels',
                'paint': {
                    'fill-color': [
                        'match',
                        ['get', 'status'],
                        'Survey', STATUS_COLORS['Survey'],
                        'NICAD', STATUS_COLORS['NICAD'],
                        'Approved', STATUS_COLORS['Approved'],
                        '#94a3b8' // Default
                    ],
                    'fill-opacity': 0.6
                }
            });

            // 2. Line Layer (Borders)
            map.addLayer({
                'id': 'parcels-line',
                'type': 'line',
                'source': 'parcels-source',
                'source-layer': 'parcels',
                'paint': {
                    'line-color': '#ffffff',
                    'line-width': 1,
                    'line-opacity': 0.5
                }
            });

            // 3. 3D Extrusion Layer (Buildings)
            // Only extrude if type_usag contains 'habitat' (case insensitive check handled in backend or here)
            // Since MVT properties are strings, we use a simple check
            map.addLayer({
                'id': 'parcels-3d',
                'type': 'fill-extrusion',
                'source': 'parcels-source',
                'source-layer': 'parcels',
                'paint': {
                    'fill-extrusion-color': [
                        'match',
                        ['get', 'status'],
                        'Survey', STATUS_COLORS['Survey'],
                        'NICAD', STATUS_COLORS['NICAD'],
                        'Approved', STATUS_COLORS['Approved'],
                        '#94a3b8'
                    ],
                    'fill-extrusion-height': [
                        'case',
                        ['in', 'habitat', ['downcase', ['get', 'type_usag']]], 4, // 4 meters for habitat
                        0 // 0 for others
                    ],
                    'fill-extrusion-opacity': 0.9,
                    'fill-extrusion-base': 0
                }
            });

            // Interactions
            this.setupMapInteractions();

            // Update stats
            document.getElementById('totalCount').innerText = 'Mode: Vector Tiles (MVT)';
            document.getElementById('connectedIndicator').classList.remove('bg-red-500');
            document.getElementById('connectedIndicator').classList.add('bg-emerald-500');
        });
    },

    setupMapInteractions() {
        // Click to open modal
        map.on('click', 'parcels-fill', (e) => {
            if (e.features.length > 0) {
                const feature = e.features[0];
                this.openModal(feature.properties.num_parcel);
            }
        });

        // Also click on 3D layer
        map.on('click', 'parcels-3d', (e) => {
            if (e.features.length > 0) {
                const feature = e.features[0];
                this.openModal(feature.properties.num_parcel);
            }
        });

        // Cursor pointer
        map.on('mouseenter', 'parcels-fill', () => map.getCanvas().style.cursor = 'pointer');
        map.on('mouseleave', 'parcels-fill', () => map.getCanvas().style.cursor = '');
        map.on('mouseenter', 'parcels-3d', () => map.getCanvas().style.cursor = 'pointer');
        map.on('mouseleave', 'parcels-3d', () => map.getCanvas().style.cursor = '');
    },

    setupListeners() {
        // Search Input
        const searchInput = document.getElementById('searchInput');
        const searchResults = document.getElementById('searchResults');

        let debounceTimer;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(debounceTimer);
            const q = e.target.value;

            if (q.length < 2) {
                searchResults.classList.add('hidden');
                return;
            }

            debounceTimer = setTimeout(async () => {
                try {
                    const res = await fetch(`${API_URL}/search?q=${encodeURIComponent(q)}`);
                    const results = await res.json();

                    searchResults.innerHTML = '';
                    if (results.length > 0) {
                        searchResults.classList.remove('hidden');
                        results.forEach(item => {
                            const div = document.createElement('div');
                            div.className = 'p-2 hover:bg-slate-100 cursor-pointer border-b border-slate-50 text-sm';
                            div.innerHTML = `
                                <div class="font-bold text-indigo-700">${item.num_parcel}</div>
                                <div class="text-xs text-slate-500">${item.owner_name}</div>
                                ${item.nicad ? `<div class="text-[10px] bg-blue-100 text-blue-700 px-1 rounded inline-block mt-1">${item.nicad}</div>` : ''}
                            `;
                            div.onclick = () => {
                                this.openModal(item.num_parcel);
                                searchInput.value = item.num_parcel;
                                searchResults.classList.add('hidden');
                            };
                            searchResults.appendChild(div);
                        });
                    } else {
                        searchResults.classList.add('hidden');
                    }
                } catch (err) {
                    console.error('Search error:', err);
                }
            }, 300);
        });

        // Filters (Client-side style update)
        document.getElementById('applyFilters').addEventListener('click', () => {
            const type = document.getElementById('typeFilter').value;
            const status = document.getElementById('statusFilter').value;

            let filter = ['all'];

            if (type) {
                filter.push(['==', ['get', 'type'], type]);
            }
            if (status) {
                filter.push(['==', ['get', 'status'], status]);
            }

            if (filter.length === 1) filter = null; // No filter

            map.setFilter('parcels-fill', filter);
            map.setFilter('parcels-line', filter);
            map.setFilter('parcels-3d', filter);
        });


        const feature = await res.json();
        const p = feature.properties;

        // Fly to location
        if (feature.geometry) {
            const center = feature.properties.centroid.coordinates;
            map.flyTo({
                center: center,
                zoom: 18,
                pitch: 60,
                essential: true
            });
        }

        // Populate Modal
        document.getElementById('modalTitle').innerText = p.num_parcel || 'N/A';
        document.getElementById('modalStatus').innerText = p.status || 'Enquête';
        document.getElementById('modalType').innerText = p.type === 'individual' ? 'Individuel' : (p.type === 'collective' ? 'Collectif' : 'Inconnu');

        // NICAD Badge
        if (p.nicad) {
            document.getElementById('nicadHeaderBadge').classList.remove('hidden');
            document.getElementById('modalNicadHeader').innerText = p.nicad;
            document.getElementById('modalNicad').innerText = p.nicad;
        } else {
            document.getElementById('nicadHeaderBadge').classList.add('hidden');
            document.getElementById('modalNicad').innerText = '--';
        }

        // Owner Info
        const details = p.details || {};
        if (p.type === 'individual') {
            document.getElementById('ownerLabel').innerText = 'Propriétaire';
            document.getElementById('modalOwnerName').innerText = `${details.prenom || ''} ${details.nom || ''}`;
            document.getElementById('modalPhone').innerText = details.telephone || '--';
            document.getElementById('modalSexe').innerText = details.sexe || '--';
            document.getElementById('modalNaiss').innerText = this.formatDate(details.date_naiss);

            document.getElementById('beneficiariesSection').classList.add('hidden');
        } else if (p.type === 'collective') {
            document.getElementById('ownerLabel').innerText = 'Groupement';
            document.getElementById('modalOwnerName').innerText = details.nom_groupement || 'Nom Inconnu';
            document.getElementById('modalPhone').innerText = '--';
            document.getElementById('modalSexe').innerText = '--';
            document.getElementById('modalNaiss').innerText = '--';

            // Show Beneficiaries
            this.displayBeneficiaries(details.beneficiaries);
        }

        // Location
        document.getElementById('modalRegion').innerText = p.region || '--';
        document.getElementById('modalDepartment').innerText = p.department || '--';
        document.getElementById('modalArrondissement').innerText = p.arrondissement || '--';
        document.getElementById('modalCommune').innerText = p.commune || '--';
        document.getElementById('modalVillage').innerText = p.village || '--';

        // Technical
        document.getElementById('modalSurface').innerText = (p.surface ? p.surface + ' m²' : '--');
        document.getElementById('modalVocation').innerText = p.vocation || '--';

        // Workflow Steps
        this.updateWorkflowSteps(p.status);

        // Show Modal
        document.getElementById('detailModal').classList.remove('hidden');
        document.getElementById('detailModal').classList.add('flex');

    } catch(err) {
        console.error('Error opening modal:', err);
        alert('Erreur lors du chargement des détails de la parcelle.');
    }
},

    displayBeneficiaries(list) {
        const container = document.getElementById('beneficiariesList');
        const section = document.getElementById('beneficiariesSection');
        const countSpan = document.getElementById('benCount');

        container.innerHTML = '';

        if (!list || list.length === 0) {
            section.classList.add('hidden');
            return;
        }

        section.classList.remove('hidden');
        countSpan.innerText = `(${list.length})`;

        list.forEach(b => {
            const div = document.createElement('div');
            div.className = 'p-3 bg-slate-50 rounded border border-slate-100 text-sm flex justify-between items-center';
            div.innerHTML = `
                <div>
                    <div class="font-bold text-slate-700">${b.prenom} ${b.nom}</div>
                    <div class="text-xs text-slate-500">${b.fonction || 'Membre'}</div>
                </div>
                <div class="text-xs text-slate-400">${b.telephone || ''}</div>
            `;
            container.appendChild(div);
        });
    },

        updateWorkflowSteps(status) {
    const steps = ['step1', 'step2', 'step3'];
    const colors = ['bg-emerald-500', 'bg-blue-500', 'bg-emerald-600'];

    // Reset
    steps.forEach(id => {
        const el = document.getElementById(id);
        el.className = 'w-10 h-10 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center mb-1 shadow-md transition-all';
        // Restore icon/number logic if needed, simplified here
    });

    // Step 1 always active (Survey)
    document.getElementById('step1').className = 'w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center mb-1 shadow-md';

    if (status === 'NICAD' || status === 'Approved') {
        document.getElementById('step2').className = 'w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center mb-1 shadow-md';
    }

    if (status === 'Approved') {
        document.getElementById('step3').className = 'w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center mb-1 shadow-md';
    }
},

formatDate(dateStr) {
    if (!dateStr) return '--';
    try {
        return new Date(dateStr).toLocaleDateString('fr-FR');
    } catch (e) {
        return dateStr;
    }
}
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});
