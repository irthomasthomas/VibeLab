# VibeLab Quick Start Guide

## What's New
VibeLab now includes:
- **True parallel generation** - Multiple SVGs generate simultaneously
- **Persistent storage** - All experiments saved to database
- **Multi-step refinement** - Iterative prompt improvement
- **8 prompt techniques** - Test different prompt engineering strategies
- **Custom experiments** - No more hardcoded examples

## Quick Test
1. Start backend: `python llm_backend.py`
2. Open browser: `http://localhost:8000`
3. Add a prompt: "Create an SVG of a bicycle"
4. Select a model (e.g., claude-3-5-sonnet)
5. Choose variations (try Role-play and Chain of Thought)
6. Click "Create Experiment"
7. Click "Start Generation"

## Features to Try
- **Parallel Processing**: Set "Max parallel" to 3-5 for faster generation
- **Multi-step**: Enable for automatic refinement ("try harder" iterations)
- **Load Previous**: Your experiments persist - reload anytime
- **Compare Techniques**: Rank results to find best prompt strategies

## Tips
- Start with 2-3 prompts and 2-3 variations for quick tests
- Use the drag-and-drop ranking to compare effectiveness
- Export results for analysis
- Check backend.log for detailed execution info
