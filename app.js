// Existing VibeLab class structure ... (lines 1-750 approx from original app.js)
// We will replace methods within the VibeLab class related to template management.

function sanitizeSvgString(svgString) {
    if (!svgString || typeof svgString !== 'string') {
        console.error("Invalid input: SVG string is required.");
        return null;
    }

    try {
        const parser = new DOMParser();
        const svgDoc = parser.parseFromString(svgString, "image/svg+xml");
        const svgElement = svgDoc.documentElement;

        if (svgDoc.querySelector('parsererror') || !svgElement || svgElement.tagName.toLowerCase() !== 'svg') {
            console.warn("sanitizeSvgString: Parsing error or not an SVG root element.");
            const errorElement = svgDoc.querySelector('parsererror');
            if (errorElement) {
                console.warn("Parser error details:", errorElement.textContent);
            }
            return null; 
        }

        const scripts = svgElement.getElementsByTagName('script');
        while (scripts.length > 0) {
            scripts[0].parentNode.removeChild(scripts[0]);
        }

        const allElements = svgElement.getElementsByTagName('*');
        for (let i = 0; i < allElements.length; i++) {
            const el = allElements[i];
            const attributesToRemove = [];
            for (let j = 0; j < el.attributes.length; j++) {
                const attrName = el.attributes[j].name.toLowerCase();
                if (attrName.startsWith('on')) {
                    attributesToRemove.push(el.attributes[j].name);
                }
                if (attrName === 'href' || attrName === 'xlink:href') {
                    if (el.getAttribute(attrName)?.toLowerCase().startsWith('javascript:')) {
                        attributesToRemove.push(el.attributes[j].name);
                    }
                }
            }
            attributesToRemove.forEach(attrName => el.removeAttribute(attrName));
        }
        
        const rootAttributesToRemove = [];
         for (let j = 0; j < svgElement.attributes.length; j++) {
            const attrName = svgElement.attributes[j].name.toLowerCase();
            if (attrName.startsWith('on')) {
                rootAttributesToRemove.push(svgElement.attributes[j].name);
            }
            if (attrName === 'href' || attrName === 'xlink:href') { 
                if (svgElement.getAttribute(attrName)?.toLowerCase().startsWith('javascript:')) {
                    rootAttributesToRemove.push(svgElement.attributes[j].name);
                }
            }
        }
        rootAttributesToRemove.forEach(attrName => svgElement.removeAttribute(attrName));

        const serializer = new XMLSerializer();
        return serializer.serializeToString(svgElement);

    } catch (error) {
        console.error("sanitizeSvgString: Exception during SVG processing.", error);
        return null; 
    }
}

class VibeLab {
    constructor() {
        this.currentExperiment = null;
        this.isGenerating = false; 
        this.results = []; 
        this.rankings = {}; 
        this.templates = [];

        this.apiService = new ApiService();
        this.queueController = new GenerationQueueController(this.apiService, 
            (data) => this.handleQueueUpdate(data), 
            () => this.updateCombinedExperimentView() 
        );
        
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
        this.updateEvaluationView = this.updateEvaluationView.bind(this); 
    }

    registerModels(models) {
        console.log("VibeLab: Models registered by ExperimentSetupController (callback):", models);
    }

    handleQueueUpdate(data) {
        if (data.type === "result" && this.currentExperiment) {
            const resultData = data.data; 
            if (!this.currentExperiment.results) {
                this.currentExperiment.results = [];
            }
            const newResultEntry = {
                id: resultData.generation_id || data.itemId || `temp_id_${Date.now()}`, 
                prompt: data.originalPromptObject || { text: "Unknown prompt", animated: false }, 
                model: data.modelName || "Unknown model", 
                variation: data.variationData || { type: "unknown", name: "Unknown" }, 
                svgContent: resultData.output, 
                status: 'completed',
                timestamp: new Date().toISOString(), 
                rank: null, 
                generation_time_ms: resultData.generation_time_ms,
                conversation_id: resultData.conversation_id
            };
            this.currentExperiment.results.push(newResultEntry);
            if (this.currentExperiment.hasOwnProperty('completedJobs')) {
                this.currentExperiment.completedJobs++;
            } else {
                this.currentExperiment.completedJobs = 1; 
            }
            this.updateEvaluationView(); 
        } else if (data.type === "error" && this.currentExperiment) {
            console.error("VibeLab: Generation error from queue:", data.error, "for item:", data.itemId);
            if (this.currentExperiment.hasOwnProperty('failedJobs')) {
                this.currentExperiment.failedJobs = (this.currentExperiment.failedJobs || 0) + 1;
            }
        }
        this.updateCombinedExperimentView(); 
    }

    handleExperimentCreated(experimentDefinition) {
        this.currentExperiment = {
            id: experimentDefinition.id || `exp_${Date.now()}`, 
            name: experimentDefinition.name,
            description: experimentDefinition.description,
            config: experimentDefinition.config || {}, 
            prompts: experimentDefinition.prompts, 
            models: experimentDefinition.models,   
            variations: experimentDefinition.variations, 
            svgsPerVar: experimentDefinition.svgsPerVar || 1,
            skipBaseline: experimentDefinition.skipBaseline || false,
            created: new Date().toISOString(),
            results: [], 
            rankings: {}, 
            status: 'idle', 
            totalJobs: 0, 
            completedJobs: 0,
            failedJobs: 0
        };
        this.queueController.setupExperimentQueue(this.currentExperiment);
        this.currentExperiment.totalJobs = this.queueController.generationQueue.length;
        this.switchTab('evaluate'); 
        this.updateCombinedExperimentView(); 
        this.updateEvaluationView(); 
    }

    handleExperimentValidationError(error) {
        const errorMessage = typeof error === "string" ? error : error.message || "Experiment validation failed";
        if (typeof vlError === 'function') { 
            vlError("Validation Error", errorMessage);
        } else {
            alert(`Validation Error: ${errorMessage}`);
        }
        console.error("Experiment validation error:", error);
    }

    handleExperimentStateChanged(state) {
        console.log("Experiment setup state changed (callback in VibeLab):", state);
    }

