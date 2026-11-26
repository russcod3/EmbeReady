import { escapeHtml as esc } from './utils.js';
import { createEmberPuppet } from './ember-puppet.js';
import { initTheme } from './theme.js';
import { initWelcomeBackground } from './welcome-background.js';

const el = id => document.getElementById(id);
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const statusLabels = { pending:'Needs review', verified:'Verified', fake:'Fake', example:'Example' };
const riskLabels = { low:'Low', moderate:'Moderate', heavy:'High', live:'Live fire' };
const dateFormat = new Intl.DateTimeFormat('en-PH', {dateStyle:'medium',timeZone:'Asia/Manila'});
const state = { authorized:false, section:'reports', status:'all', level:'all', source:'all', query:'', page:1, pages:1, records:[], review:null, pendingDelete:null, loading:false, request:0, detailRequest:0, signature:'', view:'grid', scanning:null };
const icons = {
    trash:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/></svg>',
    pin:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 0 1 14 0Z"/><circle cx="12" cy="10" r="2"/></svg>'
};
function date(value) {
    if (!value) return '—';
    const parsed = new Date(value.includes('T') ? value : value.replace(' ','T')+'Z');
    return Number.isNaN(parsed.getTime()) ? '—' : dateFormat.format(parsed);
}
function message(id, value = '') { el(id).textContent=value; el(id).hidden=!value; }
let toastTimer;
function toast(value) { el('admin-toast').textContent=value; el('admin-toast').hidden=false; clearTimeout(toastTimer); toastTimer=setTimeout(()=>{el('admin-toast').hidden=true;},4500); }
async function request(path, method='GET', body) {
    const response = await fetch('/api/admin'+path, {method,credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(path.endsWith('/photo-scan')?110000:20000),headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
    const result = await response.json();
    if (!response.ok) { const error=new Error(result.error||'The request could not be completed.');error.status=response.status;throw error; }
    return result;
}
function showLogin(error='') {
    el('password').value=''; el('password').type='password';
    el('password-visibility').setAttribute('aria-pressed','false');
    el('password-visibility').setAttribute('aria-label','Show password');
    state.authorized=false; state.request++; state.detailRequest++; state.review=null; state.records=[]; state.signature='';
    el('workspace').hidden=true; el('workspace').classList.remove('is-active');
    el('view-landing').hidden=false; el('view-landing').classList.add('is-active');
    for(const dialog of document.querySelectorAll('dialog[open]')) dialog.close();
    message('login-message',error); el('reports').replaceChildren(); el('full-photo').removeAttribute('src');
}
async function showWorkspace() {
    state.authorized=true;
    el('view-landing').classList.remove('is-active'); el('view-landing').hidden=true;
    el('workspace').hidden=false; el('workspace').classList.add('is-active');
    await loadCollection();
}
function updateControls() {
    const reports=state.section==='reports';
    el('workspace-title').textContent=reports?'Community reports':'All hazards';
    el('workspace-subtitle').textContent=reports?'A clear view of what needs your attention.':'Manage the hazards shown on the community map.';
    el('example-note').textContent=reports?'Submitted reports only':'Community reports and examples';
    el('source-filter').hidden=reports;
    document.querySelectorAll('[data-section]').forEach(button=>{if(button.dataset.section===state.section)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');});
    document.querySelectorAll('#review-filters [data-review-filter]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.reviewFilter===state.status)));
    document.querySelectorAll('[data-view]').forEach(button=>{if(button.tagName==='BUTTON')button.setAttribute('aria-pressed',String(button.dataset.view===state.view));});
    el('reports').dataset.view=state.view;
}
function photoUrl(row) {
    return row.has_photo && typeof row.photo_url==='string' && /^\/uploads\/(user|seed)\/[a-zA-Z0-9._/-]+$/.test(row.photo_url) && !row.photo_url.includes('..') ? row.photo_url : null;
}
function risk(row) { return row.status==='active'?'live':row.reported_level||row.assessed_level||row.risk_level; }
function badges(row) {
    const level=risk(row), status=row.review_status;
    return `<span class="admin-badge admin-risk-${esc(level)}">${riskLabels[level]||'Not assessed'}</span><span class="admin-badge admin-review-${esc(status)}">${status==='verified'?'✓ ':''}${statusLabels[status]||'Needs review'}</span>`;
}
function card(row) {
    const photo=photoUrl(row);
    return `<article class="admin-report-card" data-hazard-id="${row.id}">
        ${photo?`<div class="admin-card-photo"><img src="${esc(photo)}" alt="Evidence for ${esc(row.title)}" loading="lazy" decoding="async"><button type="button" data-photo-id="${row.id}">View photo ↗</button></div>`:''}
        <div class="admin-card-body"><div class="admin-card-badges">${badges(row)}</div><h2>${esc(row.title)}</h2><p class="admin-card-description">${esc(row.description||'No description was provided.')}</p>
        <div class="admin-card-meta"><span class="admin-card-location">${icons.pin}${esc(row.barangay)}</span><span class="admin-card-reference"><span>${esc(row.ref_number||row.ref_code)}</span><span>${date(row.submitted_at||row.created_at)}</span></span></div>
        <div class="admin-card-actions"><button type="button" data-review-id="${row.id}">${row.can_review?'Review report':'View hazard'} <span aria-hidden="true">↗</span></button><button type="button" class="admin-icon-button" data-delete-id="${row.id}" aria-label="Delete ${esc(row.title)}">${icons.trash}</button></div></div></article>`;
}
async function loadCollection(silent=false) {
    if(!state.authorized)return;
    const version=++state.request;
    state.loading=true; updateControls();
    el('refresh').disabled=true;
    if(!silent) { el('reports').setAttribute('aria-busy','true'); message('collection-message'); }
    try {
        const query=new URLSearchParams({q:state.query,status:state.status,level:state.level,source:state.source,page:String(state.page)});
        const data=await request((state.section==='reports'?'/dashboard':'/hazards')+'?'+query);
        if(version!==state.request)return;
        state.records=data.data;state.page=data.page;state.pages=data.pages;
        for(const key of ['all','pending','verified','fake'])el('count-'+key).textContent=String(data.counts[key]);
        el('nav-pending').textContent=String(data.counts.pending);
        const signature=JSON.stringify([state.section,state.status,state.level,state.source,state.query,state.page,data.data]);
        if(state.signature!==signature) { el('reports').innerHTML=data.data.map(card).join(''); state.signature=signature; }
        el('empty-state').hidden=data.total>0;
        el('empty-state').querySelector('h2').textContent=state.query||state.status!=='all'||state.level!=='all'?'No matches found':state.section==='reports'?'Your inbox is clear':'No hazards to show';
        el('empty-state').querySelector('p').innerHTML=state.query||state.status!=='all'||state.level!=='all'?'Try another search or filter.':state.section==='reports'?'New community reports will appear here.<br>Example hazards are in All hazards.':'Hazards added to the map will appear here.';
        el('result-count').textContent=data.total+' '+(state.section==='reports'?'submitted report':'hazard')+(data.total===1?'':'s');
        el('pagination').hidden=data.pages<=1; el('page-number').textContent=`${data.page} / ${data.pages}`;
        el('previous').disabled=data.page<=1; el('next').disabled=data.page>=data.pages;
    } catch(error) {
        if(version!==state.request)return;
        if(error.status===401)showLogin('Your session ended. Sign in again.');else message('collection-message',error.message);
    } finally { if(version===state.request) { state.loading=false;el('refresh').disabled=false;el('reports').removeAttribute('aria-busy'); } }
}
function closeDialog(dialog) {
    if(!dialog.open||dialog.dataset.busy==='true')return;
    if(reduced.matches){dialog.close();return;}
    if(dialog.dataset.closing)return;
    dialog.dataset.closing='true';
    const animation=dialog.animate([{opacity:1,transform:'translateY(0) scale(1)'},{opacity:0,transform:'translateY(9px) scale(.99)'}],{duration:170,easing:'ease-in',fill:'forwards'});
    animation.finished.then(()=>{dialog.close();animation.cancel();delete dialog.dataset.closing;});
}
function selected(id) { return state.review?.id===Number(id)?state.review:state.records.find(row=>row.id===Number(id)); }
function showPhoto(id) {
    const row=selected(id),url=row&&photoUrl(row);if(!url)return;
    el('photo-title').textContent=row.title;
    el('full-photo').src=url;
    el('photo-dialog').showModal();
}
function scanMarkup(scan) {
    if(!scan)return '';
    return `<div class="admin-scan-result" data-flagged="${scan.flagged}"><strong>${scan.flagged?'Potential AI-generated image':'No strong AI signal'} · ${Math.round(scan.ai_score*100)}%</strong><span>${scan.flagged?'Above the 50% review threshold. Confirm it with your own sources.':'Below the 50% review threshold. This does not verify the report.'}</span>${scan.flagged?`<button type="button" data-delete-id="${state.review.id}" data-delete-reason="fake_report">Delete this report</button>`:''}</div>`;
}
function renderReview(row) {
    const photo=photoUrl(row);
    el('review-content').innerHTML=`<header class="admin-review-heading"><div><p class="admin-eyebrow">${row.can_review?'SUBMITTED REPORT':'MAP HAZARD'} · ${esc(row.ref_number||row.ref_code)}</p><h2 id="review-title">${esc(row.title)}</h2></div><button type="button" data-close-dialog="review-dialog" class="admin-icon-button" aria-label="Close report details">×</button></header>
        <div class="admin-review-layout"><section class="admin-review-evidence"><div class="admin-card-badges" id="review-badges">${badges(row)}</div><dl class="admin-report-facts"><div><dt>Barangay</dt><dd>${esc(row.barangay)}</dd></div><div><dt>${row.can_review?'Submitted':'Added'}</dt><dd>${date(row.submitted_at||row.created_at)}</dd></div><div><dt>Reported level</dt><dd>${riskLabels[row.reported_level||risk(row)]||'Not assessed'}</dd></div><div><dt>Location</dt><dd>${Number(row.lat).toFixed(5)}, ${Number(row.lng).toFixed(5)}</dd></div></dl><h3 class="admin-section-label">Description</h3><p class="admin-evidence-description">${esc(row.description||'No description was provided.')}</p>${row.address?`<p class="admin-evidence-description">${esc(row.address)}</p>`:''}<h3 class="admin-section-label">Photo evidence</h3>${photo?`<button type="button" class="admin-evidence-photo" data-photo-id="${row.id}"><img src="${esc(photo)}" alt="Submitted evidence" decoding="async"><span>View full photo ↗</span></button>`:'<div class="admin-no-photo">No photo was submitted.</div>'}
        ${row.history?.length?`<details class="admin-review-history"><summary>Review history</summary><ol>${row.history.map(item=>`<li><strong>${item.decision==='validated'?'Verified':item.decision==='dismissed'?'Marked as fake':'Needs review'} · ${date(item.reviewed_at)}</strong>${esc(item.notes||'No notes added.')}<br>${esc(item.reviewer==='Shared admin'?'Admin':item.reviewer)}</li>`).join('')}</ol></details>`:''}</section>
        <section class="admin-review-actions">${row.can_review?`<div class="admin-photo-check"><h3>Local photo check</h3><p>Photos stay on this server. The detector is a review signal, not proof of authenticity.</p><button type="button" id="scan-photo" class="admin-secondary" data-scan="${row.id}" ${!photo?'disabled':''}>${row.photo_scan?'Check photo again':'Scan for AI-generated content'}</button><div id="scan-result" role="status">${scanMarkup(row.photo_scan)}</div><p id="scan-message" class="admin-message" role="alert" hidden></p></div><div class="admin-verification"><label for="review-notes">Verification notes</label><textarea id="review-notes" rows="4" maxlength="2000" placeholder="What did you confirm with residents, observation, or other sources?">${esc(row.notes||'')}</textarea><div class="admin-decision-buttons"><button type="button" class="admin-primary" data-decision="validated">✓ Mark as verified</button><button type="button" class="admin-secondary admin-fake-button" data-decision="dismissed">Mark as fake</button></div><p class="admin-review-note">Verified reports receive a badge on the public map. Reports marked as fake are hidden from it.</p><p id="review-message" class="admin-message" role="alert" hidden></p></div>`:'<div class="admin-photo-check"><h3>Example hazard</h3><p>This is an example already on the map. Community reports are reviewed in the Reports inbox.</p></div>'}<button type="button" class="admin-remove-link" data-delete-id="${row.id}">Delete ${row.can_review?'report and hazard':'hazard'} from the website</button></section></div>`;
}
async function openReview(id) {
    const version=++state.detailRequest;
    el('review-content').innerHTML='<div class="admin-empty"><h2 id="review-title">Loading report…</h2></div>';
    el('review-dialog').showModal();
    try {
        const {data}=await request('/hazards/'+Number(id));
        if(version!==state.detailRequest||!el('review-dialog').open)return;
        state.review=data; renderReview(data);
    } catch(error) { closeDialog(el('review-dialog'));if(error.status===401)showLogin('Your session ended. Sign in again.');else toast(error.message); }
}
async function scanPhoto() {
    const row=state.review;if(!row||state.scanning)return;
    const button=el('scan-photo');state.scanning=row.id;button.disabled=true;button.textContent='Checking image locally…';message('scan-message');
    try {
        const {data}=await request('/hazards/'+row.id+'/photo-scan','POST',{});
        if(state.review?.id!==row.id||!el('review-dialog').open)return;
        state.review.photo_scan=data;el('scan-result').innerHTML=scanMarkup(data);
    } catch(error) { if(state.review?.id===row.id&&el('scan-message'))message('scan-message',error.message); }
    finally { state.scanning=null;if(state.review?.id===row.id&&el('scan-photo')){el('scan-photo').disabled=false;el('scan-photo').textContent='Check photo again';} }
}
async function saveDecision(decision) {
    const row=state.review;if(!row?.can_review)return;
    const notes=el('review-notes').value.trim();message('review-message');
    if(decision==='dismissed'&&!notes){message('review-message','Add a note explaining what you confirmed before marking this report as fake.');el('review-notes').focus();return;}
    const buttons=[...document.querySelectorAll('[data-decision]')];buttons.forEach(button=>button.disabled=true);
    try {
        const {data}=await request('/reports/'+encodeURIComponent(row.ref_number),'PUT',{decision,evaluated_level:null,notes,version:row.version,reason:null,correction_reason:notes});
        if(state.review?.id!==row.id)return;
        Object.assign(state.review,{decision:data.decision,review_status:data.decision==='validated'?'verified':'fake',version:data.version,notes:data.notes,history:data.history});
        el('review-badges').innerHTML=badges(state.review);
        toast(data.decision==='validated'?'Report verified. The public map will show its badge.':'Report marked as fake and hidden from the public map.');
        await loadCollection(true);
    } catch(error) { if(el('review-message'))message('review-message',error.message); }
    finally { buttons.forEach(button=>button.disabled=false); }
}
function openDelete(id, reason='no_longer_exists') {
    const row=selected(id);if(!row)return;
    state.pendingDelete=row;
    el('delete-title').textContent=row.can_review?'Delete this report?':'Delete this hazard?';
    el('delete-description').textContent=row.title;
    el('delete-reason').value=reason;message('delete-message');el('delete-dialog').showModal();
}
el('delete-confirm').addEventListener('submit',async event=>{
    event.preventDefault();const row=state.pendingDelete;if(!row)return;
    el('delete-submit').disabled=true;el('delete-dialog').dataset.busy='true';message('delete-message');
    try {
        await request('/hazards/'+row.id,'DELETE',{confirm:true,ref_code:row.ref_code,reason:el('delete-reason').value});
        el('delete-dialog').close();if(state.review?.id===row.id){el('review-dialog').close();state.review=null;state.detailRequest++;}
        state.pendingDelete=null;state.signature='';await loadCollection();toast('The hazard and its report were removed from the website.');
    } catch(error) { message('delete-message',error.message); }
    finally { el('delete-submit').disabled=false;delete el('delete-dialog').dataset.busy; }
});
el('sign-in').addEventListener('submit',async event=>{
    event.preventDefault();const button=el('sign-in-submit');button.disabled=true;button.firstChild.textContent='Signing in…';message('login-message');
    try { await request('/login','POST',{username:el('username').value,password:el('password').value});el('password').value='';await showWorkspace(); }
    catch(error){message('login-message',error.message);}
    finally {button.disabled=false;button.firstChild.textContent='Sign in';}
});
el('password-visibility').addEventListener('click',()=>{
    const visible=el('password').type==='password';el('password').type=visible?'text':'password';el('password-visibility').setAttribute('aria-pressed',String(visible));el('password-visibility').setAttribute('aria-label',visible?'Hide password':'Show password');
});
el('sign-out').addEventListener('click',async()=>{try{await request('/logout','POST',{});showLogin();}catch(error){toast(error.message);}});
document.addEventListener('click',event=>{
    const button=event.target.closest('button');if(!button)return;
    if(button.dataset.closeDialog){closeDialog(el(button.dataset.closeDialog));return;}
    if(button.dataset.reviewId){openReview(button.dataset.reviewId);return;}
    if(button.dataset.photoId){showPhoto(button.dataset.photoId);return;}
    if(button.dataset.deleteId){openDelete(button.dataset.deleteId,button.dataset.deleteReason);return;}
    if(button.dataset.scan){scanPhoto();return;}
    if(button.dataset.decision){saveDecision(button.dataset.decision);return;}
    if(button.dataset.section){el('workspace').scrollTop=0;state.section=button.dataset.section;state.status='all';state.source='all';state.query='';state.level='all';state.page=1;el('search-query').value='';el('risk-filter').value='all';el('source-filter').value='all';loadCollection();return;}
    if(button.dataset.reviewFilter){if(button.closest('#admin-metrics')){state.section='reports';el('workspace').scrollTop=0;}state.status=button.dataset.reviewFilter;state.page=1;loadCollection();return;}
    if(button.dataset.view){state.view=button.dataset.view;updateControls();try{localStorage.setItem('embeready-admin-view',state.view);}catch{};}
});
for(const dialog of document.querySelectorAll('dialog')) {
    dialog.addEventListener('cancel',event=>{event.preventDefault();closeDialog(dialog);});
    dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)closeDialog(dialog);}});
}
let searchTimer;
el('search-query').addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>{state.query=el('search-query').value.trim();state.page=1;loadCollection();},250);});
el('risk-filter').addEventListener('change',()=>{state.level=el('risk-filter').value;state.page=1;loadCollection();});
el('source-filter').addEventListener('change',()=>{state.source=el('source-filter').value;state.page=1;loadCollection();});
el('refresh').addEventListener('click',()=>loadCollection());
el('previous').addEventListener('click',()=>{if(state.page>1){state.page--;loadCollection().then(()=>el('reports').scrollIntoView({block:'start',behavior:reduced.matches?'auto':'smooth'}));}});
el('next').addEventListener('click',()=>{if(state.page<state.pages){state.page++;loadCollection().then(()=>el('reports').scrollIntoView({block:'start',behavior:reduced.matches?'auto':'smooth'}));}});
try { const saved=localStorage.getItem('embeready-admin-view');if(['grid','list'].includes(saved))state.view=saved; } catch {}
window.addEventListener('theme:changed',()=>{document.querySelectorAll('.theme-toggle').forEach(button=>{button.setAttribute('aria-label','Dark mode');button.title='Switch light / dark theme';});});
initTheme();
el('admin-ember').append(createEmberPuppet('admin-peek-puppet'));
initWelcomeBackground({pauseLabel:'Pause animations',resumeLabel:'Play animations',reducedLabel:'Motion off · system preference'});
setInterval(()=>{if(state.authorized&&!document.hidden&&!state.loading&&!document.querySelector('dialog[open]'))loadCollection(true);},30000);
request('/session').then(showWorkspace).catch(error=>showLogin(error.status===401?'':error.message));
