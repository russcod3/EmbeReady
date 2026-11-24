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
let draftPin;
const assessmentStatuses = {
    demo: 'No Gemini assessment is requested for demo reports.',
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
const defaultQueue = { decision: 'all', reason: 'all', followup: 'all', query: '', page: 1 };
const state = {
    ...defaultQueue, source: 'community', current: null, report: null,
    queueRequest: 0, detailRequest: 0, reviewer: null, operationsRequest: 0
};

function label(value) {
    return value ? value.replace(/_/g, ' ').replace(/^./, char => char.toUpperCase()) : '—';
}

function dateMillis(value) {
    return Date.parse(value.includes('T') ? value : value.replace(' ', 'T') + 'Z');
}

function date(value) {
    if (!value) return '—';
    const parsed = new Date(dateMillis(value));
    return Number.isNaN(parsed.getTime()) ? '—' : dateFormat.format(parsed);
}

function waitTime(timestamp) {
    if (!timestamp) return '';
    const time = Date.parse(timestamp.includes('T') ? timestamp : timestamp.replace(' ', 'T') + 'Z');
    if (!Number.isFinite(time)) return '';
    const minutes = Math.max(0, Math.floor((Date.now() - time) / 60000));
    if (minutes < 1) return 'just now';
    if (minutes < 60) return minutes + 'm';
    if (minutes < 1440) return Math.floor(minutes / 60) + 'h';
    return Math.floor(minutes / 1440) + 'd';
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
    state.reviewer = null;
    state.operationsRequest++;
    clearReporterDraft();
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
        'nearby-reports', 'review-history', 'reviewer-list', 'workflow-history', 'nearby-references', 'assignee', 'operations-metrics', 'reporter-replies', 'pin-history']) {
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
    if (report.assignee || report.due_on) {
        const assignment = [report.assignee, report.due_on && 'Due ' + report.due_on].filter(Boolean);
        button.append(textNode('span', assignment.join(' · '), 'queue-task'));
    }
    if (report.duplicate_ref) button.append(textNode('span', 'Duplicate of ' + report.duplicate_ref, 'queue-task'));
    if (report.attention_priority < 3) {
        const tags = [];
        if (report.attention_priority === 0) tags.push('Unreviewed live fire · ' + waitTime(report.created_at));
        if (report.unread_at) tags.push('New reporter reply · ' + waitTime(report.unread_at));
        if (report.is_overdue) tags.push('Overdue · ' + waitTime(report.due_on + 'T00:00:00+08:00'));
        button.append(textNode('span', tags.join('  /  '), 'attention-tag'));
    }
    if (isLive) button.classList.add('live-report');
    item.append(button);
    return item;
}

