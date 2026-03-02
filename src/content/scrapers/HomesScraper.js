import { BaseScraper } from './BaseScraper.js';

export class HomesScraper extends BaseScraper {
    constructor() {
        super({
            cardSelector: 'li.placard-container',
            priceSelector: '.price-container',
            addressSelector: 'address',
            linkSelector: "a[role='link']",
            acreageSelector: 'ul.detailed-info-container.sqft-container',
            statusSelector: 'span.status-pill.tag-type-sold, span.status-pill.tag-type-pending, span.status-pill.tag-type-under-contract' // Unified name
        });
    }
} 