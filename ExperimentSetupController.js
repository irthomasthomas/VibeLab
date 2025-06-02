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
            onModelRegistration: callbacks.onModelRegistration || (() => {}) // For notifying VibeLab about models in setup
        };

        this.state = {
            prompts: [],        // Array of {text, animated}
            models: [],         // Array of model ID strings
            variations: [],     // Array of variation objects {type, name, template}
            svgsPerVar: 4,
            skipBaseline: false,
            experimentName: "",
            isCreating: false
        };
        this.apiService = new ApiService(); // For fetching available models, potentially registering

        this.initialize();
    }

    initialize() {
        this.bindEventListeners();
        this.loadAvailableModelsForSelection(); // Load models for the setup UI
        // Initial update to reflect default state if any
        this.updateState(); 
    }

    bindEventListeners() {
        const addPromptBtn = document.getElementById('add-prompt-btn-setup'); // Specific ID
        const createExperimentBtn = document.getElementById('start-experiment-btn-setup'); // Specific ID
        const addTechniqueBtn = document.getElementById('add-prompt-technique-btn-setup'); // Specific ID

        if (addPromptBtn) {
            addPromptBtn.addEventListener('click', () => this.addPromptInput());
        }
        // 'add-model' button for custom string input is handled by global model selection logic now.
        // This controller will get selected models from that global list or a passed-in list.

        if (createExperimentBtn) {
            createExperimentBtn.addEventListener('click', () => this.createExperiment());
        }
        if (addTechniqueBtn) {
            addTechniqueBtn.addEventListener('click', () => this.addTechniqueElement());
        }
    }

    async loadAvailableModelsForSelection() {
        try {
            // This uses the global model selection UI elements
            // ApiService.getAvailableModels is static, no need for this.apiService here.
            const models = await this.apiService.getAvailableModels(); 
            window.allAvailableModelsGlobal = models.sort((a, b) => a.name.localeCompare(b.name));
            renderAvailableModelsGlobal(); // This global function populates the UI
        } catch (error) {
            console.error("ExperimentSetupController: Failed to load available models for UI", error);
            if (typeof vlError === 'function') vlError("Model Load Failed", "Could not fetch models for setup form.");
            window.allAvailableModelsGlobal = []; // Ensure it's an array
            renderAvailableModelsGlobal(); // Render with empty or error message
        }
    }

    addPromptInput(promptText = '', isAnimated = false) {
        const container = document.getElementById('dynamic-prompts-setup'); // Specific ID
        if (!container) {
            console.error('Prompt inputs container (#dynamic-prompts-setup) not found');
            return;
        }

        const promptDiv = document.createElement('div');
        promptDiv.className = 'prompt-with-animation-setup'; // Specific class

        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'Enter your prompt...';
        input.value = promptText;
        input.addEventListener('input', () => this.updateState()); // Update state on input change

        const label = document.createElement('label');
        label.className = 'animation-flag-setup'; // Specific class

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = isAnimated;
        checkbox.addEventListener('change', () => this.updateState());

        const removeBtn = document.createElement('button');
        removeBtn.textContent = '×';
        removeBtn.className = 'remove-prompt-btn-setup'; // Specific class
        removeBtn.type = 'button'; // Important for forms
        removeBtn.onclick = () => {
            promptDiv.remove();
            this.updateState(); // Update state after removal
        };

        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(' Animated'));

        promptDiv.appendChild(input);
        promptDiv.appendChild(label);
        promptDiv.appendChild(removeBtn);
        
        container.appendChild(promptDiv);
        this.updateState(); // Update state after adding
    }
    
    // addCustomModelStringInput is handled by the global model selection logic now.
    // This controller will receive the list of selected models via updateSelectedModels.

    updateSelectedModels(selectedModelIds) { // Called by global model selection logic
        this.state.models = selectedModelIds;
        // Potentially update some UI within the setup controller if it directly displays models
        console.log("ExperimentSetupController: Selected models updated to:", selectedModelIds);
        this.updateState(); // General state update
    }


    addTechniqueElement(name = '', template = '{prompt}', enabled = true) {
        const container = document.getElementById('prompt-techniques-list-setup'); // Specific ID
        if (!container) {
            console.error("Techniques container (#prompt-techniques-list-setup) not found.");
            return;
        }

        const techniqueDiv = document.createElement('div');
        techniqueDiv.classList.add('prompt-technique-item-setup'); // Specific class
        const uniqueId = `technique-${Date.now()}-${Math.random().toString(16).slice(2)}`;

        techniqueDiv.innerHTML = `
            <input type="checkbox" id="${uniqueId}-enabled" class="technique-enabled-setup" ${enabled ? 'checked' : ''}>
            <input type="text" class="technique-name-setup" placeholder="Technique Name (e.g., Few-Shot)" value="${name}">
            <textarea class="technique-template-setup" placeholder="Template (use {prompt})">${template}</textarea>
            <button type="button" class="remove-technique-btn-setup">Remove</button>
        `;
        container.appendChild(techniqueDiv);

        techniqueDiv.querySelector('.remove-technique-btn-setup').addEventListener('click', () => {
            techniqueDiv.remove();
            this.updateState();
        });
        // Add event listeners to update state on change
        techniqueDiv.querySelectorAll('input, textarea').forEach(el => {
            el.addEventListener('input', () => this.updateState());
            el.addEventListener('change', () => this.updateState());
        });
        this.updateState();
    }


    async createExperiment() {
        try {
            this.setCreatingState(true);
            const currentData = this.collectExperimentData(); // Uses current UI state
            this.validateExperimentData(currentData);

            // The onModelRegistration callback is more of a notification.
            // Actual registration happens on backend or via dedicated model management UI.
            if (this.callbacks.onModelRegistration && currentData.models.length > 0) {
                 this.callbacks.onModelRegistration(currentData.models);
            }
            
            // Experiment object to be passed to VibeLab (app.js)
            const experimentForVibeLab = {
                id: this.generateExperimentId(),
                name: currentData.experimentName,
                description: currentData.experimentDescription || "", // Add description field
                created: new Date().toISOString(),
                skipBaseline: currentData.skipBaseline,
                prompts: currentData.prompts, // [{text, animated}, ...]
                models: currentData.models,   // ["model_id_1", ...]
                variations: currentData.variations, // [{type, name, template}, ...]
                svgsPerVar: currentData.svgsPerVar,
                config: { // Store original setup parameters here
                    skipBaseline: currentData.skipBaseline,
                    svgsPerVar: currentData.svgsPerVar,
                    // any other specific config from setup form
                },
                // status, totalJobs, completedJobs, results will be managed by VibeLab & QueueController
            };
            
            this.callbacks.onExperimentCreated(experimentForVibeLab);
            // Optionally, reset form after successful creation or leave as is for minor edits
            // this.resetForm(); 

        } catch (error) {
            console.error("Error creating experiment:", error);
            this.callbacks.onValidationError(error.message || "Unknown error during experiment creation.");
        } finally {
            this.setCreatingState(false);
        }
    }

    collectExperimentData() {
        // This method now primarily reads from this.state, which is updated by UI interactions
        return {
            experimentName: document.getElementById('experiment-name-setup') ? document.getElementById('experiment-name-setup').value.trim() : `Experiment_${new Date().toISOString().slice(0,10)}`,
            experimentDescription: document.getElementById('experiment-description-setup') ? document.getElementById('experiment-description-setup').value.trim() : "",
            prompts: this.state.prompts,
            models: this.state.models, // From global selection via updateSelectedModels
            variations: this.state.variations,
            svgsPerVar: parseInt(document.getElementById('svgs-per-var-setup') ? document.getElementById('svgs-per-var-setup').value : '1') || 1,
            skipBaseline: document.getElementById('skip-baseline-setup') ? document.getElementById('skip-baseline-setup').checked : false,
            tags: this.getTagsFromSetup() // Example of getting tags if there's an input for it
        };
    }
    
    getTagsFromSetup() {
        const tagsInput = document.getElementById('experiment-tags-setup');
        if (tagsInput && tagsInput.value.trim()) {
            return tagsInput.value.trim().split(',').map(t => t.trim()).filter(t => t);
        }
        return [];
    }


    validateExperimentData(data) {
        if (!data.experimentName) {
            throw new Error("Experiment name is required.");
        }
        if (!data.prompts || data.prompts.length === 0) {
            throw new Error('Please enter at least one prompt.');
        }
        if (!data.models || data.models.length === 0) {
            throw new Error('Please select at least one model.');
        }
        if (!data.variations || data.variations.length === 0) {
            // Auto-add baseline if no variations specified? Or error? For now, error.
            throw new Error('Please define at least one prompt technique/variation (or ensure baseline is included).');
        }
        if (data.svgsPerVar < 1 || data.svgsPerVar > 100) { // Max 100 sanity check
            throw new Error('SVGs per variation must be between 1 and 100.');
        }
    }

    // getValidatedPrompts, getSelectedModels, getPromptVariations
    // These are now part of updateState which reads from DOM and updates this.state
    // collectExperimentData will then use this.state

    setCreatingState(isCreating) {
        this.state.isCreating = isCreating;
        const createBtn = document.getElementById('start-experiment-btn-setup'); // Specific ID
        if (createBtn) {
            createBtn.disabled = isCreating;
            createBtn.innerHTML = isCreating 
                ? 'Creating...' // Simpler text
                : 'Create & Setup Experiment';
        }
        this.callbacks.onStateChanged({ isCreating }); // Only pass relevant part of state
    }

    updateState() { // Reads current DOM of setup form and updates internal state
        // Prompts
        const promptElements = document.querySelectorAll('#dynamic-prompts-setup .prompt-with-animation-setup');
        const currentPrompts = [];
        promptElements.forEach(div => {
            const input = div.querySelector('input[type="text"]');
            const checkbox = div.querySelector('input[type="checkbox"]');
            if (input && input.value.trim()) {
                currentPrompts.push({ text: input.value.trim(), animated: checkbox ? checkbox.checked : false });
            }
        });
        this.state.prompts = currentPrompts;

        // Models are updated via updateSelectedModels from global UI

        // Variations/Techniques
        const techniqueElements = document.querySelectorAll('#prompt-techniques-list-setup .prompt-technique-item-setup');
        const currentVariations = [];
        techniqueElements.forEach(div => {
            const enabledCheckbox = div.querySelector('.technique-enabled-setup');
            if (enabledCheckbox && enabledCheckbox.checked) {
                const nameInput = div.querySelector('.technique-name-setup');
                const templateArea = div.querySelector('.technique-template-setup');
                currentVariations.push({
                    type: nameInput.value.trim().toLowerCase().replace(/\s+/g, '_') || 'custom', // Generate a type
                    name: nameInput.value.trim() || 'Custom Variation',
                    template: templateArea.value.trim() || '{prompt}'
                });
            }
        });
        // Ensure baseline is present if no other variations are selected and skipBaseline is false
        const skipBaseline = document.getElementById('skip-baseline-setup') ? document.getElementById('skip-baseline-setup').checked : false;
        if (currentVariations.length === 0 && !skipBaseline) {
            currentVariations.push({ type: 'baseline', name: 'Baseline', template: '{prompt}' });
        }
        this.state.variations = currentVariations;
        
        // Other scalar values
        this.state.svgsPerVar = parseInt(document.getElementById('svgs-per-var-setup') ? document.getElementById('svgs-per-var-setup').value : '1') || 1;
        this.state.skipBaseline = skipBaseline;
        this.state.experimentName = document.getElementById('experiment-name-setup') ? document.getElementById('experiment-name-setup').value.trim() : "";

        this.callbacks.onStateChanged(this.state); // Notify VibeLab of state changes
    }
    
    // --- Methods expected by VibeLab (app.js) ---
    setPrompts(promptsData) { // promptsData is an array of {text, animated}
        const container = document.getElementById('dynamic-prompts-setup');
        if (!container) return;
        container.innerHTML = ''; // Clear existing prompts in UI
        promptsData.forEach(p => this.addPromptInput(p.text, p.animated));
        this.updateState(); // Update internal state after DOM change
    }

    getCurrentSetupData() { // For "Save Setup as Template" functionality in VibeLab
        this.updateState(); // Ensure state is fresh from DOM before collecting
        return this.collectExperimentData(); // Use the method that reads from state or DOM
    }

    loadExperimentForEditing(experiment) {
        // Populate form elements with experiment data
        const nameInput = document.getElementById('experiment-name-setup');
        if (nameInput) nameInput.value = experiment.name || '';
        
        const descInput = document.getElementById('experiment-description-setup');
        if (descInput) descInput.value = experiment.description || '';

        this.setPrompts(experiment.prompts || []); // Use existing method

        // Models (update global selection UI which then calls back to updateSelectedModels)
        selectedModelsGlobal.clear();
        (experiment.models || []).forEach(modelId => selectedModelsGlobal.add(modelId));
        renderAvailableModelsGlobal(); // Re-render the global model checklist
        renderSelectedModelsGlobal(); // Re-render the selected models display
        this.updateSelectedModels(experiment.models || []); // Update controller's internal state

        // Variations/Techniques
        const techContainer = document.getElementById('prompt-techniques-list-setup');
        if (techContainer) techContainer.innerHTML = ''; // Clear existing
        (experiment.variations || []).forEach(v => this.addTechniqueElement(v.name, v.template, true));

        const svgsInput = document.getElementById('svgs-per-var-setup');
        if (svgsInput) svgsInput.value = experiment.config?.svgsPerVar || experiment.svgsPerVar || 1;
        
        const skipBaselineCheck = document.getElementById('skip-baseline-setup');
        if (skipBaselineCheck) skipBaselineCheck.checked = experiment.config?.skipBaseline || experiment.skipBaseline || false;

        const tagsInput = document.getElementById('experiment-tags-setup');
        if (tagsInput && experiment.config?.tags) tagsInput.value = experiment.config.tags.join(', ');


        this.updateState(); // Refresh internal state and notify VibeLab
        if (typeof vlInfo === 'function') vlInfo("Experiment Loaded for Editing", `"${experiment.name}" is ready in the setup form.`);
    }

    resetForm() {
        const nameInput = document.getElementById('experiment-name-setup');
        if (nameInput) nameInput.value = '';
        const descInput = document.getElementById('experiment-description-setup');
        if (descInput) descInput.value = '';

        this.setPrompts([]); // Clear prompts using the method

        selectedModelsGlobal.clear(); // Clear global model selection
        renderAvailableModelsGlobal();
        renderSelectedModelsGlobal();
        this.updateSelectedModels([]); // Update controller state

        const techContainer = document.getElementById('prompt-techniques-list-setup');
        if (techContainer) techContainer.innerHTML = '';
        // Add a default baseline technique perhaps, or leave empty
        this.addTechniqueElement('Baseline', '{prompt}', true);


        const svgsInput = document.getElementById('svgs-per-var-setup');
        if (svgsInput) svgsInput.value = '1';
        const skipBaselineCheck = document.getElementById('skip-baseline-setup');
        if (skipBaselineCheck) skipBaselineCheck.checked = false;
        const tagsInput = document.getElementById('experiment-tags-setup');
        if (tagsInput) tagsInput.value = "";

        this.updateState(); // Update internal state and notify
        if (typeof vlInfo === 'function') vlInfo("Setup Form Reset", "The experiment setup form has been cleared.");
    }
    
    generateExperimentId() { // Helper
        return `exp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    destroy() { /* Placeholder for future cleanup */ }
}

// Make ExperimentSetupController globally accessible (if needed, or handle via VibeLab instance)
// if (typeof window !== 'undefined') {
//     window.ExperimentSetupController = ExperimentSetupController;
// }
