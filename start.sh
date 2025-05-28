#!/bin/bash
# VibeLab Enhanced Start Script

echo "🧪 Starting VibeLab Enhanced..."
echo "================================"

# Check if backend directory exists
if [ ! -d "backend" ]; then
    echo "❌ Backend directory not found!"
    exit 1
fi

# Start the Flask backend
echo "🔧 Starting backend server..."
cd backend
python app.py &
BACKEND_PID=$!
cd ..

echo "✅ Backend started (PID: $BACKEND_PID)"
echo "🌐 VibeLab Enhanced is running at: http://localhost:8081"
echo ""
echo "📖 Usage:"
echo "  - Open http://localhost:8081 in your browser"
echo "  - Use migration.html to migrate existing data"
echo "  - Press Ctrl+C to stop the server"
echo ""

# Wait for interrupt
trap "echo '🛑 Stopping VibeLab Enhanced...'; kill $BACKEND_PID; exit 0" INT
wait $BACKEND_PID
