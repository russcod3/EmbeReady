const checkMarkup = "<svg preserveAspectRatio=\"none\" overflow=\"visible\" style=\"display: block;\" width=\"47.52\" height=\"36.96\" viewBox=\"0 0 47.52 36.96\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\n<path pathLength=\"1\" data-motion-node=\"1:1760\" id=\"Check\" d=\"M4.08 19.44L17.52 32.88L43.44 4.08004\" stroke-width=\"8.16\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke=\"white\"/>\n</svg>\n";
// Figma success keyframes play once. A single canvas draws the requested embers.
export function playReportSuccess(dialog, data) {
    dialog.querySelector('.report-success-hero')?.remove();
    if (data.pending || !data.ref_number || !dialog.open) return;
    for (const [selector,node] of [['.modal-title','1:1762'],['#modal-ai-score-box','1:1763'],['#modal-action-done','1:1765']]) dialog.querySelector(selector)?.setAttribute('data-motion-node',node);
    const hero=document.createElement('div');
    hero.className='report-success-hero';
    hero.setAttribute('aria-hidden','true');
    hero.innerHTML='<img class="success-ring" data-motion-node="1:1743" src="./images/motion/imgFlashRing1.svg" alt=""><img class="success-ring" data-motion-node="1:1744" src="./images/motion/imgFlashRing2.svg" alt=""><div class="success-check" data-motion-node="1:1759">'+checkMarkup+'</div><canvas></canvas>';
    dialog.querySelector('.modal-header').before(hero);
    if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    const canvas=hero.querySelector('canvas'),ctx=canvas.getContext('2d');
    if(!ctx)return;
    const width=hero.clientWidth,height=180,dpr=Math.min(devicePixelRatio||1,2);
    canvas.width=width*dpr;canvas.height=height*dpr;ctx.scale(dpr,dpr);
    const particles=Array.from({length:28},(_,index)=>({angle:-Math.PI+index/27*Math.PI,speed:45+(index%7)*12,size:2+index%3}));
    let start,frame;
    const stop=()=>{cancelAnimationFrame(frame);observer.disconnect();};
    const observer=new MutationObserver(()=>{if(!dialog.open)stop();});observer.observe(dialog,{attributes:true,attributeFilter:['open']});
    const tick=now=>{
        start??=now;const t=(now-start)/1000;ctx.clearRect(0,0,width,height);
        if(t>1.6){stop();return;}
        particles.forEach((p,index)=>{const x=width/2+Math.cos(p.angle)*p.speed*t,y=90+Math.sin(p.angle)*p.speed*t+24*t*t;ctx.globalAlpha=Math.max(0,1-t/1.6);ctx.fillStyle=['#ff6b24','#ffb13b','#d84c21','#ffd16b'][index%4];ctx.beginPath();ctx.ellipse(x,y,p.size/2,p.size*1.6,p.angle,0,Math.PI*2);ctx.fill();});
        frame=requestAnimationFrame(tick);
    };
    frame=requestAnimationFrame(tick);
}
