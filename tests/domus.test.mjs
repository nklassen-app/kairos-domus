// DOM-level tests for Domus. index.html is booted in jsdom under a fixed
// clock; each test gets a fresh window and a fresh localStorage.
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

// A project record as the app stores it, with only the fields a test names.
function project(over = {}) {
  return {
    id: over.id || Math.random().toString(36).slice(2, 8), title: 'thing', description: '',
    priority_order: 1, effort: null, estimated_cost: null, status: 'backlog',
    assignee_id: null, vendor_ids: [], dependency_ids: [],
    scheduled_start: null, scheduled_duration_minutes: null, calendar_event_id: null,
    created_at: '2026-09-19T10:00:00.000Z', updated_at: '2026-09-19T10:00:00.000Z', completed_at: null,
    ...over,
  };
}
const doc = (projects, budget = { year: 2026, amount: null, currency: 'USD' }) => ({ projects, budget });

// Boot the page at a fixed instant (UTC, so the stored ISO strings are
// the same in every zone). `seed` pre-populates localStorage
// (values are JSON-encoded); `confirm` is what window.confirm answers.
function boot({ now = new Date('2026-09-19T10:00:00.000Z'), seed = {}, confirm = true } = {}) {
  const fixed = now.getTime();
  const dom = new JSDOM(HTML, {
    url: 'http://localhost/',
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    beforeParse(window) {
      const Real = window.Date;
      class Fixed extends Real {
        constructor(...a) { if (a.length === 0) super(fixed); else super(...a); }
        static now() { return fixed; }
      }
      window.Date = Fixed;
      window.confirm = () => confirm;
      for (const [k, v] of Object.entries(seed)) window.localStorage.setItem(k, JSON.stringify(v));
    },
  });
  const w = dom.window;
  const d = w.document;
  const h = {
    w,
    $: s => d.querySelector(s),
    $$: s => [...d.querySelectorAll(s)],
    stored: () => { const r = w.localStorage.getItem(KEY); return r == null ? null : JSON.parse(r); },
    type(text) { const f = d.getElementById('field'); f.value = text; f.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); },
    titles: (board) => [...d.querySelectorAll(`#${board} .title`)].map(e => e.textContent),
    click: (sel) => d.querySelector(sel).click(),
    // edit an in-place input: click the target, set the value, press Enter
    edit(sel, value, key = 'Enter') {
      d.querySelector(sel).click();
      const input = d.querySelector('input.edit, .cost input, .budget input');
      assert.ok(input, `an input opened for ${sel}`);
      input.value = value;
      input.dispatchEvent(new w.KeyboardEvent('keydown', { key, bubbles: true }));
    },
    line: () => ({
      committed: d.getElementById('committed')?.textContent,
      spent: d.getElementById('spent')?.textContent,
      remaining: d.getElementById('remaining')?.textContent,
      uncosted: d.getElementById('uncosted')?.textContent ?? null,
    }),
  };
  return h;
}

/* ---- the page ---- */

test('a fresh page opens on the Backlog, empty, with the budget unset', () => {
  const { $, line } = boot();
  assert.equal($('#tab-backlog').getAttribute('aria-selected'), 'true');
  assert.equal($('#view-backlog').hidden, false);
  assert.equal($('#view-active').hidden, true);
  assert.match($('#backlog').textContent, /Nothing waiting/);
  assert.equal($('[data-budget]').textContent, 'Set the 2026 budget');
  assert.deepEqual(line(), { committed: '$0', spent: '$0', remaining: '—', uncosted: null });
});

test('the version marker matches the service-worker cache name', () => {
  const { $ } = boot();
  const cache = SW.match(/const CACHE = '([^']+)'/)[1];
  assert.equal($('.ver').textContent, cache);
});

test('tabs swap panels and aria-selected', () => {
  const { $, click } = boot();
  click('#tab-completed');
  assert.equal($('#tab-completed').getAttribute('aria-selected'), 'true');
  assert.equal($('#view-completed').hidden, false);
  assert.equal($('#view-backlog').hidden, true);
});

