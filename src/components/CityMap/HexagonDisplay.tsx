'use client';

import { useState } from 'react';

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

interface HexagonDisplayProps {
  yelpResults: YelpTestResult | null;
}

export default function HexagonDisplay({ yelpResults }: HexagonDisplayProps) {
  const [expandedHexagons, setExpandedHexagons] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'summary' | 'details' | 'restaurants'>('summary');

  if (!yelpResults || !yelpResults.results || yelpResults.results.length === 0) {
    return null;
  }

  // Helper functions
  const toggleHexagonExpansion = (h3Id: string) => {
    const newExpanded = new Set(expandedHexagons);
    if (newExpanded.has(h3Id)) {
      newExpanded.delete(h3Id);
    } else {
      newExpanded.add(h3Id);
    }
    setExpandedHexagons(newExpanded);
  };

  const getAllRestaurants = () => {
    if (!yelpResults?.results) return [];
    const allBusinesses = yelpResults.results.flatMap(result => result.uniqueBusinesses || []);
    
    // Deduplicate by business ID
    const uniqueMap = new Map<string, Restaurant>();
    allBusinesses.forEach(business => {
      if (!uniqueMap.has(business.id)) {
        uniqueMap.set(business.id, business);
      }
    });
    
    return Array.from(uniqueMap.values());
  };

  const getDeduplicationStats = () => {
    if (!yelpResults?.results) return { total: 0, unique: 0, duplicates: 0 };
    
    const allBusinesses = yelpResults.results.flatMap(result => result.uniqueBusinesses || []);
    const uniqueBusinesses = getAllRestaurants();
    
    return {
      total: allBusinesses.length,
      unique: uniqueBusinesses.length,
      duplicates: allBusinesses.length - uniqueBusinesses.length
    };
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'fetched': return 'text-green-600 bg-green-100';
      case 'failed': return 'text-red-600 bg-red-100';
      case 'dense': return 'text-yellow-600 bg-yellow-100';
      case 'split': return 'text-blue-600 bg-blue-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'fetched': return '✅';
      case 'failed': return '❌';
      case 'dense': return '🔀';
      case 'split': return '📊';
      default: return '❓';
    }
  };

  return (
    <div className="mt-8 space-y-8">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">🎯 Hexagon Display Showcase</h2>
        <p className="text-gray-600">Compare three different ways to view your hexagon data</p>
      </div>

      {/* METHOD 1: Expandable Hexagon Cards */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200 shadow-lg">
        <h3 className="text-xl font-bold text-blue-800 mb-4 flex items-center">
          <span className="mr-2">🎴</span>
          METHOD 1: Expandable Hexagon Cards
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {yelpResults.results.map((result) => (
            <div key={result.h3Id} className="bg-white rounded-lg border border-blue-200 shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1 hover:border-blue-300">
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-mono text-blue-600 bg-blue-50 px-2 py-1 rounded">
                    🔢 Hexagon {result.mapIndex !== undefined ? result.mapIndex : '?'}
                  </span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(result.status)}`}>
                    {getStatusIcon(result.status)} {result.status}
                  </span>
                </div>
                <div className="text-center mb-3">
                  <div className="text-2xl font-bold text-blue-600">{result.totalBusinesses}</div>
                  <div className="text-sm text-gray-600">Restaurants</div>
                </div>
                <button
                  onClick={() => toggleHexagonExpansion(result.h3Id)}
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition-all duration-200 hover:scale-105 active:scale-95 font-medium"
                >
                  {expandedHexagons.has(result.h3Id) ? '🔽 Collapse Details' : '🔼 Expand Details'}
                </button>
              </div>
              
              {/* Expanded Content */}
              {expandedHexagons.has(result.h3Id) && (
                <div className="border-t border-blue-200 p-4 bg-blue-50">
                  <div className="text-sm text-gray-700 mb-3">
                    <div>Coverage: <span className="font-medium">{result.coverageQuality}</span></div>
                    {result.error && <div className="text-red-600 mt-1">Error: {result.error}</div>}
                  </div>
                  {result.uniqueBusinesses && result.uniqueBusinesses.length > 0 ? (
                    <div className="space-y-3 max-h-60 overflow-y-auto">
                      {result.uniqueBusinesses.slice(0, 5).map((restaurant, idx) => (
                        <div key={idx} className="bg-white p-3 rounded-lg border border-blue-100 shadow-sm">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="font-semibold text-gray-800 text-sm">{restaurant.name}</div>
                              <div className="flex items-center space-x-2 mt-1">
                                <span className="text-yellow-600">⭐ {restaurant.rating}</span>
                                <span className="text-green-600 font-medium">{restaurant.price}</span>
                                <span className="text-blue-600 text-xs bg-blue-50 px-2 py-1 rounded">
                                  {restaurant.categories[0]?.title}
                                </span>
                              </div>
                              <div className="text-xs text-gray-600 mt-2">
                                📍 {restaurant.location.address1}, {restaurant.location.city}
                              </div>
                            </div>
                            <div className="text-right text-xs text-gray-600 ml-3">
                              <div className="text-purple-600 font-medium">{restaurant.distance}m</div>
                              <div className="text-gray-500">📞 {restaurant.phone}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                      {result.uniqueBusinesses.length > 5 && (
                        <div className="text-center text-xs text-gray-500 bg-white p-2 rounded border">
                          +{result.uniqueBusinesses.length - 5} more restaurants
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-gray-500 text-sm text-center bg-white p-4 rounded border">No restaurants found</div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* METHOD 2: Tabbed Interface */}
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-6 border border-green-200 shadow-lg">
        <h3 className="text-xl font-bold text-green-800 mb-4 flex items-center">
          <span className="mr-2">📋</span>
          METHOD 2: Tabbed Interface
        </h3>
        
        {/* Tab Navigation */}
        <div className="flex space-x-1 mb-4 bg-white rounded-lg p-1 border border-green-200 shadow-sm">
          {(['summary', 'details', 'restaurants'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 px-4 rounded-md text-sm font-medium transition-all duration-200 ${
                activeTab === tab
                  ? 'bg-gradient-to-r from-green-600 to-green-700 text-white shadow-lg transform scale-105'
                  : 'text-green-600 hover:bg-green-50 hover:scale-102'
              }`}
            >
              {tab === 'summary' && '📊 Summary'}
              {tab === 'details' && '🔍 Details'}
              {tab === 'restaurants' && '🍕 Restaurants'}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-lg border border-green-200 p-4 min-h-48">
          {activeTab === 'summary' && (
            <div className="space-y-6">
              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-xl border border-green-200">
                  <div className="text-3xl font-bold text-green-600">{yelpResults.processingStats?.totalHexagons || 0}</div>
                  <div className="text-sm text-green-700 font-medium">Total Hexagons</div>
                  <div className="text-xs text-green-600 mt-1">🗺️ Coverage Area</div>
                </div>
                <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border border-blue-200">
                  <div className="text-3xl font-bold text-blue-600">{yelpResults.processingStats?.successfulHexagons || 0}</div>
                  <div className="text-sm text-blue-700 font-medium">Successful</div>
                  <div className="text-xs text-blue-600 mt-1">✅ Processed</div>
                </div>
                <div className="text-center p-4 bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-xl border border-yellow-200">
                  <div className="text-3xl font-bold text-yellow-600">{getAllRestaurants().length}</div>
                  <div className="text-sm text-yellow-700 font-medium">Total Restaurants</div>
                  <div className="text-xs text-yellow-600 mt-1">🍕 Found</div>
                </div>
                <div className="text-center p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl border border-purple-200">
                  <div className="text-3xl font-bold text-purple-600">{yelpResults.processingStats?.failedHexagons || 0}</div>
                  <div className="text-sm text-purple-700 font-medium">Failed</div>
                  <div className="text-xs text-purple-600 mt-1">❌ Issues</div>
                </div>
              </div>
              
              {/* Deduplication Statistics */}
              {getDeduplicationStats().duplicates > 0 && (
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-4 border border-green-200 mb-4">
                  <div className="text-sm text-green-800">
                    <span className="font-medium">Deduplication:</span> Found {getDeduplicationStats().total} restaurants, 
                    removed {getDeduplicationStats().duplicates} duplicates, 
                    showing {getDeduplicationStats().unique} unique restaurants
                  </div>
                </div>
              )}
              
              {/* Progress Bar */}
              <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg p-4 border border-gray-200">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm font-medium text-gray-700 flex items-center">
                    📊 Processing Progress
                  </span>
                  <span className="text-sm text-gray-600 bg-white px-3 py-1 rounded-full border">
                    {yelpResults.processingStats?.successfulHexagons || 0} / {yelpResults.processingStats?.totalHexagons || 0}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-4 shadow-inner">
                  <div 
                    className="bg-gradient-to-r from-green-400 via-green-500 to-green-600 h-4 rounded-full transition-all duration-700 ease-out shadow-sm"
                    style={{ 
                      width: `${yelpResults.processingStats?.totalHexagons ? 
                        (yelpResults.processingStats.successfulHexagons / yelpResults.processingStats.totalHexagons) * 100 : 0}%` 
                    }}
                  ></div>
                </div>
                <div className="mt-2 text-xs text-gray-500 text-center">
                  {yelpResults.processingStats?.totalHexagons ? 
                    Math.round((yelpResults.processingStats.successfulHexagons / yelpResults.processingStats.totalHexagons) * 100) : 0}% Complete
                </div>
              </div>
            </div>
          )}

          {activeTab === 'details' && (
            <div className="space-y-3">
              {yelpResults.results.map((result) => (
                <div key={result.h3Id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(result.status)}`}>
                      {getStatusIcon(result.status)} {result.status}
                    </span>
                    <span className="font-mono text-sm text-gray-600 bg-blue-100 px-2 py-1 rounded">
                      🔢 Hexagon {result.mapIndex !== undefined ? result.mapIndex : '?'}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="font-medium text-gray-800">{result.totalBusinesses} restaurants</div>
                    <div className="text-sm text-gray-600">{result.coverageQuality} coverage</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'restaurants' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-lg font-semibold text-gray-800">🍕 Restaurant Directory</h4>
                <span className="text-sm text-gray-600 bg-gray-100 px-3 py-1 rounded-full">
                  {getAllRestaurants().length} total restaurants
                </span>
              </div>
              
              {getAllRestaurants().slice(0, 10).map((restaurant, idx) => (
                <div key={restaurant.id || idx} className="bg-gradient-to-r from-gray-50 to-white p-4 rounded-xl border border-gray-200 hover:shadow-md transition-all duration-200">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h5 className="font-semibold text-gray-800 text-lg">{restaurant.name}</h5>
                        <span className="text-yellow-600 text-lg">⭐ {restaurant.rating}</span>
                        <span className="bg-green-100 text-green-800 text-xs font-medium px-3 py-1 rounded-full">
                          {restaurant.price}
                        </span>
                      </div>
                      <div className="flex items-center space-x-4 text-sm text-gray-600 mb-2">
                        <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded">
                          {restaurant.categories[0]?.title}
                        </span>
                        <span>📍 {restaurant.location.city}, {restaurant.location.state}</span>
                        <span>📞 {restaurant.phone}</span>
                      </div>
                      <div className="text-xs text-gray-500">
                        📍 {restaurant.location.address1}, {restaurant.location.zip_code}
                      </div>
                    </div>
                    <div className="text-right ml-4">
                      <div className="text-purple-600 font-bold text-lg">{restaurant.distance}m</div>
                      <div className="text-xs text-gray-500">away</div>
                      <a 
                        href={restaurant.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-block mt-2 bg-purple-600 text-white text-xs px-3 py-1 rounded hover:bg-purple-700 transition-colors"
                      >
                        View on Yelp
                      </a>
                    </div>
                  </div>
                </div>
              ))}
              
              {getAllRestaurants().length > 10 && (
                <div className="text-center bg-gradient-to-r from-purple-50 to-pink-50 p-4 rounded-xl border border-purple-200">
                  <div className="text-purple-600 font-medium">+{getAllRestaurants().length - 10} more restaurants</div>
                  <div className="text-sm text-purple-500 mt-1">Scroll to see all results</div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* METHOD 3: Searchable Accordion */}
      <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-6 border border-purple-200 shadow-lg">
        <h3 className="text-xl font-bold text-purple-800 mb-4 flex items-center">
          <span className="mr-2">🔍</span>
          METHOD 3: Searchable Accordion
        </h3>
        
        {/* Search Box */}
        <div className="mb-4">
          <div className="relative">
            <input
              type="text"
              placeholder="🔍 Search restaurants by name, category, or hexagon status..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-3 border border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent pr-20 shadow-sm hover:shadow-md transition-all duration-200"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-purple-100 text-purple-600 px-3 py-1 rounded-full text-sm hover:bg-purple-200 transition-all duration-200 hover:scale-110"
              >
                ✕ Clear
              </button>
            )}
          </div>
          <div className="mt-2 flex items-center justify-between text-sm">
            <span className="text-gray-600">
              {searchTerm ? 'Filtered results' : 'All hexagons'} • 
              {yelpResults.results.filter(result => {
                if (!searchTerm) return true;
                const hasMatchingRestaurants = result.uniqueBusinesses?.some(restaurant => 
                  restaurant.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  restaurant.categories.some(cat => cat.title.toLowerCase().includes(searchTerm.toLowerCase()))
                );
                return hasMatchingRestaurants || result.status.toLowerCase().includes(searchTerm.toLowerCase());
              }).length} hexagons
            </span>
            {searchTerm && (
              <span className="text-purple-600 font-medium">
                "{searchTerm}" found in {yelpResults.results.filter(result => {
                  if (!searchTerm) return true;
                  const hasMatchingRestaurants = result.uniqueBusinesses?.some(restaurant => 
                    restaurant.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    restaurant.categories.some(cat => cat.title.toLowerCase().includes(searchTerm.toLowerCase()))
                  );
                  return hasMatchingRestaurants || result.status.toLowerCase().includes(searchTerm.toLowerCase());
                }).length} hexagons
              </span>
            )}
          </div>
        </div>

        {/* Accordion Sections */}
        <div className="space-y-3">
          {yelpResults.results
            .filter(result => {
              if (!searchTerm) return true;
              // Filter by hexagon status or if it contains matching restaurants
              const hasMatchingRestaurants = result.uniqueBusinesses?.some(restaurant => 
                restaurant.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                restaurant.categories.some(cat => cat.title.toLowerCase().includes(searchTerm.toLowerCase()))
              );
              return hasMatchingRestaurants || result.status.toLowerCase().includes(searchTerm.toLowerCase());
            })
            .map((result) => (
            <div key={result.h3Id} className="bg-white rounded-lg border border-purple-200 shadow-sm">
              <button
                onClick={() => toggleHexagonExpansion(result.h3Id)}
                className="w-full p-4 text-left flex items-center justify-between hover:bg-purple-50 transition-all duration-200 hover:shadow-md"
              >
                <div className="flex items-center space-x-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(result.status)}`}>
                    {getStatusIcon(result.status)} {result.status}
                  </span>
                  <span className="font-mono text-sm text-gray-600">{result.h3Id.slice(-8)}...</span>
                  <span className="text-sm text-gray-600">({result.totalBusinesses} restaurants)</span>
                </div>
                <span className="text-purple-600">
                  {expandedHexagons.has(result.h3Id) ? '▼' : '▶'}
                </span>
              </button>
              
              {/* Accordion Content */}
              {expandedHexagons.has(result.h3Id) && (
                <div className="border-t border-purple-200 p-4 bg-purple-50">
                  <div className="space-y-3">
                    {result.uniqueBusinesses && result.uniqueBusinesses.length > 0 ? (
                      result.uniqueBusinesses.map((restaurant, idx) => (
                        <div key={restaurant.id || idx} className="bg-white p-3 rounded-lg border border-purple-100 shadow-sm hover:shadow-md transition-all duration-200 hover:border-purple-200">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-medium text-gray-800">{restaurant.name}</div>
                              <div className="text-sm text-gray-600">
                                ⭐ {restaurant.rating} • {restaurant.price} • {restaurant.categories[0]?.title}
                              </div>
                              <div className="text-xs text-gray-500">
                                📍 {restaurant.location.address1}, {restaurant.location.city}, {restaurant.location.state}
                              </div>
                            </div>
                            <div className="text-right text-sm text-gray-600">
                              <div className="text-purple-600 font-medium">{restaurant.distance}m away</div>
                              <div className="text-gray-500">📞 {restaurant.phone}</div>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-gray-500 text-sm text-center py-4">No restaurants found in this hexagon</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
