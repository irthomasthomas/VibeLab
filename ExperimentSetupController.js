/**
 * ExperimentSetupController
 * Manages experiment setup, creation, and configuration
 */
class ExperimentSetupController {
    constructor(callbacks = {}) {
        this.callbacks = {
            onExperimentCreated: callbacks.onExperimentCreated || (() => {}),
            onValidationError: callbacks.onValidationError || (() => {}),
            onStateChanged: callbacks.onStateChanged || (() => {}),
            onModelRegistration: callbacks.onModelRegistration || (() => {})
        };

        this.state = {
            prompts: [],
            models: [],
            variations: 1,
            isCreating: false
        };

        this.initialize();
    }

    initialize() {
        // Set up event listeners for experiment setup controls
        this.bindEventListeners();
    }

    bindEventListeners() {
        const addPromptBtn = document.getElementById('add-prompt');
        const addModelBtn = document.getElementById('add-model');
        const createExperimentBtn = document.getElementById('start-experiment');

        if (addPromptBtn) {
            addPromptBtn.addEventListener('click', () => this.addPromptInput());
        }
        if (addModelBtn) {
            addModelBtn.addEventListener('click', () => this.addCustomModel());
        }
        if (createExperimentBtn) {
            createExperimentBtn.addEventListener('click', () => this.createExperiment());
        }
    }

    addPromptInput() {
        const container = document.querySelector('.prompt-inputs');
        if (!container) {
            console.error('Prompt inputs container not found');
            return;
        }

        const promptCount = container.querySelectorAll('input[type="text"]').length + 1;

        const promptDiv = document.createElement('div');
        promptDiv.className = 'prompt-with-animation';

        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'Enter your prompt...';

        const label = document.createElement('label');
        label.className = 'animation-flag';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `animated${promptCount}`;

        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(' Animated'));

        promptDiv.appendChild(input);
        promptDiv.appendChild(label);

        const addPromptBtn = document.getElementById('add-prompt');
        container.insertBefore(promptDiv, addPromptBtn);

