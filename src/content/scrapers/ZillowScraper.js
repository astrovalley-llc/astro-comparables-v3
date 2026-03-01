import { BaseScraper } from './BaseScraper.js';

export class ZillowScraper extends BaseScraper {
    constructor() {
        super({
            // The main container for each house
            cardSelector: 'article[data-test="property-card"]', 
            
            // Stable data attributes
            priceSelector: '[data-test="property-card-price"]',
            addressSelector: 'address',
            linkSelector: 'a[data-test="property-card-link"]',
            
            // Acreage - using the data-testid provided in your HTML
            acreageSelector: '[data-testid="property-card-details"] li',
            
            // This targets the badge area where "Sold 01/16/26" lives
            // 1. Targets the photo overlay badge
            // 2. Targets the "Sold" span that follows the home details list
            statusSelector: 'span[data-c11n-component="PropertyCard.Badge"], [data-testid="property-card-details"] + span'
        });
    }
} 