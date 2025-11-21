// Configuration
const API_URL = 'http://localhost:4000/api';

// Status colors for map styling
const STATUS_COLORS = {
    'Survey': '#3498db',
    'NICAD': '#f39c12',
    'Approved': '#27ae60'
};

// Global state
let map;
let parcelsLayer;
let allParcels = null;
let selectedParcel = null;
let detailPanel;
let closePanelBtn;

// Initialize map
function initMap() {
    // Create map centered on Senegal (Boundou region)
    map = L.map('map').setView([12.5, -12.5], 10);

    // Add OpenStreetMap tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(map);

    // Add legend
    addLegend();

    // Initialize parcels layer
    parcelsLayer = L.geoJSON(null, {
        style: styleFeature,
        onEachFeature: onEachFeature
    }).addTo(map);
}

// Style function for parcels
function styleFeature(feature) {
    const status = feature.properties.status || 'Survey';
    const color = STATUS_COLORS[status] || '#95a5a6';
    
    return {
        fillColor: color,
        weight: 2,
        opacity: 1,
        color: color,
        fillOpacity: 0.4
    };
}

// Add interactivity to each feature
function onEachFeature(feature, layer) {
    // Popup
    const props = feature.properties;
    const popupContent = `
        <div style="min-width: 200px;">
            <h3 style="margin: 0 0 10px 0;">${props.num_parcel || 'N/A'}</h3>
            <p><strong>Statut:</strong> ${props.status || 'N/A'}</p>
            <p><strong>Type:</strong> ${props.type || 'N/A'}</p>
            <p><strong>Village:</strong> ${props.village || 'N/A'}</p>
            ${props.nicad ? `<p><strong>NICAD:</strong> ${props.nicad}</p>` : ''}
            ${props.superficie ? `<p><strong>Superficie:</strong> ${props.superficie} ha</p>` : ''}
        </div>
    `;
    
    layer.bindPopup(popupContent);

    // Click handler
    layer.on('click', function() {
        selectParcel(feature);
        
        // Zoom to parcel
        if (feature.geometry) {
            const bounds = layer.getBounds();
            map.fitBounds(bounds, { padding: [50, 50] });
        }
    });

    // Hover effect
    layer.on('mouseover', function() {
        layer.setStyle({
            weight: 4,
            fillOpacity: 0.7
        });
    });

    layer.on('mouseout', function() {
        layer.setStyle({
            weight: 2,
            fillOpacity: 0.4
        });
    });
}

// Add legend to map
function addLegend() {
    const legend = L.control({ position: 'bottomright' });

    legend.onAdd = function() {
        const div = L.DomUtil.create('div', 'legend');
        div.innerHTML = `
            <h4>Statut de Formalisation</h4>
            <div class="legend-item">
                <div class="legend-color" style="background: ${STATUS_COLORS.Survey}"></div>
                <span>Enquête</span>
            </div>
            <div class="legend-item">
                <div class="legend-color" style="background: ${STATUS_COLORS.NICAD}"></div>
                <span>NICAD</span>
            </div>
            <div class="legend-item">
                <div class="legend-color" style="background: ${STATUS_COLORS.Approved}"></div>
                <span>Approuvé</span>
            </div>
        `;
        return div;
    };

    legend.addTo(map);
}

// Fetch parcels from API
async function fetchParcels(filters = {}) {
    try {
        showLoading();

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

        // Update map
        parcelsLayer.clearLayers();
        parcelsLayer.addData(data);

        // Fit map to bounds if parcels exist
        if (data.features && data.features.length > 0) {
            const bounds = parcelsLayer.getBounds();
            map.fitBounds(bounds, { padding: [50, 50] });
        }

        hideLoading();
        return data;

    } catch (error) {
        console.error('Error fetching parcels:', error);
        showError('Erreur de chargement des parcelles. Vérifiez que le serveur backend est démarré.');
        hideLoading();
    }
}

// Select a parcel and show details
async function selectParcel(feature) {
    selectedParcel = feature;
    const props = feature.properties;
    
    // Fetch full details from API
    try {
        showLoading();
        const response = await fetch(`${API_URL}/parcels/${props.num_parcel}`);
        if (response.ok) {
            const detailData = await response.json();
            displayParcelDetails(detailData.properties);
        } else {
            displayParcelDetails(props);
        }
        hideLoading();
    } catch (error) {
        console.error('Error fetching parcel details:', error);
        displayParcelDetails(props);
        hideLoading();
    }
}

