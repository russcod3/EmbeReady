// The same artwork is used by map markers, filter buttons, and the legend.
const SYMBOLS = Object.freeze({
    heavy: '<path d="m12 4 9 16H3Z" fill="currentColor" stroke="none"/>',
    moderate: '<path d="m12 3 9 9-9 9-9-9Z" fill="currentColor" stroke="none"/>',
    low: '<circle cx="12" cy="12" r="5" fill="currentColor" stroke="none"/>',
    active: '<path class="fire-streak-outer" d="M13 1c2 5-1 6 2 9 1-1 2-3 1-5 4 4 6 7 5 11a9 9 0 0 1-18-2c0-4 3-7 6-9-1 4 0 5 1 6-1-5 4-6 3-10Z" fill="#ff5a24" stroke="none"/><path class="fire-streak-core" d="M12 10c2 3 5 4 4 7a4 4 0 0 1-8 0c0-2 2-4 4-7Z" fill="#ffe66e" stroke="none"/><path class="fire-streak-spark" d="m4 2 1 3M20 1l-1 3" stroke="#ffbf57"/>',
    hydrant: '<path d="M9 8h6v12H9zM8 20h8M9 5h6l1 3H8l1-3ZM12 3v2M5 11h4m6 0h4M5 9v5m14-5v5M9 16h6"/>',
    hospital: '<path d="M9 4h6v5h5v6h-5v5H9v-5H4V9h5Z" fill="currentColor" stroke="none"/>',
    firestation: '<path d="M2 9h12v9H2zM14 11h4l4 4v3h-8Z" fill="currentColor" stroke="none"/><path d="M16 12h2l2 3h-4Z" fill="#dc2626" stroke="none"/><path d="M3 6h12M5 4v4m4-4v4m4-4v4M5 12h6m-6 3h6" stroke="currentColor"/><circle cx="6" cy="18" r="2.7" fill="#26313b" stroke="#fff" stroke-width="1.2"/><circle cx="18" cy="18" r="2.7" fill="#26313b" stroke="#fff" stroke-width="1.2"/><path d="M15 9h3" stroke="#ffdf5e" stroke-width="2.5"/>',
    pending: '<circle cx="12" cy="12" r="8" stroke-dasharray="2 3"/><path d="M12 7v5l3 2"/>'
});

export function mapSymbolMarkup(type) {
    const key = Object.hasOwn(SYMBOLS, type) ? type : 'moderate';
    return `<span class="map-symbol map-symbol--${key}" data-symbol="${key}" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" focusable="false">${SYMBOLS[key]}</svg></span>`;
}

export function initMapSymbols() {
    document.querySelectorAll('[data-map-symbol]').forEach(host => {
        host.innerHTML = mapSymbolMarkup(host.dataset.mapSymbol);
    });
}
