/**
 * public/js/drawer.js
 * ─────────────────────────────────────────────────────────────────────────────
 * EmbeReady — Detail Drawer Module
 * Renders complete hazard analysis:
 * - Header & status badges
 * - Field slot / photo display
 * - Fire incident history
 * - AI risk breakdown & expandable factor bars
 * - 5-tab preparedness plan & evacuation notes
 * - One-tap emergency contacts
 * ─────────────────────────────────────────────────────────────────────────────
 */

import S from '../strings.js';
import { escapeHtml } from './utils.js';
import { fetchHazardDetail } from './api.js';
import { riskCardsMarkup, initRiskCards } from './risk-cards.js';
import { assessmentText, isPreparedAssessment } from './assessment-copy.js';
import { initPlanNavigation } from './plan-navigation.js';

let _drawerEl = null;
let _closeBtn = null;
let _contentEl = null;
let _activeTimerInterval = null;
let _currentHazardId=null, _requestVersion=0, _cleanupCards=()=>{}, _assessmentKey="";
let _currentData = null;
let _refreshVersion = 0;
let _cleanupPlanNavigation = () => {};
const resultKey=data=>`${data.hazard.status}:${data.hazard.verification_status}:${data.hazard.ai_status}:${data.assessment?.id||""}:${data.hazard.ai_error||""}`;

/**
 * initDrawer()
 * Binds DOM elements and event listeners.
 */
export function initDrawer() {
    _drawerEl = document.getElementById('hazard-drawer');
    if (!_drawerEl) return;

    _closeBtn = _drawerEl.querySelector('.drawer-close-btn');
    _contentEl = _drawerEl.querySelector('.drawer-inner');

    if (_closeBtn) {
        _closeBtn.addEventListener('click', closeDrawer);
    }

    // Close on Escape key
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && isDrawerOpen() && !document.querySelector('dialog[open]')) {
            closeDrawer();
        }
    });

    window.addEventListener('hazards:updated', async()=>{
        if(!_currentHazardId||!isDrawerOpen())return;
        const id = _currentHazardId, version = _requestVersion, refresh = ++_refreshVersion;
        try {
            const data=await fetchHazardDetail(id);
            if (id !== _currentHazardId || version !== _requestVersion || refresh !== _refreshVersion || resultKey(data) === _assessmentKey) return;
            const scroll=_contentEl.scrollTop,index=Number(_contentEl.querySelector('.factor-carousel')?.dataset.index||0);
            renderHazardContent(data,index);_contentEl.scrollTop=scroll;
        } catch (error) {
            if (error.status === 404 && id === _currentHazardId && version === _requestVersion && refresh === _refreshVersion) closeDrawer();
        }
    });
    window.addEventListener('language:changed', () => {
        if (!_currentData || !isDrawerOpen()) return;
        const scroll = _contentEl.scrollTop;
        const index = Number(_contentEl.querySelector('.factor-carousel')?.dataset.index || 0);
        const tab = _contentEl.querySelector('.plan-tab.is-active')?.dataset.tabTarget;
        renderHazardContent(_currentData, index);
        if (tab) _contentEl.querySelector(`[data-tab-target="${tab}"]`)?.click();
        _contentEl.scrollTop = scroll;
    });
}

export function isDrawerOpen() {
    return _drawerEl && _drawerEl.classList.contains('is-open');
}

export function closeDrawer() {
    if (!_drawerEl) return;
    _requestVersion++;_currentHazardId=null;_currentData=null;_cleanupCards();_cleanupPlanNavigation();
    _drawerEl.classList.remove('is-open');
    document.body.classList.remove('drawer-open');
    if (_activeTimerInterval) {
        clearInterval(_activeTimerInterval);
        _activeTimerInterval = null;
    }
}

/**
 * openDrawer(hazardId)
 * Fetches full hazard details and renders content.
 */
