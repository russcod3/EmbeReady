/**
 * public/js/report.js
 * ─────────────────────────────────────────────────────────────────────────────
 * EmbeReady — Community Hazard Report Module
 * Handles form validation, coordinates from mini-map, photo drag-and-drop,
 * submission to /api/reports, and post-submission modal with BFP/Barangay actions.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import S from '../strings.js';
import { fetchBarangays, submitReport, logReportAction } from './api.js';
import { initReportMiniMap } from './map.js';

let _formEl = null;
let _modalEl = null;
let _miniMapCtrl = null;
let _barangays = [];
let _onReportSuccess = null;

/**
 * initReportForm(onReportSuccess)
 */
export async function initReportForm(onReportSuccess) {
    _onReportSuccess = onReportSuccess;
    _formEl = document.getElementById('hazard-report-form');
    _modalEl = document.getElementById('report-modal');

    if (!_formEl) return;

    // Load barangays into select dropdown
    await loadBarangays();

    // Initialize mini-map
    _miniMapCtrl = initReportMiniMap('report-minimap', (lat, lng) => {
        const latInput = document.getElementById('report-lat');
        const lngInput = document.getElementById('report-lng');
        const coordDisplay = document.getElementById('report-coords-display');
        if (latInput) latInput.value = lat.toFixed(6);
        if (lngInput) lngInput.value = lng.toFixed(6);
        if (coordDisplay) coordDisplay.textContent = `${lat.toFixed(5)}°N, ${lng.toFixed(5)}°E`;
    });

    // When barangay changes, center mini-map to that barangay's coordinates
    const bgySelect = document.getElementById('report-barangay');
    if (bgySelect) {
        bgySelect.addEventListener('change', () => {
            const bgyId = parseInt(bgySelect.value, 10);
            const found = _barangays.find(b => b.id === bgyId);
            if (found && _miniMapCtrl) {
                _miniMapCtrl.setLatLng(found.center_lat, found.center_lng);
            }
        });
    }

    // Photo drag & drop + file input handler
    setupPhotoUpload();

    // Form submit handler
    _formEl.addEventListener('submit', handleFormSubmit);

    // Modal close button
    if (_modalEl) {
        const closeBtn = _modalEl.querySelector('.modal-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', closeModal);
        }
    }
}

/**
 * refreshMiniMap()
 * Invalidate size when report section is scrolled to or made visible.
 */
export function refreshMiniMap() {
    if (_miniMapCtrl) _miniMapCtrl.invalidate();
}

/**
 * loadBarangays()
 */
async function loadBarangays() {
    try {
        _barangays = await fetchBarangays();
        const select = document.getElementById('report-barangay');
        if (!select) return;

        // Clear existing options except placeholder
        select.innerHTML = `<option value="">-- ${S.report.barangayDefault} --</option>`;
        _barangays.forEach(b => {
            const opt = document.createElement('option');
            opt.value = b.id;
            opt.textContent = `${b.name} (${b.classification})`;
            select.appendChild(opt);
        });
    } catch (err) {
        console.error('[Report] Failed to load barangays:', err);
    }
}

/**
 * setupPhotoUpload()
 */
function setupPhotoUpload() {
    const uploadArea = document.getElementById('photo-dropzone');
    const fileInput  = document.getElementById('report-photo-input');
    const labelEl    = document.getElementById('photo-upload-label');
    if (!uploadArea || !fileInput) return;

    uploadArea.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', () => {
        if (fileInput.files && fileInput.files[0]) {
            const file = fileInput.files[0];
            uploadArea.classList.add('has-file');
            if (labelEl) labelEl.textContent = `Selected: ${file.name} (${Math.round(file.size / 1024)} KB)`;
        }
    });

    ['dragenter', 'dragover'].forEach(eventName => {
        uploadArea.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            uploadArea.style.borderColor = 'var(--color-green-400)';
            uploadArea.style.background  = 'rgba(5,150,105,0.1)';
        });
    });

    ['dragleave', 'drop'].forEach(eventName => {
        uploadArea.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            uploadArea.style.borderColor = '';
            uploadArea.style.background  = '';
        });
    });

    uploadArea.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files && files.length > 0) {
            fileInput.files = files;
            uploadArea.classList.add('has-file');
            if (labelEl) labelEl.textContent = `Selected: ${files[0].name} (${Math.round(files[0].size / 1024)} KB)`;
        }
    });
}

/**
 * handleFormSubmit(e)
 */
