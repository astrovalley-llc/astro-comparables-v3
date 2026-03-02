// index.js - Sidebar Entry Point
const ALLOWED_DOMAINS = ['homes.com', 'realtor.com', 'zillow.com'];
let masterPropertyList = []; // Holds the full list for filtering

/**
 * UI State Management
 */
async function updateAnalyzeButtonState() {
    const analyzeBtn = document.getElementById('analyzeBtn');
    const initialMessage = document.getElementById('initialMessage');

    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const isAllowed = tab?.url && ALLOWED_DOMAINS.some(domain => new URL(tab.url).hostname.includes(domain));

        analyzeBtn.disabled = !isAllowed;

        if (initialMessage) {
            initialMessage.textContent = isAllowed 
                ? 'Go to Sold or Active listings and click Analyze to Start.' 
                : 'Navigate to Homes.com, Realtor.com, or Zillow to analyze listings.';
        }
    } catch (error) {
        analyzeBtn.disabled = true;
    }
}

/**
 * Main Scrape Trigger
 */
async function handleAnalyzeClick() {
    const analyzeBtn = document.getElementById('analyzeBtn');
    analyzeBtn.textContent = 'Analyzing...';
    analyzeBtn.disabled = true;

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    chrome.tabs.sendMessage(tab.id, { action: "TRIGGER_SCRAPE" }, (response) => {
        analyzeBtn.textContent = 'Analyze';
        analyzeBtn.disabled = false;

        if (chrome.runtime.lastError) {
            console.error("Communication Error:", chrome.runtime.lastError.message);
            return;
        }

        if (response?.success) {
            masterPropertyList = response.data;
            processAndDisplayResults(masterPropertyList);
        }
    });
}

/**
 * Clear Results Handler
 */
function handleClearClick() {
    masterPropertyList = [];

    document.getElementById('clearBtn').style.display = 'none';
    document.getElementById('exportBtn').style.display = 'none';

    // Hide filters and market calculator
    const filtersStep = document.getElementById('filtersStep');
    if (filtersStep) filtersStep.style.display = 'none';

    const marketCalculator = document.getElementById('marketCalculator');
    if (marketCalculator) marketCalculator.style.display = 'none';

    // Show initial messages
    document.getElementById('initialMessage').style.display = 'block';
    document.getElementById('statusMessageSold').style.display = 'block';
    document.getElementById('statusMessageActive').style.display = 'block';

    // Reset status messages
    document.getElementById('statusMessageSold').textContent = 'Click "Analyze" to start.';
    document.getElementById('statusMessageActive').textContent = 'Click "Analyze" to start.';

    // Clear tables
    document.getElementById('resultsBodySold').innerHTML = '';
    document.getElementById('resultsBodyActive').innerHTML = '';

    // Hide summary containers and headers
    const summarySold = document.getElementById('summarySold');
    const summaryActive = document.getElementById('summaryActive');
    if (summarySold) summarySold.style.display = 'none';
    if (summaryActive) summaryActive.style.display = 'none';

    // Hide count headers
    const summaryCountSold = document.getElementById('summaryCountSold');
    const summaryCountActive = document.getElementById('summaryCountActive');
    if (summaryCountSold) summaryCountSold.style.display = 'none';
    if (summaryCountActive) summaryCountActive.style.display = 'none';

    // Reset Market Calculator
    const calcInput = document.getElementById('calcPPAInput');
    const acresInput = document.getElementById('calcAcresInput');
    const outputDiv = document.getElementById('calcValueOutput');
    
    if (calcInput) calcInput.value = '';
    if (acresInput) acresInput.value = '';
    if (outputDiv) {
        outputDiv.innerText = '$0.00';
        acresInput.value = '';
    }

    // Reset filters
    const filterIds = [
        'acresMin', 'acresMax',
        'priceMin', 'priceMax',
        'pricePerAcreMin', 'pricePerAcreMax'
        ];

    filterIds.forEach(id => {
        const input = document.getElementById(id);
        if (input) input.value = '';
        });
}

/**
 * Export Results Handler
 */
function handleExportClick() {
    if (!masterPropertyList || masterPropertyList.length === 0) {
        console.warn('No data to export');
        return;
    }

    console.log('Export functionality to be implemented', masterPropertyList);
}

/**
 * Splits data into Sold vs Active and renders them
 */
