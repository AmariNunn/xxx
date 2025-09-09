#!/bin/bash

# Run the MCP standalone server
# This script handles both development and production modes

# First try to build the production version if it doesn't exist
if [ ! -f "dist/mcp-standalone.js" ] && [ "$NODE_ENV" = "production" ]; then
    echo "Building MCP standalone server for production..."
    npx esbuild server/mcp-standalone.ts --platform=node --packages=external --bundle --format=esm --outdir=dist
fi

if [ -f "dist/mcp-standalone.js" ] && [ "$NODE_ENV" = "production" ]; then
    echo "Running MCP standalone server in production mode..."
    node dist/mcp-standalone.js
else
    echo "Running MCP standalone server in development mode with tsx..."
    npx tsx server/mcp-standalone.ts
fi