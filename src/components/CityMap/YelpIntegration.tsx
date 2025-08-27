'use client';

import { useState } from 'react';
import { EnhancedCityResponse } from '@/lib/geo';

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

interface ProcessingStatus {
  processingStats?: {
    queued: number;
    processing: number;
    completed: number;
    failed: number;
    split: number;
  };
}

interface QuotaStatus {
  quotaStatus?: {
    dailyUsed: number;
    dailyLimit: number;
    dailyUsagePercentage: number;
    perSecondUsed: number;
    perSecondLimit: number;
    lastReset: Date;
  };
}

interface YelpIntegrationProps {
  cityData: EnhancedCityResponse | null;
  onResultsUpdate: (results: YelpTestResult) => void;
}

export default function YelpIntegration({ cityData, onResultsUpdate }: YelpIntegrationProps) {
  const [yelpTesting, setYelpTesting] = useState(false);
  const [yelpResults, setYelpResults] = useState<YelpTestResult | null>(null);
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus | null>(null);
  const [quotaStatus, setQuotaStatus] = useState<QuotaStatus | null>(null);
  const [testMode, setTestMode] = useState(false); // Toggle between test and real mode

  if (!cityData || !cityData.h3_grid || cityData.h3_grid.length === 0) {
    return null;
  }

  // Helper function to get random hexagons with geographic distribution
  const getRandomHexagons = (hexagons: string[], count: number): string[] => {
    if (hexagons.length <= count) return hexagons;
    
    // Simple random selection for now - can be enhanced with stratification later
    const shuffled = [...hexagons].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  };

  // Add Yelp testing function
  const testYelpIntegration = async () => {
    if (!cityData?.h3_grid || cityData.h3_grid.length === 0) {
      console.error('No H3 grid available for Yelp testing');
      return;
    }

    setYelpTesting(true);
    
    try {
      console.log(`🍕 Testing Yelp integration with ${cityData.h3_grid.length} hexagons`);
      
      let hexagonData: Array<{ h3Id: string; mapIndex: number; originalIndex: number }>;
      
      if (testMode) {
        // Test Mode: Use 10 randomly selected hexagons with real Yelp API calls
        const maxTestHexagons = 10;
        const randomHexagons = getRandomHexagons(cityData.h3_grid, maxTestHexagons);
        
        hexagonData = randomHexagons.map((h3Id, index) => ({
          h3Id,
          mapIndex: cityData.h3_grid.indexOf(h3Id), // Use actual grid index
          originalIndex: cityData.h3_grid.indexOf(h3Id)
        }));
        
        console.log(`🧪 TEST MODE: Using ${hexagonData.length} randomly selected hexagons with real Yelp API calls`);
      } else {
        // Real Mode: Use all hexagons with real Yelp API calls
        hexagonData = cityData.h3_grid.map((h3Id, index) => ({
          h3Id,
          mapIndex: index,
          originalIndex: index
        }));
        
        console.log(`🍕 REAL MODE: Using all ${hexagonData.length} hexagons with real Yelp API calls`);
      }
      
      console.log(`🔢 Hexagon data with indices:`, hexagonData);
      
      const response = await fetch('/api/yelp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'process_hexagons',
          hexagons: hexagonData,
          cityName: cityData.name,
          testMode: testMode
        }),
      });

      if (!response.ok) {
        throw new Error(`Yelp API error: ${response.status}`);
      }

      const result = await response.json();
      setYelpResults(result);
      onResultsUpdate(result);
      
      console.log('✅ Yelp integration test completed:', result);
      
    } catch (error) {
      console.error('❌ Yelp integration test failed:', error);
      const errorResult = { error: error instanceof Error ? error.message : 'Unknown error' };
      setYelpResults(errorResult);
      onResultsUpdate(errorResult);
    } finally {
      setYelpTesting(false);
    }
  };

  // Add function to get processing status
  const getProcessingStatus = async () => {
    try {
      const response = await fetch('/api/yelp?action=status');
      if (response.ok) {
        const status = await response.json();
        setProcessingStatus(status);
      }
    } catch (error) {
      console.error('Error getting processing status:', error);
    }
  };

  // Add function to get quota status
  const getQuotaStatus = async () => {
    try {
      const response = await fetch('/api/yelp?action=quota');
      if (response.ok) {
        const quota = await response.json();
        setQuotaStatus(quota);
      }
    } catch (error) {
      console.error('Error getting quota status:', error);
    }
  };

  return (
    <div className="mt-4 p-4 bg-white rounded-lg shadow-md">
      <h3 className="text-lg font-semibold mb-3">🍕 Yelp Integration Testing</h3>
      
      {/* Safety Warning for Test Mode */}
      <div className="mb-4 p-3 bg-yellow-100 border border-yellow-300 rounded">
        <p className="text-sm text-yellow-800">
          <strong>🧪 TEST MODE:</strong> Limited to maximum 10 hexagons to protect your Yelp API quota.
          Each hexagon uses ~3-5 API calls.
        </p>
      </div>
      
      <div className="space-y-3">
        {/* Correlation Legend */}
        <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded">
          <p className="text-sm text-blue-800 font-medium mb-2">🔢 Hexagon Number Correlation:</p>
          <p className="text-xs text-blue-700">
            The numbers on the map (0, 1, 2, 3...) now match the hexagon numbers in the test results below. 
            This helps you correlate what you see on the map with the Yelp data.
          </p>
        </div>
        
        {/* API Call Estimation Display */}
        <div className="mb-3 p-3 bg-orange-50 border border-orange-200 rounded">
          <p className="text-sm text-orange-800 font-medium mb-2">📊 API Call Estimation:</p>
          <div className="text-xs text-orange-700 space-y-1">
            <div className="flex justify-between">
              <span>Total Hexagons:</span>
              <span className="font-mono font-medium">{cityData.h3_grid.length}</span>
            </div>
            <div className="flex justify-between">
              <span>Estimated Search Points per Hexagon:</span>
              <span className="font-mono font-medium">3-5 points</span>
            </div>
            <div className="flex justify-between">
              <span>Test Mode (10 random hexagons):</span>
              <span className="font-mono font-medium text-orange-600">
                ~30 API calls
              </span>
            </div>
            <div className="flex justify-between">
              <span>Real Mode (all hexagons):</span>
              <span className="font-mono font-medium text-red-600">
                ~{cityData.h3_grid.length * 4} API calls
              </span>
            </div>
            <div className="text-xs text-orange-600 mt-2 font-medium">
              💡 Test mode now uses real Yelp API calls on 10 randomly selected hexagons
            </div>
          </div>
        </div>
        
        {/* Test Mode Toggle */}
        <div className="mb-3 p-3 bg-purple-50 border border-purple-200 rounded">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-purple-800 font-medium mb-1">🧪 Test Mode:</p>
              <p className="text-xs text-purple-700">
                {testMode 
                  ? "Real Yelp API calls on 10 random hexagons (~30 API calls)" 
                  : "Real Yelp API calls on all hexagons (~" + (cityData.h3_grid.length * 4) + " API calls)"
                }
              </p>
            </div>
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={testMode}
                onChange={() => setTestMode(!testMode)}
                className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
              />
              <span className="text-sm font-medium text-purple-700">
                Test Mode
              </span>
            </label>
          </div>
        </div>
        
        <button
          onClick={testYelpIntegration}
          disabled={yelpTesting}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 flex items-center space-x-2"
        >
          {yelpTesting ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              <span>Testing Yelp Integration...</span>
            </>
          ) : (
            <>
              <span>🍕</span>
              <span>
                {testMode 
                  ? "Test Coverage (No API Calls)" 
                  : "Search Yelp (Uses API Quota)"
                }
              </span>
            </>
          )}
        </button>
        
        <button
          onClick={getProcessingStatus}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 ml-2"
        >
          Get Status
        </button>
        
        <button
          onClick={getQuotaStatus}
          className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 ml-2"
        >
          Get Quota
        </button>
      </div>
      
      {/* Display Yelp test results */}
      {yelpResults && (
        <div className={`mt-4 p-4 rounded-lg border ${
          yelpResults.error 
            ? 'bg-red-50 border-red-300' 
            : 'bg-green-50 border-green-300'
        }`}>
          <h4 className={`font-medium mb-3 flex items-center ${
            yelpResults.error ? 'text-red-800' : 'text-green-800'
          }`}>
            {yelpResults.error ? '❌ Test Failed' : '✅ Test Completed Successfully'}
          </h4>
          {yelpResults.error ? (
            <div className="text-red-700 font-medium bg-red-100 p-3 rounded border border-red-200">
              {yelpResults.error}
            </div>
          ) : (
            <div className="text-sm space-y-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white p-3 rounded border">
                  <div className="text-2xl font-bold text-green-600">{yelpResults.results?.length || 0}</div>
                  <div className="text-xs text-gray-600">Hexagons Processed</div>
                </div>
                <div className="bg-white p-3 rounded border">
                  <div className="text-2xl font-bold text-blue-600">{yelpResults.testMode ? 'Yes' : 'No'}</div>
                  <div className="text-xs text-gray-600">Test Mode</div>
                </div>
              </div>
              <div className="text-xs text-gray-600 bg-white p-2 rounded border">
                ⏰ Processed at: {yelpResults.processedAt}
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Display processing status */}
      {processingStatus && (
        <div className="mt-4 p-3 bg-blue-50 rounded border border-blue-300">
          <h4 className="font-medium mb-2 text-blue-800">Processing Status:</h4>
          <div className="text-sm space-y-1 text-blue-900">
            <div className="font-medium">📊 Queued: {processingStatus.processingStats?.queued || 0}</div>
            <div>🔧 Processing: {processingStatus.processingStats?.processing || 0}</div>
            <div>✅ Completed: {processingStatus.processingStats?.completed || 0}</div>
            <div>❌ Failed: {processingStatus.processingStats?.failed || 0}</div>
            <div>🔀 Split: {processingStatus.processingStats?.split || 0}</div>
          </div>
        </div>
      )}
      
      {/* Display quota status */}
      {quotaStatus && (
        <div className="mt-4 p-3 bg-yellow-50 rounded border border-yellow-300">
          <h4 className="font-medium mb-2 text-yellow-800">Quota Status:</h4>
          <div className="text-sm space-y-1 text-yellow-900">
            <div className="font-medium">📊 Daily Usage: {quotaStatus.quotaStatus?.dailyUsed || 0}/{quotaStatus.quotaStatus?.dailyLimit || 0}</div>
            <div>📈 Usage: {quotaStatus.quotaStatus?.dailyUsagePercentage?.toFixed(1) || 0}%</div>
            <div>⏰ Per Second: {quotaStatus.quotaStatus?.perSecondUsed || 0}/{quotaStatus.quotaStatus?.perSecondLimit || 0}</div>
            <div>🔄 Last Reset: {quotaStatus.quotaStatus?.lastReset?.toLocaleString() || 'Unknown'}</div>
          </div>
        </div>
      )}
    </div>
  );
}
