'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet.markercluster';
import { EnhancedCityResponse } from '@/lib/geo';
import type { YelpBusiness } from '@/lib/yelpSearch';

// Fix for default markers in Leaflet
delete (L.Icon.Default.prototype as { _getIconUrl?: string })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface CityMapCoreProps {
  cityData: EnhancedCityResponse | null;
  showBuffered: boolean;
  showH3Grid: boolean;
  showHexagonNumbers: boolean;
  showRestaurants?: boolean;
  restaurants?: YelpBusiness[];
  onMapReady: (map: L.Map) => void;
}

export default function CityMapCore({ 
  cityData, 
  showBuffered, 
  showH3Grid, 
  showHexagonNumbers,
  showRestaurants = false,
  restaurants = [],
  onMapReady 
}: CityMapCoreProps) {
  const mapRef = useRef<L.Map | null>(null);
  const cityLayerRef = useRef<L.GeoJSON | null>(null);
  const bufferedLayerRef = useRef<L.GeoJSON | null>(null);
  const h3GridLayerRef = useRef<L.LayerGroup | null>(null);
  const restaurantLayerRef = useRef<L.MarkerClusterGroup | null>(null);

  // Initialize map with performance optimizations
  useEffect(() => {
    if (!mapRef.current) {
      console.log('🗺️ Initializing map...');
      
      // Ensure the map container exists and has dimensions
      const mapContainer = document.getElementById('map');
      if (!mapContainer) {
        console.error('❌ Map container not found');
        return;
      }
      
      console.log('📏 Map container dimensions:', {
        width: mapContainer.offsetWidth,
        height: mapContainer.offsetHeight,
        clientWidth: mapContainer.clientWidth,
        clientHeight: mapContainer.clientHeight
      });
      
      const map = L.map('map', {
        preferCanvas: true, // Better performance for many future restaurant markers
        center: [20, 0],
        zoom: 2,
        zoomControl: true,
        scrollWheelZoom: true,
        doubleClickZoom: true,
        attributionControl: true
      });

      // Add OSM tile layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 18
      }).addTo(map);

      mapRef.current = map;
      onMapReady(map);
      console.log('✅ Map initialized successfully');
      
      // Small delay to ensure map is fully ready
      setTimeout(() => {
        console.log('⏳ Map ready delay completed');
      }, 100);
    }

    // Cleanup function
    return () => {
      if (mapRef.current) {
        console.log('🧹 Cleaning up map...');
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [onMapReady]);

  // Update city data with enhanced styling and layers
  useEffect(() => {
    if (!mapRef.current || !cityData) return;

    const map = mapRef.current;
    
    console.log('🗺️ Adding city data layers to map...');

    // Remove existing layers
    if (cityLayerRef.current) {
      map.removeLayer(cityLayerRef.current);
    }
    if (bufferedLayerRef.current) {
      map.removeLayer(bufferedLayerRef.current);
    }
    if (h3GridLayerRef.current) {
      map.removeLayer(h3GridLayerRef.current);
    }

    // Add original city boundary layer
    const cityLayer = L.geoJSON(cityData.geojson, {
      style: {
        color: '#2563eb',
        weight: 3,
        opacity: 0.8,
        fillColor: '#3b82f6',
        fillOpacity: 0.15
      }
    });

    cityLayer.addTo(map);
    cityLayerRef.current = cityLayer;

    // Add buffered polygon layer
    if (showBuffered) {
      const bufferedLayer = L.geoJSON(cityData.buffered_polygon, {
        style: {
          color: '#7c3aed',
          weight: 2,
          opacity: 0.6,
          fillColor: '#a855f7',
          fillOpacity: 0.1
        }
      });

      bufferedLayer.addTo(map);
      bufferedLayerRef.current = bufferedLayer;
    }

    // Add H3 grid layer
    if (showH3Grid && cityData.h3_grid.length > 0) {
      console.log(`🗺️ Rendering H3 grid with ${cityData.h3_grid.length} hexagons (covering entire buffered area)`);
      const h3GridLayer = L.layerGroup();
      
      // Import h3 dynamically to avoid SSR issues
      const h3 = require('h3-js');
      
      try {
        let renderedCount = 0;
        
        cityData.h3_grid.forEach((h3Index, i) => {
          try {
            const boundary = h3.cellToBoundary(h3Index, true);
            
            // Validate boundary coordinates
            if (!boundary || !Array.isArray(boundary) || boundary.length < 3) {
              console.warn(`⚠️ Invalid boundary for hexagon ${i}: ${h3Index}`);
              return;
            }
            
            // Convert H3 boundary to Leaflet polygon coordinates
            // H3 returns [lng, lat] but Leaflet expects [lat, lng]
            const polygonCoords: [number, number][] = boundary.map((coord: number[]) => [coord[1], coord[0]]); // [lat, lng] for Leaflet
            
            const polygon = L.polygon(polygonCoords, {
              color: '#059669',
              weight: 2,
              opacity: 0.8,
              fillColor: '#10b981',
              fillOpacity: 0.15
            });
            
            // Add hexagon number label (conditionally)
            if (showHexagonNumbers) {
              const center = polygon.getBounds().getCenter();
              const label = L.divIcon({
                className: 'hexagon-label',
                html: `<div style="
                  background: rgba(255, 255, 255, 0.95);
                  border: 2px solid #059669;
                  border-radius: 50%;
                  width: 28px;
                  height: 28px;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  font-weight: bold;
                  font-size: 11px;
                  color: #059669;
                  text-shadow: 1px 1px 2px rgba(255, 255, 255, 0.9);
                  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
                  font-family: 'Courier New', monospace;
                ">${i}</div>`,
                iconSize: [28, 28],
                iconAnchor: [14, 14]
              });
              
              const labelMarker = L.marker(center, { icon: label });
              h3GridLayer.addLayer(labelMarker);
              
              // Log first few hexagon numbers for debugging
              if (i < 5) {
                console.log(`🔢 Hexagon ${i} labeled at center: [${center.lat.toFixed(4)}, ${center.lng.toFixed(4)}]`);
              }
            }
            
            h3GridLayer.addLayer(polygon);
            renderedCount++;
            
            // Log first few hexagons for debugging
            if (i < 3) {
              console.log(`🔷 Hexagon ${i}: ${h3Index}, boundary:`, boundary);
              console.log(`🔷 Leaflet coords:`, polygonCoords);
            }
          } catch (hexError) {
            console.warn(`⚠️ Error rendering hexagon ${i}:`, hexError);
          }
        });
        
        if (renderedCount > 0) {
          h3GridLayer.addTo(map);
          h3GridLayerRef.current = h3GridLayer;
          console.log(`✅ H3 grid layer added to map with ${renderedCount} hexagons`);
          if (showHexagonNumbers) {
            console.log(`🔢 Hexagon numbers are ${showHexagonNumbers ? 'enabled' : 'disabled'}`);
          }
          
          // Log the map bounds and zoom level for debugging
          console.log(`🗺️ Map bounds:`, map.getBounds());
          console.log(`🔍 Map zoom level:`, map.getZoom());
          
          // Force a map refresh to ensure hexagons are visible
          map.invalidateSize();
        } else {
          console.warn(`⚠️ No hexagons were successfully rendered`);
        }
        
      } catch (error) {
        console.error('Error rendering H3 grid:', error);
      }
    } else {
      console.log(`⚠️ H3 grid not rendered: showH3Grid=${showH3Grid}, h3_grid.length=${cityData.h3_grid.length}`);
    }

    // Fit bounds to city with padding
    const bounds = cityLayer.getBounds();
    if (bounds.isValid()) {
      map.fitBounds(bounds, {
        padding: [24, 24],
        maxZoom: 18
      });
    }
  }, [cityData, showBuffered, showH3Grid, showHexagonNumbers]);

  // Restaurant layer management
  useEffect(() => {
    if (!mapRef.current || !showRestaurants || !restaurants || restaurants.length === 0) {
      // Remove existing restaurant layer if conditions not met
      if (restaurantLayerRef.current && mapRef.current) {
        mapRef.current.removeLayer(restaurantLayerRef.current);
        restaurantLayerRef.current.clearLayers();
        restaurantLayerRef.current = null;
      }
      return;
    }

    const map = mapRef.current;
    
    // Remove existing layer
    if (restaurantLayerRef.current) {
      map.removeLayer(restaurantLayerRef.current);
      restaurantLayerRef.current.clearLayers();
    }

    console.log(`🍕 Adding ${restaurants.length} restaurants to map`);

    // Create cluster group with our styling
    const clusterGroup = L.markerClusterGroup({
      maxClusterRadius: 50 // Reasonable clustering distance
    });

    // Add each restaurant as a marker
    let validRestaurants = 0;
    restaurants.forEach((restaurant) => {
      const { latitude, longitude } = restaurant.coordinates;
      
      // Validate coordinates
      if (!latitude || !longitude || 
          latitude < -90 || latitude > 90 || 
          longitude < -180 || longitude > 180 ||
          isNaN(latitude) || isNaN(longitude)) {
        console.warn(`❌ Invalid coordinates for ${restaurant.name}: [${latitude}, ${longitude}]`);
        return;
      }

      try {
        const marker = L.marker([latitude, longitude])
          .bindPopup(`
            <div style="min-width: 200px">
              <strong>${restaurant.name}</strong><br>
              <span style="color: #f59e0b">★</span> ${restaurant.rating} (${restaurant.review_count} reviews)<br>
              ${restaurant.categories?.map(c => c.title).join(', ') || 'Restaurant'}<br>
              <small>${restaurant.location?.address1 || ''}</small>
            </div>
          `);
        
        clusterGroup.addLayer(marker);
        validRestaurants++;
      } catch (error) {
        console.warn(`❌ Error creating marker for ${restaurant.name}:`, error);
      }
    });

    if (validRestaurants > 0) {
      map.addLayer(clusterGroup);
      restaurantLayerRef.current = clusterGroup;
      console.log(`✅ Added ${validRestaurants} restaurant markers to map`);
    } else {
      console.warn(`⚠️ No valid restaurants to display`);
    }

  }, [showRestaurants, restaurants]);

  return null; // This component doesn't render anything visible
}
