#!/bin/bash

# Sky IQ Deployment Start Script
# Provides multiple fallback options for starting the application

set -e

echo "Starting Sky IQ Platform deployment..."

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check if a file exists
file_exists() {
    [ -f "$1" ]
}

# Try multiple startup methods in order of preference

# Method 1: Use npm start (compiled JavaScript)
if file_exists "dist/index.js" && command_exists "node"; then
    echo "Method 1: Starting with compiled JavaScript (npm start)"
    exec npm start
    exit 0
fi

# Method 2: Use tsx to run main TypeScript file
if file_exists "server/index.ts" && command_exists "tsx"; then
    echo "Method 2: Starting with tsx (main TypeScript file)"
    exec tsx server/index.ts
    exit 0
fi

# Method 3: Build first, then run
if command_exists "npm" && command_exists "node"; then
    echo "Method 3: Building and starting application"
    npm run build
    if file_exists "dist/index.js"; then
        exec node dist/index.js
        exit 0
    fi
fi

# If all methods fail
echo "Error: Unable to start the application. No suitable runtime found."
echo "Available files:"
ls -la server/ 2>/dev/null || echo "server/ directory not found"
ls -la dist/ 2>/dev/null || echo "dist/ directory not found"
echo "Available commands:"
command_exists "node" && echo "✓ node" || echo "✗ node"
command_exists "tsx" && echo "✓ tsx" || echo "✗ tsx"
command_exists "npm" && echo "✓ npm" || echo "✗ npm"
exit 1