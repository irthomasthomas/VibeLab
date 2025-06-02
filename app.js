function sanitizeSvgString(svgString) {
    if (!svgString || typeof svgString !== 'string') {
        console.error("Invalid input: SVG string is required.");
        return null;
    }

    try {
        const parser = new DOMParser();
        const svgDoc = parser.parseFromString(svgString, "image/svg+xml");
        const svgElement = svgDoc.documentElement;

        // Check for parsing errors or if the root element is not <svg>
        if (svgDoc.querySelector('parsererror') || !svgElement || svgElement.tagName.toLowerCase() !== 'svg') {
            console.warn("sanitizeSvgString: Parsing error or not an SVG root element.");
            const errorElement = svgDoc.querySelector('parsererror');
            if (errorElement) {
                console.warn("Parser error details:", errorElement.textContent);
            }
            return null; // Or throw new Error("Invalid SVG content or parsing error");
        }

        // 1. Remove all <script> elements
        const scripts = svgElement.getElementsByTagName('script');
        while (scripts.length > 0) {
            scripts[0].parentNode.removeChild(scripts[0]);
        }

        // 2. Iterate through all elements
        const allElements = svgElement.getElementsByTagName('*');
        for (let i = 0; i < allElements.length; i++) {
            const el = allElements[i];

            // 2a. Remove all attributes that start with 'on'
            const attributesToRemove = [];
            for (let j = 0; j < el.attributes.length; j++) {
                const attrName = el.attributes[j].name.toLowerCase();
                if (attrName.startsWith('on')) {
                    attributesToRemove.push(el.attributes[j].name);
                }
                // 2b. Check 'href' and 'xlink:href' attributes
                if (attrName === 'href' || attrName === 'xlink:href') {
                    if (el.getAttribute(attrName)?.toLowerCase().startsWith('javascript:')) {
                        attributesToRemove.push(el.attributes[j].name);
                    }
                }
            }
            attributesToRemove.forEach(attrName => el.removeAttribute(attrName));
        }
        
        // Also check the root <svg> element itself for 'on' attributes or bad hrefs
        const rootAttributesToRemove = [];
         for (let j = 0; j < svgElement.attributes.length; j++) {
            const attrName = svgElement.attributes[j].name.toLowerCase();
            if (attrName.startsWith('on')) {
                rootAttributesToRemove.push(svgElement.attributes[j].name);
            }
            if (attrName === 'href' || attrName === 'xlink:href') { // Though less common on root SVG
                if (svgElement.getAttribute(attrName)?.toLowerCase().startsWith('javascript:')) {
                    rootAttributesToRemove.push(svgElement.attributes[j].name);
                }
            }
        }
        rootAttributesToRemove.forEach(attrName => svgElement.removeAttribute(attrName));


        // 3. Serialize the cleaned SVG DOM structure back into a string
        const serializer = new XMLSerializer();
        return serializer.serializeToString(svgElement);

    } catch (error) {
        console.error("sanitizeSvgString: Exception during SVG processing.", error);
        return null; // Or throw error;
    }
}
// VibeLab - Main Application Logic

class VibeLab {
    constructor() {
        this.currentExperiment = null;
        this.isGenerating = false;
        this.results = [];
        this.rankings = {};
        this.templates = [];

        // Initialize API service
        this.apiService = new ApiService();
        
        // Initialize queue controller
        this.queueController = new GenerationQueueController(this.apiService, (data) => this.handleQueueUpdate(data), () => this.updateCombinedExperimentView());

        
        // Initialize Experiment Setup Controller
        // Initialize Experiment Setup Controller
        this.experimentSetupController = new ExperimentSetupController({
            onExperimentCreated: (experiment) => this.handleExperimentCreated(experiment),
            onValidationError: (error) => this.handleExperimentValidationError(error),
            onStateChanged: (state) => this.handleExperimentStateChanged(state),
            onModelRegistration: (models) => this.registerModels(models)
        });
        this.initializeEventListeners();
        this.loadSavedExperiments();
        this.loadTemplates();
        this.updateCombinedExperimentView = this.updateCombinedExperimentView.bind(this);
        this.renderDetailedQueueView = this.renderDetailedQueueView.bind(this);
    }
    registerModels(models) {
        console.log("VibeLab: Models registered by ExperimentSetupController:", models);
        // This method is called by ExperimentSetupController via the onModelRegistration callback.
        // It can be used to update VibeLab's internal state if needed,
        // or simply act as a confirmation hook. The actual models for an experiment
        // are typically part of the experiment object passed to handleExperimentCreated.
        // For now, logging confirms it's called correctly.
        // Example: this.registeredModelsForCurrentSetup = models;
    }


    handleQueueUpdate(data) {
        if (data.type === "result" && this.currentExperiment && this.currentExperiment.results) {
            // Ensure the result is added to the current experiment's results
            const resultData = data.data;
            this.currentExperiment.results.push(resultData);
            
            // Also update completed jobs if the experiment object tracks it this way
            if (this.currentExperiment.hasOwnProperty('completedJobs')) {
                this.currentExperiment.completedJobs++;
            }

            this.renderSvgForEvaluation(resultData); // Call the single, robust renderSvgForEvaluation
        }
        // this.updateEvaluationView(); // This might be too frequent, consider if needed on every queue update
        this.updateCombinedExperimentView(); // More general update for progress bars etc.
    }

    handleExperimentCreated(experiment) {
        this.currentExperiment = experiment;
        this.generateQueue();
        // this.queueController.startGeneration(); // Starting generation immediately might not always be desired.
                                                // User might want to review before starting.
                                                // The combined tab button will handle starting.
        this.switchTab('evaluate');
        this.updateCombinedExperimentView();
    }

    handleExperimentValidationError(error) {
        const errorMessage = typeof error === "string" ? error : error.message || "Experiment validation failed";
        vlWarning("Validation Error", errorMessage);
        console.error("Experiment validation error:", error);
    }

