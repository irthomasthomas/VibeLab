// Parallel Generation Fix for VibeLab
// Problem: Current implementation has duplicate lines and doesn't properly handle parallel execution

async startGeneration() {
    if (this.isGenerating) return;
    
    this.isGenerating = true;
    document.getElementById('start-queue').disabled = true;
    document.getElementById('pause-queue').disabled = false;
    document.getElementById('queue-status').textContent = 'Generating...';
    
    const maxParallel = parseInt(document.getElementById('max-parallel').value) || 3;
    const pendingItems = this.generationQueue.filter(item => item.status === 'pending');
    
    // Create a pool of workers
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

async generateSVG(queueItem) {
    queueItem.status = 'running';
    queueItem.progress = 10;
    this.updateQueueDisplay();
    
    const fullPrompt = queueItem.variation.template.replace('{prompt}', queueItem.prompt);
    
    queueItem.progress = 30;
    this.updateQueueDisplay();
    
    try {
        // Add experiment_id to request if available
        const requestBody = {
            model: queueItem.model,
            prompt: fullPrompt,
            experiment_id: this.currentExperiment?.id,
            prompt_type: queueItem.variation.type || 'base'
        };
        
        const result = await this.executeLLMCommand(queueItem.model, fullPrompt, requestBody);
        queueItem.progress = 90;
        this.updateQueueDisplay();
        
        const svgContent = this.extractSVG(result);
        if (svgContent) {
            queueItem.result = {
                fullResponse: result,
                svgContent: svgContent,
                timestamp: new Date().toISOString()
            };
            queueItem.status = 'completed';
            queueItem.progress = 100;
            
            // Store in experiment results
            if (this.currentExperiment) {
                this.currentExperiment.results.push({
                    id: queueItem.id,
                    prompt: queueItem.prompt,
                    animated: queueItem.animated,
                    model: queueItem.model,
                    variation: queueItem.variation,
                    svgContent: svgContent,
                    timestamp: queueItem.result.timestamp,
                    rank: null
                });
            }
        } else {
            throw new Error('No valid SVG found in response');
        }
    } catch (error) {
        queueItem.status = 'error';
        queueItem.error = error.message;
        queueItem.progress = 0;
        throw error;
    } finally {
        this.updateQueueDisplay();
    }
}

// Update executeLLMCommand to accept additional data
async executeLLMCommand(model, prompt, additionalData = {}) {
    try {
        const response = await fetch("http://localhost:8081/generate", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: model,
                prompt: prompt,
                ...additionalData
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
