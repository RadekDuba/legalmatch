// Territory Allocations & Business Intelligence Controller — Powered by MapTiler SDK JS
document.addEventListener('DOMContentLoaded', async () => {
  let mapData = null;
  let map = null;
  let currentSearchQuery = '';
  let currentSupercategory = 'ALL'; // 'ALL' or specific supercategory name
  let currentViewMode = 'territory'; // 'territory' or 'choropleth'

  // Presets definition
  const presetMetro = new Set([
    'Adams', 'Arapahoe', 'Boulder', 'Broomfield', 'Denver',
    'Douglas', 'Jefferson', 'Larimer', 'Gilpin', 'El Paso', 'Weld'
  ]);

  const presetTop10 = new Set([
    'El Paso', 'Jefferson', 'Arapahoe', 'Denver', 'Weld',
    'Adams', 'Larimer', 'Boulder', 'Pueblo', 'Mesa'
  ]);

  let selectedCounties = new Set(presetMetro);

  // DOM Elements
  const allocationSelectEl = document.getElementById('allocation-select');
  const supercategorySelectEl = document.getElementById('supercategory-select');
  const countyCheckboxListEl = document.getElementById('county-checkbox-list');
  const countySearchInputEl = document.getElementById('county-search-input');
  
  // Summary Metrics Elements
  const sumTotalCasesEl = document.getElementById('sum-total-cases');
  const sumCountiesEl = document.getElementById('sum-counties');
  const sumCasesEl = document.getElementById('sum-cases');
  const sumCoverageEl = document.getElementById('sum-coverage');
  const sumAvgCasesEl = document.getElementById('sum-avg-cases');
  const breakdownListEl = document.getElementById('breakdown-list');
  
  // Badges & Legend
  const selectedCountBadgeEl = document.getElementById('selected-count-badge');
  const badgeCountiesCountEl = document.getElementById('badge-counties-count');
  const legendSelectedCountEl = document.getElementById('legend-selected-count');
  const legendTerritoryContent = document.querySelector('.legend-content-territory');
  const legendChoroplethContent = document.querySelector('.legend-content-choropleth');
  const mapTooltipEl = document.getElementById('map-tooltip');
  
  // Footer Elements
  const footCasesEl = document.getElementById('foot-cases');
  const footCountiesEl = document.getElementById('foot-counties');
  const footZipsEl = document.getElementById('foot-zips');
  const footCoverageEl = document.getElementById('foot-coverage');

  // Sidebar & Action Buttons
  const btnSelectAll = document.getElementById('btn-select-all');
  const btnDeselectAll = document.getElementById('btn-deselect-all');
  const btnSaveAllocation = document.getElementById('btn-save-allocation');
  const btnCancelAllocation = document.getElementById('btn-cancel-allocation');
  const btnExport = document.getElementById('btn-export');
  
  // View Mode Switcher Buttons
  const btnModeTerritory = document.getElementById('btn-mode-territory');
  const btnModeChoropleth = document.getElementById('btn-mode-choropleth');

  // Map Navigation Buttons
  const btnNavHome = document.getElementById('btn-nav-home');
  const btnNavZoomIn = document.getElementById('btn-nav-zoom-in');
  const btnNavZoomOut = document.getElementById('btn-nav-zoom-out');
  const btnNavFullscreen = document.getElementById('btn-nav-fullscreen');
  
  // Settings Modal Elements
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
      style: maptilersdk.MapStyle.DATAVIZ.LIGHT,
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
      [-109.06, 36.99],
      [-102.04, 41.00]
    ], { padding: { top: 70, bottom: 40, left: 40, right: 40 } });
  }

  // Load minified map_data.json
  async function loadData() {
    try {
      const resp = await fetch('map_data.json');
      mapData = await resp.json();

      updateSummaryMetrics();
      renderCountyCheckboxList();
      renderSupercategoryBreakdown();

      if (map && map.isStyleLoaded()) {
        setupCountyLayers();
      }
    } catch (err) {
      console.error('Failed to load map_data.json:', err);
    }
  }

  // Calculate county case count given current supercategory filter
  function getCountyCases(countyName) {
    if (!mapData || !mapData.county_stats[countyName]) return 0;
    const stats = mapData.county_stats[countyName];
    if (currentSupercategory === 'ALL') {
      return stats.total_cases;
    }
    return stats.cases_by_supercategory[currentSupercategory] || 0;
  }

  // Process GeoJSON features for Vector Fill Layer
  function getProcessedCountyGeoJSON() {
    if (!mapData || !mapData.counties_geojson) return { type: 'FeatureCollection', features: [] };

    const features = mapData.counties_geojson.features.map((f, idx) => {
      const feat = JSON.parse(JSON.stringify(f));
      feat.id = idx;
      const cName = feat.properties.name;
      feat.properties.isSelected = selectedCounties.has(cName);
      feat.properties.filteredCases = getCountyCases(cName);
      return feat;
    });

    return {
      type: 'FeatureCollection',
      features: features
    };
  }

  // Process Labels GeoJSON for Symbol Text Layer
  function getCountyLabelsGeoJSON() {
    if (!mapData || !mapData.counties_geojson) return { type: 'FeatureCollection', features: [] };

    const features = mapData.counties_geojson.features.map((f) => {
      const p = f.properties;
      const cName = p.name;
      const cCases = getCountyCases(cName);
      return {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [p.center_lon, p.center_lat]
        },
        properties: {
          name: cName,
          zip_count: p.zip_count,
          filteredCases: cCases,
          isSelected: selectedCounties.has(cName)
        }
      };
    });

    return {
      type: 'FeatureCollection',
      features: features
    };
  }

  // Configure Vector Polygon & Symbol Layers
  function setupCountyLayers() {
    if (!mapData || !map || !mapData.counties_geojson) return;

    if (map.getLayer('county-fill-layer')) map.removeLayer('county-fill-layer');
    if (map.getLayer('county-border-layer')) map.removeLayer('county-border-layer');
    if (map.getLayer('county-symbol-layer')) map.removeLayer('county-symbol-layer');
    if (map.getSource('counties-source')) map.removeSource('counties-source');
    if (map.getSource('county-labels-source')) map.removeSource('county-labels-source');

    // Add Counties Source
    map.addSource('counties-source', {
      type: 'geojson',
      data: getProcessedCountyGeoJSON()
    });

    // Fill Paint Expression based on View Mode
    const fillStyleTerritory = [
      'case',
      ['boolean', ['get', 'isSelected'], false],
      '#3b82f6', // Active Blue
      '#e5e7eb'  // Light Gray
    ];

    const fillStyleChoropleth = [
      'case',
      ['boolean', ['get', 'isSelected'], false],
      [
        'interpolate',
        ['linear'],
        ['get', 'filteredCases'],
        0, '#dbeafe',
        200, '#93c5fd',
        1000, '#3b82f6',
        3000, '#1d4ed8',
        7000, '#0f172a'
      ],
      '#f1f5f9'
    ];

    map.addLayer({
      id: 'county-fill-layer',
      type: 'fill',
      source: 'counties-source',
      paint: {
        'fill-color': currentViewMode === 'choropleth' ? fillStyleChoropleth : fillStyleTerritory,
        'fill-opacity': 0.92
      }
    });

    // Outline Layer
    map.addLayer({
      id: 'county-border-layer',
      type: 'line',
      source: 'counties-source',
      paint: {
        'line-color': currentViewMode === 'choropleth' ? '#64748b' : '#94a3b8',
        'line-width': 1.2
      }
    });

    // Labels Source & Symbol Layer
    map.addSource('county-labels-source', {
      type: 'geojson',
      data: getCountyLabelsGeoJSON()
    });

    map.addLayer({
      id: 'county-symbol-layer',
      type: 'symbol',
      source: 'county-labels-source',
      layout: {
        'text-field': ['concat', ['get', 'name'], '\n', ['to-string', ['get', 'filteredCases']], ' cases'],
        'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
        'text-size': 11,
        'text-allow-overlap': false,
        'text-ignore-placement': false
      },
      paint: {
        'text-color': [
          'case',
          ['boolean', ['get', 'isSelected'], false],
          '#ffffff',
          '#334155'
        ],
        'text-halo-color': [
          'case',
          ['boolean', ['get', 'isSelected'], false],
          'rgba(0, 0, 0, 0.4)',
          'rgba(255, 255, 255, 0.95)'
        ],
        'text-halo-width': 1.2
      }
    });

    // Interactive Map Event Listeners
    map.on('click', 'county-fill-layer', (e) => {
      if (e.features.length > 0) {
        const cName = e.features[0].properties.name;
        toggleCountySelection(cName);
      }
    });

    map.on('mousemove', 'county-fill-layer', (e) => {
      map.getCanvas().style.cursor = 'pointer';
      if (e.features.length > 0) {
        const props = e.features[0].properties;
        const cName = props.name;
        const stats = mapData.county_stats[cName];
        if (!stats) return;

        const totalCases = stats.total_cases;
        const filteredCases = getCountyCases(cName);
        const zips = stats.zip_count;

        let breakdownHtml = '';
        if (stats.cases_by_supercategory) {
          Object.entries(stats.cases_by_supercategory).forEach(([sc, count]) => {
            breakdownHtml += `
              <div class="tooltip-row">
                <span>${sc.replace('and', '&')}</span>
                <strong>${count.toLocaleString()}</strong>
              </div>
            `;
          });
        }

        mapTooltipEl.innerHTML = `
          <div class="tooltip-title">${cName} County</div>
          <div class="tooltip-row">
            <span>ZIP Codes</span>
            <strong>${zips}</strong>
          </div>
          <div class="tooltip-row">
            <span>Est. Cases (${currentSupercategory === 'ALL' ? 'Total' : 'Selected'})</span>
            <strong>${filteredCases.toLocaleString()}</strong>
          </div>
          <div class="tooltip-divider"></div>
          ${breakdownHtml}
        `;

        mapTooltipEl.style.display = 'block';
        mapTooltipEl.style.left = `${e.point.x + 15}px`;
        mapTooltipEl.style.top = `${e.point.y + 15}px`;
      }
    });

    map.on('mouseleave', 'county-fill-layer', () => {
      map.getCanvas().style.cursor = '';
      mapTooltipEl.style.display = 'none';
    });
  }

  // Toggle County Selection
  function toggleCountySelection(countyName) {
    if (selectedCounties.has(countyName)) {
      selectedCounties.delete(countyName);
    } else {
      selectedCounties.add(countyName);
    }
    if (allocationSelectEl) allocationSelectEl.value = 'custom';
    updateMapAndSidebar();
  }

  function updateMapAndSidebar() {
    updateSummaryMetrics();
    renderCountyCheckboxList();
    renderSupercategoryBreakdown();
    
    if (map && map.getSource('counties-source')) {
      map.getSource('counties-source').setData(getProcessedCountyGeoJSON());
    }
    if (map && map.getSource('county-labels-source')) {
      map.getSource('county-labels-source').setData(getCountyLabelsGeoJSON());
    }
  }

  // Update Sidebar & Footer Metrics
  function updateSummaryMetrics() {
    if (!mapData) return;

    const count = selectedCounties.size;
    const totalCounties = mapData.counties_geojson.features.length; // 64
    
    // Overall dataset stats
    let totalStateCases = 0;
    let selectedCases = 0;
    let selectedZips = 0;
    const totalStateZips = 659;

    mapData.counties_geojson.features.forEach(f => {
      const cName = f.properties.name;
      const cCases = getCountyCases(cName);
      totalStateCases += cCases;

      if (selectedCounties.has(cName)) {
        selectedCases += cCases;
        selectedZips += f.properties.zip_count;
      }
    });

    const coveragePct = ((selectedZips / totalStateZips) * 100).toFixed(1);
    const avgCasesPerZip = selectedZips > 0 ? (selectedCases / selectedZips).toFixed(1) : '0';

    // Update Summary Elements
    if (sumTotalCasesEl) sumTotalCasesEl.textContent = `${selectedCases.toLocaleString()} / ${totalStateCases.toLocaleString()}`;
    if (sumCountiesEl) sumCountiesEl.textContent = `${count} / ${totalCounties}`;
    if (sumCasesEl) sumCasesEl.textContent = `${selectedZips.toLocaleString()} / ${totalStateZips}`;
    if (sumCoverageEl) sumCoverageEl.textContent = `${coveragePct}%`;
    if (sumAvgCasesEl) sumAvgCasesEl.textContent = avgCasesPerZip;

    if (selectedCountBadgeEl) selectedCountBadgeEl.textContent = count;
    if (badgeCountiesCountEl) badgeCountiesCountEl.textContent = `${count} Counties Selected`;
    if (legendSelectedCountEl) legendSelectedCountEl.textContent = count;

    if (footCasesEl) footCasesEl.textContent = `${selectedCases.toLocaleString()} / ${totalStateCases.toLocaleString()}`;
    if (footCountiesEl) footCountiesEl.textContent = `${count} / ${totalCounties}`;
    if (footZipsEl) footZipsEl.textContent = `${selectedZips.toLocaleString()} / ${totalStateZips}`;
    if (footCoverageEl) footCoverageEl.textContent = `${coveragePct}%`;
  }

  // Render Practice Area Breakdown Bars
  function renderSupercategoryBreakdown() {
    if (!mapData || !breakdownListEl) return;
    breakdownListEl.innerHTML = '';

    const scTotals = {};
    mapData.supercategories.forEach(sc => scTotals[sc] = 0);

    let selTotal = 0;
    mapData.records.forEach(r => {
      if (selectedCounties.has(r.county)) {
        scTotals[r.supercategory] = (scTotals[r.supercategory] || 0) + r.cases;
        selTotal += r.cases;
      }
    });

    mapData.supercategories.forEach(sc => {
      const cases = scTotals[sc] || 0;
      const pct = selTotal > 0 ? ((cases / selTotal) * 100).toFixed(1) : 0;

      const item = document.createElement('div');
      item.className = 'breakdown-item';
      item.innerHTML = `
        <div class="breakdown-header">
          <span class="breakdown-name" title="${sc}">${sc}</span>
          <span class="breakdown-val">${cases.toLocaleString()} (${pct}%)</span>
        </div>
        <div class="breakdown-bar-bg">
          <div class="breakdown-bar-fill" style="width: ${pct}%;"></div>
        </div>
      `;
      breakdownListEl.appendChild(item);
    });
  }

  // Render Sidebar County Checkbox List
  function renderCountyCheckboxList() {
    if (!mapData) return;
    countyCheckboxListEl.innerHTML = '';

    const sortedFeatures = [...mapData.counties_geojson.features].sort((a, b) => {
      const casesA = getCountyCases(a.properties.name);
      const casesB = getCountyCases(b.properties.name);
      return casesB - casesA;
    });

    const filtered = sortedFeatures.filter(f => {
      if (!currentSearchQuery) return true;
      return f.properties.name.toLowerCase().includes(currentSearchQuery.toLowerCase());
    });

    filtered.forEach(f => {
      const cName = f.properties.name;
      const zCount = f.properties.zip_count;
      const cCases = getCountyCases(cName);
      const isChecked = selectedCounties.has(cName);

      const item = document.createElement('div');
      item.className = 'county-cb-item';
      item.innerHTML = `
        <div class="cb-label-group">
          <input type="checkbox" id="cb-${cName}" ${isChecked ? 'checked' : ''}>
          <label for="cb-${cName}" style="cursor: pointer; font-weight: 500;">${cName}</label>
        </div>
        <span class="cb-count">${cCases.toLocaleString()} Cases (${zCount} Zips)</span>
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

  // Export Selected Territories to CSV
  function exportAllocationCSV() {
    if (!mapData) return;
    let csvContent = 'data:text/csv;charset=utf-8,Zipcode,County,Region,Supercategory,Count_All_Cases\n';
    
    let count = 0;
    mapData.records.forEach(r => {
      if (selectedCounties.has(r.county)) {
        if (currentSupercategory === 'ALL' || r.supercategory === currentSupercategory) {
          csvContent += `"${r.zip}","${r.county}","${r.region}","${r.supercategory}",${r.cases}\n`;
          count++;
        }
      }
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `territory_allocation_${currentSupercategory.replace(/[^a-zA-Z0-9]/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Event Listeners
  if (allocationSelectEl) {
    allocationSelectEl.addEventListener('change', (e) => {
      const val = e.target.value;
      if (val === 'metro') {
        selectedCounties = new Set(presetMetro);
      } else if (val === 'top10') {
        selectedCounties = new Set(presetTop10);
      } else if (val === 'statewide') {
        selectedCounties = new Set(mapData.counties_geojson.features.map(f => f.properties.name));
      }
      updateMapAndSidebar();
    });
  }

  if (supercategorySelectEl) {
    supercategorySelectEl.addEventListener('change', (e) => {
      currentSupercategory = e.target.value;
      updateMapAndSidebar();
    });
  }

  if (btnModeTerritory && btnModeChoropleth) {
    btnModeTerritory.addEventListener('click', () => {
      currentViewMode = 'territory';
      btnModeTerritory.classList.add('active');
      btnModeChoropleth.classList.remove('active');
      if (legendTerritoryContent) legendTerritoryContent.style.display = 'block';
      if (legendChoroplethContent) legendChoroplethContent.style.display = 'none';
      setupCountyLayers();
    });

    btnModeChoropleth.addEventListener('click', () => {
      currentViewMode = 'choropleth';
      btnModeChoropleth.classList.add('active');
      btnModeTerritory.classList.remove('active');
      if (legendTerritoryContent) legendTerritoryContent.style.display = 'none';
      if (legendChoroplethContent) legendChoroplethContent.style.display = 'block';
      setupCountyLayers();
    });
  }

  countySearchInputEl.addEventListener('input', (e) => {
    currentSearchQuery = e.target.value.trim();
    renderCountyCheckboxList();
  });

  btnSelectAll.addEventListener('click', () => {
    if (!mapData) return;
    mapData.counties_geojson.features.forEach(f => selectedCounties.add(f.properties.name));
    if (allocationSelectEl) allocationSelectEl.value = 'statewide';
    updateMapAndSidebar();
  });

  btnDeselectAll.addEventListener('click', () => {
    selectedCounties.clear();
    if (allocationSelectEl) allocationSelectEl.value = 'custom';
    updateMapAndSidebar();
  });

  btnCancelAllocation.addEventListener('click', () => {
    selectedCounties = new Set(presetMetro);
    if (allocationSelectEl) allocationSelectEl.value = 'metro';
    if (supercategorySelectEl) supercategorySelectEl.value = 'ALL';
    currentSupercategory = 'ALL';
    updateMapAndSidebar();
  });

  btnSaveAllocation.addEventListener('click', () => {
    alert(`Territory Allocation Saved successfully! (${selectedCounties.size} counties selected)`);
  });

  if (btnExport) {
    btnExport.addEventListener('click', exportAllocationCSV);
  }

  // Navigation Toolbar
  btnNavHome.addEventListener('click', fitToColorado);
  btnNavZoomIn.addEventListener('click', () => { if (map) map.zoomIn(); });
  btnNavZoomOut.addEventListener('click', () => { if (map) map.zoomOut(); });
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

  // Initialize
  initMap();
  loadData();
});
