/**
 * GenerationQueueController
 * Manages the SVG generation queue and processing
 */
class GenerationQueueController {
    constructor(apiService, updateCallback, onStatusUpdateCallback) { // Added onStatusUpdateCallback
        this.apiService = apiService;
        this.updateCallback = updateCallback;
        this.onStatusUpdateCallback = onStatusUpdateCallback || (() => {}); // Added this line
        this.generationQueue = [];
        this.isGenerating = false;
        this.currentExperiment = null;
    }

    // Initialize the queue with experiment data
    initializeQueue(experiment) {
        this.currentExperiment = experiment;
        this.generationQueue = [];
        
        // Build queue from experiment configuration
        experiment.prompts.forEach(prompt => {
            experiment.models.forEach(model => {
                experiment.variations.forEach(variation => {
                    const baseData = {
                        animated: experiment.techniques.includes('animation') // Assuming techniques is on experiment
                    };

                    if (variation.type === 'multi' && variation.n) {
                        for (let i = 1; i <= variation.n; i++) {
                            this.generationQueue.push({
                                id: `${Date.now()}-${Math.random()}`,
                                prompt: prompt,
                                model: model,
                                variation: { ...variation, index: i },
                                animated: baseData.animated,
                                status: 'pending',
                                progress: 0,
                                result: null
                            });
                        }
                    } else {
                        this.generationQueue.push({
                            id: `${Date.now()}-${Math.random()}`,
                            prompt: prompt,
                            model: model,
                            variation: variation,
                            animated: baseData.animated,
                            status: 'pending',
                            progress: 0,
                            result: null
                        });
                    }
                });
            });
        });
        
        this.updateDisplay();
        this.onStatusUpdateCallback(); // Added callback
        return this.generationQueue.length;
    }

    // Update the queue display
    updateDisplay() {
        const queueContainer = document.getElementById('queue-container'); // This is for old queue tab
        if (queueContainer) { // Check if old element exists
            queueContainer.innerHTML = '';
            this.generationQueue.forEach(item => {
                const queueElement = document.createElement('div');
                queueElement.className = `queue-item ${item.status}`;
                queueElement.innerHTML = `
                    <div class="queue-item-header">
                        <span class="model">${item.model}</span>
                        <span class="status">${item.status}</span>
                    </div>
                    <div class="queue-item-prompt">${item.prompt.substring(0, 50)}...</div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${item.progress}%"></div>
                    </div>
                    ${item.error ? `<div class="error-message">${item.error}</div>` : ''}
                `;
                queueContainer.appendChild(queueElement);
            });
        }


        // Update status information
        const completedTasks = this.generationQueue.filter(t => t.status === 'completed').length;
        const totalTasks = this.generationQueue.length;
        const progressText = `${completedTasks} / ${totalTasks} completed`;
        
        const progressElement = document.getElementById('generation-progress'); // Old progress element
        if (progressElement) {
            progressElement.textContent = progressText;
        }

        // Notify App of detailed job updates (original callback)
        if (this.updateCallback) {
            this.updateCallback({
                type: 'queue_update', // Differentiate from 'result'
                queue: this.generationQueue,
                isGenerating: this.isGenerating,
                progress: { completed: completedTasks, total: totalTasks }
            });
        }
        // Note: The onStatusUpdateCallback for overall status will be called by specific actions.
    }

