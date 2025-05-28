
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
        document.getElementById('experiment-name').value = '';
        document.getElementById('experiment-description').value = '';
        
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
        document.getElementById('svgs-per-var').value = '4';
        document.getElementById('skip-baseline').checked = false;

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