// Display parcel details in sidebar, hiding null/empty fields
function displayParcelDetails(props) {
    // Show the floating panel
    if (detailPanel) {
        detailPanel.classList.remove('hidden');
    }

    const surveyData = props.survey_data || {};

    const safe = (v) => (v === null || v === undefined || v === '' ? null : v);

    let html = `
        <div class="parcel-card">
            <div class="parcel-header">
                <div>
                    <div class="parcel-id">${safe(props.num_parcel) || 'N/A'}</div>
                    <div class="parcel-subtitle">Parcelle ${props.type || 'N/A'}</div>
                </div>
                <div class="parcel-tags">
                    <span class="status-badge status-${(props.status || 'survey').toLowerCase()}">
                        ${props.status || 'Survey'}
                    </span>
                </div>
            </div>
    `;

    // For collective parcels, show mandataire info at the top
    if (props.type === 'collective' && props.mandataries && props.mandataries.length > 0) {
        const mand = props.mandataries[0];
        html += `
            <div class="detail-item">
                <div class="detail-label">Mandataire</div>
                <div class="detail-value">
                    <strong>${safe(mand.prenom) || ''} ${safe(mand.nom) || ''}</strong><br>
                    ${safe(mand.sexe) ? `Sexe: ${mand.sexe}<br>` : ''}
                    ${safe(mand.date_naiss) ? `Naissance: ${mand.date_naiss}<br>` : ''}
                    ${safe(mand.telephone) ? `Téléphone: ${mand.telephone}<br>` : ''}
                    ${safe(mand.num_piece) ? `N° Pièce: ${mand.num_piece}<br>` : ''}
                </div>
            </div>
        `;
    }

    html += ``

    // Localisation block - show all fields separately
    if (safe(props.region)) {
        html += `
            <div class="detail-item">
                <div class="detail-label">Région</div>
                <div class="detail-value">${props.region}</div>
            </div>
        `;
    }
    if (safe(props.commune)) {
        html += `
            <div class="detail-item">
                <div class="detail-label">Commune</div>
                <div class="detail-value">${props.commune}</div>
            </div>
        `;
    }
    if (safe(props.village)) {
        html += `
            <div class="detail-item">
                <div class="detail-label">Village</div>
                <div class="detail-value">${props.village}</div>
            </div>
        `;
    }

    // Survey data - individual
    if (props.type === 'individual' && safe(surveyData.prenom)) {
        html += `
            <div class="detail-item">
                <div class="detail-label">Propriétaire</div>
                <div class="detail-value">${surveyData.prenom || ''} ${surveyData.nom || ''}</div>
            </div>
        `;

        if (safe(surveyData.sexe)) {
            html += `
                <div class="detail-item">
                    <div class="detail-label">Sexe</div>
                    <div class="detail-value">${surveyData.sexe}</div>
                </div>
            `;
        }
        if (safe(surveyData.date_naiss)) {
            html += `
                <div class="detail-item">
                    <div class="detail-label">Date de naissance</div>
                    <div class="detail-value">${surveyData.date_naiss}</div>
                </div>
            `;
        }
        if (safe(surveyData.telephone)) {
            html += `
                <div class="detail-item">
                    <div class="detail-label">Téléphone</div>
                    <div class="detail-value">${surveyData.telephone}</div>
                </div>
            `;
        }
        if (safe(surveyData.vocation)) {
            html += `
                <div class="detail-item">
                    <div class="detail-label">Vocation</div>
                    <div class="detail-value">${surveyData.vocation}</div>
                </div>
            `;
        }
        if (safe(surveyData.type_usag)) {
            html += `
                <div class="detail-item">
                    <div class="detail-label">Type d'usage</div>
                    <div class="detail-value">${surveyData.type_usag}</div>
                </div>
            `;
        }
        if (safe(surveyData.syst_cultu)) {
            html += `
                <div class="detail-item">
                    <div class="detail-label">Système de culture</div>
                    <div class="detail-value">${surveyData.syst_cultu}</div>
                </div>
            `;
        }
        if (safe(surveyData.superficie_declaree)) {
            html += `
                <div class="detail-item">
                    <div class="detail-label">Superficie déclarée</div>
                    <div class="detail-value">${surveyData.superficie_declaree} m²</div>
                </div>
            `;
        }
        if (safe(surveyData.superficie_reelle)) {
            html += `
                <div class="detail-item">
                    <div class="detail-label">Superficie réelle</div>
                    <div class="detail-value">${surveyData.superficie_reelle} m²</div>
                </div>
            `;
        }
    }

    if (props.type === 'collective' && safe(surveyData.nombre_affectata)) {
        html += `
            <div class="detail-item">
                <div class="detail-label">Nombre de bénéficiaires</div>
                <div class="detail-value">${surveyData.nombre_affectata}</div>
            </div>
        `;
        if (safe(surveyData.vocation)) {
            html += `
                <div class="detail-item">
                    <div class="detail-label">Vocation</div>
                    <div class="detail-value">${surveyData.vocation}</div>
                </div>
            `;
        }
        if (safe(surveyData.type_usag)) {
            html += `
                <div class="detail-item">
                    <div class="detail-label">Type d'usage</div>
                    <div class="detail-value">${surveyData.type_usag}</div>
                </div>
            `;
        }
        if (safe(surveyData.syst_cultu)) {
            html += `
                <div class="detail-item">
                    <div class="detail-label">Système de culture</div>
                    <div class="detail-value">${surveyData.syst_cultu}</div>
                </div>
            `;
        }
        if (safe(surveyData.superficie_declaree)) {
            html += `
                <div class="detail-item">
                    <div class="detail-label">Superficie déclarée</div>
                    <div class="detail-value">${surveyData.superficie_declaree} m²</div>
                </div>
            `;
        }
        if (safe(surveyData.superficie_reelle)) {
            html += `
                <div class="detail-item">
                    <div class="detail-label">Superficie réelle</div>
                    <div class="detail-value">${surveyData.superficie_reelle} m²</div>
                </div>
            `;
        }

        // Display beneficiaries with full details
        if (props.beneficiaries && props.beneficiaries.length > 0) {
            html += `
                <div class="detail-item">
                    <div class="detail-label">Bénéficiaires (${props.beneficiaries.length})</div>
                    <div class="detail-value">
            `;
            props.beneficiaries.forEach((ben, idx) => {
                html += `
                    <div style="padding: 10px; background: rgba(52, 73, 94, 0.5); border-radius: 6px; margin-bottom: 8px;">
                        <strong>${idx + 1}. ${safe(ben.prenom) || ''} ${safe(ben.nom) || ''}</strong><br>
                        ${safe(ben.sexe) ? `Sexe: ${ben.sexe}<br>` : ''}
                        ${safe(ben.date_naiss) ? `Naissance: ${ben.date_naiss}<br>` : ''}
                        ${safe(ben.num_piece) ? `N° Pièce: ${ben.num_piece}<br>` : ''}
                `;
                
                // Show photos if available
                if (safe(ben.photo_rec_url) || safe(ben.photo_ver_url)) {
                    html += `<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-top: 6px;">`;
                    if (safe(ben.photo_rec_url)) {
                        html += `<img src="${ben.photo_rec_url}" alt="Photo recto" style="width: 100%; border-radius: 4px; cursor: pointer;" onclick="window.open('${ben.photo_rec_url}', '_blank')">`;
                    }
                    if (safe(ben.photo_ver_url)) {
                        html += `<img src="${ben.photo_ver_url}" alt="Photo verso" style="width: 100%; border-radius: 4px; cursor: pointer;" onclick="window.open('${ben.photo_ver_url}', '_blank')">`;
                    }
                    html += `</div>`;
                }
                
                html += `
                    </div>
                `;
            });
            html += `
                    </div>
                </div>
            `;
        }

        // Display additional mandataries if more than one
        if (props.mandataries && props.mandataries.length > 1) {
            html += `
                <div class="detail-item">
                    <div class="detail-label">Autres Mandataires (${props.mandataries.length - 1})</div>
                    <div class="detail-value">
            `;
            props.mandataries.slice(1).forEach((mand, idx) => {
                html += `
                    <div style="padding: 10px; background: rgba(52, 73, 94, 0.5); border-radius: 6px; margin-bottom: 8px;">
                        <strong>${idx + 2}. ${safe(mand.prenom) || ''} ${safe(mand.nom) || ''}</strong><br>
                        ${safe(mand.sexe) ? `Sexe: ${mand.sexe}<br>` : ''}
                        ${safe(mand.date_naiss) ? `Naissance: ${mand.date_naiss}<br>` : ''}
                        ${safe(mand.telephone) ? `Téléphone: ${mand.telephone}<br>` : ''}
                        ${safe(mand.num_piece) ? `N° Pièce: ${mand.num_piece}<br>` : ''}
                    </div>
                `;
            });
            html += `
                    </div>
                </div>
            `;
        }
    }

    // NICAD info
    if (safe(props.nicad)) {
        html += `
            <div class="detail-item">
                <div class="detail-label">NICAD</div>
                <div class="detail-value">${props.nicad}</div>
            </div>
        `;
    }

    if (safe(props.id_sif)) {
        html += `
            <div class="detail-item">
                <div class="detail-label">ID SIF</div>
                <div class="detail-value">${props.id_sif}</div>
            </div>
        `;
    }

    if (safe(props.superficie)) {
        html += `
            <div class="detail-item">
                <div class="detail-label">Superficie</div>
                <div class="detail-value">${props.superficie} ha</div>
            </div>
        `;
    }

    // Approval info
    if (safe(props.n_deliberation)) {
        html += `
            <div class="detail-item">
                <div class="detail-label">N° Délibération</div>
                <div class="detail-value">${props.n_deliberation}</div>
            </div>
        `;
    }

    if (safe(props.n_approbation)) {
        html += `
            <div class="detail-item">
                <div class="detail-label">N° Approbation</div>
                <div class="detail-value">${props.n_approbation}</div>
            </div>
        `;
    }

    // Photos
    if (safe(surveyData.photo_rec_url) || safe(surveyData.photo_ver_url)) {
        html += `
            <div class="detail-item">
                <div class="detail-label">Photos</div>
                <div class="photo-gallery">
        `;
        
        if (safe(surveyData.photo_rec_url)) {
            html += `<img src="${surveyData.photo_rec_url}" alt="Photo recto" onclick="window.open('${surveyData.photo_rec_url}', '_blank')">`;
        }
        
        if (safe(surveyData.photo_ver_url)) {
            html += `<img src="${surveyData.photo_ver_url}" alt="Photo verso" onclick="window.open('${surveyData.photo_ver_url}', '_blank')">`;
        }
        
        html += `
                </div>
            </div>
        `;
    }

    // Additional survey data
    if (safe(surveyData.vocation)) {
        html += `
            <div class="detail-item">
                <div class="detail-label">Vocation</div>
                <div class="detail-value">${surveyData.vocation}</div>
            </div>
        `;
    }

    if (safe(surveyData.superficie_reelle)) {
        html += `
            <div class="detail-item">
                <div class="detail-label">Superficie Réelle</div>
                <div class="detail-value">${surveyData.superficie_reelle} ha</div>
            </div>
        `;
    }

    html += '</div>'; // close parcel-card
    document.getElementById('detailsContent').innerHTML = html;
}

