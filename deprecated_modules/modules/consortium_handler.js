// Consortium Model Handler for VibeLab

class ConsortiumHandler {
    constructor(vibelab) {
        this.vibelab = vibelab;
        this.consortiums = new Map();
        this.loadSavedConsortiums();
    }
    
    createConsortium(config) {
        const consortium = {
            id: 'consortium_' + Date.now(),
            name: config.name,
            models: config.models,
            arbiter: config.arbiter,
            maxIterations: config.maxIterations || 3,
            confidenceThreshold: config.confidenceThreshold || 0.8,
            created: new Date().toISOString()
        };
        
        this.consortiums.set(consortium.id, consortium);
        this.saveConsortiums();
        
        // Register as a special model type
        this.registerConsortiumAsModel(consortium);
        
        return consortium;
    }
    
    registerConsortiumAsModel(consortium) {
        // Add to the model list as a special consortium type
        const consortiumModel = {
            id: consortium.id,
            name: `${consortium.name} (Consortium)`,
            value: `consortium:${consortium.id}`,
            type: 'consortium',
            consortium_config: consortium
        };
        
        // Add to UI model list
        this.addConsortiumToModelList(consortiumModel);
        
        // Register in database if connected
        if (this.vibelab.dbAPI) {
            this.vibelab.dbAPI.registerModel({
                name: consortiumModel.value,
                type: 'consortium',
                consortium_config: JSON.stringify(consortium)
            });
        }
    }
    
    addConsortiumToModelList(consortiumModel) {
        const modelSelection = document.querySelector('.model-selection');
        const label = document.createElement('label');
        label.innerHTML = `<input type="checkbox" value="${consortiumModel.value}"> ${consortiumModel.name}`;
        modelSelection.appendChild(label);
    }
    
    async executeConsortium(consortiumId, prompt) {
        const consortium = this.consortiums.get(consortiumId);
        if (!consortium) {
            throw new Error(`Consortium ${consortiumId} not found`);
        }
        
        console.log(`Executing consortium ${consortium.name} with ${consortium.models.length} models`);
        
        // Phase 1: Get responses from all member models
        const responses = await this.getMemberResponses(consortium, prompt);
        
        // Phase 2: Use arbiter to select best response
        const bestResponse = await this.arbitrate(consortium, prompt, responses);
        
        // Phase 3: Optional iterative improvement
        let finalResponse = bestResponse;
        if (consortium.maxIterations > 1) {
            finalResponse = await this.iterativeImprovement(
                consortium, 
                prompt, 
                bestResponse, 
                consortium.maxIterations - 1
            );
        }
        
        return finalResponse;
    }
    
    async getMemberResponses(consortium, prompt) {
        const responses = [];
        
        // Execute all member models in parallel
        const promises = consortium.models.map(async (model) => {
            try {
                const response = await this.vibelab.executeLLMCommand(model, prompt);
                return {
                    model: model,
                    response: response,
                    svgContent: this.vibelab.extractSVG(response)
                };
            } catch (error) {
                console.error(`Error with model ${model}:`, error);
                return null;
            }
        });
        
        const results = await Promise.all(promises);
        return results.filter(r => r !== null);
    }
    
    async arbitrate(consortium, originalPrompt, responses) {
        if (responses.length === 0) {
            throw new Error('No valid responses from consortium members');
        }
        
        if (responses.length === 1) {
            return responses[0].response;
        }
        
        // Create arbitration prompt
        const arbitrationPrompt = this.createArbitrationPrompt(originalPrompt, responses);
        
        // Use arbiter model to select best response
        const arbiterResponse = await this.vibelab.executeLLMCommand(
            consortium.arbiter, 
            arbitrationPrompt
        );
        
        //
    }
}
