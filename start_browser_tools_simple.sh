#!/bin/bash

# Simple Browser Tools Startup Script
# Starts servers normally and ensures they're both running on the same discovered port

set -e

echo "🔧 Simple Browser Tools Startup"
echo "==============================="

# Function to stop all browser tools processes
stop_all() {
    echo "🛑 Stopping all browser-tools processes..."
    pkill -f "browser-tools" 2>/dev/null || true
    sleep 3
    
    # Force kill any remaining
    for pid in $(pgrep -f "browser-tools" 2>/dev/null || true); do
        kill -9 $pid 2>/dev/null || true
    done
    echo "✅ All processes stopped"
}

# Function to find what port a process is using
find_process_port() {
    local process_name=$1
    local pid=$(pgrep -f "$process_name" 2>/dev/null | head -1)
    
    if [ -n "$pid" ]; then
        for port in {3025..3035}; do
            if lsof -i :$port 2>/dev/null | grep -q "$pid"; then
                echo $port
                return 0
            fi
        done
    fi
    return 1
}

# Stop all existing processes
stop_all

# Start browser-tools-server first
echo "🚀 Starting browser-tools-server..."
npx @agentdeskai/browser-tools-server@latest &
SERVER_PID=$!

# Wait for server to start and find its port
echo "⏳ Waiting for server to start..."
sleep 5

SERVER_PORT=$(find_process_port "browser-tools-server")
if [ -n "$SERVER_PORT" ]; then
    echo "✅ browser-tools-server started on port $SERVER_PORT (PID: $SERVER_PID)"
else
    echo "❌ Could not detect server port"
    exit 1
fi

# Start MCP server
echo "🚀 Starting browser-tools-mcp..."
npx @agentdeskai/browser-tools-mcp@latest &
MCP_PID=$!

sleep 3
echo "✅ browser-tools-mcp started (PID: $MCP_PID)"

echo ""
echo "🎉 Browser Tools started successfully!"
echo "📊 Status:"
echo "   • browser-tools-server: Port $SERVER_PORT (PID: $SERVER_PID)"
echo "   • browser-tools-mcp: Running (PID: $MCP_PID)"
echo ""
echo "📝 Both servers should now be using the same port discovery mechanism"
echo "🔍 Use './check_browser_tools.sh' to verify status"
echo "🛑 Use './stop_browser_tools.sh' to stop" 