/* ---- add ---- */

test('Enter adds a project by title only; it lands last, with every field carried empty', () => {
  const { titles, stored, type } = boot();
  type('Fix garage door');
  type('Paint bedroom');
  assert.deepEqual(titles('backlog'), ['Fix garage door', 'Paint bedroom']);
  const [a, b] = stored().projects;
  assert.equal(a.priority_order, 1);
  assert.equal(b.priority_order, 2);
  assert.equal(b.status, 'backlog');
  assert.equal(b.effort, null);
  assert.equal(b.estimated_cost, null);
  assert.deepEqual(b.vendor_ids, []);
  assert.deepEqual(b.dependency_ids, []);
  assert.equal(b.calendar_event_id, null);
  assert.equal(b.completed_at, null);
  assert.equal(b.created_at, '2026-09-19T10:00:00.000Z');
});

test('an empty title adds nothing', () => {
  const { stored, type } = boot();
  type('   ');
  assert.equal(stored(), null);
});

/* ---- edit in place ---- */

test('tapping a title edits it; empty or Escape keeps the original', () => {
  const { titles, stored, edit } = boot({ seed: { [KEY]: doc([project({ id: 'a', title: 'Fix faucet' })]) } });
  edit('[data-edit="a"]', 'Replace faucet');
  assert.deepEqual(titles('backlog'), ['Replace faucet']);
  assert.equal(stored().projects[0].title, 'Replace faucet');
  edit('[data-edit="a"]', '');
  assert.deepEqual(titles('backlog'), ['Replace faucet']);
  edit('[data-edit="a"]', 'thrown away', 'Escape');
  assert.deepEqual(titles('backlog'), ['Replace faucet']);
});

test('the effort chip cycles — · S · M · L and persists', () => {
  const { $, stored, click } = boot({ seed: { [KEY]: doc([project({ id: 'a' })]) } });
  assert.equal($('[data-effort="a"]').textContent, '—');
  click('[data-effort="a"]'); assert.equal($('[data-effort="a"]').textContent, 'S');
  click('[data-effort="a"]'); assert.equal($('[data-effort="a"]').textContent, 'M');
  click('[data-effort="a"]'); assert.equal($('[data-effort="a"]').textContent, 'L');
  assert.equal(stored().projects[0].effort, 'L');
  click('[data-effort="a"]'); assert.equal($('[data-effort="a"]').textContent, '—');
  assert.equal(stored().projects[0].effort, null);
});

test('tapping the cost edits it; "$1,250" parses, nonsense is ignored, empty clears', () => {
  const { $, stored, edit } = boot({ seed: { [KEY]: doc([project({ id: 'a' })]) } });
  assert.equal($('[data-cost="a"]').textContent, 'cost?');
  edit('[data-cost="a"]', '$1,250');
  assert.equal($('[data-cost="a"]').textContent, '$1,250');
  assert.equal(stored().projects[0].estimated_cost, 1250);
  edit('[data-cost="a"]', 'about a grand');
  assert.equal(stored().projects[0].estimated_cost, 1250);
  edit('[data-cost="a"]', '');
  assert.equal(stored().projects[0].estimated_cost, null);
  assert.equal($('[data-cost="a"]').textContent, 'cost?');
});

/* ---- order ---- */

test('up and down move a backlog row and renumber priority_order; the ends are disabled', () => {
  const seed = doc([project({ id: 'a', title: 'A', priority_order: 1 }), project({ id: 'b', title: 'B', priority_order: 2 }), project({ id: 'c', title: 'C', priority_order: 3 })]);
  const { $, titles, stored, click } = boot({ seed: { [KEY]: seed } });
  assert.equal($('[data-up="a"]').disabled, true);
  assert.equal($('[data-down="c"]').disabled, true);
  click('[data-up="c"]');
  assert.deepEqual(titles('backlog'), ['A', 'C', 'B']);
  click('[data-down="a"]');
  assert.deepEqual(titles('backlog'), ['C', 'A', 'B']);
  const order = Object.fromEntries(stored().projects.map(p => [p.id, p.priority_order]));
  assert.deepEqual(order, { c: 1, a: 2, b: 3 });
});

