// index.js - Sidebar Entry Point
const ALLOWED_DOMAINS = ['homes.com', 'realtor.com', 'zillow.com'];

// Holds the full list for filtering
let masterPropertyList = []; 

// Cached DOM Elements (initialized after DOM loads)
let analyzeBtn, clearBtn, exportBtn, initialMessage;
let statusMessageSold, statusMessageActive;
let resultsBodySold, resultsBodyActive;
let summarySold, summaryActive;
let summaryCountSold, summaryCountActive;
let filtersStep, marketCalculator;
let calcPPAInput, calcAcresInput, calcValueOutput;
let unifiedSort, currentSortDisplay;

/**
 * Initializes all DOM element references for performance
 */
function initializeDOMReferences() {
    // Header buttons
    analyzeBtn = document.getElementById('analyzeBtn');
    clearBtn = document.getElementById('clearBtn');
    exportBtn = document.getElementById('exportBtn');
    initialMessage = document.getElementById('initialMessage');

    // Status messages
    statusMessageSold = document.getElementById('statusMessageSold');
    statusMessageActive = document.getElementById('statusMessageActive');

    // Results containers
    resultsBodySold = document.getElementById('resultsBodySold');
    resultsBodyActive = document.getElementById('resultsBodyActive');

    // Summary containers
    summarySold = document.getElementById('summarySold');
    summaryActive = document.getElementById('summaryActive');
    summaryCountSold = document.getElementById('summaryCountSold');
    summaryCountActive = document.getElementById('summaryCountActive');

    // Sections
    filtersStep = document.getElementById('filtersStep');
    marketCalculator = document.getElementById('marketCalculator');

    // Market calculator inputs
    calcPPAInput = document.getElementById('calcPPAInput');
    calcAcresInput = document.getElementById('calcAcresInput');
    calcValueOutput = document.getElementById('calcValueOutput');

    // Sorting elements
    unifiedSort = document.getElementById('unifiedSort');
    currentSortDisplay = document.getElementById('currentSortDisplay');
}

/**
 * UI State Management
 */
async function updateAnalyzeButtonState() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const isAllowed = tab?.url && ALLOWED_DOMAINS.some(domain => new URL(tab.url).hostname.includes(domain));

        analyzeBtn.disabled = !isAllowed;

        if (initialMessage) {
            initialMessage.textContent = isAllowed 
                ? 'Search listings and click Analyze to Start.' 
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
            // Add properties to master list
            masterPropertyList = response.data;
            // SAVE TO STORAGE IMMEDIATELY
            saveToLocalStorage();
            // Update UI
            processAndDisplayResults(masterPropertyList);
        }
    });
}

/**
 * Clear Results Handler
 */
