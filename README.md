# Territory Allocations — Colorado Interactive Map

An interactive territory allocation and analytics web application built for **LegalMatch**, visualizing **659 Colorado ZIP codes** across **64 Counties**. Powered by **MapTiler SDK JS v4**.

## 🌐 Live Demo & GitHub Pages
- **Live URL**: [https://radekduba.github.io/legalmatch/](https://radekduba.github.io/legalmatch/)
- **GitHub Repository**: [https://github.com/RadekDuba/legalmatch](https://github.com/RadekDuba/legalmatch)

---

## ⚡ Data Architecture & Vector Join Model

This application uses a **lightweight data join architecture** designed for high performance and scalability:

```
┌─────────────────────────────────────────┐     ┌───────────────────────────────────────┐
│     RAW EXCEL DATASET (.xlsx)           │     │    MAPTILER VECTOR TILE ENGINE        │
│  659 ZIP Records (County, Region, etc.) │     │  Streams County Boundaries & Vector   │
│   [No Lat/Lon or GIS Geometry overhead] │     │  Polygon Shapes Directly from CDN     │
└────────────────────┬────────────────────┘     └───────────────────┬───────────────────┘
                     │                                              │
                     └──────────────────────┬───────────────────────┘
                                            ▼
                             ┌──────────────────────────────┐
                             │    INTERACTIVE WEB APP       │
                             │  Dynamic Property Matching   │
                             │   (County & ZIP Code Join)   │
                             └──────────────────────────────┘
```

### Key Technical Benefits:
- **Ultra-Fast Payload (241 KB vs 28.9 MB)**: The JSON payload (`map_data.json`) contains only raw business records (`zip`, `county`, `region`, `supercategory`, `id_region`) matching the Excel source directly. All redundant geographic coordinates (`lat`/`lon`) and 525+ heavy GeoJSON ZIP polygons were eliminated.
- **Client-Side Vector Tile Matching**: MapTiler vector tiles stream county boundary polygons directly from MapTiler CDN vector servers. The application dynamically links selected counties from the dataset to the vector layer on the fly.

---

## ✨ Features

- **MapTiler Vector Map Engine**: High-performance vector polygon boundaries for 64 Colorado counties with centered, anti-colliding text labels.
- **Interactive County Selection**: Click any county directly on the vector map or toggle checkboxes in the sidebar to allocate/deallocate territories in real time.
- **Dynamic Analytics Dashboard**:
  - **Selected Counties Count**: Real-time count of active territories.
  - **Selected ZIP Codes & Coverage**: Total ZIP codes included and percentage of Colorado covered.
  - **Est. Cases & Revenue**: Dynamically calculated business metrics based on selected territories.
- **Real-Time Sidebar Search & Filter**: Instant search filtering across all 64 Colorado counties.
- **Preset Allocations**: Quickly toggle between *Colorado Metro*, *Statewide Complete*, and *Custom Territory Allocation*.
- **Export Capabilities**: Export currently selected territory allocations to CSV format.

---

## 📁 File Structure

```
├── index.html                             # Main HTML SPA dashboard markup
├── styles.css                             # Slate & Dataviz UI styling system
├── app.js                                 # MapTiler SDK controller & state management
├── map_data.json                          # Lightweight JSON dataset (659 ZIP records + county shapes)
├── region_county_zip 2026-08-04T0829.xlsx # Original Excel raw source data
└── README.md                              # Project documentation
```

---

## 🛠️ Data Pipeline & Client Guide (How to Extend)

If your client needs to update or ingest new territory datasets (e.g. adding new states or custom metrics):

1. **Ingest Tabular Data**: Extract raw Excel rows containing `Zipcode`, `County`, `Region Name`, and `Supercategory`.
2. **Convert to Lightweight JSON**: Save as a clean JSON array of objects. No geographic coordinates (`lat`/`lon`) are required.
3. **Connect to MapTiler Vector Layers**: In `app.js`, link the unique identifiers (`county` name or FIPS code / `zip` code) to MapTiler's administrative vector tile layers.

---

## 💻 Local Development Setup

To run the application locally:

1. Clone the repository:
   ```bash
   git clone https://github.com/RadekDuba/legalmatch.git
   ```
2. Serve the static folder with any HTTP server (e.g., Python, Node `http-server`, or Live Server):
   ```bash
   python -m http.server 8080
   ```
3. Open `http://localhost:8080` in your web browser.