    handleExperimentStateChanged(state) {
        console.log("Experiment setup state changed:", state);
        // Future: Update UI indicators, analytics tracking, etc.
    }

updateCombinedExperimentView() {
    const evalGrid = document.getElementById('evaluation-images-grid'); // Get evalGrid once

    if (!this.currentExperiment || (this.currentExperiment && this.queueController && this.queueController.generationQueue.length === 0 && !this.queueController.isGenerating)) {
        if(combinedStartExperimentBtn) combinedStartExperimentBtn.textContent = 'Start Experiment';
        if(combinedStartExperimentBtn) combinedStartExperimentBtn.disabled = !this.currentExperiment || (this.queueController && this.queueController.generationQueue.length === 0 && !this.queueController.isGenerating);
        
        // combinedPauseExperimentBtn is part of combinedStartExperimentBtn logic now
        if(combinedEditExperimentBtn) combinedEditExperimentBtn.disabled = !this.currentExperiment; 
        
        if(combinedExperimentStatusSpan) combinedExperimentStatusSpan.textContent = this.currentExperiment ? 'Status: Idle / Queue Empty' : 'Status: No Experiment Loaded';
        
        if(experimentProgressFill) experimentProgressFill.style.width = '0%';
        if(experimentProgressText) experimentProgressText.textContent = '0/0 (0%)';
        
        if(detailedQueueViewDiv) {
            detailedQueueViewDiv.innerHTML = this.currentExperiment ? '<p>Queue is empty.</p>' : '<p>No experiment loaded.</p>';
        }
        if(evalGrid && (!this.currentExperiment || this.currentExperiment.results.length === 0)) {
             evalGrid.innerHTML = '<p>Generated images for evaluation will appear here.</p>';
        }


        if (this.currentExperiment && this.queueController && this.queueController.generationQueue.length === 0 && !this.queueController.isGenerating) {
            // If experiment exists but queue is empty and not generating, it might be finished or cleared
            // this.currentExperiment.results = []; // Don't clear results here, they should persist
            // this.currentExperiment.completedJobs = 0; // Don't reset completed jobs
        }
    }

    if (this.currentExperiment) {
        const { status, totalJobs, completedJobs } = this.currentExperiment;
        const isRunning = this.queueController ? this.queueController.isGenerating : false; // Use isGenerating from controller

        if(combinedStartExperimentBtn) {
            combinedStartExperimentBtn.disabled = (this.queueController && this.queueController.generationQueue.length === 0 && !isRunning);
            combinedStartExperimentBtn.textContent = isRunning ? 'Pause Experiment' : 'Start/Resume Experiment';
        }

        if(combinedEditExperimentBtn) combinedEditExperimentBtn.disabled = isRunning; 
        if(combinedExperimentStatusSpan) combinedExperimentStatusSpan.textContent = `Status: ${status || 'N/A'} (${isRunning ? 'Running' : (this.queueController && this.queueController.generationQueue.length === 0 ? 'Empty/Finished' : 'Paused/Idle')})`;

        const progressPercent = totalJobs > 0 ? (completedJobs / totalJobs) * 100 : 0;
        if(experimentProgressFill) experimentProgressFill.style.width = `${progressPercent}%`;
        if(experimentProgressText) experimentProgressText.textContent = `${completedJobs}/${totalJobs} (${progressPercent.toFixed(1)}%)`;

        if (detailedQueueViewDiv && detailedQueueViewDiv.style.display !== 'none') {
            this.renderDetailedQueueView(); 
        }
        // If results exist, they should be rendered by renderSvgForEvaluation via handleQueueUpdate
        // If no results yet, the placeholder in evalGrid (set above or initially) remains.
        if (evalGrid && this.currentExperiment.results && this.currentExperiment.results.length === 0 && this.queueController.generationQueue.length === 0) {
            evalGrid.innerHTML = '<p>Generated images for evaluation will appear here. Start an experiment or load one with results.</p>';
        }


    } else {
        if(combinedStartExperimentBtn) {
            combinedStartExperimentBtn.textContent = 'Start Experiment';
            combinedStartExperimentBtn.disabled = true;
        }
        if(combinedEditExperimentBtn) combinedEditExperimentBtn.disabled = true;
        if(combinedExperimentStatusSpan) combinedExperimentStatusSpan.textContent = 'Status: No Experiment Loaded';
        if(experimentProgressFill) experimentProgressFill.style.width = '0%';
        if(experimentProgressText) experimentProgressText.textContent = '0/0 (0%)';
        if(detailedQueueViewDiv) detailedQueueViewDiv.innerHTML = '<p>No experiment loaded.</p>';
        if(evalGrid) evalGrid.innerHTML = '<p>Generated images for evaluation will appear here.</p>';
    }
}

renderDetailedQueueView() {
    if (!detailedQueueViewDiv) return;
    const queue = this.queueController ? this.queueController.generationQueue : [];

    if (!queue || queue.length === 0) {
        detailedQueueViewDiv.innerHTML = '<p>Queue is empty or not initialized.</p>';
        return;
    }

    detailedQueueViewDiv.innerHTML = ''; // Clear previous content
    const displayQueue = [...queue]; // Use queue from controller

    // Fisher-Yates (aka Knuth) Shuffle algorithm for display variety
    for (let i = displayQueue.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [displayQueue[i], displayQueue[j]] = [displayQueue[j], displayQueue[i]];
    }

    const ul = document.createElement('ul');
    ul.classList.add('detailed-queue-list');

    displayQueue.slice(0, 50).forEach(item => { // Display a limited number for performance
        const li = document.createElement('li');
        li.classList.add('detailed-queue-item', `status-${item.status}`);
        
        const promptText = item.prompt ? (item.prompt.text || item.prompt).substring(0, 50) + '...' : 'N/A';
        const modelName = item.model || 'N/A';
        const variationName = item.variation ? (item.variation.name || item.variation.type) : 'N/A';

        li.innerHTML = `
            <span class="queue-item-id">ID: ${item.id.substring(0,8)}</span>
            <span class="queue-item-status">Status: ${item.status}</span>
            <div class="queue-item-details">
                Prompt: ${promptText}, Model: ${modelName}, Variation: ${variationName}
            </div>
        `;
        ul.appendChild(li);
    });
    detailedQueueViewDiv.appendChild(ul);

    if (displayQueue.length > 50) {
        const moreItemsP = document.createElement('p');
        moreItemsP.textContent = `... and ${displayQueue.length - 50} more items.`;
        detailedQueueViewDiv.appendChild(moreItemsP);
    }
}

// This is the more robust version of renderSvgForEvaluation, keep this one.
// The earlier, simpler version should be removed.
renderSvgForEvaluation(svgResultData) {
    this.updateEvaluationView();
}

    initializeEventListeners() {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.dataset.tab;
                this.switchTab(tab);
            });
        });

        if (document.getElementById('add-prompt')) {
            document.getElementById('add-prompt').addEventListener('click', () => {
                this.experimentSetupController.addPromptInput();
            });
        }
        if (document.getElementById('add-model')) {
            document.getElementById('add-model').addEventListener('click', () => {
                this.experimentSetupController.addCustomModel();
            });
        }
        if (document.getElementById('start-experiment')) {
            document.getElementById('start-experiment').addEventListener('click', () => {
                this.experimentSetupController.createExperiment();
            });
        }

        // Queue tab events (assuming these are for a separate queue tab, not the combined one)
        if (document.getElementById('start-queue')) {
            document.getElementById('start-queue').addEventListener('click', () => this.queueController.startGeneration());
        }
        if (document.getElementById('pause-queue')) {
            document.getElementById('pause-queue').addEventListener('click', () => this.queueController.pauseGeneration());
        }
        if (document.getElementById('clear-queue')) {
            document.getElementById('clear-queue').addEventListener('click', () => this.queueController.clearQueue());
        }
        
        // Evaluation tab events
        if (document.getElementById('eval-prompt-filter')) {
            document.getElementById('eval-prompt-filter').addEventListener('change', () => this.updateEvaluationView());
        }
        if (document.getElementById('eval-view-mode')) {
            document.getElementById('eval-view-mode').addEventListener('change', () => this.updateEvaluationView());
        }
        if (document.getElementById('reset-rankings')) {
            document.getElementById('reset-rankings').addEventListener('click', () => this.resetRankings());
        }
        if (document.getElementById('hide-details')) {
            document.getElementById('hide-details').addEventListener('change', () => this.updateEvaluationView());
        }
        if (document.getElementById('analysis-mode')) {
            document.getElementById('analysis-mode').addEventListener('change', () => this.updateAnalysisMode());
        }

        // Results tab events
        if (document.getElementById('export-results')) {
            document.getElementById('export-results').addEventListener('click', () => this.exportResults());
        }
        if (document.getElementById('save-experiment')) {
            document.getElementById('save-experiment').addEventListener('click', () => this.saveExperiment());
        }
        if (document.getElementById('load-experiment')) {
            document.getElementById('load-experiment').addEventListener('click', () => this.loadExperiment());
        }
        
        // Template management events
        if (document.getElementById('load-template')) {
            document.getElementById('load-template').addEventListener('click', () => this.loadSelectedTemplate());
        }
        if (document.getElementById('save-as-template')) {
            document.getElementById('save-as-template').addEventListener('click', () => this.saveCurrentAsTemplate());
        }
        if (document.getElementById('manage-templates')) {
            document.getElementById('manage-templates').addEventListener('click', () => this.showTemplateManager());
        }
        if (document.getElementById('create-template')) {
            document.getElementById('create-template').addEventListener('click', () => this.createNewTemplate());
        }
        
        // Modal close handlers
        const closeModalButton = document.querySelector('#template-modal .close');
        if (closeModalButton) {
            closeModalButton.addEventListener('click', () => this.hideTemplateManager());
        }
        const templateModal = document.getElementById('template-modal');
        if (templateModal) {
            templateModal.addEventListener('click', (e) => {
                if (e.target.id === 'template-modal') {
                    this.hideTemplateManager();
                }
            });
        }

        // Combined Evaluation Tab Listeners (moved here for correct 'this' context)
        if (combinedStartExperimentBtn) {
            combinedStartExperimentBtn.addEventListener('click', () => {
                if (this.queueController && this.currentExperiment) { // Ensure experiment is loaded
                    if (this.queueController.isGenerating) {
                        this.queueController.pauseGeneration();
                    } else {
                        if (this.queueController.generationQueue.length > 0) {
                            this.queueController.startGeneration();
                        } else if (this.currentExperiment) {
                            // If queue is empty but experiment exists, re-initialize and start
                            // This assumes createExperiment or a similar method populates the queue
                            // For now, let's assume startGeneration handles empty queue if needed or user re-initializes via "Edit"
                            vlWarning("Queue Empty", "The generation queue is empty. Edit the experiment to add tasks or load an experiment with a pending queue.");
                        }
                    }
                    this.updateCombinedExperimentView();
                } else if (!this.currentExperiment) {
                    vlWarning("No Experiment", "Please set up or load an experiment first.");
                }
            });
        }

        if (combinedEditExperimentBtn) {
            combinedEditExperimentBtn.addEventListener('click', () => {
                if (this.currentExperiment && this.queueController && this.queueController.isGenerating) {
                    vlWarning("Cannot Edit", "Pause the current experiment before editing.");
                    return;
                }
                // Optional: pre-fill setup form if this.currentExperiment exists
                // This is handled by ExperimentSetupController when it loads.
                this.switchTab('setup');
            });
        }

        if (toggleDetailedQueueBtn) {
            toggleDetailedQueueBtn.addEventListener('click', () => {
                if (detailedQueueViewDiv) {
                    const isHidden = detailedQueueViewDiv.style.display === 'none' || !detailedQueueViewDiv.style.display;
                    detailedQueueViewDiv.style.display = isHidden ? 'block' : 'none';
                    toggleDetailedQueueBtn.textContent = isHidden ? 'Hide Queue Details' : 'Show Queue Details';
                    if (isHidden) {
                        this.renderDetailedQueueView(); 
                    }
                }
            });
        }
    }

switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        document.getElementById(`${tabName}-tab`).classList.add('active');

        // Update content based on tab (optional, but good for conditional logic)
        if (tabName === 'evaluate') {
            this.updateCombinedExperimentView();
            this.updateEvaluationView();
        } else if (tabName === 'results') {
            this.updateResultsTable();
            this.updateExperimentOverview();
        }
    }

    getPrompts() {
        const promptInputs = document.querySelectorAll('#dynamic-prompts .prompt-with-animation input[type="text"]');
        const prompts = [];

        promptInputs.forEach((input, index) => {
            const value = input.value.trim();
            if (value.length > 0) {
                const animatedCheckbox = input.nextElementSibling.querySelector("input[type=\"checkbox\"]");
                prompts.push({
                    text: value,
                    animated: animatedCheckbox ? animatedCheckbox.checked : false
                });
            }
        });

        return prompts;
    }

    getSelectedModels() {
        const checkboxes = document.querySelectorAll('.model-selection input[type="checkbox"]:checked');
        return Array.from(checkboxes).map(cb => cb.value);
    }

    getPromptVariations() {
        const variations = [];
        const techniqueItems = document.querySelectorAll('#prompt-techniques-container .prompt-technique-item');
        techniqueItems.forEach(item => {
            const isEnabledCheckbox = item.querySelector('.technique-enabled');
            if (!isEnabledCheckbox || !isEnabledCheckbox.checked) return;
            const nameInput = item.querySelector('.technique-name');
            const templateInput = item.querySelector('.technique-template');
            const name = nameInput ? nameInput.value.trim() : 'custom_technique';
            const template = templateInput ? templateInput.value.trim() : '{prompt}';
            if (name && template) {
                variations.push({
                    type: name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''),
                    name: name,
                    template: template
                });
            }
        });
        const baselineExists = variations.some(v => v.type === 'baseline');
        if (variations.length === 0) {
            variations.push({ type: 'baseline', name: 'Baseline', template: '{prompt}' });
        } else {
            const baselineCheckbox = document.querySelector('#prompt-techniques-container .prompt-technique-item input[value="base"].technique-enabled');
            if (baselineCheckbox && baselineCheckbox.checked && !baselineExists) {
                variations.push({ type: 'baseline', name: 'Baseline', template: '{prompt}' });
            }
        }
        return variations;
    }

    generateQueue() {
        // This method seems to be for manual queue generation, 
        // but ExperimentSetupController and GenerationQueueController likely handle this.
        // If this VibeLab.generationQueue is still used, it should be this.queueController.generationQueue
        // For now, assuming queueController handles its own queue based on experiment definition.
        // If this method is indeed used, it should populate this.queueController.generationQueue
        // and then call this.queueController.updateDisplay() and this.updateCombinedExperimentView().

        if (!this.currentExperiment) {
            console.error("Cannot generate queue: No current experiment.");
            return;
        }

        const { prompts, models, variations, svgsPerVar, skipBaseline } = this.currentExperiment;
        const newQueue = [];

        prompts.forEach(promptObj => {
            models.forEach(model => {
                variations.forEach(variation => {
                    if (skipBaseline && variation.type === 'baseline') return;

                    for (let i = 0; i < svgsPerVar; i++) {
                        newQueue.push({
                            id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                            prompt: promptObj, // promptObj itself {text, animated}
                            model,
                            variation,
                            experiment_id: this.currentExperiment.id || this.currentExperiment.name, // Use experiment ID or name
                            instance: i + 1,
                            status: 'pending',
                            progress: 0,
                            result: null,
                            error: null
                        });
                    }
                });
            });
        });
        
        // This method should likely be part of queueController or update its queue
        this.queueController.generationQueue = newQueue; // Directly setting controller's queue
        this.queueController.updateDisplay(); // Assuming this updates the #queue-list
        this.updateCombinedExperimentView(); // Update combined view elements

        if (document.getElementById('start-queue')) { // This is for the dedicated queue tab
             document.getElementById('start-queue').disabled = newQueue.length === 0;
        }
    }

    updateQueueDisplay() {
        const queueList = document.getElementById('queue-list');
        if (!queueList) {
            // console.error("Queue list element not found for display update."); // Be less noisy if element is optional
            return;
        }
        queueList.innerHTML = '';

        const currentQueue = this.queueController ? this.queueController.generationQueue : [];

        if (!currentQueue || currentQueue.length === 0) {
            queueList.innerHTML = '<p>Queue is empty.</p>';
            return;
        }

        const displayQueue = [...currentQueue];

        for (let i = displayQueue.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [displayQueue[i], displayQueue[j]] = [displayQueue[j], displayQueue[i]];
        }

        // Display only a subset if the queue is very large, e.g., first 50-100
        const itemsToDisplay = displayQueue.slice(0, 100);


        itemsToDisplay.forEach(item => {
            const queueItem = document.createElement('div');
            queueItem.className = `queue-item ${item.status}`; 
            
            const promptTextObj = item.prompt; // item.prompt is {text, animated}
            const promptText = promptTextObj ? (promptTextObj.text || String(promptTextObj)).substring(0, 100) + ((promptTextObj.text || String(promptTextObj)).length > 100 ? '...' : '') : 'N/A';
            const modelName = item.model || 'N/A';
            const techniqueName = item.variation ? (item.variation.name || item.variation.type || 'N/A') : 'N/A';

            queueItem.innerHTML = `
                <div class="queue-item-header">
                    <span class="item-status">Status: ${item.status}</span>
                    <span class="item-priority">Priority: ${item.priority !== undefined ? item.priority : 'N/A'}</span>
                </div>
                <div class="queue-item-content">
                    <p><strong>Prompt:</strong> ${promptText}</p>
                    <p><strong>Model:</strong> ${modelName}</p>
                    <p><strong>Technique:</strong> ${techniqueName}</p>
                </div>
                ${item.result && item.result.svgContent ? `<div class="queue-item-result"><img src="data:image/svg+xml;base64,${btoa(item.result.svgContent)}" alt="Generated SVG"></div>` : ''}
                ${item.error ? `<div class="queue-item-error">Error: ${item.error}</div>` : ''}
            `;
            if (item.id) {
                queueItem.dataset.itemId = item.id;
            }
            
            queueList.appendChild(queueItem);
        });

        if (displayQueue.length > itemsToDisplay.length) {
            const moreInfo = document.createElement('p');
            moreInfo.textContent = `Displaying ${itemsToDisplay.length} of ${displayQueue.length} items.`;
            queueList.appendChild(moreInfo);
        }
    }

    getVariationDisplayText(variation) {
        if (variation.type === 'baseline') return 'No few-shot';
        if (variation.type === 'real-fewvibe') return 'Real few-vibe';
        if (variation.n) return `${variation.type} (N=${variation.n})`;
        if (variation.index) return `Custom ${variation.index}`;
        return variation.type;
    }

    async startGeneration() {
        // This method seems to be a local implementation of what GenerationQueueController should do.
        // Prefer using this.queueController.startGeneration().
        // If this is kept, it needs to use this.queueController.generationQueue.
        if (this.queueController) {
            this.queueController.startGeneration();
            this.updateCombinedExperimentView(); // Reflect status change
        } else {
            console.error("Queue controller not available to start generation.");
        }
    }


    async generateSVG(queueItem) {
        queueItem.status = 'running';
        queueItem.progress = 10;
        this.queueController.updateDisplay(); // Single call is enough here for status change

        const fullPrompt = queueItem.variation.template.replace('{prompt}', queueItem.prompt.text); // Use .text from prompt object

        queueItem.progress = 30;
        // this.queueController.updateDisplay(); // Not strictly needed again immediately

        try {
            const result = await this.executeLLMCommand(queueItem.model, fullPrompt, queueItem); // Pass queueItem for potential detailed logging
            queueItem.progress = 90;
            // this.queueController.updateDisplay(); // Update after LLM call

            const svgContent = this.extractSVG(result);
            if (svgContent) {
                queueItem.result = {
                    fullResponse: result,
                    svgContent: svgContent,
                    timestamp: new Date().toISOString()
                };
                queueItem.status = 'completed';
                queueItem.progress = 100;

                // This result structure is for the queue item.
                // The result pushed to this.currentExperiment.results should match what renderSvgForEvaluation expects.
                const experimentResult = {
                    id: queueItem.id,
                    prompt: queueItem.prompt, // This is {text, animated}
                    // animated: queueItem.prompt.animated, // Already in prompt object
                    model: queueItem.model,
                    variation: queueItem.variation,
                    svgContent: svgContent, // This is what renderSvgForEvaluation needs
                    status: 'completed', // Important for renderSvgForEvaluation
                    timestamp: queueItem.result.timestamp,
                    rank: null 
                };
                // The handleQueueUpdate method should be responsible for adding to experiment results
                // and calling renderSvgForEvaluation. This direct push here might be redundant
                // if queueController's onUpdate callback handles it.
                // For now, let's assume this is one way results get into the experiment.
                // this.currentExperiment.results.push(experimentResult); // This might be handled by callback
                // this.renderSvgForEvaluation(experimentResult); // Also likely handled by callback
            } else {
                throw new Error('No valid SVG found in response');
            }
        } catch (error) {
            queueItem.status = 'error';
            queueItem.error = error.message;
            queueItem.progress = 0;
            // throw error; // Re-throwing might stop a batch process in queueController
            console.error(`Error generating SVG for ${queueItem.id}:`, error); // Log instead of re-throwing to allow queue to continue
        } finally {
            this.queueController.updateDisplay(); // Final update for this item
            this.updateCombinedExperimentView(); // Update overall progress
        }
    }

    async executeLLMCommand(model, prompt) { // queueItem can be passed for more context if needed
        // Call our Python backend that interfaces with llm CLI
        try {
            // ApiService.makeRequest returns parsed JSON directly, not a Response object
            const data = await this.apiService.makeRequest("/generate", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    model: model,
                    prompt: prompt
                })
            });

            // The data is already parsed JSON from ApiService
            if (!data.success) {
                throw new Error(data.error || "Unknown error from LLM backend");
            }

            return data.output;

        } catch (error) {
            console.error("LLM execution error:", error);
            throw new Error(`Failed to generate with ${model}: ${error.message}`);
        }
    }
    extractSVG(text) {
        const svgMatch = text.match(/<svg[\s\S]*?<\/svg>/i);
        return svgMatch ? svgMatch[0] : null;
    }

    pauseGeneration() {
        // This method should primarily call the queueController's pause mechanism.
        if (this.queueController) {
            this.queueController.pauseGeneration();
            this.updateCombinedExperimentView(); // Reflect status change
        } else {
            console.error("Queue controller not available to pause generation.");
        }
        // The direct manipulation of this.isGenerating and DOM elements is now handled by queueController and updateCombinedExperimentView
    }

    clearQueue() {
        if (!confirm('Are you sure you want to clear the generation queue? This action cannot be undone.')) {
            return;
        }

        if (this.queueController) {
            this.queueController.clearQueue(); // Controller should handle its internal queue and UI updates
        } else {
            // Fallback if no controller, though this indicates a structural issue
            // this.generationQueue = []; /* Intentionally removed, queueController should manage this. */ 
        }
        
        // UI updates should be triggered by queueController or by updateCombinedExperimentView
        this.updateCombinedExperimentView();
        if (document.getElementById('queue-list')) this.updateQueueDisplay(); // For dedicated queue tab
    }

    addCustomTechnique() {
        const container = document.getElementById('prompt-techniques-container');
        const techniqueItem = document.createElement('div');
        techniqueItem.className = 'prompt-technique-item';
        
        // Generate unique ID for this custom technique
        const uniqueId = 'custom-technique-' + Date.now();
        
        techniqueItem.innerHTML = `
            <input type="checkbox" class="technique-enabled" id="${uniqueId}-enabled" checked>
            <input type="text" class="technique-name" id="${uniqueId}-name" placeholder="Custom Technique Name" value="Custom Technique">
            <textarea class="technique-template" id="${uniqueId}-template" placeholder="Enter your template. Use {prompt} where the base prompt should go.">{prompt}</textarea>
            <button class="remove-technique" onclick="this.parentElement.remove()">×</button>
            <span class="technique-type">(custom)</span>
        `;
        
        container.appendChild(techniqueItem);
        
        // Focus on the name input for immediate editing
        document.getElementById(`${uniqueId}-name`).focus();
    }

    updateEvaluationView() {
        if (!this.currentExperiment || !this.currentExperiment.results.length) {
            document.getElementById('svg-grid').innerHTML = '<p>No results to evaluate. Generate some SVGs first.</p>';
            return;
        }

        const promptFilter = document.getElementById('eval-prompt-filter').value;
        const viewMode = document.getElementById('eval-view-mode').value;

        // Filter results
        let filteredResults = this.currentExperiment.results;
        if (promptFilter !== 'all') {
            filteredResults = filteredResults.filter(r => r.prompt === promptFilter);
        }

        // Update prompt filter options
        this.updatePromptFilterOptions();

        // Render SVGs for ranking
        this.renderSVGsForRanking(filteredResults, viewMode);
    }

    updatePromptFilterOptions() {
        const select = document.getElementById('eval-prompt-filter');
        const currentValue = select.value;

        select.innerHTML = '<option value="all">All Prompts</option>';

        if (this.currentExperiment) {
            const uniquePrompts = [...new Set(this.currentExperiment.results.map(r => r.prompt))];
            uniquePrompts.forEach(prompt => {
                const option = document.createElement('option');
                option.value = prompt;
                option.textContent = prompt.length > 50 ? prompt.substring(0, 47) + '...' : prompt;
                select.appendChild(option);
            });
        }

        select.value = currentValue;
    }

    renderSVGsForRanking(results, viewMode) {
        const svgGrid = document.getElementById('svg-grid');
        svgGrid.innerHTML = '';

        if (results.length === 0) {
            svgGrid.innerHTML = '<p>No results match the current filter.</p>';
            return;
        }

        // Sort by current ranking if available
        results.sort((a, b) => {
            const rankA = this.rankings[a.id] || 999;
            const rankB = this.rankings[b.id] || 999;
            return rankA - rankB;
        });

        results.forEach((result, index) => {
            const svgItem = this.createSVGItem(result, index + 1);
            svgGrid.appendChild(svgItem);
        });

        // Make items draggable
        this.initializeDragAndDrop();
    }

    createSVGItem(result, rank) {
        const svgItem = document.createElement('div');
        svgItem.className = 'svg-item';
        svgItem.draggable = true;
        svgItem.dataset.id = result.id;

        const variationText = this.getVariationDisplayText(result.variation);
        const hideDetails = document.getElementById('hide-details') && document.getElementById('hide-details').checked;

        // Create rank badge
        const rankBadge = document.createElement('div');
        rankBadge.className = 'rank-badge';
        rankBadge.textContent = rank;
        svgItem.appendChild(rankBadge);

        // Create SVG container
        const svgContainer = document.createElement('div');
        svgContainer.className = `svg-container ${result.animated ? 'animated' : 'static'}`;
        
        // Parse SVG content using DOMParser for robustness
        if (result.svgContent && typeof result.svgContent === 'string') {
            try {
                const parser = new DOMParser();
                const svgDoc = parser.parseFromString(result.svgContent, "image/svg+xml");
                const svgElement = svgDoc.documentElement;

                // Check for parsing errors or if the root element is not <svg>
                if (svgDoc.querySelector('parsererror') || !svgElement || svgElement.tagName.toLowerCase() !== 'svg') {
                    console.warn("createSVGItem: Parsing error or not an SVG root element for ID:", result.id, svgDoc.querySelector('parsererror') ? svgDoc.querySelector('parsererror').textContent : 'N/A');
                    svgContainer.innerHTML = `<div class="eval-svg-error">Preview Error: Malformed SVG (ranking view)</div>`;
                } else {
                    // Remove scripts just in case, though svgContent should be pre-sanitized
                    const scripts = svgElement.getElementsByTagName('script');
                    while (scripts.length > 0) {
                        scripts[0].parentNode.removeChild(scripts[0]);
                    }
                    svgContainer.appendChild(svgElement.cloneNode(true));
                }
            } catch (e) {
                console.error("createSVGItem: Exception during SVG parsing for ID:", result.id, e);
                svgContainer.innerHTML = `<div class="eval-svg-error">Preview Error: Parsing failed (ranking view)</div>`;
            }
        } else {
            console.warn("createSVGItem: svgContent is missing or not a string for ID:", result.id);
            svgContainer.innerHTML = `<div class="eval-svg-error">Preview Error: No SVG content (ranking view)</div>`;
        }
        
        svgItem.appendChild(svgContainer);

        // Add details if not hidden
        if (!hideDetails) {
            const svgInfo = document.createElement('div');
            svgInfo.className = 'svg-info';
            svgInfo.innerHTML = `
                <div><strong>${result.model}</strong></div>
                <div>${variationText}</div>
            `;
            svgItem.appendChild(svgInfo);
        }

        return svgItem;
    }
    initializeDragAndDrop() {
        const svgItems = document.querySelectorAll('.svg-item');

        svgItems.forEach(item => {
            item.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', item.dataset.id);
e.dataTransfer.effectAllowed = 'move';
                item.classList.add('dragging');
            });

            item.addEventListener('dragend', () => {
                item.classList.remove('dragging');
            });

            item.addEventListener('dragover', (e) => {
                e.preventDefault();
e.dataTransfer.dropEffect = 'move';
            });

            item.addEventListener('drop', (e) => {
                e.preventDefault();
                const draggedId = e.dataTransfer.getData('text/plain');
                const draggedElement = document.querySelector(`[data-id="${draggedId}"]`);

                if (draggedElement && draggedElement !== item && draggedElement.parentNode === item.parentNode) {
                    this.reorderItems(draggedElement, item);
                }
            });
        });
    }

    reorderItems(draggedElement, targetElement) {
        const parent = targetElement.parentNode;
        const items = Array.from(parent.children);
        const draggedIndex = items.indexOf(draggedElement);
        const targetIndex = items.indexOf(targetElement);

        if (draggedIndex < targetIndex) {
            parent.insertBefore(draggedElement, targetElement.nextSibling);
        } else {
            parent.insertBefore(draggedElement, targetElement);
        }

        // Update rankings
        this.updateRankingsFromDOM();
    }

    updateRankingsFromDOM() {
        const svgItems = document.querySelectorAll('.svg-item');
        svgItems.forEach((item, index) => {
            const rank = index + 1;
            this.rankings[item.dataset.id] = rank;

            // Update rank badge
            const badge = item.querySelector('.rank-badge');
            if (badge) badge.textContent = rank;
        });

        // Update results table after ranking update
        this.updateResultsTable();
    }

    resetRankings() {
        this.rankings = {};

        // Do NOT re-initialize API service or queue controller here.
        // this.apiService = new ApiService();
        // this.queueController = new GenerationQueueController(
        //     this.apiService,
        //     (data) => this.handleQueueUpdate(data) // Missing the second callback for updateCombinedExperimentView
        // );

        this.updateEvaluationView(); // Re-renders SVGs which will use new empty rankings
        this.updateResultsTable();   // Re-renders table which will show 'Unranked'
        if (typeof vlInfo === 'function') {
            vlInfo('Rankings Reset', 'All rankings have been reset.');
        }
    }

    updateResultsTable() {
        if (!this.currentExperiment) {
            document.getElementById('summary-stats').innerHTML = '<p>No experiment loaded.</p>';
            return;
        }

        // Update summary stats
        const stats = this.calculateSummaryStats();
        document.getElementById('summary-stats').innerHTML = `
            <p><strong>Experiment:</strong> ${this.currentExperiment.name}</p>
            <p><strong>Total SVGs:</strong> ${stats.totalSVGs}</p>
            <p><strong>Models tested:</strong> ${stats.modelsCount}</p>
            <p><strong>Variations tested:</strong> ${stats.variationsCount}</p>
            <p><strong>Completion rate:</strong> ${stats.completionRate}%</p>
        `;

        // Update results table
        const tbody = document.querySelector('#results-table tbody');
        tbody.innerHTML = '';

        const results = this.currentExperiment.results
            .map(r => ({
                ...r,
                rank: this.rankings[r.id] || 'Unranked'
            }))
            .sort((a, b) => {
                const aPrompt = a.prompt;
                const bPrompt = b.prompt;
                const promptOrder = Array.from(new Set(this.currentExperiment.results.map(r => r.prompt)))
                                       .sort((x, y) => x.localeCompare(y))

                if (aPrompt !== bPrompt) {
                    return promptOrder.indexOf(aPrompt) - promptOrder.indexOf(bPrompt);
                }

                if (a.rank === 'Unranked' && b.rank === 'Unranked') return 0;
                if (a.rank === 'Unranked') return 1;
                if (b.rank === 'Unranked') return -1;
                return a.rank - b.rank;
            });

        results.forEach(result => {
            const row = document.createElement('tr');
            const variationText = this.getVariationDisplayText(result.variation);
            const qualityScore = result.rank !== 'Unranked' ?
                Math.round((results.filter(r => r.prompt === result.prompt).length - result.rank + 1)
                             / results.filter(r => r.prompt === result.prompt).length * 100) : 'N/A';

            row.innerHTML = `
                <td>${result.rank}</td>
                <td>${result.prompt}</td>
                <td>${variationText}</td>
                <td>${result.model}</td>
                <td>${new Date(result.timestamp).toLocaleString()}</td>
                <td class="quality-score">${qualityScore}${qualityScore !== 'N/A' ? '%' : ''}</td>
            `;

            tbody.appendChild(row);
        });
    }

    updateExperimentOverview() {
        if (!this.currentExperiment) {
            document.getElementById('experiment-grid').innerHTML = '<p>No experiment loaded</p>';
            return;
        }

        // Sort results by timestamp for the grid
        const results = this.currentExperiment.results.slice().sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        // Create grid items
        const gridHTML = results.map(result => {
            const rank = this.rankings[result.id] || 'Unranked';
            const quality = rank !== 'Unranked' ?
                Math.round((results.filter(r => r.prompt === result.prompt).length - rank + 1)
                          / results.filter(r => r.prompt === result.prompt).length * 100) : 'N/A';

            return `
                <div class="experiment-item">
                    <div class="experiment-meta">
                        <strong>${result.prompt.substring(0, 50)}${result.prompt.length > 50 ? '...' : ''}</strong>
                        <div>${new Date(result.timestamp).toLocaleString()}</div>
                        <div>${result.model}</div>
                        <div>${this.getVariationDisplayText(result.variation)}</div>
                        <div>Rank: ${rank}</div>
                        <div>Quality: ${quality}%</div>
                    </div>
                    <div class="experiment-svg">
                        ${result.svgContent}
                    </div>
                </div>
            `;
        }).join('');

        document.getElementById('experiment-grid').innerHTML = gridHTML;
    }

    calculateSummaryStats() {
        const results = this.currentExperiment.results;
        const uniqueModels = new Set(results.map(r => r.model));
        const uniqueVariations = new Set(results.map(r => r.variation.type));
        const completedTasks = this.queueController.generationQueue.filter(t => t.status === 'completed').length;
        const totalTasks = this.queueController.generationQueue.length;

        return {
            totalSVGs: results.length,
            modelsCount: uniqueModels.size,
            variationsCount: uniqueVariations.size,
            completionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0
        };
    }

    exportResults() {
        if (!this.currentExperiment) {
            alert('No experiment to export');
            return;
        }

        const exportData = this.currentExperiment.results.map(result => ({
            id: result.id,
            experiment_name: this.currentExperiment.name,
            prompt: result.prompt,
            model: result.model,
            variation_type: result.variation.type,
            variation_n: result.variation.n || null,
            svg_content: result.svgContent,
            timestamp: result.timestamp,
            rank: this.rankings[result.id] || null,
            quality_score: this.rankings[result.id] ?
                Math.round((this.currentExperiment.results.filter(r => r.prompt === result.prompt).length - this.rankings[result.id] + 1)
                           / this.currentExperiment.results.filter(r => r.prompt === result.prompt).length * 100) : null
        }));

        const jsonlContent = exportData.map(item => JSON.stringify(item)).join('\n');
        const blob = new Blob([jsonlContent], { type: 'application/jsonl' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `${this.currentExperiment.name}_results.jsonl`;
        a.click();

        URL.revokeObjectURL(url);
    }

    saveExperiment() {
        if (!this.currentExperiment) {
            alert('No experiment to save');
            return;
        }

        const experimentData = {
            ...this.currentExperiment,
            rankings: this.rankings,
            queue: this.queueController.generationQueue
        };

        localStorage.setItem(`vibelab_${this.currentExperiment.name}`, JSON.stringify(experimentData));
        alert('Experiment saved successfully');
    }

    loadExperiment() {
        const experiments = this.getSavedExperiments();
        if (experiments.length === 0) {
            alert('No saved experiments found');
            return;
        }

        // Create a simple selection dialog
        const experimentNames = experiments.map(exp => exp.name);
        const selected = prompt(`Select experiment to load:\n${experimentNames.map((name, i) => `${i+1}. ${name}`).join('\n')}\n\nEnter number:`);

        const index = parseInt(selected) - 1;
        if (index >= 0 && index < experiments.length) {
            const experimentData = JSON.parse(localStorage.getItem(`vibelab_${experiments[index].name}`));
            this.currentExperiment = experimentData;
            this.rankings = experimentData.rankings || {};
            this.queueController.generationQueue = experimentData.queue || [];

            this.queueController.updateDisplay();
            this.updateEvaluationView();
            this.updateResultsTable();
            this.updateExperimentOverview();

            alert(`Loaded experiment: ${this.currentExperiment.name}`);
        }
    }

    getSavedExperiments() {
        const experiments = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith('vibelab_')) {
                try {
                    const data = JSON.parse(localStorage.getItem(key));
                    experiments.push({ name: data.name, created: data.created });
                } catch (e) {
                    console.error('Error loading experiment:', e);
                }
            }
        }
        return experiments.sort((a, b) => new Date(b.created) - new Date(a.created));
    }

    loadSavedExperiments() {
        // This could populate a dropdown or list of saved experiments
        // For now, we'll just log them
        const experiments = this.getSavedExperiments();
        console.log('Saved experiments:', experiments);
    }

    updateAnalysisMode() {
        const analysisMode = document.getElementById('analysis-mode').value;
        const statisticsPanel = document.getElementById('statistics-panel');
        const svgGrid = document.getElementById('svg-grid');

        if (analysisMode === 'statistical') {
            statisticsPanel.style.display = 'block';
            svgGrid.style.display = 'none';
            this.displayStatisticalAnalysis();
        } else {
            statisticsPanel.style.display = 'none';
            svgGrid.style.display = 'grid';
            this.updateEvaluationView();
        }
    }

    displayStatisticalAnalysis() {
        if (!this.currentExperiment || !this.currentExperiment.results.length) {
            document.getElementById('statistics-panel').innerHTML = '<p>No results available for statistical analysis.</p>';
            return;
        }

        const stats = this.calculateStrategyStatistics();
        const html = this.generateStatisticsHTML(stats);
        document.getElementById('statistics-panel').innerHTML = html;
    }

    calculateStrategyStatistics() {
        const results = this.currentExperiment.results;
        const promptFilter = document.getElementById('eval-prompt-filter').value;
        
        // Filter results by selected prompt
        let filteredResults = results;
        if (promptFilter !== 'all') {
            filteredResults = results.filter(r => r.prompt === promptFilter);
        }

        // Group results by strategy (variation type)
        const strategies = {};
        filteredResults.forEach(result => {
            const strategyKey = this.getVariationDisplayText(result.variation);
            if (!strategies[strategyKey]) {
                strategies[strategyKey] = [];
            }
            
            const rank = this.rankings[result.id];
            if (rank) {
                // Convert rank to quality score (higher is better)
                const totalItems = filteredResults.filter(r => r.prompt === result.prompt).length;
                const qualityScore = ((totalItems - rank + 1) / totalItems) * 100;
                strategies[strategyKey].push(qualityScore);
            }
        });

        // Calculate statistics for each strategy
        const strategyStats = {};
        Object.keys(strategies).forEach(strategy => {
            const scores = strategies[strategy];
            if (scores.length > 0) {
                strategyStats[strategy] = {
                    count: scores.length,
                    mean: this.calculateMean(scores),
                    median: this.calculateMedian(scores),
                    stdDev: this.calculateStdDev(scores),
                    min: Math.min(...scores),
                    max: Math.max(...scores),
                    scores: scores
                };
            }
        });

        return strategyStats;
    }

    calculateMean(values) {
        return values.reduce((sum, val) => sum + val, 0) / values.length;
    }

    calculateMedian(values) {
        const sorted = [...values].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    }

    calculateStdDev(values) {
        const mean = this.calculateMean(values);
        const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
        return Math.sqrt(variance);
    }

    calculateConfidenceInterval(values, confidence = 0.95) {
        const mean = this.calculateMean(values);
        const stdDev = this.calculateStdDev(values);
        const n = values.length;
        
        // Using t-distribution approximation
        const tValue = confidence === 0.95 ? 1.96 : 2.576; // 95% or 99%
        const marginOfError = tValue * (stdDev / Math.sqrt(n));
        
        return {
            lower: mean - marginOfError,
            upper: mean + marginOfError
        };
    }

    generateStatisticsHTML(strategyStats) {
        if (Object.keys(strategyStats).length === 0) {
            return '<p>No ranked results available for statistical analysis. Please rank some SVGs first.</p>';
        }

        let html = '<div class="statistics-container">';
        html += '<h3>Strategy Performance Analysis</h3>';
        
        // Summary table
        html += '<table class="stats-table">';
        html += '<thead><tr><th>Strategy</th><th>Count</th><th>Mean</th><th>Median</th><th>Std Dev</th><th>Range</th><th>95% CI</th></tr></thead>';
        html += '<tbody>';
        
        // Sort strategies by mean performance
        const sortedStrategies = Object.entries(strategyStats)
            .sort(([,a], [,b]) => b.mean - a.mean);
        
        sortedStrategies.forEach(([strategy, stats]) => {
            const ci = this.calculateConfidenceInterval(stats.scores);
            html += `<tr>
                <td><strong>${strategy}</strong></td>
                <td>${stats.count}</td>
                <td>${stats.mean.toFixed(1)}%</td>
                <td>${stats.median.toFixed(1)}%</td>
                <td>${stats.stdDev.toFixed(1)}</td>
                <td>${stats.min.toFixed(1)}% - ${stats.max.toFixed(1)}%</td>
                <td>${ci.lower.toFixed(1)}% - ${ci.upper.toFixed(1)}%</td>
            </tr>`;
        });
        
        html += '</tbody></table>';
        
        // Performance ranking
        html += '<div class="performance-ranking">';
        html += '<h4>Performance Ranking</h4>';
        html += '<ol>';
        sortedStrategies.forEach(([strategy, stats], index) => {
            const badge = index === 0 ? '🏆' : index === 1 ? '🥈' : index === 2 ? '🥉' : '';
            html += `<li>${badge} <strong>${strategy}</strong> - ${stats.mean.toFixed(1)}% average quality</li>`;
        });
        html += '</ol></div>';
        
        // Statistical significance notes
        html += '<div class="stats-notes">';
        html += '<h4>Notes</h4>';
        html += '<ul>';
        html += '<li>Quality scores are calculated as percentile ranks within each prompt</li>';
        html += '<li>Higher scores indicate better performance (closer to rank 1)</li>';
        html += '<li>95% Confidence Intervals show the likely range of true performance</li>';
        html += '<li>Standard deviation indicates consistency (lower = more consistent)</li>';
        html += '</ul>';
        html += '</div>';
        
        html += '</div>';
        return html;
    }

    // Template Management Methods
    async loadTemplates() {
        try {
            const data = await this.apiService.makeRequest('/prompts');

            // Check if data is an object and has the success property
            if (data && typeof data === 'object' && data.hasOwnProperty('success')) {
                if (data.success) {
                    this.templates = data.templates;
                    this.updateTemplateSelector();
                    this.loadDefaultPrompts();
                } else {
                    // Handle the case where data.success is false
                    console.error('Failed to load templates: API reported success:false.', data.error || 'Unknown error');
                    this.loadDefaultPrompts();
                }
            } else {
                // Handle the case where data is not in the expected format
                console.error('Failed to load templates: Invalid response format from API. Expected JSON object with success property.', data);
                this.loadDefaultPrompts();
            }
        } catch (error) {
            console.error('Failed to load templates: Exception during API call or processing.', error);
            this.loadDefaultPrompts();
        }
    }

    updateTemplateSelector() {
        const selector = document.getElementById('template-selector');
        if (!selector) return;
        
        selector.innerHTML = '<option value="">Select a template or create custom...</option>';
        
        this.templates.forEach(template => {
            const option = document.createElement('option');
            option.value = template.id;
            option.textContent = template.name;
            selector.appendChild(option);
        });
    }

    loadDefaultPrompts() {
        const container = document.getElementById('dynamic-prompts');
        if (!container) return;
        
        container.innerHTML = '';
        
        const defaultPrompts = this.templates.length > 0 
            ? this.templates.slice(0, 2) 
            : [
                { prompt: "SVG of a pelican riding a bicycle", animated: false },
                { prompt: "SVG of a raccoon flying a biplane", animated: false }
            ];
        
        defaultPrompts.forEach((template) => {
            this.addPromptToDOM(template.prompt, template.animated);
        });
    }

    addPromptToDOM(promptText = '', animated = false) {
        const container = document.getElementById('dynamic-prompts');
        if (!container) return;
        
        const promptDiv = document.createElement('div');
        promptDiv.className = 'prompt-with-animation';
        
        promptDiv.innerHTML = `
            <input type="text" placeholder="Enter your prompt..." value="${promptText}">
            <label class="animation-flag">
                <input type="checkbox" ${animated ? 'checked' : ''}> Animated
            </label>
            <button class="remove-prompt" onclick="this.parentElement.remove()">×</button>
        `;
        
        container.appendChild(promptDiv);
    }

    loadSelectedTemplate() {
        const selector = document.getElementById('template-selector');
        const selectedId = selector.value;
        
        if (!selectedId) return;
        
        const template = this.templates.find(t => t.id === selectedId);
        if (!template) return;
        
        const container = document.getElementById('dynamic-prompts');
        container.innerHTML = '';
        
        this.addPromptToDOM(template.prompt, template.animated);
    }

    async saveCurrentAsTemplate() {
        const prompts = this.getPrompts();
        if (prompts.length === 0) {
            alert('No prompts to save as template');
            return;
        }
        
        const name = prompt('Enter template name:');
        if (!name) return;
        
        const tags = prompt('Enter tags (comma-separated):') || '';
        
        try {
            const response = await fetch('http://localhost:8081/prompts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: name,
                    prompt: prompts[0].text,
                    tags: tags.split(',').map(t => t.trim()).filter(t => t),
                    animated: prompts[0].animated
                })
            });
            
            const data = await response.json();
            if (data.success) {
                alert('Template saved successfully!');
                await this.loadTemplates();
            } else {
                alert('Failed to save template: ' + data.error);
            }
        } catch (error) {
            alert('Failed to save template: ' + error.message);
        }
    }

    showTemplateManager() {
        const modal = document.getElementById('template-modal');
        modal.style.display = 'block';
        this.refreshTemplateList();
    }

    hideTemplateManager() {
        const modal = document.getElementById('template-modal');
        modal.style.display = 'none';
    }

    refreshTemplateList() {
        const container = document.getElementById('template-list');
        if (!container) return;
        
        container.innerHTML = '';
        
        this.templates.forEach(template => {
            const item = document.createElement('div');
            item.className = 'template-item';
            
            item.innerHTML = `
                <h4>${template.name}</h4>
                <div class="template-tags">${template.tags.join(', ')}</div>
                <div class="template-prompt">${template.prompt}</div>
                <div class="template-actions">
                    <button onclick="vibelab.deleteTemplate('${template.id}')">Delete</button>
                </div>
            `;
            
            container.appendChild(item);
        });
    }

    async deleteTemplate(templateId) {
        if (!confirm('Delete this template?')) return;
        
        try {
            // Assuming makeRequest returns parsed JSON directly
            const data = await this.apiService.makeRequest(`/prompts/${templateId}`, {
                method: 'DELETE'
            });
            
            // const data = await response.json(); // Remove this line if makeRequest returns parsed JSON
            if (data.success) {
                await this.loadTemplates(); // Reload templates from server
                this.refreshTemplateList();  // Update manager UI
                if (typeof vlSuccess === 'function') vlSuccess('Template Deleted', 'Template successfully deleted.');
            } else {
                vlError('Error Deleting Template', `Failed to delete template: ${data.error || 'Unknown server error'}`);
            }
        } catch (error) {
            console.error('Failed to delete template:', error);
            vlError('Error Deleting Template', `Failed to delete template: ${error.message}`);
        }
    }

    async createNewTemplate() {
        const name = document.getElementById('new-template-name').value.trim();
        const prompt = document.getElementById('new-template-prompt').value.trim();
        const tags = document.getElementById('new-template-tags').value.trim();
        const animated = document.getElementById('new-template-animated').checked;
        
        if (!name || !prompt) {
            alert('Name and prompt are required');
            return;
        }
        
        try {
            const response = await fetch('http://localhost:8081/prompts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: name,
                    prompt: prompt,
                    tags: tags.split(',').map(t => t.trim()).filter(t => t),
                    animated: animated
                })
            });
            
            const data = await response.json();
            if (data.success) {
                document.getElementById('new-template-name').value = '';
                document.getElementById('new-template-prompt').value = '';
                document.getElementById('new-template-tags').value = '';
                document.getElementById('new-template-animated').checked = false;
                
                await this.loadTemplates();
                this.refreshTemplateList();
            } else {
                alert('Failed to create template: ' + data.error);
            }
        } catch (error) {
            alert('Failed to create template: ' + error.message);
        }
    }
}

