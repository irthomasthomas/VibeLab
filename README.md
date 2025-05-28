# 🧪 VibeLab - Visual Baseline Evaluation Laboratory

## Scientific Prompt Evaluation Framework

VibeLab is a comprehensive tool for evaluating prompt-engineering strategies with advanced statistical analysis, database persistence, and modern UI/UX.

### 🚀 Quick Start

1. **Start the application:**
   ```bash
   ./start.sh
   ```

2. **Open in browser:**
   Navigate to `http://localhost:8081`

3. **Migrate existing data:**
   If you have existing VibeLab data, open `migration.html` in your browser first.

### ✨ New Features

#### 🗄️ Database Persistence
- SQLite database for reliable data storage
- No more localStorage limitations
- Automatic backup and recovery

#### 📊 Advanced Analytics
- Statistical significance testing
- Confidence intervals and effect sizes
- Performance comparison across strategies
- Automated insights and recommendations

#### 🎯 Enhanced Prompt Strategies
- Modular strategy framework
- Pipeline support for chaining strategies
- Custom strategy creation tools
- Strategy templates and sharing

#### 🖥️ Improved UI/UX
- Modern, responsive design
- Carousel evaluation mode
- Comparison mode for side-by-side analysis
- Keyboard shortcuts and batch operations
- Real-time progress tracking

#### 🤖 LLM Integration
- Direct LLM Python API integration
- Better error handling and timeouts
- Multi-model collaboration support
- Enhanced generation tracking

### 🛠️ Technical Architecture

- **Backend:** Flask with SQLAlchemy ORM
- **Database:** SQLite for development, easily upgradeable
- **Frontend:** Modern vanilla JavaScript with async/await
- **LLM Integration:** Direct Python API calls
- **Analytics:** NumPy and SciPy for statistical analysis

### 📋 Requirements

- Python 3.8+
- Flask and extensions
- LLM Python library
- NumPy, SciPy, Pandas
- Modern web browser

### 🔧 Development

1. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Run backend manually:**
   ```bash
   cd backend
   python app.py
   ```

3. **Access API documentation:**
   - Health check: `GET /api/health`
   - List models: `GET /api/models`
   - Create experiment: `POST /api/experiments`

### 📊 API Endpoints

- `GET /api/health` - Health check
- `GET /api/models` - List available LLM models
- `GET /api/strategies` - List prompt strategies
- `POST /api/experiments` - Create new experiment
- `GET /api/experiments/{id}` - Get experiment details
- `POST /api/generate` - Generate content with LLM
- `POST /api/experiments/{id}/rankings` - Update rankings
- `GET /api/experiments/{id}/analysis` - Get statistical analysis
- `GET /api/experiments/{id}/export` - Export experiment data

### 🎯 Usage Guide

#### Creating Experiments
1. Navigate to "Experiment Setup" tab
2. Enter your base prompts
3. Select models to test
4. Choose prompt strategies
5. Configure generation settings
6. Click "Create Experiment"

#### Running Generation
1. Go to "Generation Queue" tab
2. Review the generated tasks
3. Click "Start Generation"
4. Monitor progress in real-time

#### Evaluating Results
1. Switch to "Evaluation" tab
2. Drag and drop SVGs to rank them
3. Use carousel mode for detailed review
4. Rankings are saved automatically

#### Analyzing Performance
1. Open "Analysis" tab
2. Select analysis type and filters
3. Generate comprehensive reports
4. Export analysis data

#### Managing Results
1. Visit "Results" tab
2. View detailed experiment summary
3. Search and filter results
4. Export data in JSONL format

### 🔄 Migration from Original VibeLab

1. Open `migration.html` in your browser
2. Click "Start Migration" to export your data
3. The exported JSON file contains all your experiments
4. Import data through the enhanced interface

### 🐛 Troubleshooting

**Database Issues:**
- Delete `vibelab.db` and restart to reset database
- Check file permissions in the project directory

**LLM Connection Issues:**
- Verify LLM CLI is installed: `llm --version`
- Check model availability: `llm models list`
- Ensure API keys are configured

**Browser Issues:**
- Clear browser cache and localStorage
- Use a modern browser (Chrome, Firefox, Safari, Edge)
- Check browser console for JavaScript errors

### 🤝 Contributing

VibeLab Enhanced is designed for the AI research community. Contributions welcome!

### 📄 License

MIT License - feel free to use and modify for research purposes.

### 🙏 Acknowledgments

Built on the foundation of the original VibeLab, enhanced for serious AI research.
