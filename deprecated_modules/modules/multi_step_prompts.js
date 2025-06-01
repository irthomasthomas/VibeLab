// Multi-Step Prompt System for VibeLab
// Enables conversation-based prompt refinement

class MultiStepPromptSystem {
    constructor(vibelab) {
        this.vibelab = vibelab;
        this.conversations = new Map(); // conversation_id -> conversation data
    }
    
    // Start a multi-step conversation
    async startMultiStepConversation(basePrompt, model, experimentId) {
        const conversationId = this.generateConversationId();
        
        const conversation = {
            id: conversationId,
            basePrompt: basePrompt,
            model: model,
            experimentId: experimentId,
            steps: [],
            currentStep: 0
        };
        
        this.conversations.set(conversationId, conversation);
        return conversationId;
    }
    
    // Add a step to the conversation
    async addConversationStep(conversationId, stepPrompt, stepType = 'follow_up') {
        const conversation = this.conversations.get(conversationId);
        if (!conversation) {
            throw new Error(`Conversation ${conversationId} not found`);
        }
        
        const step = {
            stepNumber: conversation.steps.length + 1,
            prompt: stepPrompt,
            type: stepType,
            timestamp: new Date().toISOString(),
            result: null
        };
        
        conversation.steps.push(step);
        return step;
    }
    
    // Execute a conversation step
    async executeConversationStep(conversationId, stepPrompt, stepType = 'follow_up') {
        const conversation = this.conversations.get(conversationId);
        if (!conversation) {
            throw new Error(`Conversation ${conversationId} not found`);
        }
        
        // Add the step
        const step = await this.addConversationStep(conversationId, stepPrompt, stepType);
        
        try {
            // Execute with conversation context
            const requestBody = {
                model: conversation.model,
                prompt: stepPrompt,
                conversation_id: conversationId,
                experiment_id: conversation.experimentId,
                prompt_type: 'multi_step'
            };
            
            const result = await this.vibelab.executeLLMCommand(
                conversation.model, 
                stepPrompt, 
                requestBody
            );
            
            step.result = {
                fullResponse: result,
                svgContent: this.vibelab.extractSVG(result),
                timestamp: new Date().toISOString()
            };
            
            return step;
        } catch (error) {
            step.error = error.message;
            throw error;
        }
    }
    
    // Predefined conversation patterns
    async tryHarder(conversationId) {
        const followUpPrompts = [
            "Try harder to make this more detailed and visually appealing",
            "Please improve the design with better composition and styling",
            "Enhance this with more creative elements and better visual hierarchy",
            "Make this more professional and polished"
        ];
        
        const randomPrompt = followUpPrompts[Math.floor(Math.random() * followUpPrompts.length)];
        return await this.executeConversationStep(conversationId, randomPrompt, 'try_harder');
    }
    
    async refineWithConstraints(conversationId, constraints) {
        const prompt = `Please refine the previous SVG with these specific requirements: ${constraints}`;
        return await this.executeConversationStep(conversationId, prompt, 'refinement');
    }
    
    async iterativeImprovement(conversationId, improvementType) {
        const improvements = {
            'visual': "Focus on improving the visual appeal and aesthetics",
            'technical': "Optimize the SVG code for performance and cleanliness", 
            'composition': "Improve the overall composition and layout",
            'detail': "Add more detail and visual interest"
        };
        
        const prompt = improvements[improvementType] || improvements['visual'];
        return await this.executeConversationStep(conversationId, prompt, 'iterative_improvement');
    }
    
    generateConversationId() {
        return 'conv_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    // Get conversation history
    getConversation(conversationId) {
        return this.conversations.get(conversationId);
    }
    
    // Export conversation for analysis
    exportConversation(conversationId) {
        const conversation = this.conversations.get(conversationId);
        if (!conversation) return null;
        
        return {
            ...conversation,
            export_timestamp: new Date().toISOString()
        };
    }
}

// Add multi-step methods to VibeLab class
VibeLab.prototype.initializeMultiStep = function() {
    this.multiStep = new MultiStepPromptSystem(this);
};

VibeLab.prototype.startConversation = async function(basePrompt, model, experimentId) {
    return await this.multiStep.startMultiStepConversation(basePrompt, model, experimentId);
};

VibeLab.prototype.continueConversation = async function(conversationId, followUpPrompt, stepType) {
    return await this.multiStep.executeConversationStep(conversationId, followUpPrompt, stepType);
};

VibeLab.prototype.tryHarder = async function(conversationId) {
    return await this.multiStep.tryHarder(conversationId);
};
