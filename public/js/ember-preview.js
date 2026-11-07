import { createEmberPuppet, EMBER_STATES } from './ember-puppet.js';
const puppet = createEmberPuppet();
document.getElementById('puppet-stage').append(puppet);
const controls = document.getElementById('pose-controls');
for (const pose of EMBER_STATES) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = { idle: 'Idle', greeting: 'Wave', walking: 'Walk', thinking: 'Think', success: 'Celebrate' }[pose];
    button.setAttribute('aria-pressed', String(pose === 'idle'));
    button.addEventListener('click', () => {
        puppet.dataset.pose = pose;
        controls.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
    });
    controls.append(button);
}
const pause = document.getElementById('pause');
pause.addEventListener('click', () => {
    const paused = puppet.dataset.paused !== 'true';
    puppet.dataset.paused = String(paused);
    pause.setAttribute('aria-pressed', String(paused));
    pause.textContent = paused ? 'Resume motion' : 'Pause motion';
});
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
function syncPreference() {
    pause.disabled = reduced.matches;
    document.getElementById('motion-note').textContent = reduced.matches ? 'Animations are off to respect your reduced-motion preference.' : 'Original-style shaded cutouts: moving arms, legs, head and tail. Both flame tufts stay attached to the head.';
}
reduced.addEventListener('change', syncPreference);
document.addEventListener('visibilitychange', () => { document.documentElement.dataset.emberMotion = document.hidden ? 'paused' : 'playing'; });
syncPreference();
