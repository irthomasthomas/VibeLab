# VibeLab Custom Prompts Guide

## New Features

The enhanced prompt engineering interface now supports:

### 1. **Custom System Prompts**
Add any system-level instructions to set the AI's role and context.

**Example:**
```
You are a world-renowned SVG artist who has won multiple design awards. 
Your work is characterized by clean lines, perfect symmetry, and creative use of gradients.
```

### 2. **Custom Prompt Modifiers**
Create named templates with `{prompt}` as a placeholder for your base prompt.

**Examples:**

**Oxford Style:**
```
Name: Oxford Style
Template: Please reinterpret the following request in the sophisticated academic style 
of an Oxford professor, emphasizing precision and elegance: {prompt}
```

**Minimalist:**
```
Name: Minimalist
Template: Transform this into an ultra-minimalist design using only essential 
elements and maximum negative space: {prompt}
```

**Step-by-Step Analysis:**
```
Name: Analytical
Template: First, analyze the requirements of: {prompt}. Then list the key visual 
elements needed. Finally, create the SVG with detailed comments explaining each part.
```

### 3. **Multi-Step Conversations**
Define a sequence of prompts for iterative refinement.

**Example:**
- Step 1: `{prompt}` (your base prompt)
- Step 2: `Now enhance it with more visual detail and better composition`
- Step 3: `Make it more professional and polished`

## How to Use

1. **Open VibeLab** and go to the "Experiment Setup" tab

2. **Add Custom System Prompts:**
   - Click "+ Add System Prompt"
   - Enter your system-level instructions
   - These will be prepended to all prompts

3. **Add Custom Modifiers:**
   - Click "+ Add Custom Modifier"
   - Give it a descriptive name
   - Write your template using `{prompt}` where the base prompt should go

4. **Enable Multi-Step:**
   - Check "Enable multi-step conversations"
   - Define your follow-up prompts for each step

5. **Run Experiment:**
   - Add your base prompts (e.g., "Create an SVG of a bicycle")
   - Select models
   - Click "Create Experiment"
   - The system will test all combinations

## Advanced Examples

### Research-Oriented Modifiers

**Constraint Testing:**
```
Name: Size Constraint
Template: Create this SVG with a strict limit of 10 KB file size: {prompt}
```

**Style Transfer:**
```
Name: Bauhaus Style
Template: Reimagine this in the Bauhaus design style with geometric shapes 
and primary colors: {prompt}
```

**Technical Challenge:**
```
Name: No Path Elements
Template: Create this SVG using only basic shapes (rect, circle, ellipse, 
polygon) without any path elements: {prompt}
```

### Prompt Engineering Research

Use these custom modifiers to test specific hypotheses:
- Does role-playing improve output quality?
- Do constraints lead to more creative solutions?
- How do multi-step refinements compare to single prompts?

The system will save all results for statistical analysis.