// Initialize the application when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.vibeLab = new VibeLab(); // vibeLab is now globally accessible

    // Event listener for "Add Custom Technique" button - can stay here or be moved
    // If it needs 'this' context of VibeLab, it should be in initializeEventListeners
    const addPromptTechniqueButton = document.getElementById('add-prompt-technique');
    if (addPromptTechniqueButton) {
        addPromptTechniqueButton.addEventListener('click', () => {
            // This refers to VibeLab.addCustomTechnique() if it exists and is designed for this.
            // The current addCustomTechnique in VibeLab adds to #prompt-techniques-container
            // The global listener adds to #prompt-techniques-list
            // These might be two different features or a naming conflict.
            // For now, assuming the global listener's target is correct for its button.
            const techniquesContainer = document.getElementById('prompt-techniques-list');
            if (!techniquesContainer) {
                console.warn('#prompt-techniques-list not found for adding custom technique.');
                return;
            }
            const newTechniqueId = `custom-technique-${Date.now()}`;

            const techniqueDiv = document.createElement('div');
            techniqueDiv.classList.add('prompt-technique-item');
            techniqueDiv.innerHTML = `
                <input type="checkbox" id="${newTechniqueId}" name="prompt-techniques" value="custom" checked>
                <label for="${newTechniqueId}">
                    <input type="text" class="custom-technique-name" placeholder="Technique Name">
                </label>
                <textarea class="custom-technique-description" placeholder="Technique Description (will be shown to LLM)"></textarea>
                <button type="button" class="remove-technique-btn">Remove</button>
            `;

            techniquesContainer.appendChild(techniqueDiv);

            const newRemoveButton = techniqueDiv.querySelector('.remove-technique-btn');
            if (newRemoveButton) {
                newRemoveButton.addEventListener('click', () => {
                    techniqueDiv.remove();
                });
            }
        });
    }


    // Consortium list loading
    if (document.getElementById('consortium-list')) {
        loadAndDisplaySavedConsortiums(); // This global function is defined below
    }

    // Model selection initialization
    if (document.getElementById('available-models-list')) {
        fetchAvailableModels(); // This global function is defined below
    }
});

