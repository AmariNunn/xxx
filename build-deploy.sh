#!/bin/bash
# Full build for deployment using esbuild approach
npm run build && npx esbuild server/mcp-standalone.ts --platform=node --packages=external --bundle --format=esm --outfile=dist/mcp-standalone.js
echo "✓ Build complete - ready for deployment"
echo "✓ Run: node dist/mcp-standalone.js"