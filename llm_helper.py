from llm import get_model
import re
import uuid

def generate_svgs(prompt):
    """
    Generate SVGs using different techniques
    Returns: dict of {technique: svg_content}
    """
    # Define our prompt variations
    techniques = {
        "baseline": prompt,
        "few-shot": (
            "Here are 3 examples of high-quality SVGs:\n"
            "1. <svg viewBox='0 0 100 100'><circle cx='50' cy='50' r='40' fill='blue' /></svg>\n"
            "2. <svg viewBox='0 0 200 100'><rect x='10' y='10' width='180' height='80' fill='green' /></svg>\n"
            "3. <svg viewBox='0 0 100 100'><polygon points='50,10 10,90 90,90' fill='red' /></svg>\n\n"
            f"Now create a new SVG for: {prompt}"
        ),
        "chain-of-thought": f"{prompt}\n\nLet me think step by step about how to create this SVG...\n1. ",
        "role-playing": "You are an expert SVG designer with 20 years of experience. " + prompt
    }
    
    model = get_model("claude-4-sonnet")
    svg_results = {}
    
    for technique, modified_prompt in techniques.items():
        try:
            # Set system instruction to prevent explanations and get pure SVG
            system_instruction = (
                "You are an SVG generator. You output ONLY SVG code with NO explanations. "
                "No markdown, no code blocks, no text outside <svg> tags. Just pure SVG."
            )
            
            # Generate the SVG
            response = model.prompt(modified_prompt, system=system_instruction)
            
            # Extract SVG content even if wrapped in markdown
            svg_content = response.text()
            if '<svg' not in svg_content:
                # Try to find SVG in markdown code block
                match = re.search(r'```svg\n([\s\S]*?)\n```', svg_content)
                if match:
                    svg_content = match.group(1)
            
            svg_results[technique] = svg_content
        except Exception as e:
            print(f"Error generating SVG for {technique}: {str(e)}")
            svg_results[technique] = "<svg><text x='10' y='20'>Error generating SVG</text></svg>"
    
    return svg_results

def generate_batch_data(batch_name, prompt):
    """Generate complete batch data matching frontend format"""
    svg_results = generate_svgs(prompt)
    
    svgs = []
    for technique, svg_content in svg_results.items():
        svgs.append({
            "id": str(uuid.uuid4()),
            "technique": technique,
            "svg": svg_content
        })
    
    return {
        "batch_name": batch_name,
        "prompt": prompt,
        "svgs": svgs
    }
