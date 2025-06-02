/**
 * GenerationQueueController
 * Manages the SVG generation queue and processing
 */
class GenerationQueueController {
    constructor(apiService, resultCallback, statusCallback) { // Renamed callbacks for clarity
        this.apiService = apiService;
        this.resultCallback = resultCallback; // For individual item results/errors
        this.statusCallback = statusCallback; // For overall queue status changes (running, paused, finished)
        
        this.generationQueue = [];
        this.isGenerating = false;
        this.currentExperimentId = null; // Store only ID, not whole object, to avoid staleness
        this.initialJobCount = 0;
        this.maxParallel = 4; // Default, can be overridden
    }

    setupExperimentQueue(experiment) {
        this.currentExperimentId = experiment.id;
        this.generationQueue = []; // Reset queue
        
        const { prompts, models, variations, svgsPerVar, skipBaseline } = experiment;

        if (!prompts || !models || !variations) {
            console.error("GenerationQueueController: Invalid experiment data for queue setup.", experiment);
            this.initialJobCount = 0;
            this.statusCallback(); // Update UI to reflect empty/error state
            return 0;
        }
        
        prompts.forEach(promptObj => { // promptObj is {text, animated}
            models.forEach(modelId => {
                variations.forEach(variationObj => { // variationObj is {type, name, template}
                    if (skipBaseline && variationObj.type === 'baseline') return;

                    for (let i = 0; i < (svgsPerVar || 1); i++) {
                        this.generationQueue.push({
                            id: `job_${experiment.id}_${Date.now()}_${Math.random().toString(16).slice(2)}`,
                            experiment_id: experiment.id, // Link job to experiment
                            prompt: promptObj, // Keep the {text, animated} object
                            model: modelId,
                            variation: variationObj,
                            // 'animated' flag is within promptObj, no need for separate top-level animated
                            status: 'pending', // 'pending', 'running', 'completed', 'error'
                            progress: 0,
                            result: null, // To store SVG content or full API response
                            error: null,
                            instance_num: i + 1 // For tracking multiple SVGs per variation
                        });
                    }
                });
            });
        });
        
        this.initialJobCount = this.generationQueue.length;
        this.isGenerating = false; // Reset generation status
        this.updateQueueDisplayUI(); // Update dedicated queue tab UI
        this.statusCallback(); // Notify VibeLab (app.js) for combined view update
        return this.initialJobCount;
    }

    updateQueueDisplayUI() { // Updates the dedicated "Queue" tab UI if it exists
        const queueContainer = document.getElementById('queue-list'); // Specific ID for dedicated queue list
        if (!queueContainer) return; // Silently return if dedicated queue UI isn't present

        queueContainer.innerHTML = '';
        if (this.generationQueue.length === 0) {
            queueContainer.innerHTML = '<p>Generation queue is empty.</p>';
            return;
        }

        this.generationQueue.slice(0, 100).forEach(item => { // Display a limited number
            const queueElement = document.createElement('div');
            queueElement.className = `queue-item status-${item.status}`;
            queueElement.innerHTML = `
                <div class="queue-item-header">
                    <span>Model: ${item.model}</span>
                    <span class="status">Status: ${item.status}</span>
                </div>
                <div class="queue-item-prompt">Prompt: ${item.prompt.text.substring(0, 50)}...</div>
                <div class="queue-item-variation">Variation: ${item.variation.name}</div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${item.progress}%"></div>
                </div>
                ${item.error ? `<div class="error-message">Error: ${item.error}</div>` : ''}
            `;
            queueContainer.appendChild(queueElement);
        });
        if(this.generationQueue.length > 100) {
            queueContainer.innerHTML += `<p>...and ${this.generationQueue.length - 100} more items.</p>`;
        }
    }

