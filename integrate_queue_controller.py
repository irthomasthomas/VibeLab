#!/usr/bin/env python3
import re

# Read the app.js file
with open('app.js', 'r') as f:
    content = f.read()

# 1. Add queue controller initialization after ApiService
api_service_pattern = r'(this\.apiService = new ApiService\(\);)'
replacement = r'\1\n\n        // Initialize queue controller\n        this.queueController = new GenerationQueueController(\n            this.apiService,\n            (data) => this.handleQueueUpdate(data)\n        );'
content = re.sub(api_service_pattern, replacement, content)

# 2. Update button event listeners
content = re.sub(r'\(\) => this\.startGeneration\(\)', '() => this.queueController.startGeneration()', content)
content = re.sub(r'\(\) => this\.pauseGeneration\(\)', '() => this.queueController.pauseGeneration()', content)
content = re.sub(r'\(\) => this\.clearQueue\(\)', '() => this.queueController.clearQueue()', content)

# 3. Update createExperiment to use queue controller
content = re.sub(r'this\.generateQueue\(\);', 'const queueSize = this.queueController.initializeQueue(this.currentExperiment);', content)
content = re.sub(r'`Experiment "\$\{experimentName\}" created with \$\{this\.generationQueue\.length\} tasks`;', '`Experiment "${experimentName}" created with ${queueSize} tasks`;', content)

# 4. Add handleQueueUpdate method after updateEvaluationView
eval_view_pattern = r'(updateEvaluationView\(\) \{[^}]+\})'
handle_queue_update = '''

    handleQueueUpdate(data) {
        if (data.type === 'result') {
            // Add result to current experiment
            if (this.currentExperiment && this.currentExperiment.results) {
                this.currentExperiment.results.push(data.data);
            }
        }
        // Update any UI elements that depend on queue state
        this.updateEvaluationView();
    }'''

# Find the end of updateEvaluationView method
match = re.search(r'updateEvaluationView\(\) \{([^}]|\}[^}])*\}\n', content)
if match:
    end_pos = match.end()
    content = content[:end_pos] + handle_queue_update + content[end_pos:]

# 5. Comment out old queue-related methods instead of deleting
# This is safer and allows for reference
methods_to_comment = ['generateQueue', 'startGeneration', 'generateSVG', 'pauseGeneration', 'clearQueue', 'extractSVG', 'enhancePrompt']
for method in methods_to_comment:
    pattern = rf'(\n    {method}\([^)]*\) \{{)'
    content = re.sub(pattern, r'\n    /* OLD METHOD - NOW IN GenerationQueueController\1', content)
    # Find and comment the closing brace
    # This is complex, so we'll just add a note

# 6. Update updateQueueDisplay to delegate
pattern = r'updateQueueDisplay\(\) \{[^}]+\}'
replacement = '''updateQueueDisplay() {
        // Delegate to queue controller
        if (this.queueController) {
            this.queueController.updateDisplay();
        }
    }'''
content = re.sub(pattern, replacement, content, flags=re.DOTALL)

# 7. Remove old queue properties
content = re.sub(r'this\.generationQueue = \[\];\s*\n', '', content)
content = re.sub(r'this\.isGenerating = false;\s*\n', '', content)

# Write the modified content
with open('app.js', 'w') as f:
    f.write(content)

print("Integration complete. Please review app.js for any issues.")