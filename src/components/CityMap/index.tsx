'use client';

import { useState, useRef } from 'react';
import L from 'leaflet';
import { EnhancedCityResponse } from '@/lib/geo';
import type { YelpBusiness } from '@/lib/yelpSearch';
import CityMapCore from './CityMapCore';
import MapControls from './MapControls';
import YelpIntegration from './YelpIntegration';
import HexagonDisplay from './HexagonDisplay';

// Define interfaces for Yelp testing state
interface Restaurant {
  id: string;
  name: string;
  rating: number;
  review_count: number;
  price: string;
  categories: Array<{ alias: string; title: string }>;
  coordinates: { latitude: number; longitude: number };
  location: {
    address1: string;
    city: string;
    state: string;
    zip_code: string;
  };
  phone: string;
  url: string;
  distance: number;
}

interface HexagonResult {
  h3Id: string;
  mapIndex?: number; // Map hexagon number for correlation
  status: 'fetched' | 'failed' | 'dense' | 'split';
  totalBusinesses: number;
  uniqueBusinesses: Restaurant[];
  searchResults: Restaurant[];
  coverageQuality: string;
  error?: string;
}

interface YelpTestResult {
  success?: boolean;
  results?: HexagonResult[];
  testMode?: boolean;
  processedAt?: string;
  error?: string;
  processingStats?: {
    totalHexagons: number;
    processedHexagons: number;
    successfulHexagons: number;
    failedHexagons: number;
    limitedHexagons: number;
    totalRequested: number;
  };
}

interface CityMapProps {
  cityData: EnhancedCityResponse | null;
}

export default function CityMap({ cityData }: CityMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  
  // Layer visibility state
  const [showBuffered, setShowBuffered] = useState(true);
  const [showH3Grid, setShowH3Grid] = useState(true);
  const [showHexagonNumbers, setShowHexagonNumbers] = useState(true);
  const [showRestaurants, setShowRestaurants] = useState(true);

  // Yelp testing state
  const [yelpResults, setYelpResults] = useState<YelpTestResult | null>(null);

  // Map ready callback
  const handleMapReady = (map: L.Map) => {
    mapRef.current = map;
  };

  // Toggle layer visibility
  const toggleBuffered = () => {
    setShowBuffered(!showBuffered);
  };

  const toggleH3Grid = () => {
    setShowH3Grid(!showH3Grid);
  };

  const toggleHexagonNumbers = () => {
    setShowHexagonNumbers(!showHexagonNumbers);
  };

  const toggleRestaurants = () => {
    setShowRestaurants(!showRestaurants);
  };

  // Get all unique restaurants from Yelp results
  const getAllRestaurants = (): YelpBusiness[] => {
    if (!yelpResults?.results) return [];
    const allBusinesses = yelpResults.results.flatMap(result => result.uniqueBusinesses || []);
    
    // Deduplicate by business ID (same logic as HexagonDisplay)
    const uniqueMap = new Map<string, YelpBusiness>();
    allBusinesses.forEach(business => {
      if (!uniqueMap.has(business.id)) {
        uniqueMap.set(business.id, business as YelpBusiness);
      }
    });
    
    return Array.from(uniqueMap.values());
  };

  // Handle Yelp results update
  const handleYelpResultsUpdate = (results: YelpTestResult) => {
    setYelpResults(results);
  };

  return (
    <div className="space-y-4">
      {/* Layer Controls */}
      <MapControls
        cityData={cityData}
        showBuffered={showBuffered}
        showH3Grid={showH3Grid}
        showHexagonNumbers={showHexagonNumbers}
        showRestaurants={showRestaurants}
        onToggleBuffered={toggleBuffered}
        onToggleH3Grid={toggleH3Grid}
        onToggleHexagonNumbers={toggleHexagonNumbers}
        onToggleRestaurants={toggleRestaurants}
      />
      
      {/* Map Container */}
      <div 
        id="map" 
        className="w-full h-96 rounded-lg overflow-hidden border border-gray-200 bg-gray-100"
        style={{ minHeight: '384px' }}
      />
      
      {/* Map Core Component (handles map logic) */}
      <CityMapCore
        cityData={cityData}
        showBuffered={showBuffered}
        showH3Grid={showH3Grid}
        showHexagonNumbers={showHexagonNumbers}
        showRestaurants={showRestaurants}
        restaurants={getAllRestaurants()}
        onMapReady={handleMapReady}
      />

      {/* Yelp Integration */}
      <YelpIntegration
        cityData={cityData}
        onResultsUpdate={handleYelpResultsUpdate}
      />

      {/* Hexagon Display Showcase */}
      <HexagonDisplay yelpResults={yelpResults} />

      {/* City Info Display */}
      {cityData && (
        <div className="mt-4 text-center text-sm text-gray-600">
          <p>Showing: <strong>{cityData.name}</strong> (OSM ID: {cityData.osm_id})</p>
          <p className="text-xs text-gray-500 mt-1">Data source: {cityData.source}</p>
        </div>
      )}
    </div>
  );
}