function processAndDisplayResults(properties) {
    // 1. Show UI elements now that we have data
    const filtersStep = document.getElementById('filtersStep');
    if (filtersStep) filtersStep.style.display = 'block';

    const marketCalculator = document.getElementById('marketCalculator');
    if (marketCalculator) marketCalculator.style.display = 'block';

    document.getElementById('clearBtn').style.display = 'block';
    document.getElementById('exportBtn').style.display = 'block';

    // 2. Get ALL current filter values
    const filters = {
        acresMin: parseFloat(document.getElementById('acresMin')?.value) || 0,
        acresMax: parseFloat(document.getElementById('acresMax')?.value) || Infinity,
        priceMin: parseFloat(document.getElementById('priceMin')?.value) || 0,
        priceMax: parseFloat(document.getElementById('priceMax')?.value) || Infinity,
        ppaMin: parseFloat(document.getElementById('pricePerAcreMin')?.value) || 0,
        ppaMax: parseFloat(document.getElementById('pricePerAcreMax')?.value) || Infinity
    };

    // 3. Split the MASTER list into original status buckets
    const soldTotal = masterPropertyList.filter(p => p.status && p.status.toLowerCase().includes('sold'));
    const activeTotal = masterPropertyList.filter(p => !p.status || !p.status.toLowerCase().includes('sold'));

    // 4. Integrated Filter Helper
    const applyAllFilters = (p) => {
        const ppa = p.price / p.acreageValue;
        return (
            p.acreageValue >= filters.acresMin &&
            p.acreageValue <= filters.acresMax &&
            p.price >= filters.priceMin &&
            p.price <= filters.priceMax &&
            ppa >= filters.ppaMin &&
            ppa <= filters.ppaMax
        );
    };

    // Apply filters to both buckets
    const soldFiltered = soldTotal.filter(applyAllFilters);
    const activeFiltered = activeTotal.filter(applyAllFilters);

    // 5. Update Tables, Headers, and Render Cards
    updateSummaryContainer('summarySold', soldFiltered, soldTotal.length);
    updateSummaryContainer('summaryActive', activeFiltered, activeTotal.length);
    updateSummaryHeader('summaryCountSold', soldFiltered.length, soldTotal.length);
    updateSummaryHeader('summaryCountActive', activeFiltered.length, activeTotal.length);

    // Render each bucket
    renderBucket('resultsBodySold', soldFiltered);
    renderBucket('resultsBodyActive', activeFiltered);

    // 6. Refresh Valuation Logic
    // Pass the filtered lists directly to the calculation logic
    updateSuggestedPPA(soldFiltered, activeFiltered);
    calculateFinalValue();

    // 7. Clear status messages
    document.getElementById('initialMessage').style.display = 'none';
    document.getElementById('statusMessageSold').style.display = 'none';
    document.getElementById('statusMessageActive').style.display = 'none';
}

/**
 * Updates the summary div with the "X of Y results" text in purple
 */
function updateSummaryHeader(elementId, visibleCount, totalCount) {
    const el = document.getElementById(elementId);
    if (!el) return;

    el.style.display = 'inline-block';
    el.textContent = `(${visibleCount} of ${totalCount})`;
}

/**
 * Updates the summary div with the "X of Y" count and the stats table.
 */
function updateSummaryContainer(elementId, list, totalCount) {
    const container = document.getElementById(elementId);
    if (!container) return;

    if (list.length === 0) {
        container.style.display = 'none';
        return;
    }

    container.style.display = 'block';
    const stats = calculateStats(list);

    let html = ``;

    if (stats) {
        html = `
        <table style="width: 100%; border-collapse: collapse; font-size: 13px; text-align: left; color: #475569; margin-bottom: 12px;">
            <thead>
                <tr style="border-bottom: 1px solid #ddd;">
                    <th style="padding: 4px 0; font-weight: 400;"></th>
                    <th style="padding: 4px 0; font-weight: 600;">Acres</th>
                    <th style="padding: 4px 0; font-weight: 600;">Price</th>
                    <th style="padding: 4px 0; font-weight: 600;">$/Acre</th>
                </tr>
            </thead>
            <tbody>
                <tr style="border-bottom: 1px solid #ddd;">
                    <td style="padding: 8px 0; font-weight: 700; color: #64748b;">Avg</td>
                    <td style="padding: 8px 0;">${stats.avgacres?.toFixed(2) || "0.00"}</td>
                    <td style="padding: 8px 0;">$${Math.round(stats.avgprice || 0).toLocaleString()}</td>
                    <td style="padding: 8px 0;">$${Math.round(stats.avgppa || 0).toLocaleString()}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; font-weight: 700; color: #64748b;">Median</td>
                    <td style="padding: 8px 0;">${stats.medianacres?.toFixed(2) || "0.00"}</td>
                    <td style="padding: 8px 0;">$${Math.round(stats.medianprice || 0).toLocaleString()}</td>
                    <td style="padding: 8px 0;">$${Math.round(stats.medianppa || 0).toLocaleString()}</td>
                </tr>
            </tbody>
        </table>
    `;
    }

    container.innerHTML = html;
}

