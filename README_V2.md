# VibeLab V2 - Enhanced Visual Prompt Engineering Laboratory

## 🚀 Quick Start

```bash
# Clone and navigate to the project
cd /home/thomas/Projects/Virtual_Few_Shot/vibelab

# Start VibeLab V2
./start_vibelab_v2.sh
```

## 📋 What's New in V2

### ✨ Enhanced Architecture
- **Hybrid Data Storage**: SQLite for structured data + JSON for flexible configs
- **Accordion UI**: Collapsible sections for better organization
- **Advanced Prompt Patterns**: Support for system prompts, CoT, few-shot, modifiers
- **Multi-Model Support**: Prioritized cost-effective models (Gemini, Claude)

### 🛠️ Core Features Implemented

#### Phase 1: Foundation ✅
- [x] SQLite database with complete schema
- [x] Prompt template JSON configuration system
- [x] LLM service with multiple model support
- [x] REST API for experiments and templates
- [x] Modern accordion-based frontend UI
- [x] Basic prompt execution and result display

#### Phase 2: Coming Soon 🔄
- [ ] Prompt modifier pipeline system
- [ ] LLM Consortium integration
- [ ] Multi-step conversation chains
- [ ] Batch processing capabilities

### 🗄️ Database Schema

```sql
-- Core entities
experiments -> prompt_templates -> prompt_runs -> execution_results
                    ↓
chat_sessions -> chat_messages

-- Supporting tables
prompt_modifiers, consortium_configs
```

### 📝 Template Configuration

Templates use JSON configurations stored in `data/prompt_configs/`:

```json
{
  "version": "1.0",
  "prompt_type": "single_turn",
  "system_prompt": "You are an expert SVG designer.",
  "user_prompt_template": "Create an SVG of {{description}}",
  "variables": [
    {"name": "description", "type": "string", "description": "What to draw"}
  ],
  "default_model_settings": {
    "temperature": 0.7,
    "max_tokens": 1000
  }
}
```

### 🤖 Supported Models

- `openrouter/google/gemini-2.5-flash-preview-05-20` (Cheap, fast, 1M context)
- `openrouter/google/gemini-2.5-flash-preview-05-20:thinking` (With reasoning)
- `gemini-2.5-pro-preview-05-06` (Smart for coding/planning)
- `claude-4-sonnet` (Good for code)
- `claude-4-opus` (Best but expensive)
- `claude-3.5-haiku` (Cheap option)

## 🏗️ Architecture

### Backend Structure
```
backend/
├── app.py              # Flask application entry point
├── database.py         # Database schema and operations
├── models/
│   └── prompt_template.py  # Template configuration handling
├── services/
│   └── llm_service.py      # LLM interaction service
└── api/
    ├── experiments.py      # Experiment management endpoints
    └── prompt_execution.py # Prompt execution endpoints
```

### Frontend Structure
```
frontend/
├── vibelab-v2.html     # Main UI (accordion-based)
└── vibelab-v2.js       # JavaScript application logic
```

### Data Storage
```
data/
├── vibelab.db          # SQLite database (structured data)
├── prompt_configs/     # JSON template configurations
└── experiments/        # Experiment-specific data
```

## 🔧 Development

### Prerequisites
- Python 3.7+ with `flask`, `flask-cors`
- [LLM CLI tool](https://github.com/simonw/llm): `pip install llm`
- API keys configured for your chosen models

### Testing
```bash
python test_vibelab_v2.py
```

### Manual Backend Start
```bash
cd backend
python app.py
```

## 🎯 Usage Workflow

1. **Create Experiment**: Define a research question or use case
2. **Design Templates**: Create prompt templates with variables
3. **Configure Variations**: Set up different models, parameters, modifiers
4. **Execute & Compare**: Run prompts and analyze results
5. **Export Results**: Save findings for further analysis

## 📊 API Endpoints

### Experiments
- `GET /api/experiments` - List all experiments
- `POST /api/experiments` - Create new experiment
- `GET /api/experiments/{id}` - Get experiment details

### Templates
- `GET /api/experiments/{id}/templates` - Get experiment templates
- `POST /api/experiments/{id}/templates` - Create new template
- `GET /api/templates/{id}` - Get template with configuration

### Execution
- `POST /api/templates/{id}/runs` - Execute prompt template
- `GET /api/templates/{id}/runs` - Get execution history
- `POST /api/execute/batch` - Batch execution

### Utilities
- `GET /api/models` - Get available LLM models
- `GET /api/health` - Health check

## 🔮 Roadmap

### Next Phase: Advanced Features
- **Prompt Modifiers**: Rewrite prompts in different styles
- **Consortium Support**: Multi-model consensus and comparison
- **Conversation Chains**: Multi-turn prompt optimization
- **Batch Processing**: Queue management for large experiments

### Future Enhancements
- Statistical analysis and A/B testing
- Custom pipeline definitions
- Advanced result visualization
- Export to multiple formats (CSV, JSONL)

## 🤝 Integration with Original VibeLab

VibeLab V2 can coexist with the original VibeLab. The original system focuses on quick SVG-based visual testing, while V2 provides a comprehensive platform for advanced prompt engineering research.

## 🐛 Troubleshooting

### Backend won't start
- Check Python version: `python3 --version`
- Install dependencies: `pip install flask flask-cors`
- Verify LLM CLI: `llm --version`

### Frontend can't connect
- Ensure backend is running on port 8081
- Check CORS settings in browser console
- Try opening frontend with `--disable-web-security` flag

### Template execution fails
- Verify API keys are configured: `llm keys list`
- Check model availability: `llm models list`
- Review error logs in `backend/logs/vibelab.log`

---

**VibeLab V2**: Transforming prompt engineering from art to science, one experiment at a time. 🧪✨
EOF; sleep 2
