// Allowed domains for the analyzer
const ALLOWED_DOMAINS = ['zillow.com', 'realtor.com', 'homes.com'];

// Check if the current tab URL is on an allowed domain
function isAllowedDomain(url) {
    if (!url) return false;
    try {
        const urlObj = new URL(url);
        return ALLOWED_DOMAINS.some(domain => urlObj.hostname.includes(domain));
    } catch (e) {
        return false;
    }
}

// Update the analyze button state based on the current tab
async function updateAnalyzeButtonState() {
    const analyzeBtn = document.getElementById('analyzeBtn');
    const initialMessage = document.getElementById('initialMessage');

    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const isAllowed = isAllowedDomain(tab?.url);

        analyzeBtn.disabled = !isAllowed;

        if (!isAllowed && initialMessage && initialMessage.style.display !== 'none') {
            initialMessage.textContent = 'Navigate to Homes.com,Realtor.com, or Zillow to analyze listings.';
        } else if (isAllowed && initialMessage && initialMessage.style.display !== 'none') {
            initialMessage.textContent = 'Go to Sold or Active listings and click Analyze to Start.';
        }
    } catch (error) {
        console.error('Error checking tab URL:', error);
        analyzeBtn.disabled = true;
    }
}

// Accordion functionality for collapsible steps
document.addEventListener('DOMContentLoaded', function() {
    const stepHeaders = document.querySelectorAll('.astro-step-header');
    
    stepHeaders.forEach(header => {
        header.addEventListener('click', function() {
            const step = this.closest('.astro-step');
            step.classList.toggle('collapsed');
        });
    });

    // Handle arrow key navigation for number inputs with two decimal places
    const numberInputs = document.querySelectorAll('input[type="number"]');
    
    numberInputs.forEach(input => {
        // Format value to two decimal places on blur
        input.addEventListener('blur', function() {
            if (this.value && !isNaN(this.value)) {
                this.value = parseFloat(this.value).toFixed(2);
            }
        });

        // Handle keyboard arrow keys for increment/decrement
        input.addEventListener('keydown', function(e) {
            const currentValue = parseFloat(this.value) || 0;
            const step = parseFloat(this.step) || 0.01;

            if (e.key === 'ArrowUp') {
                e.preventDefault();
                this.value = (currentValue + step).toFixed(2);
                this.dispatchEvent(new Event('input', { bubbles: true }));
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                const newValue = Math.max(0, currentValue - step);
                this.value = newValue.toFixed(2);
                this.dispatchEvent(new Event('input', { bubbles: true }));
            }
        });
    });

    // Check button state on load
    updateAnalyzeButtonState();

    // Listen for tab updates to update button state dynamically
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
        if (changeInfo.url || changeInfo.status === 'complete') {
            updateAnalyzeButtonState();
        }
    });

    // Listen for tab activation (switching between tabs)
    chrome.tabs.onActivated.addListener(() => {
        updateAnalyzeButtonState();
    });
});