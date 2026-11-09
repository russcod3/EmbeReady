import { escapeHtml } from './utils.js';
const labels={ignition_sources:'Ignition',fuel_combustibles:'Combustible materials',proximity_to_people:'People exposed',structure_material:'Fire spread',escape_routes:'Escape routes',truck_access:'Responder access',fire_history:'Fire history',weather_seasonal:'Environment',human_behavior:'Unsafe practices',safeguards:'Safety measures'};
const asset=name=>`./images/risk-cards/${name}.svg`;
const scoreText=f=>f.score===null?'?':String(f.score).padStart(2,'0');
export function riskCardsMarkup(factors){
 const entries=Object.entries(factors||{});
 if(!entries.length)return '';
 return `<section class="factor-carousel" aria-roledescription="carousel" aria-label="Risk factor cards" tabindex="0">
  <div class="factor-deck-heading"><span>Behind the score</span><span class="factor-count" aria-live="polite"></span></div>
  <div class="factor-stage"><img class="factor-glow factor-glow-violet" src="${asset('glow-violet')}" alt=""><img class="factor-glow factor-glow-gold" src="${asset('glow-gold')}" alt="">
   <div class="factor-stack">${entries.map(([key,f],index)=>{const light=index%5===0;return `<article class="risk-factor-card factor-palette-${index%5}" data-factor-index="${index}" aria-roledescription="slide" aria-label="${index+1} of ${entries.length}: ${escapeHtml(labels[key]||key)}">
    <div class="factor-card-art" aria-hidden="true"><img class="factor-ring factor-ring-1" src="${asset('ring-'+(light?'light':'dark')+'-1')}" alt=""><img class="factor-ring factor-ring-2" src="${asset('ring-'+(light?'light':'dark')+'-2')}" alt=""><div class="factor-gloss"></div></div>
    <div class="factor-card-top"><span class="factor-big-score">${scoreText(f)}</span><span class="factor-max">${f.score===null?'Unknown':`out of ${f.max_score}`}</span></div>
    <div class="factor-card-bottom"><span class="factor-card-eyebrow">Factor ${String(index+1).padStart(2,'0')}</span><h3>${escapeHtml(labels[key]||key.replaceAll('_',' '))}</h3><p>${f.score===null?'More observations needed':'Contribution to overall risk'}</p></div>
    <button type="button" class="factor-card-next" aria-label="Next risk factor"><span class="factor-arrow-art"><img src="${asset('arrow-button-'+(light?'light':'dark'))}" alt=""><img class="factor-arrow" src="${asset('arrow-'+(light?'light':'dark'))}" alt=""></span></button>
   </article>`;}).join('')}</div>
  </div>
  <div class="factor-navigation"><button type="button" class="factor-prev" aria-label="Previous risk factor">←</button><div class="factor-dots">${entries.map(([key],i)=>`<button type="button" data-factor-dot="${i}" aria-label="Show ${escapeHtml(labels[key]||key)}"></button>`).join('')}</div><button type="button" class="factor-next" aria-label="Next risk factor">→</button></div>
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
  note.querySelector('strong').textContent=labels[key]||key.replaceAll('_',' ');
  note.querySelector('p').textContent=f.reason;
  note.querySelector('span').textContent=f.score===null?'Not scored · evidence missing':`${f.score} / ${f.max_score} points · ${Math.round(f.score/f.max_score*100)}% of this factor’s maximum`;
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