async function loadQueue(nextAfter = '', nextPriority = '', nextSince = '') {
    const sequence = ++state.queueRequest;
    const query = new URLSearchParams({
        decision: state.decision, q: state.query, reason: state.reason, page: state.page,
        followup: state.followup, source: state.source, next_after: nextAfter, next_priority: nextPriority, next_since: nextSince
    });
    element('reports').setAttribute('aria-busy', 'true');
    message('queue-message', 'Loading reports…');
    element('refresh').disabled = true;
    element('previous').disabled = true;
    element('next').disabled = true;
    try {
        const { data, counts, page, pages, total, reviewer, next_ref } = await request('/reports?' + query);
        if (sequence !== state.queueRequest) return;
        state.page = page;
        rememberQueue();
        element('sign-in').hidden = true;
        element('sign-out').hidden = false;
        element('reviewer-identity').textContent = reviewer.username;
        element('reviewer-identity').hidden = false;
        state.reviewer = reviewer;
        element('manage-reviewers').hidden = !reviewer.supervisor;
        element('new-role-field').hidden = !reviewer.owner;
        element('show-attention').setAttribute('aria-pressed', String(state.source === 'community' && state.followup === 'attention'));
        loadOperations();
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
        message('queue-message', total ? `${total} ${total === 1 ? 'report' : 'reports'}` : 'No reports match this view.');
        return next_ref;
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
    element('correction-reason').value = '';
    const previousReviewer = report.history[0]?.reviewer;
    const differentReviewer = previousReviewer && previousReviewer !== report.reviewer.username;
    element('review-access').hidden = !differentReviewer || report.reviewer.supervisor;
    element('correction-field').hidden = !differentReviewer || !report.reviewer.supervisor;
    element('correction-reason').required = !element('correction-field').hidden;
    element('review-fields').disabled = !element('review-access').hidden;
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
        const moved = report.pin_history?.[0]?.changed_at;
        const assessed = assessment.created_at;
        const locationNote = moved && (!assessed || dateMillis(moved) > dateMillis(assessed))
            ? 'This saved assessment predates the latest pin correction.' : '';
        summary = [parts.join(' · '), assessment.reasoning_summary, locationNote].filter(Boolean).join('\n');
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

function renderFacts(report) {
    const isLive = report.was_live;

    renderPairs('report-facts', [
        ['Barangay', report.barangay || '—'],
        ['Submitted', date(report.created_at)],
        ['Category', isLive ? 'Live fire' : label(report.category)],
        ['Incident status', label(report.incident_status)],
        ['Reported risk', isLive ? 'Live fire' : label(report.reported_level)],
        ['Address', report.address || '—']
    ]);
}

function renderReport(report) {
    element('detail-heading').textContent = report.title || 'Report details unavailable';
    element('report-reference').textContent = report.ref_number;
    element('demo-badge').hidden = !report.is_training;
    element('review-context').textContent = report.is_training
        ? 'Practice reviews stay in the demo queue.'
        : 'Validation displays a Verified label on the public map. Review notes stay private.';
    renderFacts(report);
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
    renderWorkflow(report);
    renderPins(report);
    renderReporterRequests(report);
    element('detail-content').hidden = false;
    renderLocation(report);
    message('detail-message');
}

async function selectReport(ref) {
    if (!canLeaveReport()) return;
    const sequence = ++state.detailRequest;
    state.current = ref;
    state.report = null;
    clearReporterDraft();
    element('pin-editor').open = false;
    message('pin-message');
    for (const button of element('reports').querySelectorAll('button')) {
        if (button.dataset.reference === ref) button.setAttribute('aria-current', 'true');
        else button.removeAttribute('aria-current');
    }
    element('detail-heading').textContent = 'Report details';
    element('detail-content').hidden = true;
    message('review-message');
    message('workflow-message');
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
        await request('/login', 'POST', { username: element('username').disabled ? '' : element('username').value, password: password.value });
        await loadQueue();
    } catch (error) {
        message('page-message', error.status === 401 && !element('username').disabled
            ? 'Reviewer sign-in failed. Use an account created under Reviewers, or switch to Shared admin.'
            : error.message, true);
    } finally {
        password.value = '';
        button.disabled = false;
    }
});

