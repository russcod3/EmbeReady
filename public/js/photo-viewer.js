import { escapeHtml } from './utils.js';
import { getLanguage } from '../strings.js';
import { photoCaptionMarkup } from './hazard-photo-credits.js';

const copy = () => getLanguage() === 'tl' ? {
    expand: 'Palakihin ang larawan', close: 'Isara ang larawan', in: 'I-zoom in', out: 'I-zoom out',
    fit: 'Ikasya', help: 'Mag-scroll o mag-pinch para mag-zoom · I-drag para igalaw · Esc para isara',
    loading: 'Binubuksan ang larawan…', error: 'Hindi mabuksan ang larawan.', photo: 'Larawan ng panganib'
} : {
    expand: 'Expand photo', close: 'Close photo', in: 'Zoom in', out: 'Zoom out',
    fit: 'Fit', help: 'Scroll or pinch to zoom · Drag to move · Esc to close',
    loading: 'Loading photo…', error: 'This photo could not be loaded.', photo: 'Hazard photo'
};

export const expandPhotoIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M3 3l6 6m12-6-6 6M3 21l6-6m12 6-6-6"/></svg>';

export function expandPhotoButton(title) {
    const text = copy().expand;
    return `<button type="button" class="hazard-photo-expand" aria-label="${escapeHtml(text + ': ' + title)}" title="${escapeHtml(text)}">${expandPhotoIcon}<span>${escapeHtml(text)}</span></button>`;
}

// Translation and pan limits depend on the fitted image, not the whole stage.
export function boundedPhotoTransform(zoom, x, y, imageWidth, imageHeight, stageWidth, stageHeight) {
    const scale = Math.max(1, Math.min(5, Number.isFinite(zoom) ? zoom : 1));
    const maxX = Math.max(0, (imageWidth * scale - stageWidth) / 2);
    const maxY = Math.max(0, (imageHeight * scale - stageHeight) / 2);
    return { zoom: scale, x: Math.max(-maxX, Math.min(maxX, x)), y: Math.max(-maxY, Math.min(maxY, y)) };
}

let viewer;
export function openPhotoViewer({ src, title, reference, trigger }) {
    if (typeof src !== 'string' || !/^\/uploads\/(seed|user)\/[a-zA-Z0-9._/-]+$/.test(src) || src.includes('..')) return;
    if (!viewer) viewer = createPhotoViewer();
    viewer.open({ src, title, reference, trigger });
}