    updateCombinedExperimentView() {
        const evalGrid = document.getElementById('svg-grid'); 
        if (!this.currentExperiment) {
            if(combinedStartExperimentBtn) combinedStartExperimentBtn.textContent = 'Start Experiment';
            if(combinedStartExperimentBtn) combinedStartExperimentBtn.disabled = true;
            if(combinedEditExperimentBtn) combinedEditExperimentBtn.disabled = true;
            if(combinedExperimentStatusSpan) combinedExperimentStatusSpan.textContent = 'Status: No Experiment Loaded';
            if(experimentProgressFill) experimentProgressFill.style.width = '0%';
            if(experimentProgressText) experimentProgressText.textContent = '0/0 (0%)';
            if(detailedQueueViewDiv) detailedQueueViewDiv.innerHTML = '<p>No experiment loaded.</p>';
            if(evalGrid) evalGrid.innerHTML = '<p>Generated images for evaluation will appear here. Set up or load an experiment.</p>';
            return;
        }
        const isQueueGenerating = this.queueController ? this.queueController.isGenerating : false;
        const queueLength = this.queueController ? this.queueController.generationQueue.length : 0;
        const pendingJobs = this.queueController ? this.queueController.getPendingJobCount() : 0;
        if (this.queueController && this.queueController.initialJobCount > 0) {
            this.currentExperiment.totalJobs = this.queueController.initialJobCount;
        }
        if(combinedStartExperimentBtn) {
            combinedStartExperimentBtn.disabled = (pendingJobs === 0 && !isQueueGenerating);
            combinedStartExperimentBtn.textContent = isQueueGenerating ? 'Pause Experiment' : (pendingJobs > 0 ? 'Start/Resume Experiment' : 'Experiment Finished');
        }
        if(combinedEditExperimentBtn) combinedEditExperimentBtn.disabled = isQueueGenerating; 
        let statusText = `Status: ${this.currentExperiment.status || 'N/A'}`;
        if (isQueueGenerating) {
            statusText = 'Status: Running';
        } else if (pendingJobs === 0 && this.currentExperiment.completedJobs > 0) {
            statusText = 'Status: Finished';
        } else if (pendingJobs > 0) {
            statusText = 'Status: Paused/Idle';
        } else if (queueLength === 0 && this.currentExperiment.completedJobs === 0) {
            statusText = 'Status: Idle / Queue Empty (Setup needed)';
        }
        if(combinedExperimentStatusSpan) combinedExperimentStatusSpan.textContent = statusText;
        const totalActualJobs = this.currentExperiment.totalJobs || 1; 
        const progressPercent = totalActualJobs > 0 ? (this.currentExperiment.completedJobs / totalActualJobs) * 100 : 0;
        if(experimentProgressFill) experimentProgressFill.style.width = `${progressPercent.toFixed(1)}%`;
        if(experimentProgressText) experimentProgressText.textContent = `${this.currentExperiment.completedJobs}/${totalActualJobs} (${progressPercent.toFixed(1)}%)`;
        if (detailedQueueViewDiv && detailedQueueViewDiv.style.display !== 'none') {
            this.renderDetailedQueueView(); 
        }
        if (evalGrid) {
            if (this.currentExperiment.results && this.currentExperiment.results.length > 0) {
            } else if (pendingJobs === 0 && !isQueueGenerating) {
                 evalGrid.innerHTML = '<p>No SVGs generated for this experiment yet, or generation is complete with no results. Check setup or start a new experiment.</p>';
            } else {
                 evalGrid.innerHTML = '<p>Generated images for evaluation will appear here once generation starts/progresses.</p>';
            }
        }
    }

    renderDetailedQueueView() {
        if (!detailedQueueViewDiv) return;
        const queue = this.queueController ? this.queueController.generationQueue : []; 
        if (!this.currentExperiment) {
             detailedQueueViewDiv.innerHTML = '<p>No experiment loaded.</p>';
             return;
        }
        if (!queue || queue.length === 0) {
            detailedQueueViewDiv.innerHTML = '<p>Queue is empty or not initialized for the current experiment.</p>';
            return;
        }
        detailedQueueViewDiv.innerHTML = ''; 
        const displayQueue = [...queue]; 
        for (let i = displayQueue.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [displayQueue[i], displayQueue[j]] = [displayQueue[j], displayQueue[i]];
        }
        const ul = document.createElement('ul');
        ul.classList.add('detailed-queue-list');
        const itemsToShow = Math.min(displayQueue.length, 50);
        displayQueue.slice(0, itemsToShow).forEach(item => {
            const li = document.createElement('li');
            li.classList.add('detailed-queue-item', `status-${item.status || 'pending'}`); 
            const promptText = item.prompt && item.prompt.text ? item.prompt.text.substring(0, 50) + '...' : 'N/A';
            const modelName = item.model || 'N/A';
            const variationName = item.variation && item.variation.name ? item.variation.name : (item.variation_type || 'N/A');
            li.innerHTML = `
                <span class="queue-item-id">ID: ${item.id ? item.id.substring(0,8) : 'N/A'}</span>
                <span class="queue-item-status">Status: ${item.status || 'pending'}</span>
                <div class="queue-item-details">
                    Prompt: ${promptText}, Model: ${modelName}, Variation: ${variationName}
                </div>
                ${item.error ? `<div class="queue-item-error">Error: ${item.error}</div>` : ''}
            `;
            ul.appendChild(li);
        });
        detailedQueueViewDiv.appendChild(ul);
        if (displayQueue.length > itemsToShow) {
            const moreItemsP = document.createElement('p');
            moreItemsP.textContent = `... and ${displayQueue.length - itemsToShow} more items in queue.`;
            detailedQueueViewDiv.appendChild(moreItemsP);
        }
    }
    