    async startGeneration() {
        if (this.isGenerating) {
            console.log("Generation is already in progress.");
            return;
        }
        const pendingItems = this.getPendingJobCount();
        if (pendingItems === 0) {
            console.log("Queue is empty or no pending items to start.");
            this.isGenerating = false;
            this.updateControlsUI(false);
            this.statusCallback();
            return;
        }

        this.isGenerating = true;
        this.updateControlsUI(true);
        this.statusCallback(); // Notify VibeLab that generation has started

        // Read maxParallel from UI if available, else use default
        const maxParallelInput = document.getElementById('max-parallel-setup'); // Assuming ID if it exists
        this.maxParallel = maxParallelInput ? parseInt(maxParallelInput.value) : this.maxParallel;
        if (isNaN(this.maxParallel) || this.maxParallel < 1) this.maxParallel = 1;
        
        console.log(`Starting generation with max parallel: ${this.maxParallel}`);

        const runningPromises = new Set();
        
        const tryProcessNext = () => {
            if (!this.isGenerating) return; // Stop if paused

            while (runningPromises.size < this.maxParallel) {
                const nextItem = this.generationQueue.find(item => item.status === 'pending');
                if (!nextItem) break; // No more pending items

                nextItem.status = 'scheduled'; // Mark as scheduled to avoid reprocessing by this loop iteration
                const promise = this.processSingleItem(nextItem)
                    .finally(() => {
                        runningPromises.delete(promise);
                        if (this.isGenerating) { // If not paused, try to process more
                            tryProcessNext();
                        }
                        // Check if all tasks are done after this one completes
                        if (runningPromises.size === 0 && this.getPendingJobCount() === 0 && this.isGenerating) {
                            this.isGenerating = false; // All processed items are done
                            console.log("All generation tasks completed or failed.");
                            this.updateControlsUI(false);
                            this.statusCallback(); // Notify VibeLab: Finished
                        }
                    });
                runningPromises.add(promise);
            }
            // If queue becomes empty and no promises are running, and we were generating.
            if (this.isGenerating && runningPromises.size === 0 && this.getPendingJobCount() === 0) {
                this.isGenerating = false;
                 console.log("Generation queue complete (all items processed or scheduled and finished).");
                this.updateControlsUI(false);
                this.statusCallback(); // Notify VibeLab: Finished
            }
        };
        
        tryProcessNext(); // Start processing
    }

    async processSingleItem(item) {
        item.status = 'running';
        item.progress = 10;
        this.updateQueueDisplayUI();
        this.statusCallback(); // Notify for potential UI updates on item start

        try {
            // Construct payload for ApiService.generateContent
            // Original prompt object is item.prompt = {text, animated}
            // Variation object is item.variation = {type, name, template}
            const generationRequestPayload = {
                model: item.model,
                prompt: item.variation.template.replace('{prompt}', item.prompt.text), // Apply template
                experiment_id: item.experiment_id,
                prompt_type: item.variation.type, // e.g., 'baseline', 'few_shot'
                prompt_id: null, // If using a saved template, its ID could go here
                metadata: {
                    original_prompt_text: item.prompt.text,
                    animated_flag: item.prompt.animated,
                    queue_item_id: item.id,
                    variation_name: item.variation.name,
                    variation_template_content: item.variation.template, // Store the template used
                    instance_num: item.instance_num
                }
            };

            item.progress = 30;
            this.updateQueueDisplayUI();

            const apiResponse = await this.apiService.generateContent(generationRequestPayload);
            // apiResponse is { success, output, generation_time_ms, generation_id, conversation_id, error }

            item.progress = 90;

            if (apiResponse.success && apiResponse.output) {
                const svgContent = this.extractSVG(apiResponse.output);
                if (svgContent) {
                    item.result = { // Store details for this specific job
                        svgContent: svgContent,
                        generation_id: apiResponse.generation_id, // From backend
                        timestamp: new Date().toISOString(),
                        full_llm_response: apiResponse.output, // The raw output from LLM
                        generation_time_ms: apiResponse.generation_time_ms,
                        conversation_id: apiResponse.conversation_id
                    };
                    item.status = 'completed';
                    item.progress = 100;

                    if (this.resultCallback) { // Notify VibeLab of the result
                        this.resultCallback({
                            type: 'result',
                            itemId: item.id, // To link back to queue item if needed
                            modelName: item.model, // For VibeLab.handleQueueUpdate
                            originalPromptObject: item.prompt, // For VibeLab.handleQueueUpdate
                            variationData: item.variation, // For VibeLab.handleQueueUpdate
                            data: apiResponse // Pass the whole backend response
                        });
                    }
                } else {
                    item.status = 'error';
                    item.error = 'No valid SVG found in LLM response.';
                    if (this.resultCallback) this.resultCallback({ type: 'error', itemId: item.id, error: item.error});
                }
            } else {
                item.status = 'error';
                item.error = apiResponse.error || 'Generation failed at backend.';
                 if (this.resultCallback) this.resultCallback({ type: 'error', itemId: item.id, error: item.error});
            }
        } catch (error) {
            console.error(`Error processing item ${item.id}:`, error);
            item.status = 'error';
            item.error = error.message || 'Network or unexpected error during generation.';
            if (this.resultCallback) this.resultCallback({ type: 'error', itemId: item.id, error: item.error});
        } finally {
            this.updateQueueDisplayUI();
            this.statusCallback(); // Item finished (success or error)
        }
    }
    
