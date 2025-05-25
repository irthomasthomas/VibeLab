# VibeLab 🧪

A web-based tool for testing and evaluating virtual few-shot prompt variations with SVG generation.

## Features

- **Experiment Setup**: Configure base prompts, models, and prompt variations
- **Queue Management**: Batch generation with progress tracking, pause/resume functionality
- **Visual Evaluation**: Drag-and-drop ranking interface for human quality assessment
- **Results Analysis**: Comprehensive results table with quality scoring
- **Data Export**: Export results to JSONL format for further analysis

## Prompt Variations Tested

1. **Baseline**: No few-shot examples
2. **Real Few-shot**: Actual examples provided
3. **Simulated Variations**:
   - "This section contains N examples..."
   - "Based on N examples below..."
   - "[Example 1][Example 2]...[Example N]" placeholders
   - "Following ten brilliant examples..."
   - "Drawing from extensive training examples..."
4. **Custom Variations**: User-defined prompt modifications

## Usage

1. **Setup**: Define your base prompts (e.g., "SVG of a pelican riding a bicycle")
2. **Configure**: Select models and prompt variations to test
3. **Generate**: Run the generation queue to create SVGs
4. **Evaluate**: Use drag-and-drop to rank SVG quality
5. **Analyze**: Review results and export data

## Technical Details

- **Frontend**: HTML/CSS/JavaScript single-page application
- **LLM Integration**: Uses `llm` CLI for model interactions
- **Storage**: Browser localStorage for experiments, JSONL export for results
- **Models Supported**: Claude, GPT-4, and custom model configurations

## File Structure

```
VibeLab/
├── index.html      # Main application structure
├── style.css       # Styling and responsive design
├── app.js          # Core application logic
└── README.md       # This file
```

## Getting Started

1. Open `index.html` in a modern web browser
2. Ensure `llm` CLI is installed and configured on your system
3. Create a new experiment in the Setup tab
4. Generate SVGs in the Queue tab
5. Evaluate results in the Evaluation tab

## Future Enhancements

- Real-time LLM CLI integration
- Advanced statistical analysis
- Batch experiment comparison
- More sophisticated ranking algorithms
- Integration with existing SVG viewer tools

---

**Note**: This is currently a prototype. The LLM integration uses placeholder generation for testing purposes. Full integration with the `llm` CLI requires additional backend implementation.