/**
 * Generic helper to render a list of cards into a specific container
 * Handles missing data gracefully to prevent UI crashes.
 */
function renderBucket(containerId, list) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (list.length === 0) {
        container.innerHTML = '<div style="padding: 15px; color: #64748b; font-size: 0.9em;">No listings found.</div>';
        return;
    }

    container.innerHTML = list.map(p => {
        const price = (p.price && typeof p.price === 'number') ? p.price : 0;
        
        // Use numeric value for math
        const ppa = (price > 0 && p.acreageValue > 0) 
            ? `$${Math.round(price / p.acreageValue).toLocaleString()} per Acre` 
            : 'Price per Acre: N/A';

        // Prevents Zillow from showing "Sold Sold" if the date is missing
        const displayStatus = p.status || '';

        console.log(`Sold Status: ${displayStatus}`);

        return `
            <div class="astro-mini-card">		  
                <button class ="delete-card-btn" data-id="${p.id}">&times;</button>

                <div style="display: flex; justify-content: space-between; align-items: baseline;">
                    <div style="font-size: 13px; color: #444;">
                        <span style="font-weight: 700;">${p.acreage}</span>
                        ${displayStatus ? `
                            <span style="display: inline-block; font-size: 0.7em; background: #e0f2fe; color: #0369a1; padding: 2px 6px; border-radius: 4px; margin-top: 6px; font-weight: 600;">
                                ${displayStatus}
                            </span>
                        ` : ''}
                    </div>
                    <div style="font-size: 14px; font-weight: 700; color: #897BCC;">
                        $${price.toLocaleString()}
                    </div>
                </div>

                <div style="margin-top: 4px; font-size: 0.8em; color: #444;">
                    ${ppa}
                </div>

                <div style="margin-top: 4px; font-size: 0.8em; color: #444; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                    <a href="${p.url}" target="_blank" class="astro-address-link">
                        ${p.address || 'Address not available'}
                    </a>
                </div>

            </div>
        `;
    }).join('');
}

/**
 * Calculates Mean and Median stats for a list of properties.
 * Filters out invalid data (zero price/acres) to ensure accuracy.
 */
function calculateStats(properties) {
    if (!properties || properties.length === 0) return null;

    // Filter out properties missing price or acreage to avoid NaN results
    const validOnes = properties.filter(p => p.price > 0 && p.acreageValue > 0);
    if (validOnes.length === 0) return null;

    const acres = validOnes.map(p => p.acreageValue);
    const prices = validOnes.map(p => p.price);
    const ppas = validOnes.map(p => p.price / p.acreageValue);

    const mean = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
    const median = (arr) => {
        const sorted = [...arr].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[sorted.length / 2]) / 2;
    };

    return {
        avgacres: mean(acres),
        avgprice: mean(prices),
        avgppa: mean(ppas),
        medianacres: median(acres),
        medianprice: median(prices),
        medianppa: median(ppas)
    };
}

/**
 * Calculates the lowest PPA from selected buckets and updates the input.
 */
function updateSuggestedPPA(soldFiltered, activeFiltered) {
    const calcInput = document.getElementById('calcPPAInput');
    const outputDiv = document.getElementById('calcValueOutput');
    if (!calcInput) return;

    const useSold = document.getElementById('includeSoldCheckbox')?.checked;
    const useActive = document.getElementById('includeActiveCheckbox')?.checked;

    let possibleValues = [];

    // Use the arguments passed in (filtered data) instead of masterPropertyList
    if (useSold && soldFiltered.length > 0) {
        const soldStats = calculateStats(soldFiltered);
        if (soldStats) possibleValues.push(soldStats.avgppa, soldStats.medianppa);
    }

    if (useActive && activeFiltered.length > 0) {
        const activeStats = calculateStats(activeFiltered);
        if (activeStats) possibleValues.push(activeStats.avgppa, activeStats.medianppa);
    }

    if (possibleValues.length > 0) {
        const lowestPPA = Math.min(...possibleValues);
        calcInput.value = Math.round(lowestPPA);
    } else {
        calcInput.value = "";
        if (outputDiv) outputDiv.style.display = 'none';
    }
}

/**
 * Multiplies the Price Per Acre by the Target Acreage to show the Final Value.
 */
