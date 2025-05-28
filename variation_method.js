
    addVariationInput() {
        const container = document.getElementById("variation-container");
        if (!container) return;
        
        const variationDiv = document.createElement("div");
        variationDiv.className = "variation-input-group";
        variationDiv.innerHTML = `
            <input type="text" class="variation-input" placeholder="Variation name (e.g., 'tone')">
            <textarea class="variation-values" placeholder="Values separated by newlines..."></textarea>
            <button type="button" class="remove-variation">×</button>
        `;
        
        const addButton = document.getElementById("add-variation");
        container.insertBefore(variationDiv, addButton);
    }