function createPhotoViewer() {
    const dialog = document.createElement('dialog');
    dialog.className = 'photo-viewer';
    dialog.setAttribute('aria-labelledby', 'photo-viewer-title');
    dialog.innerHTML = `<header class="photo-viewer-header"><h2 id="photo-viewer-title"></h2><div class="photo-viewer-tools"><button type="button" data-photo-action="out">−</button><output class="photo-viewer-scale" aria-live="polite">100%</output><button type="button" data-photo-action="in">+</button><button type="button" data-photo-action="fit"></button><button type="button" class="photo-viewer-close" data-photo-action="close">×</button></div></header><div class="photo-viewer-stage" tabindex="0"><img class="photo-viewer-image" draggable="false" alt=""><p class="photo-viewer-status" role="status"></p></div><footer class="photo-viewer-footer"><p class="photo-viewer-help"></p><div class="photo-viewer-credit"></div></footer>`;
    document.body.append(dialog);
    const stage = dialog.querySelector('.photo-viewer-stage'), image = dialog.querySelector('img');
    const status = dialog.querySelector('.photo-viewer-status'), output = dialog.querySelector('output');
    const buttons = Object.fromEntries([...dialog.querySelectorAll('[data-photo-action]')].map(b => [b.dataset.photoAction, b]));
    let zoom=1, x=0, y=0, width=0, height=0, returnFocus, previousOverflow, loaded=false, pinch;
    const pointers = new Map();
    const draw = () => {
        ({ zoom, x, y } = boundedPhotoTransform(zoom,x,y,width,height,stage.clientWidth,stage.clientHeight));
        image.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px) scale(${zoom})`;
        output.textContent = `${Math.round(zoom*100)}%`;
        buttons.out.disabled = !loaded || zoom <= 1;
        buttons.in.disabled = !loaded || zoom >= 5;
        buttons.fit.disabled = !loaded;
        stage.classList.toggle('is-zoomed', zoom > 1);
    };
    const fit = () => {
        if (!loaded || !stage.clientWidth || !stage.clientHeight) return;
        const scale = Math.min(stage.clientWidth/image.naturalWidth,stage.clientHeight/image.naturalHeight,1);
        width=image.naturalWidth*scale; height=image.naturalHeight*scale;
        image.style.width=`${width}px`; image.style.height=`${height}px`; draw();
    };
    const setZoom = (next, cx=0, cy=0) => {
        if (!loaded) return;
        next=Math.max(1,Math.min(5,next));
        x=cx-(cx-x)*next/zoom; y=cy-(cy-y)*next/zoom; zoom=next; draw();
    };
    const reset = () => { zoom=1; x=0; y=0; fit(); };
    const close = () => { if(dialog.open) dialog.close(); };
    image.addEventListener('load', () => { loaded=true; image.hidden=false; status.hidden=true; reset(); });
    image.addEventListener('error', () => { loaded=false; image.hidden=true; status.hidden=false; status.textContent=copy().error; draw(); });
    buttons.in.addEventListener('click', () => setZoom(zoom*1.5));
    buttons.out.addEventListener('click', () => setZoom(zoom/1.5));
    buttons.fit.addEventListener('click', reset);
    buttons.close.addEventListener('click', close);
    dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
    dialog.addEventListener('click', event => { if(event.target===dialog) close(); });
    dialog.addEventListener('close', () => {
        pointers.clear(); pinch=null; stage.classList.remove('is-dragging');
        document.body.style.overflow=previousOverflow;
        image.removeAttribute('src'); loaded=false;
        if(returnFocus?.isConnected) returnFocus.focus({preventScroll:true});
    });
    dialog.addEventListener('keydown', event => {
        if(['+','=','-','0','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)) {
            event.preventDefault();
            if(event.key==='+' || event.key==='=') setZoom(zoom*1.5);
            else if(event.key==='-') setZoom(zoom/1.5);
            else if(event.key==='0') reset();
            else { x+=event.key==='ArrowLeft'?60:event.key==='ArrowRight'?-60:0; y+=event.key==='ArrowUp'?60:event.key==='ArrowDown'?-60:0; draw(); }
        }
    });
    stage.addEventListener('wheel', event => {
        event.preventDefault(); const rect=stage.getBoundingClientRect();
        setZoom(zoom*Math.exp(-Math.max(-100,Math.min(100,event.deltaY))*0.005),event.clientX-rect.left-rect.width/2,event.clientY-rect.top-rect.height/2);
    }, {passive:false});
    stage.addEventListener('dblclick', event => {
        const rect=stage.getBoundingClientRect();
        setZoom(zoom>1?1:2.5,event.clientX-rect.left-rect.width/2,event.clientY-rect.top-rect.height/2);
    });
    const distance = () => { const [a,b]=[...pointers.values()]; return Math.hypot(a.x-b.x,a.y-b.y); };
    stage.addEventListener('pointerdown', event => {
        if(!loaded || (event.pointerType==='mouse' && event.button!==0)) return;
        pointers.set(event.pointerId,{x:event.clientX,y:event.clientY}); stage.setPointerCapture(event.pointerId);
        stage.classList.toggle('is-dragging',zoom>1);
        if(pointers.size===2) pinch={distance:distance(),zoom};
    });
    stage.addEventListener('pointermove', event => {
        const previous=pointers.get(event.pointerId); if(!previous) return;
        pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
        if(pointers.size===2 && pinch?.distance) {
            const [a,b]=[...pointers.values()],rect=stage.getBoundingClientRect();
            setZoom(pinch.zoom*distance()/pinch.distance,(a.x+b.x)/2-rect.left-rect.width/2,(a.y+b.y)/2-rect.top-rect.height/2);
        } else if(pointers.size===1 && zoom>1) { x+=event.clientX-previous.x; y+=event.clientY-previous.y; draw(); }
    });
    const release = event => { pointers.delete(event.pointerId); pinch=null; if(!pointers.size) stage.classList.remove('is-dragging'); };
    stage.addEventListener('pointerup',release); stage.addEventListener('pointercancel',release); stage.addEventListener('lostpointercapture',release);
    new ResizeObserver(fit).observe(stage);
    return { open({src,title,reference,trigger}) {
        const text=copy(); returnFocus=trigger || document.activeElement;
        if(!dialog.open) previousOverflow=document.body.style.overflow;
        zoom=1; x=0; y=0; loaded=false; pointers.clear(); pinch=null;
        dialog.querySelector('h2').textContent=title || text.photo;
        image.alt=title || text.photo; image.hidden=true;
        status.hidden=false; status.textContent=text.loading;
        dialog.querySelector('.photo-viewer-help').textContent=text.help;
        dialog.querySelector('.photo-viewer-credit').innerHTML=photoCaptionMarkup(src,reference);
        for(const action of ['in','out','fit','close']) buttons[action].setAttribute('aria-label',text[action]);
        buttons.fit.textContent=text.fit;
        if(!dialog.open) dialog.showModal();
        document.body.style.overflow='hidden'; image.src=src; draw(); buttons.close.focus();
    } };
}