// Function to fetch and display saved consortiums
async function loadAndDisplaySavedConsortiums() {
    const consortiumListDiv = document.getElementById('consortium-list');
    consortiumListDiv.innerHTML = '<p>Loading saved consortiums...</p>'; // Placeholder

    try {
        const response = await ApiService.getSavedConsortiums(); // This will be a new ApiService method
        if (response && response.success && response.data) {
            if (response.data.length > 0) {
                consortiumListDiv.innerHTML = ''; // Clear placeholder
                const ul = document.createElement('ul');
                ul.classList.add('saved-consortiums-list');
                response.data.forEach(consortium => {
                    const li = document.createElement('li');
                    li.classList.add('saved-consortium-item');
                    
                    const detailsDiv = document.createElement('div');
                    detailsDiv.classList.add('consortium-details');
                    // Safely parse config JSON
                    let configDetails = 'Invalid configuration data';
                    if (typeof consortium.config === 'string') {
                        try {
                            const configObj = JSON.parse(consortium.config);
                            configDetails = JSON.stringify(configObj, null, 2);
                        } catch (e) {
                            console.error('Error parsing consortium config:', e);
                            configDetails = consortium.config; // Show raw string if parsing fails
                        }
                    } else if (typeof consortium.config === 'object') {
                         configDetails = JSON.stringify(consortium.config, null, 2);
                    }


                    detailsDiv.innerHTML = `
                        <strong>Name:</strong> ${consortium.name}<br>
                        <strong>Created At:</strong> ${new Date(consortium.created_at).toLocaleString()}<br>
                        <strong>Config:</strong> <pre>${configDetails}</pre>
                    `;
                    
                    li.appendChild(detailsDiv);
                    ul.appendChild(li);
                });
                consortiumListDiv.appendChild(ul);
            } else {
                consortiumListDiv.innerHTML = '<p>No saved consortiums found.</p>';
            }
        } else {
            consortiumListDiv.innerHTML = `<p>Error loading consortiums: ${response.message || 'Unknown error'}</p>`;
        }
    } catch (error) {
        console.error('Failed to fetch saved consortiums:', error);
        consortiumListDiv.innerHTML = `<p>Failed to load saved consortiums. Check console for details.</p>`;
        ErrorDisplay.showError('Failed to load saved consortiums.', error);
    }
}