test('the order survives a reload', () => {
  const seed = doc([project({ id: 'a', title: 'A', priority_order: 2 }), project({ id: 'b', title: 'B', priority_order: 1 })]);
  const { titles } = boot({ seed: { [KEY]: seed } });
  assert.deepEqual(titles('backlog'), ['B', 'A']);
});

/* ---- the two moves ---- */

test('Activate moves a project to Active; the backlog renumbers; Active opens on the next load', () => {
  const seed = doc([project({ id: 'a', title: 'A', priority_order: 1 }), project({ id: 'b', title: 'B', priority_order: 2 })]);
  const { $, titles, stored, click } = boot({ seed: { [KEY]: seed } });
  click('[data-activate="a"]');
  assert.deepEqual(titles('backlog'), ['B']);
  assert.deepEqual(titles('active'), ['A']);
  assert.equal(stored().projects.find(p => p.id === 'a').status, 'activated');
  assert.equal(stored().projects.find(p => p.id === 'b').priority_order, 1);
  assert.equal($('#tab-active').textContent, 'Active · 1');
  const again = boot({ seed: { [KEY]: stored() } });
  assert.equal(again.$('#tab-active').getAttribute('aria-selected'), 'true');
  assert.equal(again.$('#view-active').hidden, false);
});

test('Done completes an active project with the date; Completed lists newest first and stays readable', () => {
  const seed = doc([
    project({ id: 'a', title: 'A', status: 'activated', estimated_cost: 100 }),
    project({ id: 'old', title: 'Old', status: 'completed', completed_at: '2026-03-01T09:00:00.000Z' }),
  ]);
  const { $, titles, stored, click } = boot({ seed: { [KEY]: seed } });
  click('[data-complete="a"]');
  assert.deepEqual(titles('active'), []);
  assert.deepEqual(titles('completed'), ['A', 'Old']);
  const a = stored().projects.find(p => p.id === 'a');
  assert.equal(a.status, 'completed');
  assert.equal(a.completed_at, '2026-09-19T10:00:00.000Z');
  assert.match($('#completed').textContent, /Sep 19, 2026/);
  assert.equal($('#completed [data-effort], #completed [data-cost], #completed button'), null, 'completed rows carry no controls');
});

/* ---- delete: hold-and-confirm, backlog only ---- */

test('askDelete removes a backlog project only after confirm; Active and Completed are never deleted', () => {
  const seed = doc([
    project({ id: 'a', title: 'A', priority_order: 1 }), project({ id: 'b', title: 'B', priority_order: 2 }),
    project({ id: 'x', title: 'X', status: 'activated' }), project({ id: 'y', title: 'Y', status: 'completed', completed_at: '2026-01-01T00:00:00.000Z' }),
  ]);
  const yes = boot({ seed: { [KEY]: seed }, confirm: true });
  assert.equal(yes.w.askDelete('a'), true);
  assert.deepEqual(yes.titles('backlog'), ['B']);
  assert.equal(yes.stored().projects.find(p => p.id === 'b').priority_order, 1);
  assert.equal(yes.w.askDelete('x'), false);
  assert.equal(yes.w.askDelete('y'), false);
  assert.equal(yes.stored().projects.length, 3);
  const no = boot({ seed: { [KEY]: seed }, confirm: false });
  assert.equal(no.w.askDelete('a'), false);
  assert.deepEqual(no.titles('backlog'), ['A', 'B']);
});

test('a hold on a backlog row asks; a tap does not', async () => {
  const seed = doc([project({ id: 'a', title: 'A' })]);
  const { w, $, titles } = boot({ seed: { [KEY]: seed }, confirm: true });
  const row = $('[data-row="a"] .num');
  row.dispatchEvent(new w.Event('pointerdown', { bubbles: true }));
  row.dispatchEvent(new w.Event('pointerup', { bubbles: true }));
  await new Promise(r => setTimeout(r, 700));
  assert.deepEqual(titles('backlog'), ['A']);
  row.dispatchEvent(new w.Event('pointerdown', { bubbles: true }));
  await new Promise(r => setTimeout(r, 700));
  assert.deepEqual(titles('backlog'), []);
});