    initializeEventListeners() {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.dataset.tab;
                this.switchTab(tab);
            });
        });
        const addPromptBtn = document.getElementById('add-prompt-btn-setup');
        if (addPromptBtn) addPromptBtn.addEventListener('click', () => this.experimentSetupController.addPromptInput());
        const addModelBtn = document.getElementById('add-model'); 
        if (addModelBtn) addModelBtn.addEventListener('click', () => this.experimentSetupController.addCustomModelStringInput()); 
        const startExperimentSetupBtn = document.getElementById('start-experiment-btn-setup'); 
        if (startExperimentSetupBtn) startExperimentSetupBtn.addEventListener('click', () => this.experimentSetupController.createExperiment());
        const evalPromptFilter = document.getElementById('eval-prompt-filter');
        if (evalPromptFilter) evalPromptFilter.addEventListener('change', () => this.updateEvaluationView());
        const evalViewMode = document.getElementById('eval-view-mode');
        if (evalViewMode) evalViewMode.addEventListener('change', () => this.updateEvaluationView());
        const resetRankingsBtn = document.getElementById('reset-rankings');
        if (resetRankingsBtn) resetRankingsBtn.addEventListener('click', () => this.resetRankings());
        const hideDetailsCheckbox = document.getElementById('hide-details');
        if (hideDetailsCheckbox) hideDetailsCheckbox.addEventListener('change', () => this.updateEvaluationView());
        const analysisModeSelect = document.getElementById('analysis-mode');
        if (analysisModeSelect) analysisModeSelect.addEventListener('change', () => this.updateAnalysisMode());
        const exportResultsBtn = document.getElementById('export-results');
        if (exportResultsBtn) exportResultsBtn.addEventListener('click', () => this.exportResults());
        const saveExperimentBtn = document.getElementById('save-experiment');
        if (saveExperimentBtn) saveExperimentBtn.addEventListener('click', () => this.saveExperiment());
        const loadExperimentBtn = document.getElementById('load-experiment');
        if (loadExperimentBtn) loadExperimentBtn.addEventListener('click', () => this.loadExperiment());
        const loadTemplateBtn = document.getElementById('load-template-btn'); 
        if (loadTemplateBtn) loadTemplateBtn.addEventListener('click', () => this.loadSelectedTemplateToSetup());
        const saveAsTemplateBtn = document.getElementById('save-setup-as-template-btn'); 
        if (saveAsTemplateBtn) saveAsTemplateBtn.addEventListener('click', () => this.saveSetupAsTemplate());
        const manageTemplatesBtn = document.getElementById('manage-templates-btn'); 
        if (manageTemplatesBtn) manageTemplatesBtn.addEventListener('click', () => this.showTemplateManager());
        const createTemplateModalBtn = document.getElementById('create-template-modal-btn'); 
        if (createTemplateModalBtn) createTemplateModalBtn.addEventListener('click', () => this.createNewTemplateFromModal());
        const closeModalButton = document.querySelector('#template-modal .close-modal-btn'); 
        if (closeModalButton) closeModalButton.addEventListener('click', () => this.hideTemplateManager());
        const templateModal = document.getElementById('template-modal');
        if (templateModal) {
            templateModal.addEventListener('click', (e) => { 
                if (e.target.id === 'template-modal') {
                    this.hideTemplateManager();
                }
            });
        }
        if (combinedStartExperimentBtn) {
            combinedStartExperimentBtn.addEventListener('click', () => {
                if (!this.currentExperiment) {
                    if (typeof vlWarning === 'function') vlWarning("No Experiment", "Please set up or load an experiment first.");
                    else alert("No Experiment Loaded");
                    return;
                }
                if (this.queueController) {
                    if (this.queueController.isGenerating) {
                        this.queueController.pauseGeneration();
                    } else {
                        if (this.queueController.getPendingJobCount() > 0) {
                            this.queueController.startGeneration();
                        } else {
                             if (typeof vlInfo === 'function') vlInfo("Queue Empty", "The generation queue is empty or finished.");
                             else alert("Queue is empty or finished.");
                        }
                    }
                    this.updateCombinedExperimentView(); 
                }
            });
        }
        if (combinedEditExperimentBtn) {
            combinedEditExperimentBtn.addEventListener('click', () => {
                if (this.currentExperiment && this.queueController && this.queueController.isGenerating) {
                     if (typeof vlWarning === 'function') vlWarning("Cannot Edit", "Pause the current experiment before editing.");
                     else alert("Pause experiment before editing.");
                    return;
                }
                if (this.currentExperiment) {
                    this.experimentSetupController.loadExperimentForEditing(this.currentExperiment);
                }
                this.switchTab('setup');
            });
        }
        if (toggleDetailedQueueBtn) {
            toggleDetailedQueueBtn.addEventListener('click', () => {
                if (detailedQueueViewDiv) {
                    const isHidden = detailedQueueViewDiv.style.display === 'none' || !detailedQueueViewDiv.style.display;
                    detailedQueueViewDiv.style.display = isHidden ? 'block' : 'none';
                    toggleDetailedQueueBtn.textContent = isHidden ? 'Hide Queue Details' : 'Show Queue Details';
                    if (isHidden && this.currentExperiment) { 
                        this.renderDetailedQueueView(); 
                    }
                }
            });
        }
    }
    
    switchTab(tabName) {
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        const activeBtn = document.querySelector(`.tab-btn[data-tab="${tabName}"]`);
        if (activeBtn) activeBtn.classList.add('active');
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        const activeContent = document.getElementById(`${tabName}-tab`);
        if (activeContent) activeContent.classList.add('active');
        if (tabName === 'evaluate') {
            this.updateCombinedExperimentView(); 
            this.updateEvaluationView(); 
        } else if (tabName === 'results') {
            this.updateResultsTable();
            this.updateExperimentOverview(); 
        } else if (tabName === 'setup') {
        }
    }
    
    updateQueueDisplay() { 
        const queueList = document.getElementById('queue-list'); 
        if (!queueList) return;
        queueList.innerHTML = '';
        const currentQueue = this.queueController ? this.queueController.generationQueue : [];
        if (!currentQueue || currentQueue.length === 0) {
            queueList.innerHTML = '<p>Queue is empty.</p>';
            return;
        }
    }
    
    updateEvaluationView() {
        const svgGrid = document.getElementById('svg-grid');
        if (!svgGrid) return;
        if (!this.currentExperiment || !this.currentExperiment.results || this.currentExperiment.results.length === 0) {
            svgGrid.innerHTML = '<p>No results to evaluate. Generate some SVGs or load an experiment with results.</p>';
            this.updatePromptFilterOptions(); 
            return;
        }
        const promptFilterValue = document.getElementById('eval-prompt-filter') ? document.getElementById('eval-prompt-filter').value : 'all';
        let filteredResults = this.currentExperiment.results;
        if (promptFilterValue !== 'all') {
            filteredResults = filteredResults.filter(r => r.prompt && r.prompt.text === promptFilterValue);
        }
        this.updatePromptFilterOptions(); 
        this.renderSVGsForRanking(filteredResults); 
    }

    updatePromptFilterOptions() {
        const select = document.getElementById('eval-prompt-filter');
        if (!select) return;
        const currentValue = select.value; 
        select.innerHTML = '<option value="all">All Prompts</option>';
        if (this.currentExperiment && this.currentExperiment.results) {
            const uniquePromptTexts = [...new Set(this.currentExperiment.results.map(r => r.prompt ? r.prompt.text : null).filter(Boolean))];
            uniquePromptTexts.forEach(promptText => {
                const option = document.createElement('option');
                option.value = promptText;
                option.textContent = promptText.length > 50 ? promptText.substring(0, 47) + '...' : promptText;
                select.appendChild(option);
            });
        }
        if (Array.from(select.options).some(opt => opt.value === currentValue)) {
            select.value = currentValue;
        } else {
            select.value = 'all';
        }
    }

    renderSVGsForRanking(resultsToRender) { 
        const svgGrid = document.getElementById('svg-grid');
        svgGrid.innerHTML = ''; 
        if (!resultsToRender || resultsToRender.length === 0) {
            svgGrid.innerHTML = '<p>No results match the current filter, or no results yet.</p>';
            return;
        }
        const experimentRankings = this.currentExperiment ? this.currentExperiment.rankings || {} : {};
        resultsToRender.sort((a, b) => {
            const rankA = experimentRankings[a.id] || 999; 
            const rankB = experimentRankings[b.id] || 999;
            return rankA - rankB;
        });
        resultsToRender.forEach((result, index) => {
            const displayRank = index + 1; 
            const svgItem = this.createSVGItem(result, displayRank); 
            svgGrid.appendChild(svgItem);
        });
        this.initializeDragAndDrop();
    }

    createSVGItem(result, displayRank) { 
        const svgItem = document.createElement('div');
        svgItem.className = 'svg-item';
        svgItem.draggable = true;
        svgItem.dataset.id = result.id; 
        const hideDetails = document.getElementById('hide-details') && document.getElementById('hide-details').checked;
        const rankBadge = document.createElement('div');
        rankBadge.className = 'rank-badge';
        rankBadge.textContent = displayRank; 
        svgItem.appendChild(rankBadge);
        const svgContainer = document.createElement('div');
        svgContainer.className = `svg-container ${result.prompt && result.prompt.animated ? 'animated' : 'static'}`;
        if (result.svgContent && typeof result.svgContent === 'string') {
            const sanitizedSvg = sanitizeSvgString(result.svgContent);
            if (sanitizedSvg) {
                svgContainer.innerHTML = sanitizedSvg; 
            } else {
                 svgContainer.innerHTML = `<div class="eval-svg-error">Preview Error: Invalid SVG content (id: ${result.id})</div>`;
            }
        } else {
            svgContainer.innerHTML = `<div class="eval-svg-error">Preview Error: No SVG content (id: ${result.id})</div>`;
        }
        svgItem.appendChild(svgContainer);
        if (!hideDetails) {
            const svgInfo = document.createElement('div');
            svgInfo.className = 'svg-info';
            const variationText = result.variation ? this.getVariationDisplayText(result.variation) : 'N/A';
            svgInfo.innerHTML = `
                <div><strong>Model:</strong> ${result.model || 'N/A'}</div>
                <div><strong>Technique:</strong> ${variationText}</div>
                <div class="svg-item-id">ID: ${result.id.substring(0,8)}...</div>
            `;
            svgItem.appendChild(svgInfo);
        }
        return svgItem;
    }
    
    getVariationDisplayText(variation) { 
        if (!variation) return 'N/A';
        if (variation.name) return variation.name;
        if (variation.type === 'baseline') return 'Baseline';
        return variation.type || 'Unknown Technique';
    }

    initializeDragAndDrop() {
        const svgItems = document.querySelectorAll('#svg-grid .svg-item'); 
        const svgGrid = document.getElementById('svg-grid');
        if (!svgGrid) return;
        svgItems.forEach(item => {
            item.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', item.dataset.id);
                e.dataTransfer.effectAllowed = 'move';
                item.classList.add('dragging');
            });
            item.addEventListener('dragend', () => {
                item.classList.remove('dragging');
            });
        });
        svgGrid.addEventListener('dragover', (e) => {
            e.preventDefault(); 
            e.dataTransfer.dropEffect = 'move';
            const draggingElement = document.querySelector('.dragging');
            if (!draggingElement) return;
            const afterElement = getDragAfterElement(svgGrid, e.clientY);
            if (afterElement == null) {
                svgGrid.appendChild(draggingElement);
            } else {
                svgGrid.insertBefore(draggingElement, afterElement);
            }
        });
        svgGrid.addEventListener('drop', (e) => { 
            e.preventDefault();
            this.updateRankingsFromDOM(); 
        });
        function getDragAfterElement(container, y) {
            const draggableElements = [...container.querySelectorAll('.svg-item:not(.dragging)')];
            return draggableElements.reduce((closest, child) => {
                const box = child.getBoundingClientRect();
                const offset = y - box.top - box.height / 2;
                if (offset < 0 && offset > closest.offset) {
                    return { offset: offset, element: child };
                } else {
                    return closest;
                }
            }, { offset: Number.NEGATIVE_INFINITY }).element;
        }
    }
    
    // MODIFIED updateRankingsFromDOM to call submitRankingsToBackend
    updateRankingsFromDOM() {
        if (!this.currentExperiment) return;
        
        const newRankings = {};
        const svgItemsInGrid = document.querySelectorAll("#svg-grid .svg-item");
        
        svgItemsInGrid.forEach((item, index) => {
            const resultId = item.dataset.id;
            if (resultId) {
                newRankings[resultId] = index + 1; // Rank is 1-based
            }
        });
        
        this.currentExperiment.rankings = newRankings; 

        svgItemsInGrid.forEach((item, index) => {
            const badge = item.querySelector(".rank-badge");
            if (badge) badge.textContent = index + 1;
        });
        
        this.updateResultsTable(); 
        if (typeof vlInfo === 'function') vlInfo("Ranking Updated", "Local ranking order updated.");

        // ADDED CALL TO SUBMIT TO BACKEND
        this.submitRankingsToBackend(); 
    }

    // NEW method to submit rankings
    async submitRankingsToBackend() {
        if (!this.currentExperiment || !this.currentExperiment.id) {
            console.warn("No current experiment or experiment ID to submit rankings for.");
            if (typeof vlWarning === 'function') vlWarning("Submit Failed", "No active experiment to save rankings to.");
            return;
        }
        if (!this.currentExperiment.rankings || Object.keys(this.currentExperiment.rankings).length === 0) {
            console.info("No rankings to submit.");
            return;
        }

        const evaluationsToSubmit = [];
        for (const generationId in this.currentExperiment.rankings) {
            evaluationsToSubmit.push({
                generation_id: generationId,
                rank: this.currentExperiment.rankings[generationId]
            });
        }

        if (evaluationsToSubmit.length === 0) {
            console.info("Formatted evaluations list is empty, nothing to submit.");
            return;
        }

        try {
            console.log(\`Submitting \${evaluationsToSubmit.length} rankings for experiment \${this.currentExperiment.id}...\`);
            const response = await this.apiService.submitEvaluations(this.currentExperiment.id, evaluationsToSubmit);
            
            if (response.errors && response.errors.length > 0) {
                if (typeof vlWarning === 'function') {
                    vlWarning("Submission Issues", \`\${response.message || 'Some rankings failed to save.'} (\${response.errors.length} errors)\`);
                }
                console.error("Errors during ranking submission:", response.errors);
                response.errors.forEach(err => {
                    if(typeof vlError === 'function') vlError(\`Save Rank Error (ID: \${err.generation_id})\`, err.error);
                });
            } else if (response.message) { 
                 if (typeof vlSuccess === 'function') vlSuccess("Rankings Saved", response.message);
            } else {
                if (typeof vlSuccess === 'function') vlSuccess("Rankings Saved", "Rankings submitted to server successfully.");
            }
            console.log("Submit evaluations response:", response);

        } catch (error) {
            console.error('Failed to submit rankings to backend:', error);
            if (typeof vlError === 'function') vlError("Submit Rankings Failed", error.message || "Could not save rankings to server.");
        }
    }

    resetRankings() {
        if (!this.currentExperiment) {
            if (typeof vlWarning === 'function') vlWarning("No Experiment", "No experiment loaded to reset rankings for.");
            return;
        }
        if (!confirm("Are you sure you want to reset rankings for the current view? This cannot be undone for the current set of displayed SVGs.")) {
            return;
        }
        this.currentExperiment.rankings = {};
        this.updateEvaluationView(); 
        this.updateResultsTable();   
        if (typeof vlInfo === 'function') vlInfo('Rankings Reset', 'All rankings for the current experiment have been reset.');
    }
    
    updateResultsTable() {
        const resultsTableBody = document.querySelector('#results-table tbody');
        const summaryStatsDiv = document.getElementById('summary-stats');
        if (!this.currentExperiment) {
            if (resultsTableBody) resultsTableBody.innerHTML = '<tr><td colspan="6">No experiment loaded.</td></tr>';
            if (summaryStatsDiv) summaryStatsDiv.innerHTML = '<p>No experiment loaded.</p>';
            return;
        }
        const stats = this.calculateSummaryStats(); 
        if (summaryStatsDiv) {
            summaryStatsDiv.innerHTML = `
                <p><strong>Experiment:</strong> ${this.currentExperiment.name || 'N/A'}</p>
                <p><strong>Total SVGs Generated:</strong> ${this.currentExperiment.results ? this.currentExperiment.results.length : 0}</p>
                <p><strong>Models Tested:</strong> ${stats.modelsCount}</p>
                <p><strong>Variations Tested:</strong> ${stats.variationsCount}</p>
                <p><strong>Overall Progress:</strong> ${this.currentExperiment.completedJobs || 0} / ${this.currentExperiment.totalJobs || 0}</p>
            `;
        }
        if (!resultsTableBody) return;
        resultsTableBody.innerHTML = '';
        if (!this.currentExperiment.results || this.currentExperiment.results.length === 0) {
            resultsTableBody.innerHTML = '<tr><td colspan="6">No results generated for this experiment yet.</td></tr>';
            return;
        }
        const experimentRankings = this.currentExperiment.rankings || {};
        const allResultsForTable = this.currentExperiment.results.map(r => ({
            ...r,
            rank: experimentRankings[r.id] || 'Unranked'
        }));
        allResultsForTable.sort((a, b) => {
            const promptA = a.prompt ? a.prompt.text : '';
            const promptB = b.prompt ? b.prompt.text : '';
            if (promptA.localeCompare(promptB) !== 0) {
                return promptA.localeCompare(promptB);
            }
            if (a.rank === 'Unranked' && b.rank === 'Unranked') return 0;
            if (a.rank === 'Unranked') return 1;
            if (b.rank === 'Unranked') return -1;
            return a.rank - b.rank;
        });
        allResultsForTable.forEach(result => {
            const row = resultsTableBody.insertRow();
            const variationText = result.variation ? this.getVariationDisplayText(result.variation) : 'N/A';
            let qualityScoreText = 'N/A';
            if (result.rank !== 'Unranked' && result.prompt && result.prompt.text) {
                const itemsInSamePromptGroup = this.currentExperiment.results.filter(
                    r => r.prompt && r.prompt.text === result.prompt.text
                );
                const totalInGroup = itemsInSamePromptGroup.length;
                if (totalInGroup > 0) {
                    const qualityScore = ((totalInGroup - parseInt(result.rank) + 1) / totalInGroup) * 100;
                    qualityScoreText = `${qualityScore.toFixed(0)}%`;
                }
            }
            row.insertCell().textContent = result.rank;
            row.insertCell().textContent = result.prompt ? result.prompt.text.substring(0,70) + (result.prompt.text.length > 70 ? '...' : '') : 'N/A';
            row.insertCell().textContent = variationText;
            row.insertCell().textContent = result.model || 'N/A';
            row.insertCell().textContent = result.timestamp ? new Date(result.timestamp).toLocaleString() : 'N/A';
            row.insertCell().textContent = qualityScoreText;
        });
    }

    updateExperimentOverview() { /* Placeholder for later */ }
    calculateSummaryStats() { 
        if (!this.currentExperiment || !this.currentExperiment.results) {
            return { totalSVGs: 0, modelsCount: 0, variationsCount: 0, completionRate: 0 };
        }
        const results = this.currentExperiment.results;
        const uniqueModels = new Set(results.map(r => r.model).filter(Boolean));
        const uniqueVariations = new Set(results.map(r => r.variation ? this.getVariationDisplayText(r.variation) : null).filter(Boolean));
        return {
            totalSVGs: results.length,
            modelsCount: uniqueModels.size,
            variationsCount: uniqueVariations.size,
        };
    }
    exportResults() { /* Placeholder for later */ }
    saveExperiment() { /* Placeholder for later, involves localStorage */ }
    loadExperiment() { /* Placeholder for later, involves localStorage */ }
    getSavedExperiments() { /* Placeholder for later, involves localStorage */ }
    loadSavedExperiments() { /* Placeholder for later, involves localStorage */ }
    updateAnalysisMode() { /* Placeholder for later */ }
    displayStatisticalAnalysis() { /* Placeholder for later */ }
    calculateStrategyStatistics() { /* Placeholder for later */ }
    calculateMean(values) { return values.reduce((s, v) => s + v, 0) / values.length || 0; }
    calculateMedian(values) { return [...values].sort((a,b)=>a-b)[Math.floor(values.length/2)] || 0; }
    calculateStdDev(values) { return 0; }
    calculateConfidenceInterval(values) { return {lower:0, upper:0};}
    generateStatisticsHTML(stats) { return ""; }

    async loadTemplates() {
        try {
            const templatesData = await this.apiService.getAllTemplates(); 
            this.templates = templatesData || []; 
            this.updateTemplateSelector(); 
            this.loadDefaultPromptsToSetup(); 
            if (document.getElementById('template-modal') && document.getElementById('template-modal').style.display === 'block') {
                this.refreshTemplateListInManager(); 
            }
        } catch (error) {
            console.error('Failed to load templates:', error);
            if (typeof vlError === 'function') vlError("Load Templates Failed", error.message || "Could not fetch templates from server.");
            this.loadDefaultPromptsToSetup(); 
        }
    }

    updateTemplateSelector() { 
        const selector = document.getElementById('template-selector-setup'); 
        if (!selector) return;
        selector.innerHTML = '<option value="">Select a template to load into setup...</option>';
        this.templates.forEach(template => {
            const option = document.createElement('option');
            option.value = template.id;
            option.textContent = template.name;
            selector.appendChild(option);
        });
    }

    loadDefaultPromptsToSetup() { 
        const defaultPromptData = this.templates.length > 0 
            ? [{ text: this.templates[0].prompt, animated: this.templates[0].animated }]
            : [{ text: "SVG of a cat in a wizard hat", animated: false }];
        this.experimentSetupController.setPrompts(defaultPromptData); 
    }
    
    loadSelectedTemplateToSetup() { 
        const selector = document.getElementById('template-selector-setup');
        if (!selector || !selector.value) return;
        const template = this.templates.find(t => t.id === selector.value);
        if (!template) return;
        this.experimentSetupController.setPrompts([{ text: template.prompt, animated: template.animated }]);
        if (typeof vlInfo === 'function') vlInfo("Template Loaded", `Template "${template.name}" loaded into setup form.`);
    }

    async saveSetupAsTemplate() { 
        const currentSetupData = this.experimentSetupController.getCurrentSetupData(); 
        if (!currentSetupData.prompts || currentSetupData.prompts.length === 0) {
            if (typeof vlWarning === 'function') vlWarning("No Prompt", "Add at least one prompt in the setup form to save as a template.");
            return;
        }
        const name = prompt('Enter a name for this new template:');
        if (!name || name.trim() === '') return;
        const mainPrompt = currentSetupData.prompts[0]; 
        const templateData = {
            name: name.trim(),
            prompt: mainPrompt.text,
            tags: currentSetupData.tags || [], 
            animated: mainPrompt.animated
        };
        try {
            const newTemplate = await this.apiService.createTemplate(templateData);
            if (typeof vlSuccess === 'function') vlSuccess('Template Saved', `Template "${newTemplate.name}" saved successfully.`);
            await this.loadTemplates(); 
        } catch (error) {
            console.error('Failed to save setup as template:', error);
            if (typeof vlError === 'function') vlError("Save Template Failed", error.message || "Could not save template.");
        }
    }

    showTemplateManager() {
        const modal = document.getElementById('template-modal');
        if (modal) modal.style.display = 'block';
        this.refreshTemplateListInManager();
    }

    hideTemplateManager() {
        const modal = document.getElementById('template-modal');
        if (modal) modal.style.display = 'none';
    }

    refreshTemplateListInManager() { 
        const container = document.getElementById('template-list-manager'); 
        if (!container) return;
        container.innerHTML = ''; 
        if (this.templates.length === 0) {
            container.innerHTML = '<p>No templates found. Create one below or they will appear here after loading.</p>';
            return;
        }
        this.templates.forEach(template => {
            const item = document.createElement('div');
            item.className = 'template-manager-item';
            item.innerHTML = `
                <h4>${template.name}</h4>
                <p class="template-manager-prompt-preview">${template.prompt.substring(0,100)}${template.prompt.length > 100 ? '...' : ''}</p>
                <div class="template-manager-tags">Tags: ${template.tags && template.tags.length > 0 ? template.tags.join(', ') : '<em>none</em>'}</div>
                <div class="template-manager-animated">Animated: ${template.animated ? 'Yes' : 'No'}</div>
                <div class="template-manager-actions">
                    <button class="button-small" onclick="window.vibeLab.loadTemplateForEditingInManager('${template.id}')">Edit</button>
                    <button class="button-small button-danger" onclick="window.vibeLab.deleteTemplateFromManager('${template.id}')">Delete</button>
                </div>
            `;
            container.appendChild(item);
        });
    }
    
    loadTemplateForEditingInManager(templateId) {
        const template = this.templates.find(t => t.id === templateId);
        if (!template) return;
        document.getElementById('edit-template-id-manager').value = template.id; 
        document.getElementById('edit-template-name-manager').value = template.name;
        document.getElementById('edit-template-prompt-manager').value = template.prompt;
        document.getElementById('edit-template-tags-manager').value = template.tags ? template.tags.join(', ') : '';
        document.getElementById('edit-template-animated-manager').checked = template.animated;
        document.getElementById('create-template-form-manager').style.display = 'none';
        document.getElementById('edit-template-form-manager').style.display = 'block';
        document.getElementById('edit-template-name-manager').focus();
    }

    async saveEditedTemplateFromManager() {
        const templateId = document.getElementById('edit-template-id-manager').value;
        const name = document.getElementById('edit-template-name-manager').value.trim();
        const prompt = document.getElementById('edit-template-prompt-manager').value.trim();
        const tags = document.getElementById('edit-template-tags-manager').value.trim().split(',').map(t => t.trim()).filter(t => t);
        const animated = document.getElementById('edit-template-animated-manager').checked;
        if (!name || !prompt) {
            if (typeof vlWarning === 'function') vlWarning("Input Required", "Name and prompt are required.");
            return;
        }
        try {
            const updatedTemplate = await this.apiService.updateTemplate(templateId, { name, prompt, tags, animated });
            if (typeof vlSuccess === 'function') vlSuccess("Template Updated", `Template "${updatedTemplate.name}" updated.`);
            await this.loadTemplates(); 
            this.resetTemplateManagerForms();
        } catch (error) {
            console.error('Failed to update template from manager:', error);
            if (typeof vlError === 'function') vlError("Update Failed", error.message || "Could not update template.");
        }
    }
    
    cancelEditTemplateManager() {
        this.resetTemplateManagerForms();
    }

    resetTemplateManagerForms() {
        document.getElementById('create-template-form-manager').style.display = 'block';
        document.getElementById('edit-template-form-manager').style.display = 'none';
        document.getElementById('new-template-name-manager').value = '';
        document.getElementById('new-template-prompt-manager').value = '';
        document.getElementById('new-template-tags-manager').value = '';
        document.getElementById('new-template-animated-manager').checked = false;
        document.getElementById('edit-template-id-manager').value = '';
        document.getElementById('edit-template-name-manager').value = '';
        document.getElementById('edit-template-prompt-manager').value = '';
        document.getElementById('edit-template-tags-manager').value = '';
        document.getElementById('edit-template-animated-manager').checked = false;
    }

    async deleteTemplateFromManager(templateId) {
        if (!confirm('Are you sure you want to permanently delete this template?')) return;
        try {
            await this.apiService.deleteTemplate(templateId); 
            if (typeof vlSuccess === 'function') vlSuccess('Template Deleted', 'Template successfully deleted.');
            await this.loadTemplates(); 
            if (document.getElementById('edit-template-id-manager').value === templateId) {
                this.resetTemplateManagerForms();
            }
        } catch (error) {
            console.error('Failed to delete template from manager:', error);
            if (typeof vlError === 'function') vlError('Delete Failed', error.message || 'Could not delete template.');
        }
    }

    async createNewTemplateFromModal() {
        const nameInput = document.getElementById('new-template-name-manager');
        const promptInput = document.getElementById('new-template-prompt-manager');
        const tagsInput = document.getElementById('new-template-tags-manager');
        const animatedCheckbox = document.getElementById('new-template-animated-manager');
        if (!nameInput || !promptInput || !tagsInput || !animatedCheckbox) {
            console.error("One or more template form elements not found in modal.");
            if(typeof vlError === 'function') vlError("Form Error", "Could not find template creation form elements.");
            return;
        }
        const name = nameInput.value.trim();
        const prompt = promptInput.value.trim();
        const tags = tagsInput.value.trim().split(',').map(t => t.trim()).filter(t => t);
        const animated = animatedCheckbox.checked;
        if (!name || !prompt) {
            if (typeof vlWarning === 'function') vlWarning("Input Required", "Name and prompt are required.");
            return;
        }
        try {
            const newTemplate = await this.apiService.createTemplate({ name, prompt, tags, animated });
            if (typeof vlSuccess === 'function') vlSuccess('Template Created', `Template "${newTemplate.name}" created successfully.`);
            nameInput.value = '';
            promptInput.value = '';
            tagsInput.value = '';
            animatedCheckbox.checked = false;
            await this.loadTemplates(); 
        } catch (error) {
            console.error('Failed to create template from modal:', error);
            if (typeof vlError === 'function') vlError('Create Failed', error.message || "Could not create template.");
        }
    }
} 

document.addEventListener('DOMContentLoaded', () => {
    window.vibeLab = new VibeLab();
    const addPromptTechniqueButton = document.getElementById('add-prompt-technique-setup'); 
    if (addPromptTechniqueButton) {
        addPromptTechniqueButton.addEventListener('click', () => {
            const techniquesListContainer = document.getElementById('prompt-techniques-list-setup'); 
            if (!techniquesListContainer) {
                console.warn('#prompt-techniques-list-setup not found for adding custom technique.');
                return;
            }
            console.log("Add custom technique button clicked - placeholder for ExperimentSetupController.addTechniqueUI()");
        });
    }
    const consortiumListDiv = document.getElementById('consortium-list'); 
    if (consortiumListDiv) {
        window.vibeLab.apiService.getSavedConsortiums() // Use instance method
            .then(data => { 
                consortiumListDiv.innerHTML = ''; 
                if (data.length > 0) {
                    const ul = document.createElement('ul');
                    ul.classList.add('saved-consortiums-list');
                    data.forEach(consortium => {
                        const li = document.createElement('li');
                        li.classList.add('saved-consortium-item');
                        let configDetails = 'Invalid configuration data';
                        try { configDetails = JSON.stringify(typeof consortium.config === 'string' ? JSON.parse(consortium.config) : consortium.config, null, 2); } catch (e) { configDetails = String(consortium.config); }
                        li.innerHTML = `<strong>Name:</strong> ${consortium.name}<br><strong>Created:</strong> ${new Date(consortium.created_at).toLocaleString()}<br><strong>Config:</strong> <pre>${configDetails}</pre>`;
                        ul.appendChild(li);
                    });
                    consortiumListDiv.appendChild(ul);
                } else {
                    consortiumListDiv.innerHTML = '<p>No saved consortiums found.</p>';
                }
            })
            .catch(error => {
                console.error('Failed to fetch saved consortiums for display:', error);
                consortiumListDiv.innerHTML = `<p>Error loading consortiums: ${error.message}</p>`;
                if(typeof vlError === 'function') vlError('Load Consortiums Failed', error.message);
            });
    }
    const availableModelsListDivGl = document.getElementById('available-models-list');
    if (availableModelsListDivGl) { 
        window.vibeLab.apiService.getAvailableModels() // Use instance method
            .then(data => { 
                window.allAvailableModelsGlobal = data.sort((a, b) => a.name.localeCompare(b.name)); 
                renderAvailableModelsGlobal(); 
            })
            .catch(error => {
                console.error('Failed to fetch available models for display:', error);
                if(availableModelsListDivGl) availableModelsListDivGl.innerHTML = `<p>Error loading models: ${error.message}</p>`;
                if(typeof vlError === 'function') vlError('Load Models Failed', error.message);
                window.allAvailableModelsGlobal = [];
            });
    }
}); 

let allAvailableModelsGlobal = []; 
const selectedModelsGlobal = new Set();

function renderAvailableModelsGlobal(filterText = '') {
    const listDiv = document.getElementById('available-models-list');
    if (!listDiv) return;
    listDiv.innerHTML = '';
    const lowerFilterText = filterText.toLowerCase();
    allAvailableModelsGlobal
        .filter(model => model.id.toLowerCase().includes(lowerFilterText) || model.name.toLowerCase().includes(lowerFilterText))
        .forEach(model => {
            const checkboxId = `global-model-${model.id.replace(/[^a-zA-Z0-9]/g, '-')}`;
            const li = document.createElement('label'); 
            li.classList.add('model-checkbox-item');
            li.htmlFor = checkboxId;
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = checkboxId;
            checkbox.value = model.id;
            checkbox.checked = selectedModelsGlobal.has(model.id);
            checkbox.addEventListener('change', (event) => {
                if (event.target.checked) {
                    selectedModelsGlobal.add(model.id);
                } else {
                    selectedModelsGlobal.delete(model.id);
                }
                renderSelectedModelsGlobal();
                if (window.vibeLab && window.vibeLab.experimentSetupController) {
                    window.vibeLab.experimentSetupController.updateSelectedModels(Array.from(selectedModelsGlobal));
                }
            });
            li.appendChild(checkbox);
            li.appendChild(document.createTextNode(` ${model.name} (${model.id})`));
            listDiv.appendChild(li);
        });
}

function renderSelectedModelsGlobal() {
    const displayDiv = document.getElementById('selected-models-display');
    if (!displayDiv) return;
    displayDiv.innerHTML = '';
    if (selectedModelsGlobal.size === 0) {
        displayDiv.innerHTML = '<p>No models selected.</p>'; return;
    }
    const ul = document.createElement('ul');
    ul.classList.add('selected-models-list');
    selectedModelsGlobal.forEach(modelId => {
        const li = document.createElement('li');
        li.textContent = modelId;
        const removeBtn = document.createElement('button');
        removeBtn.textContent = 'Remove';
        removeBtn.classList.add('remove-btn-small');
        removeBtn.onclick = () => {
            selectedModelsGlobal.delete(modelId);
            renderAvailableModelsGlobal(document.getElementById('model-filter-input') ? document.getElementById('model-filter-input').value : '');
            renderSelectedModelsGlobal();
             if (window.vibeLab && window.vibeLab.experimentSetupController) {
                window.vibeLab.experimentSetupController.updateSelectedModels(Array.from(selectedModelsGlobal));
            }
        };
        li.appendChild(removeBtn);
        ul.appendChild(li);
    });
    displayDiv.appendChild(ul);
}

document.addEventListener('DOMContentLoaded', () => {
    const modelFilterInputGl = document.getElementById('model-filter-input');
    if (modelFilterInputGl) modelFilterInputGl.addEventListener('input', (event) => renderAvailableModelsGlobal(event.target.value));
    const addCustomModelBtnGl = document.getElementById('add-custom-model-button');
    const customModelNameInputGl = document.getElementById('custom-model-name');
    if (addCustomModelBtnGl && customModelNameInputGl) {
        addCustomModelBtnGl.addEventListener('click', () => {
            const customModelId = customModelNameInputGl.value.trim();
            if (customModelId) {
                selectedModelsGlobal.add(customModelId);
                if (!allAvailableModelsGlobal.find(m => m.id === customModelId)) {
                     allAvailableModelsGlobal.push({id: customModelId, name: `${customModelId} (Custom)`});
                     renderAvailableModelsGlobal(modelFilterInputGl ? modelFilterInputGl.value : ''); 
                }
                renderSelectedModelsGlobal();
                if (window.vibeLab && window.vibeLab.experimentSetupController) {
                     window.vibeLab.experimentSetupController.updateSelectedModels(Array.from(selectedModelsGlobal));
                }
                customModelNameInputGl.value = '';
            }
        });
    }
});

const combinedStartExperimentBtn = document.getElementById('combined-start-experiment-btn');
const combinedEditExperimentBtn = document.getElementById('combined-edit-experiment-btn');
const combinedExperimentStatusSpan = document.getElementById('combined-experiment-status');
const experimentProgressCompactDiv = document.getElementById('experiment-progress-compact');
const experimentProgressFill = experimentProgressCompactDiv ? experimentProgressCompactDiv.querySelector('.progress-fill-overall') : null;
const experimentProgressText = experimentProgressCompactDiv ? experimentProgressCompactDiv.querySelector('.progress-text-overall') : null;
const toggleDetailedQueueBtn = document.getElementById('toggle-detailed-queue-btn');
const detailedQueueViewDiv = document.getElementById('detailed-queue-view');

