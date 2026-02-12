/* =====================================================
   SIF BOUNDOU — Géoportail Foncier
   Complete Application (Map, Search, Details, Auth,
   Geometry Editing, Export)
   ===================================================== */

window.app = {
    map: null,
    draw: null,
    currentStyle: 'osm',
    is3D: false,
    colorByType: false,
    adminToken: null,
    editingParcel: null,
    originalGeometry: null,
    currentParcelData: null,

    visibleLayers: {
        'Survey': true, 'NICAD': true,
        'deliberee': true, 'approuvee': true,
        'individual': true, 'collective': true
    },

    colors: {
        'Survey': '#eab308', 'NICAD': '#3b82f6',
        'deliberee': '#8b5cf6', 'approuvee': '#10b981',
        'Approved': '#10b981', 'unknown': '#94a3b8'
    },

    styles: {
        'osm': {
            version: 8,
            sources: { osm: { type: 'raster', tiles: ['https://a.tile.openstreetmap.org/{z}/{x}/{y}.png', 'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256, maxzoom: 19 } },
            layers: [{ id: 'osm', type: 'raster', source: 'osm', minzoom: 0, maxzoom: 19 }]
        },
        'satellite': {
            version: 8,
            sources: { satellite: { type: 'raster', tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'], tileSize: 256, maxzoom: 22 } },
            layers: [{ id: 'satellite', type: 'raster', source: 'satellite', minzoom: 0, maxzoom: 22 }]
        },
        'google-satellite': {
            version: 8,
            sources: { 'google-satellite': { type: 'raster', tiles: ['https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}'], tileSize: 256, maxzoom: 22 } },
            layers: [{ id: 'google-satellite', type: 'raster', source: 'google-satellite', minzoom: 0, maxzoom: 22 }]
        }
    },

    // ======================= INIT =======================
    init() {
        this.BACKEND = window.APP_CONFIG.BACKEND_URL;
        this.adminToken = localStorage.getItem('sif_admin_token');
        this.updateAdminUI();

        this.map = new maplibregl.Map({
            container: 'map',
            style: this.styles['osm'],
            center: window.APP_CONFIG.MAP_CENTER,
            zoom: window.APP_CONFIG.MAP_ZOOM,
            pitch: 0,
            bearing: -17.6,
            antialias: true,
            dragRotate: true,
            touchPitch: true,
            maxPitch: 85,
            minZoom: 0,
            maxZoom: 22
        });

        this.map.addControl(new maplibregl.NavigationControl({
            showCompass: true, showZoom: true, visualizePitch: true
        }), 'top-left');

        this.map.on('load', () => {
            this.addLayers();
            this.setupInteractions();
            this.updateLayers();
            this.fetchStats();
        });

        this.map.on('sourcedata', (e) => {
            if (e.sourceId === 'parcels-source' && e.isSourceLoaded) {
                const el = document.getElementById('loadingOverlay');
                if (el) { el.style.transition = 'opacity .5s'; el.style.opacity = '0'; setTimeout(() => el.classList.add('hidden'), 500); }
            }
        });

        this.map.on('error', (e) => {
            if (e.error) {
                const msg = e.error.message || '';
                const suppress = ['fetch', 'tile', 'NetworkError', 'AbortError'];
                if (!suppress.some(s => msg.includes(s))) console.error('Map error:', e.error);
            }
        });

        this.map.on('styledata', () => {
            if (!this.map.getSource('parcels-source')) this.addLayers();
            this.updateLegend();
            lucide.createIcons();
        });

        this.setupSearch();
        this.setupModals();
        this.updateLegend();
        lucide.createIcons();
    },

    // ======================= STATS =======================
    async fetchStats() {
        try {
            const data = await this.fetchJSON(`${this.BACKEND}/api/stats`);
            document.getElementById('statTotal').textContent = this.formatNum(data.total);
            document.getElementById('statSurvey').textContent = this.formatNum(data.survey);
            document.getElementById('statNicad').textContent = this.formatNum(data.nicad);
            document.getElementById('statDeliberee').textContent = this.formatNum(data.deliberee);
            document.getElementById('statApprouvee').textContent = this.formatNum(data.approuvee);
        } catch (e) {
            console.warn('Stats fetch failed:', e);
        }
    },

    formatNum(n) {
        if (!n && n !== 0) return '--';
        return Number(n).toLocaleString('fr-FR');
    },

    filterByStatus(status) {
        if (status === 'all') {
            Object.keys(this.visibleLayers).forEach(k => this.visibleLayers[k] = true);
        } else {
            // Toggle solo mode
            const allSame = Object.entries(this.visibleLayers).every(([k, v]) => {
                if (this.colorByType) return true;
                return k === status ? v : !v;
            });

            if (allSame) {
                Object.keys(this.visibleLayers).forEach(k => this.visibleLayers[k] = true);
            } else {
                if (!this.colorByType) {
                    Object.keys(this.visibleLayers).forEach(k => this.visibleLayers[k] = (k === status));
                }
            }
        }
        this.applyLayerFilters();
        this.updateLegend();
    },

    // ======================= LAYERS =======================
    tileVersion: 0,  // cache-bust counter

    addLayers() {
        if (this.map.getSource('parcels-source')) return;

        const tileUrl = `${this.BACKEND}/api/tiles/{z}/{x}/{y}` + (this.tileVersion ? `?_v=${this.tileVersion}` : '');
        this.map.addSource('parcels-source', {
            type: 'vector',
            tiles: [tileUrl],
            minzoom: 0, maxzoom: 22, scheme: 'xyz', tileSize: 512, buffer: 64, tolerance: 3.5
        });

        const colorExpr = this.getColorExpr();

        this.map.addLayer({
            id: 'parcels-3d', type: 'fill-extrusion', source: 'parcels-source', 'source-layer': 'parcels',
            paint: {
                'fill-extrusion-color': colorExpr,
                'fill-extrusion-height': 0,
                'fill-extrusion-base': 0,
                'fill-extrusion-opacity': 0.8
            }
        });

        this.map.addLayer({
            id: 'parcels-outline', type: 'line', source: 'parcels-source', 'source-layer': 'parcels',
            paint: {
                'line-color': '#000',
                'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.5, 14, 1, 18, 2],
                'line-opacity': 0.8
            }
        });

        this.map.addLayer({
            id: 'parcels-highlight', type: 'fill-extrusion', source: 'parcels-source', 'source-layer': 'parcels',
            paint: { 'fill-extrusion-color': '#4f46e5', 'fill-extrusion-height': 0, 'fill-extrusion-base': 0, 'fill-extrusion-opacity': 0.9 },
            filter: ['==', 'id', '']
        });
    },

    getColorExpr() {
        if (this.colorByType) {
            return ['match', ['get', 'type'], 'individual', '#10b981', 'collective', '#f59e0b', '#94a3b8'];
        }
        return ['match', ['get', 'status'], 'Survey', '#eab308', 'NICAD', '#3b82f6', 'deliberee', '#8b5cf6', 'approuvee', '#10b981', 'Approved', '#10b981', '#f97316'];
    },

    updateLayers() {
        if (!this.map.getLayer('parcels-3d')) return;
        this.map.setPaintProperty('parcels-3d', 'fill-extrusion-color', this.getColorExpr());
        if (this.is3D) {
            this.map.setPaintProperty('parcels-3d', 'fill-extrusion-height', [
                'case',
                ['any', ['in', 'habitat', ['downcase', ['coalesce', ['get', 'type_usag'], '']]]],
                ['+', 10, ['%', ['to-number', ['get', 'id']], 21]], 0
            ]);
            if (this.map.getLayer('parcels-outline')) this.map.setLayoutProperty('parcels-outline', 'visibility', 'none');
        } else {
            this.map.setPaintProperty('parcels-3d', 'fill-extrusion-height', 0);
            if (this.map.getLayer('parcels-outline')) this.map.setLayoutProperty('parcels-outline', 'visibility', 'visible');
        }
        this.applyLayerFilters();
    },

    applyLayerFilters() {
        if (!this.map.getLayer('parcels-3d')) return;
        let filter = null;
        if (this.colorByType) {
            const vis = [];
            if (this.visibleLayers.individual) vis.push('individual');
            if (this.visibleLayers.collective) vis.push('collective');
            filter = vis.length === 0 ? ['==', 'type', '__none__'] : vis.length < 2 ? ['in', ['get', 'type'], ['literal', vis]] : null;
        } else {
            const vis = [];
            if (this.visibleLayers.Survey) vis.push('Survey');
            if (this.visibleLayers.NICAD) vis.push('NICAD');
            if (this.visibleLayers.deliberee) vis.push('deliberee');
            if (this.visibleLayers.approuvee) { vis.push('approuvee'); vis.push('Approved'); }
            filter = vis.length === 0 ? ['==', 'status', '__none__'] : vis.length >= 5 ? null : ['in', ['get', 'status'], ['literal', vis]];
        }
        this.map.setFilter('parcels-3d', filter);
        if (this.map.getLayer('parcels-outline')) this.map.setFilter('parcels-outline', filter);
    },

    // ======================= INTERACTIONS =======================
    setupInteractions() {
        let clickLock = false;
        this.map.on('mouseenter', 'parcels-3d', () => { this.map.getCanvas().style.cursor = 'pointer'; });
        this.map.on('mouseleave', 'parcels-3d', () => { this.map.getCanvas().style.cursor = ''; });

        this.map.on('click', 'parcels-3d', (e) => {
            if (clickLock || this.editingParcel) return;
            if (e.features && e.features.length > 0) {
                clickLock = true;
                setTimeout(() => clickLock = false, 500);
                const id = e.features[0].properties.id;
                requestAnimationFrame(() => {
                    if (this.map.getLayer('parcels-highlight')) this.map.setFilter('parcels-highlight', ['==', 'id', id]);
                });
                this.fetchAndShowDetails(id);
            }
        });
    },

    // ======================= MAP CONTROLS =======================
    switchBasemap(name) {
        if (this.currentStyle === name) return;
        this.currentStyle = name;
        this.map.setStyle(this.styles[name]);
        this.map.once('styledata', () => this.addLayers());
    },

    toggle3D() {
        this.is3D = !this.is3D;
        this.map.easeTo({ pitch: this.is3D ? 45 : 0, duration: 800 });
        this.updateLayers();
        const btn = document.getElementById('btn3D');
        if (btn) btn.classList.toggle('active', this.is3D);
    },

    toggleColorMode() {
        this.colorByType = !this.colorByType;
        this.updateLayers();
        this.updateLegend();
    },

    resetView() {
        this.map.easeTo({ bearing: -17.6, pitch: this.is3D ? 45 : 0, center: window.APP_CONFIG.MAP_CENTER, zoom: window.APP_CONFIG.MAP_ZOOM, duration: 1000 });
    },

    // ======================= LEGEND =======================
    updateLegend() {
        const el = document.getElementById('legendContent');
        if (!el) return;
        const items = this.colorByType
            ? [{ key: 'individual', color: '#10b981', label: 'Individuel' }, { key: 'collective', color: '#f59e0b', label: 'Collectif' }]
            : [{ key: 'Survey', color: '#eab308', label: 'Enquêtée' }, { key: 'NICAD', color: '#3b82f6', label: 'NICAD' }, { key: 'deliberee', color: '#8b5cf6', label: 'Délibérée' }, { key: 'approuvee', color: '#10b981', label: 'Approuvée' }];

        el.innerHTML = items.map(i => `
            <div class="legend-item ${this.visibleLayers[i.key] ? '' : 'off'}" onclick="app.toggleLayer('${i.key}')">
                <span class="ldot" style="background:${i.color};"></span>
                <span>${i.label}</span>
            </div>
        `).join('');
    },

    toggleLayer(key) {
        this.visibleLayers[key] = !this.visibleLayers[key];
        this.updateLegend();
        this.applyLayerFilters();
    },

    // ======================= SEARCH =======================
    setupSearch() {
        const input = document.getElementById('searchInput');
        const dropdown = document.getElementById('searchDropdown');
        let timer, controller;

        document.addEventListener('click', (e) => {
            if (!input.contains(e.target) && !dropdown.contains(e.target)) dropdown.classList.remove('active');
        });

        input.addEventListener('focus', () => {
            if (input.value.trim().length >= 2) dropdown.classList.add('active');
        });

        input.addEventListener('input', () => {
            clearTimeout(timer);
            const q = input.value.trim();
            if (q.length < 2) { dropdown.classList.remove('active'); return; }

            timer = setTimeout(async () => {
                if (controller) controller.abort();
                controller = new AbortController();
                try {
                    const data = await this.fetchJSON(`${this.BACKEND}/api/search?q=${encodeURIComponent(q)}`, { signal: controller.signal });
                    this.renderSearchResults(data);
                    dropdown.classList.add('active');
                } catch (e) {
                    if (e.name !== 'AbortError') {
                        document.getElementById('searchResults').innerHTML = '<div class="text-center p-4" style="color:var(--danger);font-size:.82rem;">Erreur de connexion</div>';
                        dropdown.classList.add('active');
                    }
                }
            }, 400);
        });
    },

    renderSearchResults(results) {
        const el = document.getElementById('searchResults');
        if (!results || results.length === 0) {
            el.innerHTML = '<div class="text-center p-4" style="color:#94a3b8;font-size:.82rem;">Aucun résultat</div>';
            return;
        }
        el.innerHTML = results.map(r => {
            const color = this.colors[r.status] || this.colors.unknown;
            return `
            <div style="padding:10px 12px;border-radius:10px;cursor:pointer;border:1px solid #e2e8f0;margin-bottom:4px;transition:all .15s;"
                 onmouseover="this.style.background='#f8fafc';this.style.borderColor='var(--primary)'"
                 onmouseout="this.style.background='';this.style.borderColor='#e2e8f0'"
                 onclick="app.fetchAndShowDetails(${r.id});document.getElementById('searchDropdown').classList.remove('active');">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                    <span style="font-weight:700;font-size:.88rem;color:#1e293b;">${this.esc(r.num_parcel || r.id)}</span>
                    <span style="font-size:.6rem;font-weight:700;color:#fff;padding:2px 8px;border-radius:999px;background:${color};text-transform:uppercase;">${this.esc(r.status || 'Inconnu')}</span>
                </div>
                <div style="font-size:.78rem;color:#64748b;">${this.esc(r.owner_name || '--')}</div>
                <div style="font-size:.7rem;color:#94a3b8;margin-top:4px;">NICAD: ${this.esc(r.nicad || '--')}</div>
            </div>`;
        }).join('');
    },

    // ======================= DETAIL PANEL =======================
    async fetchAndShowDetails(id) {
        this.openPanel(id);
        if (this.map.getLayer('parcels-highlight')) this.map.setFilter('parcels-highlight', ['==', 'id', parseInt(id)]);

        try {
            const feature = await this.fetchWithRetry(`${this.BACKEND}/api/parcels/${id}`);
            if (feature.error) { this.showPanelError(feature.error); return; }
            this.currentParcelData = feature;

            if (feature.geometry && feature.properties.centroid && feature.properties.centroid.coordinates) {
                const c = feature.properties.centroid.coordinates;
                if (c && c.length >= 2) {
                    this.map.flyTo({ center: [c[0] - 0.001, c[1]], zoom: 17, pitch: this.is3D ? 45 : 0, duration: 800 });
                }
            }
            this.populatePanel(feature);
        } catch (e) {
            console.error('Detail fetch error:', e);
            this.showPanelError('Impossible de charger les détails.');
        }
    },

    openPanel(id) {
        document.getElementById('panelTitle').textContent = `#${id}`;
        document.getElementById('panelBody').innerHTML = `
            <div style="padding:20px 0;">
                <div class="skeleton" style="height:20px;width:75%;margin-bottom:12px;"></div>
                <div class="skeleton" style="height:100px;margin-bottom:12px;"></div>
                <div class="skeleton" style="height:20px;width:50%;margin-bottom:12px;"></div>
                <div class="skeleton" style="height:80px;"></div>
            </div>`;
        document.getElementById('detailPanel').classList.add('open');
        // Show edit geometry button if admin
        const editBtn = document.getElementById('btnEditGeometry');
        if (editBtn) editBtn.classList.toggle('hidden', !this.adminToken);
    },

    closePanel() {
        document.getElementById('detailPanel').classList.remove('open');
        this.currentParcelData = null;
        if (this.map.getLayer('parcels-highlight')) this.map.setFilter('parcels-highlight', ['==', 'id', '']);
    },

    showPanelError(msg) {
        document.getElementById('panelBody').innerHTML = `
            <div style="padding:16px;border-radius:12px;background:#fef2f2;border:1px solid #fecaca;color:#991b1b;">
                <div style="font-weight:600;margin-bottom:6px;">Erreur</div>
                <div style="font-size:.85rem;">${this.esc(msg)}</div>
            </div>`;
    },

    populatePanel(feature) {
        const p = feature.properties;
        document.getElementById('panelTitle').textContent = p.num_parcel || `#${p.id}`;

        // Status Badge
        const badge = document.getElementById('panelStatusBadge');
        const statusText = (p.status || 'Inconnu');
        badge.textContent = statusText.charAt(0).toUpperCase() + statusText.slice(1);
        badge.className = 'status-badge ' + ({
            approuvee: 'sb-approuvee', Approved: 'sb-approuvee',
            deliberee: 'sb-deliberee', NICAD: 'sb-nicad', Survey: 'sb-survey'
        }[p.status] || 'sb-default');

        // Workflow
        const isNicad = ['NICAD', 'deliberee', 'approuvee', 'Approved'].includes(p.status);
        const isApproved = ['approuvee', 'Approved'].includes(p.status);
        const wf2 = document.getElementById('wf2');
        const wf3 = document.getElementById('wf3');
        const wfLine1 = document.getElementById('wfLine1');
        const wfLine2 = document.getElementById('wfLine2');

        wf2.className = 'wf-circle' + (isNicad ? ' done' : '');
        wf2.innerHTML = isNicad ? '<i data-lucide="check" style="width:16px;height:16px;"></i>' : '2';
        wf3.className = 'wf-circle' + (isApproved ? ' done' : '');
        wf3.innerHTML = isApproved ? '<i data-lucide="check" style="width:16px;height:16px;"></i>' : '3';
        wfLine1.className = 'wf-line' + (isNicad ? ' done' : '');
        wfLine2.className = 'wf-line' + (isApproved ? ' done' : '');

        // Content
        const body = document.getElementById('panelBody');
        if (p.type === 'individual') {
            body.innerHTML = this.renderIndividualDetails(p);
        } else if (p.type === 'collective') {
            body.innerHTML = this.renderCollectiveDetails(p);
        } else {
            body.innerHTML = this.renderBasicDetails(p);
        }

        // Photos
        const photoSection = this.renderPhotos(p);
        body.innerHTML += photoSection;

        // Conflict
        if (p.conflict) {
            body.innerHTML = `
                <div class="conflict-box" style="margin-bottom:14px;">
                    <div style="width:40px;height:40px;border-radius:50%;background:#fee2e2;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                        <i data-lucide="alert-triangle" style="width:20px;height:20px;color:#ef4444;"></i>
                    </div>
                    <div>
                        <div style="font-weight:700;color:#991b1b;font-size:.88rem;">Conflit Signalé</div>
                        <div style="font-size:.82rem;color:#b91c1c;margin-top:4px;">${this.esc(p.conflict_reason || 'Conflit signalé')}</div>
                    </div>
                </div>` + body.innerHTML;
        }

        // Edit geometry button handler
        const editBtn = document.getElementById('btnEditGeometry');
        if (editBtn) {
            editBtn.classList.toggle('hidden', !this.adminToken);
            editBtn.onclick = () => this.startGeometryEdit(feature);
        }

        lucide.createIcons();
    },

    renderIndividualDetails(p) {
        return `
        <div class="card">
            <div class="card-title"><i data-lucide="user" style="width:14px;height:14px;"></i> Propriétaire / Occupant</div>
            <div style="font-size:1.1rem;font-weight:700;color:#1e293b;margin-bottom:14px;">${this.esc(p.prenom || '')} ${this.esc(p.nom || '')}</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                <div class="field"><div class="field-label">Téléphone</div><div class="field-value">${this.esc(p.telephone || '--')}</div></div>
                <div class="field field-hl"><div class="field-label">Superficie</div><div class="field-value" style="font-size:1.1rem;font-weight:800;color:var(--success);">${this.fmtArea(p.superficie_reelle || p.surface)}</div><span style="font-size:.65rem;color:#64748b;">m²</span></div>
            </div>
            <div class="field" style="margin-top:10px;"><div class="field-label">Vocation</div><div class="field-value">${this.esc(p.vocation || '--')}</div></div>
        </div>
        ${this.renderLocationCard(p)}
        ${this.renderTechnicalCard(p)}
        <div class="card">
            <div class="card-title"><i data-lucide="id-card" style="width:14px;height:14px;"></i> Détails Personnels</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                <div class="field"><div class="field-label">Sexe</div><div class="field-value">${this.esc(p.sexe || '--')}</div></div>
                <div class="field"><div class="field-label">Date de naissance</div><div class="field-value">${p.date_naiss ? new Date(p.date_naiss).toLocaleDateString('fr-FR') : '--'}</div></div>
            </div>
            <div class="field" style="margin-top:10px;"><div class="field-label">N° CNI</div><div class="field-value" style="font-family:monospace;">${this.esc(p.num_piece || '--')}</div></div>
            <div class="field" style="margin-top:10px;"><div class="field-label">Lieu de naissance</div><div class="field-value">${this.esc(p.lieu_naiss || '--')}</div></div>
        </div>`;
    },

    renderCollectiveDetails(p) {
        const firstM = (p.mandataries || [])[0] || {};
        const mandName = `${firstM.prenom || ''} ${firstM.nom || ''}`.trim() || 'Groupement';
        const area = p.superficie_reelle || p.surface || '';
        const tel = firstM.telephone || '--';

        const mandHtml = (p.mandataries || []).map(m => `
            <div style="background:#f8fafc;padding:14px;border-radius:10px;border:1px solid #e2e8f0;margin-bottom:8px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                    <span style="font-weight:700;">${this.esc(m.prenom || '')} ${this.esc(m.nom || '')}</span>
                    <span style="font-size:.6rem;background:var(--primary);color:#fff;padding:2px 8px;border-radius:999px;font-weight:600;">${this.esc(m.typ_per || 'Mandataire')}</span>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:.8rem;">
                    <div class="field"><div class="field-label">Sexe</div><div class="field-value">${this.esc(m.sexe || '--')}</div></div>
                    <div class="field"><div class="field-label">Téléphone</div><div class="field-value">${this.esc(m.telephone || '--')}</div></div>
                </div>
            </div>`).join('');

        const beneHtml = (p.beneficiaries || []).map((b, i) => `
            <div style="background:#f8fafc;padding:12px;border-radius:10px;border:1px solid #e2e8f0;margin-bottom:8px;">
                <div style="font-weight:600;font-size:.85rem;margin-bottom:6px;"><span style="color:var(--primary);">${i + 1}.</span> ${this.esc(b.prenom || '')} ${this.esc(b.nom || '')}</div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:.78rem;">
                    <div class="field"><div class="field-label">Date nais.</div><div class="field-value">${b.date_naiss ? new Date(b.date_naiss).toLocaleDateString('fr-FR') : '--'}</div></div>
                    <div class="field"><div class="field-label">N° Pièce</div><div class="field-value" style="font-family:monospace;">${this.esc(b.num_piece || '--')}</div></div>
                </div>
            </div>`).join('');

        return `
        <div class="card">
            <div class="card-title"><i data-lucide="users" style="width:14px;height:14px;"></i> Mandataire Principal</div>
            <div style="font-size:1.1rem;font-weight:700;margin-bottom:14px;">${this.esc(mandName)}</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                <div class="field" style="background:linear-gradient(135deg,#eef2ff,#e0e7ff);border-color:#c7d2fe;">
                    <div class="field-label">Affectataires</div>
                    <div class="field-value" style="font-size:1.2rem;font-weight:800;color:var(--primary);">${p.nombre_affectata || (p.beneficiaries ? p.beneficiaries.length : '--')}</div>
                </div>
                <div class="field field-hl"><div class="field-label">Superficie</div><div class="field-value" style="font-size:1.1rem;font-weight:800;color:var(--success);">${this.fmtArea(area)}</div><span style="font-size:.65rem;color:#64748b;">m²</span></div>
            </div>
            <div class="field" style="margin-top:10px;"><div class="field-label">Téléphone</div><div class="field-value">${this.esc(tel)}</div></div>
            <div class="field" style="margin-top:10px;"><div class="field-label">Vocation</div><div class="field-value">${this.esc(p.vocation || '--')}</div></div>
        </div>
        ${this.renderLocationCard(p)}
        ${this.renderTechnicalCard(p)}
        <div class="card">
            <div class="card-title"><i data-lucide="user-check" style="width:14px;height:14px;"></i> Mandataires <span style="margin-left:auto;background:var(--primary-light);color:var(--primary-dark);font-size:.65rem;padding:2px 8px;border-radius:999px;">${(p.mandataries || []).length}</span></div>
            <div style="max-height:320px;overflow-y:auto;">${mandHtml || '<div style="text-align:center;color:#94a3b8;font-size:.82rem;padding:16px;">Aucun mandataire</div>'}</div>
        </div>
        <div class="card">
            <div class="card-title"><i data-lucide="users" style="width:14px;height:14px;"></i> Bénéficiaires <span style="margin-left:auto;background:#d1fae5;color:#065f46;font-size:.65rem;padding:2px 8px;border-radius:999px;">${(p.beneficiaries || []).length}</span></div>
            <div style="max-height:320px;overflow-y:auto;">${beneHtml || '<div style="text-align:center;color:#94a3b8;font-size:.82rem;padding:16px;">Aucun bénéficiaire</div>'}</div>
        </div>`;
    },

    renderBasicDetails(p) {
        return `${this.renderLocationCard(p)}${this.renderTechnicalCard(p)}`;
    },

    renderLocationCard(p) {
        return `
        <div class="card">
            <div class="card-title"><i data-lucide="map-pin" style="width:14px;height:14px;"></i> Localisation</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                <div class="field"><div class="field-label">Région</div><div class="field-value">${this.esc(p.region || '--')}</div></div>
                <div class="field"><div class="field-label">Département</div><div class="field-value">${this.esc(p.department || '--')}</div></div>
                <div class="field"><div class="field-label">Arrondissement</div><div class="field-value">${this.esc(p.arrondissement || '--')}</div></div>
                <div class="field"><div class="field-label">Commune</div><div class="field-value">${this.esc(p.commune || '--')}</div></div>
            </div>
            <div class="field" style="margin-top:10px;"><div class="field-label">Village</div><div class="field-value">${this.esc(p.village || '--')}</div></div>
        </div>`;
    },

    renderTechnicalCard(p) {
        return `
        <div class="card">
            <div class="card-title"><i data-lucide="file-check" style="width:14px;height:14px;"></i> Données Techniques</div>
            <div class="data-row"><span class="dlabel">NICAD</span><span class="dvalue mono">${this.esc(p.nicad || 'En attente')}</span></div>
            <div class="data-row"><span class="dlabel">N° Délibération</span><span class="dvalue">${this.esc(p.n_deliberation || '--')}</span></div>
            <div class="data-row"><span class="dlabel">N° Approbation</span><span class="dvalue">${this.esc(p.n_approbation || '--')}</span></div>
        </div>`;
    },

    renderPhotos(p) {
        const placeholder = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300'%3E%3Crect fill='%23f1f5f9' width='400' height='300'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%2394a3b8' font-family='sans-serif' font-size='14'%3ENon disponible%3C/text%3E%3C/svg%3E";
        let recto = p.photo_rec_url || placeholder;
        let verso = p.photo_ver_url || placeholder;
        if (p.type === 'collective' && p.mandataries && p.mandataries.length > 0) {
            recto = p.mandataries[0].photo_rec_url || placeholder;
            verso = p.mandataries[0].photo_ver_url || placeholder;
        }
        return `
        <div class="card">
            <div class="card-title"><i data-lucide="image" style="width:14px;height:14px;"></i> Documents</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                <div class="photo-card"><img src="${recto}" alt="CNI Recto" onerror="this.src='${placeholder}'"><div class="plabel">CNI Recto</div></div>
                <div class="photo-card"><img src="${verso}" alt="CNI Verso" onerror="this.src='${placeholder}'"><div class="plabel">CNI Verso</div></div>
            </div>
        </div>`;
    },

    // ======================= GEOMETRY EDITING =======================
    startGeometryEdit(feature) {
        if (!this.adminToken) { this.openLoginModal(() => this.startGeometryEdit(feature)); return; }
        if (!feature || !feature.geometry) { this.toast('Pas de géométrie à modifier', 'error'); return; }

        this.editingParcel = feature;
        this.originalGeometry = JSON.parse(JSON.stringify(feature.geometry));

        // Close the detail panel & hide stats bar
        this.closePanel();
        document.getElementById('statsBar').style.display = 'none';

        // Show edit toolbar
        document.getElementById('editToolbar').classList.remove('hidden');
        const saveBtn = document.getElementById('btnSaveGeometry');
        if (saveBtn) saveBtn.disabled = false;
        lucide.createIcons();

        // Hide parcel layers so only Draw shows
        ['parcels-3d', 'parcels-outline', 'parcels-highlight'].forEach(l => {
            if (this.map.getLayer(l)) this.map.setLayoutProperty(l, 'visibility', 'none');
        });

        // Initialize MapboxDraw with QGIS-like green styling
        this.draw = new MapboxDraw({
            displayControlsDefault: false,
            controls: {},
            defaultMode: 'simple_select',
            styles: [
                // ---- Polygon fill (semitransparent green) ----
                {
                    id: 'gl-draw-polygon-fill-active', type: 'fill',
                    filter: ['all', ['==', '$type', 'Polygon'], ['!=', 'mode', 'static']],
                    paint: { 'fill-color': '#22c55e', 'fill-opacity': 0.12, 'fill-outline-color': '#22c55e' }
                },
                {
                    id: 'gl-draw-polygon-fill-static', type: 'fill',
                    filter: ['all', ['==', '$type', 'Polygon'], ['==', 'mode', 'static']],
                    paint: { 'fill-color': '#16a34a', 'fill-opacity': 0.08, 'fill-outline-color': '#16a34a' }
                },
                // ---- Polygon outline (solid green) ----
                {
                    id: 'gl-draw-polygon-stroke-active', type: 'line',
                    filter: ['all', ['==', '$type', 'Polygon'], ['!=', 'mode', 'static']],
                    layout: { 'line-cap': 'round', 'line-join': 'round' },
                    paint: { 'line-color': '#16a34a', 'line-width': 2.5 }
                },
                {
                    id: 'gl-draw-polygon-stroke-static', type: 'line',
                    filter: ['all', ['==', '$type', 'Polygon'], ['==', 'mode', 'static']],
                    layout: { 'line-cap': 'round', 'line-join': 'round' },
                    paint: { 'line-color': '#16a34a', 'line-width': 2, 'line-dasharray': [3, 2] }
                },
                // ---- Line (for LineString edits) ----
                {
                    id: 'gl-draw-line', type: 'line',
                    filter: ['all', ['==', '$type', 'LineString'], ['!=', 'mode', 'static']],
                    layout: { 'line-cap': 'round', 'line-join': 'round' },
                    paint: { 'line-color': '#16a34a', 'line-width': 2.5 }
                },
                // ---- Vertices (green squares — QGIS style accrochages) ----
                {
                    id: 'gl-draw-point-vertex-active', type: 'circle',
                    filter: ['all', ['==', 'meta', 'vertex'], ['==', '$type', 'Point'], ['!=', 'mode', 'static']],
                    paint: {
                        'circle-radius': 6,
                        'circle-color': '#22c55e',
                        'circle-stroke-color': '#fff',
                        'circle-stroke-width': 2.5
                    }
                },
                // ---- Selected vertex (brighter, larger) ----
                {
                    id: 'gl-draw-point-vertex-selected', type: 'circle',
                    filter: ['all', ['==', 'meta', 'vertex'], ['==', '$type', 'Point'], ['==', 'active', 'true']],
                    paint: {
                        'circle-radius': 8,
                        'circle-color': '#4ade80',
                        'circle-stroke-color': '#166534',
                        'circle-stroke-width': 3
                    }
                },
                // ---- Midpoints (small green dots — add-vertex handles) ----
                {
                    id: 'gl-draw-point-midpoint', type: 'circle',
                    filter: ['all', ['==', 'meta', 'midpoint'], ['==', '$type', 'Point']],
                    paint: {
                        'circle-radius': 4,
                        'circle-color': '#86efac',
                        'circle-stroke-color': '#16a34a',
                        'circle-stroke-width': 1.5
                    }
                },
                // ---- Feature point (for point features) ----
                {
                    id: 'gl-draw-point', type: 'circle',
                    filter: ['all', ['==', '$type', 'Point'], ['==', 'meta', 'feature'], ['!=', 'mode', 'static']],
                    paint: {
                        'circle-radius': 5,
                        'circle-color': '#22c55e',
                        'circle-stroke-color': '#fff',
                        'circle-stroke-width': 2
                    }
                }
            ]
        });

        this.map.addControl(this.draw);

        // Add the parcel geometry to draw
        const drawFeature = {
            type: 'Feature',
            geometry: JSON.parse(JSON.stringify(feature.geometry)),
            properties: {}
        };
        const ids = this.draw.add(drawFeature);
        this._drawFeatureId = (ids && ids.length > 0) ? ids[0] : null;

        // Enter direct_select mode to show vertices immediately
        if (this._drawFeatureId) {
            setTimeout(() => {
                try {
                    this.draw.changeMode('direct_select', { featureId: this._drawFeatureId });
                } catch (e) { console.warn('Could not enter direct_select:', e); }
            }, 100);
        }

        // Fly to the feature at editing zoom
        if (feature.properties.centroid && feature.properties.centroid.coordinates) {
            const c = feature.properties.centroid.coordinates;
            this.map.flyTo({ center: c, zoom: 18, pitch: 0, bearing: 0, duration: 800 });
        }

        // Setup save/cancel handlers
        document.getElementById('btnSaveGeometry').onclick = () => this.saveGeometryEdit();
        document.getElementById('btnCancelEdit').onclick = () => this.cancelGeometryEdit();

        this.toast('Mode édition activé — Déplacez les sommets verts pour corriger la géométrie', 'info');
    },

    async saveGeometryEdit() {
        if (!this.draw || !this.editingParcel) {
            console.warn('saveGeometryEdit: no draw or editingParcel');
            return;
        }

        // Get all features from draw
        let allFeatures;
        try {
            allFeatures = this.draw.getAll();
        } catch (e) {
            console.error('draw.getAll() failed:', e);
            this.toast('Erreur lors de la récupération de la géométrie', 'error');
            return;
        }

        if (!allFeatures || !allFeatures.features || allFeatures.features.length === 0) {
            this.toast('Aucune géométrie à sauvegarder', 'error');
            return;
        }

        const editedGeometry = allFeatures.features[0].geometry;
        const parcelId = this.editingParcel.properties.id;

        if (!editedGeometry || !editedGeometry.coordinates || editedGeometry.coordinates.length === 0) {
            this.toast('Géométrie invalide', 'error');
            return;
        }

        // Disable save button to prevent double-click
        const saveBtn = document.getElementById('btnSaveGeometry');
        if (saveBtn) saveBtn.disabled = true;

        try {
            this.toast('Sauvegarde en cours...', 'info');
            console.log('Saving geometry for parcel', parcelId, '- type:', editedGeometry.type, '- coords length:', editedGeometry.coordinates.length);

            const response = await fetch(`${this.BACKEND}/api/parcels/${parcelId}/geometry`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.adminToken}`
                },
                body: JSON.stringify({ geometry: editedGeometry })
            });

            let data;
            try {
                data = await response.json();
            } catch (e) {
                throw new Error(`Réponse serveur invalide (status ${response.status})`);
            }

            if (!response.ok) {
                if (response.status === 401) {
                    this.adminToken = null;
                    localStorage.removeItem('sif_admin_token');
                    this.updateAdminUI();
                    this.toast('Session expirée. Reconnectez-vous.', 'error');
                    this.cancelGeometryEdit();
                    return;
                }
                throw new Error(data.error || `Erreur serveur (${response.status})`);
            }

            console.log('Geometry saved successfully:', data);
            this.toast('Géométrie sauvegardée avec succès !', 'success');

            // Clean up draw mode
            this.cancelGeometryEdit();

            // Force tile reload: bump version, remove layers/source, re-add
            this.tileVersion = Date.now();
            this.reloadTiles();

        } catch (err) {
            console.error('Save geometry error:', err);
            this.toast(`Erreur: ${err.message}`, 'error');
            if (saveBtn) saveBtn.disabled = false;
        }
    },

    reloadTiles() {
        // Remove existing layers and source
        ['parcels-highlight', 'parcels-outline', 'parcels-3d'].forEach(l => {
            if (this.map.getLayer(l)) this.map.removeLayer(l);
        });
        if (this.map.getSource('parcels-source')) this.map.removeSource('parcels-source');

        // Re-add with cache-busted tile URL
        this.addLayers();
        this.updateLayers();
        // Make sure layers are visible
        ['parcels-3d', 'parcels-outline'].forEach(l => {
            if (this.map.getLayer(l)) this.map.setLayoutProperty(l, 'visibility', 'visible');
        });
    },

    cancelGeometryEdit() {
        // Remove draw control
        if (this.draw) {
            try { this.map.removeControl(this.draw); } catch (e) { console.warn('removeControl error:', e); }
            this.draw = null;
        }
        this._drawFeatureId = null;
        this.editingParcel = null;
        this.originalGeometry = null;

        // Restore UI
        document.getElementById('editToolbar').classList.add('hidden');
        document.getElementById('statsBar').style.display = '';

        // Show parcel layers again
        ['parcels-3d', 'parcels-outline'].forEach(l => {
            if (this.map.getLayer(l)) this.map.setLayoutProperty(l, 'visibility', 'visible');
        });
    },

    // ======================= AUTH =======================
    setupModals() {
        // Export button
        document.getElementById('btnExport').onclick = () => this.openExportModal();

        // Admin button
        document.getElementById('btnAdmin').onclick = () => {
            if (this.adminToken) return; // already logged in
            this.openLoginModal();
        };

        // Admin logout
        document.getElementById('btnAdminLogout').onclick = () => this.doLogout();

        // Export status toggles
        document.querySelectorAll('#exportStatusGroup .check-item').forEach(el => {
            el.onclick = () => el.classList.toggle('active');
        });

        // Export format toggles (single select)
        document.querySelectorAll('#exportFormatGroup .check-item').forEach(el => {
            el.onclick = () => {
                document.querySelectorAll('#exportFormatGroup .check-item').forEach(e => e.classList.remove('active'));
                el.classList.add('active');
            };
        });

        // Login on Enter
        document.getElementById('loginPassword').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.doLogin();
        });
    },

    openLoginModal(callback) {
        this._loginCallback = callback || null;
        document.getElementById('loginModal').classList.remove('hidden');
        document.getElementById('loginError').classList.add('hidden');
        document.getElementById('loginUsername').value = '';
        document.getElementById('loginPassword').value = '';
        document.getElementById('loginUsername').focus();
        lucide.createIcons();
    },

    closeLoginModal() {
        document.getElementById('loginModal').classList.add('hidden');
        this._loginCallback = null;
    },

    async doLogin() {
        const username = document.getElementById('loginUsername').value.trim();
        const password = document.getElementById('loginPassword').value;
        const errorEl = document.getElementById('loginError');

        if (!username || !password) {
            errorEl.textContent = 'Veuillez remplir tous les champs.';
            errorEl.classList.remove('hidden');
            return;
        }

        try {
            const btn = document.getElementById('loginBtn');
            btn.disabled = true;
            btn.textContent = 'Connexion...';

            const res = await fetch(`${this.BACKEND}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await res.json();

            if (!res.ok) {
                errorEl.textContent = data.error || 'Identifiants incorrects.';
                errorEl.classList.remove('hidden');
                btn.disabled = false;
                btn.textContent = 'Se connecter';
                return;
            }

            this.adminToken = data.token;
            localStorage.setItem('sif_admin_token', data.token);
            this.updateAdminUI();
            this.closeLoginModal();
            this.toast(`Connecté en tant que ${data.username}`, 'success');

            if (this._loginCallback) {
                this._loginCallback();
                this._loginCallback = null;
            }

            btn.disabled = false;
            btn.textContent = 'Se connecter';
        } catch (e) {
            errorEl.textContent = 'Erreur de connexion au serveur.';
            errorEl.classList.remove('hidden');
            document.getElementById('loginBtn').disabled = false;
            document.getElementById('loginBtn').textContent = 'Se connecter';
        }
    },

    doLogout() {
        this.adminToken = null;
        localStorage.removeItem('sif_admin_token');
        this.updateAdminUI();
        this.toast('Déconnecté', 'info');
    },

    updateAdminUI() {
        const btnAdmin = document.getElementById('btnAdmin');
        const btnLogout = document.getElementById('btnAdminLogout');
        const editBtn = document.getElementById('btnEditGeometry');

        if (this.adminToken) {
            btnAdmin.classList.add('hidden');
            btnLogout.classList.remove('hidden');
            if (editBtn && this.currentParcelData) editBtn.classList.remove('hidden');
        } else {
            btnAdmin.classList.remove('hidden');
            btnLogout.classList.add('hidden');
            if (editBtn) editBtn.classList.add('hidden');
        }
    },

    // ======================= EXPORT =======================
    openExportModal() {
        document.getElementById('exportModal').classList.remove('hidden');
        lucide.createIcons();
    },

    closeExportModal() {
        document.getElementById('exportModal').classList.add('hidden');
    },

    async doExport() {
        const statuses = [];
        document.querySelectorAll('#exportStatusGroup .check-item.active').forEach(el => {
            statuses.push(el.dataset.status);
        });

        const formatEl = document.querySelector('#exportFormatGroup .check-item.active');
        const format = formatEl ? formatEl.dataset.format : 'geojson';

        if (statuses.length === 0) {
            this.toast('Sélectionnez au moins un statut', 'error');
            return;
        }

        this.closeExportModal();
        this.toast('Export en cours...', 'info');

        try {
            const url = `${this.BACKEND}/api/export?status=${statuses.join(',')}&format=${format}`;
            const res = await fetch(url);
            if (!res.ok) throw new Error('Export failed');
            const data = await res.json();

            if (format === 'xlsx') {
                // Convert to Excel using SheetJS
                const ws_data = [['ID', 'Num Parcelle', 'NICAD', 'Statut', 'Type', 'Usage', 'Superficie', 'Propriétaire']];
                data.features.forEach(f => {
                    const p = f.properties;
                    ws_data.push([p.id, p.num_parcel, p.nicad, p.status, p.type, p.type_usag, p.superficie, p.owner_name]);
                });
                const wb = XLSX.utils.book_new();
                const ws = XLSX.utils.aoa_to_sheet(ws_data);
                XLSX.utils.book_append_sheet(wb, ws, 'Parcelles');
                XLSX.writeFile(wb, `parcels_${statuses.join('_')}_${new Date().toISOString().split('T')[0]}.xlsx`);
            } else {
                // Download as GeoJSON
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/geo+json' });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = `parcels_${statuses.join('_')}_${new Date().toISOString().split('T')[0]}.geojson`;
                link.click();
                URL.revokeObjectURL(link.href);
            }

            this.toast(`${data.features.length} parcelles exportées avec succès`, 'success');
        } catch (e) {
            console.error('Export error:', e);
            this.toast('Erreur lors de l\'export', 'error');
        }
    },

    // ======================= UTILS =======================
    async fetchJSON(url, opts = {}) {
        const res = await fetch(url, { headers: { 'Accept': 'application/json' }, ...opts });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
    },

    async fetchWithRetry(url, retries = 3) {
        for (let i = 0; i < retries; i++) {
            try {
                const res = await fetch(url, {
                    headers: { 'Accept': 'application/json' },
                    signal: typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(10000) : undefined
                });
                if (!res.ok) { const t = await res.text(); throw new Error(`HTTP ${res.status}: ${t.slice(0, 200)}`); }
                return await res.json();
            } catch (e) {
                if (i === retries - 1) throw e;
                await new Promise(r => setTimeout(r, 1000));
            }
        }
    },

    esc(val) {
        return String(val || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    },

    fmtArea(val) {
        if (!val && val !== 0) return '--';
        return parseFloat(val).toFixed(2);
    },

    toast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        const icon = type === 'success' ? 'check-circle' : type === 'error' ? 'alert-circle' : 'info';
        toast.innerHTML = `<i data-lucide="${icon}" style="width:18px;height:18px;flex-shrink:0;"></i><span>${this.esc(message)}</span>`;
        container.appendChild(toast);
        lucide.createIcons();
        requestAnimationFrame(() => toast.classList.add('show'));
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 350);
        }, 4000);
    }
};

// Start
window.onload = () => app.init();
