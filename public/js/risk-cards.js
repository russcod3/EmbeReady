import S from '../strings.js';
import { escapeHtml } from './utils.js';
const labelFor=key=>S.factors.labels[key]||key.replaceAll('_',' ');
const asset=name=>`./images/risk-cards/${name}.svg`;
const scoreText=f=>f.score===null?'?':String(f.score).padStart(2,'0');
export function riskCardsMarkup(factors){
 const entries=Object.entries(factors||{});
 if(!entries.length)return '';
 return `<section class="factor-carousel" aria-roledescription="carousel" aria-label="${S.factors.cards}" tabindex="0">
  <div class="factor-deck-heading"><span>${S.factors.title}</span><span class="factor-count" aria-live="polite"></span></div>
  <div class="factor-stage"><img class="factor-glow factor-glow-violet" src="${asset('glow-violet')}" alt=""><img class="factor-glow factor-glow-gold" src="${asset('glow-gold')}" alt="">
   <div class="factor-stack">${entries.map(([key,f],index)=>{const light=index%5===0;return `<article class="risk-factor-card factor-palette-${index%5}" data-factor-index="${index}" aria-roledescription="slide" aria-label="${index+1} of ${entries.length}: ${escapeHtml(labelFor(key))}">
    <div class="factor-card-art" aria-hidden="true"><img class="factor-ring factor-ring-1" src="${asset('ring-'+(light?'light':'dark')+'-1')}" alt=""><img class="factor-ring factor-ring-2" src="${asset('ring-'+(light?'light':'dark')+'-2')}" alt=""><div class="factor-gloss"></div></div>
    <div class="factor-card-top"><span class="factor-big-score">${scoreText(f)}</span><span class="factor-max">${f.score===null?S.factors.unknown:S.factors.outOf(f.max_score)}</span></div>
    <div class="factor-card-bottom"><span class="factor-card-eyebrow">${S.factors.factor} ${String(index+1).padStart(2,'0')}</span><h3>${escapeHtml(labelFor(key))}</h3><p>${f.score===null?S.factors.more:S.factors.contribution}</p></div>
    <button type="button" class="factor-card-next" aria-label="${S.factors.next}"><span class="factor-arrow-art"><img src="${asset('arrow-button-'+(light?'light':'dark'))}" alt=""><img class="factor-arrow" src="${asset('arrow-'+(light?'light':'dark'))}" alt=""></span></button>
   </article>`;}).join('')}</div>
  </div>
  <div class="factor-navigation"><button type="button" class="factor-prev" aria-label="${S.factors.previous}">←</button><div class="factor-dots">${entries.map(([key],i)=>`<button type="button" data-factor-dot="${i}" aria-label="${S.factors.show} ${escapeHtml(labelFor(key))}"></button>`).join('')}</div><button type="button" class="factor-next" aria-label="${S.factors.next}">→</button></div>
  <div class="factor-field-note" aria-live="polite"><strong></strong><p></p><span></span></div>
 </section>`;
}
export function initRiskCards(root,factors,initialIndex=0){
 const deck=root.querySelector('.factor-carousel');if(!deck)return()=>{};
 const entries=Object.entries(factors),cards=[...deck.querySelectorAll('.risk-factor-card')],stack=deck.querySelector('.factor-stack');
 let current=Math.min(initialIndex,cards.length-1),busy=false,destroyed=false,pointer=null;
 const motions=new Set(),reduced=()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 const observer=new ResizeObserver(()=>stack.style.setProperty('--card-scale',String(stack.clientWidth/720)));observer.observe(stack);
 function render(){
  deck.dataset.index=current;
  cards.forEach((card,i)=>{const depth=(i-current+cards.length)%cards.length;card.style.setProperty('--depth',Math.min(depth,4));card.style.zIndex=String(cards.length-depth);card.dataset.depth=depth;card.inert=depth!==0;card.setAttribute('aria-hidden',String(depth!==0));});
  deck.querySelector('.factor-count').textContent=`${current+1} / ${cards.length}`;
  deck.querySelectorAll('[data-factor-dot]').forEach((dot,i)=>dot.setAttribute('aria-current',String(i===current)));
  const [key,f]=entries[current],note=deck.querySelector('.factor-field-note');
  note.querySelector('strong').textContent=labelFor(key);
  note.querySelector('p').textContent=f.reason;
  note.querySelector('span').textContent=f.score===null?S.factors.unscored:S.factors.points(f.score,f.max_score);
 }
 async function go(index){
  if(busy||destroyed||index===current)return;
  const next=(index+cards.length)%cards.length;
  if(reduced()){current=next;render();return;}
  busy=true;
  const front=cards[current],incoming=cards[next],w=stack.clientWidth,h=stack.clientHeight,moveFocus=front.contains(document.activeElement);
  // Riff 28: 180 ms anticipation + 580 ms throw, using the exported easing values.
  const out=front.animate([
   {transform:'translate(0,0) rotate(0) scale(1)',opacity:1,offset:0,easing:'cubic-bezier(.16,1,.3,1)'},
   {transform:`translate(${-34/720*w}px,${-28/900*h}px) rotate(-3deg) scale(1.05)`,opacity:1,offset:180/760,easing:'cubic-bezier(.5,0,1,.6)'},
   {opacity:1,offset:640/760},
   {transform:`translate(${1040/720*w}px,${60/900*h}px) rotate(-20deg) scale(.98)`,opacity:0,offset:1}
  ],{duration:760,fill:'forwards'});
  incoming.style.zIndex=String(cards.length-1);
  incoming.style.visibility='visible';
  const enter=incoming.animate([{transform:`translateY(${-72/900*h}px) rotate(-1.6deg) scale(.93)`,opacity:.88},{transform:'translateY(0) rotate(0) scale(1)',opacity:1}],{duration:760,easing:'cubic-bezier(.34,1.56,.64,1)',fill:'forwards'});
  motions.add(out);motions.add(enter);
  try{await Promise.all([out.finished,enter.finished]);if(!destroyed){current=next;render();if(moveFocus)deck.querySelector('.factor-next').focus({preventScroll:true});}}catch{}finally{out.cancel();enter.cancel();incoming.style.removeProperty('visibility');motions.delete(out);motions.delete(enter);busy=false;}
 }
 deck.querySelectorAll('.factor-card-next,.factor-next').forEach(button=>button.addEventListener('click',()=>go(current+1)));
 deck.querySelector('.factor-prev').addEventListener('click',()=>go(current-1));
 deck.querySelectorAll('[data-factor-dot]').forEach(dot=>dot.addEventListener('click',()=>go(Number(dot.dataset.factorDot))));
 deck.addEventListener('keydown',event=>{if(['ArrowRight','ArrowLeft','Home','End'].includes(event.key)){event.preventDefault();go(event.key==='Home'?0:event.key==='End'?cards.length-1:current+(event.key==='ArrowRight'?1:-1));}});
 stack.addEventListener('pointerdown',event=>{pointer={x:event.clientX,y:event.clientY};});
 stack.addEventListener('pointerup',event=>{if(pointer){const dx=event.clientX-pointer.x,dy=event.clientY-pointer.y;if(Math.abs(dx)>45&&Math.abs(dx)>Math.abs(dy)*1.5)go(current+(dx<0?1:-1));}pointer=null;});
 stack.addEventListener('pointercancel',()=>pointer=null);
 render();return()=>{destroyed=true;observer.disconnect();for(const motion of motions)motion.cancel();};
}
