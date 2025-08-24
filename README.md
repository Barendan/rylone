# City Polygon Viewer

A minimal web application that fetches city boundaries from OpenStreetMap and renders them on an interactive map. Built with Next.js, React, and Leaflet.

## Features

- **City Search**: Input a city name and fetch its precise polygon boundary
- **Interactive Map**: Renders city outlines with auto-zoom to fit boundaries
- **Precise Boundaries**: No simplification - shows exact city boundaries as stored in OSM
- **Multi-Polygon Support**: Handles both single polygons and complex multi-polygon cities
- **Responsive Design**: Clean, modern UI that works on all devices

## Tech Stack

- **Frontend**: Next.js 14 (App Router), React 18, TypeScript
- **Forms**: React Hook Form for efficient form handling
- **Maps**: React-Leaflet + Leaflet for interactive mapping
- **Styling**: Tailwind CSS for modern, responsive design
- **API**: Server-side proxy to Nominatim (OpenStreetMap's geocoding service)

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd city-polygon-viewer
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## Usage

1. **Enter a city name** in the search box (e.g., "Miami, FL", "Key Biscayne, FL")
2. **Click "View City"** to fetch the city boundary
3. **Explore the map** - the view will automatically zoom to fit the city boundary
4. **View statistics** showing the number of polygon rings rendered

## Example Cities to Try

- **Miami, FL** - Large city with complex boundary
- **Key Biscayne, FL** - Island municipality with precise coastline
- **San Francisco, CA** - Peninsula city with natural boundaries
- **Manhattan, NY** - Island borough with administrative boundaries
- **Paris, France** - International city with administrative divisions

## API Details

### Endpoint
`GET /api/city?name=<city_name>`

### Response Format
```json
{
  "name": "Miami, Miami-Dade County, Florida, United States",
  "bbox": [25.709, -80.319, 25.790, -80.139],
  "geojson": {
    "type": "Polygon",
    "coordinates": [[[lon1, lat1], [lon2, lat2], ...]]
  }
}
```

### Nominatim Integration

The app proxies requests to [Nominatim](https://nominatim.org/), OpenStreetMap's geocoding service:

- **URL**: `https://nominatim.openstreetmap.org/search`
- **Parameters**: 
  - `format=jsonv2` - JSON response format
  - `polygon_geojson=1` - Include GeoJSON polygons
  - `addressdetails=0` - Minimal address details
  - `q=<city_name>` - Search query

## Polygon Selection Logic

The app intelligently selects the best polygon result:

1. **Primary**: Results with `class="boundary"` and `type="administrative"`
2. **Fallback**: First result with a valid GeoJSON polygon
3. **Validation**: Ensures coordinates are valid and complete

## Nominatim Etiquette

This app follows OpenStreetMap's usage policy:

- **User-Agent**: Includes a polite User-Agent header identifying the application
- **Rate Limiting**: Respects 429 responses and provides user feedback
- **Attribution**: Properly credits OpenStreetMap contributors
- **Efficient Usage**: Only requests necessary data (polygons, not full address details)

## Development

### Project Structure
```
src/
├── app/
│   ├── api/city/route.ts    # Nominatim proxy API
│   ├── CityMap.tsx          # Interactive map component
│   ├── layout.tsx           # Root layout with Leaflet CSS
│   └── page.tsx             # Main page with search form
├── lib/
│   └── geo.ts               # GeoJSON utilities and types
```

### Key Components

- **CityMap**: Client-side map component with GeoJSON rendering
- **API Route**: Server-side proxy to Nominatim with error handling
- **Form**: React Hook Form integration with loading states
- **GeoJSON Processing**: Utilities for polygon validation and selection

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## Production Deployment

The app is production-ready and can be deployed to:

- **Vercel**: Zero-config deployment with Next.js
- **Netlify**: Static export with serverless functions
- **AWS/GCP**: Container deployment with Node.js runtime

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Acknowledgments

- [OpenStreetMap](https://www.openstreetmap.org/) contributors for geographic data
- [Nominatim](https://nominatim.org/) for geocoding services
- [Leaflet](https://leafletjs.com/) for the mapping library
- [Next.js](https://nextjs.org/) team for the excellent framework
