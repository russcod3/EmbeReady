/**
 * public/js/utils.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Shared utility functions used across all EmbeReady frontend modules.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * escapeHtml(str)
 * Escapes HTML special characters to prevent XSS in innerHTML assignments.
 */
export function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * escapeAttr(str)
 * Escapes double quotes for safe use in HTML attribute values.
 */
export function escapeAttr(str) {
    if (!str) return '';
    return String(str).replace(/"/g, '&quot;');
}
