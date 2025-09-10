#!/bin/bash

# Production build script using TypeScript compiler (tsc) - Recommended Option 1
echo "Building Sky IQ Platform using TypeScript compiler..."

# Clean previous builds
rm -rf dist/

# Build frontend with Vite
echo "Building frontend..."
npx vite build

# Compile TypeScript to JavaScript using tsc
echo "Compiling TypeScript server files..."
npx tsc --project tsconfig.build.json

echo "TypeScript compilation completed!"
echo "Files created:"
ls -la dist/server/ 2>/dev/null || echo "Server files compiled to dist/"
ls -la dist/ | head -10

echo ""
echo "To start the production server, run:"
echo "  node dist/server/mcp-standalone.js"
echo "or use the start-with-tsc.sh script"