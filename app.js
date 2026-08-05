// Territory Allocations Interactive Map Controller — Powered by MapTiler SDK
document.addEventListener('DOMContentLoaded', async () => {
  let mapData = null;
  let map = null;
  let currentSearchQuery = '';

  // Initial Selected Counties (11 counties from Colorado Metro area)
  const defaultSelectedCounties = new Set([
    'Adams', 'Arapahoe', 'Boulder', 'Broomfield', 'Denver',
    'Douglas', 'Jefferson', 'Larimer', 'Gilpin', 'El Paso', 'Weld'
  ]);

  let selectedCounties = new Set(defaultSelectedCounties);

  // DOM Elements
  const countyCheckboxListEl = document.getElementById('county-checkbox-list');
  const countySearchInputEl = document.getElementById('county-search-input');
  
  const sumCountiesEl = document.getElementById('sum-counties');
  const sumCasesEl = document.getElementById('sum-cases');
  const sumAttorneysEl = document.getElementById('sum-attorneys');
  const sumRevenueEl = document.getElementById('sum-revenue');
  const sumPopEl = document.getElementById('sum-pop');
  
  const selectedCountBadgeEl = document.getElementById('selected-count-badge');
  const badgeCountiesCountEl = document.getElementById('badge-counties-count');
  const legendSelectedCountEl = document.getElementById('legend-selected-count');
  
  const footCasesEl = document.getElementById('foot-cases');
  const footAttorneysEl = document.getElementById('foot-attorneys');
  const footRevenueEl = document.getElementById('foot-revenue');

  const btnSelectAll = document.getElementById('btn-select-all');
  const btnDeselectAll = document.getElementById('btn-deselect-all');
  const btnSaveAllocation = document.getElementById('btn-save-allocation');
  
  const btnNavHome = document.getElementById('btn-nav-home');
  const btnNavZoomIn = document.getElementById('btn-nav-zoom-in');
  const btnNavZoomOut = document.getElementById('btn-nav-zoom-out');
  const btnNavFullscreen = document.getElementById('btn-nav-fullscreen');
  
  const btnSettings = document.getElementById('btn-settings');
  const settingsModal = document.getElementById('settings-modal');
  const settingsClose = document.getElementById('settings-close');
  const btnSaveSettings = document.getElementById('btn-save-settings');
  const maptilerKeyInput = document.getElementById('maptiler-key-input');

  // Configured MapTiler API Key
  const activeKey = 'iEpWAIAAXgQoI8SOCPky';
  if (maptilerKeyInput) maptilerKeyInput.value = activeKey;
  maptilersdk.config.apiKey = activeKey;

  // Initialize MapTiler Vector Map
  function initMap() {
    map = new maptilersdk.Map({
      container: 'map',
      style: maptilersdk.MapStyle.DATAVIZ.LIGHT, // Light clean canvas background
      center: [-105.5, 39.0], // Centered over Colorado
      zoom: 6.8,
      navigationControl: false,
      geolocateControl: false,
      terrainControl: false,
      scaleControl: false
    });

    map.on('load', () => {
      fitToColorado();

      if (mapData) {
        setupCountyLayers();
      }
    });
  }

  function fitToColorado() {
    if (!map) return;
    map.fitBounds([
      [-109.06, 36.99], // SW Colorado [lng, lat]
      [-102.04, 41.00]  // NE Colorado [lng, lat]
    ], { padding: { top: 70, bottom: 40, left: 40, right: 40 } });
  }

  // Load Enriched Map Data JSON
  async function loadData() {
    try {
      const resp = await fetch('map_data.json');
      mapData = await resp.json();

      updateSummaryMetrics();
      renderCountyCheckboxList();

      if (map && map.isStyleLoaded()) {
        setupCountyLayers();
      }
    } catch (err) {
      console.error('Failed to load map_data.json:', err);
    }
  }

  // Setup Vector Polygon Layer for Counties
  function setupCountyLayers() {
    if (!mapData || !map || !mapData.counties_geojson) return;

    if (map.getLayer('county-fill-layer')) map.removeLayer('county-fill-layer');
    if (map.getLayer('county-border-layer')) map.removeLayer('county-border-layer');
    if (map.getLayer('county-symbol-layer')) map.removeLayer('county-symbol-layer');
    if (map.getSource('counties-source')) map.removeSource('counties-source');

    // Add Counties Vector Source
    map.addSource('counties-source', {
      type: 'geojson',
      data: getProcessedCountyGeoJSON()
    });

    // Polygon Fill Layer (Selected = Blue #3b82f6, Unselected = Light Gray #e5e7eb)
    map.addLayer({
      id: 'county-fill-layer',
      type: 'fill',
      source: 'counties-source',
      paint: {
        'fill-color': [
          'case',
          ['boolean', ['get', 'isSelected'], false],
          '#3b82f6',
          '#e5e7eb'
        ],
        'fill-opacity': 0.95
      }
    });

    // Polygon Outline Layer
    map.addLayer({
      id: 'county-border-layer',
      type: 'line',
      source: 'counties-source',
      paint: {
        'line-color': '#94a3b8',
        'line-width': 1.2
      }
    });

    // Label Points Source for clean vector text labels
    if (map.getSource('county-labels-source')) map.removeSource('county-labels-source');
    map.addSource('county-labels-source', {
      type: 'geojson',
      data: getCountyLabelsGeoJSON()
    });

    // Symbol Text Layer with MapTiler anti-collision
    map.addLayer({
      id: 'county-symbol-layer',
      type: 'symbol',
      source: 'county-labels-source',
      layout: {
        'text-field': ['concat', ['get', 'name'], '\n', ['to-string', ['get', 'zip_count']]],
        'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
        'text-size': 12,
        'text-allow-overlap': false,
        'text-ignore-placement': false
      },
      paint: {
        'text-color': [
          'case',
          ['boolean', ['get', 'isSelected'], false],
          '#ffffff',
          '#1e293b'
        ],
        'text-halo-color': [
          'case',
          ['boolean', ['get', 'isSelected'], false],
          'rgba(0, 0, 0, 0.3)',
          'rgba(255, 255, 255, 0.8)'
        ],
        'text-halo-width': 1
      }
    });

    // Map Click & Hover Listeners
    map.on('click', 'county-fill-layer', (e) => {
      if (e.features.length > 0) {
        const cName = e.features[0].properties.name;
        toggleCountySelection(cName);
      }
    });

    map.on('mousemove', 'county-fill-layer', () => {
      map.getCanvas().style.cursor = 'pointer';
    });

    map.on('mouseleave', 'county-fill-layer', () => {
      map.getCanvas().style.cursor = '';
    });
  }

  // GeoJSON with Selection properties for Fill Layer
  function getProcessedCountyGeoJSON() {
    if (!mapData || !mapData.counties_geojson) return { type: 'FeatureCollection', features: [] };

    const features = mapData.counties_geojson.features.map((f, idx) => {
      const feat = JSON.parse(JSON.stringify(f));
      feat.id = idx;
      feat.properties.isSelected = selectedCounties.has(feat.properties.name);
      return feat;
    });

    return {
      type: 'FeatureCollection',
      features: features
    };
  }

  // Label Points GeoJSON for Symbol Text Layer
  function getCountyLabelsGeoJSON() {
    if (!mapData || !mapData.counties_geojson) return { type: 'FeatureCollection', features: [] };

    const features = mapData.counties_geojson.features.map((f) => {
      const p = f.properties;
      return {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [p.center_lon, p.center_lat]
        },
        properties: {
          name: p.name,
          zip_count: p.zip_count,
          isSelected: selectedCounties.has(p.name)
        }
      };
    });

    return {
      type: 'FeatureCollection',
      features: features
    };
  }

  // Toggle County Selection
  function toggleCountySelection(countyName) {
    if (selectedCounties.has(countyName)) {
      selectedCounties.delete(countyName);
    } else {
      selectedCounties.add(countyName);
    }
    updateMapAndSidebar();
  }

  function updateMapAndSidebar() {
    updateSummaryMetrics();
    renderCountyCheckboxList();
    
    if (map && map.getSource('counties-source')) {
      map.getSource('counties-source').setData(getProcessedCountyGeoJSON());
    }
    if (map && map.getSource('county-labels-source')) {
      map.getSource('county-labels-source').setData(getCountyLabelsGeoJSON());
    }
  }

  // Render Checkbox List in Left Sidebar
  function renderCountyCheckboxList() {
    if (!mapData) return;
    countyCheckboxListEl.innerHTML = '';

    const sortedFeatures = [...mapData.counties_geojson.features].sort((a, b) => b.properties.zip_count - a.properties.zip_count);

    const filtered = sortedFeatures.filter(f => {
      if (!currentSearchQuery) return true;
      return f.properties.name.toLowerCase().includes(currentSearchQuery.toLowerCase());
    });

    filtered.forEach(f => {
      const cName = f.properties.name;
      const zCount = f.properties.zip_count;
      const isChecked = selectedCounties.has(cName);

      const item = document.createElement('div');
      item.className = 'county-cb-item';
      item.innerHTML = `
        <div class="cb-label-group">
          <input type="checkbox" id="cb-${cName}" ${isChecked ? 'checked' : ''}>
          <label for="cb-${cName}" style="cursor: pointer; font-weight: 500;">${cName}</label>
        </div>
        <span class="cb-count">${zCount > 0 ? zCount.toLocaleString() : '0'} Zips</span>
      `;

      item.addEventListener('click', (e) => {
        if (e.target.tagName !== 'INPUT') {
          const cb = item.querySelector('input');
          cb.checked = !cb.checked;
        }
        toggleCountySelection(cName);
      });

      countyCheckboxListEl.appendChild(item);
    });
  }

  // Calculate & Update Metrics strictly derived from Excel dataset
  function updateSummaryMetrics() {
    if (!mapData) return;

    const count = selectedCounties.size;
    const totalCounties = mapData.counties_geojson.features.length; // 64
    const totalZipsOverall = mapData.records.length; // 659
    
    let zipSum = 0;
    mapData.counties_geojson.features.forEach(f => {
      if (selectedCounties.has(f.properties.name)) {
        zipSum += f.properties.zip_count;
      }
    });

    const coveragePct = ((zipSum / totalZipsOverall) * 100).toFixed(1);

    // Update REAL Dataset Metrics in UI
    if (sumCountiesEl) sumCountiesEl.textContent = `${count} / ${totalCounties}`;
    if (sumCasesEl) sumCasesEl.textContent = `${zipSum.toLocaleString()} / ${totalZipsOverall}`;
    if (sumAttorneysEl) sumAttorneysEl.textContent = `${coveragePct}%`;
    if (sumRevenueEl) sumRevenueEl.textContent = 'Colorado area';
    if (sumPopEl) sumPopEl.textContent = 'Business - Litigation';

    if (selectedCountBadgeEl) selectedCountBadgeEl.textContent = count;
    if (badgeCountiesCountEl) badgeCountiesCountEl.textContent = `${count} Counties Selected`;
    if (legendSelectedCountEl) legendSelectedCountEl.textContent = count;

    if (footCasesEl) footCasesEl.textContent = `${zipSum.toLocaleString()} ZIP Codes`;
    if (footAttorneysEl) footAttorneysEl.textContent = `${count} Counties`;
    if (footRevenueEl) footRevenueEl.textContent = `Coverage: ${coveragePct}%`;
  }

  // Sidebar Controls
  countySearchInputEl.addEventListener('input', (e) => {
    currentSearchQuery = e.target.value.trim();
    renderCountyCheckboxList();
  });

  btnSelectAll.addEventListener('click', () => {
    if (!mapData) return;
    mapData.counties_geojson.features.forEach(f => selectedCounties.add(f.properties.name));
    updateMapAndSidebar();
  });

  btnDeselectAll.addEventListener('click', () => {
    selectedCounties.clear();
    updateMapAndSidebar();
  });

  btnSaveAllocation.addEventListener('click', () => {
    alert(`Territory Allocation Saved successfully with ${selectedCounties.size} counties!`);
  });

  // Map Navigation Toolbar
  btnNavHome.addEventListener('click', () => {
    fitToColorado();
  });

  btnNavZoomIn.addEventListener('click', () => {
    if (map) map.zoomIn();
  });

  btnNavZoomOut.addEventListener('click', () => {
    if (map) map.zoomOut();
  });

  btnNavFullscreen.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  });

  // Settings Modal
  if (btnSettings) btnSettings.addEventListener('click', () => settingsModal.classList.add('open'));
  if (settingsClose) settingsClose.addEventListener('click', () => settingsModal.classList.remove('open'));
  
  if (btnSaveSettings) {
    btnSaveSettings.addEventListener('click', () => {
      const k = maptilerKeyInput.value.trim();
      if (k) {
        localStorage.setItem('maptiler_key', k);
        maptilersdk.config.apiKey = k;
      }
      settingsModal.classList.remove('open');
    });
  }

  // Start Map & Data Loading
  initMap();
  loadData();
});
