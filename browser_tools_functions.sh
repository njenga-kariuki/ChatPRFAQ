# Browser Tools Helper Functions
# Source this file in your ~/.bashrc or ~/.bash_profile

# Start browser tools if needed
bt_start() {
    echo "🔧 Starting Browser Tools..."
    
    # Check and start browser-tools-mcp
    if pgrep -f "browser-tools-mcp" > /dev/null; then
        echo "✅ browser-tools-mcp is already running"
    else
        echo "🚀 Starting browser-tools-mcp..."
        npx @agentdeskai/browser-tools-mcp@latest &
        sleep 3
    fi
    
    # Check and start browser-tools-server
    if pgrep -f "browser-tools-server" > /dev/null; then
        echo "✅ browser-tools-server is already running"
    else
        echo "🚀 Starting browser-tools-server..."
        npx @agentdeskai/browser-tools-server@latest &
        sleep 3
    fi
    
    echo "🎉 Browser tools ready!"
}

# Stop browser tools
bt_stop() {
    echo "🛑 Stopping Browser Tools..."
    pkill -f "browser-tools-mcp"
    pkill -f "browser-tools-server"
    echo "✅ Browser tools stopped"
}

# Check browser tools status
bt_status() {
    echo "📊 Browser Tools Status:"
    echo "========================"
    
    if pgrep -f "browser-tools-mcp" > /dev/null; then
        echo "✅ browser-tools-mcp: Running (PID: $(pgrep -f 'browser-tools-mcp'))"
    else
        echo "❌ browser-tools-mcp: Not running"
    fi
    
    if pgrep -f "browser-tools-server" > /dev/null; then
        echo "✅ browser-tools-server: Running (PID: $(pgrep -f 'browser-tools-server'))"
    else
        echo "❌ browser-tools-server: Not running"
    fi
}

# Restart browser tools
bt_restart() {
    bt_stop
    sleep 2
    bt_start
}

echo "Browser Tools functions loaded!"
echo "Available commands: bt_start, bt_stop, bt_status, bt_restart" 