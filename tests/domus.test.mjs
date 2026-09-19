// DOM-level tests for Domus. index.html is booted in jsdom; each test
// gets a fresh window and a fresh localStorage.
//
//   cd tests && npm install && npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const HTML = readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const SW = readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const KEY = 'domus:v1';

// Boot the page. `seed` pre-populates localStorage (values are JSON-encoded).
function boot({ seed = {} } = {}) {
  const dom = new JSDOM(HTML, {
    url: 'http://localhost/',
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    beforeParse(window) {
      for (const [k, v] of Object.entries(seed)) window.localStorage.setItem(k, JSON.stringify(v));
    },
  });
  const w = dom.window;
  return {
    w,
    $: s => w.document.querySelector(s),
    $$: s => [...w.document.querySelectorAll(s)],
    stored: () => { const r = w.localStorage.getItem(KEY); return r == null ? null : JSON.parse(r); },
    type(text) { const f = w.document.getElementById('field'); f.value = text; w.document.getElementById('add').click(); },
  };
}

test('a fresh page is empty and says so', () => {
  const { $ } = boot();
  assert.equal($('#list').textContent, 'Nothing here yet.');
  assert.equal($('#count').textContent, '');
});

test('adding an item renders it and persists it', () => {
  const { $$, stored, type } = boot();
  type('first thing');
  assert.deepEqual($$('.task').map(e => e.textContent), ['first thing']);
  assert.equal(stored().items.length, 1);
});

test('a reload shows what was stored', () => {
  const { $$ } = boot({ seed: { [KEY]: { items: [{ id: 'a', text: 'kept' }] } } });
  assert.deepEqual($$('.task').map(e => e.textContent), ['kept']);
});

test('the version marker matches the service-worker cache name', () => {
  const { $ } = boot();
  const cache = SW.match(/const CACHE = '([^']+)'/)[1];
  assert.equal($('.ver').textContent, cache);
});