function handleClearClick() {
    masterPropertyList = [];

    // Wipe the storage
    localStorage.removeItem('propertyData');

    clearBtn.style.display = 'none';
    exportBtn.style.display = 'none';

    // Hide filters and market calculator
    if (filtersStep) filtersStep.style.display = 'none';
    if (marketCalculator) marketCalculator.style.display = 'none';

    // Show initial messages
    initialMessage.style.display = 'block';
    statusMessageSold.style.display = 'block';
    statusMessageActive.style.display = 'block';

    // Reset status messages
    statusMessageSold.textContent = 'Click "Analyze" to start.';
    statusMessageActive.textContent = 'Click "Analyze" to start.';

    // Clear tables
    resultsBodySold.innerHTML = '';
    resultsBodyActive.innerHTML = '';

    // Hide summary containers and headers
    if (summarySold) summarySold.style.display = 'none';
    if (summaryActive) summaryActive.style.display = 'none';
    if (summaryCountSold) summaryCountSold.style.display = 'none';
    if (summaryCountActive) summaryCountActive.style.display = 'none';

    // Reset Market Calculator
    if (calcPPAInput) calcPPAInput.value = '';
    if (calcAcresInput) calcAcresInput.value = '';
    if (calcValueOutput) {
        calcValueOutput.innerText = '$0.00';
        calcAcresInput.value = '';
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
 * Returns all currently filtered records from both sold and active listings.
 * Returns empty array if no records exist or no filters are applied.
 */
function getCurrentlyFilteredData() {
    if (!masterPropertyList || masterPropertyList.length === 0) {
        return [];
    }

    // Get ALL current filter values
    const filters = {
        acresMin: parseFloat(document.getElementById('acresMin')?.value) || 0,
        acresMax: parseFloat(document.getElementById('acresMax')?.value) || Infinity,
        priceMin: parseFloat(document.getElementById('priceMin')?.value) || 0,
        priceMax: parseFloat(document.getElementById('priceMax')?.value) || Infinity,
        ppaMin: parseFloat(document.getElementById('pricePerAcreMin')?.value) || 0,
        ppaMax: parseFloat(document.getElementById('pricePerAcreMax')?.value) || Infinity
    };

    // Filter helper function
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

    // Apply filters to all properties and return combined result
    return masterPropertyList.filter(applyAllFilters);
}

/**
 * Export Results Handler
 */
function handleExportClick() {
    if (!masterPropertyList || masterPropertyList.length === 0) {
        console.warn('No data to export');
        return;
    }
    prepareExportCards();

    // Display the export container
    const modal = document.getElementById('exportModal');
    const drawer = modal?.querySelector(".astro-modal-content");

    if (modal && drawer) {
        drawer.style.transform = "translateY(-110%)";
        modal.classList.remove('hidden');
        requestAnimationFrame(() => {
            drawer.style.transform = "translateY(0)";
        });
    }
}

function prepareExportCards() {

    // 1. Prepare data and counts
    const allRecords = masterPropertyList || [];
    const filteredRecords = getCurrentlyFilteredData(); 

    const optAll = document.getElementById('optionAll');
    const optFiltered = document.getElementById('optionFiltered');
    const exportCards = document.querySelectorAll('.astro-export-card');

    // Update count displays
    const countAllElement = document.getElementById('count-all');
    const countFilteredElement = document.getElementById('count-filtered');

    if (countAllElement) countAllElement.textContent = `(${allRecords.length})`;
    if (countFilteredElement) countFilteredElement.textContent = `(${filteredRecords.length})`;

    // If no records at all, disable both cards and exit
    if (allRecords.length === 0) {
        optAll.classList.add('disabled');
        optFiltered.classList.add('disabled');
        return;
    }

    // Remove disabled state if there are records
    optAll.classList.remove('disabled');

    // Set up click listeners for the cards
    exportCards.forEach(card => {
        card.onclick = () => {
            if (card.classList.contains('disabled')) return;
            exportCards.forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            const radio = card.querySelector('input');
            if (radio) radio.checked = true;
        };
    });

    // Determine if "Filtered" is an eligible option
    const isActuallyFiltered = filteredRecords.length < allRecords.length && filteredRecords.length > 0;

    if (!isActuallyFiltered) {
        optFiltered.classList.add('disabled');
        optFiltered.classList.remove('active');
        optAll.classList.add('active');
        const allRadio = optAll.querySelector('input[value="all"]');
        if (allRadio) allRadio.checked = true;
    } else {
        optFiltered.classList.remove('disabled');
        optAll.classList.remove('active');
        optFiltered.classList.add('active');
        const filteredRadio = optFiltered.querySelector('input[value="filtered"]');
        if (filteredRadio) filteredRadio.checked = true;
    }
}

/**
 * Closes the export modal with a slide-up animation
 */
function handleExportModalClose() {    
    const modal = document.getElementById("exportModal");
    if (!modal) return;

    const drawer = modal.querySelector(".astro-modal-content");
    if (drawer) {
        drawer.style.transform = "translateY(-110%)";
        setTimeout(() => {
            modal.classList.add('hidden');
            drawer.style.transform = "";
        }, 600);
    }
}

/**
 * Exports the selected dataset (all or filtered) to CSV with suggested filename
 */
function exportToCsv() {
    if (masterPropertyList.length === 0) {
        alert("No data to export!");
        return;
    }

    // 1. Determine which export option is selected
    const selectedRadio = document.querySelector('input[name="exportType"]:checked');
    const exportType = selectedRadio ? selectedRadio.value : 'all';

    // 2. Get the appropriate data and generate filename
    let dataToExport;
    let suggestedFilename;
    const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

    if (exportType === 'filtered') {
        dataToExport = getCurrentlyFilteredData();
        suggestedFilename = `astro-valley-filtered-properties-${timestamp}.csv`;

        // Validate filtered data exists
        if (dataToExport.length === 0) {
            alert("No filtered data to export!");
            handleExportModalClose();
            return;
        }
    } else {
        // Export all records
        dataToExport = masterPropertyList;
        suggestedFilename = `astro-valley-all-properties-${timestamp}.csv`;
    }

    // 3. Trigger the download with suggested filename
    downloadCSV(dataToExport, suggestedFilename);

    // 4. Close the modal
    handleExportModalClose();
}

/**
 * Splits data into Sold vs Active and renders them
 */
function processAndDisplayResults(properties) {
    // 1. Show UI elements now that we have data
    if (filtersStep) filtersStep.style.display = 'block';
    if (marketCalculator) marketCalculator.style.display = 'block';

    clearBtn.style.display = 'block';
    exportBtn.style.display = 'block';

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

    // --- NEW: 5. SORT the filtered lists before displaying ---
    const sortedSold = sortProperties(soldFiltered);
    const sortedActive = sortProperties(activeFiltered);

    // 5. Update Tables, Headers, and Render Cards (Using SORTED data now)
    updateSummaryContainer('summarySold', sortedSold, soldTotal.length);
    updateSummaryContainer('summaryActive', sortedActive, activeTotal.length);
    updateSummaryHeader('summaryCountSold', sortedSold.length, soldTotal.length);
    updateSummaryHeader('summaryCountActive', sortedActive.length, activeTotal.length);

    // Render each bucket (Using SORTED data now)
    renderBucket('resultsBodySold', sortedSold);
    renderBucket('resultsBodyActive', sortedActive);

    // 6. Refresh Valuation Logic
    updateSuggestedPPA(sortedSold, sortedActive); // Use sorted lists for consistency
    calculateFinalValue();

    // 7. Clear status messages
    initialMessage.style.display = 'none';
    statusMessageSold.style.display = 'none';
    statusMessageActive.style.display = 'none';
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
    if (!calcPPAInput) return;

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
        calcPPAInput.value = Math.round(lowestPPA);
    } else {
        calcPPAInput.value = "";
        if (calcValueOutput) calcValueOutput.style.display = 'none';
    }
}

/**
 * Multiplies the Price Per Acre by the Target Acreage to show the Final Value.
 */
function calculateFinalValue() {
    if (!calcPPAInput || !calcAcresInput || !calcValueOutput) return;

    const ppa = parseFloat(calcPPAInput.value) || 0;
    const acres = parseFloat(calcAcresInput.value) || 0;

    if (acres <= 0) {
        calcValueOutput.innerText = '$0.00';
        return;
    }

    const totalValue = ppa * acres;
    calcValueOutput.style.display = 'block';
    calcValueOutput.innerText = `$${Math.round(totalValue).toLocaleString()}`;
}

/**
 * Deletes a property from the master list and re-renders the UI.
 */
function deleteProperty(id) {
    // 1. Remove from the master list
    masterPropertyList = masterPropertyList.filter(p => p.id !== id);

    // 2. Delete records from localStorage to ensure persistence across sessions
    saveToLocalStorage();

    // 3. Re-run the display logic (this updates counts, stats, and market value)
    processAndDisplayResults();
}

/**
 * Sorts a list of properties based on the selected field and direction.
 */
function sortProperties(list) {
    const sortValue = unifiedSort.value;
    if (sortValue === 'none:asc') return [...list];

    // Split "price:desc" into field="price" and direction="desc"
    const [field, direction] = sortValue.split(':');

    return [...list].sort((a, b) => {
        let valA = a[field];
        let valB = b[field];

        // Date Logic (Status String)
        if (field === 'status') {
            const dateA = new Date(valA.replace(/Sold\s*-\s*/i, ''));
            const dateB = new Date(valB.replace(/Sold\s*-\s*/i, ''));
            valA = isNaN(dateA) ? 0 : dateA.getTime();
            valB = isNaN(dateB) ? 0 : dateB.getTime();
        }

        if (typeof valA === 'string') {
            return direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }

        return direction === 'asc' ? valA - valB : valB - valA;
    });
}


function saveToLocalStorage() {
    try {
        localStorage.setItem('propertyData', JSON.stringify(masterPropertyList));
        console.log('[Storage] Data saved successfully.');
    } catch (e) {
        console.error('[Storage] Error saving to localStorage:', e);
    }
}


function loadFromLocalStorage() {
    const savedData = localStorage.getItem('propertyData');
    if (savedData) {
        try {
            masterPropertyList = JSON.parse(savedData);
            console.log(`[Storage] Loaded ${masterPropertyList.length} properties.`);
            
            // Re-run the entire display logic to fill the UI
            if (masterPropertyList.length > 0) {
                processAndDisplayResults();
            }
        } catch (e) {
            console.error('[Storage] Error parsing saved data:', e);
            masterPropertyList = [];
        }
    }
}

/**
 * Converts the current property data into CSV format and triggers a download.
 */
function downloadCSV(data, filename) {
    if (data.length === 0) return alert("No data to export!");

    // 1. Define Headers
    const headers = ["Source", "Status", "Address", "Price", "Sold Date", "Acres", "Price/Acre", "URL"];

    // 2. Helper function to extract source from URL
    const getSource = (url) => {
        if (!url) return "Unknown";
        try {
            const hostname = new URL(url).hostname;
            if (hostname.includes('homes.com')) return 'Homes.com';
            if (hostname.includes('realtor.com')) return 'Realtor.com';
            if (hostname.includes('zillow.com')) return 'Zillow.com';
            return hostname;
        } catch {
            return "Unknown";
        }
    };

    // 3. Helper function to extract sold date from status
    const extractSoldDate = (status) => {
        if (!status) return "";

        // Match MM/DD/YYYY or M/D/YYYY (e.g., "Sold - 4/25/2025")
        let dateMatch = status.match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
        if (dateMatch) return dateMatch[1];

        // Match MM/DD/YY or M/D/YY (e.g., "Sold 01/16/26")
        dateMatch = status.match(/(\d{1,2}\/\d{1,2}\/\d{2})\b/);
        if (dateMatch) {
            // Convert 2-digit year to 4-digit year
            const [month, day, year] = dateMatch[1].split('/');
            const fullYear = parseInt(year) < 50 ? `20${year}` : `19${year}`;
            return `${month}/${day}/${fullYear}`;
        }

        // Match text month format (e.g., "SOLD APR 25, 2025")
        dateMatch = status.match(/([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})/);
        if (dateMatch) {
            const monthNames = {
                'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04', 'may': '05', 'jun': '06',
                'jul': '07', 'aug': '08', 'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12',
                'january': '01', 'february': '02', 'march': '03', 'april': '04',
                'june': '06', 'july': '07', 'august': '08', 'september': '09',
                'october': '10', 'november': '11', 'december': '12'
            };
            const monthNum = monthNames[dateMatch[1].toLowerCase()] || '00';
            const day = dateMatch[2].padStart(2, '0');
            const year = dateMatch[3];
            return `${monthNum}/${day}/${year}`;
        }

        return "";
    };

    // 4. Helper function to determine status (Sold, Active, Pending, etc.)
    const getStatus = (status) => {
        if (!status) return "Active";
        if (status.toLowerCase().includes('sold')) return "Sold";
        if (status.toLowerCase().includes('pending')) return "Pending";
        return status.split('-')[0].trim(); // Return first part before any dash
    };

    // 5. Map data to rows
    const rows = data.map(p => [
        getSource(p.url),
        getStatus(p.status),
        `"${p.address || 'N/A'}"`, // Quote strings to handle commas in addresses
        p.price || 0,
        extractSoldDate(p.status),
        p.acreageValue || 0,
        `$${(p.price / p.acreageValue).toFixed(0).toLocaleString()}`,
        p.url || ""
    ]);

    // 6. Construct CSV String
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");

    // 7. Create Download Link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

/**
 * Initialization & Listeners
 */
document.addEventListener('DOMContentLoaded', () => {
    // 1. CACHE DOM REFERENCES FIRST
    initializeDOMReferences();

    // 2. LOAD SAVED DATA
    loadFromLocalStorage();

    // 3. INITIALIZE EVENT LISTENERS
    addButtonListener();
    addCheckboxListener();
    initializeInputs();
    initializeFilters();
    initializeMarketValue();
    initializeListingSorting();

    // Expand/Collapse Logic for Steps (Retained)
    document.querySelectorAll('.astro-step-header').forEach(header => {
        header.addEventListener('click', () => header.closest('.astro-step').classList.toggle('collapsed'));
    });   
});

function addButtonListener() {    
    // Set up core button listeners
    analyzeBtn.addEventListener('click', handleAnalyzeClick);
    clearBtn.addEventListener('click', handleClearClick);

    // Export Modal Buttons       
    exportBtn.addEventListener('click', handleExportClick);
    document.getElementById('closeModalBtn').addEventListener('click', handleExportModalClose);
    document.getElementById('exportFinalBtn').addEventListener('click', exportToCsv);

    // Analyze Button State Management
    updateAnalyzeButtonState();
    chrome.tabs.onUpdated.addListener((id, change) => { if (change.url || change.status === 'complete') updateAnalyzeButtonState(); });
    chrome.tabs.onActivated.addListener(updateAnalyzeButtonState);

    // Handle clicks on delete buttons using event delegation
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('delete-card-btn')) {
            const propertyId = e.target.getAttribute('data-id');
            deleteProperty(propertyId);
        }
    });
}

