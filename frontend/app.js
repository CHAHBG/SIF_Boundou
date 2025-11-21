const app = {
    map: null,
    currentStyle: 'osm',
    is3D: true,
    colorByType: false,
    styles: {
        'osm': {
            "version": 8,
            "sources": {
                "osm": {
                    "type": "raster",
                    "tiles": ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
                    "tileSize": 256,
                    "attribution": "&copy; OpenStreetMap Contributors"
                }
            },
            "layers": [{
                "id": "osm",
                "type": "raster",
                "source": "osm",
                "minzoom": 0,
                "maxzoom": 19
            }]
        },
        'satellite': {
            "version": 8,
            "sources": {
                "satellite": {
                    "type": "raster",
                    "tiles": ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
                    "tileSize": 256,
                    "attribution": "&copy; Esri"
                }
            },
            "layers": [{
                "id": "satellite",
                "type": "raster",
                "source": "satellite",
                "minzoom": 0,
                "maxzoom": 22
            }]
        }
    },
    colors: {
        'Survey': '#eab308',   // Yellow
        'NICAD': '#3b82f6',    // Blue
        'deliberee': '#8b5cf6', // Purple
        'approuvee': '#10b981', // Emerald
        'Approved': '#10b981', // Emerald (keep for backward compatibility)
        'unknown': '#94a3b8'   // Slate
    },

    init() {
        // Initialize MapLibre GL JS
        this.map = new maplibregl.Map({
            container: 'map',
            style: this.styles['osm'], // Default to OSM
            center: [-13.669070, 13.732617], // Updated Center
            zoom: 15,
            pitch: 45, // Tilt for 3D effect
            bearing: -17.6,
            antialias: true
        });

        this.map.on('load', () => {
            this.addSourcesAndLayers();
            this.setupInteractions();

            // Load rooftop pattern for habitat - simple diagonal lines pattern
            const size = 64;
            const pattern = new Uint8Array(size * size * 4);
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    const idx = (y * size + x) * 4;
                    // Create diagonal stripe pattern
                    const isDiagonal = (x + y) % 8 < 2;
                    pattern[idx] = isDiagonal ? 139 : 176;     // R
                    pattern[idx + 1] = isDiagonal ? 92 : 130;  // G
                    pattern[idx + 2] = isDiagonal ? 46 : 90;   // B
                    pattern[idx + 3] = 255;                     // A
                }
            }
            this.map.addImage('rooftop-pattern', {
                width: size,
                height: size,
                data: pattern
            });
        });

        // Re-add layers when style changes
        this.map.on('styledata', () => {
            // Check if source exists to prevent "Source already exists" error
            if (!this.map.getSource('parcels-source')) {
                this.addSourcesAndLayers();
            }
        });

        this.setupSearch();
        this.updateLegend();
        lucide.createIcons();
    },

    updateLegend() {
        const legendContent = document.getElementById('legendContent');
        if (!legendContent) return;

        if (this.colorByType) {
            legendContent.innerHTML = `
                <div class="flex items-center gap-2">
                    <span class="w-4 h-4 rounded bg-emerald-500 opacity-80 border border-white"></span>
                    <span>Individuel</span>
                </div>
                <div class="flex items-center gap-2">
                    <span class="w-4 h-4 rounded bg-amber-500 opacity-80 border border-white"></span>
                    <span>Collectif</span>
                </div>
                <div class="mt-2 pt-2 border-t border-slate-200 text-xs text-slate-400">
                    <i data-lucide="info" class="w-3 h-3 inline"></i> Mode: Couleur par Type
                </div>
            `;
        } else {
            legendContent.innerHTML = `
                <div class="flex items-center gap-2">
                    <span class="w-4 h-4 rounded bg-yellow-500 opacity-80 border border-white"></span>
                    <span>Enquête</span>
                </div>
                <div class="flex items-center gap-2">
                    <span class="w-4 h-4 rounded bg-blue-500 opacity-80 border border-white"></span>
                    <span>NICAD</span>
                </div>
                <div class="flex items-center gap-2">
                    <span class="w-4 h-4 rounded bg-purple-500 opacity-80 border border-white"></span>
                    <span>Délibérée</span>
                </div>
                <div class="flex items-center gap-2">
                    <span class="w-4 h-4 rounded bg-emerald-500 opacity-80 border border-white"></span>
                    <span>Approuvée</span>
                </div>
                <div class="mt-2 pt-2 border-t border-slate-200 text-xs text-slate-400">
                    <i data-lucide="info" class="w-3 h-3 inline"></i> Mode: Couleur par Statut
                </div>
            `;
        }
        lucide.createIcons();
    },

    switchBasemap(styleName) {
        if (this.currentStyle === styleName) return;
        this.currentStyle = styleName;
        this.map.setStyle(this.styles[styleName]);
    },

    toggle3D() {
        this.is3D = !this.is3D;
        this.map.easeTo({
            pitch: this.is3D ? 45 : 0,
            duration: 1000
        });
        this.updateLayers();
    },

    toggleColorByType() {
        this.colorByType = !this.colorByType;
        this.updateLayers();
        this.updateLegend();
    },

    getColorExpression() {
        if (this.colorByType) {
            return [
                'match',
                ['get', 'type'],
                'individual', '#10b981', // Emerald for individual
                'collective', '#f59e0b',  // Amber for collective
                '#94a3b8' // Default
            ];
        } else {
            return [
                'match',
                ['get', 'status'],
                'Survey', '#eab308',
                'NICAD', '#3b82f6',
                'deliberee', '#8b5cf6',
                'approuvee', '#10b981',
                'Approved', '#10b981',
                '#94a3b8'
            ];
        }
    },

    updateLayers() {
        if (!this.map.getLayer('parcels-3d')) return;

        this.map.setPaintProperty('parcels-3d', 'fill-extrusion-color', this.getColorExpression());

        if (this.is3D) {
            this.map.setPaintProperty('parcels-3d', 'fill-extrusion-height', [
                'case',
                ['in', 'habitat', ['downcase', ['coalesce', ['get', 'type_usag'], '']]],
                4,
                0
            ]);
        } else {
            this.map.setPaintProperty('parcels-3d', 'fill-extrusion-height', 0);
        }
    },

    addSourcesAndLayers() {
        // Safety check: if source already exists, do nothing
        if (this.map.getSource('parcels-source')) return;

        // Add Vector Tile Source from our Backend
        this.map.addSource('parcels-source', {
            type: 'vector',
            tiles: [
                window.location.hostname === 'localhost'
                    ? 'http://localhost:4000/api/tiles/{z}/{x}/{y}'
                    : `${window.location.origin}/api/tiles/{z}/{x}/{y}`
            ],
            minzoom: 10,
            maxzoom: 22
        });

        this.map.addLayer({
            'id': 'parcels-3d',
            'type': 'fill-extrusion',
            'source': 'parcels-source',
            'source-layer': 'parcels',
            'paint': {
                'fill-extrusion-color': this.getColorExpression(),
                'fill-extrusion-height': [
                    'case',
                    ['in', 'habitat', ['downcase', ['coalesce', ['get', 'type_usag'], '']]],
                    4, // 4 meters height for habitat
                    0  // 0 for others
                ],
                'fill-extrusion-base': 0,
                'fill-extrusion-opacity': 0.8
            }
        });

        // 2. Line Layer (Borders)
        this.map.addLayer({
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

        // 3. Highlight Layer (for hover/selection)
        this.map.addLayer({
            'id': 'parcels-highlight',
            'type': 'line',
            'source': 'parcels-source',
            'source-layer': 'parcels',
            'paint': {
                'line-color': '#4f46e5', // Indigo 600
                'line-width': 3
            },
            'filter': ['==', 'id', ''] // Initially empty
        });
    },

    setupInteractions() {
        // Change cursor on hover
        this.map.on('mouseenter', 'parcels-3d', () => {
            this.map.getCanvas().style.cursor = 'pointer';
        });
        this.map.on('mouseleave', 'parcels-3d', () => {
            this.map.getCanvas().style.cursor = '';
        });

        // Click to open details
        this.map.on('click', 'parcels-3d', (e) => {
            if (e.features.length > 0) {
                const feature = e.features[0];
                const id = feature.properties.id; // Assuming 'id' is in properties

                // Highlight the feature
                this.map.setFilter('parcels-highlight', ['==', 'id', id]);

                // Store click coordinates for modal positioning
                this.lastClickPoint = e.point;

                // Fetch full details
                this.fetchAndShowDetails(id);
            }
        });
    },

    setupSearch() {
        const searchInput = document.getElementById('searchInput');
        let debounceTimer;

        searchInput.addEventListener('input', (e) => {
            clearTimeout(debounceTimer);
            const query = e.target.value;

            if (query.length < 2) {
                this.renderSidebar([]);
                return;
            }

            debounceTimer = setTimeout(() => {
                // Use relative path for production (Netlify redirects /api to functions)
                // For local dev, we might need to handle this differently or use proxy
                const apiUrl = window.location.hostname === 'localhost' ? 'http://localhost:4000/api' : '/api';
                fetch(`${apiUrl}/search?q=${encodeURIComponent(query)}`)
                    .then(res => res.json())
                    .then(data => this.renderSidebar(data))
                    .catch(err => console.error('Search error:', err));
            }, 300);
        });
    },

    renderSidebar(results) {
        const list = document.getElementById('parcelList');
        list.innerHTML = '';

        if (results.length === 0) {
            list.innerHTML = `<div class="text-center p-8 text-slate-400 italic">Aucun résultat trouvé.</div>`;
            return;
        }

        results.forEach(item => {
            const color = this.colors[item.status] || this.colors['unknown'];

            const card = document.createElement('div');
            card.className = 'bg-white p-4 rounded-lg border border-slate-200 shadow-sm hover:shadow-md transition-all cursor-pointer group';
            card.onclick = () => {
                this.fetchAndShowDetails(item.id);
            };

            card.innerHTML = `
                <div class="flex justify-between items-start mb-2">
                    <h3 class="font-bold text-slate-700 group-hover:text-indigo-600 transition-colors">${item.num_parcel || item.id}</h3>
                    <span class="text-[10px] font-bold text-white px-2 py-0.5 rounded-full" style="background-color: ${color}">${item.status || 'Inconnu'}</span>
                </div>
                <div class="text-sm text-slate-600 mb-1 flex items-center gap-2">
                    <i data-lucide="user" class="w-3 h-3"></i> ${item.owner_name}
                </div>
                <div class="text-xs text-slate-400 flex justify-between mt-3 border-t pt-2 border-slate-100">
                    <span>NICAD: ${item.nicad || '--'}</span>
                </div>
            `;
            list.appendChild(card);
        });

        lucide.createIcons();
    },

    fetchAndShowDetails(id) {
        // Show loading state or something?
        const apiUrl = window.location.hostname === 'localhost' ? 'http://localhost:4000/api' : '/api';
        fetch(`${apiUrl}/parcels/${id}`)
            .then(res => res.json())
            .then(feature => {
                if (feature.error) {
                    alert('Erreur: ' + feature.error);
                    return;
                }

                // Fly to location
                if (feature.geometry) {
                    // Calculate bounds or center
                    // Since we have geometry in the detail response (GeoJSON), we can use it
                    // But MapLibre needs LngLatBounds or center.
                    // We can use a simple helper to get centroid or bounds from GeoJSON geometry

                    // Simple centroid approximation if available in properties (backend sends it)
                    if (feature.properties.centroid) {
                        const coords = feature.properties.centroid.coordinates;
                        this.map.flyTo({
                            center: coords,
                            zoom: 19,
                            pitch: 60
                        });
                    }
                }

                this.openModal(feature);
            })
            .catch(err => console.error('Error fetching details:', err));
    },

    openModal(feature) {
        const p = feature.properties;
        document.getElementById('modalTitle').innerText = p.num_parcel || p.id;
        // Status Badge
        const statusColor = this.colors[p.status] || this.colors['unknown'];
        const statusBadge = document.getElementById('modalStatus');
        statusBadge.innerText = p.status || 'Inconnu';
        statusBadge.style.backgroundColor = statusColor + '20';
        statusBadge.style.color = statusColor;
        // Workflow Visualizer
        const step2 = document.getElementById('step2');
        const step3 = document.getElementById('step3');
        step2.className = "w-8 h-8 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center mb-1 shadow-sm transition-colors";
        step3.className = "w-8 h-8 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center mb-1 shadow-sm transition-colors";
        step2.innerHTML = '<span class="text-xs font-bold">2</span>';
        step3.innerHTML = '<span class="text-xs font-bold">3</span>';
        if (p.status === 'NICAD' || p.status === 'deliberee' || p.status === 'approuvee' || p.status === 'Approved') {
            step2.className = "w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center mb-1 shadow-sm";
            step2.innerHTML = '<i data-lucide="check" class="w-4 h-4"></i>';
        }
        if (p.status === 'approuvee' || p.status === 'Approved') {
            step3.className = "w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center mb-1 shadow-sm";
            step3.innerHTML = '<i data-lucide="check" class="w-4 h-4"></i>';
        }
        lucide.createIcons();
        // Individual vs Collective
        const leftCol = document.querySelector('#detailModal .grid > div:first-child');
        leftCol.innerHTML = '';
        if (p.type === 'individual') {
            leftCol.innerHTML = `
                <h3 class="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                    <i data-lucide="user" class="w-4 h-4"></i> Propriétaire / Occupant
                </h3>
                <div class="bg-slate-50 p-4 rounded-lg border border-slate-100 mb-4">
                    <p class="text-lg font-semibold text-slate-800">${p.prenom || ''} ${p.nom || ''}</p>
                    <div class="grid grid-cols-2 gap-2 mt-2 text-sm">
                        <div><span class="block text-slate-400 text-xs">Téléphone</span><span class="font-medium">${p.telephone || '--'}</span></div>
                        <div><span class="block text-slate-400 text-xs">Village</span><span class="font-medium break-words">${p.village || '--'}</span></div>
                        <div><span class="block text-slate-400 text-xs">Type</span><span class="font-medium">${p.type || '--'}</span></div>
                        <div><span class="block text-slate-400 text-xs">Vocation</span><span class="font-medium break-words">${p.vocation || '--'}</span></div>
                    </div>
                </div>
                <h3 class="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2 mt-6">
                    <i data-lucide="file-check" class="w-4 h-4"></i> Données Techniques
                </h3>
                <div class="bg-slate-50 p-4 rounded-lg border border-slate-100 space-y-2 mb-4">
                    <div class="flex justify-between text-sm"><span class="text-slate-500">NICAD</span><span class="font-mono font-bold text-indigo-600">${p.nicad || 'En attente'}</span></div>
                    <div class="flex justify-between text-sm"><span class="text-slate-500">N° Délibération</span><span class="font-medium">${p.n_deliberation || '--'}</span></div>
                    <div class="flex justify-between text-sm"><span class="text-slate-500">N° Approbation</span><span class="font-medium">${p.n_approbation || '--'}</span></div>
                    <div class="flex justify-between text-sm"><span class="text-slate-500">Surface</span><span class="font-medium">${p.surface || 0} m²</span></div>
                </div>
                <h3 class="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2 mt-6">Détails Supplémentaires</h3>
                <div class="bg-slate-50 p-4 rounded-lg border border-slate-100 grid grid-cols-2 gap-2 text-sm">
                    <div><span class="text-slate-400 text-xs block">Sexe</span> ${p.sexe || '--'}</div>
                    <div><span class="text-slate-400 text-xs block">Date Naissance</span> ${p.date_naiss ? new Date(p.date_naiss).toLocaleDateString() : '--'}</div>
                    <div><span class="text-slate-400 text-xs block">CNI</span> ${p.num_piece || '--'}</div>
                    <div><span class="text-slate-400 text-xs block">Lieu Naissance</span> ${p.lieu_naiss || '--'}</div>
                </div>
            `;
        } else if (p.type === 'collective') {
            const mandatariesHtml = (p.mandataries || []).map(m => `
                <div class='bg-white p-3 rounded border border-slate-200 mb-2'>
                    <div class='flex justify-between items-start mb-2'>
                        <span class='font-semibold text-slate-700'>${m.prenom || ''} ${m.nom || ''}</span>
                        <span class='text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded'>${m.typ_per || 'Mandataire'}</span>
                    </div>
                    <div class='grid grid-cols-2 gap-1 text-xs text-slate-600'>
                        <div><span class='text-slate-400'>Sexe:</span> ${m.sexe || '--'}</div>
                        <div><span class='text-slate-400'>Tél:</span> ${m.telephone || '--'}</div>
                        <div><span class='text-slate-400'>Né(e) le:</span> ${m.date_naiss ? new Date(m.date_naiss).toLocaleDateString() : '--'}</div>
                        <div><span class='text-slate-400'>À:</span> ${m.lieu_naiss || '--'}</div>
                        <div class='col-span-2'><span class='text-slate-400'>CNI:</span> ${m.num_piece || '--'}</div>
                    </div>
                </div>
            `).join('');

            const beneficiariesHtml = (p.beneficiaries || []).map((b, idx) => `
                <div class='bg-white p-3 rounded border border-slate-200 mb-2'>
                    <div class='flex justify-between items-start mb-1'>
                        <span class='font-semibold text-slate-700'>${idx + 1}. ${b.prenom || ''} ${b.nom || ''}</span>
                        <span class='text-xs text-slate-500'>${b.sexe || '--'}</span>
                    </div>
                    <div class='grid grid-cols-2 gap-1 text-xs text-slate-600 mb-2'>
                        <div><span class='text-slate-400'>Né(e):</span> ${b.date_naiss ? new Date(b.date_naiss).toLocaleDateString() : '--'}</div>
                        <div><span class='text-slate-400'>Pièce:</span> ${b.type_piece || '--'}</div>
                        <div class='col-span-2'><span class='text-slate-400'>N°:</span> ${b.num_piece || '--'}</div>
                    </div>
                    ${b.photo_rec_url || b.photo_ver_url || b.signature ? `
                    <div class='grid grid-cols-3 gap-1 mt-2'>
                        ${b.photo_rec_url ? `<div><img src='${b.photo_rec_url}' alt='Pièce Recto' class='w-full h-20 object-cover rounded border border-slate-200' /></div>` : ''}
                        ${b.photo_ver_url ? `<div><img src='${b.photo_ver_url}' alt='Pièce Verso' class='w-full h-20 object-cover rounded border border-slate-200' /></div>` : ''}
                        ${b.signature ? `<div><img src='${b.signature}' alt='Signature' class='w-full h-20 object-cover rounded border border-slate-200' /></div>` : ''}
                    </div>` : ''}
                </div>
            `).join('');

            leftCol.innerHTML = `
                <h3 class="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                    <i data-lucide="users" class="w-4 h-4"></i> Groupement / Collectif
                </h3>
                <div class="bg-slate-50 p-4 rounded-lg border border-slate-100 mb-4">
                    <p class="text-lg font-semibold text-slate-800">Parcelle Collective</p>
                    <div class="grid grid-cols-2 gap-2 mt-2 text-sm">
                        <div><span class="block text-slate-400 text-xs">Nombre d'affectataires</span><span class="font-medium">${p.nombre_affectata || (p.beneficiaries ? p.beneficiaries.length : '--')}</span></div>
                        <div><span class="block text-slate-400 text-xs">Vocation</span><span class="font-medium break-words">${p.vocation || '--'}</span></div>
                        <div><span class="block text-slate-400 text-xs">Village</span><span class="font-medium break-words">${p.village || '--'}</span></div>
                        <div><span class="block text-slate-400 text-xs">Surface</span><span class="font-medium">${p.surface || 0} m²</span></div>
                    </div>
                </div>
                <h3 class="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">Données Techniques</h3>
                <div class="bg-slate-50 p-4 rounded-lg border border-slate-100 space-y-2 mb-4">
                    <div class="flex justify-between text-sm"><span class="text-slate-500">NICAD</span><span class="font-mono font-bold text-indigo-600">${p.nicad || 'En attente'}</span></div>
                    <div class="flex justify-between text-sm"><span class="text-slate-500">N° Délibération</span><span class="font-medium">${p.n_deliberation || '--'}</span></div>
                    <div class="flex justify-between text-sm"><span class="text-slate-500">N° Approbation</span><span class="font-medium">${p.n_approbation || '--'}</span></div>
                    <div class="flex justify-between text-sm"><span class="text-slate-500">Surface</span><span class="font-medium">${p.surface || 0} m²</span></div>
                </div>
                <h3 class="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2 mt-4 mb-2">
                    <i data-lucide="user-check" class="w-4 h-4"></i> Mandataires (${(p.mandataries || []).length})
                </h3>
                <div class="max-h-64 overflow-y-auto custom-scroll">
                    ${mandatariesHtml || '<p class="text-sm text-slate-400 italic">Aucun mandataire</p>'}
                </div>
                <h3 class="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2 mt-4 mb-2">
                    <i data-lucide="users" class="w-4 h-4"></i> Affectataires/Bénéficiaires (${(p.beneficiaries || []).length})
                </h3>
                <div class="max-h-64 overflow-y-auto custom-scroll">
                    ${beneficiariesHtml || '<p class="text-sm text-slate-400 italic">Aucun bénéficiaire</p>'}
                </div>
            `;
        }
        // Images - for collective parcels, show mandataire photos
        if (p.type === 'collective' && p.mandataries && p.mandataries.length > 0) {
            document.getElementById('modalPhotoRecto').src = p.mandataries[0].photo_rec_url || "https://placehold.co/600x400?text=Non+Disponible";
            document.getElementById('modalPhotoVerso').src = p.mandataries[0].photo_ver_url || "https://placehold.co/600x400?text=Non+Disponible";
        } else {
            document.getElementById('modalPhotoRecto').src = p.photo_rec_url || "https://placehold.co/600x400?text=Non+Disponible";
            document.getElementById('modalPhotoVerso').src = p.photo_ver_url || "https://placehold.co/600x400?text=Non+Disponible";
        }
        // Conflict
        const alertBox = document.getElementById('conflictAlert');
        if (p.conflict) {
            alertBox.classList.remove('hidden');
            document.getElementById('modalConflictText').innerText = p.conflict_reason || "Conflit signalé";
        } else {
            alertBox.classList.add('hidden');
        }

        // Position modal contextually
        const modal = document.getElementById('detailModal');
        if (this.lastClickPoint) {
            const x = this.lastClickPoint.x;
            const y = this.lastClickPoint.y;
            const windowWidth = window.innerWidth;
            const windowHeight = window.innerHeight;
            const modalWidth = 700;
            const maxModalHeight = windowHeight - 40; // 20px margin top and bottom

            // Calculate position - try to show to the right of click
            let left = Math.min(x + 20, windowWidth - modalWidth - 20);
            let top = Math.max(20, Math.min(y - 100, windowHeight - maxModalHeight - 20));

            // If too far right, show on left side of click
            if (left < 420) { // accounting for sidebar
                left = Math.max(420, x - modalWidth - 20);
                if (left < 420) left = 420; // fallback if still too far left
            }

            // Ensure modal stays within viewport bounds
            if (top + maxModalHeight > windowHeight - 20) {
                top = windowHeight - maxModalHeight - 20;
            }
            if (top < 20) {
                top = 20;
            }

            modal.style.left = `${left}px`;
            modal.style.top = `${top}px`;
            modal.style.transform = 'none';
        } else {
            // Fallback to center-right of viewport
            modal.style.left = '50%';
            modal.style.top = '50%';
            modal.style.transform = 'translate(-50%, -50%)';
        }

        modal.classList.remove('hidden');
        lucide.createIcons();
    },

    closeModal() {
        const modal = document.getElementById('detailModal');
        modal.classList.add('hidden');
        modal.style.transform = '';
    },

    exportData() {
        alert("L'export complet n'est pas disponible en mode 3D (Performance). Veuillez contacter l'administrateur pour un export base de données.");
    }
};

// Start App
window.onload = () => app.init();
