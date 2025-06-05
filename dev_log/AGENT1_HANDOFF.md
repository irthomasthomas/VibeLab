# AGENT 1: Backend & Deployment Handoff

## Mission
Build a fast backend with comprehensive interaction logging for researcher analysis.

## Working Environment
- **Worktree Location**: `/home/thomas/Projects/Virtual_Few_Shot/vibelab-backend-deploy/`
- **Git Branch**: `backend-work` (based on `ui-revamp-final`)
- **Frontend UI**: The `index.html` in this worktree contains the complete VibeLab interface

## Primary Deliverables

### 1. Python Backend (Flask/FastAPI)
Create a simple backend service that:
- Serves the existing `index.html` and static assets
- Provides API endpoints:
  ```
  GET  /api/batches/next     # Return SVG batch data
  POST /api/rankings        # Accept ranking submissions  
  GET  /api/analytics       # Return aggregated stats
  ```

### 2. LLM Integration for SVG Generation
Use the `llm` CLI python library from simon willison to generate SVGs with different techniques:
- **Baseline**: Direct prompt only
- **Few-shot**: Include 3 example SVGs in prompt
- **Chain-of-thought**: Add "Let's think step by step..." instruction
- **Role-playing**: Use "You are an expert SVG artist..." system prompt
- Load models from llm library for selection and execution
- Ensure SVGs are generated quickly using batching and parallel processing where possible

### 3. Comprehensive Data Logging
Record EVERY evaluation interaction:
```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "session_id": "uuid",
  "batch_key": "nature_001", 
  "prompt": "Create an SVG of...",
  "rankings": {"1": "svg_id_A", "2": "svg_id_B", "3": "svg_id_C", "4": "svg_id_D"},
  "techniques": {"svg_id_A": "baseline", "svg_id_B": "few-shot", ...},
  "evaluation_time_seconds": 12.5
}
```
- Also use the LLM python library and make sure to understand it properly and ensure prompts are logged correctly by llm too.

### 4. Deployment Ready
- Dont Dockerize the application - I find it too slow and cumbersome for this project.
- Do Environment configuration
- Do Simple deployment scripts

## Data Format Reference
Study the `batches` object in `index.html` to understand expected API format:
```javascript
{
  "batch_name": {
    "prompt": "description of what to draw",
    "svgs": [
      {"id": "unique_id", "technique": "baseline", "svg": "<svg>...</svg>"},
      {"id": "unique_id", "technique": "few-shot", "svg": "<svg>...</svg>"},
      {"id": "unique_id", "technique": "chain-of-thought", "svg": "<svg>...</svg>"},
      {"id": "unique_id", "technique": "role-playing", "svg": "<svg>...</svg>"}
    ]
  }
}
```

## Communication Protocol
- **Write your conversation ID to**: `/home/thomas/Projects/Virtual_Few_Shot/vibelab/agent_comms/agent1_cid.txt`
- **Read Agent 2's CID from**: `/home/thomas/Projects/Virtual_Few_Shot/vibelab/agent_comms/agent2_cid.txt`
- **Message Agent 2**: `echo "message" | llm -c --cid $(cat /home/thomas/Projects/Virtual_Few_Shot/vibelab/agent_comms/agent2_cid.txt)`
- **Log communications**: `/home/thomas/Projects/Virtual_Few_Shot/vibelab/agent_comms/comm_log.txt`

## Key Success Criteria
- Fast SVG generation (< 5 seconds per batch)
- Perfect data logging integrity
- Seamless frontend integration
- Production-ready deployment

Start by examining `index.html` to understand the frontend requirements, then build the backend to match those expectations.
Also read the paper-draft.md and keep in mind the research goals of the project. and read VibeLab.md to understand some of the prompt-engineering applications of the project.


IMPORTANT: I wont be arround to answer questions, so please use web search, documentation, and the other agent to find answers and solve problems. You can also use the 'llm' command with your own conversation ID (or the other agent conversation_id) with -c --cid and -a /path/to/image.png to review an image. You could then open the webpage in firefox, screenshot firefox and use the image as context for the llm command using the -a flag.

IMPORTANT: YOU MUST FOLLOW THE COMMUNICATION PROTOCOL:
## Communication Protocol
- **Write your conversation ID to**: `/home/thomas/Projects/Virtual_Few_Shot/vibelab/agent_comms/agent1_cid.txt`
- **Read Agent 2's CID from**: `/home/thomas/Projects/Virtual_Few_Shot/vibelab/agent_comms/agent2_cid.txt`
- **Message Agent 2**: `echo "message" | llm -c --cid $(cat /home/thomas/Projects/Virtual_Few_Shot/vibelab/agent_comms/agent2_cid.txt)`
- **Log communications**: `/home/thomas/Projects/Virtual_Few_Shot/vibelab/agent_comms/comm_log.txt`