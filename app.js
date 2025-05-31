// VibeLab - Main Application Logic


// Database Integration API
class DatabaseAPI {
    constructor(baseURL = 'http://localhost:8081') {
        this.baseURL = baseURL;
    }
    
    async createExperiment(experimentData) {
        const response = await fetch(`${this.baseURL}/api/experiments`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(experimentData)
        });
        
        if (!response.ok) throw new Error('Failed to create experiment');
        return response.json();
    }
    
    async getExperiment(experimentId) {
        const response = await fetch(`${this.baseURL}/api/experiments/${experimentId}`);
        if (!response.ok) throw new Error('Failed to get experiment');
        return response.json();
    }
    
    async listExperiments() {
        const response = await fetch(`${this.baseURL}/api/experiments`);
        if (!response.ok) throw new Error('Failed to list experiments');
        return response.json();
    }
    
    async saveRanking(rankingData) {
        const response = await fetch(`${this.baseURL}/api/rankings`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(rankingData)
        });
        
        if (!response.ok) throw new Error('Failed to save ranking');
        return response.json();
    }
    
    async registerModel(modelData) {
        const response = await fetch(`${this.baseURL}/api/models`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(modelData)
        });
        
        if (!response.ok) throw new Error('Failed to register model');
        return response.json();
    }
}

class VibeLab {
    constructor() {
        this.currentExperiment = null;
        this.generationQueue = [];
        this.isGenerating = false;
        this.results = [];
        this.rankings = {};
        this.templates = [];

        this.initializeEventListeners();
        this.loadSavedExperiments();
        this.loadTemplates();
    }

