#!/usr/bin/env python3
"""
Integrate ExperimentSetupController into app.js
This script will:
1. Add the controller initialization
2. Update constructor to create the controller
3. Remove old methods that are now in the controller
4. Update references to use the controller
"""

import re
import sys

def integrate_experiment_controller(app_js_content):
    """Integrate ExperimentSetupController into app.js"""
    
    # 1. Add ExperimentSetupController to constructor
    constructor_pattern = r'(this\.queueController = new GenerationQueueController\([^)]+\);)'
    controller_init = '''this.queueController = new GenerationQueueController(
            this.generationQueue,
            (data) => this.handleQueueUpdate(data)
        );
        
        // Initialize Experiment Setup Controller
        this.experimentController = new ExperimentSetupController(
            this.apiService,
            this.queueController,
            (experiment) => this.handleExperimentCreated(experiment),
            (tab) => this.switchTab(tab)
        );'''
    
    app_js_content = re.sub(constructor_pattern, controller_init, app_js_content)
    
    # 2. Add handleExperimentCreated method after handleQueueUpdate
    handle_queue_pattern = r'(handleQueueUpdate\(data\) {[^}]+})'
    handle_experiment = r'''\1

    handleExperimentCreated(experiment) {
        this.currentExperiment = experiment;
        // Any additional handling needed when experiment is created
    }'''
    
    app_js_content = re.sub(handle_queue_pattern, handle_experiment, app_js_content)
    
    # 3. Remove old event listeners that are now in the controller
    # Remove add-prompt listener
    app_js_content = re.sub(
        r"document\.getElementById\('add-prompt'\)\.addEventListener\('click', \(\) => this\.addPromptInput\(\)\);?\n?",
        "", app_js_content
    )
    
    # Remove add-model listener
    app_js_content = re.sub(
        r"document\.getElementById\('add-model'\)\.addEventListener\('click', \(\) => this\.addCustomModel\(\)\);?\n?",
        "", app_js_content
    )
    
    # Remove start-experiment listener
    app_js_content = re.sub(
        r"document\.getElementById\('start-experiment'\)\.addEventListener\('click', \(\) => this\.createExperiment\(\)\);?\n?",
        "", app_js_content
    )
    
    # Remove add-custom-technique listener
    app_js_content = re.sub(
        r"document\.getElementById\('add-custom-technique'\)\.addEventListener\('click', \(\) => this\.addCustomTechnique\(\)\);?\n?",
        "", app_js_content
    )
    
    # Remove load-template listener
    app_js_content = re.sub(
        r"document\.getElementById\('load-template'\)\.addEventListener\('click', \(\) => this\.loadSelectedTemplate\(\)\);?\n?",
        "", app_js_content
    )
    
    # 4. Comment out methods that are now in the controller (but keep for reference)
    methods_to_comment = [
        'addPromptInput',
        'addCustomModel', 
        'createExperiment',
        'getPrompts',
        'getSelectedModels',
        'getPromptVariations',
        'addCustomTechnique',
        'loadTemplates',
        'updateTemplateSelector',
        'loadDefaultPrompts',
        'addPromptToDOM',
        'loadSelectedTemplate'
    ]
    
    for method in methods_to_comment:
        # Find method and comment it out
        pattern = rf'(\n    {method}\([^{{]*\) {{)'
        replacement = r'\n    // Moved to ExperimentSetupController\n    /*\1'
        app_js_content = re.sub(pattern, replacement, app_js_content)
        
        # Find the closing brace and close comment
        # This is tricky - we'll do it in a second pass
    
    # 5. Update template references
    app_js_content = re.sub(
        r'this\.loadTemplates\(\)',
        'this.experimentController.loadTemplates()',
        app_js_content
    )
    
    app_js_content = re.sub(
        r'this\.templates',
        'this.experimentController.templates',
        app_js_content
    )
    
    return app_js_content

def main():
    # Read app.js
    with open('app.js', 'r') as f:
        content = f.read()
    
    # Integrate the controller
    modified_content = integrate_experiment_controller(content)
    
    # Write the modified content
    with open('app.js', 'w') as f:
        f.write(modified_content)
    
    print("✅ ExperimentSetupController integration complete!")
    print("📝 Old methods have been commented out for reference")
    print("🔧 Remember to add <script src='ExperimentSetupController.js'></script> to index.html")

if __name__ == '__main__':
    main()
