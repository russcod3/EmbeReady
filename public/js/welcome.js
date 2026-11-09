import { createEmberPuppet } from './ember-puppet.js';

const stage = document.getElementById('welcome-ember');
if (stage) {
    const puppet = createEmberPuppet('welcome-puppet');
    stage.append(puppet);
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let greetingTimer, idleTimer;
    const greet = () => {
        clearTimeout(greetingTimer); clearTimeout(idleTimer);
        if (reduced.matches || document.hidden) return;
        greetingTimer = setTimeout(() => {
            if (!document.getElementById('view-landing').classList.contains('is-active')) return;
            puppet.dataset.pose = 'greeting';
            idleTimer = setTimeout(() => { puppet.dataset.pose = 'idle'; }, 2600);
        }, 1100);
    };
    // An opening welcome is the one automatic greeting; map greetings stay click-only.
    greet();
    const stop = () => { clearTimeout(greetingTimer); clearTimeout(idleTimer); puppet.dataset.pose = 'idle'; };
    document.getElementById('landing-explore-btn').addEventListener('click', stop);
    reduced.addEventListener('change', () => reduced.matches ? stop() : greet());
    document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
}