element('sign-out').addEventListener('click', async () => {
    if (!canLeaveReport()) return;
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

element('refresh').addEventListener('click', () => loadQueue());

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

function reviewInput() {
    const decision = element('decision').value;
    return {
        decision,
        evaluated_level: element('evaluated-level').value || null,
        reason: decision === 'needs_verification' ? element('review-reason').value || null : null,
        notes: element('notes').value.trim()
    };
}

function workflowInput() {
    return {
        assignee: element('assignee').value || null,
        due_on: element('due-on').value || null,
        duplicate_ref: element('original-reference').value.trim().toUpperCase() || null,
        incident_status: element('incident-status').value || null
    };
}

function changed(input, report) {
    return Object.entries(input).some(([key, value]) => value !== (report[key] ?? null));
}

function hasUnsavedWork() {
    const report = state.report;
    if (!report) return false;
    const review = reviewInput();
    if (report.decision === 'pending' && !review.decision) review.decision = 'pending';
    const pinDraft = report.has_location && (element('pin-reason').value ||
        Number(element('pin-lat').value) !== report.lat || Number(element('pin-lng').value) !== report.lng ||
        Number(element('pin-barangay').value) !== report.barangay_id || element('pin-address').value !== (report.address || ''));
    return changed(review, { ...report, notes: report.notes || '' }) || changed(workflowInput(), report)
        || Boolean(pinDraft || element('correction-reason').value || element('reporter-question').value.trim());
}

function canLeaveReport() {
    if ((element('review-fields').disabled && element('review-access').hidden) ||
        element('workflow-fields').disabled || element('pin-fields').disabled || element('ask-reporter').querySelector('button').disabled) {
        if (state.report) return false;
    }
    return !hasUnsavedWork() || window.confirm('This report has unsaved changes. Leave it anyway?');
}

window.addEventListener('beforeunload', event => {
    if (!hasUnsavedWork()) return;
    event.preventDefault();
    event.returnValue = true;
});

element('review').addEventListener('submit', async event => {
    event.preventDefault();
    const report = state.report;
    if (!report) return;
    const fields = element('review-fields');
    const goNext = event.submitter?.id === 'save-next';
    fields.disabled = true;
    message('review-message', 'Saving review…');
    try {
        const { data } = await request('/reports/' + encodeURIComponent(report.ref_number), 'PUT', {
            ...reviewInput(), correction_reason: element('correction-reason').value.trim(), version: report.version
        });
        if (state.report !== report) return;
        Object.assign(report, data);
        renderReview(report);
        message('review-message', 'Review saved.');
        const priority = goNext && state.followup === 'attention' && report.attention_priority < 3
            ? String(report.attention_priority) : '';
        const nextRef = await loadQueue(goNext ? report.ref_number : '', priority, priority ? report.attention_since : '');
        if (goNext && state.report === report) {
            fields.disabled = false;
            if (nextRef) await selectReport(nextRef);
            else if (nextRef === null) message('review-message', 'Review saved. No later reports match the current filters.');
        }
    } catch (error) {
        if (error.status === 401) showSignedOut(error.message);
        else if (state.report === report) message('review-message', error.message, true);
    } finally {
        if (state.report === report) fields.disabled = false;
    }
});

const workflowLabels = {
    assignee: 'Assigned reviewer', due_on: 'Due date', duplicate_ref: 'Original report', incident_status: 'Incident status'
};

function renderWorkflow(report) {
    const options = new Set(report.assignees);
    if (report.assignee) options.add(report.assignee);
    const assignee = element('assignee');
    assignee.replaceChildren(new Option('Unassigned', ''));
    for (const name of options) assignee.add(new Option(name, name));
    assignee.value = report.assignee || '';
    element('due-on').value = report.due_on || '';
    element('original-reference').value = report.duplicate_ref || '';
    element('open-original').hidden = !report.duplicate_ref;
    element('nearby-references').replaceChildren(...report.nearby.map(row => new Option(row.title, row.ref_number)));
    const status = element('incident-status');
    const statuses = report.was_live ? ['active', 'contained', 'resolved'] : ['potential', 'resolved'];
    if (report.incident_status) statuses.push(report.incident_status);
    status.replaceChildren(...[...new Set(statuses)].map(value => new Option(label(value), value)));
    status.disabled = !report.has_location;
    if (status.disabled) status.replaceChildren(new Option('No linked incident', ''));
    status.value = report.incident_status || '';
    element('workflow-fields').disabled = false;
    const history = report.workflow_history;
    element('workflow-log').hidden = !history.length;
    element('workflow-history').replaceChildren(...history.map(event => {
        const item = document.createElement('li');
        const header = document.createElement('div');
        header.append(textNode('strong', event.reviewer), textNode('span', date(event.recorded_at), 'muted'));
        item.append(header);
        for (const { field, from, to } of event.changes) {
            item.append(textNode('p', `${workflowLabels[field]}: ${from || '—'} → ${to || '—'}`));
        }
        return item;
    }));
}

element('open-original').addEventListener('click', () => {
    if (state.report?.duplicate_ref) selectReport(state.report.duplicate_ref);
});

element('workflow').addEventListener('submit', async event => {
    event.preventDefault();
    const report = state.report;
    if (!report) return;
    const fields = element('workflow-fields');
    const { incident_status, ...input } = workflowInput();
    const payload = { ...input, workflow_version: report.workflow_version };
    if (incident_status !== report.incident_status) {
        payload.incident_status = incident_status;
        payload.previous_incident_status = report.incident_status;
    }
    fields.disabled = true;
    message('workflow-message', 'Saving follow-up…');
    try {
        const { data } = await request('/reports/' + encodeURIComponent(report.ref_number) + '/workflow', 'PUT', payload);
        if (state.report !== report) return;
        Object.assign(report, data);
        renderFacts(report);
        renderWorkflow(report);
        message('workflow-message', 'Follow-up saved.');
        await loadQueue();
    } catch (error) {
        if (error.status === 401) showSignedOut(error.message);
        else if (state.report === report) message('workflow-message', error.message, true);
    } finally {
        if (state.report === report) fields.disabled = false;
    }
});

function renderRiskComparison(report) {
    const sources = [
        ['Reported', report.was_live ? 'live' : report.reported_level, 'No rating'],
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
        if (review.correction_reason) item.append(textNode('p', 'Correction: ' + review.correction_reason, 'muted'));
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
        previewMap.on('click', event => {
            if (!state.report || !element('pin-editor').open || element('pin-fields').disabled) return;
            fillPin(event.latlng.lat, event.latlng.lng);
        });
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
        info.append(textNode('small', label(account.role) + ' · ' + (account.enabled ? 'Active' : 'Disabled'), 'muted'));
        if (account.role === 'supervisor' && !state.reviewer.owner) {
            item.append(info);
            return item;
        }
        const button = textNode('button', account.enabled ? 'Disable' : 'Enable');
        button.type = 'button';
        button.dataset.account = account.username;
        button.dataset.enabled = String(!account.enabled);
        button.setAttribute('aria-label', `${button.textContent} ${account.username}`);
        const actions = document.createElement('div');
        actions.className = 'account-actions';
        actions.append(button);
        if (state.reviewer.owner) {
            const role = textNode('button', account.role === 'supervisor' ? 'Make reviewer' : 'Make supervisor');
            role.type = 'button';
            role.dataset.account = account.username;
            role.dataset.role = account.role === 'supervisor' ? 'reviewer' : 'supervisor';
            role.setAttribute('aria-label', role.textContent + ' for ' + account.username);
            actions.append(role);
        }
        item.append(info, actions);
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
            password: element('new-password').value, role: state.reviewer.owner ? element('new-role').value : 'reviewer'
        });
        form.reset();
        message('reviewers-message', 'Account added.');
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
        const role = button.dataset.role;
        await request('/reviewers/' + encodeURIComponent(button.dataset.account), 'PUT', role ? { role } : { enabled });
        await loadReviewers();
        message('reviewers-message', role ? 'Account role updated.' : enabled ? 'Account enabled.' : 'Account disabled.');
        for (const current of element('reviewer-list').querySelectorAll('button')) {
            if (current.dataset.account === button.dataset.account && Boolean(current.dataset.role) === Boolean(role)) current.focus();
        }
    } catch (error) {
        reviewerError(error);
    } finally {
        button.disabled = false;
    }
});