function calculateFinalValue() {
    const ppaInput = document.getElementById('calcPPAInput');
    const acresInput = document.getElementById('calcAcresInput');
    const outputDiv = document.getElementById('calcValueOutput');

    if (!ppaInput || !acresInput || !outputDiv) return;

    const ppa = parseFloat(ppaInput.value) || 0;
    const acres = parseFloat(acresInput.value) || 0;

    if (acres <= 0) {
        //outputDiv.style.display = 'none';
        outputDiv.innerText = '$0.00';
        return;
    }

    const totalValue = ppa * acres;

    // Show your existing div
    outputDiv.style.display = 'block';

    // OPTION A: If your div is just a container for the number
    outputDiv.innerText = `$${Math.round(totalValue).toLocaleString()}`;

    // OPTION B: If you have a specific span inside for the value
    // const valueSpan = document.getElementById('finalValueSpan');
    // if (valueSpan) valueSpan.innerText = `$${Math.round(totalValue).toLocaleString()}`;
}

/**
 * Deletes a property from the master list and re-renders the UI.
 */
function deleteProperty(id) {
    // 1. Remove from the master list
    masterPropertyList = masterPropertyList.filter(p => p.id !== id);

    // 2. Re-run the display logic (this updates counts, stats, and market value)
    processAndDisplayResults();
}

/**
 * Initialization & Listeners
 */
document.addEventListener('DOMContentLoaded', () => {
    // 1. Core Actions
    document.getElementById('analyzeBtn').addEventListener('click', handleAnalyzeClick);
    document.getElementById('clearBtn').addEventListener('click', handleClearClick);
    document.getElementById('exportBtn').addEventListener('click', handleExportClick);

    // 2. Tab Listeners for State Management
    updateAnalyzeButtonState();
    chrome.tabs.onUpdated.addListener((id, change) => { if (change.url || change.status === 'complete') updateAnalyzeButtonState(); });
    chrome.tabs.onActivated.addListener(updateAnalyzeButtonState);

    // 3. Accordion Logic (Retained)
    document.querySelectorAll('.astro-step-header').forEach(header => {
        header.addEventListener('click', () => header.closest('.astro-step').classList.toggle('collapsed'));
    });

    // 4. Number Input Formatting (Retained/Cleaned)
    document.querySelectorAll('input[type="number"]').forEach(input => {
        input.addEventListener('blur', function() {
            if (this.value && !isNaN(this.value)) this.value = parseFloat(this.value).toFixed(2);
        });

        // Handle 0-to-empty behavior when decrementing
        input.addEventListener('input', function() {
            const value = parseFloat(this.value);

            // If value is negative, set to empty
            if (value < 0) {
                this.value = '';
                return;
            }

            // If value is 0 and user is decrementing, clear the field
            if (value === 0) {
                // Small timeout to check if the next value would be negative
                setTimeout(() => {
                    if (this.value === '0' || parseFloat(this.value) === 0) {
                        this.value = '';
                    }
                }, 50);
            }
        });
    });

    const minInput = document.getElementById('minAcreage');
    const maxInput = document.getElementById('maxAcreage');

    if (minInput && maxInput) {
        // 'input' event fires on every keystroke
        minInput.addEventListener('input', processAndDisplayResults);
        maxInput.addEventListener('input', processAndDisplayResults);
    }

    const soldCheck = document.getElementById('includeSoldCheckbox');
    const activeCheck = document.getElementById('includeActiveCheckbox');

    if (soldCheck) soldCheck.addEventListener('change', () => {
        // Refresh the UI and the Suggested PPA
        processAndDisplayResults(); 
    });

    if (activeCheck) activeCheck.addEventListener('change', () => {
        processAndDisplayResults();
    });


    // Listen for changes in the Market Calculator inputs to update the final value
    const acresInput = document.getElementById('calcAcresInput');
    const ppaInput = document.getElementById('calcPPAInput');

    if (acresInput) {acresInput.addEventListener('input', calculateFinalValue);}
    
    // This allows the user to manually override the suggested PPA
    if (ppaInput) { ppaInput.addEventListener('input', calculateFinalValue); }

    const filterIds = [
        'acresMin', 'acresMax', 
        'priceMin', 'priceMax', 
        'pricePerAcreMin', 'pricePerAcreMax'
    ];

    filterIds.forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            // 'input' event triggers immediately on every keystroke
            input.addEventListener('input', processAndDisplayResults);
        }
    });

    // Handle clicks on delete buttons using event delegation
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('delete-card-btn')) {
            const propertyId = e.target.getAttribute('data-id');
            deleteProperty(propertyId);
        }
    });
});