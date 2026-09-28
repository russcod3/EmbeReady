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
import { fetchHazardDetail } from './api.js';

let _drawerEl = null;
let _closeBtn = null;
let _contentEl = null;
let _activeTimerInterval = null;

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
        if (e.key === 'Escape' && isDrawerOpen()) {
            closeDrawer();
        }
    });

    // Mobile: handle swipe down or clicking backdrop if needed
}

export function isDrawerOpen() {
    return _drawerEl && _drawerEl.classList.contains('is-open');
}

export function closeDrawer() {
    if (!_drawerEl) return;
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

    // Show loading state
    _contentEl.innerHTML = `
        <div style="padding: var(--space-8); text-align: center; color: var(--color-charcoal-400);">
            <div style="font-family: var(--font-display); font-size: var(--text-lg); text-transform: uppercase; margin-bottom: 8px;">
                Loading field dispatch…
            </div>
            <div style="font-family: var(--font-mono); font-size: var(--text-xs); color: var(--color-charcoal-300);">
                Querying hazard ID #${hazardId}
            </div>
        </div>
    `;

    _drawerEl.classList.add('is-open');
    document.body.classList.add('drawer-open');

    try {
        const data = await fetchHazardDetail(hazardId);
        renderHazardContent(data);
    } catch (err) {
        _contentEl.innerHTML = `
            <div style="padding: var(--space-8); text-align: center; color: var(--risk-heavy);">
                <div style="font-family: var(--font-display); font-size: var(--text-lg); margin-bottom: 8px;">
                    Failed to load hazard
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
function renderHazardContent({ hazard, assessment, plan, history, contacts }) {
    if (_activeTimerInterval) {
        clearInterval(_activeTimerInterval);
        _activeTimerInterval = null;
    }

    const isLive = hazard.status === 'active';
    const isDemo = hazard.is_demo === 1;

    // Category label
    const categoryLabel = S.categories[hazard.category] || hazard.category.replace(/_/g, ' ');

    // Calculate seed slot name (e.g. hazard-01.jpg)
    const slotNum = String(hazard.id).padStart(2, '0');
    const seedSlotPath = `/uploads/seed/hazard-${slotNum}.jpg`;
    const photoSrc = hazard.photo_url || seedSlotPath;

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

    // Build Risk factors breakdown
    let factorsHtml = '';
    if (assessment && assessment.factors) {
        const factorEntries = Object.entries(assessment.factors);
        factorsHtml = factorEntries.map(([key, f]) => {
            const pct = Math.round((f.score / f.max_score) * 100);
            let pctAttr = 'data-pct-low';
            if (pct >= 70) pctAttr = 'data-pct-high';
            else if (pct >= 40) pctAttr = 'data-pct-mod';

            const cleanName = key.replace(/_/g, ' ');
            return `
                <div class="factor-item" data-factor="${escapeHtml(key)}">
                    <div class="factor-header">
                        <span class="factor-name">${escapeHtml(cleanName)}</span>
                        <span class="factor-score">${f.score} / ${f.max_score}</span>
                    </div>
                    <div class="factor-bar-track">
                        <div class="factor-bar-fill" ${pctAttr} style="width: ${pct}%"></div>
                    </div>
                    <div class="factor-reason">${escapeHtml(f.reason || '')}</div>
                </div>
            `;
        }).join('');
    }

    // Preparedness tabs
    const beforeSteps = plan?.before || [];
    const duringSteps = plan?.during || [];
    const afterSteps  = plan?.after || [];
    const evacTips    = plan?.evacuation_tips || [];
    const prohibited  = plan?.prohibited_actions || [];

    const renderSteps = (steps, isProhibited = false) => {
        if (!steps || steps.length === 0) {
            return '<div style="font-size:var(--text-sm);color:var(--color-charcoal-400);padding:8px 0;">No instructions recorded for this phase.</div>';
        }
        return `
            <div class="plan-steps">
                ${steps.map((step, idx) => `
                    <div class="plan-step">
                        <span class="plan-step-num">${isProhibited ? '✕' : (idx + 1).toString().padStart(2, '0')}</span>
                        <span>${escapeHtml(step)}</span>
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
                        <div class="history-item-title">${escapeHtml(item.incident_name)} (${item.incident_year || 'Historical'})</div>
                        <div class="history-item-meta">Severity: ${escapeHtml((item.severity || 'moderate').toUpperCase())}</div>
                        ${item.damage_notes ? `<div class="history-item-notes">${escapeHtml(item.damage_notes)}</div>` : ''}
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
                    const is911 = c.phone === '911' || c.contact_type === 'national';
                    const isPlaceholder = c.phone.includes('REPLACE-ME') || c.phone.startsWith('09XX');
                    const callHref = isPlaceholder ? 'javascript:void(0)' : `tel:${c.phone.replace(/[^0-9+]/g, '')}`;
                    const warnAttr = isPlaceholder ? `title="${S.drawer.placeholderWarn}"` : '';
                    const extraClass = is911 ? 'contact-item-911' : '';
                    const btnClass   = isPlaceholder ? 'contact-call-btn is-placeholder' : 'contact-call-btn';

                    return `
                        <div class="contact-item ${extraClass}">
                            <div class="contact-info">
                                <div class="contact-name">${escapeHtml(c.name)}</div>
                                <div class="contact-type">${escapeHtml(c.jurisdiction || c.contact_type || '')}</div>
                                <div class="contact-phone">${escapeHtml(c.phone)}</div>
                            </div>
                            <a href="${callHref}" class="${btnClass}" ${warnAttr}>
                                ${isPlaceholder ? 'UNCONFIGURED' : 'CALL'}
                            </a>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    _contentEl.innerHTML = `
        <!-- HEADER -->
        <div class="drawer-header">
            <div class="drawer-badges">
                <span class="badge badge-${hazard.risk_level}">${hazard.risk_level}</span>
                <span class="badge badge-${hazard.status}">${hazard.status === 'active' ? 'ACTIVE FIRE' : hazard.status}</span>
                ${isLive ? '<span class="badge badge-live">LIVE</span>' : ''}
                ${isDemo ? '<span class="badge badge-demo">DEMO DATA</span>' : ''}
            </div>
            <h2 class="drawer-title">${escapeHtml(hazard.title)}</h2>
            <div class="drawer-ref">Ref: ${escapeHtml(hazard.ref_code)}</div>
            ${activeTimerHtml}
        </div>

        <!-- PHOTO SECTION -->
        <div class="hazard-photo-wrap">
            <img src="${photoSrc}"
                 class="hazard-photo"
                 alt="${escapeHtml(hazard.title)}"
                 onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
            <div class="photo-placeholder" style="display:none;">
                <span class="photo-placeholder-icon">📷</span>
                <div class="photo-placeholder-text">
                    ${S.drawer.photoSlot}<br>
                    <span style="font-size:9px;opacity:0.7;">Drop file: ./public${escapeHtml(seedSlotPath)}</span>
                </div>
            </div>
        </div>

        <!-- DETAILS / LOCATION -->
        <div class="drawer-section">
            <div class="drawer-section-label">Location & Description</div>
            <div class="drawer-meta-grid" style="margin-bottom:var(--space-3);">
                <div class="drawer-meta-item">
                    <span class="drawer-meta-key">Barangay</span>
                    <span class="drawer-meta-val">${escapeHtml(hazard.barangay_name)}</span>
                </div>
                <div class="drawer-meta-item">
                    <span class="drawer-meta-key">Classification</span>
                    <span class="drawer-meta-val" style="text-transform:capitalize;">${escapeHtml(hazard.barangay_classification || 'Urban')}</span>
                </div>
                <div class="drawer-meta-item">
                    <span class="drawer-meta-key">Hazard Category</span>
                    <span class="drawer-meta-val">${escapeHtml(categoryLabel)}</span>
                </div>
                <div class="drawer-meta-item">
                    <span class="drawer-meta-key">Coordinates</span>
                    <span class="drawer-meta-val" style="font-family:var(--font-mono);font-size:12px;">${hazard.lat.toFixed(4)}°N, ${hazard.lng.toFixed(4)}°E</span>
                </div>
            </div>
            ${hazard.address ? `
                <div style="font-size:var(--text-sm);color:var(--text-on-light);margin-bottom:var(--space-2);">
                    <strong>Address:</strong> ${escapeHtml(hazard.address)}
                </div>
            ` : ''}
            ${hazard.description ? `
                <div style="font-size:var(--text-sm);color:var(--color-charcoal-500);line-height:1.5;">
                    ${escapeHtml(hazard.description)}
                </div>
            ` : ''}
        </div>

        <!-- RISK ASSESSMENT -->
        ${assessment ? `
            <div class="drawer-section" style="padding:0;">
                <div class="risk-score-display">
                    <div class="risk-score-number">${assessment.overall_score}</div>
                    <div class="risk-score-meta">
                        <div class="risk-score-level-line">
                            <span class="badge badge-${assessment.assessed_level}">${assessment.assessed_level} RISK</span>
                            <span class="risk-confidence">${assessment.confidence_level.toUpperCase()} CONFIDENCE</span>
                        </div>
                        <div class="risk-engine-tag">
                            ${assessment.engine === 'llm' ? '● AI-GENERATED (LLM)' : '◆ RULE-BASED ESTIMATE'}
                        </div>
                    </div>
                </div>
                ${assessment.reasoning_summary ? `
                    <div class="risk-reasoning">
                        "${escapeHtml(assessment.reasoning_summary)}"
                    </div>
                ` : ''}
                <div class="factor-list">
                    <div style="padding:var(--space-3) var(--space-5);font-family:var(--font-mono);font-size:10px;color:var(--color-charcoal-400);text-transform:uppercase;letter-spacing:0.1em;border-bottom:1px solid var(--border-light);background:var(--color-bone-300);">
                        Risk Factors (Click row for field notes)
                    </div>
                    ${factorsHtml}
                </div>
            </div>
        ` : ''}

        <!-- PREPAREDNESS PLAN -->
        <div class="drawer-section" style="padding:0;">
            <div style="padding:var(--space-3) var(--space-5);background:var(--color-charcoal-800);color:var(--color-bone-200);display:flex;align-items:center;justify-content:space-between;">
                <span style="font-family:var(--font-display);font-size:var(--text-sm);font-weight:700;letter-spacing:0.06em;text-transform:uppercase;">Community Preparedness Plan</span>
                <span style="font-family:var(--font-mono);font-size:10px;color:var(--color-charcoal-300);">BFP PROTOCOL</span>
            </div>
            <div class="plan-tabs" role="tablist">
                <button class="plan-tab is-active" data-tab-target="before">Before</button>
                <button class="plan-tab" data-tab-target="during">During</button>
                <button class="plan-tab" data-tab-target="after">After</button>
                <button class="plan-tab" data-tab-target="evac">Evacuation</button>
                <button class="plan-tab" data-tab-target="prohibited">What NOT To Do</button>
            </div>
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
            ${plan?.local_context_notes ? `
                <div style="padding: 0 var(--space-5) var(--space-4);">
                    <div class="plan-local-note">
                        <strong>Barangay Context:</strong> ${escapeHtml(plan.local_context_notes)}
                    </div>
                </div>
            ` : ''}
            ${hazard.evacuation_center_name ? `
                <div style="padding: 0 var(--space-5) var(--space-4);">
                    <div class="plan-local-note" style="background:rgba(217,119,6,0.08);border-color:rgba(217,119,6,0.3);">
                        <strong>Designated Evacuation Site:</strong> ${escapeHtml(hazard.evacuation_center_name)}
                    </div>
                </div>
            ` : ''}
        </div>

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

    // Bind factor row toggles
    _contentEl.querySelectorAll('.factor-item').forEach(item => {
        item.addEventListener('click', () => {
            item.classList.toggle('is-expanded');
        });
    });

    // Bind tab clicks
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

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