function rememberQueue() {
    const { decision, reason, followup, query, page, source } = state;
    try {
        sessionStorage.setItem('embeready-admin-queue-' + source, JSON.stringify({ decision, reason, followup, query, page }));
        sessionStorage.setItem('embeready-admin-source', source);
    } catch {}
}

function restoreQueue(source) {
    let settings = defaultQueue;
    try {
        settings = JSON.parse(sessionStorage.getItem('embeready-admin-queue-' + source)) || defaultQueue;
    } catch {}
    Object.assign(state, defaultQueue, settings, { source });
    element('queue-source').querySelector(`[value="${source}"]`).checked = true;
    element('search-query').value = state.query;
    element('reason-filter').value = state.reason;
    element('followup-filter').value = state.followup;
    element('load-demo').hidden = source !== 'demo';
    element('demo-notice').hidden = source !== 'demo';
}

element('queue-source').addEventListener('change', event => {
    if (!canLeaveReport()) {
        element('queue-source').querySelector(`[value="${state.source}"]`).checked = true;
        return;
    }
    state.detailRequest++;
    state.report = null;
    state.current = null;
    clearReporterDraft();
    restoreQueue(event.target.value);
    element('detail-heading').textContent = 'Report details';
    element('detail-content').hidden = true;
    element('reports').replaceChildren();
    message('detail-message', 'Select a report to review its evidence.');
    loadQueue();
});

