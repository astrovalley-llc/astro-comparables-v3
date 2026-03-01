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

            const rawPrice = this.getElementText(card, this.config.priceSelector);
            const rawAcreage = this.getElementText(card, this.config.acreageSelector);

            results.push({
                id: crypto.randomUUID(),
                address: this.getElementText(card, this.config.addressSelector),
                price: this.parsePrice(rawPrice),
                acreage: this.parseAcreage(rawAcreage),
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
        let clean = priceStr.replace(/[$,\s]/g, '').toLowerCase();
        if (clean.includes('k')) return parseFloat(clean) * 1000;
        if (clean.includes('m')) return parseFloat(clean) * 1000000;
        return parseFloat(clean) || 0;
    }

    /**
     * Converts "0.5 acres" or "21,780 sqft" into a decimal acre value
     */
    parseAcreage(text) {
        if (!text) return 0;
        // This regex looks for a number followed by 'acre' or 'sqft'
        const match = text.match(/([\d,.]+)\s*(acre|sq\s*ft)/i);
        if (!match) return 0;

        let value = parseFloat(match[1].replace(/,/g, ''));
        const unit = match[2].toLowerCase();

        // Convert sqft to acres if necessary
        if (unit.includes('sq')) {
            return value / 43560;
        }
        return value;
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