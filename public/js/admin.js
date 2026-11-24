'use strict';

const element = id => document.getElementById(id);
const decisionLabels = {
    pending: 'Pending',
    needs_verification: 'Needs verification',
    validated: 'Validated',
    dismissed: 'Dismissed'
};
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
    decision: 'all', query: '', page: 1, current: null, report: null,
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
    element('reports').replaceChildren();
    element('detail-content').hidden = true;
    element('report-photo').removeAttribute('src');
    element('photo-link').removeAttribute('href');
    element('report-map').removeAttribute('href');
    for (const id of ['report-reference', 'report-facts', 'report-description', 'report-observations',
        'assessment-summary', 'assessment-factors']) {
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
    if (isLive) button.classList.add('live-report');
    item.append(button);
    return item;
}

async function loadQueue() {
    const sequence = ++state.queueRequest;
    const query = new URLSearchParams({ decision: state.decision, q: state.query, page: state.page });
    element('reports').setAttribute('aria-busy', 'true');
    message('queue-message', 'Loading reports…');
    element('refresh').disabled = true;
    element('previous').disabled = true;
    element('next').disabled = true;
    try {
        const { data, counts, page, pages, total } = await request('/reports?' + query);
        if (sequence !== state.queueRequest) return;
        state.page = page;
        element('sign-in').hidden = true;
        element('sign-out').hidden = false;
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
    element('notes').required = required;
    element('notes-requirement').textContent = required ? '(required)' : '(optional)';
}

function renderReview(report) {
    badge(element('report-decision'), report.decision);
    element('decision').value = report.decision === 'pending' ? '' : report.decision;
    element('evaluated-level').value = report.evaluated_level || '';
    element('notes').value = report.notes || '';
    element('review-time').textContent = report.reviewed_at ? `Updated ${date(report.reviewed_at)}` : '';
    updateNotesRequirement();
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

    const map = element('report-map');
    map.hidden = !Number.isFinite(report.lat) || !Number.isFinite(report.lng);
    if (!map.hidden) {
        const { lat, lng } = report;
        map.href = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`;
    }

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
        await request('/login', 'POST', { password: password.value });
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

loadQueue();