// --- Model Selection Logic ---
let allAvailableModels = []; // To store models fetched from API
const selectedModels = new Set(); // To store selected model IDs

const modelFilterInput = document.getElementById('model-filter-input');
const availableModelsListDiv = document.getElementById('available-models-list');
const customModelNameInput = document.getElementById('custom-model-name');
const addCustomModelButton = document.getElementById('add-custom-model-button');
const selectedModelsDisplayDiv = document.getElementById('selected-models-display');

// Function to render the list of available models (with checkboxes)
function renderAvailableModels(filterText = '') {
    if (!availableModelsListDiv) return;
    availableModelsListDiv.innerHTML = '';
    const lowerFilterText = filterText.toLowerCase();
    
    allAvailableModels
        .filter(model => model.id.toLowerCase().includes(lowerFilterText) || model.name.toLowerCase().includes(lowerFilterText))
        .forEach(model => {
            const checkboxId = `model-${model.id.replace(/[^a-zA-Z0-9]/g, '-')}`; // Sanitize ID
            const li = document.createElement('label'); // Use label for better UX
            li.classList.add('model-checkbox-item');
            li.setAttribute('for', checkboxId);
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = checkboxId;
            checkbox.value = model.id;
            checkbox.checked = selectedModels.has(model.id);
            checkbox.addEventListener('change', (event) => {
                if (event.target.checked) {
                    selectedModels.add(model.id);
                } else {
                    selectedModels.delete(model.id);
                }
                renderSelectedModels();
            });
            
            li.appendChild(checkbox);
            li.appendChild(document.createTextNode(` ${model.name} (${model.id})`));
            availableModelsListDiv.appendChild(li);
        });
}

