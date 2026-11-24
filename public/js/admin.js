'use strict';

const element = id => document.getElementById(id);
const decisionLabels = {
    pending: 'Pending',
    needs_verification: 'Needs verification',
    validated: 'Validated',
    dismissed: 'Dismissed'
};
const reasonLabels = {
    unclear_location: 'Unclear location',
    possible_duplicate: 'Possible duplicate',
    insufficient_evidence: 'Insufficient evidence',
    other: 'Other'
};
for (const id of ['reason-filter', 'review-reason']) {
    for (const [value, text] of Object.entries(reasonLabels)) element(id).add(new Option(text, value));
}

let previewMap;
let previewPins;
const assessmentStatuses = {
    queued: 'The Gemini assessment is queued.',
    processing: 'Gemini is assessing this report.',
    unavailable: 'The Gemini assessment is unavailable.',
    not_requested: 'Live-fire reports go straight to location and responder contacts.'
};
const dateFormat = new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Manila'
});

const filters = [...element('filters').querySelectorAll('button')];
const state = {
    decision: 'all', reason: 'all', query: '', page: 1, current: null, report: null,
    queueRequest: 0, detailRequest: 0
};

function label(value) {
    return value ? value.replace(/_/g, ' ').replace(/^./, char => char.toUpperCase()) : '—';
}

function date(value) {
    if (!value) return '—';
    const parsed = new Date(value.includes('T') ? value : value.replace(' ', 'T') + 'Z');
    return Number.isNaN(parsed.getTime()) ? '—' : dateFormat.format(parsed);
}

function message(id, text = '', error = false) {
    const output = element(id);
    output.textContent = text;
    output.dataset.error = error;
}

async function request(path, method = 'GET', body) {
    const options = { method, cache: 'no-store' };
    if (body !== undefined) {
        options.headers = { 'Content-Type': 'application/json' };
        options.body = JSON.stringify(body);
    }
    const response = await fetch('/api/admin' + path, options);
    const result = await response.json();
    if (!response.ok) {
        const error = new Error(result.error || 'The request could not be completed.');
        error.status = response.status;
        throw error;
    }
    return result;
}

function showSignedOut(text = '', failed = false, configured = true) {
    state.queueRequest++;
    state.detailRequest++;
    state.current = null;
    state.report = null;
    element('reviewer-dialog').close();
    element('add-reviewer').reset();
    element('manage-reviewers').hidden = true;
    element('reviewer-identity').hidden = true;
    previewPins?.clearLayers();
    element('reports').replaceChildren();
    element('detail-content').hidden = true;
    element('report-photo').removeAttribute('src');
    element('photo-link').removeAttribute('href');
    element('report-map').removeAttribute('href');
    for (const id of ['report-reference', 'report-facts', 'report-description', 'report-observations',
        'assessment-summary', 'assessment-factors', 'risk-comparison', 'missing-information',
        'nearby-reports', 'review-history', 'reviewer-list']) {
        element(id).replaceChildren();
    }
    element('notes').value = '';
    element('detail-heading').textContent = 'Report details';
    message('detail-message', 'Select a report to review its evidence.');
    element('workspace').hidden = true;
    element('sign-out').hidden = true;
    element('sign-in').hidden = !configured;
    element('reports').removeAttribute('aria-busy');
    message('page-message', text, failed);
}

function badge(node, decision) {
    node.textContent = decisionLabels[decision];
    node.dataset.decision = decision;
}

function textNode(tag, text, className) {
    const node = document.createElement(tag);
    node.textContent = text;
    if (className) node.className = className;
    return node;
}

function reportCard(report) {
    const item = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.reference = report.ref_number;
    if (state.current === report.ref_number) button.setAttribute('aria-current', 'true');
    const status = textNode('span', '', 'badge');
    badge(status, report.decision);
    const isLive = report.incident_status === 'active';
    const meta = [report.barangay, isLive ? 'Live fire' : label(report.reported_level), date(report.created_at)];
    button.append(
        textNode('span', report.ref_number, 'reference'),
        textNode('span', report.title || 'Report details unavailable', 'report-title'),
        status,
        textNode('span', meta.filter(Boolean).join(' · '), 'muted')
    );
    if (report.reason) button.append(textNode('span', reasonLabels[report.reason], 'queue-reason'));
    if (isLive) button.classList.add('live-report');
    item.append(button);
    return item;
}