export async function openDrawer(hazardId) {
    if (!_drawerEl || !_contentEl) return;

    if (_activeTimerInterval) {
        clearInterval(_activeTimerInterval);
        _activeTimerInterval = null;
    }

    const version=++_requestVersion;_currentHazardId=hazardId;_currentData=null;_cleanupCards();_cleanupPlanNavigation();
    // Show loading state
    _contentEl.innerHTML = `
        <div style="padding: var(--space-8); text-align: center; color: var(--color-charcoal-400);">
            <div style="font-family: var(--font-display); font-size: var(--text-lg); text-transform: uppercase; margin-bottom: 8px;">
                ${S.drawer.loading}
            </div>
            <div style="font-family: var(--font-mono); font-size: var(--text-xs); color: var(--color-charcoal-300);">
                ${S.drawer.preparing}
            </div>
        </div>
    `;

    _drawerEl.classList.add('is-open');
    document.body.classList.add('drawer-open');

    try {
        const data = await fetchHazardDetail(hazardId);
        if(version!==_requestVersion)return;
        renderHazardContent(data);
    } catch (err) {
        if(version!==_requestVersion)return;
        _contentEl.innerHTML = `
            <div style="padding: var(--space-8); text-align: center; color: var(--risk-heavy);">
                <div style="font-family: var(--font-display); font-size: var(--text-lg); margin-bottom: 8px;">
                    ${S.drawer.loadFailed}
                </div>
                <div style="font-size: var(--text-sm); color: var(--color-charcoal-400);">
                    ${escapeHtml(err.message || 'Server error')}
                </div>
            </div>
        `;
    }
}

/**
 * renderHazardContent({ hazard, assessment, plan, history, contacts })
 */
