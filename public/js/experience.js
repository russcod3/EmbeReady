const header = document.querySelector('.map-header');
const hud = document.createElement('aside');
hud.className = 'explore-hud';
hud.setAttribute('aria-label', 'Explore and filter map');
hud.innerHTML = '<button type="button" class="sheet-grabber" aria-label="Expand map controls" aria-expanded="false"><span></span></button><div class="sheet-tools"><button type="button">Filters & layers</button></div><h2>Explore Batangas City</h2><p class="hud-sub">Community fire hazard map · No account needed</p>';
document.getElementById('view-map').append(hud);
const search = document.getElementById('map-search-form');
hud.querySelector('.sheet-grabber').after(search);
hud.append(document.querySelector('.filter-bar'), document.querySelector('.infra-toggles'));
const drawer = document.getElementById('hazard-drawer');
const handle = document.createElement('button');
handle.type = 'button'; handle.className = 'sheet-grabber'; handle.setAttribute('aria-label', 'Expand hazard details');
handle.innerHTML = '<span></span>'; drawer.prepend(handle);
const positions = ['collapsed','half','full'];
function setSnap(panel, state) {
 panel.dataset.snap = state;
 const button = panel.querySelector('.sheet-grabber');
 button.setAttribute('aria-expanded', String(state !== 'collapsed'));
 button.setAttribute('aria-label', state === 'full' ? 'Collapse panel' : 'Expand panel');
}
for (const panel of [hud,drawer]) {
 setSnap(panel, panel === hud ? 'collapsed' : 'half');
 const grip = panel.querySelector('.sheet-grabber');
 let start = null, dragged = false;
 grip.addEventListener('click', () => {
  if (dragged) {dragged=false;return;}
  setSnap(panel, positions[(positions.indexOf(panel.dataset.snap)+1)%3]);
 });
 grip.addEventListener('pointerdown', e => {start=e.clientY;dragged=false;grip.setPointerCapture(e.pointerId);});
 grip.addEventListener('pointerup', e => {
  if(start!==null && Math.abs(start-e.clientY)>24) {
   dragged=true;setSnap(panel,positions[Math.max(0,Math.min(2,positions.indexOf(panel.dataset.snap)+(start>e.clientY?1:-1)))]);
  } start=null;
 });
 grip.addEventListener('pointercancel',()=>{start=null;});
}
hud.querySelector('.sheet-tools button').addEventListener('click',()=>setSnap(hud,hud.dataset.snap==='full'?'collapsed':'full'));
search.querySelector('input').addEventListener('focus',()=>setSnap(hud,'half'));
new MutationObserver(()=>{if(drawer.classList.contains('is-open'))setSnap(drawer,'half');}).observe(drawer,{attributes:true,attributeFilter:['class']});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!document.querySelector('dialog[open]'))setSnap(hud,'collapsed');});