    // Start generation process
    async startGeneration() {
        if (this.isGenerating) return;
        if (!this.generationQueue || this.generationQueue.filter(item => item.status === 'pending').length === 0) {
            console.log("Queue is empty or no pending items to start.");
            this.isGenerating = false; // Ensure state is correct
            this.updateControls(false);
            this.onStatusUpdateCallback();
            return;
        }

        this.isGenerating = true;
        this.updateControls(true);
        this.onStatusUpdateCallback(); // Added callback

        const maxParallel = parseInt(document.getElementById('max-parallel')?.value) || 8;
        // Ensure we only process items that are 'pending'.
        const getPendingItems = () => this.generationQueue.filter(item => item.status === 'pending');
        
        let runningPromises = new Set();
        
        const processItem = async (item) => {
            const promise = this.generateSVG(item).catch(error => {
                console.error('Generation error for item:', item.id, error);
                item.status = 'error';
                item.error = error.message || 'Unknown generation error';
            }).finally(() => {
                runningPromises.delete(promise);
                // this.updateDisplay(); // updateDisplay is called within generateSVG's finally
                // this.onStatusUpdateCallback(); // This is also called in generateSVG's finally
                
                // Check if more items can be processed
                if (this.isGenerating && runningPromises.size < maxParallel) {
                    const pendingItems = getPendingItems();
                    if (pendingItems.length > 0 && runningPromises.size < pendingItems.length) { // Ensure there are actual pending items not yet in runningPromises
                         // Find next item not already being processed (a bit more complex than simple index)
                        let nextItemToProcess = null;
                        for(const pendingItem of pendingItems) {
                            let isAlreadyRunning = false;
                            runningPromises.forEach(p => { // Check if this item is already in a promise
                                if (p.itemId === pendingItem.id) isAlreadyRunning = true;
                            });
                            if (!isAlreadyRunning) {
                                nextItemToProcess = pendingItem;
                                break;
                            }
                        }
                        if(nextItemToProcess) processItem(nextItemToProcess); // Process next available
                    }
                }
                
                // Check if all tasks are done
                if (runningPromises.size === 0 && getPendingItems().length === 0 && this.isGenerating) {
                    this.isGenerating = false;
                    this.updateControls(false);
                    this.onStatusUpdateCallback(); // All done
                    console.log("All generation tasks completed or failed.");
                }
            });
            promise.itemId = item.id; // Tag promise for tracking
            runningPromises.add(promise);
        };
        
        // Start initial batch from pending items
        const initialPendingItems = getPendingItems();
        for (let i = 0; i < Math.min(maxParallel, initialPendingItems.length); i++) {
            processItem(initialPendingItems[i]);
        }
        
        // If no items were started (e.g., maxParallel=0 or no pending), handle completion
        if (runningPromises.size === 0 && this.isGenerating) {
             this.isGenerating = false;
             this.updateControls(false);
             this.onStatusUpdateCallback();
             console.log("No tasks to start in generation queue.");
        }
    }

    // Generate a single SVG
    async generateSVG(queueItem) {
        if(queueItem.status !== 'pending') { // Don't re-process
            console.warn("Skipping non-pending item:", queueItem.id, queueItem.status);
            return;
        }
        queueItem.status = 'running';
        queueItem.progress = 10;
        this.updateDisplay(); // Update display for this item
        this.onStatusUpdateCallback(); // Overall status might change (e.g. first item starts)

        try {
            const enhancedPrompt = this.enhancePrompt(queueItem.prompt, queueItem.variation, queueItem.animated);
            queueItem.progress = 30;
            this.updateDisplay();
            this.onStatusUpdateCallback(); // Added callback

            const generationDataForApiService = {
                model: queueItem.model,
                prompt: enhancedPrompt,
                experiment_id: this.currentExperiment ? this.currentExperiment.id : null,
                prompt_type: queueItem.variation.type,
                metadata: {
                    original_prompt_obj: queueItem.prompt,
                    variation_obj: queueItem.variation,
                    animated_flag: queueItem.animated,
                    queue_item_id: queueItem.id,
                    experiment_name: this.currentExperiment ? (this.currentExperiment.name || null) : null
                }
            };

            const apiResponse = await this.apiService.generateContent(generationDataForApiService);

            queueItem.progress = 90;
            this.updateDisplay();
            this.onStatusUpdateCallback(); // Added callback

            let textForSVGExtraction = '';
            if (typeof apiResponse === 'string') {
                textForSVGExtraction = apiResponse;
            } else if (apiResponse && typeof apiResponse.output === 'string') {
                textForSVGExtraction = apiResponse.output;
            } else {
                console.error("Unexpected API response structure or missing output field for item:", queueItem.id, apiResponse);
                queueItem.status = 'error';
                queueItem.error = 'Unexpected API response structure or missing output field';
                // textForSVGExtraction remains '' and will likely result in 'No valid SVG' if extractSVG returns null
            }

            const svgContent = this.extractSVG(textForSVGExtraction);

            if (svgContent) {
                queueItem.result = {
                    fullResponse: apiResponse, // Store the full API response
                    svgContent: svgContent,
                    timestamp: new Date().toISOString()
                };
                queueItem.status = 'completed';
                queueItem.progress = 100;

                // Emit result for parent component to handle (original callback)
                if (this.updateCallback) {
                    this.updateCallback({
                        type: 'result', // Specific type for a single result
                        data: {
                            id: queueItem.id,
                            prompt: queueItem.prompt,
                            animated: queueItem.animated,
                            model: queueItem.model,
                            variation: queueItem.variation,
                            svgContent: svgContent,
                            timestamp: queueItem.result.timestamp,
                            rank: null,
                            status: queueItem.status // Pass status along
                        }
                    });
                }
            } else {
                // If apiResponse was invalid and textForSVGExtraction was empty, this path will also be taken.
                // If an error wasn't set before due to API response structure, set it now.
                if (queueItem.status !== 'error') {
                    queueItem.status = 'error';
                    queueItem.error = 'No valid SVG found in response';
                }
            }
        } catch (error) {
            console.error("Error during SVG generation for item:", queueItem.id, error);
            queueItem.status = 'error';
            queueItem.error = error.message || 'API call failed';
        } finally {
            this.updateDisplay(); // Update display for this item
            this.onStatusUpdateCallback(); // Overall status might change (e.g. item finished)
        }
    }