element('followup-filter').addEventListener('change', event => {
    state.followup = event.target.value;
    state.page = 1;
    loadQueue();
});

element('load-demo').addEventListener('click', async event => {
    const button = event.currentTarget;
    button.disabled = true;
    try {
        await request('/demo', 'POST', {});
        if (state.source === 'demo') await loadQueue();
    } catch (error) {
        if (error.status === 401) showSignedOut(error.message);
        else if (state.source === 'demo') message('queue-message', error.message, true);
    } finally {
        button.disabled = false;
    }
});

element('sign-in').addEventListener('change', event => {
    if (event.target.name !== 'account-mode') return;
    const named = event.target.value === 'reviewer';
    element('username-field').hidden = !named;
    element('username').disabled = !named;
    element('username').required = named;
    element('password-label').textContent = named ? 'Reviewer password' : 'Admin password';
    element('sign-in-help').textContent = named
        ? 'Use the credentials your EmbeReady administrator created for you.'
        : 'Enter the admin password configured for EmbeReady.';
});
async function loadOperations() {
    const sequence = ++state.operationsRequest;
    try {
        const { data } = await request('/operations');
        if (sequence !== state.operationsRequest) return;
        const weeklyHours = data.hours_to_first_review;
        renderPairs('operations-metrics', [
            ['Needs attention', String(data.needs_attention)],
            ['Unresolved incidents', String(data.unresolved_incidents)],
            ['Overdue cases', String(data.overdue_cases)],
            ['Reviewed this week', `${data.reviewed} of ${data.submitted}`],
            ['Avg. to first review', weeklyHours === null ? '—' : weeklyHours.toFixed(1) + ' h']
        ]);
        message('operations-message');
    } catch (error) {
        if (sequence === state.operationsRequest) message('operations-message', error.message, true);
    }
}

element('show-attention').addEventListener('click', () => {
    if (state.source !== 'community' && !canLeaveReport()) return;
    if (state.source !== 'community') {
        state.detailRequest++;
        state.current = null;
        state.report = null;
        element('detail-content').hidden = true;
        element('detail-heading').textContent = 'Report details';
        message('detail-message', 'Select a report to review its evidence.');
    }
    restoreQueue('community');
    Object.assign(state, defaultQueue, { followup: 'attention' });
    element('followup-filter').value = 'attention';
    element('reason-filter').value = 'all';
    element('search-query').value = '';
    loadQueue();
    element('followup-filter').focus();
});