async function loadQueue() {
    const sequence = ++state.queueRequest;
    const query = new URLSearchParams({ decision: state.decision, q: state.query, reason: state.reason, page: state.page });
    element('reports').setAttribute('aria-busy', 'true');
    message('queue-message', 'Loading reports…');
    element('refresh').disabled = true;
    element('previous').disabled = true;
    element('next').disabled = true;
    try {
        const { data, counts, page, pages, total, reviewer } = await request('/reports?' + query);
        if (sequence !== state.queueRequest) return;
        state.page = page;
        element('sign-in').hidden = true;
        element('sign-out').hidden = false;
        element('reviewer-identity').textContent = reviewer.username;
        element('reviewer-identity').hidden = false;
        element('manage-reviewers').hidden = !reviewer.owner;
        element('workspace').hidden = false;
        message('page-message');
        for (const button of filters) {
            button.querySelector('strong').textContent = counts[button.dataset.decision];
            button.setAttribute('aria-pressed', String(button.dataset.decision === state.decision));
        }
        element('reports').replaceChildren(...data.map(reportCard));
        element('pagination').hidden = pages < 2;
        element('page-number').textContent = `${page} of ${pages}`;
        element('previous').disabled = page === 1;
        element('next').disabled = page === pages;
        message('queue-message', total ? `${total} ${total === 1 ? 'report' : 'reports'}` : 'No community reports match this view.');
    } catch (error) {
        if (sequence !== state.queueRequest) return;
        if (error.status === 401) showSignedOut();
        else if (element('workspace').hidden) showSignedOut(error.message, true, error.status !== 503);
        else {
            message('queue-message', error.message, true);
            element('pagination').hidden = true;
        }
    } finally {
        if (sequence === state.queueRequest) {
            element('reports').removeAttribute('aria-busy');
            element('refresh').disabled = false;
        }
    }
}

function renderPairs(id, pairs) {
    element(id).replaceChildren(...pairs.map(([key, value]) => {
        const item = document.createElement('div');
        item.append(textNode('dt', key), textNode('dd', value));
        return item;
    }));
}

function updateNotesRequirement() {
    const decision = element('decision').value;
    const required = Boolean(decision && decision !== 'validated');
    element('review-reason-field').hidden = decision !== 'needs_verification';
    element('review-reason').required = decision === 'needs_verification';
    element('notes').required = required;
    element('notes-requirement').textContent = required ? '(required)' : '(optional)';
}

function renderReview(report) {
    badge(element('report-decision'), report.decision);
    element('decision').value = report.decision === 'pending' ? '' : report.decision;
    element('evaluated-level').value = report.evaluated_level || '';
    element('notes').value = report.notes || '';
    element('review-reason').value = report.reason || '';
    element('review-time').textContent = report.reviewed_at ? `Updated ${date(report.reviewed_at)}` : '';
    updateNotesRequirement();
    renderHistory(report.history);
    renderRiskComparison(report);
}

function renderAssessment(report) {
    const assessment = report.assessment;
    let summary = assessmentStatuses[report.ai_status] || 'No saved Gemini assessment.';
    if (assessment) {
        const range = assessment.score_range;
        let score = 'Score unavailable';
        if (Number.isFinite(assessment.overall_score)) score = `${assessment.overall_score}/100`;
        else if (range) score = `${range.min}–${range.max}/100 estimated range`;
        const parts = [assessment.assessed_level ? `${label(assessment.assessed_level)} risk` : 'Risk level undetermined',
            score, `${label(assessment.confidence_level)} confidence`];
        summary = [parts.join(' · '), assessment.reasoning_summary].filter(Boolean).join('\n');
    }
    element('assessment-summary').textContent = summary;
    const missing = Array.isArray(assessment?.missing_information) ? assessment.missing_information : [];
    element('assessment-missing').hidden = !missing.length;
    element('missing-information').replaceChildren(...missing.map(item => textNode('li', item)));
    const factors = Object.entries(assessment?.factors || {});
    element('assessment-details').hidden = !factors.length;
    element('assessment-details').open = false;
    renderPairs('assessment-factors', factors.map(([name, factor]) => {
        const score = Number.isFinite(factor.score) ? `${factor.score}/${factor.max_score}` : 'Insufficient evidence';
        return [label(name), `${score} · ${factor.reason}`];
    }));
}

function renderReport(report) {
    const isLive = report.incident_status === 'active';
    element('detail-heading').textContent = report.title || 'Report details unavailable';
    element('report-reference').textContent = report.ref_number;
    renderPairs('report-facts', [
        ['Barangay', report.barangay || '—'],
        ['Submitted', date(report.created_at)],
        ['Category', isLive ? 'Live fire' : label(report.category)],
        ['Incident status', label(report.incident_status)],
        ['Reported risk', isLive ? 'Live fire' : label(report.reported_level)],
        ['Address', report.address || '—']
    ]);

    const observations = Object.entries(report.observations || {});
    renderPairs('report-observations', observations.map(([name, value]) => [label(name), value]));
    const photo = element('report-photo');
    const photoLink = element('photo-link');
    photoLink.hidden = !/^\/uploads\/user\/[a-z0-9-]+\.(?:jpg|png|webp)$/i.test(report.photo_url || '');
    if (photoLink.hidden) photo.removeAttribute('src');
    else photo.src = photoLink.href = report.photo_url;
    element('report-description').textContent = report.description ||
        (observations.length || !photoLink.hidden ? '' : 'No additional evidence was submitted.');

    renderAssessment(report);
    renderReview(report);
    element('review-fields').disabled = false;
    element('detail-content').hidden = false;
    renderLocation(report);
    message('detail-message');
}

