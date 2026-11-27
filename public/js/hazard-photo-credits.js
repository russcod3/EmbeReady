import { escapeHtml } from './utils.js';
import { illustrativePhotos } from './hazard-photo-data.js';

export function photoCaptionMarkup(url, reference) {
    const photo = illustrativePhotos[url];
    if (!photo) return '';
    const heading = photo.userProvided
        ? photo.aiEdited ? 'User-supplied scenario image · AI-edited details' : 'User-supplied scenario image'
        : 'Illustrative composite · AI-added hazard objects';
    const description = photo.userProvided
        ? 'Representative illustration; the location and reported conditions have not been verified.'
        : `Background: ${photo.location}. Representative setting; not photographic evidence of this reported site.`;
    const creditReference = photo.references?.includes(reference) ? reference : photo.reference;
    return `<p class="hazard-photo-credit"><strong>${escapeHtml(heading)}</strong><br>${escapeHtml(description)} <a href="/photo-credits.html#${encodeURIComponent(creditReference)}" target="_blank" rel="noopener">Source and credits ↗</a></p>`;
}
