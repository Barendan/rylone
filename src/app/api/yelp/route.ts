// Enhanced Yelp API Route - handles hexagon processing, batch searches, and real-time monitoring
import { NextRequest, NextResponse } from 'next/server';
import { YelpSearchEngine, type HexagonYelpResult } from '@/lib/yelpSearch';
import { hexagonProcessor } from '@/lib/hexagonProcessor';
import { yelpQuotaManager } from '@/lib/apiQuotaManager';
import { yelpRateLimiter } from '@/lib/rateLimiter';

// Initialize Yelp search engine (you'll need to add your API key)
const yelpEngine = new YelpSearchEngine(process.env.YELP_API_KEY || 'demo-key');

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, hexagons, cityName, testMode } = body;

    console.log(`🍕 Yelp API request: ${action} for ${hexagons?.length || 0} hexagons`);

    switch (action) {
      case 'process_hexagons':
        return await processHexagons(hexagons, testMode);
      
      case 'get_processing_status':
        return await getProcessingStatus();
      
      case 'get_quota_status':
        return await getQuotaStatus();
      
      case 'test_coverage':
        return await testCoverage(hexagons?.[0]);
      
             case 'clear_history':
         return await clearHistory();
       
       case 'test_subdivision':
         return await testSubdivision(hexagons?.[0]);
       
       case 'test_h3':
         return await testH3(hexagons?.[0]);
       
       default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Yelp API error:', error);
    return NextResponse.json(
      { error: 'Failed to process Yelp request' },
      { status: 500 }
    );
  }
}