// UI Helper functions
function showLoading() {
    const content = document.getElementById('detailsContent');
    content.innerHTML = `
        <div class="loading">
            <div class="spinner"></div>
            <p>Chargement des parcelles...</p>
        </div>
    `;
}

function hideLoading() {
    if (!selectedParcel) {
        document.getElementById('detailsContent').innerHTML = `
            <div class="no-selection">
                Cliquez sur une parcelle pour voir les détails
            </div>
        `;
    }
}

function showError(message) {
    const content = document.getElementById('detailsContent');
    content.innerHTML = `
        <div class="error-message">
            <strong>Erreur:</strong> ${message}
        </div>
    `;
}

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
    // Initialize DOM references
    detailPanel = document.getElementById('detailPanel');
    closePanelBtn = document.getElementById('closePanelBtn');

    // Initialize map
    initMap();

    // Load initial parcels
    fetchParcels();

    // Apply filters button
    document.getElementById('applyFilters').addEventListener('click', function() {
        const filters = {
            status: document.getElementById('statusFilter').value,
            type: document.getElementById('typeFilter').value,
            num_parcel: document.getElementById('searchInput').value.trim()
        };

        fetchParcels(filters);
    });

    // Reset filters button
    document.getElementById('resetFilters').addEventListener('click', function() {
        document.getElementById('statusFilter').value = '';
        document.getElementById('typeFilter').value = '';
        document.getElementById('searchInput').value = '';
        fetchParcels();
    });

    // Enter key on search input
    document.getElementById('searchInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            document.getElementById('applyFilters').click();
        }
    });

    // Close panel button
    if (closePanelBtn) {
        closePanelBtn.addEventListener('click', function() {
            detailPanel.classList.add('hidden');
            selectedParcel = null;
        });
    }
});
