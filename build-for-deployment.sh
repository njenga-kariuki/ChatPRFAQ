#!/bin/bash
# Build script for deployment that creates fresh React build

echo "Building fresh React code for deployment..."

# Navigate to frontend directory
cd frontend

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Build the React app
echo "Building React app..."
npm run build

# Move back to root
cd ..

echo "Fresh build complete! Ready for deployment."
echo "Build output location: build/react/"