// Process hexagons with Yelp search
async function processHexagons(hexagons: string[] | Array<{ h3Id: string; mapIndex: number; originalIndex: number }>, testMode: boolean = false): Promise<NextResponse> {
  try {
    if (!hexagons || hexagons.length === 0) {
      return NextResponse.json(
        { error: 'No hexagons provided' },
        { status: 400 }
      );
    }

    console.log(`🔧 Processing ${hexagons.length} hexagons with test mode: ${testMode}`);

    // Check quota before processing
    const quotaEstimate = yelpQuotaManager.estimateQuotaForCity(hexagons.length, 7, 1.5);
    
    if (!quotaEstimate.canProcessRequest && !testMode) {
      return NextResponse.json({
        error: 'Insufficient quota',
        quotaEstimate,
        recommendations: quotaEstimate.recommendations
      }, { status: 429 });
    }
    
    // Additional quota check for test mode
    if (testMode) {
      const maxTestHexagons = 10;
      const estimatedCalls = Math.min(hexagons.length, maxTestHexagons) * 3; // Assume 3 search points per hexagon
      const quotaStatus = yelpQuotaManager.getQuotaStatus();
      
      if (quotaStatus.dailyRemaining < estimatedCalls) {
        return NextResponse.json({
          error: 'Insufficient quota for test',
          quotaStatus,
          estimatedCalls,
          recommendations: ['Wait for quota reset', 'Reduce test size', 'Check daily usage']
        }, { status: 429 });
      }
    }

    // SAFETY CHECK: Strict limit for test mode to prevent quota abuse
    let hexagonsToProcess: string[] = [];
    let hexagonIndices: number[] = [];
    
    // Handle both string[] and object[] formats, preserving indices
    if (Array.isArray(hexagons) && hexagons.length > 0) {
      if (typeof hexagons[0] === 'string') {
        // Legacy format: string[]
        hexagonIndices = hexagons.map((_, index) => index);
        hexagonsToProcess = hexagons as string[];
      } else {
        // New format: Array<{ h3Id: string; mapIndex: number; originalIndex: number }>
        const hexagonData = hexagons as Array<{ h3Id: string; mapIndex: number; originalIndex: number }>;
        hexagonsToProcess = hexagonData.map(h => h.h3Id);
        hexagonIndices = hexagonData.map(h => h.originalIndex);
        console.log(`🔢 Processing hexagons with indices:`, hexagonIndices);
      }
    }
    
    if (testMode) {
      // Test mode: use real Yelp API calls on limited hexagons
      const maxTestHexagons = 10; // Strict limit for testing
      hexagonsToProcess = hexagonsToProcess.slice(0, maxTestHexagons);
      hexagonIndices = hexagonIndices.slice(0, maxTestHexagons);
      console.log(`🧪 TEST MODE: Limited to ${maxTestHexagons} hexagons with real Yelp API calls (${hexagons.length} requested)`);
      console.log(`🔢 Test hexagon indices:`, hexagonIndices);
      
      if (hexagons.length > maxTestHexagons) {
        console.log(`⚠️ WARNING: Requested ${hexagons.length} hexagons but limited to ${maxTestHexagons} for testing`);
      }
    }
    
    // Use the unified two-phase processing pipeline
    console.log(`🚀 Starting unified two-phase processing for ${hexagonsToProcess.length} hexagons`);
    
    let results: HexagonYelpResult[] = [];
    
    // Both test and real modes now use the complete two-phase algorithm with Yelp API calls
    try {
      // Phase 1: Process hexagons at resolution 7 with Yelp
      console.log(`📋 PHASE 1: Processing ${hexagonsToProcess.length} hexagons at resolution 7`);
      const phase1Results: HexagonYelpResult[] = [];
      
      for (let i = 0; i < hexagonsToProcess.length; i++) {
        const h3Id = hexagonsToProcess[i];
        const mapIndex = hexagonIndices[i];
        
        try {
          console.log(`🔧 Phase 1: Processing hexagon ${h3Id} (map index: ${mapIndex}) at resolution 7`);
          const yelpResult = await yelpEngine.searchHexagon(h3Id);
          // Add map index to the result
          const resultWithIndex = { ...yelpResult, mapIndex };
          phase1Results.push(resultWithIndex);
          
          // Update hexagon processor with Yelp results
          await hexagonProcessor.processHexagonWithCoverage(h3Id, 7, {
            totalBusinesses: yelpResult.totalBusinesses,
            status: yelpResult.status,
            coverageQuality: yelpResult.coverageQuality
          });
          
          // Check if this hexagon needs subdivision
          if (yelpResult.status === 'split' && yelpResult.totalBusinesses > 240) {
            console.log(`🔀 Phase 1: Hexagon ${h3Id} marked for subdivision (${yelpResult.totalBusinesses} businesses)`);
            // The subdivision is already handled in YelpSearchEngine.processSearchResults
          }
          
        } catch (error) {
          console.error(`❌ Phase 1: Error processing hexagon ${h3Id}:`, error);
          phase1Results.push({
            h3Id,
            mapIndex, // Include the map index for correlation
            totalBusinesses: 0,
            uniqueBusinesses: [],
            searchResults: [],
            status: 'failed',
            coverageQuality: 'unknown',
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
      
      console.log(`✅ Phase 1 completed: ${phase1Results.length} hexagons processed`);
      
      // Phase 2: Process subdivision queue (resolution 8 hexagons)
      console.log(`📋 PHASE 2: Processing subdivision queue for resolution 8 hexagons`);
      const subdivisionResults = await hexagonProcessor.processSubdivisionQueue();
      
      console.log(`✅ Phase 2 completed: ${subdivisionResults.length} subdivision hexagons processed`);
      
      // Process subdivision hexagons with Yelp
      const phase2Results: HexagonYelpResult[] = [];
      for (const subdivisionHex of subdivisionResults) {
        if (subdivisionHex.status === 'fetched') {
          try {
            console.log(`🔀 Phase 2: Processing subdivision hexagon ${subdivisionHex.h3Id} at resolution 8`);
            const yelpResult = await yelpEngine.searchHexagon(subdivisionHex.h3Id);
            phase2Results.push(yelpResult);
          } catch (error) {
            console.error(`❌ Phase 2: Error processing subdivision hexagon ${subdivisionHex.h3Id}:`, error);
            phase2Results.push({
              h3Id: subdivisionHex.h3Id,
              totalBusinesses: 0,
              uniqueBusinesses: [],
              searchResults: [],
              status: 'failed',
              coverageQuality: 'unknown',
              error: error instanceof Error ? error.message : 'Unknown error'
            });
          }
        }
      }
      
      // Combine all results
      results = [...phase1Results, ...phase2Results];
      
      console.log(`🎯 Two-phase processing completed: ${results.length} total results`);
      
    } catch (error) {
      console.error(`❌ Error in two-phase processing:`, error);
      throw error;
    }

    // Get comprehensive processing statistics and subdivision information
    const processingStats = hexagonProcessor.getProcessingStats();
    const quotaStatus = yelpQuotaManager.getQuotaStatus();
    const subdivisionQueueStatus = hexagonProcessor.getSubdivisionQueueStatus();
    const resultsByResolution = hexagonProcessor.getResultsByResolution();
    const mergedResults = hexagonProcessor.getMergedResults();

    console.log(`✅ Hexagon processing completed: ${results.length} results`);
    console.log(`📊 Processing stats:`, processingStats);
    console.log(`📊 Quota status:`, quotaStatus);
    console.log(`📊 Subdivision queue status:`, subdivisionQueueStatus);
    console.log(`📊 Results by resolution:`, resultsByResolution);

    return NextResponse.json({
      success: true,
      results,
      processingStats,
      quotaStatus,
      subdivisionQueueStatus,
      resultsByResolution,
      mergedResults,
      testMode,
      limitedHexagons: testMode ? Math.min(hexagons.length, 10) : hexagons.length,
      totalRequested: hexagons.length,
      processedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error processing hexagons:', error);
    return NextResponse.json(
      { error: 'Failed to process hexagons', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Get current processing status
async function getProcessingStatus(): Promise<NextResponse> {
  try {
    const processingStats = hexagonProcessor.getProcessingStats();
    const quotaStatus = yelpQuotaManager.getQuotaStatus();
    const rateLimitStatus = yelpRateLimiter.getQuotaStatus();

    return NextResponse.json({
      processingStats,
      quotaStatus,
      rateLimitStatus,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error getting processing status:', error);
    return NextResponse.json(
      { error: 'Failed to get processing status' },
      { status: 500 }
    );
  }
}

// Get quota status and recommendations
async function getQuotaStatus(): Promise<NextResponse> {
  try {
    const quotaStatus = yelpQuotaManager.getQuotaStatus();
    const usageTrends = yelpQuotaManager.getUsageTrends();
    const detailedReport = yelpQuotaManager.getDetailedReport();

    return NextResponse.json({
      quotaStatus,
      usageTrends,
      detailedReport,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error getting quota status:', error);
    return NextResponse.json(
      { error: 'Failed to get quota status' },
      { status: 500 }
    );
  }
}

// Test coverage for a single hexagon
async function testCoverage(h3Id: string): Promise<NextResponse> {
  try {
    if (!h3Id) {
      return NextResponse.json(
        { error: 'No hexagon ID provided' },
        { status: 400 }
      );
    }

    console.log(`🧪 Testing coverage for hexagon ${h3Id}`);

    // Process hexagon with coverage strategy (test mode)
    const coverageResult = await hexagonProcessor.processHexagonWithCoverage(h3Id);

    return NextResponse.json({
      success: true,
      hexagonId: h3Id,
      coverageResult,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error testing coverage:', error);
    return NextResponse.json(
      { error: 'Failed to test coverage', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

 // Test H3 functionality
 async function testH3(h3Id: string): Promise<NextResponse> {
   try {
     if (!h3Id) {
       return NextResponse.json(
         { error: 'No hexagon ID provided' },
         { status: 400 }
       );
     }
 
     console.log(`🧪 Testing H3 functionality for hexagon ${h3Id}`);
 
     // Test basic H3 operations
     const h3 = await import('h3-js');
     
     // Check if hexagon ID is valid
     const isValid = h3.isValidCell(h3Id);
     const resolution = h3.getResolution(h3Id);
     const center = h3.cellToLatLng(h3Id);
     const boundary = h3.cellToBoundary(h3Id, true);
     
     console.log(`🔍 H3 test results for ${h3Id}`);
 
     return NextResponse.json({
       success: true,
       hexagonId: h3Id,
       isValid,
       resolution,
       center,
       boundaryPoints: boundary.length,
       timestamp: new Date().toISOString()
     });
 
   } catch (error) {
     console.error('Error testing H3:', error);
     return NextResponse.json(
       { error: 'Failed to test H3', details: error instanceof Error ? error.message : 'Unknown error' },
       { status: 500 }
     );
   }
 }
 
 // Test subdivision functionality
 async function testSubdivision(h3Id: string): Promise<NextResponse> {
   try {
     if (!h3Id) {
       return NextResponse.json(
         { error: 'No hexagon ID provided' },
         { status: 400 }
       );
     }
 
     console.log(`🧪 Testing subdivision for hexagon ${h3Id}`);
 
     // Simulate a dense hexagon by calling handleDenseHexagons directly
     const denseResult = await hexagonProcessor.handleDenseHexagons(h3Id, 300, 7);
     
     // Get subdivision queue status
     const subdivisionStatus = hexagonProcessor.getSubdivisionQueueStatus();
     const processingStats = hexagonProcessor.getProcessingStats();
     
     console.log(`🔀 Subdivision test completed for ${h3Id}`);
 
     return NextResponse.json({
       success: true,
       hexagonId: h3Id,
       denseResult,
       subdivisionStatus,
       processingStats,
       timestamp: new Date().toISOString()
     });
 
   } catch (error) {
     console.error('Error testing subdivision:', error);
     return NextResponse.json(
       { error: 'Failed to test subdivision', details: error instanceof Error ? error.message : 'Unknown error' },
       { status: 500 }
     );
   }
 }
 
 // Clear processing history
 async function clearHistory(): Promise<NextResponse> {
   try {
     hexagonProcessor.clearHistory();
     yelpQuotaManager.resetQuota();
     yelpRateLimiter.resetDailyQuota();
 
     console.log(`🧹 Processing history cleared`);
 
     return NextResponse.json({
       success: true,
       message: 'Processing history cleared',
       timestamp: new Date().toISOString()
     });
 
   } catch (error) {
     console.error('Error clearing history:', error);
     return NextResponse.json(
       { error: 'Failed to clear history' },
       { status: 500 }
     );
   }
 }

// GET endpoint for status checks
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    switch (action) {
      case 'status':
        return await getProcessingStatus();
      
      case 'quota':
        return await getQuotaStatus();
      
      default:
        return NextResponse.json({
          message: 'Yelp API endpoint',
          availableActions: ['status', 'quota'],
          timestamp: new Date().toISOString()
        });
    }

  } catch (error) {
    console.error('Yelp API GET error:', error);
    return NextResponse.json(
      { error: 'Failed to process GET request' },
      { status: 500 }
    );
  }
}