async function handleFormSubmit(e) {
    e.preventDefault();

    const errorContainer = document.getElementById('form-errors');
    const errorList = document.getElementById('form-errors-list');
    const submitBtn = document.getElementById('report-submit-btn');

    if (errorContainer) errorContainer.classList.remove('is-visible');
    if (errorList) errorList.innerHTML = '';

    const formData = new FormData(_formEl);

    // Client-side validations
    const title = (formData.get('title') || '').trim();
    const barangayId = formData.get('barangay_id');
    const lat = parseFloat(formData.get('lat'));
    const lng = parseFloat(formData.get('lng'));
    const photo = formData.get('photo');

    const errors = [];
    if (!title || title.length < 5) {
        errors.push('Hazard title must be at least 5 characters long.');
    }
    if (!barangayId) {
        errors.push('Please select a barangay.');
    }
    if (isNaN(lat) || isNaN(lng)) {
        errors.push('Please drop a pin on the mini-map to set location coordinates.');
    } else {
        // Batangas bounds check
        if (lat < 13.60 || lat > 13.85 || lng < 120.93 || lng > 121.14) {
            errors.push('Pin location must be within Batangas City limits.');
        }
    }

    if (photo && photo.size > 5 * 1024 * 1024) {
        errors.push('Photo file size must not exceed 5 MB.');
    }

    if (errors.length > 0) {
        showErrors(errors);
        return;
    }

    // Submit
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = S.report.submitting;
    }

    try {
        const result = await submitReport(formData);

        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = S.report.submitBtn;
        }

        // Reset form fields
        _formEl.reset();
        const uploadArea = document.getElementById('photo-dropzone');
        const labelEl = document.getElementById('photo-upload-label');
        if (uploadArea) uploadArea.classList.remove('has-file');
        if (labelEl) labelEl.textContent = S.report.photoLabel;

        // Show confirmation modal
        showSuccessModal(result, title);

        // Notify app to refresh map & open drawer for new report
        if (_onReportSuccess && result.hazard_id) {
            _onReportSuccess(result.hazard_id);
        }
    } catch (err) {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = S.report.submitBtn;
        }

        const msgList = err.details || [err.message || 'Submission failed. Please try again.'];
        showErrors(msgList);
    }
}

function showErrors(errs) {
    const errorContainer = document.getElementById('form-errors');
    const errorList = document.getElementById('form-errors-list');
    if (!errorContainer || !errorList) return;

    errorList.innerHTML = errs.map(msg => `<li>${escapeHtml(msg)}</li>`).join('');
    errorContainer.classList.add('is-visible');
    errorContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/**
 * showSuccessModal(data, hazardTitle)
 */
function showSuccessModal(data, hazardTitle) {
    if (!_modalEl) return;

    const refEl = document.getElementById('modal-ref-number');
    const scoreBox = document.getElementById('modal-ai-score-box');
    const bfpBtn = document.getElementById('modal-action-bfp');
    const brgyBtn = document.getElementById('modal-action-brgy');
    const doneBtn = document.getElementById('modal-action-done');

    const refNumber = data.ref_number || 'ER-RECORDED';
    if (refEl) refEl.textContent = refNumber;

    // AI assessment preview
    if (scoreBox) {
        if (data.ai_result?.assessment) {
            const score = data.ai_result.assessment.overall_score;
            const level = data.ai_result.assessment.assessed_level.toUpperCase();
            scoreBox.innerHTML = `
                <div style="font-family:var(--font-display);font-size:var(--text-sm);font-weight:700;color:var(--text-on-light);margin-bottom:4px;">
                    AI RISK ASSESSMENT: <span style="color:var(--risk-${data.ai_result.assessment.assessed_level});">${level} (${score}/100)</span>
                </div>
                <div style="font-size:var(--text-xs);color:var(--color-charcoal-500);line-height:1.4;">
                    ${escapeHtml(data.ai_result.assessment.reasoning_summary || 'Preliminary field evaluation recorded.')}
                </div>
            `;
            scoreBox.style.display = 'block';
        } else {
            scoreBox.style.display = 'none';
        }
    }

    // Action: Report to BFP Batangas City
    if (bfpBtn) {
        bfpBtn.onclick = async () => {
            await logReportAction(refNumber, 'bfp');
            const smsBody = encodeURIComponent(`EmbeReady Report ${refNumber}: Fire hazard reported at ${hazardTitle}. Please check.`);
            // Batangas BFP contact
            window.location.href = `sms:?&body=${smsBody}`;
            closeModal();
        };
    }

    // Action: Report to Barangay Hall
    if (brgyBtn) {
        brgyBtn.onclick = async () => {
            await logReportAction(refNumber, 'barangay');
            // Check if barangay contact exists
            const brgyContact = (data.contacts || []).find(c => c.contact_type === 'barangay');
            if (brgyContact && !brgyContact.phone.includes('REPLACE-ME')) {
                window.location.href = `tel:${brgyContact.phone.replace(/[^0-9+]/g, '')}`;
            } else {
                alert(`Barangay Hall contact number for this area is listed as: ${brgyContact ? brgyContact.phone : 'Not configured'}`);
            }
            closeModal();
        };
    }

    // Action: Done
    if (doneBtn) {
        doneBtn.onclick = async () => {
            await logReportAction(refNumber, 'none');
            closeModal();
        };
    }

    _modalEl.classList.add('is-visible');
}

export function closeModal() {
    if (_modalEl) {
        _modalEl.classList.remove('is-visible');
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
