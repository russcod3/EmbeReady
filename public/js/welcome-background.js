import S from '../strings.js';

// Animate the clean opening frame, rather than replaying baked-in labels.
export function initWelcomeBackground({ pauseLabel, resumeLabel, reducedLabel } = {}) {
    const landing = document.getElementById('view-landing');
    const canvas = document.getElementById('welcome-flow');
    const toggle = document.getElementById('welcome-motion-toggle');
    if (!landing || !canvas || !toggle) return;

    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const compact = matchMedia('(max-width: 1023px)');
    let userPaused = false, render = null, frame = 0;
    let elapsed = 0, lastTime = 0, lastPaint = 0, sizeDirty = true;

    const canAnimate = () => !userPaused && !reduced.matches && !document.hidden && landing.classList.contains('is-active');
    const tick = now => {
        frame = 0;
        if (!canAnimate() || !render) return;
        if (lastTime) elapsed += Math.min(now - lastTime, 100);
        lastTime = now;
        // This gentle backdrop needs only 24 fps on phones/tablets and 30 elsewhere.
        if (sizeDirty || now - lastPaint >= 1000 / (compact.matches ? 24 : 30)) {
            render(elapsed / 1000, sizeDirty);
            sizeDirty = false;
            lastPaint = now;
        }
        frame = requestAnimationFrame(tick);
    };
    const sync = () => {
        cancelAnimationFrame(frame);
        frame = 0;
        lastTime = 0;
        const paused = userPaused || reduced.matches;
        landing.dataset.motion = paused ? 'paused' : 'playing';
        toggle.setAttribute('aria-pressed', String(paused));
        const label = reduced.matches ? reducedLabel || S.ember.paused : paused ? resumeLabel || S.welcome.resumeMotion : pauseLabel || S.welcome.pauseMotion;
        toggle.setAttribute('aria-label', label);
        toggle.title = label;
        toggle.querySelector('.welcome-motion-label').textContent = label;
        toggle.disabled = reduced.matches;
        if (render && landing.classList.contains('is-active') && !document.hidden) {
            render(elapsed / 1000, sizeDirty);
            sizeDirty = false;
            if (canAnimate()) frame = requestAnimationFrame(tick);
        }
    };
    toggle.addEventListener('click', () => { userPaused = !userPaused; sync(); });
    reduced.addEventListener('change', sync);
    document.addEventListener('visibilitychange', sync);
    window.addEventListener('language:changed', sync);
    new MutationObserver(sync).observe(landing, { attributes: true, attributeFilter: ['class'] });
    new ResizeObserver(() => { sizeDirty = true; sync(); }).observe(canvas);
    canvas.addEventListener('webglcontextlost', event => {
        event.preventDefault();
        cancelAnimationFrame(frame);
        render = null;
        canvas.parentElement.classList.remove('is-ready');
    });
    sync();

    const gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' });
    if (!gl) return; // The same local artwork remains visible as a CSS background.
    const shaders = [];
    const shader = (type, source) => {
        const result = gl.createShader(type);
        if (!result) throw new Error('Unable to allocate welcome shader');
        shaders.push(result);
        gl.shaderSource(result, source);
        gl.compileShader(result);
        if (!gl.getShaderParameter(result, gl.COMPILE_STATUS)) throw new Error('Unable to compile welcome shader');
        return result;
    };
    let program, buffer;
    try {
        program = gl.createProgram();
        gl.attachShader(program, shader(gl.VERTEX_SHADER, `
            attribute vec2 position;
            varying vec2 uv;
            void main() { uv = position * .5 + .5; gl_Position = vec4(position, 0., 1.); }
        `));
        gl.attachShader(program, shader(gl.FRAGMENT_SHADER, `
            precision mediump float;
            uniform sampler2D artwork;
            uniform vec2 crop;
            uniform float time;
            varying vec2 uv;
            void main() {
                vec2 p = (vec2(uv.x, 1. - uv.y) - .5) * crop + .5;
                p.x += .013 * sin(p.y * 5. + time * .16) + .007 * sin(p.y * 11. - time * .12);
                p.y += .018 * sin(p.x * 4. + time * .13) + .006 * cos(p.x * 8. - time * .1);
                gl_FragColor = texture2D(artwork, clamp(p, .002, .998));
            }
        `));
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Unable to link welcome shader');
        gl.useProgram(program);
        buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
        const position = gl.getAttribLocation(program, 'position');
        gl.enableVertexAttribArray(position);
        gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
        const time = gl.getUniformLocation(program, 'time');
        const crop = gl.getUniformLocation(program, 'crop');
        gl.uniform1i(gl.getUniformLocation(program, 'artwork'), 0);
        const artwork = new Image();
        artwork.onload = () => {
            if (gl.isContextLost()) return;
            const texture = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, artwork);
            render = (seconds, resize) => {
                if (resize) {
                    // Bound fill cost on high-DPI devices, including tablets.
                    const ratio = Math.min(devicePixelRatio || 1, compact.matches ? 1 : 1.25);
                    canvas.width = Math.max(1, Math.round(canvas.clientWidth * ratio));
                    canvas.height = Math.max(1, Math.round(canvas.clientHeight * ratio));
                    gl.viewport(0, 0, canvas.width, canvas.height);
                    const aspect = canvas.width / canvas.height / (artwork.width / artwork.height);
                    gl.uniform2f(crop, Math.min(aspect, 1), Math.min(1 / aspect, 1));
                }
                gl.uniform1f(time, seconds);
                gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
            };
            canvas.parentElement.classList.add('is-ready');
            sync();
        };
        artwork.src = new URL('../images/welcome/qwen-flow.webp', import.meta.url).href;
    } catch {
        shaders.forEach(item => gl.deleteShader(item));
        if (program) gl.deleteProgram(program);
        if (buffer) gl.deleteBuffer(buffer);
    }
}
