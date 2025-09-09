#!/bin/bash

# Run the MCP standalone server
# This script handles both development and production modes

if [ -f "dist/mcp-standalone.js" ]; then
    echo "Running MCP standalone server in production mode..."
    node dist/mcp-standalone.js
else
    echo "Running MCP standalone server in development mode..."
    npx tsx server/mcp-standalone.ts
fi