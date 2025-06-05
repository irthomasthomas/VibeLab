# AGENT 2: Experiment Management Handoff

## Mission  
Develop researcher tools for advanced experiment configuration, management, and analysis.

## Working Environment
- **Worktree Location**: `/home/thomas/Projects/Virtual_Few_Shot/vibelab-experiment-mgmt/`
- **Git Branch**: `experiment-work` (based on `ui-revamp-final`)
- **Frontend UI**: The `index.html` in this worktree contains the complete VibeLab interface

## Primary Deliverables

### 1. Experiment Configuration Interface
Create tools for researchers to design new experiments:
- **Prompt Library Management**: Save/load/edit base prompts
- **Technique Configuration**: Define custom variations:
  - Role-playing system prompts
  - Few-shot example sets
  - Chain-of-thought instruction variants
  - Custom technique combinations
- **Batch Generation**: Create evaluation batches from prompts + techniques

### 2. Advanced Analytics Dashboard
Extend beyond current win-rate charts:
- **Deep Analysis**: Per-prompt technique performance breakdowns
- **Visual Comparisons**: Side-by-side SVG output viewing
- **Statistical Insights**: Significance testing, confidence intervals
- **Trend Analysis**: Performance over time
- **Filtering & Search**: Complex data queries

### 3. Researcher Workflow Tools
- **Session Management**: Save/restore evaluation sessions
- **Batch Scheduling**: Queue multiple experiments
- **Progress Tracking**: Visual progress indicators
- **Collaboration Features**: Share experiments/results

### 4. Data Export & Reporting
- **Raw Data Export**: CSV/JSONL of all evaluation data
- **Custom Reports**: Technique effectiveness summaries
- **Academic Integration**: Citation-ready result formatting

## Suggested Implementation
Consider creating these new pages:
- `experiment-config.html` - Experiment design interface
- `advanced-analytics.html` - Enhanced analysis dashboard
- `researcher-tools.html` - Workflow management
- `data-export.html` - Export and reporting tools

## Communication Protocol
- **Write your conversation ID to**: `/home/thomas/Projects/Virtual_Few_Shot/vibelab/agent_comms/agent2_cid.txt`
- **Read Agent 1's CID from**: `/home/thomas/Projects/Virtual_Few_Shot/vibelab/agent_comms/agent1_cid.txt`
- **Message Agent 1**: `echo "message" | llm --cid $(cat /home/thomas/Projects/Virtual_Few_Shot/vibelab/agent_comms/agent1_cid.txt)`
- **Log communications**: `/home/thomas/Projects/Virtual_Few_Shot/vibelab/agent_comms/comm_log.txt`

## Key Success Criteria
- Intuitive researcher-friendly interfaces
- Seamless integration with Agent 1's backend
- Powerful data analysis capabilities
- Extensible architecture for future enhancements

## Integration Points with Agent 1
- Coordinate on data storage formats
- Ensure API compatibility for new features
- Align on experiment configuration schemas

Start by understanding the current evaluation flow in `index.html`, then design enhanced tools that empower researchers to conduct sophisticated prompt engineering studies.

Also read the paper-draft.md and keep in mind the research goals of the project. and read VibeLab.md to understand some of the prompt-engineering applications of the project.


IMPORTANT: I wont be arround to answer questions, so please use web search, documentation, and the other agent to find answers and solve problems. You can also use the 'llm' command with your own conversation ID (or the other agent conversation_id) with -c --cid and -a /path/to/image.png to review an image. You could then open the webpage in firefox, screenshot firefox and use the image as context for the llm command using the -a flag.

IMPORTANT: YOU MUST FOLLOW THE COMMUNICATION PROTOCOL:
## Communication Protocol
- **Write your conversation ID to**: `/home/thomas/Projects/Virtual_Few_Shot/vibelab/agent_comms/agent2_cid.txt`
- **Read Agent 1's CID from**: `/home/thomas/Projects/Virtual_Few_Shot/vibelab/agent_comms/agent1_cid.txt`
- **Message Agent 1**: `echo "message" | llm -m deepbloom --cid $(cat /home/thomas/Projects/Virtual_Few_Shot/vibelab/agent_comms/agent1_cid.txt)`
- **Log communications**: `/home/thomas/Projects/Virtual_Few_Shot/vibelab/agent_comms/comm_log.txt`
