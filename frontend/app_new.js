// Configuration
const API_URL = 'http://localhost:4000/api';

// Status colors for map styling
const STATUS_COLORS = {
    'Survey': '#eab308',    // Yellow
    'NICAD': '#3b82f6',     // Blue
    'Approved': '#10b981'   // Emerald
};

// Global state
let map;
let parcelsLayer;
let allParcels = null;
let currentFilters = {};
let displayedCards = 0;
const CARDS_PER_PAGE = 50; // Only show 50 cards at a time

/**
 * APPLICATION OBJECT
 */
const app = {
    
    init() {
        // Initialize Lucide Icons
        lucide.createIcons();

        // Initialize map
        this.initMap();

        // Load parcels from database
        this.loadParcels();

        // Setup event listeners
        this.setupListeners();
    },

    initMap() {
        // Create map centered on Boundou region, Senegal
        map = L.map('map').setView([13.5, -12.5], 11);

        // Use CartoDB Light basemap for clean look
        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; OpenStreetMap, &copy; CartoDB',
            maxZoom: 19
        }).addTo(map);

        // Initialize parcels layer
        parcelsLayer = L.geoJSON(null, {
            style: this.getStyle.bind(this),
            onEachFeature: this.onEachFeature.bind(this)
        }).addTo(map);
    },

    getStyle(feature) {
        const status = feature.properties.status || 'Survey';
        return {
            fillColor: STATUS_COLORS[status],
            weight: 1,
            opacity: 0.8,
            color: 'white',
            fillOpacity: 0.5
        };
    },

    onEachFeature(feature, layer) {
        layer.on({
            mouseover: (e) => {
                const layer = e.target;
                layer.setStyle({ 
                    weight: 4, 
                    fillOpacity: 0.8, 
                    dashArray: '' 
                });
                layer.bringToFront();
            },
            mouseout: (e) => {
                parcelsLayer.resetStyle(e.target);
            },
            click: (e) => {
                this.zoomToParcel(feature);
                this.openModal(feature);
            }
        });
    },

    async loadParcels(filters = {}) {
        try {
            this.showLoading();
            
            const loadingIndicator = document.getElementById('loadingIndicator');
            const statusText = document.getElementById('statusText');
            if (loadingIndicator) loadingIndicator.classList.remove('hidden');
            if (statusText) statusText.innerText = 'Chargement...';

            const params = new URLSearchParams();
            if (filters.status) params.append('status', filters.status);
            if (filters.type) params.append('type', filters.type);
            if (filters.num_parcel) params.append('num_parcel', filters.num_parcel);

            const response = await fetch(`${API_URL}/parcels?${params}`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            allParcels = data;

            // Update map - use simpler rendering
            parcelsLayer.clearLayers();
            
            // Only add features to map, don't fit bounds for performance
            parcelsLayer.addData(data);

            // Render sidebar cards with pagination
            this.renderSidebar(data.features);

            // Update stats
            document.getElementById('totalCount').innerText = `${data.features.length} Parcelles`;
            
            if (loadingIndicator) loadingIndicator.classList.add('hidden');
            if (statusText) statusText.innerText = 'PostgreSQL';

        } catch (error) {
            console.error('Error fetching parcels:', error);
            this.showError('Erreur de chargement. Vérifiez que le serveur backend est démarré sur le port 4000.');
            
            const loadingIndicator = document.getElementById('loadingIndicator');
            const statusText = document.getElementById('statusText');
            if (loadingIndicator) loadingIndicator.classList.add('hidden');
            if (statusText) statusText.innerText = 'Erreur';
        }
    },

    renderSidebar(features) {
        const list = document.getElementById('parcelList');
        list.innerHTML = '';
        displayedCards = 0;

        if (!features || features.length === 0) {
            list.innerHTML = `
                <div class="text-center p-8 text-slate-400">
                    <i data-lucide="inbox" class="w-12 h-12 mx-auto mb-3 text-slate-300"></i>
                    <p class="font-medium">Aucune parcelle trouvée</p>
                    <p class="text-xs mt-1">Modifiez vos filtres</p>
                </div>
            `;
            lucide.createIcons();
            return;
        }

        // Only render first batch of cards
        const cardsToShow = Math.min(CARDS_PER_PAGE, features.length);
        
        for (let i = 0; i < cardsToShow; i++) {
            this.createParcelCard(features[i], list);
        }
        
        displayedCards = cardsToShow;

        // Add "Load More" button if there are more cards
        if (features.length > CARDS_PER_PAGE) {
            const loadMoreBtn = document.createElement('button');
            loadMoreBtn.className = 'w-full py-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 font-medium rounded-lg transition-colors';
            loadMoreBtn.innerHTML = `<i data-lucide="chevron-down" class="w-4 h-4 inline mr-1"></i> Charger plus (${features.length - CARDS_PER_PAGE} restantes)`;
            loadMoreBtn.onclick = () => this.loadMoreCards(features, list, loadMoreBtn);
            list.appendChild(loadMoreBtn);
        }
        
        // Re-init icons
        lucide.createIcons();
    },

    createParcelCard(feature, container) {
        const p = feature.properties;
        const color = STATUS_COLORS[p.status || 'Survey'];
        
        const card = document.createElement('div');
        card.className = 'bg-white p-4 rounded-lg border border-slate-200 shadow-sm hover:shadow-md transition-all cursor-pointer group';
        card.onclick = () => {
            this.zoomToParcel(feature);
            this.openModal(feature);
        };

        // Get owner name from survey data
        const ownerName = p.survey_data?.prenom && p.survey_data?.nom 
            ? `${p.survey_data.prenom} ${p.survey_data.nom}`
            : (p.survey_data?.nom_gie || 'Non renseigné');

        card.innerHTML = `
            <div class="flex justify-between items-start mb-2">
                <h3 class="font-bold text-slate-700 group-hover:text-indigo-600 transition-colors">${p.num_parcel}</h3>
                <span class="text-[10px] font-bold text-white px-2 py-0.5 rounded-full" style="background-color: ${color}">${p.status || 'Survey'}</span>
            </div>
            <div class="text-sm text-slate-600 mb-1 flex items-center gap-2">
                <i data-lucide="user" class="w-3 h-3"></i> ${ownerName}
            </div>
            <div class="text-xs text-slate-400 flex justify-between mt-3 border-t pt-2 border-slate-100">
                <span class="capitalize">${p.type || 'N/A'}</span>
                <span>${p.village || p.commune || 'N/A'}</span>
            </div>
        `;
        container.appendChild(card);
    },

    loadMoreCards(features, list, button) {
        const currentCount = displayedCards;
        const remainingCount = features.length - currentCount;
        const cardsToAdd = Math.min(CARDS_PER_PAGE, remainingCount);
        
        // Remove the load more button temporarily
        button.remove();
        
        // Add next batch of cards
        for (let i = currentCount; i < currentCount + cardsToAdd; i++) {
            this.createParcelCard(features[i], list);
        }
        
        displayedCards += cardsToAdd;
        
        // Re-add load more button if there are still more cards
        if (displayedCards < features.length) {
            button.innerHTML = `<i data-lucide="chevron-down" class="w-4 h-4 inline mr-1"></i> Charger plus (${features.length - displayedCards} restantes)`;
            list.appendChild(button);
        }
        
        // Re-init icons
        lucide.createIcons();
    },

    setupListeners() {
        const searchInput = document.getElementById('searchInput');
        const statusFilter = document.getElementById('statusFilter');
        const typeFilter = document.getElementById('typeFilter');
        const applyBtn = document.getElementById('applyFilters');
        const exportBtn = document.getElementById('exportBtn');
        const closeModalBtn = document.getElementById('closeModal');
        const closeModalBtn2 = document.getElementById('closeModalBtn');
        const printBtn = document.getElementById('printBtn');
        const sidebarToggle = document.getElementById('sidebarToggle');

        const filterData = () => {
            const term = searchInput.value.toLowerCase();
            const status = statusFilter.value;
            const type = typeFilter.value;

            if (!allParcels || !allParcels.features) return;

            const filteredFeatures = allParcels.features.filter(f => {
                const p = f.properties;
                const ownerName = p.survey_data?.prenom && p.survey_data?.nom 
                    ? `${p.survey_data.prenom} ${p.survey_data.nom}`.toLowerCase()
                    : (p.survey_data?.nom_gie || '').toLowerCase();
                
                const matchesTerm = !term || 
                    p.num_parcel.toLowerCase().includes(term) || 
                    ownerName.includes(term) || 
                    (p.nicad && p.nicad.toLowerCase().includes(term));
                
                const matchesStatus = !status || p.status === status;
                const matchesType = !type || p.type === type;
                
                return matchesTerm && matchesStatus && matchesType;
            });

            const filteredGeoJSON = { type: "FeatureCollection", features: filteredFeatures };
            
            // Update map
            parcelsLayer.clearLayers();
            parcelsLayer.addData(filteredGeoJSON);

            // Update sidebar
            this.renderSidebar(filteredFeatures);

            // Update stats
            document.getElementById('totalCount').innerText = `${filteredFeatures.length} Parcelles`;
        };

        applyBtn.addEventListener('click', filterData);
        searchInput.addEventListener('input', filterData);
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') filterData();
        });

        exportBtn.addEventListener('click', () => this.exportData());
        closeModalBtn.addEventListener('click', () => this.closeModal());
        closeModalBtn2.addEventListener('click', () => this.closeModal());
        printBtn.addEventListener('click', () => this.printParcel());

        // Mobile sidebar toggle
        if (sidebarToggle) {
            sidebarToggle.addEventListener('click', () => {
                const sidebar = document.getElementById('sidebar');
                sidebar.classList.toggle('-translate-x-full');
            });
        }
    },

    zoomToParcel(feature) {
        const layer = L.geoJSON(feature);
        map.flyToBounds(layer.getBounds(), { maxZoom: 18, duration: 1.5 });
    },

    async openModal(feature) {
        const p = feature.properties;

        // Fetch full details from API
        try {
            const response = await fetch(`${API_URL}/parcels/${p.num_parcel}`);
            if (response.ok) {
                const detailData = await response.json();
                this.displayModalContent(detailData.properties);
            } else {
                this.displayModalContent(p);
            }
        } catch (error) {
            console.error('Error fetching parcel details:', error);
            this.displayModalContent(p);
        }

        // Show modal
        const modal = document.getElementById('detailModal');
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    },

    displayModalContent(props) {
        const surveyData = props.survey_data || {};
        const safe = (v) => (v === null || v === undefined || v === '' ? null : v);

        // Title
        document.getElementById('modalTitle').innerText = props.num_parcel;

        // Type badge
        const typeBadge = document.getElementById('modalType');
        typeBadge.innerText = props.type || 'N/A';
        typeBadge.className = props.type === 'collective' 
            ? 'text-xs font-bold uppercase tracking-wide px-2 py-1 rounded bg-purple-100 text-purple-700'
            : 'text-xs font-bold uppercase tracking-wide px-2 py-1 rounded bg-indigo-100 text-indigo-700';

        // Status badge
        const statusBadge = document.getElementById('modalStatus');
        const status = props.status || 'Survey';
        statusBadge.innerText = status;
        const color = STATUS_COLORS[status];
        statusBadge.style.backgroundColor = color + '20';
        statusBadge.style.color = color;

        // Workflow steps
        this.updateWorkflowSteps(status);

        // Owner/Mandataire info
        const ownerLabel = document.getElementById('ownerLabel');
        const ownerName = document.getElementById('modalOwnerName');
        
        if (props.type === 'collective' && props.mandataries && props.mandataries.length > 0) {
            ownerLabel.innerText = 'Mandataire Principal';
            const mand = props.mandataries[0];
            ownerName.innerText = `${safe(mand.prenom) || ''} ${safe(mand.nom) || ''}`;
            
            this.showField('phoneField', 'modalPhone', safe(mand.telephone));
            this.showField('sexeField', 'modalSexe', safe(mand.sexe));
            this.showField('naissField', 'modalNaiss', safe(mand.date_naiss));
            this.showField('numPieceField', 'modalNumPiece', safe(mand.num_piece));
        } else {
            ownerLabel.innerText = 'Propriétaire';
            ownerName.innerText = `${safe(surveyData.prenom) || ''} ${safe(surveyData.nom) || ''}`;
            
            this.showField('phoneField', 'modalPhone', safe(surveyData.telephone));
            this.showField('sexeField', 'modalSexe', safe(surveyData.sexe));
            this.showField('naissField', 'modalNaiss', safe(surveyData.date_naiss));
            this.showField('numPieceField', 'modalNumPiece', safe(surveyData.num_piece));
        }

        // Location
        this.showField('regionField', 'modalRegion', safe(props.region));
        this.showField('communeField', 'modalCommune', safe(props.commune));
        this.showField('villageField', 'modalVillage', safe(props.village));

        // Technical data
        this.showField('nicadField', 'modalNicad', safe(props.nicad) || 'En attente');
        this.showField('delibField', 'modalDelib', safe(props.n_deliberation) || 'En attente');
        this.showField('surfaceField', 'modalSurface', safe(surveyData.superficie_reelle) || safe(props.superficie) || '--');
        this.showField('vocationField', 'modalVocation', safe(surveyData.vocation));

        // Photos
        this.displayPhotos(surveyData);

        // Beneficiaries for collective parcels
        if (props.type === 'collective' && props.beneficiaries && props.beneficiaries.length > 0) {
            this.displayBeneficiaries(props.beneficiaries);
        } else {
            document.getElementById('beneficiariesSection').classList.add('hidden');
        }

        // Re-init icons
        lucide.createIcons();
    },

    updateWorkflowSteps(status) {
        const step2 = document.getElementById('step2');
        const step3 = document.getElementById('step3');

        // Reset
        step2.className = "w-10 h-10 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center mb-1 shadow-md transition-all";
        step3.className = "w-10 h-10 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center mb-1 shadow-md transition-all";
        step2.innerHTML = '<span class="text-sm font-bold">2</span>';
        step3.innerHTML = '<span class="text-sm font-bold">3</span>';

        if (status === 'NICAD' || status === 'Approved') {
            step2.className = "w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center mb-1 shadow-md";
            step2.innerHTML = '<i data-lucide="check" class="w-5 h-5"></i>';
        }
        if (status === 'Approved') {
            step3.className = "w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center mb-1 shadow-md";
            step3.innerHTML = '<i data-lucide="check" class="w-5 h-5"></i>';
        }
    },

    showField(fieldId, valueId, value) {
        const field = document.getElementById(fieldId);
        const valueEl = document.getElementById(valueId);
        
        if (value) {
            field.style.display = '';
            valueEl.innerText = value;
        } else {
            field.style.display = 'none';
        }
    },

    displayPhotos(surveyData) {
        const container = document.getElementById('photoContainer');
        container.innerHTML = '';

        const photos = [];
        if (surveyData.photo_rec_url) photos.push({ url: surveyData.photo_rec_url, label: 'CNI Recto' });
        if (surveyData.photo_ver_url) photos.push({ url: surveyData.photo_ver_url, label: 'CNI Verso / Terrain' });

        if (photos.length === 0) {
            container.innerHTML = `
                <div class="text-center p-6 bg-slate-50 rounded-lg border border-slate-200">
                    <i data-lucide="image-off" class="w-8 h-8 mx-auto text-slate-300 mb-2"></i>
                    <p class="text-xs text-slate-400">Aucune photo disponible</p>
                </div>
            `;
        } else {
            photos.forEach(photo => {
                const div = document.createElement('div');
                div.className = 'group relative overflow-hidden rounded-lg border border-slate-200 bg-slate-100 aspect-video cursor-pointer';
                div.onclick = () => window.open(photo.url, '_blank');
                div.innerHTML = `
                    <img src="${photo.url}" alt="${photo.label}" class="w-full h-full object-cover transition-transform group-hover:scale-105">
                    <div class="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-1 text-center">${photo.label}</div>
                `;
                container.appendChild(div);
            });
        }
    },

    displayBeneficiaries(beneficiaries) {
        const section = document.getElementById('beneficiariesSection');
        const list = document.getElementById('beneficiariesList');
        const count = document.getElementById('benCount');

        section.classList.remove('hidden');
        count.innerText = `(${beneficiaries.length})`;
        list.innerHTML = '';

        beneficiaries.forEach((ben, idx) => {
            const safe = (v) => (v === null || v === undefined || v === '' ? null : v);
            const card = document.createElement('div');
            card.className = 'bg-slate-50 p-3 rounded-lg border border-slate-200 text-sm';
            
            let html = `
                <div class="font-semibold text-slate-700 mb-1">${idx + 1}. ${safe(ben.prenom) || ''} ${safe(ben.nom) || ''}</div>
                <div class="text-xs text-slate-500 space-y-0.5">
            `;
            
            if (safe(ben.sexe)) html += `<div>Sexe: ${ben.sexe}</div>`;
            if (safe(ben.date_naiss)) html += `<div>Naissance: ${ben.date_naiss}</div>`;
            if (safe(ben.num_piece)) html += `<div>N° Pièce: ${ben.num_piece}</div>`;
            
            html += `</div>`;
            
            // Photos
            if (safe(ben.photo_rec_url) || safe(ben.photo_ver_url)) {
                html += `<div class="grid grid-cols-2 gap-2 mt-2">`;
                if (safe(ben.photo_rec_url)) {
                    html += `<img src="${ben.photo_rec_url}" alt="Photo recto" class="w-full rounded border border-slate-300 cursor-pointer hover:scale-105 transition-transform" onclick="window.open('${ben.photo_rec_url}', '_blank')">`;
                }
                if (safe(ben.photo_ver_url)) {
                    html += `<img src="${ben.photo_ver_url}" alt="Photo verso" class="w-full rounded border border-slate-300 cursor-pointer hover:scale-105 transition-transform" onclick="window.open('${ben.photo_ver_url}', '_blank')">`;
                }
                html += `</div>`;
            }
            
            card.innerHTML = html;
            list.appendChild(card);
        });
    },

    closeModal() {
        const modal = document.getElementById('detailModal');
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    },

    printParcel() {
        alert('Génération du certificat PDF en cours...\n\nFonctionnalité à implémenter avec un template PDF.');
    },

    exportData() {
        if (!allParcels || !allParcels.features || allParcels.features.length === 0) {
            alert('Aucune donnée à exporter');
            return;
        }

        // 1. Prepare Excel Data (Flattened)
        const flatData = allParcels.features.map(f => {
            const p = f.properties;
            const survey = p.survey_data || {};
            const ownerName = survey.prenom && survey.nom 
                ? `${survey.prenom} ${survey.nom}`
                : (survey.nom_gie || '');

            return {
                'N° Parcelle': p.num_parcel,
                'Statut': p.status || 'Survey',
                'Type': p.type || 'N/A',
                'Propriétaire/GIE': ownerName,
                'Téléphone': survey.telephone || '',
                'Région': p.region || '',
                'Commune': p.commune || '',
                'Village': p.village || '',
                'Surface': survey.superficie_reelle || p.superficie || '',
                'Vocation': survey.vocation || '',
                'NICAD': p.nicad || '',
                'N° Délibération': p.n_deliberation || ''
            };
        });

        // 2. Generate XLSX
        const ws = XLSX.utils.json_to_sheet(flatData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Parcelles");
        XLSX.writeFile(wb, "Export_Parcelles_Boundou.xlsx");

        // 3. Generate GeoJSON (GIS Compatible)
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(allParcels));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", "parcelles_boundou.geojson");
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();

        alert('✅ Téléchargement démarré:\n\n1. Excel (.xlsx) - Tableau pour rapports\n2. GeoJSON (.geojson) - Format GIS (QGIS/ArcGIS)');
    },

    showLoading() {
        const list = document.getElementById('parcelList');
        list.innerHTML = `
            <div class="text-center p-8">
                <div class="spinner mb-4"></div>
                <p class="text-slate-400">Chargement des parcelles...</p>
            </div>
        `;
    },

    showError(message) {
        const list = document.getElementById('parcelList');
        list.innerHTML = `
            <div class="text-center p-8">
                <i data-lucide="alert-circle" class="w-12 h-12 mx-auto mb-3 text-red-400"></i>
                <p class="font-medium text-red-600 mb-2">Erreur</p>
                <p class="text-sm text-slate-500">${message}</p>
            </div>
        `;
        lucide.createIcons();
    }
};

// Start App
window.onload = () => app.init();
