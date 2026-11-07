import { createEmberPuppet } from './ember-puppet.js';

const hud = document.querySelector('.explore-hud');
if (hud) {
    document.querySelectorAll('img.ember-brand').forEach(image => image.replaceWith(createEmberPuppet('ember-brand')));
    for (const heading of document.querySelectorAll('.report-heading, .modal-title')) heading.prepend(createEmberPuppet('ember-brand'));
    const companion = document.createElement('section');
    companion.className = 'ember-companion';
    companion.setAttribute('aria-label', 'Ember, your map companion');
    companion.innerHTML = `<div class="ember-companion-main">
      <button type="button" class="ember-pet" aria-label="Wave hello to Ember"></button>
      <div><strong>Hi, I’m Ember.</strong><p class="ember-message">Tap a map marker to explore its report and safety guidance.</p></div>
    </div><div class="ember-actions" role="group" aria-label="Ember animations"><button type="button" data-ember-action="greeting">Wave</button><button type="button" data-ember-action="walking">Walk</button></div>
    <button type="button" class="ember-motion-toggle" aria-pressed="false">Pause mascot motion</button>`;
    const pet = companion.querySelector('.ember-pet');
    pet.append(createEmberPuppet());
    hud.append(companion);
    const message = companion.querySelector('.ember-message');
    const toggle = companion.querySelector('.ember-motion-toggle');
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const submit = document.getElementById('report-submit-btn');
    const confirmation = document.getElementById('report-modal');
    const idleText = 'Tap a map marker to explore its report and safety guidance.';
    let userPaused = false, temporaryState = 'idle', resetTimer;
    function updateMotion() {
        document.documentElement.dataset.emberMotion = userPaused || reduced.matches || document.hidden ? 'paused' : 'playing';
        toggle.setAttribute('aria-pressed', String(userPaused || reduced.matches));
        toggle.textContent = reduced.matches ? 'Motion off · system preference' : userPaused ? 'Resume mascot motion' : 'Pause mascot motion';
        toggle.disabled = reduced.matches;
    }
    function renderState() {
        // Application states take priority over play buttons and pending resets.
        const success = confirmation?.classList.contains('is-visible');
        const thinking = submit?.disabled;
        const pose = success ? 'success' : thinking ? 'thinking' : temporaryState;
        document.querySelectorAll('.ember-puppet').forEach(p => { p.dataset.pose = pose; });
        message.textContent = success ? 'Your report is saved. Contact responders directly if needed.' : thinking ? 'Your report is being assessed.' : pose === 'greeting' ? 'Hello! I’m here to help you explore the map.' : pose === 'walking' ? 'Ready to explore? Choose a barangay or tap a marker.' : idleText;
    }
    function play(pose) {
        clearTimeout(resetTimer); temporaryState = pose; renderState();
        resetTimer = setTimeout(() => { temporaryState = 'idle'; renderState(); }, pose === 'walking' ? 4500 : 2800);
    }
    pet.addEventListener('click', () => play('greeting'));
    companion.querySelectorAll('[data-ember-action]').forEach(b => b.addEventListener('click', () => play(b.dataset.emberAction)));
    toggle.addEventListener('click', () => { userPaused = !userPaused; updateMotion(); });
    reduced.addEventListener('change', updateMotion);
    document.addEventListener('visibilitychange', updateMotion);
    if (submit) new MutationObserver(renderState).observe(submit, { attributes: true, attributeFilter: ['disabled'] });
    if (confirmation) new MutationObserver(renderState).observe(confirmation, { attributes: true, attributeFilter: ['class'] });
    updateMotion(); renderState();
}