function addCheckboxListener() {
    
    // Listen for changes in the Sold/Active checkboxes to update the Suggested PPA and final value
    const soldCheck = document.getElementById('includeSoldCheckbox');
    const activeCheck = document.getElementById('includeActiveCheckbox');

    if (soldCheck) soldCheck.addEventListener('change', () => {processAndDisplayResults();});
    if (activeCheck) activeCheck.addEventListener('change', () => {processAndDisplayResults();});
}

function initializeInputs() {
    document.querySelectorAll('input[type="number"]').forEach(input => {
        
        // Format to 2 decimal places on blur
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

    // Listen for changes in filter inputs to update results in real-time
    const minInput = document.getElementById('minAcreage');
    const maxInput = document.getElementById('maxAcreage');

    if (minInput && maxInput) {
        minInput.addEventListener('input', processAndDisplayResults);
        maxInput.addEventListener('input', processAndDisplayResults);
    }
}

function initializeMarketValue() {   
    // Listen for changes in the Market Calculator inputs to update the final value
    if (calcAcresInput) calcAcresInput.addEventListener('input', calculateFinalValue);
    if (calcPPAInput) calcPPAInput.addEventListener('input', calculateFinalValue);
}

function initializeListingSorting() {
    // Sorting for tables
    unifiedSort.addEventListener('change', () => {
        // Update the visible label to match the chosen option text
        currentSortDisplay.innerText = unifiedSort.options[unifiedSort.selectedIndex].text;

        // Call your existing processing logic
        processAndDisplayResults();
    });
}

function initializeFilters() {
    // Listen for changes in filter inputs to update results in real-time
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
}

        