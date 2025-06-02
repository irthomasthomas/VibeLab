#!/usr/bin/env python3

# Read the original file
with open('app.js', 'r') as f:
    lines = f.readlines()

# Find the createSVGItem method (line 582 to 610)
start_line = 581  # 0-indexed
end_line = 610    # 0-indexed

# New createSVGItem method
new_method = '''    createSVGItem(result, rank) {
        const svgItem = document.createElement('div');
        svgItem.className = 'svg-item';
        svgItem.draggable = true;
        svgItem.dataset.id = result.id;

        const variationText = this.getVariationDisplayText(result.variation);
        const hideDetails = document.getElementById('hide-details') && document.getElementById('hide-details').checked;

        // Create rank badge
        const rankBadge = document.createElement('div');
        rankBadge.className = 'rank-badge';
        rankBadge.textContent = rank;
        svgItem.appendChild(rankBadge);

        // Create SVG container and preserve SVG DOM structure
        const svgContainer = document.createElement('div');
        svgContainer.className = `svg-container ${result.animated ? 'animated' : 'static'}`;
        
        // Parse SVG content once and preserve as DOM node
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = result.svgContent;
        const svgElement = tempDiv.querySelector('svg');
        if (svgElement) {
            // Clone the SVG to avoid moving the original
            svgContainer.appendChild(svgElement.cloneNode(true));
        } else {
            // Fallback if no SVG found
            svgContainer.innerHTML = result.svgContent;
        }
        
        svgItem.appendChild(svgContainer);

        // Add details if not hidden
        if (!hideDetails) {
            const svgInfo = document.createElement('div');
            svgInfo.className = 'svg-info';
            svgInfo.innerHTML = `
                <div><strong>${result.model}</strong></div>
                <div>${variationText}</div>
            `;
            svgItem.appendChild(svgInfo);
        }

        return svgItem;
    }

'''

# Replace the method
new_lines = lines[:start_line] + [new_method] + lines[end_line:]

# Write the modified file
with open('app.js', 'w') as f:
    f.writelines(new_lines)

print("Successfully replaced createSVGItem method")
EOF; sleep 2
