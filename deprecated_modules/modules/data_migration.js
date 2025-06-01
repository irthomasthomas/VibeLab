// Data Migration Tools for VibeLab
// Migrate localStorage data to database

class DataMigrationTool {
    constructor(dbAPI) {
        this.dbAPI = dbAPI;
    }
    
    async migrateFromLocalStorage() {
        const migrationReport = {
            experiments: 0,
            prompts: 0,
            results: 0,
            errors: []
        };
        
        try {
            // Get all localStorage keys
            const keys = Object.keys(localStorage);
            const experimentKeys = keys.filter(k => k.startsWith('vibelab_experiment_'));
            
            for (const key of experimentKeys) {
                try {
                    const data = JSON.parse(localStorage.getItem(key));
                    
                    // Create experiment in database
                    const experimentData = {
                        name: data.name || key.replace('vibelab_experiment_', ''),
                        description: `Migrated from localStorage: ${data.created}`,
                        config: {
                            skipBaseline: data.skipBaseline || false,
                            svgsPerVar: data.svgsPerVar || 4,
                            variations: data.variations || [],
                            prompts: data.prompts || [],
                            models: data.models || []
                        }
                    };
                    
                    const dbExperiment = await this.dbAPI.createExperiment(experimentData);
                    migrationReport.experiments++;
                    
                    // Migrate prompts
                    for (const prompt of (data.prompts || [])) {
                        await this.dbAPI.createPrompt({
                            experiment_id: dbExperiment.id,
                            type: 'base',
                            content: prompt.text || prompt,
                            tags: []
                        });
                        migrationReport.prompts++;
                    }
                    
                    // Migrate results
                    for (const result of (data.results || [])) {
                        if (result.svgContent) {
                            // Create generation record
                            await this.dbAPI.createGeneration({
                                experiment_id: dbExperiment.id,
                                prompt_id: null, // We'd need to match this properly
                                model_id: result.model,
                                output: result.fullResponse || result.svgContent,
                                svg_content: result.svgContent,
                                generation_time_ms: 0,
                                metadata: {
                                    variation: result.variation,
                                    migrated: true,
                                    original_timestamp: result.timestamp
                                }
                            });
                            
                            // Migrate ranking if available
                            if (result.rank !== null && result.rank !== undefined) {
                                await this.dbAPI.saveRanking({
                                    experiment_id: dbExperiment.id,
                                    generation_id: result.id,
                                    rank: result.rank,
                                    evaluator_id: 'migrated_user'
                                });
                            }
                            
                            migrationReport.results++;
                        }
                    }
                    
                    // Optionally backup the localStorage data
                    localStorage.setItem(`${key}_backup`, localStorage.getItem(key));
                    localStorage.removeItem(key);
                    
                } catch (error) {
                    migrationReport.errors.push({
                        key: key,
                        error: error.message
                    });
                }
            }
            
            // Migrate templates
            const templatesKey = 'vibelab_prompt_templates';
            if (localStorage.getItem(templatesKey)) {
                try {
                    const templates = JSON.parse(localStorage.getItem(templatesKey));
                    for (const template of templates) {
                        await this.dbAPI.createPromptTemplate({
                            name: template.name,
                            content: template.prompt,
                            tags: template.tags || [],
                            metadata: {
                                animated: template.animated,
                                migrated: true
                            }
                        });
                    }
                    localStorage.setItem(`${templatesKey}_backup`, localStorage.getItem(templatesKey));
                    localStorage.removeItem(templatesKey);
                } catch (error) {
                    migrationReport.errors.push({
                        key: templatesKey,
                        error: error.message
                    });
                }
            }
            
        } catch (error) {
            migrationReport.errors.push({
                key: 'general',
                error: error.message
            });
        }
        
        return migrationReport;
    }
    
    async exportExperimentData(experimentId) {
        try {
            const experiment = await this.dbAPI.getExperiment(experimentId);
            
            // Create a comprehensive export
            const exportData = {
                version: '1.0',
                exportDate: new Date().toISOString(),
                experiment: experiment,
                // Additional data would be fetched here
            };
            
            return exportData;
        } catch (error) {
            throw new Error(`Failed to export experiment: ${error.message}`);
        }
    }
    
    downloadJSON(data, filename) {
        const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    }
}
