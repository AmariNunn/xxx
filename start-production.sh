#!/bin/bash

# Production start script for Sky IQ Platform
echo "Starting Sky IQ Platform in production mode..."

# Check if compiled files exist
if [ ! -f "dist/index.js" ]; then
    echo "Error: dist/index.js not found. Please run the build script first:"
    echo "  ./build-production.sh"
    echo "or"
    echo "  npm run build && npx esbuild server/mcp-standalone.ts --platform=node --packages=external --bundle --format=esm --outdir=dist"
    exit 1
fi

if [ ! -f "dist/mcp-standalone.js" ]; then
    echo "Error: dist/mcp-standalone.js not found. Compiling standalone launcher..."
    npx esbuild server/mcp-standalone.ts --platform=node --packages=external --bundle --format=esm --outdir=dist
fi

# Start the production server using compiled JavaScript
echo "Starting production server..."
NODE_ENV=production node dist/mcp-standalone.js