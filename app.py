from flask import Flask, jsonify, request, send_from_directory
from llm_helper import generate_batch_data
import json
import time
import os
from collections import defaultdict
import threading
import queue

app = Flask(__name__)

# Configuration
BATCHES = {
    "nature": "Create an SVG of a photorealistic landscape with mountains, river, forest, and sunset",
    "urban": "Create an SVG of a modern cityscape at night with skyscrapers, bridges and lights",
    "animals": "Create an SVG of a majestic eagle soaring over a canyon",
    "abstract": "Create an SVG of geometric patterns forming a mandala",
    "food": "Create an SVG of a delicious pizza with detailed toppings"
}

# In-memory storage for analytics and batch management
evaluation_log = []
technique_stats = defaultdict(lambda: {"wins": 0, "total": 0})
batch_queue = queue.Queue()
current_batch_index = 0

def pregenerate_batches():
    """Pre-generate batches in background"""
    batch_keys = list(BATCHES.keys())
    
    for i, (batch_name, prompt) in enumerate(BATCHES.items()):
        print(f"Generating batch {i+1}/{len(BATCHES)}: {batch_name}")
        try:
            batch_data = generate_batch_data(batch_name, prompt)
            batch_queue.put(batch_data)
            print(f"Successfully generated batch: {batch_name}")
        except Exception as e:
            print(f"Error generating batch {batch_name}: {str(e)}")
            # Add fallback data
            fallback_batch = {
                "batch_name": batch_name,
                "prompt": prompt,
                "svgs": [
                    {"id": f"{batch_name}_A", "technique": "baseline", "svg": "<svg viewBox='0 0 200 150'><rect width='200' height='150' fill='lightgray'/><text x='100' y='75' text-anchor='middle'>Loading...</text></svg>"},
                    {"id": f"{batch_name}_B", "technique": "few-shot", "svg": "<svg viewBox='0 0 200 150'><rect width='200' height='150' fill='lightblue'/><text x='100' y='75' text-anchor='middle'>Loading...</text></svg>"},
                    {"id": f"{batch_name}_C", "technique": "chain-of-thought", "svg": "<svg viewBox='0 0 200 150'><rect width='200' height='150' fill='lightgreen'/><text x='100' y='75' text-anchor='middle'>Loading...</text></svg>"},
                    {"id": f"{batch_name}_D", "technique": "role-playing", "svg": "<svg viewBox='0 0 200 150'><rect width='200' height='150' fill='lightyellow'/><text x='100' y='75' text-anchor='middle'>Loading...</text></svg>"}
                ]
            }
            batch_queue.put(fallback_batch)

@app.route('/')
def serve_index():
    return send_from_directory('.', 'index.html')
@app.route('/<path:filename>')
def serve_static_files(filename):
    """Serve static HTML, JS, and other files"""
    import os
    from flask import abort
    # Security check: only serve files that exist and have safe extensions
    safe_extensions = ['.html', '.js', '.css', '.png', '.jpg', '.svg']
    file_extension = os.path.splitext(filename)[1].lower()
    if file_extension in safe_extensions and os.path.exists(filename):
        return send_from_directory('.', filename)
    else:
        abort(404)

@app.route('/api/batches/next')
def get_next_batch():
    """Return next batch of SVGs"""
    global current_batch_index
    
    try:
        if not batch_queue.empty():
            batch_data = batch_queue.get_nowait()
            current_batch_index += 1
            return jsonify(batch_data)
        else:
            # Fallback to basic batch if queue is empty
            batch_keys = list(BATCHES.keys())
            batch_key = batch_keys[current_batch_index % len(batch_keys)]
            prompt = BATCHES[batch_key]
            
            fallback_batch = {
                "batch_name": batch_key,
                "prompt": prompt,
                "svgs": [
                    {"id": f"{batch_key}_A", "technique": "baseline", "svg": "<svg viewBox='0 0 200 150'><rect width='200' height='150' fill='lightgray'/><text x='100' y='75' text-anchor='middle'>Generating...</text></svg>"},
                    {"id": f"{batch_key}_B", "technique": "few-shot", "svg": "<svg viewBox='0 0 200 150'><rect width='200' height='150' fill='lightblue'/><text x='100' y='75' text-anchor='middle'>Generating...</text></svg>"},
                    {"id": f"{batch_key}_C", "technique": "chain-of-thought", "svg": "<svg viewBox='0 0 200 150'><rect width='200' height='150' fill='lightgreen'/><text x='100' y='75' text-anchor='middle'>Generating...</text></svg>"},
                    {"id": f"{batch_key}_D", "technique": "role-playing", "svg": "<svg viewBox='0 0 200 150'><rect width='200' height='150' fill='lightyellow'/><text x='100' y='75' text-anchor='middle'>Generating...</text></svg>"}
                ]
            }
            current_batch_index += 1
            return jsonify(fallback_batch)
            
    except Exception as e:
        print(f"Error in get_next_batch: {str(e)}")
        return jsonify({"error": "Failed to generate batch"}), 500

@app.route('/api/rankings', methods=['POST'])
def record_ranking():
    """Log user rankings"""
    try:
        data = request.json
        log_entry = {
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "session_id": data.get('session_id', f"session_{int(time.time())}"),
            "batch_key": data['batch_key'],
            "prompt": data['prompt'],
            "rankings": data['rankings'],
            "techniques": data['techniques'],
            "evaluation_time_seconds": data.get('evaluation_time_seconds', 0)
        }
        evaluation_log.append(log_entry)
        
        # Update technique stats
        for rank, svg_id in data['rankings'].items():
            if svg_id in data['techniques']:
                technique = data['techniques'][svg_id]
                technique_stats[technique]["total"] += 1
                if rank == "1":
                    technique_stats[technique]["wins"] += 1
        
        # Save to file for persistence
        with open('evaluation_log.json', 'w') as f:
            json.dump(evaluation_log, f, indent=2)
        
        return jsonify({"status": "success"})
        
    except Exception as e:
        print(f"Error recording ranking: {str(e)}")
        return jsonify({"error": "Failed to record ranking"}), 500

@app.route('/api/analytics')
def get_analytics():
    """Return aggregated analytics"""
    return jsonify({
        "total_evaluations": len(evaluation_log),
        "technique_stats": dict(technique_stats),
        "recent_evaluations": evaluation_log[-10:] if evaluation_log else []
    })

if __name__ == '__main__':
    # Start batch generation in background
    print("Starting VibeLab Backend...")
    print("Pre-generating SVG batches...")
    batch_thread = threading.Thread(target=pregenerate_batches, daemon=True)
    batch_thread.start()
    
    # Load existing evaluation log if it exists
    if os.path.exists('evaluation_log.json'):
        try:
            with open('evaluation_log.json', 'r') as f:
                evaluation_log = json.load(f)
            print(f"Loaded {len(evaluation_log)} existing evaluations")
        except:
            print("Could not load existing evaluation log")
    
    print("Starting Flask server on http://localhost:5000")
    app.run(host='0.0.0.0', port=5000, debug=True)
