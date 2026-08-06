// Territory Allocations & Business Intelligence Controller — Powered by MapTiler SDK JS
document.addEventListener('DOMContentLoaded', async () => {
  let mapData = null;
  let map = null;
  let currentSearchQuery = '';
  let currentViewMode = 'territory'; // 'territory' or 'choropleth'

  // Multi-Select Sets
  let selectedSupercategories = new Set();
  let selectedRegions = new Set();
  let selectedCounties = new Set();

  // Preset definitions
  const presetMetro = new Set([
    'Adams', 'Arapahoe', 'Boulder', 'Broomfield', 'Denver',
    'Douglas', 'Jefferson', 'Larimer', 'Gilpin', 'El Paso', 'Weld'
  ]);

  const presetTop10 = new Set([
    'El Paso', 'Jefferson', 'Arapahoe', 'Denver', 'Weld',
    'Adams', 'Larimer', 'Boulder', 'Pueblo', 'Mesa'
  ]);

  selectedCounties = new Set(presetMetro);

  // DOM Elements
  const allocationSelectEl = document.getElementById('allocation-select');
  const countyCheckboxListEl = document.getElementById('county-checkbox-list');
  const countySearchInputEl = document.getElementById('county-search-input');
  
  // Multi-Select UI Elements — Supercategories
  const scMsBtn = document.getElementById('supercategory-ms-btn');
  const scMsLabel = document.getElementById('supercategory-ms-label');
  const scMsPopover = document.getElementById('supercategory-ms-popover');
  const scMsList = document.getElementById('supercategory-ms-list');
  const scSelectAllBtn = document.getElementById('sc-select-all');
  const scClearAllBtn = document.getElementById('sc-clear-all');

  // Multi-Select UI Elements — Regions
  const rgMsBtn = document.getElementById('region-ms-btn');
  const rgMsLabel = document.getElementById('region-ms-label');
  const rgMsPopover = document.getElementById('region-ms-popover');
  const rgMsList = document.getElementById('region-ms-list');
  const rgSelectAllBtn = document.getElementById('rg-select-all');
  const rgClearAllBtn = document.getElementById('rg-clear-all');

  // Summary Metrics Elements
  const sumTotalCasesEl = document.getElementById('sum-total-cases');
  const sumCategoriesCountEl = document.getElementById('sum-categories-count');
  const sumRegionsCountEl = document.getElementById('sum-regions-count');
  const sumCountiesEl = document.getElementById('sum-counties');
  const sumCasesEl = document.getElementById('sum-cases');
  const sumCoverageEl = document.getElementById('sum-coverage');
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
      center: [-105.5, 39.0],
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

      // Initialize all supercategories and regions selected by default
      selectedSupercategories = new Set(mapData.supercategories);
      const allRegions = new Set(mapData.records.map(r => r.region).filter(Boolean));
      selectedRegions = new Set(allRegions);

      renderSupercategoryDropdown();
      renderRegionDropdown();
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

  // Calculate county case count matching active selected Regions AND Supercategories
  function getCountyFilteredCases(countyName) {
    if (!mapData) return 0;
    let sum = 0;
    mapData.records.forEach(r => {
      if (r.county === countyName) {
        if (selectedSupercategories.has(r.supercategory) && selectedRegions.has(r.region)) {
          sum += r.cases;
        }
      }
    });
    return sum;
  }

  // Get total cases for supercategory in county given active selected regions
  function getCountySupercategoryCases(countyName, scName) {
    if (!mapData) return 0;
    let sum = 0;
    mapData.records.forEach(r => {
      if (r.county === countyName && r.supercategory === scName && selectedRegions.has(r.region)) {
        sum += r.cases;
      }
    });
    return sum;
  }

  // Process GeoJSON features for Vector Fill Layer
  function getProcessedCountyGeoJSON() {
    if (!mapData || !mapData.counties_geojson) return { type: 'FeatureCollection', features: [] };

    const features = mapData.counties_geojson.features.map((f, idx) => {
      const feat = JSON.parse(JSON.stringify(f));
      feat.id = idx;
      const cName = feat.properties.name;
      feat.properties.isSelected = selectedCounties.has(cName);
      feat.properties.filteredCases = getCountyFilteredCases(cName);
      return feat;
    });

    return {
      type: 'FeatureCollection',
      features: features
    };
  }

  // Process Labels GeoJSON for Symbol Text Layer (Directly showing Case Counts on Map!)
  function getCountyLabelsGeoJSON() {
    if (!mapData || !mapData.counties_geojson) return { type: 'FeatureCollection', features: [] };

    const features = mapData.counties_geojson.features.map((f) => {
      const p = f.properties;
      const cName = p.name;
      const cCases = getCountyFilteredCases(cName);
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

    const fillStyleTerritory = [
      'case',
      ['boolean', ['get', 'isSelected'], false],
      '#3b82f6',
      '#e5e7eb'
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

    map.addLayer({
      id: 'county-border-layer',
      type: 'line',
      source: 'counties-source',
      paint: {
        'line-color': currentViewMode === 'choropleth' ? '#64748b' : '#94a3b8',
        'line-width': 1.2
      }
    });

    // Symbol Text Layer — Prominently displaying County Name + Case Counts directly on Map!
    map.addSource('county-labels-source', {
      type: 'geojson',
      data: getCountyLabelsGeoJSON()
    });

    map.addLayer({
      id: 'county-symbol-layer',
      type: 'symbol',
      source: 'county-labels-source',
      layout: {
        'text-field': ['concat', ['get', 'name'], '\n', ['to-string', ['get', 'filteredCases']], ' Cases'],
        'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
        'text-size': 11.5,
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
          'rgba(0, 0, 0, 0.45)',
          'rgba(255, 255, 255, 0.95)'
        ],
        'text-halo-width': 1.4
      }
    });

    // Map Event Listeners
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

        const filteredCases = getCountyFilteredCases(cName);
        const zips = stats.zip_count;

        let breakdownHtml = '';
        mapData.supercategories.forEach(sc => {
          if (selectedSupercategories.has(sc)) {
            const scCases = getCountySupercategoryCases(cName, sc);
            breakdownHtml += `
              <div class="tooltip-row">
                <span>${sc.replace('and', '&')}</span>
                <strong>${scCases.toLocaleString()}</strong>
              </div>
            `;
          }
        });

        mapTooltipEl.innerHTML = `
          <div class="tooltip-title">${cName} County</div>
          <div class="tooltip-row">
            <span>ZIP Codes</span>
            <strong>${zips}</strong>
          </div>
          <div class="tooltip-row">
            <span>Est. Combined Cases</span>
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

  // Helper to format clean display strings
  function formatDisplayName(str) {
    if (!str) return '';
    return str
      .split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
      .replace(/\bAnd\b/g, '&');
  }

  // Render Multi-Select Dropdown — Supercategories
  function renderSupercategoryDropdown() {
    if (!mapData || !scMsList) return;
    scMsList.innerHTML = '';

    const allCount = mapData.supercategories.length;
    const selCount = selectedSupercategories.size;

    if (selCount === allCount) {
      scMsLabel.textContent = `All Practice Areas (${allCount})`;
    } else if (selCount === 0) {
      scMsLabel.textContent = `0 Practice Areas Selected`;
    } else if (selCount === 1) {
      const singleSC = Array.from(selectedSupercategories)[0];
      scMsLabel.textContent = formatDisplayName(singleSC);
    } else {
      scMsLabel.textContent = `${selCount} of ${allCount} Practice Areas`;
    }

    mapData.supercategories.forEach(sc => {
      let totalCasesSC = 0;
      mapData.records.forEach(r => {
        if (r.supercategory === sc && selectedRegions.has(r.region)) {
          totalCasesSC += r.cases;
        }
      });

      const isChecked = selectedSupercategories.has(sc);
      const safeId = 'ms-sc-' + sc.replace(/[^a-zA-Z0-9]/g, '-');
      const item = document.createElement('div');
      item.className = 'ms-item';
      item.innerHTML = `
        <div class="ms-item-left">
          <input type="checkbox" id="${safeId}" ${isChecked ? 'checked' : ''}>
          <label for="${safeId}" class="ms-item-label">${formatDisplayName(sc)}</label>
        </div>
        <span class="ms-item-count">${totalCasesSC.toLocaleString()}</span>
      `;

      item.addEventListener('click', (e) => {
        if (e.target.tagName !== 'INPUT') {
          const cb = item.querySelector('input');
          cb.checked = !cb.checked;
        }
        if (selectedSupercategories.has(sc)) {
          selectedSupercategories.delete(sc);
        } else {
          selectedSupercategories.add(sc);
        }
        renderSupercategoryDropdown();
        renderRegionDropdown();
        updateMapAndSidebar();
      });

      scMsList.appendChild(item);
    });
  }

  // Render Multi-Select Dropdown — Region Name
  function renderRegionDropdown() {
    if (!mapData || !rgMsList) return;
    rgMsList.innerHTML = '';

    const allRegionsList = sortedRegionsList();
    const allCount = allRegionsList.length;
    const selCount = selectedRegions.size;

    if (selCount === allCount) {
      rgMsLabel.textContent = `All Regions (${allCount})`;
    } else if (selCount === 0) {
      rgMsLabel.textContent = `0 Regions Selected`;
    } else if (selCount === 1) {
      const singleRg = Array.from(selectedRegions)[0];
      rgMsLabel.textContent = formatDisplayName(singleRg);
    } else {
      rgMsLabel.textContent = `${selCount} of ${allCount} Regions`;
    }

    allRegionsList.forEach(reg => {
      let totalCasesReg = 0;
      mapData.records.forEach(r => {
        if (r.region === reg && selectedSupercategories.has(r.supercategory)) {
          totalCasesReg += r.cases;
        }
      });

      const isChecked = selectedRegions.has(reg);
      const safeId = 'ms-rg-' + reg.replace(/[^a-zA-Z0-9]/g, '-');
      const item = document.createElement('div');
      item.className = 'ms-item';
      item.innerHTML = `
        <div class="ms-item-left">
          <input type="checkbox" id="${safeId}" ${isChecked ? 'checked' : ''}>
          <label for="${safeId}" class="ms-item-label">${formatDisplayName(reg)}</label>
        </div>
        <span class="ms-item-count">${totalCasesReg.toLocaleString()}</span>
      `;

      item.addEventListener('click', (e) => {
        if (e.target.tagName !== 'INPUT') {
          const cb = item.querySelector('input');
          cb.checked = !cb.checked;
        }
        if (selectedRegions.has(reg)) {
          selectedRegions.delete(reg);
        } else {
          selectedRegions.add(reg);
        }
        renderRegionDropdown();
        renderSupercategoryDropdown();
        updateMapAndSidebar();
      });

      rgMsList.appendChild(item);
    });
  }

  function sortedRegionsList() {
    if (!mapData) return [];
    return sortedUnique(mapData.records.map(r => r.region).filter(Boolean));
  }

  function sortedUnique(arr) {
    return Array.from(new Set(arr)).sort();
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

  // Update Sidebar Summary Metrics
  function updateSummaryMetrics() {
    if (!mapData) return;

    const count = selectedCounties.size;
    const totalCounties = mapData.counties_geojson.features.length; // 64
    
    let totalStateCases = 0;
    let selectedCases = 0;
    let selectedZips = 0;
    const totalStateZips = 659;

    mapData.counties_geojson.features.forEach(f => {
      const cName = f.properties.name;
      const cCases = getCountyFilteredCases(cName);
      totalStateCases += cCases;

      if (selectedCounties.has(cName)) {
        selectedCases += cCases;
        selectedZips += f.properties.zip_count;
      }
    });

    const coveragePct = ((selectedZips / totalStateZips) * 100).toFixed(1);

    if (sumTotalCasesEl) sumTotalCasesEl.textContent = `${selectedCases.toLocaleString()} / ${totalStateCases.toLocaleString()}`;
    if (sumCategoriesCountEl) sumCategoriesCountEl.textContent = `${selectedSupercategories.size} / ${mapData.supercategories.length} Areas`;
    if (sumRegionsCountEl) sumRegionsCountEl.textContent = `${selectedRegions.size} / ${sortedRegionsList().length} Regions`;
    if (sumCountiesEl) sumCountiesEl.textContent = `${count} / ${totalCounties}`;
    if (sumCasesEl) sumCasesEl.textContent = `${selectedZips.toLocaleString()} / ${totalStateZips}`;
    if (sumCoverageEl) sumCoverageEl.textContent = `${coveragePct}%`;

    if (selectedCountBadgeEl) selectedCountBadgeEl.textContent = count;
    if (badgeCountiesCountEl) badgeCountiesCountEl.textContent = `${count} Counties Selected`;
    if (legendSelectedCountEl) legendSelectedCountEl.textContent = count;

    if (footCasesEl) footCasesEl.textContent = `${selectedCases.toLocaleString()} / ${totalStateCases.toLocaleString()}`;
    if (footCountiesEl) footCountiesEl.textContent = `${count} / ${totalCounties}`;
    if (footZipsEl) footZipsEl.textContent = `${selectedZips.toLocaleString()} / ${totalStateZips}`;
    if (footCoverageEl) footCoverageEl.textContent = `${coveragePct}%`;
  }

  // Render Sidebar Supercategory Distribution Breakdown
  function renderSupercategoryBreakdown() {
    if (!mapData || !breakdownListEl) return;
    breakdownListEl.innerHTML = '';

    const scTotals = {};
    mapData.supercategories.forEach(sc => scTotals[sc] = 0);

    let selTotal = 0;
    mapData.records.forEach(r => {
      if (selectedCounties.has(r.county) && selectedRegions.has(r.region)) {
        if (selectedSupercategories.has(r.supercategory)) {
          scTotals[r.supercategory] = (scTotals[r.supercategory] || 0) + r.cases;
          selTotal += r.cases;
        }
      }
    });

    mapData.supercategories.forEach(sc => {
      if (!selectedSupercategories.has(sc)) return;
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
      const casesA = getCountyFilteredCases(a.properties.name);
      const casesB = getCountyFilteredCases(b.properties.name);
      return casesB - casesA;
    });

    const filtered = sortedFeatures.filter(f => {
      if (!currentSearchQuery) return true;
      return f.properties.name.toLowerCase().includes(currentSearchQuery.toLowerCase());
    });

    filtered.forEach(f => {
      const cName = f.properties.name;
      const zCount = f.properties.zip_count;
      const cCases = getCountyFilteredCases(cName);
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

  // Export Selected Multi-Select Allocations to CSV
  function exportAllocationCSV() {
    if (!mapData) return;
    let csvContent = 'data:text/csv;charset=utf-8,Zipcode,County,Region,Supercategory,Count_All_Cases\n';
    
    let count = 0;
    mapData.records.forEach(r => {
      if (selectedCounties.has(r.county)) {
        if (selectedRegions.has(r.region) && selectedSupercategories.has(r.supercategory)) {
          csvContent += `"${r.zip}","${r.county}","${r.region}","${r.supercategory}",${r.cases}\n`;
          count++;
        }
      }
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `territory_allocation_export.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Popover Toggle Listeners
  if (scMsBtn) {
    scMsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      rgMsPopover.classList.remove('open');
      rgMsBtn.classList.remove('open');
      scMsPopover.classList.toggle('open');
      scMsBtn.classList.toggle('open');
    });
  }

  if (rgMsBtn) {
    rgMsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      scMsPopover.classList.remove('open');
      scMsBtn.classList.remove('open');
      rgMsPopover.classList.toggle('open');
      rgMsBtn.classList.toggle('open');
    });
  }

  // Close popovers on click outside
  document.addEventListener('click', (e) => {
    if (scMsPopover && !scMsPopover.contains(e.target) && !scMsBtn.contains(e.target)) {
      scMsPopover.classList.remove('open');
      scMsBtn.classList.remove('open');
    }
    if (rgMsPopover && !rgMsPopover.contains(e.target) && !rgMsBtn.contains(e.target)) {
      rgMsPopover.classList.remove('open');
      rgMsBtn.classList.remove('open');
    }
  });

  // Select All / Clear All Multi-Select Handlers
  if (scSelectAllBtn) {
    scSelectAllBtn.addEventListener('click', () => {
      selectedSupercategories = new Set(mapData.supercategories);
      renderSupercategoryDropdown();
      updateMapAndSidebar();
    });
  }

  if (scClearAllBtn) {
    scClearAllBtn.addEventListener('click', () => {
      selectedSupercategories.clear();
      renderSupercategoryDropdown();
      updateMapAndSidebar();
    });
  }

  if (rgSelectAllBtn) {
    rgSelectAllBtn.addEventListener('click', () => {
      selectedRegions = new Set(sortedRegionsList());
      renderRegionDropdown();
      renderSupercategoryDropdown();
      updateMapAndSidebar();
    });
  }

  if (rgClearAllBtn) {
    rgClearAllBtn.addEventListener('click', () => {
      selectedRegions.clear();
      renderRegionDropdown();
      renderSupercategoryDropdown();
      updateMapAndSidebar();
    });
  }

  // Preset Allocation Handler
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

  // View Mode Handlers
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
    selectedSupercategories = new Set(mapData.supercategories);
    selectedRegions = new Set(sortedRegionsList());
    if (allocationSelectEl) allocationSelectEl.value = 'metro';
    renderSupercategoryDropdown();
    renderRegionDropdown();
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
