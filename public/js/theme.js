import { eclipseMarkup } from './eclipse-markup.js';
import { getLanguage } from '../strings.js';

export function initTheme() {
    let theme;
    try { theme = localStorage.getItem('embeready-theme'); } catch {}
    const system = matchMedia('(prefers-color-scheme: dark)');
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    if (!['light','dark'].includes(theme)) theme = system.matches ? 'dark' : 'light';
    const hosts = document.querySelectorAll('[data-theme-control]');
    hosts.forEach(host => {
        host.innerHTML = `<button type="button" class="theme-toggle" role="switch"><span class="eclipse-art" aria-hidden="true">${eclipseMarkup}</span></button>`;
    });
    let frame, position = theme === 'dark' ? 3040 : 1720;
    const tracks = () => [...document.querySelectorAll('.eclipse-art')].flatMap(art => art.getAnimations({subtree:true}));
    const seek = time => tracks().forEach(animation => { animation.pause(); animation.currentTime = time; });
    const label = () => hosts.forEach(host => {
        const button = host.querySelector('button');
        button.setAttribute('aria-checked',String(theme === 'dark'));
        button.setAttribute('aria-label',getLanguage()==='tl'?'Madilim na tema':'Dark mode');
        button.title = getLanguage()==='tl'?'Palitan ang maliwanag / madilim na tema':'Switch light / dark theme';
    });
    function apply(next, animate = true) {
        cancelAnimationFrame(frame);
        theme = next;
        document.documentElement.dataset.theme = theme;
        document.querySelector('meta[name="theme-color"]')?.setAttribute('content',theme==='dark'?'#101b2b':'#fafbfe');
        label();
        const target = theme === 'dark' ? 3040 : 1720, from = position;
        if (!animate || reduced.matches) { position=target;seek(position); }
        else {
            const start=performance.now(),duration=Math.abs(target-from);
            const tick=now=>{const progress=Math.min(1,(now-start)/Math.max(1,duration));position=from+(target-from)*progress;seek(position);if(progress<1)frame=requestAnimationFrame(tick);};
            frame=requestAnimationFrame(tick);
        }
        window.dispatchEvent(new CustomEvent('theme:changed',{detail:{theme}}));
    }
    hosts.forEach(host=>host.querySelector('button').addEventListener('click',()=>{
        apply(theme==='dark'?'light':'dark');
        try {localStorage.setItem('embeready-theme',theme);}catch{}
    }));
    window.addEventListener('language:changed',label);
    reduced.addEventListener('change',()=>apply(theme,false));
    system.addEventListener('change',event=>{let saved;try{saved=localStorage.getItem('embeready-theme');}catch{}if(!saved)apply(event.matches?'dark':'light',false);});
    const visibility = new MutationObserver(()=>seek(position));
    document.querySelectorAll('.view').forEach(view=>visibility.observe(view,{attributes:true,attributeFilter:['class']}));
    apply(theme,false);
}
