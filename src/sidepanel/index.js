// index.js - Sidebar Entry Point
const ALLOWED_DOMAINS = ['zillow.com', 'realtor.com', 'homes.com'];
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
 * Splits data into Sold vs Active and renders them
 */
function processAndDisplayResults(properties) {
    // 1. Show the filter div now that we have data
    const filtersStep = document.getElementById('filtersStep');
    if (filtersStep) filtersStep.style.display = 'block';

    // 2. Get current filter values
    const minAcres = parseFloat(document.getElementById('minAcreage')?.value) || 0;
    const maxAcres = parseFloat(document.getElementById('maxAcreage')?.value) || Infinity;

    // 3. Split the MASTER list into the two status buckets
    const soldTotal = masterPropertyList.filter(p => 
        p.status && p.status.toLowerCase().includes('sold')
    );
    const activeTotal = masterPropertyList.filter(p => 
        !p.status || !p.status.toLowerCase().includes('sold')
    );

    // 4. Apply the Acreage Range Filter to those buckets
    const soldFiltered = soldTotal.filter(p => p.acreage >= minAcres && p.acreage <= maxAcres);
    const activeFiltered = activeTotal.filter(p => p.acreage >= minAcres && p.acreage <= maxAcres);

    // 5. Update Summaries (e.g., "5 of 15 results")
    updateSummaryContainer('summarySold', soldFiltered, soldTotal.length);
    updateSummaryContainer('summaryActive', activeFiltered, activeTotal.length);

    // Update the Headers (to the Spans)
    updateSummaryHeader('summaryCountSold', soldFiltered.length, soldTotal.length);
    updateSummaryHeader('summaryCountActive', activeFiltered.length, activeTotal.length);

    // Clear status messages
    document.getElementById('statusMessageSold').style.display = 'none';
    document.getElementById('statusMessageActive').style.display = 'none';

    // Render each bucket
    renderBucket('resultsBodySold', soldFiltered);
    renderBucket('resultsBodyActive', activeFiltered);
}

/**
 * Updates the summary div with the "X of Y results" text in purple
 */
function updateSummaryHeader(elementId, visibleCount, totalCount) {
    const el = document.getElementById(elementId);
    if (!el) return;

    el.style.display = 'inline-block'; // Show the span
    el.innerHTML = `<span style="color: #7c3aed; font-weight: 400;">${visibleCount} of ${totalCount} results</span>`;
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
        const acreage = (p.acreage && typeof p.acreage === 'number') ? p.acreage : 0;
        
        // Math for Row 2: Price per Acre
        const ppa = (price > 0 && acreage > 0) 
            ? `$${Math.round(price / acreage).toLocaleString()} per Acre` 
            : 'Price per Acre: N/A';

        // Prevents Zillow from showing "Sold Sold" if the date is missing
        const displayStatus = p.status || '';

        console.log(`Sold Status: ${displayStatus}`);

        return `
            <div class="astro-mini-card" style="padding: 8px; border: 1px solid #ddd; margin-bottom: 8px; font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; border-radius: 6px; background: #fff; box-shadow: 0 8px 8px rgba(0, 0.08, 0, 0.16);">
						   
                <div style="display: flex; justify-content: space-between; align-items: baseline;">
                    <div style="font-size: 13px; color: #444;">
                        <span style="font-weight: 700;">${acreage.toFixed(2)} Acre</span>
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

    const validOnes = properties.filter(p => p.price > 0 && p.acreage > 0);
    if (validOnes.length === 0) return null;

    const acres = validOnes.map(p => p.acreage);
    const prices = validOnes.map(p => p.price);
    const ppas = validOnes.map(p => p.price / p.acreage);

    const mean = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
    const median = (arr) => {
        const sorted = [...arr].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
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
 * Initialization & Listeners
 */
document.addEventListener('DOMContentLoaded', () => {
    // 1. Core Actions
    document.getElementById('analyzeBtn').addEventListener('click', handleAnalyzeClick);

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
    });

    const minInput = document.getElementById('minAcreage');
    const maxInput = document.getElementById('maxAcreage');

    if (minInput && maxInput) {
        // 'input' event fires on every keystroke
        minInput.addEventListener('input', processAndDisplayResults);
        maxInput.addEventListener('input', processAndDisplayResults);
    }
});