// Function to render the list of currently selected models
function renderSelectedModels() {
    if (!selectedModelsDisplayDiv) return;
    selectedModelsDisplayDiv.innerHTML = '';
    if (selectedModels.size === 0) {
        selectedModelsDisplayDiv.innerHTML = '<p>No models selected.</p>';
        return;
    }
    const ul = document.createElement('ul');
    ul.classList.add('selected-models-list');
    selectedModels.forEach(modelId => {
        const li = document.createElement('li');
        li.textContent = modelId;
        const removeBtn = document.createElement('button');
        removeBtn.textContent = 'Remove';
        removeBtn.classList.add('remove-btn-small');
        removeBtn.onclick = () => {
            selectedModels.delete(modelId);
            renderAvailableModels(modelFilterInput ? modelFilterInput.value : ''); // Re-render checkboxes to update their state
            renderSelectedModels();
        };
        li.appendChild(removeBtn);
        ul.appendChild(li);
    });
    selectedModelsDisplayDiv.appendChild(ul);
}

// Function to fetch available models from the API
async function fetchAvailableModels() {
    try {
        const response = await ApiService.getAvailableModels(); // New ApiService method
        if (response && response.success && Array.isArray(response.data)) {
            allAvailableModels = response.data;
            // Sort models by name for display
            allAvailableModels.sort((a, b) => a.name.localeCompare(b.name));
        } else {
            console.error('Failed to fetch or parse available models:', response);
            allAvailableModels = []; // Default to empty list on error
             if(availableModelsListDiv) availableModelsListDiv.innerHTML = '<p>Error loading models.</p>';
        }
    } catch (error) {
        console.error('Error in fetchAvailableModels:', error);
        allAvailableModels = [];
        if(availableModelsListDiv) availableModelsListDiv.innerHTML = '<p>Error loading models.</p>';
        ErrorDisplay.showError('Could not fetch available models.', error);
    }
    renderAvailableModels();
    renderSelectedModels(); // Initial render for selected models (likely empty)
}

