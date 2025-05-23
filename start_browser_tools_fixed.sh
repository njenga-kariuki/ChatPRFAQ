#!/bin/bash

# Browser Tools Startup Script - Fixed Port Management
# This script ensures both servers use the same port and prevents conflicts

set -e  # Exit on any error

LOG_FILE="/tmp/browser_tools_startup.log"
echo "$(date): Starting Browser Tools..." > "$LOG_FILE"

# Function to find an available port starting from 3025
find_available_port() {
    local start_port=3025
    local port=$start_port
    
    while [ $port -le 3035 ]; do
        if ! lsof -i :$port >/dev/null 2>&1; then
            echo $port
            return 0
        fi
        port=$((port + 1))
    done
    
    echo "ERROR: No available ports found between 3025-3035" >> "$LOG_FILE"
    exit 1
}

# Function to stop all browser tools processes
stop_all() {
    echo "🛑 Stopping all browser-tools processes..."
    pkill -f "browser-tools" 2>/dev/null || true
    sleep 2
    
    # Force kill any remaining processes
    for pid in $(pgrep -f "browser-tools" 2>/dev/null || true); do
        kill -9 $pid 2>/dev/null || true
    done
    
    echo "✅ All processes stopped"
}

# Function to start browser-tools-server on specific port
start_server() {
    local port=$1
    echo "🚀 Starting browser-tools-server on port $port..."
    
    # Start server in background and capture PID
    npx @agentdeskai/browser-tools-server@latest --port $port &
    local server_pid=$!
    
    echo "Server PID: $server_pid" >> "$LOG_FILE"
    
    # Wait for server to start
    local retry_count=0
    while [ $retry_count -lt 10 ]; do
        if lsof -i :$port >/dev/null 2>&1; then
            echo "✅ browser-tools-server started on port $port"
            echo "$server_pid" > /tmp/browser_tools_server.pid
            return 0
        fi
        sleep 1
        retry_count=$((retry_count + 1))
    done
    
    echo "❌ Failed to start browser-tools-server on port $port" >> "$LOG_FILE"
    return 1
}

# Function to start browser-tools-mcp
start_mcp() {
    echo "🚀 Starting browser-tools-mcp..."
    
    npx @agentdeskai/browser-tools-mcp@latest &
    local mcp_pid=$!
    
    echo "MCP PID: $mcp_pid" >> "$LOG_FILE"
    echo "$mcp_pid" > /tmp/browser_tools_mcp.pid
    
    sleep 3
    echo "✅ browser-tools-mcp started"
}

# Main execution
echo "🔧 Browser Tools Startup (Fixed Port Management)"
echo "================================================"

# Stop any existing processes
stop_all

# Find available port
AVAILABLE_PORT=$(find_available_port)
echo "📍 Using port: $AVAILABLE_PORT"
echo "Port selected: $AVAILABLE_PORT" >> "$LOG_FILE"

# Start browser-tools-server first
if start_server $AVAILABLE_PORT; then
    # Wait a moment for server to stabilize
    sleep 3
    
    # Start MCP server
    start_mcp
    
    echo ""
    echo "🎉 Browser Tools started successfully!"
    echo "📊 Status:"
    echo "   • browser-tools-server: Port $AVAILABLE_PORT"
    echo "   • browser-tools-mcp: Running"
    echo "📝 Log file: $LOG_FILE"
    echo ""
    echo "🔍 To check status: ./check_browser_tools.sh"
    echo "🛑 To stop: ./stop_browser_tools.sh"
    
else
    echo "❌ Failed to start browser-tools-server"
    exit 1
fi 