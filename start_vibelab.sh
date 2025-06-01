#!/bin/bash
echo "🚀 Starting VibeLab..."
echo ""

# Start FastAPI backend
echo "Starting backend on port 8081..."
python3 fastapi_backend.py &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"

# Wait for backend to start
sleep 3

# Start frontend server
echo "Starting frontend on port 8080..."
python3 -m http.server 8080 &
FRONTEND_PID=$!
echo "Frontend PID: $FRONTEND_PID"

echo ""
echo "✅ VibeLab is running!"
echo ""
echo "📍 Access points:"
echo "   - Application: http://localhost:8080"
echo "   - API Docs:    http://localhost:8081/docs"
echo ""
echo "📝 To stop: Press Ctrl+C or run: kill $BACKEND_PID $FRONTEND_PID"
echo ""

# Keep script running
wait
