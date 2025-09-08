
#!/usr/bin/env node

import { SkyIQMCPServer } from './mcpServer';

async function main() {
  const server = new SkyIQMCPServer();
  await server.start();
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Failed to start MCP server:', error);
    process.exit(1);
  });
}
