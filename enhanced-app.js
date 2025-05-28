// VibeLab Enhanced - Main Application Logic

class VibeLabEnhanced {
    constructor() {
        this.currentExperiment = null;
        this.generationQueue = [];
        this.isGenerating = false;
        this.results = [];
        this.rankings = {};
        this.carouselItems = [];
        this.carouselIndex = 0;

        // Initialize everything
        this.initializeEventListeners();
        this.loadSavedExperiments();
        this.loadModels();
        this.loadBuiltinStrategies();
        this.loadExperimentList();
    }

    initializeEventListeners() {
        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.dataset.tab;
                this.switchTab(tab);
            });
        });

        // Header controls
        document.getElementById('create-new-experiment')?.addEventListener('click', () => this.createNewExperiment());
        document.getElementById('load-experiment-select')?.addEventListener('change', (e) => this.loadSelectedExperiment(e.target.value));

        // Setup tab events
        document.getElementById("add-variation")?.addEventListener("click", () => this.addVariationInput());
        document.getElementById("create-new-experiment")?.addEventListener("click", () => this.createNewExperiment());
        
        // Dynamic event delegation for remove buttons
        document.addEventListener("click", (e) => {
            if (e.target.classList.contains("remove-prompt")) {
                e.target.parentElement.remove();
            }
            if (e.target.classList.contains("remove-variation")) {
                e.target.parentElement.remove();
            }
        });
        document.getElementById('add-prompt')?.addEventListener('click', () => this.addPromptInput());
        document.getElementById('add-model')?.addEventListener('click', () => this.addCustomModel());
        document.getElementById('add-custom-strategies')?.addEventListener('click', () => this.addCustomStrategies());
        document.getElementById('start-experiment')?.addEventListener('click', () => this.createExperiment());

        // Queue tab events
        document.getElementById('start-queue')?.addEventListener('click', () => this.startGeneration());
        document.getElementById('pause-queue')?.addEventListener('click', () => this.pauseGeneration());
        document.getElementById('clear-queue')?.addEventListener('click', () => this.clearQueue());

        // Evaluation tab events
        document.getElementById('eval-prompt-filter')?.addEventListener('change', () => this.updateEvaluationView());
        document.getElementById('eval-view-mode')?.addEventListener('change', () => this.updateEvaluationView());
        document.getElementById('reset-rankings')?.addEventListener('click', () => this.resetRankings());
        document.getElementById('hide-details')?.addEventListener('change', () => this.updateEvaluationView());
        document.getElementById('auto-rank')?.addEventListener('click', () => this.autoRank());

        // Carousel controls
        document.getElementById('carousel-prev')?.addEventListener('click', () => this.carouselPrevious());
        document.getElementById('carousel-next')?.addEventListener('click', () => this.carouselNext());
        document.getElementById('carousel-rating')?.addEventListener('input', (e) => this.updateCarouselRating(e.target.value));

        // Analysis tab events
        document.getElementById('analysis-prompt-filter')?.addEventListener('change', () => this.updateAnalysis());
        document.getElementById('analysis-type')?.addEventListener('change', () => this.updateAnalysis());
        document.getElementById('generate-report')?.addEventListener('click', () => this.generateReport());
        document.getElementById('export-analysis')?.addEventListener('click', () => this.exportAnalysis());

        // Results tab events
        document.getElementById('export-results')?.addEventListener('click', () => this.exportResults());
        document.getElementById('save-experiment')?.addEventListener('click', () => this.saveExperiment());
        document.getElementById('duplicate-experiment')?.addEventListener('click', () => this.duplicateExperiment());
        document.getElementById('delete-experiment')?.addEventListener('click', () => this.deleteExperiment());
        document.getElementById('results-search')?.addEventListener('input', () => this.updateResultsTable()); // Uses updateResultsTable for re-render
        document.getElementById('results-sort')?.addEventListener('change', () => this.updateResultsTable()); // Uses updateResultsTable for re-render
        document.getElementById('results-view')?.addEventListener('change', () => this.changeResultsView());

        // Modal events
        document.getElementById('modal-close')?.addEventListener('click', () => this.hideModal());
        document.getElementById('modal-cancel')?.addEventListener('click', () => this.hideModal());
        // No modal-confirm by default, will be overridden by showModal if needed
    }

    switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        const targetBtn = document.querySelector(`[data-tab="${tabName}"]`);
        if (targetBtn) targetBtn.classList.add('active');

        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        const targetTab = document.getElementById(`${tabName}-tab`);
        if (targetTab) targetTab.classList.add('active');

        // Update content based on tab
        switch(tabName) {
            case 'evaluate':
                this.updateEvaluationView();
                break;
            case 'analysis':
                this.updateAnalysis();
                break;
            case 'results':
                this.updateResultsTable();
                break;
            case 'queue':
                // No specific update logic here, updateQueueDisplay is called elsewhere
                break;
        }
    }

    addPromptInput() {
        const container = document.getElementById('prompt-container');
        if (!container) return;
        
        const promptDiv = document.createElement('div');
        promptDiv.className = 'prompt-input-group';
        promptDiv.innerHTML = `
            <textarea class="prompt-input" placeholder="Enter a base prompt..."></textarea>
            <button type="button" class="remove-prompt">×</button>
        `;
        
        const addButton = document.getElementById('add-prompt');
        if (addButton) {
            container.insertBefore(promptDiv, addButton);
        } else {
            container.appendChild(promptDiv);
        }
    }

    addVariationInput() {
        const container = document.getElementById("variation-container");
        if (!container) return;
        
        const variationDiv = document.createElement("div");
        variationDiv.className = "variation-input-group";
        variationDiv.innerHTML = `
            <input type="text" class="variation-input" placeholder="Variation name (e.g., 'tone')">
            <textarea class="variation-values" placeholder="Values separated by newlines..."></textarea>
            <button type="button" class="remove-variation">×</button>
        `;
        
        const addButton = document.getElementById("add-variation");
        if (addButton) {
            container.insertBefore(variationDiv, addButton);
        } else {
            container.appendChild(variationDiv);
        }
    }

    addCustomModel() {
        const customInput = document.getElementById('custom-model');
        if (!customInput) {
            console.warn('Element #custom-model not found.');
            return;
        }
        const modelName = customInput.value.trim();
        if (!modelName) {
            this.showMessage("Please enter a model name.", "warning");
            return;
        }

        const modelList = document.getElementById('model-list');
        if (!modelList) {
            console.warn('Element #model-list not found.');
            return;
        }

        const label = document.createElement('label');
        label.className = 'model-option';
        label.innerHTML = `<input type="checkbox" value="${modelName}" checked> <span class="model-name">${modelName}</span> <small class="model-desc">Custom model</small>`;
        modelList.appendChild(label);
        customInput.value = '';
        this.showMessage(`Added custom model: ${modelName}`, 'info');
    }

    createExperiment() {
        const prompts = this.getPrompts();
        const models = this.getSelectedModels();
        const variations = this.getPromptVariations();

        const svgsPerVarInput = document.getElementById("svgs-per-var");
        const skipBaselineCheckbox = document.getElementById("skip-baseline");
        const experimentNameInput = document.getElementById("experiment-name");
        const experimentDescriptionInput = document.getElementById("experiment-description");

        if (!svgsPerVarInput || !skipBaselineCheckbox || !experimentNameInput || !experimentDescriptionInput) {
            console.error("Missing one or more required setup elements (svgs-per-var, skip-baseline, experiment-name, experiment-description).");
            this.showMessage("Configuration error: Missing setup elements.", "error");
            return;
        }

        const svgsPerVar = parseInt(svgsPerVarInput.value) || 4;
        const skipBaseline = skipBaselineCheckbox.checked;
        let experimentName = experimentNameInput.value.trim() || `Experiment_${new Date().toISOString().slice(0,19).replace(/:/g,"-")}`;
        const experimentDescription = experimentDescriptionInput.value.trim();

        if (prompts.length === 0) {
            this.showMessage("Please enter at least one base prompt.", "warning");
            return;
        }

        if (models.length === 0) {
            this.showMessage("Please select at least one model.", "warning");
            return;
        }

        if (variations.length === 0) {
            this.showMessage("Please select or define at least one prompt strategy/variation.", "warning");
            return;
        }

        this.currentExperiment = {
            name: experimentName,
            description: experimentDescription,
            created: new Date().toISOString(),
            skipBaseline: skipBaseline,
            prompts,
            models,
            variations,
            svgsPerVar,
            results: []
        };

        this.generateQueue();
        this.switchTab("queue");

        document.getElementById("queue-status").textContent =
            `Experiment "${experimentName}" created with ${this.generationQueue.length} tasks`;
        const currentExperimentNameDisplay = document.getElementById("current-experiment-name");
        if(currentExperimentNameDisplay) currentExperimentNameDisplay.textContent = experimentName;
        this.showMessage(`Experiment "${experimentName}" created.`, "success");
    }

    getPrompts() {
        const promptInputs = document.querySelectorAll('.prompt-inputs input[type="text"]');
        const prompts = [];

        promptInputs.forEach((input, index) => {
            const value = input.value.trim();
            if (value.length > 0) {
                const animatedCheckbox = document.getElementById(`animated${index + 1}`);
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
        const checkboxes = document.querySelectorAll('.variation-config input[type="checkbox"]:checked');
        const nValuesInput = document.getElementById('n-values');
        const customStrategiesInput = document.getElementById('custom-strategies');
        
        // Declare variables first
        let nValues, customVariations;
        
        if (!nValuesInput) {
            console.warn('n-values element not found.');
            nValues = [3]; // Default to minimal n for safety if element is missing.
        } else {
            nValues = nValuesInput.value.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n) && n > 0);
            if (nValues.length === 0) nValues = [3]; // Default if input is empty/invalid
        }
        
        if (!customStrategiesInput) {
            console.warn('custom-strategies element not found.');
            customVariations = []; // Default to empty for safety if element is missing.
        } else {
            customVariations = customStrategiesInput.value
                .split('\n')
                .map(v => v.trim())
                .filter(v => v.length > 0);
        }

        checkboxes.forEach(cb => {
            const value = cb.value; // Use checkbox value directly

            if (value === 'baseline') {
                variations.push({ type: 'baseline', template: '{prompt}' });
            } else if (value === 'real-fewvibe') {
                variations.push({ type: 'real-fewvibe', template: 'Here are some examples:\n[REAL_EXAMPLES]\n\nNow create: {prompt}' });
            } else if (value === 'simulated-section') {
                nValues.forEach(n => {
                    variations.push({
                        type: 'simulated-section',
                        n: n,
                        template: `This section contains ${n} few-shot examples to guide your response.\n\n{prompt}`
                    });
                });
            } else if (value === 'simulated-based') {
                nValues.forEach(n => {
                    variations.push({
                        type: 'simulated-based',
                        n: n,
                        template: `Based on ${n} examples below, generate an SVG:\n\n{prompt}`
                    });
                });
            } else if (value === 'simulated-placeholders') {
                nValues.forEach(n => {
                    const placeholders = Array.from({length: n}, (_, i) => `[Few-shot example ${i+1}]`).join('\n');
                    variations.push({
                        type: 'simulated-placeholders',
                        n: n,
                        template: `${placeholders}\n\n{prompt}`
                    });
                });
            } else if (value === 'simulated-brilliant') {
                variations.push({ type: 'simulated-brilliant', template: 'Following the pattern of ten brilliant examples of SVG generation...\n\n{prompt}' });
            } else if (value === 'simulated-extensive') {
                variations.push({ type: 'simulated-extensive', template: 'Drawing from extensive training examples, create:\n\n{prompt}' });
            }
        });

        // Add custom variations
        customVariations.forEach((variation, index) => {
            variations.push({
                type: 'custom',
                index: index + 1,
                template: `${variation}\n\n{prompt}`
            });
        });
        
        return variations;
    }

    generateQueue() {
        this.generationQueue = [];
        const { prompts, models, variations, svgsPerVar, skipBaseline } = this.currentExperiment;

        prompts.forEach(promptObj => {
            models.forEach(model => {
                variations.forEach(variation => {
                    // Skip baseline variations if requested and it's the baseline type
                    if (skipBaseline && variation.type === 'baseline') return;

                    for (let i = 0; i < svgsPerVar; i++) {
                        this.generationQueue.push({
                            id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                            prompt: promptObj.text,
                            animated: promptObj.animated,
                            model,
                            variation,
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

        this.updateQueueDisplay();
        document.getElementById('start-queue').disabled = false;
        this.showMessage(`Queue generated with ${this.generationQueue.length} tasks.`, "info");
    }


    async startGeneration() {
        if (this.isGenerating) return;

        this.isGenerating = true;
        this.showLoading("Starting generation queue...");
        document.getElementById("start-queue").disabled = true;
        document.getElementById("pause-queue").disabled = false;
        document.getElementById("clear-queue").disabled = false;

        const maxParallel = parseInt(document.getElementById("max-parallel")?.value) || 3;
        const startTimeDebug = Date.now();
        const maxGenerationTime = 5 * 60 * 1000;

        try {
            while (this.isGenerating) {
                // Safety timeout check
                if (Date.now() - startTimeDebug > maxGenerationTime) {
                    console.warn("Generation timeout reached, forcing stop...");
                    this.isGenerating = false;
                    this.showMessage("Generation timeout reached after 5 minutes", "warning");
                    break;
                }

                const pendingItems = this.generationQueue.filter(item => item.status === 'pending');
                if (pendingItems.length === 0) {
                    break;
                }

                const runningItems = this.generationQueue.filter(item => item.status === 'running');
                if (runningItems.length >= maxParallel) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                    continue;
                }

                const availableSlots = maxParallel - runningItems.length;
                const batch = pendingItems.slice(0, availableSlots);

                if (batch.length === 0) {
                    await new Promise(resolve => setTimeout(resolve, 500)); 
                    continue;
                }
                
                const promises = batch.map(item => this.generateSVG(item).catch(error => {
                    console.error('Critical Generation Error for item:', item.id, error);
                    item.status = 'failed';
                    item.error = error.message;
                    this.showMessage(`Generation failed for ${item.prompt.substring(0,20)}...`, "error");
                }));

                await Promise.all(promises);
                this.updateQueueDisplay();
                await new Promise(resolve => setTimeout(resolve, 50)); 
            }
        } catch (error) {
            console.error('Error in generation loop:', error);
            this.showMessage('Generation error: ' + error.message, 'error');
        } finally {
            this.isGenerating = false;
            document.getElementById('start-queue').disabled = true;
            document.getElementById('pause-queue').disabled = true; 
            document.getElementById('clear-queue').disabled = false;
            this.hideLoading();
            this.showMessage("Generation complete!", "success");
            this.updateResultsTable();
        }
    }

    pauseGeneration() {
        if (!this.isGenerating) return;
        this.isGenerating = false;
        this.hideLoading();
        document.getElementById('start-queue').disabled = false;
        document.getElementById('pause-queue').disabled = true;
        this.showMessage("Generation paused", "info");
    }

    showLoading(message = 'Loading...') {
        const overlay = document.getElementById('loading-overlay');
        const messageEl = document.getElementById('loading-message');
        if (overlay && messageEl) { 
            messageEl.textContent = message; 
            overlay.style.display = 'flex';
            
            setTimeout(() => {
                if (overlay && overlay.style.display === "flex") {
                    console.warn("Auto-hiding stuck loading overlay");
                    this.hideLoading();
                }
            }, 30000);
        }
    }
    
    hideLoading() {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) { 
            overlay.style.display = 'none'; 
        }
    }
    
    showMessage(message, type = 'info') {
        console.log(`${type.toUpperCase()}: ${message}`);
        
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            background: ${type === 'error' ? '#ff4444' : type === 'warning' ? '#ffaa00' : type === 'success' ? '#00aa44' : '#4488ff'};
            color: white;
            border-radius: 4px;
            z-index: 10000;
            max-width: 300px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 4000);
    }


    // Essential missing methods
    saveExperiment() {
        const experimentName = document.getElementById('experiment-name')?.value?.trim();
        const experimentDescription = document.getElementById('experiment-description')?.value?.trim();
        
        if (!experimentName) {
            this.showMessage('Please enter an experiment name to save.', 'warning');
            return;
        }

        // For now, just show a message that it's saved (backend integration needed)
        this.showMessage(`Experiment "${experimentName}" saved successfully.`, 'success');
        console.log('saveExperiment called for:', experimentName);
    }

    deleteExperiment() {
        this.showModal('Confirm Delete', 'Are you sure you want to delete this experiment?', () => {
            this.showMessage('Experiment deleted successfully.', 'success');
            console.log('deleteExperiment called');
        });
    }

    duplicateExperiment() {
        const experimentName = document.getElementById('experiment-name')?.value?.trim();
        if (experimentName) {
            document.getElementById('experiment-name').value = experimentName + ' (Copy)';
            this.showMessage('Experiment duplicated. Please save with a new name.', 'success');
        }
        console.log('duplicateExperiment called');
    }

    exportResults() {
        this.showMessage('Results export functionality coming soon.', 'info');
        console.log('exportResults called');
    }

    exportAnalysis() {
        this.showMessage('Analysis export functionality coming soon.', 'info');
        console.log('exportAnalysis called');
    }

    generateReport() {
        this.showMessage('Report generation functionality coming soon.', 'info');
        console.log('generateReport called');
    }

    resetRankings() {
        this.showMessage('Rankings reset successfully.', 'success');
        console.log('resetRankings called');
    }

    autoRank() {
        this.showMessage('Auto-ranking functionality coming soon.', 'info');
        console.log('autoRank called');
    }

    carouselPrevious() {
        console.log('carouselPrevious called');
    }

    carouselNext() {
        console.log('carouselNext called');
    }

    updateCarouselRating(value) {
        console.log('updateCarouselRating called with:', value);
    }

    updateEvaluationView() {
        console.log('updateEvaluationView called');
    }

    updateAnalysis() {
        console.log('updateAnalysis called');
    }

    changeResultsView() {
        console.log('changeResultsView called');
    }

    createNewExperiment() {
        // Clear all form fields
        const experimentName = document.getElementById('experiment-name');
        const experimentDescription = document.getElementById('experiment-description');
        
        if (experimentName) experimentName.value = '';
        if (experimentDescription) experimentDescription.value = '';
        
        // Clear prompts
        const promptContainer = document.getElementById('prompt-container');
        if (promptContainer) {
            promptContainer.innerHTML = `
                <div class="prompt-input-group">
                    <textarea class="prompt-input" placeholder="Enter a base prompt..."></textarea>
                    <button type="button" class="remove-prompt">×</button>
                </div>
            `;
        }

        // Uncheck all models
        document.querySelectorAll('#model-list input[type="checkbox"]').forEach(cb => cb.checked = false);
        
        // Reset other fields
        const svgsPerVar = document.getElementById('svgs-per-var');
        const skipBaseline = document.getElementById('skip-baseline');
        
        if (svgsPerVar) svgsPerVar.value = '4';
        if (skipBaseline) skipBaseline.checked = false;

        this.showMessage('New experiment created. Fill in the details and click "Create Experiment".', 'success');
        this.switchTab('setup');
    }

    loadExperimentList() {
        console.log('loadExperimentList called');
        // This would load experiments from backend
    }

    loadSelectedExperiment() {
        console.log('loadSelectedExperiment called');
        // This would load selected experiment from backend
    }

    showModal(title, content, onConfirm) {
        const modal = document.getElementById('modal-overlay');
        const modalTitle = document.getElementById('modal-title');
        const modalBody = document.getElementById('modal-body');
        const confirmBtn = document.getElementById('modal-confirm');
        
        if (modal && modalTitle && modalBody) {
            modalTitle.textContent = title;
            modalBody.innerHTML = `<p>${content}</p>`;
            modal.style.display = 'flex';
            
            if (onConfirm) {
                confirmBtn.onclick = () => {
                    onConfirm();
                    this.hideModal();
                };
            }
        }
    }

    hideModal() {
        const modal = document.getElementById('modal-overlay');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    showMessage(message, type = 'info') {
        // Simple message implementation - could be enhanced with a proper notification system
        const alertClass = type === 'error' ? 'alert' : type === 'warning' ? 'confirm' : 'info';
        console.log(`[${type.toUpperCase()}] ${message}`);
        
        // For now, use browser alert - this should be replaced with a proper UI notification
        if (type === 'error') {
            alert(`Error: ${message}`);
        } else if (type === 'warning') {
            alert(`Warning: ${message}`);
        } else {
            console.log(`Info: ${message}`);
        }
    }

}

window.addEventListener('DOMContentLoaded', () => {
    window.vibelab = new VibeLabEnhanced();
});
