window.app = {
    map: null,
    currentStyle: 'osm',
    is3D: true,
    colorByType: false,
    lastClickLngLat: null,
    lightingInterval: null,
    resizeTimeout: null,
    visibleLayers: {
        'individual': true,
        'collective': true,
        'Survey': true,
        'NICAD': true,
        'deliberee': true,
        'approuvee': true
    },
    styles: {
        'osm': {
            "version": 8,
            "sources": {
                "osm": {
                    "type": "raster",
                    "tiles": ["https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
                        "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
                        "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png"],
                    "tileSize": 256,
                    "attribution": "&copy; OpenStreetMap Contributors",
                    "maxzoom": 19
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
                    "attribution": "&copy; Esri",
                    "maxzoom": 22
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
            antialias: true,
            dragRotate: true, // Enable rotation with Ctrl+drag or right-click drag
            touchPitch: true, // Enable pitch on touch devices
            maxPitch: 85, // Allow steeper angles
            minZoom: 10, // Prevent zooming out too far
            maxZoom: 22 // Allow very close zoom
        });

        // Add navigation controls (zoom, rotation, compass)
        this.map.addControl(new maplibregl.NavigationControl({
            showCompass: true,
            showZoom: true,
            visualizePitch: true
        }), 'top-left');

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

        // Hide loading indicator once tiles start loading
        this.map.on('sourcedata', (e) => {
            if (e.sourceId === 'parcels-source' && e.isSourceLoaded) {
                const loadingIndicator = document.getElementById('loadingIndicator');
                if (loadingIndicator) {
                    loadingIndicator.style.transition = 'opacity 0.5s';
                    loadingIndicator.style.opacity = '0';
                    setTimeout(() => loadingIndicator.remove(), 500);
                }
            }
        });

        // Handle tile loading errors with retry
        this.map.on('error', (e) => {
            if (e.error && e.error.message) {
                // Suppress common tile loading errors (network issues, rate limiting)
                const suppressedErrors = ['Failed to fetch', 'tile', 'NetworkError', 'AbortError'];
                const shouldSuppress = suppressedErrors.some(err => 
                    e.error.message.includes(err) || e.error.toString().includes(err)
                );
                
                if (!shouldSuppress) {
                    console.error('Map error:', e.error);
                }
            }
        });

        // Re-add layers when style changes
        this.map.on('load', () => {
            // Check if source exists to prevent "Source already exists" error
            if (!this.map.getSource('parcels-source')) {
                this.addSourcesAndLayers();
            }
            
            // Setup lighting after map is fully loaded
            this.setupLighting();
            
            // Fix iframe sizing - resize map after load
            this.handleResize();
        });

        // Reapply lighting when style changes (basemap switch)
        this.map.on('style.load', () => {
            // Re-add sources and layers after style change
            if (!this.map.getSource('parcels-source')) {
                this.addSourcesAndLayers();
            }
            
            // Reapply lighting
            this.updateSunPosition();
        });

        // Handle window resize events (for iframe embedding)
        window.addEventListener('resize', () => {
            this.handleResize();
        });

        // Handle postMessage from parent window (for iframe communication)
        window.addEventListener('message', (event) => {
            if (event.data === 'resize' || event.data.type === 'resize') {
                this.handleResize();
            }
        });

        this.setupSearch();
        this.updateLegend();
        this.updateViewModeIndicator();
        lucide.createIcons();

        // Auto-hide rotation tip after 8 seconds
        setTimeout(() => {
            const tip = document.getElementById('rotationTip');
            if (tip) {
                tip.style.transition = 'opacity 0.5s';
                tip.style.opacity = '0';
                setTimeout(() => tip.classList.add('hidden'), 500);
            }
        }, 8000);
    },

    updateLegend() {
        const legendContent = document.getElementById('legendContent');
        if (!legendContent) return;

        if (this.colorByType) {
            legendContent.innerHTML = `
                <div class="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-1 rounded transition-colors" 
                     onclick="app.toggleLayerVisibility('individual')">
                    <span class="w-4 h-4 rounded bg-emerald-500 ${this.visibleLayers.individual ? 'opacity-80' : 'opacity-30'} border border-white"></span>
                    <span class="${!this.visibleLayers.individual ? 'line-through opacity-50' : ''}">Individuel</span>
                </div>
                <div class="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-1 rounded transition-colors" 
                     onclick="app.toggleLayerVisibility('collective')">
                    <span class="w-4 h-4 rounded bg-amber-500 ${this.visibleLayers.collective ? 'opacity-80' : 'opacity-30'} border border-white"></span>
                    <span class="${!this.visibleLayers.collective ? 'line-through opacity-50' : ''}">Collectif</span>
                </div>
                <div class="mt-2 pt-2 border-t border-slate-200 text-xs text-slate-400">
                    <i data-lucide="info" class="w-3 h-3 inline"></i> Cliquez pour afficher/masquer
                </div>
            `;
        } else {
            legendContent.innerHTML = `
                <div class="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-1 rounded transition-colors" 
                     onclick="app.toggleLayerVisibility('Survey')">
                    <span class="w-4 h-4 rounded bg-yellow-500 ${this.visibleLayers.Survey ? 'opacity-80' : 'opacity-30'} border border-white"></span>
                    <span class="${!this.visibleLayers.Survey ? 'line-through opacity-50' : ''}">Enquête</span>
                </div>
                <div class="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-1 rounded transition-colors" 
                     onclick="app.toggleLayerVisibility('NICAD')">
                    <span class="w-4 h-4 rounded bg-blue-500 ${this.visibleLayers.NICAD ? 'opacity-80' : 'opacity-30'} border border-white"></span>
                    <span class="${!this.visibleLayers.NICAD ? 'line-through opacity-50' : ''}">NICAD</span>
                </div>
                <div class="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-1 rounded transition-colors" 
                     onclick="app.toggleLayerVisibility('deliberee')">
                    <span class="w-4 h-4 rounded bg-purple-500 ${this.visibleLayers.deliberee ? 'opacity-80' : 'opacity-30'} border border-white"></span>
                    <span class="${!this.visibleLayers.deliberee ? 'line-through opacity-50' : ''}">Délibérée</span>
                </div>
                <div class="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-1 rounded transition-colors" 
                     onclick="app.toggleLayerVisibility('approuvee')">
                    <span class="w-4 h-4 rounded bg-emerald-500 ${this.visibleLayers.approuvee ? 'opacity-80' : 'opacity-30'} border border-white"></span>
                    <span class="${!this.visibleLayers.approuvee ? 'line-through opacity-50' : ''}">Approuvée</span>
                </div>
                <div class="mt-2 pt-2 border-t border-slate-200 text-xs text-slate-400">
                    <i data-lucide="info" class="w-3 h-3 inline"></i> Cliquez pour afficher/masquer
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

    updateViewModeIndicator() {
        const indicator = document.getElementById('viewModeIndicator');
        if (indicator) {
            indicator.textContent = this.is3D ? 'Vue 3D Active' : 'Vue 2D Active';
        }
    },

    setupLighting() {
        // Prevent multiple intervals
        if (this.lightingInterval) {
            return;
        }

        // Initial update
        this.updateSunPosition();

        // Update every minute
        this.lightingInterval = setInterval(() => {
            this.updateSunPosition();
        }, 60000);
    },

    updateSunPosition() {
        // Only update if map is loaded and style is ready
        if (!this.map || !this.map.isStyleLoaded()) {
            return;
        }

        const now = new Date();
        const hours = now.getHours();
        const minutes = now.getMinutes();
        const time = hours + minutes / 60;

        // Simple solar position simulation
        // Sunrise at 6:00, Sunset at 18:00
        // Azimuth: 90 (East) at 6:00 -> 180 (South) at 12:00 -> 270 (West) at 18:00
        // Altitude: 0 at 6:00 -> 90 at 12:00 -> 0 at 18:00

        let azimuth, altitude, intensity, color, skyColor;

        if (time >= 6 && time <= 18) {
            // DAY MODE
            const dayProgress = (time - 6) / 12; // 0 to 1
            azimuth = 90 + (dayProgress * 180);
            altitude = Math.sin(dayProgress * Math.PI) * 90;

            // Intensity peaks at noon
            intensity = 0.6 + (Math.sin(dayProgress * Math.PI) * 0.4); // 0.6 to 1.0

            // Color warms up at sunrise/sunset
            if (time < 8 || time > 16) {
                color = '#fcd34d'; // Warm/Orange
                skyColor = 'linear-gradient(to bottom, #87ceeb, #fdba74)'; // Blue to Orange
            } else {
                color = '#ffffff'; // White
                skyColor = '#87ceeb'; // Light Blue
            }
        } else {
            // NIGHT MODE
            // Moon position (simplified)
            const nightProgress = (time >= 18 ? time - 18 : time + 6) / 12;
            azimuth = 270 + (nightProgress * 180);
            altitude = Math.sin(nightProgress * Math.PI) * 45; // Moon lower than sun

            intensity = 0.25; // Low intensity
            color = '#b0c4de'; // Cool Blue/Silver
            skyColor = '#0f172a'; // Dark Navy
        }

        // Update Map Light
        if (this.map && this.map.isStyleLoaded()) {
            this.map.setLight({
                anchor: 'map',
                position: [1.5, azimuth, altitude],
                color: color,
                intensity: intensity
            });
        }
    },

    handleResize() {
        // Debounce resize calls to prevent excessive updates
        if (this.resizeTimeout) {
            clearTimeout(this.resizeTimeout);
        }

        this.resizeTimeout = setTimeout(() => {
            // Resize map to fit container (fixes iframe sizing issues)
            if (this.map) {
                this.map.resize();
            }
        }, 100);
    },

    toggle3D() {
        this.is3D = !this.is3D;
        this.map.easeTo({
            pitch: this.is3D ? 45 : 0,
            duration: 1000
        });
        this.updateLayers();
        this.updateViewModeIndicator();
    },

    toggleColorByType() {
        this.colorByType = !this.colorByType;
        this.updateLayers();
        this.updateLegend();
    },

    resetBearing() {
        // Reset rotation and pitch to default view
        this.map.easeTo({
            bearing: -17.6,
            pitch: this.is3D ? 45 : 0,
            duration: 1000
        });
    },

    toggleLayerVisibility(layer) {
        this.visibleLayers[layer] = !this.visibleLayers[layer];
        this.updateLegend();
        this.applyLayerFilters();
    },

    applyLayerFilters() {
        if (!this.map.getLayer('parcels-3d')) return;

        let filter;
        if (this.colorByType) {
            // Filter by type (individual/collective)
            const visibleTypes = [];
            if (this.visibleLayers.individual) visibleTypes.push('individual');
            if (this.visibleLayers.collective) visibleTypes.push('collective');

            if (visibleTypes.length === 0) {
                filter = ['==', 'type', 'none']; // Hide all
            } else if (visibleTypes.length === 2) {
                filter = null; // Show all
            } else {
                filter = ['in', ['get', 'type'], ['literal', visibleTypes]];
            }
        } else {
            // Filter by status
            const visibleStatuses = [];
            if (this.visibleLayers.Survey) visibleStatuses.push('Survey');
            if (this.visibleLayers.NICAD) visibleStatuses.push('NICAD');
            if (this.visibleLayers.deliberee) visibleStatuses.push('deliberee');
            if (this.visibleLayers.approuvee) {
                visibleStatuses.push('approuvee');
                visibleStatuses.push('Approved'); // Handle both variants
            }

            if (visibleStatuses.length === 0) {
                filter = ['==', 'status', 'none']; // Hide all
            } else if (visibleStatuses.length >= 5) {
                filter = null; // Show all
            } else {
                filter = ['in', ['get', 'status'], ['literal', visibleStatuses]];
            }
        }

        this.map.setFilter('parcels-3d', filter);
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
                ['+', 10, ['%', ['to-number', ['get', 'id']], 21]],
                0
            ]);
        } else {
            this.map.setPaintProperty('parcels-3d', 'fill-extrusion-height', 0);
        }

        // Apply visibility filters
        this.applyLayerFilters();
    },

    addSourcesAndLayers() {
        // Safety check: if source already exists, do nothing
        if (this.map.getSource('parcels-source')) return;

        // Backend API URL from config
        const BACKEND_URL = window.APP_CONFIG.BACKEND_URL;

        // Add Vector Tile Source from our Backend
        this.map.addSource('parcels-source', {
            type: 'vector',
            tiles: [
                `${BACKEND_URL}/api/tiles/{z}/{x}/{y}`
            ],
            // Optimize tile loading for faster initial display
            minzoom: 10,
            maxzoom: 22,
            // Enable tile caching and optimize performance
            scheme: 'xyz',
            // Reduce tile requests by allowing some overfetch
            tileSize: 512,
            // Increase buffer for smoother panning
            buffer: 64,
            // Increase tolerance to reduce features at lower zooms
            tolerance: 3.5
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
                    ['+', 10, ['%', ['to-number', ['get', 'id']], 21]], // 10-30m height for habitat
                    0  // 0 for others
                ],
                'fill-extrusion-base': 0,
                'fill-extrusion-opacity': 0.8
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
        let hoverTimeout = null;

        // Throttle cursor changes to reduce repaints
        this.map.on('mouseenter', 'parcels-3d', () => {
            clearTimeout(hoverTimeout);
            this.map.getCanvas().style.cursor = 'pointer';
        });

        this.map.on('mouseleave', 'parcels-3d', () => {
            hoverTimeout = setTimeout(() => {
                this.map.getCanvas().style.cursor = '';
            }, 50);
        });

        // Optimize click handler with debouncing to prevent double-clicks
        let clickTimeout = null;
        this.map.on('click', 'parcels-3d', (e) => {
            if (clickTimeout) return; // Ignore rapid clicks

            if (e.features.length > 0) {
                const feature = e.features[0];
                const id = feature.properties.id;

                // Prevent multiple rapid clicks
                clickTimeout = setTimeout(() => { clickTimeout = null; }, 500);

                // Highlight the feature with requestAnimationFrame
                requestAnimationFrame(() => {
                    this.map.setFilter('parcels-highlight', ['==', 'id', id]);
                });

                // Fetch full details
                this.fetchAndShowDetails(id);
            }
        });
    },

    setupSearch() {
        const searchInput = document.getElementById('searchInput');
        const dropdown = document.getElementById('searchResultsDropdown');
        let debounceTimer;
        let currentSearchRequest = null;

        // Hide dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!searchInput.contains(e.target) && !dropdown.contains(e.target)) {
                dropdown.classList.add('hidden');
            }
        });

        // Show dropdown on focus if there's a query
        searchInput.addEventListener('focus', () => {
            if (searchInput.value.trim().length >= 2) {
                dropdown.classList.remove('hidden');
            }
        });

        searchInput.addEventListener('input', (e) => {
            clearTimeout(debounceTimer);
            const query = e.target.value.trim();

            if (query.length < 2) {
                dropdown.classList.add('hidden');
                this.renderSidebar([]);
                // Cancel ongoing request
                if (currentSearchRequest) {
                    currentSearchRequest.abort();
                    currentSearchRequest = null;
                }
                return;
            }

            debounceTimer = setTimeout(() => {
                // Cancel previous request if still running
                if (currentSearchRequest) {
                    currentSearchRequest.abort();
                }

                // Backend API URL from config
                const BACKEND_URL = window.APP_CONFIG.BACKEND_URL;
                const controller = new AbortController();
                currentSearchRequest = controller;

                fetch(`${BACKEND_URL}/api/search?q=${encodeURIComponent(query)}`, {
                    signal: controller.signal,
                    headers: { 'Accept': 'application/json' }
                })
                    .then(res => {
                        if (!res.ok) throw new Error(`HTTP ${res.status}`);
                        return res.json();
                    })
                    .then(data => {
                        this.renderSidebar(data);
                        dropdown.classList.remove('hidden');
                        currentSearchRequest = null;
                    })
                    .catch(err => {
                        if (err.name !== 'AbortError') {
                            console.error('Search error:', err);
                            this.renderSidebar([]);
                            dropdown.classList.remove('hidden');
                            const list = document.getElementById('parcelList');
                            list.innerHTML = '<div class="text-center p-8 text-red-500"><i data-lucide="wifi-off" class="w-12 h-12 mx-auto mb-3 opacity-50"></i><p class="text-sm">Erreur de connexion. Vérifiez votre réseau.</p></div>';
                            lucide.createIcons();
                        }
                        currentSearchRequest = null;
                    });
            }, 400); // Increased to 400ms for better performance
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
                document.getElementById('searchResultsDropdown').classList.add('hidden');
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

    async fetchWithRetry(url, retries = 3, delay = 1000) {
        for (let i = 0; i < retries; i++) {
            try {
                const response = await fetch(url, {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json'
                    },
                    // Add timeout
                    signal: AbortSignal.timeout(10000) // 10 second timeout
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                return await response.json();
            } catch (err) {
                if (i === retries - 1) throw err;
                console.warn(`Fetch attempt ${i + 1} failed, retrying...`, err);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    },

    fetchAndShowDetails(id) {
        // INSTANT PANEL: Show panel immediately with loading skeleton
        this.openPanelWithLoading(id);

        // Backend API URL from config
        const BACKEND_URL = window.APP_CONFIG.BACKEND_URL;

        // Fetch data in background and populate when ready
        this.fetchWithRetry(`${BACKEND_URL}/api/parcels/${id}`)
            .then(feature => {
                if (feature.error) {
                    this.closePanel();
                    alert('Erreur: ' + feature.error);
                    return;
                }

                // Fly to location with optimized animation (non-blocking)
                if (feature.geometry && feature.properties.centroid) {
                    const coords = feature.properties.centroid.coordinates;
                    this.map.flyTo({
                        center: coords,
                        zoom: 19,
                        pitch: 60,
                        duration: 1200,
                        essential: true
                    });
                }

                // Populate panel with actual data
                this.populatePanel(feature);
            })
            .catch(err => {
                console.error('Error fetching details:', err);
                this.closePanel();
                alert('Impossible de charger les détails. Vérifiez votre connexion Internet et réessayez.\n\nErreur: ' + err.message);
            });
    },

    openPanelWithLoading(id) {
        // Show panel instantly with loading skeleton
        const panel = document.getElementById('detailPanel');

        // Set basic info
        document.getElementById('panelTitle').innerText = `Parcelle #${id}`;

        // Show loading skeleton in content area
        const contentArea = document.getElementById('panelContentLeft');
        contentArea.innerHTML = `
            <div class="animate-pulse space-y-4">
                <div class="h-6 bg-slate-200 rounded w-3/4"></div>
                <div class="h-32 bg-slate-200 rounded"></div>
                <div class="h-6 bg-slate-200 rounded w-1/2"></div>
                <div class="h-24 bg-slate-200 rounded"></div>
            </div>
        `;

        // Loading placeholders for images
        document.getElementById('panelPhotoRecto').src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300'%3E%3Crect fill='%23e2e8f0' width='400' height='300'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%2394a3b8' font-family='sans-serif' font-size='16'%3EChargement...%3C/text%3E%3C/svg%3E";
        document.getElementById('panelPhotoVerso').src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300'%3E%3Crect fill='%23e2e8f0' width='400' height='300'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%2394a3b8' font-family='sans-serif' font-size='16'%3EChargement...%3C/text%3E%3C/svg%3E";

        // Hide conflict alert initially
        document.getElementById('conflictAlert').classList.add('hidden');

        // Slide in panel
        panel.classList.remove('translate-x-full');
    },

    closePanel() {
        const panel = document.getElementById('detailPanel');
        if (panel) {
            panel.classList.add('translate-x-full');
        }
    },

    populatePanel(feature) {
        // Populate panel with actual data
        requestAnimationFrame(() => {
            const p = feature.properties;
            document.getElementById('panelTitle').innerText = p.num_parcel || p.id;

            // Status Badge
            const statusColor = this.colors[p.status] || this.colors['unknown'];
            const statusBadge = document.getElementById('panelStatus');
            statusBadge.innerText = p.status || 'Inconnu';
            statusBadge.style.backgroundColor = statusColor + '20';
            statusBadge.style.color = statusColor;

            // Workflow Visualizer - update the circles inside step2 and step3
            const step2 = document.getElementById('step2');
            const step3 = document.getElementById('step3');

            if (step2) {
                const step2Circle = step2.querySelector('div');
                step2Circle.className = "w-10 h-10 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center mb-1 shadow-sm transition-colors";
                step2Circle.innerHTML = '<span class="text-xs font-bold">2</span>';

                if (p.status === 'NICAD' || p.status === 'deliberee' || p.status === 'approuvee' || p.status === 'Approved') {
                    step2Circle.className = "w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center mb-1 shadow-sm";
                    step2Circle.innerHTML = '<i data-lucide="check" class="w-5 h-5"></i>';
                }
            }

            if (step3) {
                const step3Circle = step3.querySelector('div');
                step3Circle.className = "w-10 h-10 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center mb-1 shadow-sm transition-colors";
                step3Circle.innerHTML = '<span class="text-xs font-bold">3</span>';

                if (p.status === 'approuvee' || p.status === 'Approved') {
                    step3Circle.className = "w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center mb-1 shadow-sm";
                    step3Circle.innerHTML = '<i data-lucide="check" class="w-5 h-5"></i>';
                }
            }

            lucide.createIcons();

            // Individual vs Collective
            const contentArea = document.getElementById('panelContentLeft');
            contentArea.innerHTML = '';
            if (p.type === 'individual') {
                contentArea.innerHTML = `
                <h3 class="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                    <i data-lucide="user" class="w-4 h-4"></i> Propriétaire / Occupant
                </h3>
                <div class="bg-slate-50 p-4 rounded-lg border border-slate-100 mb-4">
                    <p class="text-lg font-semibold text-slate-800">${p.prenom || ''} ${p.nom || ''}</p>
                    <div class="grid grid-cols-2 gap-3 mt-3 text-sm">
                        <div class="bg-white p-2 rounded border border-slate-200">
                            <span class="block text-slate-400 text-xs mb-1">Téléphone</span>
                            <span class="font-medium text-slate-800">${p.telephone || '--'}</span>
                        </div>
                        <div class="bg-white p-2 rounded border border-slate-200">
                            <span class="block text-slate-400 text-xs mb-1">Superficie</span>
                            <span class="font-bold text-lg text-navy">${p.superficie_reelle ? parseFloat(p.superficie_reelle).toFixed(2) : (p.surface || 0)} m²</span>
                        </div>
                        <div class="col-span-2 bg-white p-2 rounded border border-slate-200">
                            <span class="block text-slate-400 text-xs mb-1">Vocation</span>
                            <span class="font-medium text-slate-800 break-words">${p.vocation || p.vocation_1 || '--'}</span>
                        </div>
                    </div>
                </div>
                <h3 class="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                    <i data-lucide="map-pin" class="w-4 h-4"></i> Localisation
                </h3>
                <div class="bg-slate-50 p-4 rounded-lg border border-slate-100 mb-4 grid grid-cols-2 gap-2 text-sm">
                    <div><span class="text-slate-400 text-xs block">Région</span> <span class="font-medium">${p.region || '--'}</span></div>
                    <div><span class="text-slate-400 text-xs block">Département</span> <span class="font-medium">${p.department || '--'}</span></div>
                    <div><span class="text-slate-400 text-xs block">Arrondissement</span> <span class="font-medium">${p.arrondissement || '--'}</span></div>
                    <div><span class="text-slate-400 text-xs block">Commune</span> <span class="font-medium">${p.commune || '--'}</span></div>
                    <div class="col-span-2"><span class="text-slate-400 text-xs block">Village</span> <span class="font-medium break-words">${p.village || '--'}</span></div>
                </div>
                <h3 class="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2 mt-6">
                    <i data-lucide="file-check" class="w-4 h-4"></i> Données Techniques
                </h3>
                <div class="bg-slate-50 p-4 rounded-lg border border-slate-100 space-y-2 mb-4">
                    <div class="flex justify-between text-sm"><span class="text-slate-500">NICAD</span><span class="font-mono font-bold text-indigo-600">${p.nicad || 'En attente'}</span></div>
                    <div class="flex justify-between text-sm"><span class="text-slate-500">N° Délibération</span><span class="font-medium">${p.n_deliberation || '--'}</span></div>
                    <div class="flex justify-between text-sm"><span class="text-slate-500">N° Approbation</span><span class="font-medium">${p.n_approbation || '--'}</span></div>
                </div>
                <h3 class="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2 mt-6">Détails Supplémentaires</h3>
                <div class="bg-slate-50 p-4 rounded-lg border border-slate-100 grid grid-cols-2 gap-2 text-sm">
                    <div><span class="text-slate-400 text-xs block">Sexe</span> ${p.sexe || '--'}</div>
                    <div><span class="text-slate-400 text-xs block">Date Naissance</span> ${p.date_naiss ? new Date(p.date_naiss).toLocaleDateString() : '--'}</div>
                    <div class="col-span-2"><span class="text-slate-400 text-xs block">CNI</span> ${p.num_piece || '--'}</div>
                    <div class="col-span-2"><span class="text-slate-400 text-xs block">Lieu Naissance</span> ${p.lieu_naiss || '--'}</div>
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

                contentArea.innerHTML = `
                <h3 class="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                    <i data-lucide="users" class="w-4 h-4"></i> Parcelle Collective
                </h3>
                <div class="bg-slate-50 p-4 rounded-lg border border-slate-100 mb-4">
                    <p class="text-lg font-semibold text-slate-800 mb-3">Groupement / Collectif</p>
                    <div class="grid grid-cols-2 gap-3 text-sm">
                        <div class="bg-white p-2 rounded border border-slate-200">
                            <span class="block text-slate-400 text-xs mb-1">Nombre d'affectataires</span>
                            <span class="font-bold text-lg text-navy">${p.nombre_affectata || (p.beneficiaries ? p.beneficiaries.length : '--')}</span>
                        </div>
                        <div class="bg-white p-2 rounded border border-slate-200">
                            <span class="block text-slate-400 text-xs mb-1">Superficie</span>
                            <span class="font-bold text-lg text-navy">${p.superficie_reelle ? parseFloat(p.superficie_reelle).toFixed(2) : (p.surface || 0)} m²</span>
                        </div>
                        <div class="col-span-2 bg-white p-2 rounded border border-slate-200">
                            <span class="block text-slate-400 text-xs mb-1">Vocation</span>
                            <span class="font-medium text-slate-800">${p.vocation || p.vocation_1 || '--'}</span>
                        </div>
                    </div>
                </div>
                <h3 class="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                    <i data-lucide="map-pin" class="w-4 h-4"></i> Localisation
                </h3>
                <div class="bg-slate-50 p-4 rounded-lg border border-slate-100 mb-4 grid grid-cols-2 gap-2 text-sm">
                    <div><span class="text-slate-400 text-xs block">Région</span> <span class="font-medium">${p.region || '--'}</span></div>
                    <div><span class="text-slate-400 text-xs block">Département</span> <span class="font-medium">${p.department || '--'}</span></div>
                    <div><span class="text-slate-400 text-xs block">Arrondissement</span> <span class="font-medium">${p.arrondissement || '--'}</span></div>
                    <div><span class="text-slate-400 text-xs block">Commune</span> <span class="font-medium">${p.commune || '--'}</span></div>
                    <div class="col-span-2"><span class="text-slate-400 text-xs block">Village</span> <span class="font-medium break-words">${p.village || '--'}</span></div>
                </div>
                <h3 class="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                    <i data-lucide="file-check" class="w-4 h-4"></i> Données Techniques
                </h3>
                <div class="bg-slate-50 p-4 rounded-lg border border-slate-100 space-y-2 mb-4">
                    <div class="flex justify-between text-sm"><span class="text-slate-500">NICAD</span><span class="font-mono font-bold text-indigo-600">${p.nicad || 'En attente'}</span></div>
                    <div class="flex justify-between text-sm"><span class="text-slate-500">N° Délibération</span><span class="font-medium">${p.n_deliberation || '--'}</span></div>
                    <div class="flex justify-between text-sm"><span class="text-slate-500">N° Approbation</span><span class="font-medium">${p.n_approbation || '--'}</span></div>
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
                document.getElementById('panelPhotoRecto').src = p.mandataries[0].photo_rec_url || "https://placehold.co/600x400?text=Non+Disponible";
                document.getElementById('panelPhotoVerso').src = p.mandataries[0].photo_ver_url || "https://placehold.co/600x400?text=Non+Disponible";
            } else {
                document.getElementById('panelPhotoRecto').src = p.photo_rec_url || "https://placehold.co/600x400?text=Non+Disponible";
                document.getElementById('panelPhotoVerso').src = p.photo_ver_url || "https://placehold.co/600x400?text=Non+Disponible";
            }
            // Conflict
            const alertBox = document.getElementById('conflictAlert');
            if (p.conflict) {
                alertBox.classList.remove('hidden');
                document.getElementById('panelConflictText').innerText = p.conflict_reason || "Conflit signalé";
            } else {
                alertBox.classList.add('hidden');
            }

            // Panel already visible and positioned, just update icons
            lucide.createIcons();
        }); // End requestAnimationFrame
    },

    closePanel() {
        const panel = document.getElementById('detailPanel');
        if (panel) {
            panel.classList.add('translate-x-full');
        }
    },

    exportData() {
        alert("L'export complet n'est pas disponible en mode 3D (Performance). Veuillez contacter l'administrateur pour un export base de données.");
    }
};

// Start App
window.onload = () => app.init();
