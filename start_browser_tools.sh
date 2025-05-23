#!/bin/bash

# Function to check if a process is running
check_process() {
    pgrep -f "$1" > /dev/null
}

# Function to start browser-tools-mcp if not running
start_mcp_server() {
    if check_process "browser-tools-mcp"; then
        echo "✅ browser-tools-mcp is already running"
    else
        echo "🚀 Starting browser-tools-mcp..."
        npx @agentdeskai/browser-tools-mcp@latest &
        sleep 3
        echo "✅ browser-tools-mcp started"
    fi
}

# Function to start browser-tools-server if not running
start_browser_server() {
    if check_process "browser-tools-server"; then
        echo "✅ browser-tools-server is already running"
    else
        echo "🚀 Starting browser-tools-server..."
        npx @agentdeskai/browser-tools-server@latest &
        sleep 3
        echo "✅ browser-tools-server started"
    fi
}

echo "🔧 Browser Tools Startup Script"
echo "==============================="

start_mcp_server
start_browser_server

echo ""
echo "🎉 All browser tools are ready!"
echo "📝 Note: Servers will run in the background"
echo "🛑 To stop them later, use: pkill -f 'browser-tools'" 