// Shaded raster cutouts in a 2D SVG rig. No vector redraw of Ember's face.
export const EMBER_STATES = ['idle', 'greeting', 'walking', 'thinking', 'success'];
const ATLAS = new URL('../images/ember-texture-atlas.png', import.meta.url).href;
const ORIGINAL = new URL('../images/embeready-mascot.png', import.meta.url).href;

// Tight source rectangles exclude other cells and keep their transparent edges.
export const EMBER_PARTS = Object.freeze({
    head: [40, 24, 468, 480],
    torso: [564, 64, 414, 428],
    tail: [1125, 14, 328, 490],
    armLeft: [122, 532, 266, 468],
    armRight: [580, 538, 386, 390],
    leg: [1113, 542, 326, 450]
});

export function createEmberPuppet(className = '') {
    const host = document.createElement('span');
    host.className = `ember-puppet ember-textured ${className}`;
    host.dataset.pose = 'idle';
    host.setAttribute('aria-hidden', 'true');
    const sprite = (part, x, y, width, height) => {
        const source = EMBER_PARTS[part].join(' ');
        return `<svg x="${x}" y="${y}" width="${width}" height="${height}" viewBox="${source}" preserveAspectRatio="xMidYMid meet" overflow="hidden"><image href="${ATLAS}" xlink:href="${ATLAS}" width="1536" height="1024"/></svg>`;
    };
    const joint = (name, x, y, artwork) => `<g transform="translate(${x} ${y})"><g class="ember-${name}">${artwork}</g></g>`;
    host.innerHTML = `<svg viewBox="0 0 300 360" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" focusable="false" aria-hidden="true">
      <g class="ember-rig">
        ${joint('tail', 120, 296, sprite('tail', -88, -142, 94, 140))}
        ${joint('leg ember-leg-left', 129, 289, sprite('leg', -41, -14, 64, 82))}
        ${joint('leg ember-leg-right', 211, 289, sprite('leg', -23, -14, 64, 82))}
        <g class="ember-torso">${sprite('torso', 109, 202, 130, 135)}</g>
        ${joint('arm ember-arm-left', 128, 234, sprite('armLeft', -26, -10, 51, 92))}
        ${joint('arm ember-arm-right', 222, 239, sprite('armRight', -7, -74, 78, 79))}
        ${joint('head', 168, 218, sprite('head', -106, -218, 220, 226))}
      </g>
    </svg>`;
    // A broken atlas should display the original, never disassembled blank parts.
    const check = new Image();
    check.addEventListener('error', () => {
        const fallback = document.createElement('img');
        fallback.src = ORIGINAL;
        fallback.alt = '';
        fallback.className = 'ember-original-fallback';
        host.replaceChildren(fallback);
    }, { once: true });
    check.src = ATLAS;
    return host;
}
