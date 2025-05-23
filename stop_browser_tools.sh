#!/bin/bash

# Browser Tools Stop Script

echo "🛑 Stopping Browser Tools"
echo "========================="

# Stop all browser tools processes
echo "Stopping browser-tools processes..."
pkill -f "browser-tools" 2>/dev/null || true

sleep 2

# Check if any processes are still running and force kill them
remaining_pids=$(pgrep -f "browser-tools" 2>/dev/null || true)

if [ -n "$remaining_pids" ]; then
    echo "Force killing remaining processes..."
    for pid in $remaining_pids; do
        kill -9 $pid 2>/dev/null || true
        echo "  Killed PID: $pid"
    done
fi

# Clean up PID files
rm -f /tmp/browser_tools_server.pid
rm -f /tmp/browser_tools_mcp.pid

# Final check
sleep 1
remaining=$(pgrep -f "browser-tools" 2>/dev/null | wc -l)

if [ "$remaining" -eq 0 ]; then
    echo "✅ All browser tools processes stopped successfully"
else
    echo "⚠️  Some processes may still be running"
    pgrep -f "browser-tools" -l 2>/dev/null || true
fi

echo ""
echo "🔍 Use './check_browser_tools.sh' to verify status" 