    extractSVG(text) { // Utility, could be static or moved
        if (typeof text !== 'string') return null;
        const svgMatch = text.match(/<svg[\s\S]*?<\/svg>/i);
        return svgMatch ? svgMatch[0] : null;
    }

    pauseGeneration() {
        if (!this.isGenerating) return;
        this.isGenerating = false;
        console.log("Generation paused by user.");
        this.updateControlsUI(false);
        this.statusCallback(); 
    }

    clearQueue() {
        if (!confirm('Are you sure you want to clear the entire generation queue? This will remove all pending and completed items.')) {
            return;
        }
        this.isGenerating = false; // Stop any ongoing processing loops
        this.generationQueue = [];
        this.initialJobCount = 0;
        this.updateQueueDisplayUI();
        this.updateControlsUI(false);
        this.statusCallback(); 
        console.log("Generation queue cleared.");
    }

    updateControlsUI(isCurrentlyGenerating) { // Updates dedicated queue tab controls
        const startBtn = document.getElementById('start-queue-btn'); // Specific ID
        const pauseBtn = document.getElementById('pause-queue-btn'); // Specific ID
        const queueStatusSpan = document.getElementById('dedicated-queue-status-text'); // Specific ID

        if (startBtn) startBtn.disabled = isCurrentlyGenerating || (this.getPendingJobCount() === 0);
        if (pauseBtn) pauseBtn.disabled = !isCurrentlyGenerating;
        
        if (queueStatusSpan) {
            if (isCurrentlyGenerating) {
                queueStatusSpan.textContent = 'Status: Generating...';
            } else if (this.getPendingJobCount() === 0 && this.generationQueue.length > 0) {
                queueStatusSpan.textContent = 'Status: All tasks processed.';
            } else if (this.generationQueue.length === 0) {
                 queueStatusSpan.textContent = 'Status: Queue empty.';
            } else {
                queueStatusSpan.textContent = 'Status: Paused / Ready.';
            }
        }
    }
    
    getPendingJobCount() {
        return this.generationQueue.filter(item => item.status === 'pending' || item.status === 'scheduled').length;
    }

    // getState and setState are useful if we want to persist queue state to localStorage via VibeLab
    getState() {
        return {
            generationQueue: this.generationQueue,
            isGenerating: this.isGenerating,
            currentExperimentId: this.currentExperimentId,
            initialJobCount: this.initialJobCount
        };
    }

    setState(state) {
        if (state) {
            this.generationQueue = state.generationQueue || [];
            this.isGenerating = state.isGenerating || false;
            this.currentExperimentId = state.currentExperimentId || null;
            this.initialJobCount = state.initialJobCount || 0;
            
            this.updateQueueDisplayUI();
            this.updateControlsUI(this.isGenerating);
            this.statusCallback();
        }
    }
}
