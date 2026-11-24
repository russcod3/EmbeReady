import S, { getLanguage, setLanguage } from '../strings.js';

const valueAt = key => key.split('.').reduce((value, part) => value?.[part], S);

export function applyTranslations(root = document) {
    for (const attribute of ['text', 'placeholder', 'aria-label', 'title']) {
        const dataAttribute = attribute === 'text' ? 'data-i18n' : `data-i18n-${attribute}`;
        root.querySelectorAll(`[${dataAttribute}]`).forEach(element => {
            const text = valueAt(element.getAttribute(dataAttribute));
            if (typeof text !== 'string') return;
            if (attribute === 'text') element.textContent = getLanguage() === 'en' && element.hasAttribute('data-i18n-en') ? element.getAttribute('data-i18n-en') : text;
            else element.setAttribute(attribute, text);
        });
    }
}

export function initLanguageControls() {
    document.querySelectorAll('[data-language]').forEach(button => {
        button.addEventListener('click', () => setLanguage(button.dataset.language));
    });
    const update = () => {
        document.documentElement.lang = getLanguage();
        document.querySelectorAll('[data-language]').forEach(button => {
            button.setAttribute('aria-pressed', String(button.dataset.language === getLanguage()));
        });
        applyTranslations();
    };
    window.addEventListener('language:changed', update);
    update();
}
