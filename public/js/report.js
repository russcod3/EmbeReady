import { escapeHtml } from './utils.js';
import { fetchBarangays, fetchContacts, submitReport, logReportAction } from './api.js';
import { initReportMiniMap } from './map.js';
import { responderContacts } from './report-contacts.js';

let _formEl, _modalEl, _miniMapCtrl, _onReportSuccess;
let _barangays = [], _contacts = [], _nearest = null, _pinConfirmed = false;
const el = id => document.getElementById(id);
const isLive = () => el('report-type').value === 'live_fire';
const inBounds = (lat,lng) => Number.isFinite(lat) && Number.isFinite(lng) && lat>=13.60 && lat<=13.85 && lng>=120.93 && lng<=121.14;

export function initReportForm(onReportSuccess) {
    _onReportSuccess=onReportSuccess;
    _formEl=el('hazard-report-form'); _modalEl=el('report-modal');
    if (!_formEl) return;
    setupRiskDropdown(); setupPhotoUpload();
    _modalEl.addEventListener('cancel',event=>{event.preventDefault();closeModal();});
    el('report-section').addEventListener('cancel',event=>{event.preventDefault();closeReportPanel();});
    document.querySelectorAll('.report-step,.report-observations').forEach(setupSmoothDetails);
    _formEl.addEventListener('submit',handleFormSubmit);
    _modalEl.querySelector('.modal-close-btn').addEventListener('click',closeModal);
    el('modal-action-done').addEventListener('click',closeModal);
    _modalEl.addEventListener('close',()=>_modalEl.classList.remove('is-visible'));
    el('report-section').addEventListener('close',()=>el('report-section').classList.remove('is-open'));
    el('back-to-map-btn').addEventListener('click',closeReportPanel);
    el('report-location-step').addEventListener('toggle',()=>{if(el('report-location-step').open) refreshMiniMap();});
    el('report-barangay').addEventListener('change',updateNearestLabel);
    fetchBarangays().then(rows=>{
        _barangays=rows;
        const select=el('report-barangay');
        for(const b of rows) { const option=document.createElement('option');option.value=b.id;option.textContent=b.name;select.append(option); }
        if (_pinConfirmed) updateNearestLabel();
    }).catch(()=>{});
    fetchContacts().then(rows=>{_contacts=rows;}).catch(()=>{});
}
export function openReportPanel() {
    const panel=el('report-section');
    if (!panel.open) panel.showModal();
    panel.classList.add('is-open');
    el('report-risk-trigger').focus();
    refreshMiniMap();
}
function dismissDialog(dialog,className){
    if(!dialog.open||dialog.dataset.closing)return;
    const finish=()=>{dialog.close();dialog.classList.remove(className);delete dialog.dataset.closing;};
    if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){finish();return;}
    dialog.dataset.closing='true';setTimeout(finish,200);
}
export function closeReportPanel(){dismissDialog(el('report-section'),'is-open');}
function setupSmoothDetails(details){
    let animation=null,target=details.open;
    details.querySelector('summary').addEventListener('click',event=>{
        if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
        event.preventDefault();
        if(!animation)target=details.open;
        const start=details.getBoundingClientRect().height;
        animation?.cancel();target=!target;
        details.open=true;
        const end=target?details.scrollHeight:details.querySelector('summary').getBoundingClientRect().height;
        details.style.overflow='hidden';
        animation=details.animate([{height:start+'px'},{height:end+'px'}],{duration:360,easing:'cubic-bezier(.16,1,.3,1)'});
        animation.onfinish=()=>{details.open=target;details.style.removeProperty('overflow');animation=null;};
    });
}
export function refreshMiniMap() {
    if (!_miniMapCtrl && el('report-section').open) {
        _miniMapCtrl=initReportMiniMap('report-minimap',(lat,lng)=>{
            _pinConfirmed=true;
            el('report-lat').value=lat.toFixed(6);el('report-lng').value=lng.toFixed(6);
            el('report-coords-display').textContent=`${lat.toFixed(5)}°N, ${lng.toFixed(5)}°E`;
            el('report-location-summary').textContent=inBounds(lat,lng)?'Location pinned':'Outside Batangas City';
            updateNearestLabel();
        });
    }
    if (_miniMapCtrl) _miniMapCtrl.invalidate();
}
function updateNearestLabel() {
    const lat=Number(el('report-lat').value), lng=Number(el('report-lng').value);
    const distance=b=>(Number(b.center_lat)-lat)**2+((Number(b.center_lng)-lng)*Math.cos(lat*Math.PI/180))**2;
    _nearest=_pinConfirmed?_barangays.reduce((nearest,b)=>!nearest||distance(b)<distance(nearest)?b:nearest,null):null;
    const selected=_barangays.find(b=>String(b.id)===el('report-barangay').value);
    el('report-nearest-barangay').textContent=selected?`Selected barangay: ${selected.name}`:_nearest?`Nearest barangay: ${_nearest.name}. This is a proximity suggestion, not a boundary check.`:'';
}
function setDropdownOpen(open,focusOption=false) {
    const box=el('report-risk-dropdown'),trigger=el('report-risk-trigger'),list=el('report-risk-options');
    box.classList.toggle('is-open',open);trigger.setAttribute('aria-expanded',String(open));list.inert=!open;
    const options=[...list.querySelectorAll('[data-report-risk]')];
    options.forEach(button=>button.tabIndex=open?0:-1);
    if(open&&focusOption) (options.find(b=>b.getAttribute('aria-selected')==='true')||options[0]).focus();
}
function setupRiskDropdown() {
    const trigger=el('report-risk-trigger'),list=el('report-risk-options');
    trigger.addEventListener('click',()=>setDropdownOpen(trigger.getAttribute('aria-expanded')!=='true'));
    trigger.addEventListener('keydown',event=>{
        if(['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();setDropdownOpen(true,true);}
        else if(event.key==='Escape'&&trigger.getAttribute('aria-expanded')==='true'){event.preventDefault();event.stopPropagation();setDropdownOpen(false);}
    });
    list.querySelectorAll('[data-report-risk]').forEach(button=>{
        button.tabIndex=-1;
        button.addEventListener('click',()=>{chooseRisk(button.dataset.reportRisk,button.querySelector('strong').textContent);setDropdownOpen(false);trigger.focus();});
    });
    list.addEventListener('keydown',event=>{
        const options=[...list.querySelectorAll('[data-report-risk]')],index=options.indexOf(document.activeElement);
        if(event.key==='Escape'){event.preventDefault();event.stopPropagation();setDropdownOpen(false);trigger.focus();}
        else if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)) {event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?options.length-1:(index+(event.key==='ArrowDown'?1:-1)+options.length)%options.length;options[next].focus();}
    });
    document.addEventListener('click',event=>{if(!el('report-risk-dropdown').contains(event.target))setDropdownOpen(false);});
    document.addEventListener('focusin',event=>{if(!el('report-risk-dropdown').contains(event.target))setDropdownOpen(false);});
}
function chooseRisk(level,label='Choose a risk level…') {
    const live=level==='live_fire';
    el('report-level').value=live?'':level;
    el('report-type').value=live?'live_fire':'hazard';
    el('report-risk-value').textContent=label;
    el('report-heading-text').textContent=live?'Report a live fire':'Report a fire hazard';
    el('report-intro').textContent=live?'Pin the fire, then open responder contacts.':'Choose the risk level first. Gemini will independently assess the evidence.';
    el('report-section').dataset.mode=live?'live':'hazard';
    el('report-status').value=live?'active':'potential';
    el('report-followup').hidden=!level;
    el('report-hazard-step').hidden=live||!level;
    el('report-hazard-fields').disabled=live||!level;
    el('report-barangay-field').hidden=live;
    el('report-barangay').disabled=live;
    el('report-live-note').hidden=!live;
    el('report-submit-btn').textContent=live?'Alert · view responder contacts':'Submit hazard report';
    el('report-submit-note').textContent=live?'Saves your pinned location and opens contacts to copy and call manually.':'Your selected risk is saved. Gemini assesses the observations independently.';
    if(live){el('report-photo-input').value='';el('photo-dropzone').classList.remove('has-file');el('photo-upload-label').textContent='Drop a photo or click to browse';}
    el('report-risk-options').querySelectorAll('[data-report-risk]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.reportRisk===level)));
    el('report-location-step').open=live;
    el('report-hazard-step').open=!live&&Boolean(level);
    if(live)refreshMiniMap();
}
function setupPhotoUpload() {
    const area=el('photo-dropzone'),input=el('report-photo-input'),label=el('photo-upload-label');
    const showFile=()=>{const file=input.files?.[0];area.classList.toggle('has-file',Boolean(file));label.textContent=file?`${file.name} · ${Math.round(file.size/1024)} KB`:'Drop a photo or click to browse';};
    area.addEventListener('click',()=>input.click());
    area.addEventListener('keydown',event=>{if(['Enter',' '].includes(event.key)){event.preventDefault();input.click();}});
    input.addEventListener('change',showFile);
    ['dragenter','dragover','dragleave','drop'].forEach(name=>area.addEventListener(name,event=>{event.preventDefault();area.classList.toggle('is-dragging',name==='dragenter'||name==='dragover');}));
    area.addEventListener('drop',event=>{if(!isLive()&&event.dataTransfer.files.length){input.files=event.dataTransfer.files;showFile();}});
}
function showErrors(messages) {
    el('form-errors-list').innerHTML=messages.map(message=>`<li>${escapeHtml(message)}</li>`).join('');
    el('form-errors').classList.add('is-visible');el('form-errors').focus();
}
async function handleFormSubmit(event) {
    event.preventDefault();
    const submit=el('report-submit-btn');if(submit.disabled)return;
    el('form-errors').classList.remove('is-visible');
    const live=isLive(),data=new FormData(_formEl),errors=[];
    const title=String(data.get('title')||'').trim(),lat=Number(data.get('lat')),lng=Number(data.get('lng')),photo=data.get('photo');
    if(!live&&!data.get('reported_level'))errors.push('Choose the reported risk level first.');
    if(!live&&!data.get('category'))errors.push('Choose a fire hazard category.');
    if(!_pinConfirmed||!data.get('lat')||!data.get('lng')||!inBounds(lat,lng))errors.push('Pin a location within Batangas City.');
    if(!live&&(title.length<5||title.length>180)){errors.push('Give the hazard a title between 5 and 180 characters.');el('report-hazard-step').open=true;}
    if(!live&&photo?.size>5*1024*1024)errors.push('Keep the photo under 5 MB.');
    if(!live&&photo?.size&&!['image/jpeg','image/png','image/webp'].includes(photo.type))errors.push('Choose a JPG, PNG or WebP photo.');
    if(errors.length){showErrors(errors);return;}
    if(live){for(const key of ['title','description','address','photo','barangay_id','reported_level'])data.delete(key);}
    const selected=_barangays.find(b=>String(b.id)===el('report-barangay').value);
    const barangayName=(!live&&selected?selected:_nearest)?.name;
    submit.disabled=true;submit.setAttribute('aria-busy','true');submit.textContent=live?'Saving location…':'Saving report…';
    // Show contacts in the same interaction: neither a network request nor Gemini blocks access.
    if(live)showSuccessModal({status:'active',pending:true,contacts:_contacts,barangay:{name:barangayName,inferred:true}});
    try {
        const result=await submitReport(data);
        const showResult=!live||_modalEl.open;
        resetReport();
        if(_onReportSuccess) _onReportSuccess(result.hazard_id);
        if(!live)window.dispatchEvent(new CustomEvent('assessment:requested'));
        showSuccessModal(result,showResult);
    }catch(error){
        showErrors(error.details||[error.message||'The report could not be saved. Please retry.']);
        if(live){el('modal-ref-number').textContent='Location not saved';el('modal-ai-score-box').textContent='The report could not be saved. Contacts remain available to copy and call manually.';_modalEl.dataset.state='failed';}
    }finally{
        submit.disabled=false;submit.removeAttribute('aria-busy');submit.textContent=isLive()?'Alert · view responder contacts':'Submit hazard report';
    }
}
function resetReport() {
    _formEl.reset();_pinConfirmed=false;_nearest=null;
    _miniMapCtrl?.clear();
    el('report-coords-display').textContent='No location pinned yet';el('report-location-summary').textContent='Pin a location';el('report-nearest-barangay').textContent='';
    el('photo-dropzone').classList.remove('has-file');el('photo-upload-label').textContent='Drop a photo or click to browse';
    chooseRisk('');
}
function showSuccessModal(data,open=true) {
    const live=data.status==='active';
    _modalEl.dataset.state=data.pending?'saving':'saved';
    el('modal-title-text').textContent=live?'Contact responders':'Report saved';
    el('modal-ref-number').textContent=data.pending?'Saving your pinned location…':data.ref_number||'';
    const scoreBox=el('modal-ai-score-box');
    if(live)scoreBox.textContent=data.pending?'Your contacts are ready. Copy a number below to call manually.':'Live fire location saved. Use the contacts below to call manually.';
    else if(data.ai_result?.assessment){const a=data.ai_result.assessment;scoreBox.textContent=`Gemini assessment: ${a.assessed_level==='heavy'?'High':a.assessed_level} · ${a.overall_score}/100. ${a.reasoning_summary}`;}
    else scoreBox.textContent=['queued','processing'].includes(data.ai_status)?'Report saved. Gemini is assessing your observations in the background. Your selected risk is shown until assessment completes.':'Report saved. Gemini is unavailable; your selected risk remains labelled as reporter-selected.';
    const contacts=responderContacts(data.contacts||[],data.barangay?.name);
    el('report-contact-list').innerHTML=contacts.map((contact,index)=>`<article class="responder-card"><div class="responder-card-heading"><strong>${escapeHtml(contact.name)}</strong>${contact.mock?'<span class="sample-contact-tag">Sample contact</span>':''}</div><small>${escapeHtml(contact.jurisdiction)}${data.barangay?.inferred&&contact.agency==='barangay'?' · nearest to pin':''}</small><div class="contact-copy-row"><input readonly class="contact-copy-number" aria-label="${escapeHtml(contact.name)} number" value="${escapeHtml(contact.number)}"><button type="button" class="copy-contact" data-contact-index="${index}">Copy</button></div>${contact.mock?'<p class="sample-contact-note">Mock number for demonstration. Replace with a verified number before real use.</p>':''}</article>`).join('');
    el('report-contact-list').querySelectorAll('.copy-contact').forEach(button=>button.addEventListener('click',async()=>{
        const contact=contacts[Number(button.dataset.contactIndex)];
        try {if(!navigator.clipboard?.writeText)throw new Error('Clipboard unavailable');await navigator.clipboard.writeText(contact.number);button.textContent='Copied';el('report-contact-status').textContent=contact.mock?'Sample number copied. This is not an operational emergency contact.':'Number copied. Call manually to contact responders.';}
        catch {const input=button.previousElementSibling;input.focus();input.select();el('report-contact-status').textContent='The number is selected. Use Copy on your device.';}
        if(data.ref_number&&['bfp','barangay'].includes(contact.agency))logReportAction(data.ref_number,contact.agency).catch(()=>{});
    }));
    el('report-contact-status').textContent='';
    if(open){if(!_modalEl.open)_modalEl.showModal();_modalEl.classList.add('is-visible');}
}
export function closeModal(){dismissDialog(_modalEl,'is-visible');}
