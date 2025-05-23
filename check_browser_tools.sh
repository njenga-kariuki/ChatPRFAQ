#!/bin/bash

# Browser Tools Status Check Script

echo "📊 Browser Tools Status Check"
echo "============================="

# Check for running processes
mcp_pid=$(pgrep -f "browser-tools-mcp" 2>/dev/null || echo "")
server_pid=$(pgrep -f "browser-tools-server" 2>/dev/null || echo "")

# Check MCP server
if [ -n "$mcp_pid" ]; then
    echo "✅ browser-tools-mcp: Running (PID: $mcp_pid)"
else
    echo "❌ browser-tools-mcp: Not running"
fi

# Check browser-tools-server
if [ -n "$server_pid" ]; then
    echo "✅ browser-tools-server: Running (PID: $server_pid)"
    
    # Find which port it's using
    for port in {3025..3035}; do
        if lsof -i :$port 2>/dev/null | grep -q "$server_pid"; then
            echo "   📍 Listening on port: $port"
            break
        fi
    done
else
    echo "❌ browser-tools-server: Not running"
fi

# Check port usage
echo ""
echo "🔌 Port Status (3025-3030):"
for port in {3025..3030}; do
    if lsof -i :$port >/dev/null 2>&1; then
        process=$(lsof -i :$port 2>/dev/null | tail -n 1 | awk '{print $1 " (PID: " $2 ")"}')
        echo "   Port $port: 🔴 USED by $process"
    else
        echo "   Port $port: 🟢 Available"
    fi
done

# Check log file
echo ""
if [ -f "/tmp/browser_tools_startup.log" ]; then
    echo "📝 Latest log entries:"
    tail -n 5 "/tmp/browser_tools_startup.log" | sed 's/^/   /'
fi 