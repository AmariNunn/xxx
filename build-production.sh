#!/bin/bash

# Production build script for Sky IQ Platform
echo "Building Sky IQ Platform for production..."

# Clean previous builds
rm -rf dist/

# Build the application
echo "Running npm build..."
npm run build

# Compile the standalone launcher
echo "Compiling standalone launcher..."
npx esbuild server/mcp-standalone.ts --platform=node --packages=external --bundle --format=esm --outdir=dist

echo "Production build completed successfully!"
echo "Files created:"
ls -la dist/

echo ""
echo "To start the production server, run:"
echo "  node dist/mcp-standalone.js"
echo "or"
echo "  npm start"