// Event listener for the model filter input
if (modelFilterInput) {
    modelFilterInput.addEventListener('input', (event) => {
        renderAvailableModels(event.target.value);
    });
}

// Event listener for adding a custom model
if (addCustomModelButton) {
    addCustomModelButton.addEventListener('click', () => {
        if (customModelNameInput) {
            const customModelId = customModelNameInput.value.trim();
            if (customModelId && !allAvailableModels.find(m => m.id === customModelId)) {
                // Add to allAvailableModels so it can be "unselected" from the checkbox list if we wanted to list it there
                // For now, just add directly to selectedModels.
                // To make it appear in the "available" list temporarily or persistently would require more state management.
                // The simplest approach is to treat "custom" models as directly added to selected list.
                selectedModels.add(customModelId);
                renderSelectedModels();
                customModelNameInput.value = ''; // Clear input
            } else if (customModelId) {
                // If it exists in allAvailableModels, ensure it's selected
                selectedModels.add(customModelId);
                renderAvailableModels(modelFilterInput ? modelFilterInput.value : '');
                renderSelectedModels();
                customModelNameInput.value = '';
            }
        }
    });
}

// Initialize model selection when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Ensure this runs after other DOM content loaded listeners if they modify these containers
    if (availableModelsListDiv) { // Check if the relevant section is on the page
        fetchAvailableModels();
    }
});

// Function to get selected models (for experiment setup)
function getSelectedModels() {
    return Array.from(selectedModels);
}

// --- Combined Evaluation Tab Logic ---
// These constants are used by VibeLab methods, so they should be defined in the global scope
// or passed to VibeLab if a more encapsulated approach is desired.
// For now, keeping them global as VibeLab methods directly reference them.
const combinedStartExperimentBtn = document.getElementById('combined-start-experiment-btn');
const combinedEditExperimentBtn = document.getElementById('combined-edit-experiment-btn');
const combinedExperimentStatusSpan = document.getElementById('combined-experiment-status');

const experimentProgressCompactDiv = document.getElementById('experiment-progress-compact');
const experimentProgressFill = experimentProgressCompactDiv ? experimentProgressCompactDiv.querySelector('.progress-fill-overall') : null;
const experimentProgressText = experimentProgressCompactDiv ? experimentProgressCompactDiv.querySelector('.progress-text-overall') : null;

const toggleDetailedQueueBtn = document.getElementById('toggle-detailed-queue-btn');
const detailedQueueViewDiv = document.getElementById('detailed-queue-view');

// The event listeners that were here are now correctly placed within VibeLab.initializeEventListeners
// Remove the following incorrect, globally-scoped event listener attachments:
// if (combinedStartExperimentBtn) { ... }
// if (combinedEditExperimentBtn) { ... }
// if (toggleDetailedQueueBtn) { ... }
// The extra closing brace } that was here has been removed.
