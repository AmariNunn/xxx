#!/bin/bash

# Build script that ensures all required files are in dist/
echo "Building application..."

# Run the standard build
npm run build

# Copy the JavaScript launcher to dist/ where deployment expects it
cp server/mcp-standalone.js dist/

echo "Build completed! Files ready in dist/:"
ls -la dist/

echo ""
echo "Ready for deployment - all JavaScript files compiled and in place."