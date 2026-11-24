'use strict';

const token = location.hash.slice(1);
const form = document.getElementById('reporter-reply');
const fields = document.getElementById('reply-fields');
const output = document.getElementById('reply-message');

function showMessage(text, error = false) {
    output.textContent = text;
    output.dataset.error = error;
}

async function request(method, body) {
    const response = await fetch('/api/report-follow-up', {
        method, body, headers: { Authorization: 'Bearer ' + token }, cache: 'no-store'
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Could not complete the request.');
    return result.data;
}

async function loadQuestion() {
    if (!/^[a-f0-9]{64}$/.test(token)) {
        showMessage('Open the complete private link from the reviewer.', true);
        return;
    }
    try {
        const data = await request('GET');
        if (data.submitted) {
            showMessage('Your reply has already been submitted.');
            return;
        }
        document.getElementById('reporter-question').textContent = data.question;
        form.hidden = false;
        showMessage('');
    } catch (error) {
        showMessage(error.message, true);
    }
}

form.addEventListener('submit', async event => {
    event.preventDefault();
    const body = new FormData(form);
    const photo = body.get('photo');
    if (!photo?.size) body.delete('photo');
    else if (photo.size > 3 * 1024 * 1024) {
        showMessage('Choose a photo up to 3 MB.', true);
        return;
    }
    fields.disabled = true;
    try {
        await request('POST', body);
        form.reset();
        form.hidden = true;
        showMessage('Reply sent to the review team.');
    } catch (error) {
        showMessage(error.message, true);
    } finally {
        fields.disabled = false;
    }
});

loadQuestion();
