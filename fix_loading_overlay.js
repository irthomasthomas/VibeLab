// Patch script to fix the loading overlay issue

// Find and replace the startGeneration method to add timeout protection
function patchStartGeneration() {
    // Add timeout mechanism to prevent infinite loops
    const script = `
    async startGeneration() {
        if (this.isGenerating) return;

        this.isGenerating = true;
        this.showLoading('Starting generation queue...');
        document.getElementById('start-queue').disabled = true;
        document.getElementById('pause-queue').disabled = false;
        document.getElementById('clear-queue').disabled = false;

        const maxParallel = parseInt(document.getElementById('max-parallel')?.value) || 3;
        const startTime = Date.now();
        const maxGenerationTime = 10 * 60 * 1000; // 10 minutes timeout

        try {
            while (this.isGenerating) {
                // Safety timeout check
                if (Date.now() - startTime > maxGenerationTime) {
                    console.warn('Generation timeout reached, stopping...');
                    this.showMessage('Generation timeout reached after 10 minutes', 'warning');
                    break;
                }

                const pendingItems = this.generationQueue.filter(item => item.status === 'pending');
                if (pendingItems.length === 0) {
                    break; /* All pending tasks processed */
                }

                const runningItems = this.generationQueue.filter(item => item.status === 'running');
                if (runningItems.length >= maxParallel) {
                    await new Promise(resolve => setTimeout(resolve, 500)); /* Wait for slots to free up */
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
                    item.status = 'failed'; /* Mark as failed if an error occurs */
                    item.error = error.message;
                    this.showMessage(\`Generation failed for \${item.prompt.substring(0,20)}...\`, "error");
                }));

                await Promise.all(promises);
                this.updateQueueDisplay();
                
                // Important: Update the list of pending items after a batch to capture new states
                // Small delay to allow any remaining promises to potentially resolve and update state
                // which might affect the next iteration's pendingItems count.
                await new Promise(resolve => setTimeout(resolve, 50)); 
            }
        } catch (error) {
            console.error('Error in generation loop:', error);
            this.showMessage('Generation error: ' + error.message, 'error');
        } finally {
            /* Ensure cleanup regardless of how the loop exits */
            this.isGenerating = false;
            document.getElementById('start-queue').disabled = true;
            document.getElementById('pause-queue').disabled = true; 
            document.getElementById('clear-queue').disabled = false;
            this.hideLoading();
            this.showMessage("Generation complete!", "success");
            this.updateResultsTable(); // Final results table update
            this.switchTab(document.querySelector('.tab-nav .active')?.dataset.tab || 'queue'); // Stay on current tab or go to queue
        }
    }

    pauseGeneration() {
        if (!this.isGenerating) return;
        this.isGenerating = false;
        this.hideLoading(); // Immediately hide loading when paused
        document.getElementById('start-queue').disabled = false;
        document.getElementById('pause-queue').disabled = true;
        this.showMessage("Generation paused", "info");
    }
    `;
}

patchStartGeneration();