async function selectReport(ref) {
    const sequence = ++state.detailRequest;
    state.current = ref;
    state.report = null;
    for (const button of element('reports').querySelectorAll('button')) {
        if (button.dataset.reference === ref) button.setAttribute('aria-current', 'true');
        else button.removeAttribute('aria-current');
    }
    element('detail-heading').textContent = 'Report details';
    element('detail-content').hidden = true;
    message('review-message');
    message('detail-message', 'Loading report…');
    try {
        const { data } = await request('/reports/' + encodeURIComponent(ref));
        if (sequence !== state.detailRequest) return;
        state.report = data;
        renderReport(data);
        element('detail-heading').focus();
    } catch (error) {
        if (sequence !== state.detailRequest) return;
        if (error.status === 401) showSignedOut(error.message);
        else message('detail-message', error.message, true);
    }
}

element('sign-in').addEventListener('submit', async event => {
    event.preventDefault();
    const button = event.currentTarget.querySelector('button');
    const password = element('password');
    button.disabled = true;
    try {
        await request('/login', 'POST', { username: element('username').value, password: password.value });
        await loadQueue();
    } catch (error) {
        message('page-message', error.message, true);
    } finally {
        password.value = '';
        button.disabled = false;
    }
});

element('sign-out').addEventListener('click', async () => {
    try {
        await request('/logout', 'POST', {});
        showSignedOut('Signed out.');
        element('password').focus();
    } catch (error) {
        if (error.status === 401) showSignedOut('Signed out.');
        else message('page-message', error.message, true);
    }
});

element('filters').addEventListener('click', event => {
    const filter = event.target.closest('button');
    if (!filter) return;
    state.decision = filter.dataset.decision;
    state.page = 1;
    loadQueue();
});

element('search').addEventListener('submit', event => {
    event.preventDefault();
    state.page = 1;
    state.query = element('search-query').value;
    loadQueue();
});

element('reason-filter').addEventListener('change', event => {
    state.reason = event.target.value;
    state.page = 1;
    loadQueue();
});
element('nearby-reports').addEventListener('click', event => {
    const button = event.target.closest('button');
    if (button) selectReport(button.dataset.reference);
});

element('refresh').addEventListener('click', loadQueue);

element('previous').addEventListener('click', () => {
    state.page--;
    loadQueue();
});
element('next').addEventListener('click', () => {
    state.page++;
    loadQueue();
});
element('reports').addEventListener('click', event => {
    const button = event.target.closest('button');
    if (button) selectReport(button.dataset.reference);
});
element('decision').addEventListener('change', updateNotesRequirement);

element('review').addEventListener('submit', async event => {
    event.preventDefault();
    const report = state.report;
    if (!report) return;
    const fields = element('review-fields');
    const payload = {
        decision: element('decision').value,
        evaluated_level: element('evaluated-level').value || null,
        reason: element('decision').value === 'needs_verification' ? element('review-reason').value : null,
        notes: element('notes').value.trim(),
        version: report.version
    };
    fields.disabled = true;
    message('review-message', 'Saving review…');
    try {
        const { data } = await request('/reports/' + encodeURIComponent(report.ref_number), 'PUT', payload);
        if (state.report === report) {
            Object.assign(report, data);
            renderReview(report);
            message('review-message', 'Review saved.');
        }
        if (!element('workspace').hidden) loadQueue();
    } catch (error) {
        if (error.status === 401) showSignedOut(error.message);
        else if (state.report === report) message('review-message', error.message, true);
    } finally {
        if (state.report === report) fields.disabled = false;
    }
});

function renderRiskComparison(report) {
    const sources = [
        ['Reported', report.incident_status === 'active' ? 'live' : report.reported_level, 'No rating'],
        ['Gemini', report.assessment?.assessed_level, report.assessment ? 'Undetermined' : 'No assessment'],
        ['Moderator', report.evaluated_level, 'Not evaluated']
    ];
    element('risk-comparison').replaceChildren(...sources.map(([source, risk, fallback]) => {
        const item = document.createElement('div');
        if (risk) item.dataset.risk = risk;
        item.append(textNode('dt', source), textNode('dd', risk === 'live' ? 'Live fire' : risk ? label(risk) : fallback));
        return item;
    }));
}

