#!/bin/bash

echo "Starting VibeLab Backend..."

# Install dependencies
echo "Installing dependencies..."
pip install -r requirements.txt

# Start the backend server
echo "Starting Flask server..."
python app.py