    // Enhance prompt based on variation and animation
    enhancePrompt(basePrompt, variation, animated) {
        let enhanced = basePrompt.text || basePrompt; // Assuming prompt can be object or string
        
        if (variation.type === 'detailed') {
            enhanced = `Create a highly detailed ${enhanced}. Include intricate patterns, textures, and fine details.`;
        } else if (variation.type === 'minimalist') {
            enhanced = `Create a minimalist ${enhanced}. Use simple shapes, limited colors, and clean lines.`;
        } else if (variation.type === 'multi' && variation.index) {
            enhanced = `${enhanced} (Variation ${variation.index} of ${variation.n})`;
        }
        // Example integration with prompt techniques (if 'variation' holds technique info)
        else if (variation.template) {
             enhanced = variation.template.replace('{prompt}', enhanced);
        }


        if (animated) { // Assuming animated is a boolean on the prompt or variation
            enhanced += ' Include CSS animations for subtle movement.';
        }

        return enhanced;
    }

    // Extract SVG from response
    extractSVG(text) {
        const svgMatch = text.match(/<svg[\s\S]*?<\/svg>/i);
        return svgMatch ? svgMatch[0] : null;
    }

    // Pause generation
    pauseGeneration() {
        this.isGenerating = false;
        this.updateControls(false);
        const queueStatus = document.getElementById('queue-status'); // Old element
        if (queueStatus) queueStatus.textContent = 'Paused';
        this.onStatusUpdateCallback(); // Added callback
    }

    // Clear the queue
    clearQueue() {
        const confirmClear = confirm('Are you sure you want to clear the entire queue? This will remove all pending and completed items.');
        if (confirmClear) {
            this.isGenerating = false;
            this.generationQueue = [];
            this.updateDisplay();
            this.updateControls(false);
            this.onStatusUpdateCallback(); // Added callback
        }
    }

    // Update control buttons state (for old queue tab, might need adaptation for new UI)
    updateControls(isGenerating) {
        const startBtn = document.getElementById('start-queue');
        const pauseBtn = document.getElementById('pause-queue');
        const queueStatusSpan = document.getElementById('queue-status'); // For old tab

        if (startBtn) startBtn.disabled = isGenerating;
        if (pauseBtn) pauseBtn.disabled = !isGenerating;
        
        if (queueStatusSpan) {
            if (isGenerating) {
                queueStatusSpan.textContent = 'Generating...';
            } else if (this.generationQueue.filter(item => item.status === 'pending').length === 0 && this.generationQueue.length > 0) {
                queueStatusSpan.textContent = 'Generation complete';
            } else if (this.generationQueue.length === 0) {
                 queueStatusSpan.textContent = 'No experiment loaded';
            }
             else {
                queueStatusSpan.textContent = 'Paused/Ready';
            }
        }
    }
    
    get isRunning() { // Getter for App.js to check status
        return this.isGenerating;
    }

    // Wait for all running promises to complete (original logic, might not be needed with new processItem)
    // async waitForCompletion(runningPromises) {
    //     return new Promise((resolve) => {
    //         const check = () => {
    //             if (runningPromises.size === 0 || !this.isGenerating) {
    //                 resolve();
    //             } else {
    //                 setTimeout(check, 100);
    //             }
    //         };
    //         check();
    //     });
    // }

    // Get queue state for persistence
    getState() {
        return {
            generationQueue: this.generationQueue,
            isGenerating: this.isGenerating,
            currentExperiment: this.currentExperiment
        };
    }

    // Restore queue state
    setState(state) {
        if (state.generationQueue) {
            this.generationQueue = state.generationQueue;
        }
        if (state.isGenerating !== undefined) {
            this.isGenerating = state.isGenerating;
        }
        if (state.currentExperiment) {
            this.currentExperiment = state.currentExperiment;
        }
        this.updateDisplay();
        this.updateControls(this.isGenerating); // Update controls based on restored state
        this.onStatusUpdateCallback(); // Notify of restored state
    }
}

// Make GenerationQueueController globally accessible in the browser
if (typeof window !== 'undefined') {
    window.GenerationQueueController = GenerationQueueController;
} else if (typeof module !== 'undefined' && module.exports) {
    module.exports = GenerationQueueController;
}