    initializeEventListeners() {
        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.dataset.tab;
                this.switchTab(tab);
            });
        });

        // Setup tab events
        document.getElementById('add-prompt').addEventListener('click', () => this.addCustomPrompt());
        document.getElementById('add-model').addEventListener('click', () => this.addCustomModel());
        document.getElementById('add-prompt').addEventListener('click', () => this.addCustomPrompt());
        document.getElementById('start-experiment').addEventListener('click', () => this.createExperiment());

        // Queue tab events
        document.getElementById('start-queue').addEventListener('click', () => this.startGeneration());
        document.getElementById('pause-queue').addEventListener('click', () => this.pauseGeneration());
        document.getElementById('clear-queue').addEventListener('click', () => this.clearQueue());

        // Evaluation tab events
        document.getElementById('eval-prompt-filter').addEventListener('change', () => this.updateEvaluationView());
        document.getElementById('eval-view-mode').addEventListener('change', () => this.updateEvaluationView());
        document.getElementById('reset-rankings').addEventListener('click', () => this.resetRankings());
        document.getElementById('hide-details').addEventListener('change', () => this.updateEvaluationView());
        document.getElementById('analysis-mode').addEventListener('change', () => this.updateAnalysisMode());

        // Results tab events
        document.getElementById('export-results').addEventListener('click', () => this.exportResults());
        document.getElementById('save-experiment').addEventListener('click', () => this.saveExperiment());
        document.getElementById('load-experiment').addEventListener('click', () => this.loadExperiment());
        // Template management events
        document.getElementById('load-template').addEventListener('click', () => this.loadSelectedTemplate());
        document.getElementById('save-as-template').addEventListener('click', () => this.saveCurrentAsTemplate());
        document.getElementById('manage-templates').addEventListener('click', () => this.showTemplateManager());
        document.getElementById('create-template').addEventListener('click', () => this.createNewTemplate());
        
        // Modal close handlers
        document.querySelector('.close').addEventListener('click', () => this.hideTemplateManager());
        document.getElementById('template-modal').addEventListener('click', (e) => {
            if (e.target.id === 'template-modal') {
                this.hideTemplateManager();
            }
        });
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
            this.updateEvaluationView();
        } else if (tabName === 'results') {
            this.updateResultsTable();
            this.updateExperimentOverview();
        }
}
    addPromptInput() {
        const container = document.querySelector('.prompt-inputs');
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

        container.insertBefore(promptDiv, document.getElementById('add-prompt'));
    }

    addCustomModel() {
        const customInput = document.getElementById('custom-model');
        const modelName = customInput.value.trim();
        if (!modelName) return;

        const modelSelection = document.querySelector('.model-selection');
        const label = document.createElement('label');
        label.innerHTML = `<input type="checkbox" value="${modelName}" checked> ${modelName}`;
        modelSelection.insertBefore(label, customInput);
        customInput.value = '';
    }

    createExperiment() {
        const prompts = this.getPrompts();
        const models = this.getSelectedModels();
        const variations = this.getPromptVariations();
        const svgsPerVar = parseInt(document.getElementById('svgs-per-var').value) || 4;
        const skipBaseline = document.getElementById('skip-baseline').checked;
        const experimentName = document.getElementById('experiment-name').value ||
                              `Experiment_${new Date().toISOString().slice(0,19).replace(/:/g,'-')}`;

        if (prompts.length === 0) {
            alert('Please enter at least one prompt');
            return;
        }

        if (models.length === 0) {
            alert('Please select at least one model');
            return;
        }

        this.currentExperiment = {
            name: experimentName,
            created: new Date().toISOString(),
            skipBaseline: skipBaseline,
            prompts,
            models,
            variations,
            svgsPerVar,
            results: []
        };

        this.generateQueue();
        this.switchTab('queue');

        document.getElementById('queue-status').textContent =
            `Experiment "${experimentName}" created with ${this.generationQueue.length} tasks`;
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
        getPromptVariations() {
            const variations = [];
        
            // Get selected variation types from UI
            const variationTypes = document.querySelectorAll('#variation-types input[type="checkbox"]:checked');
        
            variationTypes.forEach(checkbox => {
                const type = checkbox.value;
                const template = this.getVariationTemplate(type);
                variations.push({
                    type: type,
                    template: template,
                    name: checkbox.dataset.name || type
                });
            });
        
            // Always include base if no variations selected
            if (variations.length === 0) {
                variations.push({
                    type: 'base',
                    template: '{prompt}',
                    name: 'Base'
                });
            }
        
            return variations;
        }
    
        getVariationTemplate(type) {
            const templates = {
                'base': '{prompt}',
                'role_play': 'You are an expert graphic designer with 10+ years of SVG creation experience. {prompt}',
                'chain_of_thought': 'Think step-by-step about creating this SVG. First, consider the main elements, then the composition, then the styling. {prompt}',
                'expert_persona': 'As a senior SVG developer who has created award-winning graphics, approach this with professional standards: {prompt}',
                'step_by_step': 'Break this down step-by-step: 1) Identify main visual elements 2) Plan the composition 3) Choose appropriate SVG elements 4) Create clean, optimized code. {prompt}',
                'constraint_focus': 'Focus on creating clean, minimal SVG code with optimal performance. Avoid unnecessary complexity. {prompt}',
                'creative_inspiration': 'Draw inspiration from modern graphic design principles. Make it visually striking and memorable. {prompt}',
                'few_shot': 'Here are examples of excellent SVG creation:\nExample 1: Simple shapes with clean paths\nExample 2: Proper use of viewBox and scaling\nExample 3: Effective color schemes\n\nNow create: {prompt}'
            ,
            'multi_step': '{prompt}',  // Multi-step handled by conversation system};
        
            return templates[type] || '{prompt}';
        }
    
        // Enhanced getPrompts function
        getPrompts() {
            const promptInputs = document.querySelectorAll('#dynamic-prompts .prompt-input');
            const prompts = [];

            promptInputs.forEach((input) => {
                const value = input.value.trim();
                if (value.length > 0) {
                    const wrapper = input.closest('.prompt-input-wrapper');
                    const animatedCheckbox = wrapper.querySelector('.animated-checkbox');
                    prompts.push({
                        text: value,
                        animated: animatedCheckbox ? animatedCheckbox.checked : false
                    });
                }
            });

            return prompts;
        }
    EOF; sleep 2

generateQueue() {
        this.generationQueue = [];
        const { prompts, models, variations, svgsPerVar, skipBaseline } = this.currentExperiment;
        const enableMultiStep = document.getElementById('enable-multi-step')?.checked || false;
        
        prompts.forEach(prompt => {
            models.forEach(model => {
                // Generate baseline if not skipping
                if (!skipBaseline) {
                    for (let i = 0; i < svgsPerVar; i++) {
                        const queueItem = {
                            id: `${prompt.text}_${model}_base_${i}`,
                            prompt: prompt.text,
                            animated: prompt.animated,
                            model: model,
                            variation: { type: 'base', template: '{prompt}' },
                            status: 'pending',
                            progress: 0
                        };
                        
                        // Mark for multi-step if enabled
                        if (enableMultiStep) {
                            queueItem.enableMultiStep = true;
                            queueItem.maxSteps = parseInt(document.getElementById('max-conversation-steps')?.value || 3);
                        }
                        
                        this.generationQueue.push(queueItem);
                    }
                }
                
                // Generate variations
                variations.forEach(variation => {
                    for (let i = 0; i < svgsPerVar; i++) {
                        const queueItem = {
                            id: `${prompt.text}_${model}_${variation.type}_${i}`,
                            prompt: prompt.text,
                            animated: prompt.animated,
                            model: model,
                            variation: variation,
                            status: 'pending',
                            progress: 0
                        };
                        
                        // Mark for multi-step if enabled and applicable
                        if (enableMultiStep && variation.type !== 'multi_step') {
                            queueItem.enableMultiStep = true;
                            queueItem.maxSteps = parseInt(document.getElementById('max-conversation-steps')?.value || 3);
                        }
                        
                        this.generationQueue.push(queueItem);
                    }
                });
                
                // Add explicit multi-step conversation if enabled
                if (enableMultiStep) {
                    const multiStepItem = {
                        id: `${prompt.text}_${model}_multi_step_conversation`,
                        prompt: prompt.text,
                        animated: prompt.animated,
                        model: model,
                        variation: { type: 'multi_step', template: '{prompt}' },
                        status: 'pending',
                        progress: 0,
                        isMultiStep: true,
                        maxSteps: parseInt(document.getElementById('max-conversation-steps')?.value || 3)
                    };
                    this.generationQueue.push(multiStepItem);
                }
            });
        });
        
        this.updateQueueDisplay();
    }

    updateQueueDisplay() {
        const queueList = document.getElementById('queue-list');
        queueList.innerHTML = '';

        this.generationQueue.forEach(item => {
            const queueItem = document.createElement('div');
            queueItem.className = `queue-item ${item.status}`;
            
            const variationText = this.getVariationDisplayText(item.variation);
            
            queueItem.innerHTML = `
                <div class="queue-prompt">${item.prompt.substring(0, 40)}${item.prompt.length > 40 ? '...' : ''}</div>
                <div class="queue-model">${item.model}</div>
                <div class="queue-variation">${variationText}</div>
                <div class="queue-progress">
                    <div class="progress-bar-compact">
                        <div class="progress-fill-compact" style="width: ${item.progress}%"></div>
                    </div>
                </div>
                <div class="queue-status-badge">${item.status}</div>
            `;
            
            queueList.appendChild(queueItem);
        });
    }

    getVariationDisplayText(variation) {
        if (variation.type === 'baseline') return 'No few-shot';
        if (variation.type === 'real-fewvibe') return 'Real few-vibe';
        if (variation.n) return `${variation.type} (N=${variation.n})`;
        if (variation.index) return `Custom ${variation.index}`;
        return variation.type;
    }

        async startGeneration() {
        if (this.isGenerating) return;
        
        this.isGenerating = true;
        document.getElementById('start-queue').disabled = true;
        document.getElementById('pause-queue').disabled = false;
        document.getElementById('queue-status').textContent = 'Generating...';
        
        const maxParallel = parseInt(document.getElementById('max-parallel').value) || 3;
        const pendingItems = this.generationQueue.filter(item => item.status === 'pending');
        
        // Create a pool of workers for true parallel execution
        const executeWithLimit = async (items, limit) => {
            const executing = [];
            for (const item of items) {
                if (!this.isGenerating) break;
                
                const promise = this.generateSVG(item).catch(error => {
                    console.error('Generation error:', error);
                    item.status = 'error';
                    item.error = error.message;
                }).then(() => {
                    executing.splice(executing.indexOf(promise), 1);
                });
                
                executing.push(promise);
                
                if (executing.length >= limit) {
                    await Promise.race(executing);
                }
            }
            await Promise.all(executing);
        };
        
        await executeWithLimit(pendingItems, maxParallel);
        
        if (this.isGenerating) {
            this.isGenerating = false;
            document.getElementById('start-queue').disabled = false;
            document.getElementById('pause-queue').disabled = true;
            document.getElementById('queue-status').textContent = 'Generation complete';
        }
    }

        if (this.isGenerating) {
            this.isGenerating = false;
            document.getElementById('start-queue').disabled = true;
            document.getElementById('pause-queue').disabled = true;
            document.getElementById('queue-status').textContent = 'Generation complete';
            this.isGenerating = false;
            document.getElementById('start-queue').disabled = true;
            document.getElementById('pause-queue').disabled = true;
        }
    }

    async generateSVG(queueItem) {
        queueItem.status = 'running';
        queueItem.progress = 10;
        this.updateQueueDisplay();

        // Prepare the full prompt
        const fullPrompt = queueItem.variation.template.replace('{prompt}', queueItem.prompt);

        queueItem.progress = 30;
        this.updateQueueDisplay();

        // Execute llm command
        try {
            // Add experiment_id to request if available
            const requestBody = {};
            if (this.currentExperiment && this.currentExperiment.id) {
                requestBody.experiment_id = this.currentExperiment.id;
                requestBody.prompt_type = queueItem.variation.type || 'base';
            }
            
            const result = await this.executeLLMCommand(queueItem.model, fullPrompt, requestBody);
            queueItem.progress = 90;
        this.updateQueueDisplay();

            // Extract SVG from result
            const svgContent = this.extractSVG(result);
            if (svgContent) {
                queueItem.result = {
                    fullResponse: result,
                    svgContent: svgContent,
                    timestamp: new Date().toISOString()
                };
                queueItem.status = 'completed';
                queueItem.progress = 100;

                // Add to experiment results
                this.currentExperiment.results.push({
                    id: queueItem.id,
                    prompt: queueItem.prompt,
                    animated: queueItem.animated,
                    model: queueItem.model,
                    variation: queueItem.variation,
                    svgContent: svgContent,
                    timestamp: queueItem.result.timestamp,
                    rank: null // Will be set during evaluation
                });
            } else {
                throw new Error('No valid SVG found in response');
            }
        } catch (error) {
            queueItem.status = 'error';
            queueItem.error = error.message;
            queueItem.progress = 0;
            throw error;
        }
    }

    async executeLLMCommand(model, prompt) {
        // Call our Python backend that interfaces with llm CLI
        try {
            const response = await fetch("http://localhost:8081/generate", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    model: model,
                    prompt: prompt
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || "Unknown error from LLM backend");
            }

            return data.result;

        } catch (error) {
            console.error("LLM execution error:", error);
            throw new Error(`Failed to generate with ${model}: ${error.message}`);
        }
    }

    generatePlaceholderSVG(prompt) {
        // Generate a simple placeholder SVG for testing
        const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57', '#ff9ff3'];
        const color = colors[Math.floor(Math.random() * colors.length)];

        return `<svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
            <rect width="200" height="200" fill="${color}" opacity="0.3"/>
            <circle cx="100" cy="100" r="50" fill="${color}"/>
            <text x="100" y="110" text-anchor="middle" fill="white" font-size="12">
                ${prompt.substring(0, 20)}...
            </text>
        </svg>`;
    }

    extractSVG(text) {
        const svgMatch = text.match(/<svg[\s\S]*?<\/svg>/i);
        return svgMatch ? svgMatch[0] : null;
    }

    pauseGeneration() {
        this.isGenerating = false;
        document.getElementById('start-queue').disabled = false;
        document.getElementById('pause-queue').disabled = true;
        document.getElementById('queue-status').textContent = 'Paused';
        this.isGenerating = false;
        document.getElementById('start-queue').disabled = false;
        document.getElementById('pause-queue').disabled = true;
        document.getElementById('queue-status').textContent = 'Paused';
    }

    clearQueue() {
        this.generationQueue = [];
        this.updateQueueDisplay();
        document.getElementById('start-queue').disabled = true;
        document.getElementById('queue-status').textContent = 'Queue cleared';
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

        // Control SVG animation based on animated flag
        const svgContainer = `<div class="svg-container ${result.animated ? 'animated' : 'static'}">${result.svgContent}</div>`;

        if (hideDetails) {
            svgItem.innerHTML = `
                <div class="rank-badge">${rank}</div>
                ${svgContainer}
            `;
        } else {
            svgItem.innerHTML = `
                <div class="rank-badge">${rank}</div>
                ${svgContainer}
                <div class="svg-info">
                    <div><strong>${result.model}</strong></div>
                    <div>${variationText}</div>
                </div>
            `;
        }

        return svgItem;
    }

    initializeDragAndDrop() {
        const svgItems = document.querySelectorAll('.svg-item');

        svgItems.forEach(item => {
            item.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', item.dataset.id);
                item.classList.add('dragging');
            });

            item.addEventListener('dragend', () => {
                item.classList.remove('dragging');
            });

            item.addEventListener('dragover', (e) => {
                e.preventDefault();
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
        this.templates = [];
        this.updateEvaluationView();

        // Update results table after reset
        this.updateResultsTable();
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
        const completedTasks = this.generationQueue.filter(t => t.status === 'completed').length;
        const totalTasks = this.generationQueue.length;

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
            queue: this.generationQueue
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
            this.generationQueue = experimentData.queue || [];

            this.updateQueueDisplay();
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
            const response = await fetch('http://localhost:8081/prompts');
            const data = await response.json();
            
            if (data.success) {
                this.templates = data.templates;
                this.updateTemplateSelector();
                this.loadDefaultPrompts();
            }
        } catch (error) {
            console.error('Failed to load templates:', error);
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
            const response = await fetch(`http://localhost:8081/prompts/${templateId}`, {
                method: 'DELETE'
            });
            
            const data = await response.json();
            if (data.success) {
                await this.loadTemplates();
                this.refreshTemplateList();
            } else {
                alert('Failed to delete template: ' + data.error);
            }
        } catch (error) {
            alert('Failed to delete template: ' + error.message);
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
    window.vibeLab = new VibeLab();
});

// Initialize VibeLab when page loads
let vibelab;
document.addEventListener('DOMContentLoaded', () => {
    vibelab = new VibeLab();
    // Experiment Management Functions
    async loadExperiment() {
        try {
            const dbAPI = new DatabaseAPI();
            const experiments = await dbAPI.listExperiments();
            
            if (experiments.length === 0) {
                alert('No experiments found in database');
                return;
            }
            
            // Create a simple selection dialog
            const experimentList = experiments.map(exp => 
                `${exp.id}: ${exp.name} (${exp.created_at})`
            ).join('\n');
            
            const selected = prompt(`Select experiment:\n\n${experimentList}\n\nEnter experiment ID:`);
            
            if (selected) {
                const experiment = await dbAPI.getExperiment(selected);
                this.currentExperiment = {
                    id: experiment.id,
                    name: experiment.name,
                    created: experiment.created_at,
                    ...experiment.config
                };
                
                // Update UI
                document.getElementById('experiment-name').value = experiment.name;
                document.getElementById('queue-status').textContent = 
                    `Loaded experiment: ${experiment.name}`;
                
                this.updateExperimentOverview();
            }
        } catch (error) {
            alert(`Failed to load experiment: ${error.message}`);
            console.error('Load experiment error:', error);
        }
    }
    
    async saveExperiment() {
        if (!this.currentExperiment) {
            alert('No active experiment to save');
            return;
        }
        
        try {
            // Save rankings to database
            const dbAPI = new DatabaseAPI();
            
            for (const result of this.currentExperiment.results) {
                if (result.rank !== null) {
                    await dbAPI.saveRanking({
                        experiment_id: this.currentExperiment.id,
                        generation_id: result.id,
                        rank: result.rank,
                        evaluator_id: 'user'
                    });
                }
            }
            
            alert('Experiment saved successfully!');
        } catch (error) {
            alert(`Failed to save experiment: ${error.message}`);
            console.error('Save experiment error:', error);
        }
    }
    
    async listStoredExperiments() {
        try {
            const dbAPI = new DatabaseAPI();
            const experiments = await dbAPI.listExperiments();
            
            const experimentGrid = document.getElementById('experiment-grid');
            experimentGrid.innerHTML = '';
            
            experiments.forEach(exp => {
                const expDiv = document.createElement('div');
                expDiv.className = 'experiment-item';
                expDiv.innerHTML = `
                    <h4>${exp.name}</h4>
                    <p>Created: ${new Date(exp.created_at).toLocaleDateString()}</p>
                    <p>Status: ${exp.status}</p>
                    <button onclick="vibelab.loadExperimentById('${exp.id}')">Load</button>
                `;
                experimentGrid.appendChild(expDiv);
            });
        } catch (error) {
            console.error('Failed to list experiments:', error);
        }
    }
    
    async loadExperimentById(experimentId) {
        try {
            const dbAPI = new DatabaseAPI();
            const experiment = await dbAPI.getExperiment(experimentId);
            
            this.currentExperiment = {
                id: experiment.id,
                name: experiment.name,
                created: experiment.created_at,
                ...experiment.config
            };
            
            // Update UI
            document.getElementById('experiment-name').value = experiment.name;
            document.getElementById('queue-status').textContent = 
                `Loaded experiment: ${experiment.name}`;
            
            this.switchTab('setup');
            this.updateExperimentOverview();
        } catch (error) {
            alert(`Failed to load experiment: ${error.message}`);
        }
    }

    addCustomPrompt() {
        const promptList = document.getElementById('dynamic-prompts');
        
        // Create wrapper for prompt input
        const promptDiv = document.createElement('div');
        promptDiv.className = 'prompt-input-wrapper';
        promptDiv.innerHTML = `
            <div class="prompt-with-controls">
                <input type="text" class="prompt-input" placeholder="Enter your prompt (e.g., 'Create an SVG of a bicycle')" />
                <div class="prompt-controls">
                    <label><input type="checkbox" class="animated-checkbox" /> Animated</label>
                    <button class="remove-prompt" onclick="this.closest('.prompt-input-wrapper').remove()">×</button>
                </div>
            </div>
        `;
        
        promptList.appendChild(promptDiv);
        
        // Focus the new input
        promptDiv.querySelector('.prompt-input').focus();
    }
    
    // Initialize with one empty prompt
    initializePrompts() {
        const dynamicPrompts = document.getElementById('dynamic-prompts');
        if (dynamicPrompts.children.length === 0) {
            this.addCustomPrompt();
        }
    }



});
