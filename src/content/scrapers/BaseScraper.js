// Shared scraper logic for all real estate sites
export class BaseScraper {
    constructor(config) {
        this.config = config;
    }

    /**
     * Core scraping loop.
     * Iterates over cards and extracts data based on the config provided by the child class.
     */
    scrape() {
        const cards = document.querySelectorAll(this.config.cardSelector);
        console.log(`[BaseScraper] Found ${cards.length} property cards.`);

        const results = [];

        cards.forEach(card => {
            // First, get the status to check for rentals
            const status = this.getElementStatus(card, this.config.statusSelector);

            // If the status was flagged as a rental, skip this card entirely
            if (status === 'SKIP_RENTAL') {
                console.log("[BaseScraper] Skipping rental property.");
                return; // Move to the next card
            }

            // Extract the raw text first so we can check them
            const rawPrice = this.getElementText(card, this.config.priceSelector);
            const rawAcreage = this.getElementText(card, this.config.acreageSelector);

            // SKIP LOGIC: If either is missing or empty, exit the loop for this card
            if (!rawPrice || !rawAcreage) {
                console.log("[BaseScraper] Skipping card: Missing price or acreage text.");
                return; 
            }

            // Now it is safe to parse because we know the strings exist
            const price = this.parsePrice(rawPrice);
            const acreageString = this.parseAcreage(rawAcreage);

            // SECONDARY SKIP: If parsing resulted in 0 (meaning no numbers found)
            if (price === 0 || acreageString === "0.00 Acres") {
                console.log("[BaseScraper] Skipping card: Price or Acreage parsed as zero.");
                return;
            }

            // store a numeric acreageValue
            const numericAcreage = acreageString.includes('sqft') 
                ? parseFloat(acreageString.replace(/,/g, '')) / 43560 
                : parseFloat(acreageString);


            results.push({
                id: crypto.randomUUID(),
                address: this.getElementText(card, this.config.addressSelector),
                price: price,
                acreage: this.parseAcreage(rawAcreage),
                acreageValue: numericAcreage,
                rawPrice: rawPrice,
                rawAcreage: rawAcreage,
                status: status,
                url: this.getHref(card, this.config.linkSelector)
            });
        });

        return results;
    }

    // --- Helper Utilities ---


    getElementText(parent, selector) {
        if (!selector) return "";
        const el = parent.querySelector(selector);
        return el ? el.innerText.trim() : "";
    }

    /**
     * Extracts the href from a link element. 
     * If the selector is missing or the element doesn't exist, it returns an empty string.
     */
    getHref(parent, selector) {
        if (!selector) return "";
        const el = parent.querySelector(selector);
        return el ? el.href : "";
    }

    /**
     * Converts "$450,000" or "$450k" into 450000
     */
    parsePrice(priceStr) {
        if (!priceStr) return 0;

        // 1. Extract only the first sequence of numbers/dots/letters (like 60k or 1.2m) 
        // that immediately follows a '$'. This ignores any per-acre prices later in the text.
        const match = priceStr.match(/\$([\d,.]+[km]?)/i);
        if (!match) return 0;

        // 2. Clean the matched string (e.g., "60,000" or "1.5M")
        let clean = match[1].replace(/[,\s]/g, '').toLowerCase();

        // 3. Apply your existing K/M multiplier logic
        if (clean.includes('k')) return parseFloat(clean) * 1000;
        if (clean.includes('m')) return parseFloat(clean) * 1000000;
    
        return parseFloat(clean) || 0;
    }

    /**
     * Converts "0.5 acres" or "21,780 sqft" into a decimal acre value
     */
    parseAcreage(text) {
        if (!text) return "0.00 Acres";

        // 1. Extract the number and the unit (Acre or Sqft)
        const match = text.match(/([\d,.]+)\s*(acre|sq\s*ft|sqft)/i);
        if (!match) return "0.00 Acres";

        // 2. Clean the numeric value for potential math (if needed elsewhere)
        let value = parseFloat(match[1].replace(/,/g, ''));
        const unit = match[2].toLowerCase();

        // 3. Return the formatted string based on what was found
        if (unit.includes('sq')) {
            return `${value.toLocaleString()} sqft`;
        }
    
        return `${value.toFixed(2)} Acres`;
    }

    /**
     * Determines the status of a property card by checking specific selectors.
     * If any status text contains "rent", it flags the card to be skipped.
     * Otherwise, it prioritizes badges (like "Sold") and falls back to the longest text found.
     * This method is designed to be flexible across different site structures while ensuring rentals are consistently filtered out.
     * */
    getElementStatus(card, selector) {
        if (!selector) return '';

        const elements = card.querySelectorAll(selector);
        if (elements.length === 0) return '';

        let bestMatch = '';

        for (let el of elements) {
            const text = el.innerText.trim();
            const lowerText = text.toLowerCase();

            // --- RENTAL FILTER ---
            // If the status contains "rent", we flag this property to be skipped.
            if (lowerText.includes('rent')) {
                return 'SKIP_RENTAL';
            }

            // Logic for Zillow Badge (Priority)
            if (el.getAttribute('data-c11n-component') === 'PropertyCard.Badge') {
                return text; 
            }

            // Fallback: Longest string (usually contains the date)
            if (text.length > bestMatch.length) {
                bestMatch = text;
            }
        }

        return bestMatch || '';
    }

} 