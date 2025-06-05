# VibeLab Researcher Tools Documentation

## Overview
The researcher tools suite extends VibeLab's core evaluation system with comprehensive experiment management capabilities. This documentation covers the four main components of the researcher workflow system.

## 1. Experiment Configuration (`experiment-config.html`)
- **Purpose**: Design and configure prompt engineering experiments
- **Key Features**:
  - Prompt library with template management
  - Technique configuration (baseline, few-shot, chain-of-thought, role-playing)
  - Batch generation from prompt templates
  - Hypothesis tracking and experiment naming
- **Usage Flow**:
  1. Define research question/hypothesis
  2. Configure base prompt template
  3. Set up technique variations
  4. Create evaluation batch from prompt templates
  5. Generate and evaluate

## 2. Advanced Analytics (`advanced-analytics.html`)
- **Purpose**: Analyze experiment results with statistical rigor
- **Key Features**:
  - Technique performance comparison
  - Statistical significance testing (p-values)
  - Time-series performance tracking
  - Best/worst example comparisons
  - Confidence interval visualization
- **Usage Flow**:
  1. Apply filters (date range, techniques, experiments)
  2. Review statistical overview
  3. Analyze visualizations
  4. Inspect best/worst examples
  5. Generate reports

## 3. Workflow Management (`researcher-tools.html`)
- **Purpose**: Manage evaluation sessions and collaboration
- **Key Features**:
  - Session save/restore
  - Batch scheduling queue
  - Progress tracking with visual indicators
  - Team collaboration features
  - Project sharing
- **Usage Flow**:
  1. Save current evaluation session
  2. Schedule batches for future evaluation
  3. Monitor batch progress
  4. Share experiments with collaborators
  5. Load previous sessions

## 4. Data Export (`data-export.html`)
- **Purpose**: Export research data in publication-ready formats
- **Key Features**:
  - Multiple export formats (CSV, JSON, PDF)
  - Academic citation styles (APA, IEEE, ACM, Nature)
  - Filtered data selection
  - Statistical summary generation
- **Usage Flow**:
  1. Select export format
  2. Apply data filters
  3. Preview output
  4. Generate export
  5. Download or copy citation

## Integration Points
All tools share a unified navigation system and consistent design language. The workflow follows a natural progression:
`Configuration → Evaluation → Analysis → Export`

## Next Steps
1. Integrate with Agent 1's backend API
2. Implement user authentication
3. Add database persistence
4. Develop real-time collaboration features
