
#!/usr/bin/env node

const { SkyIQMCPServer } = require('./server/mcpServer');

async function getMCPDataForUser3() {
  console.log('🔍 Getting MCP data for User 3...\n');
  
  try {
    // Test business intelligence
    console.log('📊 Getting business intelligence...');
    const biResult = await simulateMCPCall('get_business_intelligence', {
      userId: 3,
      refreshWebContent: false
    });
    console.log('Business Intelligence:', JSON.stringify(biResult, null, 2));

    console.log('\n📞 Getting call analytics...');
    const callResult = await simulateMCPCall('get_call_analytics', {
      userId: 3,
      days: 30
    });
    console.log('Call Analytics:', JSON.stringify(callResult, null, 2));

    console.log('\n🔍 Searching documents...');
    const searchResult = await simulateMCPCall('search_business_documents', {
      userId: 3,
      query: 'business services',
      limit: 5
    });
    console.log('Document Search:', JSON.stringify(searchResult, null, 2));

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Simulate MCP tool call
async function simulateMCPCall(toolName, args) {
  // Import your services directly
  const { dataAggregationService } = require('./server/dataAggregationService');
  const { ragService } = require('./server/ragService');
  const { storage } = require('./server/storage');

  switch (toolName) {
    case 'get_business_intelligence':
      return await dataAggregationService.aggregateBusinessData(
        args.userId, 
        args.refreshWebContent
      );
      
    case 'get_call_analytics':
      const calls = await storage.getCalls(args.userId);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - args.days);
      
      const recentCalls = calls.filter(call => 
        call.createdAt && new Date(call.createdAt) >= cutoffDate
      );

      return {
        totalCalls: recentCalls.length,
        averageDuration: recentCalls.length > 0 
          ? Math.round(recentCalls.reduce((sum, call) => sum + (call.duration || 0), 0) / recentCalls.length)
          : 0,
        statusBreakdown: {
          completed: recentCalls.filter(c => c.status === 'completed').length,
          missed: recentCalls.filter(c => c.status === 'missed').length,
          failed: recentCalls.filter(c => c.status === 'failed').length,
        },
        directionBreakdown: {
          inbound: recentCalls.filter(c => c.direction === 'inbound').length,
          outbound: recentCalls.filter(c => c.direction === 'outbound').length,
        }
      };
      
    case 'search_business_documents':
      return await ragService.searchDocuments(args.userId, args.query, args.limit);
      
    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

getMCPDataForUser3();