/* ---- the budget line ---- */

test('the budget is set once by tapping the figure, and persists', () => {
  const { $, stored, edit, line } = boot();
  edit('[data-budget]', '12000');
  assert.equal($('[data-budget]').textContent, '$12,000');
  assert.equal(stored().budget.amount, 12000);
  assert.equal(stored().budget.year, 2026);
  assert.equal(line().remaining, '$12,000');
  const again = boot({ seed: { [KEY]: stored() } });
  assert.equal(again.$('[data-budget]').textContent, '$12,000');
});

test('committed = active costs, spent = completed this year, remaining = budget − both; nothing stored', () => {
  const seed = doc([
    project({ id: 'b1', estimated_cost: 999 }),                                    // backlog: not counted
    project({ id: 'a1', status: 'activated', estimated_cost: 4000 }),
    project({ id: 'a2', status: 'activated', estimated_cost: 350.5 }),
    project({ id: 'c1', status: 'completed', estimated_cost: 2100, completed_at: '2026-02-10T00:00:00.000Z' }),
    project({ id: 'c0', status: 'completed', estimated_cost: 5000, completed_at: '2025-12-30T00:00:00.000Z' }),  // last year
  ], { year: 2026, amount: 12000, currency: 'USD' });
  const { line, stored } = boot({ seed: { [KEY]: seed } });
  assert.deepEqual(line(), { committed: '$4,350.50', spent: '$2,100', remaining: '$5,549.50', uncosted: null });
  assert.equal(Object.keys(stored().budget).sort().join(), 'amount,currency,year');
});

test('empty costs count as zero and the line says how many', () => {
  const seed = doc([
    project({ id: 'a1', status: 'activated', estimated_cost: 500 }),
    project({ id: 'a2', status: 'activated' }),
    project({ id: 'c1', status: 'completed', completed_at: '2026-05-01T00:00:00.000Z' }),
    project({ id: 'b1' }),   // backlog without a cost is not a caveat on the line
  ], { year: 2026, amount: 1000, currency: 'USD' });
  const { line } = boot({ seed: { [KEY]: seed } });
  assert.deepEqual(line(), { committed: '$500', spent: '$0', remaining: '$500', uncosted: '2 projects without a cost yet' });
});

test('overspend shows as a negative remaining', () => {
  const seed = doc([project({ id: 'a1', status: 'activated', estimated_cost: 1500 })], { year: 2026, amount: 1000, currency: 'USD' });
  const { $, line } = boot({ seed: { [KEY]: seed } });
  assert.equal(line().remaining, '$-500');
  assert.ok($('#remaining').closest('.neg'));
});

test('the line follows the moves: activate commits, complete moves it to spent', () => {
  const seed = doc([project({ id: 'a', estimated_cost: 300 })], { year: 2026, amount: 1000, currency: 'USD' });
  const { line, click } = boot({ seed: { [KEY]: seed } });
  assert.deepEqual(line(), { committed: '$0', spent: '$0', remaining: '$1,000', uncosted: null });
  click('[data-activate="a"]');
  assert.deepEqual(line(), { committed: '$300', spent: '$0', remaining: '$700', uncosted: null });
  click('[data-complete="a"]');
  assert.deepEqual(line(), { committed: '$0', spent: '$300', remaining: '$700', uncosted: null });
});

/* ---- reload round-trip ---- */

test('a reload shows exactly what was stored', () => {
  const first = boot();
  first.type('Fix garage door');
  first.edit('[data-cost]', '500');
  first.click('[data-effort]');
  first.edit('[data-budget]', '9000');
  const again = boot({ seed: { [KEY]: first.stored() } });
  assert.deepEqual(again.titles('backlog'), ['Fix garage door']);
  assert.equal(again.$('[data-effort]').textContent, 'S');
  assert.equal(again.$('[data-cost]').textContent, '$500');
  assert.equal(again.$('[data-budget]').textContent, '$9,000');
  assert.deepEqual(again.stored(), first.stored());
});