        // Update state
        this.updateState();
    }

    addCustomModel() {
        const customInput = document.getElementById('custom-model');
        if (!customInput) {
            console.error('Custom model input not found');
            return;
        }

        const modelName = customInput.value.trim();
        if (!modelName) {
            this.callbacks.onValidationError('Please enter a model name');
            return;
        }

        const modelSelection = document.querySelector('.model-selection');
        if (!modelSelection) {
            console.error('Model selection container not found');
            return;
        }

        const label = document.createElement('label');
        label.innerHTML = `<input type="checkbox" value="${modelName}" checked> ${modelName}`;
        modelSelection.insertBefore(label, customInput);
        customInput.value = '';

        // Update state
        this.updateState();
    }

    async createExperiment() {
        try {
            this.setCreatingState(true);

            // Collect and validate data
            const experimentData = this.collectExperimentData();
            this.validateExperimentData(experimentData);

            // Register models if needed
            if (experimentData.models.length > 0) {
                try {
                    await this.callbacks.onModelRegistration(experimentData.models);
                } catch (error) {
                    console.error('Model registration failed:', error);
                    // Continue anyway - backend will handle unregistered models
                }
            }

            // Create experiment object
            const experiment = this.buildExperimentObject(experimentData);

            // Notify creation
            this.callbacks.onExperimentCreated(experiment);

            return experiment;

        } catch (error) {
            this.callbacks.onValidationError(error.message);
            return null;
        } finally {
            this.setCreatingState(false);
        }
    }

    collectExperimentData() {
        return {
            prompts: this.getValidatedPrompts(),
            models: this.getSelectedModels(),
            variations: this.getPromptVariations(),
            svgsPerVar: this.getSvgsPerVar(),
            skipBaseline: this.getSkipBaseline(),
            experimentName: this.getExperimentName()
        };
    }

    validateExperimentData(data) {
        if (data.prompts.length === 0) {
            throw new Error('Please enter at least one prompt');
        }
        if (data.models.length === 0) {
            throw new Error('Please select at least one model');
        }
        if (data.svgsPerVar < 1) {
            throw new Error('SVGs per variation must be at least 1');
        }
    }

    getValidatedPrompts() {
        const promptInputs = document.querySelectorAll('#dynamic-prompts .prompt-with-animation input[type="text"]');
        const prompts = [];

        promptInputs.forEach((input, index) => {
            const value = input.value.trim();
            if (value) {
                const animatedCheckbox = input.parentElement.querySelector('input[type="checkbox"]');
                prompts.push({
                    id: index + 1,
                    text: value,
                    animated: animatedCheckbox ? animatedCheckbox.checked : false
                });
            }
        });

        return prompts;
    }

    getSelectedModels() {
        const modelCheckboxes = document.querySelectorAll('.model-selection input[type="checkbox"]:checked');
        const models = [];

        modelCheckboxes.forEach(checkbox => {
            models.push(checkbox.value);
        });

        return models;
    }
    getPromptVariations() {
        const variations = [];
        const variationsContainer = document.getElementById("prompt-techniques-container");

        if (variationsContainer) {
            const variationItems = variationsContainer.querySelectorAll(".prompt-technique-item");
            variationItems.forEach((item, index) => {
                try {
                    const checkbox = item.querySelector("input[type=\"checkbox\"]");
                    if (checkbox && checkbox.checked) {
                        // Safely get the label text
                        const label = item.querySelector("label");
                        const name = label ? label.textContent.trim() : `Variation ${index + 1}`;
                        
                        variations.push({
                            name: name,
                            enabled: true
                        });
                    }
                } catch (error) {
                    console.error("Error processing variation item:", error);
                }
            });
        }

        return variations.length > 0 ? variations : [{ name: "baseline", enabled: true }];
    }
    getSvgsPerVar() {
        const svgsPerVarInput = document.getElementById('svgs-per-var');
        return parseInt(svgsPerVarInput ? svgsPerVarInput.value : '4') || 4;
    }

    getSkipBaseline() {
        const skipBaselineCheckbox = document.getElementById('skip-baseline');
        return skipBaselineCheckbox ? skipBaselineCheckbox.checked : false;
    }

    getExperimentName() {
        const experimentNameInput = document.getElementById('experiment-name');
        const inputValue = experimentNameInput ? experimentNameInput.value.trim() : '';
        
        return inputValue || `Experiment_${new Date().toISOString().slice(0,19).replace(/:/g,'-')}`;
    }

    buildExperimentObject(data) {
        return {
            id: this.generateExperimentId(),
            name: data.experimentName,
            created: new Date().toISOString(),
            skipBaseline: data.skipBaseline,
            prompts: data.prompts,
            models: data.models,
            variations: data.variations,
            svgsPerVar: data.svgsPerVar,
            status: 'created',
            totalJobs: data.prompts.length * data.models.length * data.variations.length,
            completedJobs: 0,
            results: []
        };
    }

    generateExperimentId() {
        return `exp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    setCreatingState(isCreating) {
        this.state.isCreating = isCreating;
        
        const createBtn = document.getElementById('start-experiment');
        if (createBtn) {
            createBtn.disabled = isCreating;
            createBtn.innerHTML = isCreating 
                ? '<i class="fas fa-spinner fa-spin"></i> Creating...'
                : '<i class="fas fa-play"></i> Start Experiment';
        }

        this.callbacks.onStateChanged(this.state);
    }

    updateState() {
        this.state.prompts = this.getValidatedPrompts();
        this.state.models = this.getSelectedModels();
        this.state.variations = this.getPromptVariations().length;
        
        this.callbacks.onStateChanged(this.state);
    }

    resetForm() {
        // Clear experiment name
        const nameInput = document.getElementById('experiment-name');
        if (nameInput) {
            nameInput.value = '';
        }

        // Clear prompts
        const promptInputs = document.querySelectorAll('#dynamic-prompts .prompt-with-animation');
        promptInputs.forEach(promptDiv => {
            if (promptDiv.parentNode) {
                promptDiv.parentNode.removeChild(promptDiv);
            }
        });

        // Uncheck model checkboxes
        const modelCheckboxes = document.querySelectorAll('.model-selection input[type="checkbox"]');
        modelCheckboxes.forEach(checkbox => {
            checkbox.checked = false;
        });

        // Reset variations
        const variationCheckboxes = document.querySelectorAll('#prompt-techniques-container input[type="checkbox"]');
        variationCheckboxes.forEach(checkbox => {
            checkbox.checked = false;
        });

        // Reset other inputs
        const svgsPerVarInput = document.getElementById('svgs-per-var');
        if (svgsPerVarInput) {
            svgsPerVarInput.value = '4';
        }

        const skipBaselineCheckbox = document.getElementById('skip-baseline');
        if (skipBaselineCheckbox) {
            skipBaselineCheckbox.checked = false;
        }

        // Reset state
        this.state = {
            prompts: [],
            models: [],
            variations: 1,
            isCreating: false
        };

        this.callbacks.onStateChanged(this.state);
    }

    // Public API methods
    getState() {
        return { ...this.state };
    }

    isValid() {
        try {
            const data = this.collectExperimentData();
            this.validateExperimentData(data);
            return true;
        } catch (error) {
            return false;
        }
    }

    // Get current form state
    getCurrentExperimentData() {
        try {
            return this.collectExperimentData();
        } catch (error) {
            return null;
        }
    }

    destroy() {
        // Clean up event listeners and state
        this.state = null;
        this.callbacks = null;
    }
}

// Make ExperimentSetupController globally accessible in the browser
if (typeof window !== 'undefined') {
    window.ExperimentSetupController = ExperimentSetupController;
} else if (typeof module !== 'undefined' && module.exports) {
    module.exports = ExperimentSetupController;
}