function renderHistory(history = []) {
    element('history-empty').hidden = history.length > 0;
    element('review-history').replaceChildren(...history.map(review => {
        const item = document.createElement('li');
        const heading = document.createElement('div');
        const decision = textNode('span', '', 'badge');
        badge(decision, review.decision);
        heading.append(decision, textNode('strong', review.reviewer), textNode('span', date(review.reviewed_at), 'muted'));
        item.append(heading);
        const context = [
            review.evaluated_level && label(review.evaluated_level) + ' risk',
            reasonLabels[review.reason]
        ].filter(Boolean).join(' · ');
        if (context) item.append(textNode('p', context, 'muted'));
        if (review.notes) item.append(textNode('p', review.notes));
        return item;
    }));
}

function renderLocation(report) {
    const valid = Number.isFinite(report.lat) && Number.isFinite(report.lng);
    const link = element('report-map');
    const frame = element('map-preview');
    const nearby = report.nearby || [];
    link.hidden = !valid;
    frame.hidden = !valid || !window.L;
    element('map-legend').hidden = frame.hidden;
    message('map-message', valid && !window.L ? 'Map preview unavailable. Use the OpenStreetMap link to view this pin.' : '');
    previewPins?.clearLayers();
    element('location-message').textContent = valid
        ? (nearby.length ? 'Closest reports within 500 m' : 'No other community reports within 500 m.')
        : 'This report has no saved location.';
    element('nearby-reports').replaceChildren(...nearby.map(row => {
        const item = document.createElement('li');
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.reference = row.ref_number;
        button.append(textNode('strong', row.title), textNode('span', `${row.distance} m · ${decisionLabels[row.decision]}`, 'muted'));
        item.append(button);
        return item;
    }));
    if (!valid) return;
    const { lat, lng } = report;
    link.href = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`;
    if (!window.L) return;

    if (!previewMap) {
        previewMap = L.map(frame, { scrollWheelZoom: false });
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).on('tileerror', () => {
            message('map-message', 'Some map tiles could not load. The pins are still shown.');
        }).addTo(previewMap);
        previewPins = L.layerGroup().addTo(previewMap);
    }
    for (const row of [...nearby, report]) {
        const selected = row === report;
        L.circleMarker([row.lat, row.lng], {
            radius: selected ? 9 : 6, color: '#fff', weight: 2,
            fillColor: selected ? '#ce4b2c' : '#1a6e75', fillOpacity: 1
        }).bindTooltip(textNode('span', selected ? 'Selected report' : row.ref_number)).addTo(previewPins);
    }
    previewMap.invalidateSize();
    previewMap.fitBounds([[lat, lng], ...nearby.map(row => [row.lat, row.lng])], { maxZoom: 17, padding: [32, 32], animate: false });
}

const reviewerDialog = element('reviewer-dialog');

async function loadReviewers() {
    const { data } = await request('/reviewers');
    if (!reviewerDialog.open) return;
    element('reviewer-list').replaceChildren(...data.map(account => {
        const item = document.createElement('li');
        const info = textNode('span', account.username);
        info.append(textNode('small', account.enabled ? 'Active' : 'Disabled', 'muted'));
        const button = textNode('button', account.enabled ? 'Disable' : 'Enable');
        button.type = 'button';
        button.dataset.account = account.username;
        button.dataset.enabled = String(!account.enabled);
        button.setAttribute('aria-label', `${button.textContent} ${account.username}`);
        item.append(info, button);
        return item;
    }));
}

function reviewerError(error) {
    if (error.status === 401) showSignedOut(error.message);
    else message('reviewers-message', error.message, true);
}

element('manage-reviewers').addEventListener('click', () => {
    message('reviewers-message', 'Loading reviewers…');
    reviewerDialog.showModal();
    loadReviewers().then(() => message('reviewers-message')).catch(reviewerError);
});

reviewerDialog.addEventListener('close', () => element('add-reviewer').reset());

element('add-reviewer').addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button');
    button.disabled = true;
    try {
        await request('/reviewers', 'POST', {
            username: element('new-username').value,
            password: element('new-password').value
        });
        form.reset();
        message('reviewers-message', 'Reviewer added.');
        await loadReviewers();
    } catch (error) {
        reviewerError(error);
    } finally {
        button.disabled = false;
    }
});

element('reviewer-list').addEventListener('click', async event => {
    const button = event.target.closest('button');
    if (!button) return;
    button.disabled = true;
    try {
        const enabled = button.dataset.enabled === 'true';
        await request('/reviewers/' + encodeURIComponent(button.dataset.account), 'PUT', { enabled });
        await loadReviewers();
        message('reviewers-message', enabled ? 'Reviewer enabled.' : 'Reviewer disabled.');
        for (const current of element('reviewer-list').querySelectorAll('button')) {
            if (current.dataset.account === button.dataset.account) current.focus();
        }
    } catch (error) {
        reviewerError(error);
    } finally {
        button.disabled = false;
    }
});

loadQueue();
