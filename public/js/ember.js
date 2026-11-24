import { createEmberPuppet } from './ember-puppet.js';
import { getMapInstance } from './map.js';
import S from '../strings.js';

const hud = document.querySelector('.explore-hud');
if (hud) {
    document.querySelectorAll('img.ember-brand').forEach(image => image.replaceWith(createEmberPuppet('ember-brand')));
    for (const heading of document.querySelectorAll('.report-heading, .modal-title')) heading.prepend(createEmberPuppet('ember-brand'));
    const companion = document.createElement('section');
    companion.className = 'ember-companion';
    companion.setAttribute('aria-label', 'Ember, your map companion');
    companion.innerHTML = `<div class="ember-companion-main">
      <button type="button" class="ember-pet" aria-label="Wave hello to Ember" data-i18n-aria-label="ember.wave"></button>
      <div><strong data-i18n="ember.greeting">Hi, I’m Ember.</strong><p class="ember-message">Tap a map marker to explore its report and safety guidance.</p></div>
    </div>
    <button type="button" class="ember-motion-toggle" aria-pressed="false" aria-label="Pause mascot motion" title="Pause mascot motion"></button>`;
    const pet = companion.querySelector('.ember-pet');
    pet.append(createEmberPuppet());
    hud.append(companion);
    const message = companion.querySelector('.ember-message');
    const toggle = companion.querySelector('.ember-motion-toggle');
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const submit = document.getElementById('report-submit-btn');
    const confirmation = document.getElementById('report-modal');
    let userPaused = false, mapMoving = false, temporaryState = 'idle', resetTimer;
    function updateMotion() {
        document.documentElement.dataset.emberMotion = userPaused || reduced.matches || document.hidden ? 'paused' : 'playing';
        toggle.setAttribute('aria-pressed', String(userPaused || reduced.matches));
        const label = reduced.matches ? S.ember.paused : userPaused ? S.ember.resume : S.ember.pause;
        toggle.setAttribute('aria-label', label);
        toggle.title = label;
        toggle.innerHTML = `<svg viewBox="0 0 20 20" width="14" height="14" fill="currentColor" aria-hidden="true">${userPaused || reduced.matches ? '<path d="m6 3 11 7-11 7Z"/>' : '<rect x="5" y="3" width="3" height="14" rx="1"/><rect x="12" y="3" width="3" height="14" rx="1"/>'}</svg>`;
        toggle.disabled = reduced.matches;
    }
    function renderState() {
        // Report feedback takes priority; walking follows map movement only.
        const success = confirmation?.classList.contains('is-visible') && confirmation.dataset.state === 'saved';
        const thinking = submit?.disabled;
        const pose = success ? 'success' : thinking ? 'thinking' : mapMoving ? 'walking' : temporaryState;
        document.querySelectorAll('.ember-puppet:not(.welcome-puppet)').forEach(p => { p.dataset.pose = pose; });
        message.textContent = success ? S.ember.saved : thinking ? S.ember.thinking : pose === 'greeting' ? S.ember.hello : pose === 'walking' ? S.ember.walking : S.ember.idle;
    }
    function play(pose) {
        clearTimeout(resetTimer); temporaryState = pose; renderState();
        resetTimer = setTimeout(() => { temporaryState = 'idle'; renderState(); }, 2800);
    }
    pet.addEventListener('click', () => play('greeting'));
    function connectMapMotion() {
        const map = getMapInstance();
        if (!map) return;
        map.on('movestart', () => {
            clearTimeout(resetTimer);
            temporaryState = 'idle';
            mapMoving = true;
            renderState();
        });
        map.on('moveend', () => { mapMoving = false; renderState(); });
    }
    if (getMapInstance()) connectMapMotion();
    else document.addEventListener('DOMContentLoaded', connectMapMotion, { once: true });
    toggle.addEventListener('click', () => { userPaused = !userPaused; updateMotion(); });
    reduced.addEventListener('change', updateMotion);
    document.addEventListener('visibilitychange', updateMotion);
    window.addEventListener('language:changed',()=>{updateMotion();renderState();});
    if (submit) new MutationObserver(renderState).observe(submit, { attributes: true, attributeFilter: ['disabled'] });
    if (confirmation) new MutationObserver(renderState).observe(confirmation, { attributes: true, attributeFilter: ['class','data-state'] });
    updateMotion(); renderState();
}
