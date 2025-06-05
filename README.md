# VibeLab Backend

A Flask-based backend for the VibeLab visual prompt engineering evaluation system.

## Features

- **SVG Generation**: Uses LLM CLI to generate SVGs with different prompt engineering techniques:
  - Baseline: Direct prompt only
  - Few-shot: Includes example SVGs
  - Chain-of-thought: Adds step-by-step reasoning
  - Role-playing: Uses expert persona

- **API Endpoints**:
  - `GET /` - Serves the frontend interface
  - `GET /api/batches/next` - Returns next batch of SVGs for evaluation
  - `POST /api/rankings` - Records user rankings and evaluation data
  - `GET /api/analytics` - Returns aggregated statistics

- **Comprehensive Logging**: Records every interaction with timestamp, session ID, rankings, techniques, and evaluation time

## Setup

1. **Install Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

2. **Configure API Keys**:
   ```bash
   cp .env.example .env
   # Edit .env and add your Anthropic API key
   ```

3. **Configure LLM CLI**:
   ```bash
   llm keys set anthropic
   # Enter your API key when prompted
   ```

4. **Run the Server**:
   ```bash
   ./run.sh
   ```
   Or manually:
   ```bash
   python app.py
   ```

5. **Access the Interface**:
   Open http://localhost:5000 in your browser

## Architecture

- **Flask Backend**: Serves API and static files
- **LLM Integration**: Uses Simon Willison's LLM CLI library
- **Queue System**: Pre-generates SVG batches for fast response
- **Data Persistence**: Saves evaluation logs to JSON files

## API Reference

### GET /api/batches/next
Returns a batch of 4 SVGs generated with different techniques.

**Response**:
```json
{
  "batch_name": "nature",
  "prompt": "Create an SVG of a landscape...",
  "svgs": [
    {
      "id": "uuid",
      "technique": "baseline",
      "svg": "<svg>...</svg>"
    }
  ]
}
```

### POST /api/rankings
Records user evaluation of SVG batch.

**Request**:
```json
{
  "session_id": "uuid",
  "batch_key": "nature",
  "prompt": "Create an SVG...",
  "rankings": {"1": "svg_id_A", "2": "svg_id_B"},
  "techniques": {"svg_id_A": "baseline"},
  "evaluation_time_seconds": 12.5
}
```

### GET /api/analytics
Returns evaluation statistics.

**Response**:
```json
{
  "total_evaluations": 42,
  "technique_stats": {
    "baseline": {"wins": 5, "total": 20},
    "few-shot": {"wins": 8, "total": 20}
  }
}
```

## File Structure

```
vibelab-backend-deploy/
├── app.py              # Main Flask application
├── llm_helper.py       # LLM integration and SVG generation
├── requirements.txt    # Python dependencies
├── run.sh             # Deployment script
├── .env.example       # Environment variables template
├── index.html         # Frontend interface
├── evaluation_log.json # Persistent data storage
└── README.md          # This file
```

## Development

The backend is designed to be lightweight and fast:
- Pre-generates SVG batches in background threads
- Uses in-memory storage with JSON persistence
- Implements fallback responses for resilience
- Comprehensive error handling and logging

For production deployment, consider:
- Using a proper database (PostgreSQL, MongoDB)
- Adding authentication/authorization
- Implementing rate limiting
- Adding monitoring and health checks
