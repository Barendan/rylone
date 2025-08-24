import { NextRequest, NextResponse } from 'next/server';
import { 
  selectBestBoundary, 
  osmRelationToGeoJSON, 
  calculateBBox,
  pickBestNominatimResult,
  normalizeBbox,
  CityResponse,
  createEnhancedCityResponse
} from '@/lib/geo';
import { executeOverpassStrategies } from '@/lib/overpassStrategies';
import type { Feature, Polygon, MultiPolygon } from 'geojson';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const cityName = searchParams.get('name');

  if (!cityName || cityName.trim() === '') {
    return NextResponse.json(
      { error: 'City name is required' },
      { status: 400 }
    );
  }

  try {
    console.log(`🔍 Searching for city: "${cityName.trim()}"`);
    
    // Try Overpass API first with multiple query strategies
    console.log('📍 Attempting Overpass API...');
    const overpassResult = await tryOverpassAPI(cityName.trim());
    if (overpassResult) {
      console.log('✅ Overpass API succeeded, creating enhanced response...');
      // Create enhanced response with buffered polygon and H3 grid
      const enhancedResult = createEnhancedCityResponse(overpassResult);
      console.log('🎯 Enhanced response created with:', {
        buffered_polygon: !!enhancedResult.buffered_polygon,
        h3_grid_count: enhancedResult.h3_grid.length,
        grid_stats: enhancedResult.grid_stats
      });
      return NextResponse.json(enhancedResult);
    }

    // Fallback to Nominatim if Overpass fails
    console.log('❌ Overpass API failed, trying Nominatim...');
    const nominatimResult = await tryNominatimAPI(cityName.trim());
    if (nominatimResult) {
      console.log('✅ Nominatim API succeeded, creating enhanced response...');
      // Create enhanced response with buffered polygon and H3 grid
      const enhancedResult = createEnhancedCityResponse(nominatimResult);
      console.log('🎯 Enhanced response created with:', {
        buffered_polygon: !!enhancedResult.buffered_polygon,
        h3_grid_count: enhancedResult.h3_grid.length,
        grid_stats: enhancedResult.grid_stats
      });
      return NextResponse.json(enhancedResult);
    }

    console.log('❌ Both APIs failed, no boundary found');
    return NextResponse.json(
      { error: 'No boundary found for this city' },
      { status: 404 }
    );
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch city data. Please try again.' },
      { status: 500 }
    );
  }
}

async function tryOverpassAPI(cityName: string): Promise<CityResponse | null> {
  console.log(`🔍 Trying Overpass API for: "${cityName}"`);
  
  // Extract state code from city input
  const parts = cityName.split(', ');
  if (parts.length !== 2) {
    console.log(`❌ Invalid city format: "${cityName}". Expected "City, State"`);
    return null;
  }
  
  const cityNameOnly = parts[0].trim();
  const stateCode = parts[1].trim();
  
  console.log(`🏙️ City: "${cityNameOnly}", State: "${stateCode}"`);
  
  try {
    // Execute our three working Overpass strategies
    const overpassResult = await executeOverpassStrategies(cityName, stateCode);
    
    if (!overpassResult || !overpassResult.elements || overpassResult.elements.length === 0) {
      console.log(`❌ No results from Overpass strategies`);
      return null;
    }
    
    console.log(`✅ Overpass strategies returned ${overpassResult.elements.length} elements`);
    
    // Select the best boundary from the results
    const best = selectBestBoundary(overpassResult.elements);
    if (!best) {
      console.log(`❌ No valid boundary found in Overpass results`);
      return null;
    }
    
    console.log(`✅ Found best boundary: ${best.tags.name} (ID: ${best.id})`);
    
    // Convert to GeoJSON
    const geojson = osmRelationToGeoJSON(best);
    console.log(`✅ GeoJSON created successfully`);
    
    // Calculate bounding box
    const bbox = calculateBBox(geojson);
    console.log(`✅ Bounding box calculated:`, bbox);
    
    return {
      name: best.tags.name,
      bbox,
      geojson,
      osm_id: best.id,
      source: 'overpass'
    };
    
  } catch (error) {
    console.error(`❌ Overpass API execution failed:`, error);
    return null;
  }
}

async function tryNominatimAPI(cityName: string): Promise<CityResponse | null> {
  try {
    const nominatimUrl = new URL('https://nominatim.openstreetmap.org/search');
    nominatimUrl.searchParams.set('format', 'jsonv2');
    nominatimUrl.searchParams.set('polygon_geojson', '1');
    nominatimUrl.searchParams.set('addressdetails', '0');
    nominatimUrl.searchParams.set('q', cityName);

    const response = await fetch(nominatimUrl.toString(), {
      headers: {
        'User-Agent': 'CityPolygonViewer/0.1 (demo@example.com)',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 429) {
        return null; // Rate limited, skip to next strategy
      }
      throw new Error(`Nominatim responded with status: ${response.status}`);
    }

    const results = await response.json();
    
    if (!Array.isArray(results) || results.length === 0) {
      return null;
    }

    const bestResult = pickBestNominatimResult(results);
    
    if (!bestResult || !bestResult.geojson) {
      return null;
    }

    // Convert to our unified format
    const geojson: Feature<Polygon | MultiPolygon> = {
      type: 'Feature',
      geometry: bestResult.geojson,
      properties: {
        name: bestResult.display_name,
        admin_level: bestResult.class === 'boundary' ? '8' : undefined,
        place: bestResult.type,
        osm_id: bestResult.osm_id
      }
    };

    return {
      name: bestResult.display_name,
      bbox: normalizeBbox(bestResult.boundingbox),
      geojson,
      osm_id: bestResult.osm_id,
      source: 'nominatim'
    };
  } catch (error) {
    console.error('Nominatim fallback error:', error);
    return null;
  }
}