function renderHazardContent({ hazard, assessment, plan, history, contacts },cardIndex=0) {
    _cleanupPlanNavigation();
    _currentData = { hazard, assessment, plan, history, contacts };
    _cleanupCards();
    _assessmentKey=resultKey({hazard,assessment});
    if (_activeTimerInterval) {
        clearInterval(_activeTimerInterval);
        _activeTimerInterval = null;
    }

    const isLive = hazard.status === 'active';
    const wasLive = Boolean(hazard.active_started_at) || isLive;
    const isDemo = hazard.is_demo === 1 || assessment?.engine === 'mock';
    const prepared = isPreparedAssessment(assessment);
    const confidenceLabel = {high:S.drawer.confidenceHigh,medium:S.drawer.confidenceMed,low:S.drawer.confidenceLow}[assessment?.confidence_level] || assessment?.confidence_level || '';
    const display = text => assessmentText(text, prepared);
    const displayFactors = assessment?.factors && Object.fromEntries(Object.entries(assessment.factors).map(([key, factor]) => [key, { ...factor, reason: display(factor.reason) }]));

    // Category label — guard against null/undefined category
    const categoryLabel = hazard.category
        ? (S.categories[hazard.category] || hazard.category.replace(/_/g, ' '))
        : 'Uncategorized';

    const photoSrc = hazard.photo_url;

    // Active fire duration
    let activeTimerHtml = '';
    if (isLive && hazard.active_started_at) {
        const started = new Date(hazard.active_started_at);
        const calcTime = () => {
            const diffMin = Math.max(0, Math.floor((Date.now() - started.getTime()) / 60000));
            if (diffMin < 60) return `${diffMin}m ago`;
            const hours = Math.floor(diffMin / 60);
            const remMin = diffMin % 60;
            return `${hours}h ${remMin}m ago`;
        };
        activeTimerHtml = `
            <div class="live-timer" id="drawer-live-timer">
                <span class="live-dot" style="display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--risk-heavy);animation:pulse-dot 1s infinite;"></span>
                <span>Active since: ${calcTime()}</span>
            </div>
        `;
    }

    const factorsHtml=displayFactors?riskCardsMarkup(displayFactors):'';

    // Preparedness tabs
    const beforeSteps = plan?.before_steps || plan?.before || [];
    const duringSteps = plan?.during_steps || plan?.during || [];
    const afterSteps = plan?.after_steps || plan?.after || [];
    const evacTips = plan?.evacuation_tips || [];
    const prohibited = plan?.prohibited_actions || [];

    const renderSteps = (steps, isProhibited = false) => {
        if (!steps || steps.length === 0) {
            return `<div style="font-size:var(--text-sm);color:var(--color-charcoal-400);padding:8px 0;">${S.drawer.noSteps}</div>`;
        }
        return `
            <div class="plan-steps">
                ${steps.map((step, idx) => `
                    <div class="plan-step">
                        <span class="plan-step-num">${isProhibited ? '✕' : (idx + 1).toString().padStart(2, '0')}</span>
                        <span>${escapeHtml(display(step))}</span>
                    </div>
                `).join('')}
            </div>
        `;
    };

    // Fire history
    let historyHtml = '';
    if (history && history.length > 0) {
        historyHtml = `
            <div class="history-list">
                ${history.map(item => `
                    <div class="history-item">
                        <div class="history-item-title">${escapeHtml(display(item.incident_name))} (${item.incident_year || 'Historical'})</div>
                        <div class="history-item-meta">Severity: ${escapeHtml((item.severity || 'moderate').toUpperCase())}</div>
                        ${item.damage_notes ? `<div class="history-item-notes">${escapeHtml(display(item.damage_notes))}</div>` : ''}
                    </div>
                `).join('')}
            </div>
        `;
    } else {
        historyHtml = `<div style="font-size:var(--text-sm);color:var(--color-charcoal-400);">${S.drawer.noHistory}</div>`;
    }

    // Emergency Contacts
    let contactsHtml = '';
    if (contacts && contacts.length > 0) {
        contactsHtml = `
            <div class="contacts-grid">
                ${contacts.map(c => {
            const name = c.name || c.facility_name || 'Unnamed contact';
            const phone = String(c.phone || c.phone_display || '');
            const ctype = String(c.contact_type || c.agency_type || '').toLowerCase();

            const is911 = phone === '911' || ctype === 'national';
            const isPlaceholder = !phone || phone.includes('REPLACE-ME') || phone.startsWith('09XX') || c.is_placeholder === 1;
            const callHref = isPlaceholder ? '#' : `tel:${phone.replace(/[^0-9+]/g, '')}`;
            const warnAttr = isPlaceholder ? `title="${S.drawer.placeholderWarn}"` : '';
            const extraClass = is911 ? 'contact-item-911' : '';
            const btnClass = isPlaceholder ? 'contact-call-btn is-placeholder' : 'contact-call-btn';

            return `
                        <div class="contact-item ${extraClass}">
                            <div class="contact-info">
                                <div class="contact-name">${escapeHtml(name)}</div>
                                <div class="contact-type">${escapeHtml(c.jurisdiction || ctype || '')}</div>
                                <div class="contact-phone">${escapeHtml(phone || 'Not configured')}</div>
                            </div>
                            <a href="${callHref}" class="${btnClass}" ${warnAttr}>
                                ${isPlaceholder ? S.drawer.unconfigured : S.drawer.call}
                            </a>
                        </div>
                    `;
        }).join('')}
            </div>
        `;
    }

    const verification = S.drawer.verification?.[hazard.verification_status];
    _contentEl.innerHTML = `
        <!-- HEADER -->
        <div class="drawer-header">
            <div class="drawer-badges">
                ${!wasLive ? `<span class="badge badge-${hazard.risk_level || 'pending'}">${S.map[hazard.risk_level] || (assessment ? S.drawer.moreEvidence : S.drawer.unavailable)}</span>` : ''}
${!assessment?.assessed_level&&hazard.reported_level?`<span class="badge badge-demo">${S.drawer.reporterSelected}</span>`:''}
                <span class="badge badge-${hazard.status}">${hazard.status === 'active' ? S.map.filterLive : S.statuses[hazard.status] || hazard.status}</span>

                ${verification ? `<span class="badge badge-${hazard.verification_status === 'verified' ? 'verified' : 'demo'}">${escapeHtml(verification)}</span>` : ''}
                ${isDemo ? '<span class="badge badge-demo">DEMO DATA</span>' : ''}
            </div>
            <h2 class="drawer-title">${escapeHtml(hazard.title)}</h2>
            <div class="drawer-ref">Ref: ${escapeHtml(hazard.ref_code)}</div>
            ${activeTimerHtml}
        </div>

        <!-- PHOTO SECTION -->
        ${!isLive ? `<div class="hazard-photo-wrap">
            ${photoSrc ? `<img src="${escapeHtml(photoSrc)}"
                 class="hazard-photo"
                 alt="${escapeHtml(hazard.title)}"
 />` : ''}
            <div class="photo-placeholder" style="display:${photoSrc?'none':'flex'};">
                <span class="photo-placeholder-icon">📷</span>
                <div class="photo-placeholder-text">
                    ${S.drawer.photoUnavailable}<br>
                    <span>${S.drawer.photoHint}</span>
                </div>
            </div>
        </div>` : ''}

        <!-- DETAILS / LOCATION -->
        <div class="drawer-section">
            <div class="drawer-section-label">${S.drawer.locationTitle}</div>
            <div class="drawer-meta-grid" style="margin-bottom:var(--space-3);">
                <div class="drawer-meta-item">
                    <span class="drawer-meta-key">${S.drawer.barangayLabel}</span>
                    <span class="drawer-meta-val">${escapeHtml(hazard.barangay_name)}</span>
                </div>
                <div class="drawer-meta-item">
                    <span class="drawer-meta-key">${S.drawer.classification}</span>
                    <span class="drawer-meta-val" style="text-transform:capitalize;">${escapeHtml(hazard.barangay_classification || 'Urban')}</span>
                </div>
                <div class="drawer-meta-item">
                    <span class="drawer-meta-key">${S.drawer.categoryLabel}</span>
                    <span class="drawer-meta-val">${escapeHtml(categoryLabel)}</span>
                </div>
                <div class="drawer-meta-item">
                    <span class="drawer-meta-key">${S.drawer.coordinates}</span>
                    <span class="drawer-meta-val" style="font-family:var(--font-mono);font-size:12px;">${parseFloat(hazard.lat || 0).toFixed(4)}°N, ${parseFloat(hazard.lng || 0).toFixed(4)}°E</span>
                </div>
            </div>
            ${hazard.address ? `
                <div style="font-size:var(--text-sm);color:var(--text-on-light);margin-bottom:var(--space-2);">
                    <strong>${S.drawer.addressLabel}:</strong> ${escapeHtml(hazard.address)}
                </div>
            ` : ''}
            ${hazard.description ? `
                <div class="drawer-description" style="font-size:var(--text-sm);color:var(--text-on-light-2);line-height:1.6;">
                    ${escapeHtml(display(hazard.description))}
                </div>
            ` : ''}
        </div>

        <!-- RISK ASSESSMENT -->
        <section class="risk-panel" aria-label="Risk assessment">
        ${assessment ? `
            <div class="risk-overview">
                <div class="risk-overall-value ${assessment.overall_score===null?'is-range':''}">${assessment.overall_score===null?`${assessment.score_range.min}–${assessment.score_range.max}`:assessment.overall_score}<small>/100</small></div>
                <div class="risk-overview-meta"><strong>${assessment.assessed_level?`${S.map[assessment.assessed_level] || assessment.assessed_level} ${S.drawer.risk}`:S.drawer.moreEvidence}</strong><span>${escapeHtml(confidenceLabel)}</span><span>${prepared ? S.drawer.preSeeded : S.drawer.gemini}</span></div>
            </div>
            ${factorsHtml}
            <p class="risk-summary">${escapeHtml(display(assessment.reasoning_summary))}</p>
            <p class="risk-disclaimer">${assessment.overall_score===null?S.drawer.rangeNote+' ':''}${S.drawer.disclaimer} ${assessment.action_priority==='immediate'?S.drawer.immediate:''}</p>
            ${assessment.missing_information?.length?`<div class="risk-missing"><strong>${S.drawer.unknown}</strong><br>${assessment.missing_information.map(item => escapeHtml(display(item))).join(' · ')}</div>`:''}
        ` : `<div class="assessment-empty"><strong>${isLive?S.drawer.liveReported:hazard.ai_status==='unavailable'?S.drawer.unavailable:S.drawer.assessing}</strong><p>${isLive?S.drawer.liveHelp:hazard.ai_status==='unavailable'?S.drawer.retryHelp:S.drawer.assessingHelp}</p></div>`}
        </section>

        <!-- PREPAREDNESS PLAN -->
        ${plan ? `<div class="drawer-section" style="padding:0;">
            <div style="padding:var(--space-3) var(--space-5);background:var(--color-charcoal-800);color:var(--color-bone-200);display:flex;align-items:center;justify-content:space-between;">
                <span style="font-family:var(--font-display);font-size:var(--text-sm);font-weight:700;letter-spacing:0.06em;text-transform:uppercase;">${S.drawer.preparedness}</span>
                <span style="font-family:var(--font-mono);font-size:10px;color:var(--color-charcoal-300);">${prepared ? S.drawer.guidance : S.drawer.geminiGuidance}</span>
            </div>
            <div class="plan-tabs-shell"><button type="button" class="plan-scroll-arrow plan-scroll-left" data-plan-scroll="-1" aria-label="${S.drawer.scrollPlanLeft}">‹</button><div class="plan-tabs" role="tablist">
                <button class="plan-tab is-active" data-tab-target="before">${S.drawer.tabBefore}</button>
                <button class="plan-tab" data-tab-target="during">${S.drawer.tabDuring}</button>
                <button class="plan-tab" data-tab-target="after">${S.drawer.tabAfter}</button>
                <button class="plan-tab" data-tab-target="evac">${S.drawer.tabEvacuation}</button>
                <button class="plan-tab" data-tab-target="prohibited">${S.drawer.tabProhibited}</button>
            </div></div>
            <div class="plan-content is-active" data-tab="before">
                ${renderSteps(beforeSteps)}
            </div>
            <div class="plan-content" data-tab="during">
                ${renderSteps(duringSteps)}
            </div>
            <div class="plan-content" data-tab="after">
                ${renderSteps(afterSteps)}
            </div>
            <div class="plan-content" data-tab="evac">
                ${renderSteps(evacTips)}
            </div>
            <div class="plan-content" data-tab="prohibited">
                ${renderSteps(prohibited, true)}
            </div>
            ${!prepared && plan?.local_context_notes ? `
                <div style="padding: 0 var(--space-5) var(--space-4);">
                    <div class="plan-local-note">
                        <strong>${S.drawer.context}:</strong> ${escapeHtml(plan.local_context_notes)}
                    </div>
                </div>
            ` : ''}
            ${hazard.evacuation_center_name ? `
                <div style="padding: 0 var(--space-5) var(--space-4);">
                    <div class="plan-local-note" style="background:rgba(217,119,6,0.08);border-color:rgba(217,119,6,0.3);">
                        <strong>${S.drawer.evacuationSite}:</strong> ${escapeHtml(hazard.evacuation_center_name)}
                    </div>
                </div>
            ` : ''}
        </div>` : ''}

        <!-- FIRE HISTORY -->
        <div class="drawer-section">
            <div class="drawer-section-label">${S.drawer.historyTitle}</div>
            ${historyHtml}
        </div>

        <!-- EMERGENCY CONTACTS -->
        <div class="drawer-section">
            <div class="drawer-section-label">${S.drawer.contactsTitle}</div>
            ${contactsHtml}
        </div>
    `;

    const photo = _contentEl.querySelector('.hazard-photo');
    const fallback = () => { photo.style.display = 'none'; photo.nextElementSibling.style.display = 'flex'; };
    if (photo) {
        photo.addEventListener('error', fallback);
        if (photo.complete && !photo.naturalWidth) fallback();
    }

    _contentEl.querySelectorAll('.is-placeholder').forEach(link => { link.setAttribute('aria-disabled', 'true'); link.addEventListener('click', e => e.preventDefault()); });
    _contentEl.querySelector('.drawer-header').after(_contentEl.querySelector('.risk-panel'));
    if(displayFactors)_cleanupCards=initRiskCards(_contentEl,displayFactors,cardIndex);

    // Bind tab clicks
    const planTabs = _contentEl.querySelector('.plan-tabs');
    if (planTabs) {
        planTabs.insertAdjacentHTML('afterend', `<button type="button" class="plan-scroll-arrow plan-scroll-right" data-plan-scroll="1" aria-label="${S.drawer.scrollPlanRight}">›</button>`);
        _cleanupPlanNavigation = initPlanNavigation(_contentEl);
    }
    const tabs = _contentEl.querySelectorAll('.plan-tab');
    const tabPanels = _contentEl.querySelectorAll('.plan-content');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const target = tab.getAttribute('data-tab-target');
            tabs.forEach(t => t.classList.remove('is-active'));
            tabPanels.forEach(p => p.classList.remove('is-active'));
            tab.classList.add('is-active');
            const panel = _contentEl.querySelector(`.plan-content[data-tab="${target}"]`);
            if (panel) panel.classList.add('is-active');
        });
    });

    // If active fire, refresh timer every minute
    if (isLive && hazard.active_started_at) {
        _activeTimerInterval = setInterval(() => {
            const timerEl = document.getElementById('drawer-live-timer');
            if (!timerEl) return;
            const started = new Date(hazard.active_started_at);
            const diffMin = Math.max(0, Math.floor((Date.now() - started.getTime()) / 60000));
            let text = `${diffMin}m ago`;
            if (diffMin >= 60) {
                const hours = Math.floor(diffMin / 60);
                const remMin = diffMin % 60;
                text = `${hours}h ${remMin}m ago`;
            }
            timerEl.innerHTML = `
                <span class="live-dot" style="display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--risk-heavy);animation:pulse-dot 1s infinite;"></span>
                <span>Active since: ${text}</span>
            `;
        }, 30000);
    }
}

