// MCP Standalone Server - JavaScript entry point
// This file allows Node.js to execute the MCP server without TypeScript compilation

import { SkyIQMCPServer } from './mcpServer';

async function main() {
  const server = new SkyIQMCPServer();
  await server.start();
}

// For ES modules, we can check if this is the main module being executed
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Failed to start MCP server:', error);
    process.exit(1);
  });
}