test('a corrupt document starts fresh without throwing', () => {
  const { $, w } = boot({ seed: { [KEY]: 'not json' } });
  w.localStorage.setItem(KEY, '{{{');
  assert.doesNotThrow(() => w.load());
  assert.match($('#status').textContent, /Starting fresh/);
});

/* ---- vendors (D2a) ---- */

const vendor = (over = {}) => ({ id: over.id || Math.random().toString(36).slice(2, 8), name: 'Someone', category: '', phone: '', email: '', website: '', notes: '', created_at: '2026-09-19T10:00:00.000Z', updated_at: '2026-09-19T10:00:00.000Z', ...over });
const docV = (vendors, projects = []) => ({ projects, vendors, budget: { year: 2026, amount: null, currency: 'USD' } });

function typeVendor(h, name) {
  const f = h.w.document.getElementById('vendor-field'); f.value = name;
  f.dispatchEvent(new h.w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
}
function editVendor(h, sel, value, key = 'Enter') {
  h.w.document.querySelector(sel).click();
  const input = h.w.document.querySelector('#vendors input');
  assert.ok(input, `an input opened for ${sel}`);
  input.value = value;
  input.dispatchEvent(new h.w.KeyboardEvent('keydown', { key, bubbles: true }));
}

test('the Vendors tab is there, empty, and a document without vendors still loads', () => {
  const h = boot({ seed: { [KEY]: doc([project({ id: 'a' })]) } });   // a D1-era document: no vendors array
  h.click('#tab-vendors');
  assert.equal(h.$('#view-vendors').hidden, false);
  assert.match(h.$('#vendors').textContent, /No vendors yet/);
  assert.equal(h.$('#tab-vendors').textContent, 'Vendors');
});

test('Enter adds a vendor by name with every field empty; the list is by name', () => {
  const h = boot();
  typeVendor(h, 'Zed Plumbing');
  typeVendor(h, 'ace electric');
  assert.deepEqual(h.titles('vendors'), ['ace electric', 'Zed Plumbing']);
  assert.equal(h.$('#tab-vendors').textContent, 'Vendors · 2');
  const v = h.stored().vendors.find(x => x.name === 'Zed Plumbing');
  assert.deepEqual([v.category, v.phone, v.email, v.website, v.notes], ['', '', '', '', '']);
  assert.equal(v.created_at, '2026-09-19T10:00:00.000Z');
  typeVendor(h, '  ');
  assert.equal(h.stored().vendors.length, 2);
});

test('a name edits in place; empty keeps the original; fields edit and clear; links form', () => {
  const h = boot({ seed: { [KEY]: docV([vendor({ id: 'v', name: 'Ace' })]) } });
  editVendor(h, '[data-vendor-name="v"]', 'Ace Electric');
  assert.deepEqual(h.titles('vendors'), ['Ace Electric']);
  editVendor(h, '[data-vendor-name="v"]', '');
  assert.deepEqual(h.titles('vendors'), ['Ace Electric']);
  editVendor(h, '[data-vendor-field="v"][data-field="phone"]', '(555) 010-2030');
  assert.equal(h.$('#vendors a[href="tel:5550102030"]').textContent, '(555) 010-2030');
  editVendor(h, '[data-vendor-field="v"][data-field="email"]', 'ace@example.com');
  assert.ok(h.$('#vendors a[href="mailto:ace@example.com"]'));
  editVendor(h, '[data-vendor-field="v"][data-field="website"]', 'ace.example.com');
  assert.ok(h.$('#vendors a[href="https://ace.example.com"]'));
  editVendor(h, '[data-vendor-field="v"][data-field="category"]', 'Electrician');
  editVendor(h, '[data-vendor-field="v"][data-field="notes"]', 'Licensed; came recommended.');
  assert.equal(h.$('#vendors .notes').textContent, 'Licensed; came recommended.');
  const v = h.stored().vendors[0];
  assert.deepEqual([v.category, v.phone, v.email, v.website, v.notes], ['Electrician', '(555) 010-2030', 'ace@example.com', 'ace.example.com', 'Licensed; came recommended.']);
  editVendor(h, '[data-vendor-field="v"][data-field="phone"]', '');
  assert.equal(h.stored().vendors[0].phone, '');
  assert.equal(h.$('#vendors a[href^="tel:"]'), null);
  editVendor(h, '[data-vendor-field="v"][data-field="category"]', 'thrown away', 'Escape');
  assert.equal(h.stored().vendors[0].category, 'Electrician');
});

test('askDeleteVendor: confirmed removes a free vendor; a vendor a project names stays', () => {
  const seed = docV([vendor({ id: 'free', name: 'Free' }), vendor({ id: 'used', name: 'Used' })], [project({ id: 'p', vendor_ids: ['used'] })]);
  const yes = boot({ seed: { [KEY]: seed }, confirm: true });
  assert.equal(yes.w.askDeleteVendor('used'), false);
  assert.match(yes.$('#status').textContent, /Used is named by a project/);
  assert.equal(yes.w.askDeleteVendor('free'), true);
  assert.deepEqual(yes.stored().vendors.map(v => v.name), ['Used']);
  const no = boot({ seed: { [KEY]: seed }, confirm: false });
  assert.equal(no.w.askDeleteVendor('free'), false);
  assert.equal(no.stored().vendors.length, 2);
});

test('a hold on a vendor row asks; a hold on its link does not', async () => {
  const h = boot({ seed: { [KEY]: docV([vendor({ id: 'v', name: 'Ace', phone: '555' })]) }, confirm: true });
  h.$('#vendors a[href^="tel:"]').dispatchEvent(new h.w.Event('pointerdown', { bubbles: true }));
  await new Promise(r => setTimeout(r, 700));
  assert.deepEqual(h.titles('vendors'), ['Ace']);
  h.$('[data-vendor-row="v"]').dispatchEvent(new h.w.Event('pointerdown', { bubbles: true }));
  await new Promise(r => setTimeout(r, 700));
  assert.deepEqual(h.titles('vendors'), []);
});

test('vendors survive a reload alongside projects and the budget', () => {
  const first = boot();
  first.type('Fix garage door');
  typeVendor(first, 'Ace');
  const again = boot({ seed: { [KEY]: first.stored() } });
  assert.deepEqual(again.titles('backlog'), ['Fix garage door']);
  assert.deepEqual(again.titles('vendors'), ['Ace']);
  assert.deepEqual(again.stored(), first.stored());
});

/* ---- import (D2i) ---- */

// A seed-shaped document, made up from the seed's schema (never from a real
// one): richer records than §8, a nameless pending one, an inactive list.
const SEED = {
  schema_version: 1,
  contacts: [
    { id: 'acme', display_name: 'Acme Electric (electrician)', name: 'Pat Example', organization: 'Acme Electric', category: 'home-maintenance',
      services: ['Electrician'], phone: '+1 555-010-2030', phone_alt: { label: 'Office', number: '+1 555-010-2031' }, email: null,
      website: 'https://acme.example.com', address: '1 Main St', status: 'active',
      subscription: { plan: 'Care plan', benefits: ['10% off', 'Priority'], scheduling: 'Call to book.' }, notes: 'Open quote.' },
    { id: 'tbd', display_name: null, name: null, organization: null, category: 'home-maintenance', services: ['Landscaping'], status: 'pending', notes: null },
    { id: 'tutor', display_name: 'Sam Example (tutor)', name: 'Sam Example', nickname: 'Sammy', category: 'family', services: ['Tutor'], email: 'sam@example.com', status: 'active' },
  ],
  inactive: [{ organization: 'Old Lawn Co', services: ['Lawn'], status: 'inactive', display_name: 'Old Lawn Co' }],
};

function importPaste(h, textOrObj) {
  const box = h.w.document.getElementById('vendor-paste');
  box.value = typeof textOrObj === 'string' ? textOrObj : JSON.stringify(textOrObj);
  h.click('#vendor-import-go');
}

test('a seed document imports its contacts: §8 fields mapped, the rest folded into notes, inactive left out', () => {
  const h = boot();
  h.click('#tab-vendors');
  importPaste(h, SEED);
  assert.equal(h.$('#status').textContent, 'Imported 3 vendors.');
  assert.deepEqual(h.titles('vendors'), ['Acme Electric (electrician)', 'Landscaping', 'Sam Example (tutor)']);
  assert.equal(h.$('#tab-vendors').textContent, 'Vendors · 3');
  const acme = h.stored().vendors.find(v => v.name.startsWith('Acme'));
  assert.deepEqual([acme.category, acme.phone, acme.email, acme.website], ['home-maintenance', '+1 555-010-2030', '', 'https://acme.example.com']);
  assert.equal(acme.notes, [
    'Open quote.',                       // the free text first
    'services: Electrician',             // organization skipped: the name already says it; status active skipped
    'phone alt:', '  label: Office', '  number: +1 555-010-2031',
    'address: 1 Main St',
    'subscription:', '  plan: Care plan', '  benefits: 10% off, Priority', '  scheduling: Call to book.',
  ].join('\n'));
  assert.equal(acme.created_at, '2026-09-19T10:00:00.000Z');
  assert.ok(h.$('#vendors a[href="tel:+15550102030"]'));
  const tbd = h.stored().vendors.find(v => v.name === 'Landscaping');   // named after its services, so they are not repeated
  assert.equal(tbd.notes, 'status: pending');
  const tutor = h.stored().vendors.find(v => v.name.startsWith('Sam'));
  assert.equal(tutor.notes, 'nickname: Sammy\nservices: Tutor');
  assert.equal(h.$('#vendor-paste').value, '');
});

test('importing again skips names already here; the app\'s own shape and a bare list import too', () => {
  const h = boot({ seed: { [KEY]: docV([vendor({ id: 'v', name: 'acme electric (ELECTRICIAN)' })]) } });
  importPaste(h, SEED);
  assert.equal(h.$('#status').textContent, 'Imported 2 vendors, 1 already here.');
  importPaste(h, SEED);
  assert.equal(h.$('#status').textContent, 'Imported 0 vendors, 3 already here.');
  assert.equal(h.stored().vendors.length, 3);
  importPaste(h, { vendors: [vendor({ name: 'Zed Plumbing', phone: '555', notes: 'kept as is' })] });
  assert.equal(h.stored().vendors.find(v => v.name === 'Zed Plumbing').notes, 'kept as is');
  importPaste(h, [{ name: 'Bare Co' }, { name: '' }, 'junk', null]);
  assert.equal(h.$('#status').textContent, 'Imported 1 vendor.');
  assert.deepEqual(h.titles('vendors'), ['acme electric (ELECTRICIAN)', 'Bare Co', 'Landscaping', 'Sam Example (tutor)', 'Zed Plumbing']);
});

test('bad input imports nothing and says so', () => {
  const h = boot();
  importPaste(h, '{{{');
  assert.equal(h.$('#status').textContent, 'That is not JSON.');
  assert.equal(h.$('#vendor-paste').value, '{{{');   // kept, so it can be fixed
  importPaste(h, { budget: 1 });
  assert.match(h.$('#status').textContent, /No vendors in that/);
  importPaste(h, []);
  assert.equal(h.$('#status').textContent, 'Nothing to import.');
  importPaste(h, '   ');
  assert.equal(h.stored(), null);
});

test('a chosen file imports the same way', async () => {
  const h = boot();
  const input = h.$('#vendor-file');
  const file = new h.w.File([JSON.stringify(SEED)], 'contacts.json', { type: 'application/json' });
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  input.dispatchEvent(new h.w.Event('change', { bubbles: true }));
  await new Promise(r => setTimeout(r, 50));
  assert.equal(h.$('#status').textContent, 'Imported 3 vendors.');
  assert.equal(h.stored().vendors.length, 3);
});
