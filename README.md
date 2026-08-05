# Territory Allocations — Colorado Interactive Map

An interactive territory allocation and analytics web application built for LegalMatch, visualizing **659 Colorado ZIP codes** across **64 Counties**. Powered by **MapTiler SDK JS v4**.

## Live Demo & GitHub Pages
- **Live URL**: https://radekduba.github.io/legalmatch/

## Features
- **MapTiler Vector Map Engine**: High-performance vector polygon boundaries for 64 Colorado counties with centered text labels.
- **Interactive County Selection**: Click any county on the map or sidebar to add/remove it from the allocation.
- **Dynamic Dataset Metrics**: Real-time recalculation of Selected Counties, Selected ZIP Codes, and Coverage Percentage.
- **County Search & Filter**: Real-time sidebar filter with quick select/deselect controls.

## File Structure
- `index.html`: Main HTML SPA dashboard markup.
- `styles.css`: Slate & Light Dataviz styling.
- `app.js`: MapTiler SDK controller and state management logic.
- `map_data.json`: Dataset containing GeoJSON county shapefiles and 659 ZIP records.
