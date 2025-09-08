
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool
} from '@modelcontextprotocol/sdk/types.js';
import { ragService } from './ragService';
import { dataAggregationService } from './dataAggregationService';
import { storage } from './storage';

class SkyIQMCPServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: 'skyiq-business-intelligence',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
  }

  private setupToolHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'search_business_documents',
            description: 'Search through processed business documents using RAG',
            inputSchema: {
              type: 'object',
              properties: {
                userId: {
                  type: 'number',
                  description: 'User ID to search documents for',
                },
                query: {
                  type: 'string',
                  description: 'Search query',
                },
                limit: {
                  type: 'number',
                  description: 'Maximum number of results',
                  default: 10,
                },
              },
              required: ['userId', 'query'],
            },
          },
          {
            name: 'get_business_intelligence',
            description: 'Get comprehensive business intelligence data aggregation',
            inputSchema: {
              type: 'object',
              properties: {
                userId: {
                  type: 'number',
                  description: 'User ID to get business data for',
                },
                refreshWebContent: {
                  type: 'boolean',
                  description: 'Whether to refresh web content',
                  default: false,
                },
              },
              required: ['userId'],
            },
          },
          {
            name: 'get_call_analytics',
            description: 'Get call patterns and analytics for business insights',
            inputSchema: {
              type: 'object',
              properties: {
                userId: {
                  type: 'number',
                  description: 'User ID to get analytics for',
                },
                days: {
                  type: 'number',
                  description: 'Number of days to analyze',
                  default: 30,
                },
              },
              required: ['userId'],
            },
          },
          {
            name: 'generate_voice_prompt',
            description: 'Generate intelligent voice agent prompt with business context',
            inputSchema: {
              type: 'object',
              properties: {
                userId: {
                  type: 'number',
                  description: 'User ID to generate prompt for',
                },
                callType: {
                  type: 'string',
                  enum: ['inbound', 'outbound', 'general'],
                  description: 'Type of call',
                  default: 'general',
                },
                customerIntent: {
                  type: 'string',
                  description: 'Customer intent if known',
                },
                urgency: {
                  type: 'string',
                  enum: ['low', 'medium', 'high'],
                  description: 'Call urgency level',
                  default: 'medium',
                },
                specificTopic: {
                  type: 'string',
                  description: 'Specific topic for the call',
                },
              },
              required: ['userId'],
            },
          },
        ] as Tool[],
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'search_business_documents': {
            const { userId, query, limit = 10 } = args as any;
            const results = await ragService.searchDocuments(userId, query, limit);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    success: true,
                    query,
                    results,
                    count: results.length,
                  }, null, 2),
                },
              ],
            };
          }

          case 'get_business_intelligence': {
            const { userId, refreshWebContent = false } = args as any;
            const businessData = await dataAggregationService.aggregateBusinessData(
              userId,
              refreshWebContent
            );
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(businessData, null, 2),
                },
              ],
            };
          }

          case 'get_call_analytics': {
            const { userId, days = 30 } = args as any;
            const calls = await storage.getCalls(userId);
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - days);
            
            const recentCalls = calls.filter(call => 
              call.createdAt && new Date(call.createdAt) >= cutoffDate
            );

            const analytics = {
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
              },
              successfulExamples: recentCalls
                .filter(call => call.status === 'completed' && call.summary)
                .slice(-5)
                .map(call => ({
                  summary: call.summary,
                  duration: call.duration,
                  notes: call.notes,
                })),
            };

            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(analytics, null, 2),
                },
              ],
            };
          }

          case 'generate_voice_prompt': {
            const { userId, callType, customerIntent, urgency, specificTopic } = args as any;
            const { intelligentPromptBuilder } = await import('./intelligentPromptBuilder');
            
            const businessData = await dataAggregationService.aggregateBusinessData(userId, false);
            const prompt = intelligentPromptBuilder.buildDynamicPrompt(businessData, {
              callType,
              customerIntent,
              urgency,
              specificTopic,
            });

            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(prompt, null, 2),
                },
              ],
            };
          }

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.log('Sky IQ MCP Server started');
  }
}

export { SkyIQMCPServer };