function renderPins(report) {
    element('pin-editor').hidden = !report.has_location;
    element('pin-lat').value = report.lat ?? '';
    element('pin-lng').value = report.lng ?? '';
    element('pin-reason').value = '';
    const barangay = element('pin-barangay');
    barangay.replaceChildren(new Option('Confirm the barangay', ''));
    for (const option of report.barangays) barangay.add(new Option(option.name, option.id));
    barangay.value = report.barangay_id || '';
    element('pin-address').value = report.address || '';
    element('pin-fields').disabled = false;
    element('pin-history').replaceChildren(...report.pin_history.map(entry => {
        const row = document.createElement('li');
        row.append(
            textNode('strong', entry.reviewer + ' · ' + date(entry.changed_at)),
            textNode('p', `${entry.previous_lat}, ${entry.previous_lng} → ${entry.lat}, ${entry.lng}`, 'muted'),
            textNode('p', entry.reason)
        );
        if (entry.barangay && entry.previous_barangay !== entry.barangay) {
            row.append(textNode('p', `${entry.previous_barangay || '—'} → ${entry.barangay}`, 'muted'));
        }
        if (entry.barangay && entry.previous_address !== entry.address) {
            row.append(textNode('p', `${entry.previous_address || 'No address'} → ${entry.address || 'No address'}`, 'muted'));
        }
        return row;
    }));
}

function confirmPinLocation() {
    const report = state.report;
    if (!report) return;
    if (Number(element('pin-lat').value) !== report.lat || Number(element('pin-lng').value) !== report.lng) {
        element('pin-barangay').value = '';
        element('pin-address').value = '';
    }
}

for (const id of ['pin-lat', 'pin-lng']) element(id).addEventListener('input', confirmPinLocation);

function fillPin(lat, lng) {
    element('pin-lat').value = Number(lat).toFixed(6);
    element('pin-lng').value = Number(lng).toFixed(6);
    confirmPinLocation();
    if (!previewPins) return;
    if (draftPin) previewPins.removeLayer(draftPin);
    draftPin = L.circleMarker([lat, lng], { radius: 9, color: '#fff', fillColor: '#7256a6', fillOpacity: 1 })
        .bindTooltip('Proposed location').addTo(previewPins);
}

element('pin-editor').addEventListener('toggle', event => {
    if (!event.target.open && draftPin) {
        previewPins?.removeLayer(draftPin);
        draftPin = null;
    }
});

element('pin-form').addEventListener('submit', async event => {
    event.preventDefault();
    const report = state.report;
    if (!report) return;
    const fields = element('pin-fields');
    const path = '/reports/' + encodeURIComponent(report.ref_number);
    fields.disabled = true;
    try {
        const { data } = await request(path + '/pin', 'PUT', {
            lat: Number(element('pin-lat').value), lng: Number(element('pin-lng').value),
            pin_revision: report.pin_revision, barangay_id: Number(element('pin-barangay').value),
            address: element('pin-address').value, reason: element('pin-reason').value
        });
        if (state.report !== report) return;
        Object.assign(report, data);
        element('detail-heading').textContent = report.title;
        renderFacts(report);
        renderPins(report);
        renderLocation(report);
        renderAssessment(report);
        message('pin-message', 'Pin corrected.');
        loadQueue();
    } catch (error) {
        if (error.status === 401) showSignedOut(error.message);
        else if (state.report === report) message('pin-message', error.message, true);
    } finally {
        if (state.report === report) fields.disabled = false;
    }
});

function clearReporterDraft() {
    element('ask-reporter').reset();
    element('reply-link-field').hidden = true;
    element('reply-link').value = '';
    message('reporter-message');
}

