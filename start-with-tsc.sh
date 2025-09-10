#!/bin/bash

# Production start script using tsc-compiled files - Recommended Option 1
echo "Starting Sky IQ Platform (tsc-compiled version)..."

# Check if compiled files exist
if [ ! -f "dist/server/mcp-standalone.js" ]; then
    echo "Error: dist/server/mcp-standalone.js not found. Please run the build script first:"
    echo "  ./build-with-tsc.sh"
    echo "or"
    echo "  npx tsc --project tsconfig.build.json"
    exit 1
fi

# Start the production server using tsc-compiled JavaScript
echo "Starting production server with tsc-compiled files..."
NODE_ENV=production node dist/server/mcp-standalone.js