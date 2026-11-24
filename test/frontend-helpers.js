'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadFrontend(file, names, bindings = {}) {
    const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8')
        .replace(/^import .*;\s*$/gm, '')
        .replace(/^export default .*;\s*$/gm, '')
        .replace(/^export \{.*\};?\s*$/gm, '')
        .replace(/\bexport (?=(?:async )?function|const|let)/g, '');
    const context = vm.createContext({ console, ...bindings });
    const exports = vm.runInContext(`${source}\n;({${names.join(',')}});`, context, { filename: file });
    return { exports, context };
}

function element(dataset = {}) {
    const classes = new Set();
    const attributes = new Map();
    const listeners = new Map();
    return {
        dataset, value: '', hidden: true, textContent: '',
        classList: {
            toggle(name, active) { if (active) classes.add(name); else classes.delete(name); },
            add(name) { classes.add(name); }, remove(name) { classes.delete(name); },
            contains(name) { return classes.has(name); }
        },
        setAttribute(name, value) { attributes.set(name, String(value)); },
        getAttribute(name) { return attributes.get(name) ?? null; },
        addEventListener(name, handler) { listeners.set(name, handler); },
        click() { listeners.get('click')?.(); },
        change(value) { this.value = value; listeners.get('change')?.(); }
    };
}

module.exports = { loadFrontend, element };