function renderReporterRequests(report) {
    element('reporter-contact').hidden = Boolean(report.is_training);
    element('reporter-jump').hidden = Boolean(report.is_training);
    const path = '/api/admin/reports/' + encodeURIComponent(report.ref_number) + '/reporter-requests/';
    element('reporter-replies').replaceChildren(...report.reporter_requests.map(entry => {
        const item = document.createElement('li');
        const header = document.createElement('div');
        const status = entry.replied_at ? (entry.read_at ? 'Replied' : 'New reply')
            : entry.cancelled_at ? 'Replaced' : entry.expired ? 'Expired' : 'Awaiting reply';
        header.append(textNode('strong', status), textNode('span', date(entry.replied_at || entry.requested_at), 'muted'));
        item.append(header, textNode('p', entry.requested_by + ' asked: ' + entry.question));
        if (entry.reply) item.append(textNode('p', entry.reply, 'reporter-response'));
        if (entry.reply_lat !== null && report.has_location) {
            const pin = textNode('button', 'Use suggested coordinates');
            pin.type = 'button';
            pin.dataset.latitude = entry.reply_lat;
            pin.dataset.longitude = entry.reply_lng;
            item.append(textNode('p', `${entry.reply_lat}, ${entry.reply_lng}`, 'muted'), pin);
        }
        if (entry.has_photo) {
            const photo = textNode('a', 'View private photo');
            photo.href = path + entry.id + '/photo';
            photo.target = '_blank';
            photo.rel = 'noopener noreferrer';
            item.append(photo);
        }
        if (entry.replied_at && !entry.read_at) {
            const read = textNode('button', 'Mark reply read');
            read.type = 'button';
            read.dataset.read = entry.id;
            item.append(read);
        }
        return item;
    }));
}

element('ask-reporter').addEventListener('submit', async event => {
    event.preventDefault();
    const report = state.report;
    if (!report) return;
    const button = event.currentTarget.querySelector('button');
    button.disabled = true;
    try {
        const { data, path } = await request('/reports/' + encodeURIComponent(report.ref_number) + '/reporter-requests',
            'POST', { question: element('reporter-question').value });
        if (state.report !== report) return;
        report.reporter_requests = data;
        element('reply-link').value = new URL(path, location.origin).href;
        element('reply-link-field').hidden = false;
        element('reporter-question').value = '';
        renderReporterRequests(report);
        message('reporter-message', 'Link created. Share it privately with the reporter.');
    } catch (error) {
        if (error.status === 401) showSignedOut(error.message);
        else if (state.report === report) message('reporter-message', error.message, true);
    } finally {
        button.disabled = false;
    }
});

element('copy-link').addEventListener('click', async () => {
    const field = element('reply-link');
    try {
        await navigator.clipboard.writeText(field.value);
        message('reporter-message', 'Private link copied.');
    } catch {
        field.select();
        message('reporter-message', 'The link is selected. Use your copy shortcut.');
    }
});

element('refresh-replies').addEventListener('click', async event => {
    const button = event.currentTarget;
    const report = state.report;
    if (!report) return;
    button.disabled = true;
    try {
        const { data } = await request('/reports/' + encodeURIComponent(report.ref_number) + '/reporter-requests');
        if (state.report !== report) return;
        report.reporter_requests = data;
        renderReporterRequests(report);
        message('reporter-message', 'Replies refreshed.');
        loadQueue();
    } catch (error) {
        if (error.status === 401) showSignedOut(error.message);
        else if (state.report === report) message('reporter-message', error.message, true);
    } finally {
        button.disabled = false;
    }
});

element('reporter-replies').addEventListener('click', async event => {
    const button = event.target.closest('button');
    const report = state.report;
    if (!button || !report) return;
    if ('latitude' in button.dataset) {
        element('pin-editor').open = true;
        fillPin(Number(button.dataset.latitude), Number(button.dataset.longitude));
        element('pin-reason').focus();
        return;
    }
    if (!button.dataset.read) return;
    button.disabled = true;
    try {
        const { data } = await request('/reports/' + encodeURIComponent(report.ref_number) +
            '/reporter-requests/' + button.dataset.read, 'PUT', {});
        if (state.report === report) {
            report.reporter_requests = data;
            renderReporterRequests(report);
            message('reporter-message', 'Reply marked read.');
        }
        if (state.reviewer) loadQueue();
    } catch (error) {
        if (error.status === 401) showSignedOut(error.message);
        else if (state.report === report) message('reporter-message', error.message, true);
    } finally {
        button.disabled = false;
    }
});

let initialSource = 'community';
try {
    if (sessionStorage.getItem('embeready-admin-source') === 'demo') initialSource = 'demo';
} catch {}
restoreQueue(initialSource);
loadQueue();
