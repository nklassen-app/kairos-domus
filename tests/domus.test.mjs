// DOM-level tests for Domus (D9b-1: one list by month, the project sheet,
// Budget and Done as their own views). index.html is booted in jsdom under a fixed
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
function boot({ now = new Date('2026-09-19T10:00:00.000Z'), seed = {}, confirm = true, prompt = null } = {}) {
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
      window.prompt = () => prompt;   // what a "+ New vendor…" prompt answers; null = cancelled
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
    // add through the + button and the sheet
    type(text) { d.getElementById('add').click(); d.getElementById('s-title').value = text; d.getElementById('s-add').click(); },
    titles: (board) => [...d.querySelectorAll(`#${board} .title`)].map(e => e.textContent),
    click: (sel) => d.querySelector(sel).click(),
    // set a control in the sheet (input, select or textarea) and fire its change
    set(id, value) { const el = d.getElementById(id); assert.ok(el, `#${id} is there`); el.value = value; el.dispatchEvent(new w.Event('change', { bubbles: true })); },
    open: (id) => d.querySelector(`[data-project="${id}"]`).click(),
    sheetOpen: () => !d.getElementById('sheet').hidden,
    // the budget figure is still edited in place
    editBudget(value) {
      d.querySelector('[data-budget]').click();
      const input = d.querySelector('#budget input');
      input.value = value;
      input.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    },
    figures: () => ({
      spent: d.getElementById('spent')?.textContent,
      planned: d.getElementById('planned')?.textContent,
      remaining: d.getElementById('remaining')?.textContent,
      uncosted: d.getElementById('uncosted')?.textContent ?? null,
    }),
  };
  return h;
}

/* ---- the page ---- */

test('a fresh page opens on Plan, empty, with the four places at the bottom and the + button', () => {
  const { $, $$ } = boot();
  assert.deepEqual($$('.nav [role="tab"]').map(t => t.textContent), ['Plan', 'Vendors', 'Budget', 'Done']);
  assert.equal($('#tab-plan').getAttribute('aria-selected'), 'true');
  assert.equal($('#view-plan').hidden, false);
  assert.match($('#plan').textContent, /Nothing planned/);
  assert.equal($('#add').hidden, false);
  assert.equal($('#sheet').hidden, true);
  assert.equal($('#tab-backlog, #tab-active, [data-activate]'), null, 'Backlog, Active and Activate are gone');
});

test('the version marker matches the service-worker cache name', () => {
  const { $ } = boot();
  const cache = SW.match(/const CACHE = '([^']+)'/)[1];
  assert.equal($('.ver').textContent, cache);
});

test('the bottom bar swaps views; the + button shows on Plan only', () => {
  const { $, click } = boot();
  for (const v of ['vendors', 'budget', 'done', 'plan']){
    click('#tab-' + v);
    assert.equal($('#tab-' + v).getAttribute('aria-selected'), 'true');
    assert.equal($('#view-' + v).hidden, false);
    assert.equal($('#add').hidden, v !== 'plan');
  }
  assert.equal($('#view-budget').hidden, true);
});

/* ---- add ---- */

test('+ opens an empty sheet; Add creates an open project with every field carried empty, under Later', () => {
  const h = boot();
  h.click('#add');
  assert.equal(h.sheetOpen(), true);
  assert.equal(h.$('#s-add').textContent, 'Add');
  assert.equal(h.$('#s-done'), null, 'a new project cannot be marked done yet');
  h.$('#s-title').value = 'Fix garage door'; h.click('#s-add');
  assert.equal(h.sheetOpen(), false);
  h.type('Paint bedroom');
  assert.deepEqual(h.titles('plan'), ['Fix garage door', 'Paint bedroom']);
  const b = h.stored().projects[1];
  assert.equal(b.status, 'backlog', 'open; the status an old reader expects');
  for (const f of ['target_month', 'effort', 'estimated_cost', 'calendar_event_id', 'completed_at', 'priority_order']) assert.equal(b[f], null, f);
  assert.deepEqual(b.vendor_ids, []);
  assert.deepEqual(b.dependency_ids, []);
  assert.equal(b.created_at, '2026-09-19T10:00:00.000Z');
  assert.equal(h.$('[data-group="later"] .sechead h2').textContent, 'Later');
});

test('what is set in the new sheet before Add is kept', () => {
  const h = boot({ now: new Date('2026-09-25T12:00:00.000Z') });
  h.click('#add');
  h.$('#s-title').value = 'Gutters';
  h.$('#s-title').dispatchEvent(new h.w.Event('input', { bubbles: true }));
  h.set('s-month', '2026-10');
  assert.equal(h.$('#s-title').value, 'Gutters', 'picking a month keeps the typed title');
  h.click('[data-eff="M"]');
  h.set('s-cost', '$320');
  assert.equal(h.stored(), null, 'nothing is saved before Add');
  h.click('#s-add');
  const p = h.stored().projects[0];
  assert.deepEqual([p.title, p.target_month, p.effort, p.estimated_cost], ['Gutters', '2026-10', 'M', 320]);
  assert.deepEqual(groupsOf(h).next.titles, ['Gutters']);
});

test('an empty title adds nothing and says so; Cancel and Escape discard', () => {
  const h = boot();
  h.click('#add'); h.$('#s-title').value = '   '; h.click('#s-add');
  assert.equal(h.stored(), null);
  assert.equal(h.sheetOpen(), true);
  assert.match(h.$('#status').textContent, /title/);
  h.click('#s-cancel');
  assert.equal(h.sheetOpen(), false);
  h.click('#add'); h.$('#s-title').value = 'Thrown away';
  h.w.document.dispatchEvent(new h.w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.equal(h.sheetOpen(), false);
  assert.equal(h.stored(), null);
});

/* ---- the sheet ---- */

test('tapping a row opens its sheet; the title edits, and empty keeps the original', () => {
  const h = boot({ seed: { [KEY]: doc([project({ id: 'a', title: 'Fix faucet' })]) } });
  h.open('a');
  assert.equal(h.sheetOpen(), true);
  assert.equal(h.$('#s-title').value, 'Fix faucet');
  h.set('s-title', 'Replace faucet');
  assert.equal(h.stored().projects[0].title, 'Replace faucet');
  assert.deepEqual(h.titles('plan'), ['Replace faucet']);
  h.set('s-title', '  ');
  assert.equal(h.stored().projects[0].title, 'Replace faucet');
  assert.equal(h.$('#s-title').value, 'Replace faucet');
  h.click('#dim');
  assert.equal(h.sheetOpen(), false);
  h.open('a'); h.click('#s-close');
  assert.equal(h.sheetOpen(), false);
});

test('effort, cost and notes are set in the sheet; "$1,250" parses, nonsense is ignored, empty clears', () => {
  const h = boot({ seed: { [KEY]: doc([project({ id: 'a' })]) } });
  h.open('a');
  assert.equal(h.$('[data-eff=""]').getAttribute('aria-pressed'), 'true');
  h.click('[data-eff="L"]');
  assert.equal(h.stored().projects[0].effort, 'L');
  assert.equal(h.$('[data-eff="L"]').getAttribute('aria-pressed'), 'true');
  h.click('[data-eff=""]');
  assert.equal(h.stored().projects[0].effort, null);
  h.set('s-cost', '$1,250');
  assert.equal(h.stored().projects[0].estimated_cost, 1250);
  assert.equal(h.$('#plan .cost').textContent, '$1,250');
  h.set('s-cost', 'about a grand');
  assert.equal(h.stored().projects[0].estimated_cost, 1250);
  assert.equal(h.$('#s-cost').value, '1250');
  h.set('s-cost', '');
  assert.equal(h.stored().projects[0].estimated_cost, null);
  assert.equal(h.$('#plan .cost').textContent, 'no cost');
  h.set('s-notes', 'Bring the long ladder.');
  assert.equal(h.stored().projects[0].description, 'Bring the long ladder.');
});

test('a row is the title, one quiet line and the cost — no chips or buttons on it', () => {
  const h = boot({ now: new Date('2026-09-25T12:00:00.000Z'), seed: { [KEY]: docV(
    [vendor({ id: 'ace', name: 'Ace Electric' }), vendor({ id: 'bob', name: 'Bob Builds' })],
    [project({ id: 'a', title: 'Panel', effort: 'L', estimated_cost: 2400, vendor_ids: ['ace', 'bob'], target_month: '2026-09' }),
     project({ id: 'b', title: 'Fence', target_month: '2026-11' }),
     project({ id: 'c', title: 'Attic', effort: 'S', target_month: '2027-06' })]) } });
  const sub = id => h.$(`[data-project="${id}"] .sub`).textContent;
  assert.equal(sub('a'), 'Ace Electric, Bob Builds · L');
  assert.equal(sub('b'), 'Nov · DIY', 'the quarter group shows which month');
  assert.equal(sub('c'), "Jun '27 · DIY · S");
  assert.equal(h.$('#plan .chip, #plan select, #plan [data-activate], #plan [data-up]'), null);
});

/* ---- vendors on a project (D2b, now in the sheet) ---- */

test('the sheet links, adds a second, and unlinks vendors; none is DIY', () => {
  const h = boot({ seed: { [KEY]: docV([vendor({ id: 'ace', name: 'Ace' }), vendor({ id: 'bob', name: 'Bob' })], [project({ id: 'a', title: 'A' })]) } });
  h.open('a');
  assert.equal(h.$('#s-vendor option').textContent, 'DIY — add a vendor');
  h.set('s-vendor', 'ace');
  h.set('s-vendor', 'bob');
  assert.deepEqual(h.stored().projects[0].vendor_ids, ['ace', 'bob']);
  assert.deepEqual(h.$$('#sheet [data-unlink]').map(b => b.textContent), ['Ace', 'Bob']);
  assert.deepEqual(h.$$('#s-vendor option').map(o => o.value), ['', '__new'], 'a linked vendor is not offered twice');
  h.click('[data-unlink="ace"]');
  assert.deepEqual(h.stored().projects[0].vendor_ids, ['bob']);
  assert.equal(h.$('[data-project="a"] .sub').textContent, 'Bob');
  h.click('[data-unlink="bob"]');
  assert.equal(h.$('[data-project="a"] .sub').textContent, 'DIY');
});

test('"+ New vendor…" asks for a name and links the new vendor; a cancelled prompt changes nothing', () => {
  const h = boot({ seed: { [KEY]: doc([project({ id: 'a', title: 'A' })]) }, prompt: 'Zed Plumbing' });
  h.open('a');
  h.set('s-vendor', '__new');
  const v = h.stored().vendors[0];
  assert.equal(v.name, 'Zed Plumbing');
  assert.deepEqual(h.stored().projects[0].vendor_ids, [v.id]);
  const no = boot({ seed: { [KEY]: doc([project({ id: 'a', title: 'A' })]) }, prompt: null });
  no.open('a');
  no.set('s-vendor', '__new');
  assert.deepEqual(no.stored().vendors ?? [], []);
  assert.deepEqual(no.stored().projects[0].vendor_ids, []);
  assert.equal(no.$('#s-vendor').value, '');
});

test('a vendor a project names cannot be deleted; unlinked, it can', () => {
  const h = boot({ seed: { [KEY]: docV([vendor({ id: 'ace', name: 'Ace' })], [project({ id: 'a', vendor_ids: ['ace'] })]) }, confirm: true });
  assert.equal(h.w.askDeleteVendor('ace'), false);
  h.open('a'); h.click('[data-unlink="ace"]'); h.click('#dim');
  assert.equal(h.w.askDeleteVendor('ace'), true);
});

/* ---- done and delete ---- */

test('Mark done completes the project with the date; it leaves Plan for Done, by year, newest first', () => {
  const seed = doc([
    project({ id: 'a', title: 'A', estimated_cost: 100 }),
    project({ id: 'old', title: 'Old', status: 'completed', completed_at: '2025-03-01T09:00:00.000Z' }),
    project({ id: 'mid', title: 'Mid', status: 'completed', completed_at: '2026-03-01T09:00:00.000Z' }),
  ]);
  const h = boot({ seed: { [KEY]: seed } });
  h.open('a'); h.click('#s-done');
  assert.equal(h.sheetOpen(), false);
  assert.deepEqual(h.titles('plan'), []);
  const a = h.stored().projects.find(p => p.id === 'a');
  assert.equal(a.status, 'completed');
  assert.equal(a.completed_at, '2026-09-19T10:00:00.000Z');
  h.click('#tab-done');
  assert.deepEqual(h.titles('done'), ['A', 'Mid', 'Old']);
  assert.deepEqual(h.$$('#done .sechead h2').map(e => e.textContent), ['2026', '2025']);
  assert.match(h.$('#done').textContent, /Sep 19, 2026/);
});

/* ---- reopen: a done project can come back ---- */

test('Mark done shows a toast with Undo; Undo puts the project back in Plan exactly as it was', () => {
  const h = boot({ seed: { [KEY]: docV([vendor({ id: 'ace', name: 'Ace' })], [project({ id: 'a', title: 'A', target_month: '2026-09', effort: 'M', estimated_cost: 300, vendor_ids: ['ace'] })]) } });
  h.open('a'); h.click('#s-done');
  assert.equal(h.$('#toast').hidden, false);
  assert.equal(h.$('#toast-text').textContent, 'Done: A');
  assert.equal(h.$('#toast-undo').hidden, false);
  h.click('#toast-undo');
  const a = h.stored().projects[0];
  assert.equal(a.status, 'backlog');
  assert.equal(a.completed_at, null);
  assert.deepEqual([a.target_month, a.effort, a.estimated_cost, a.vendor_ids], ['2026-09', 'M', 300, ['ace']]);
  assert.deepEqual(groupsOf(h).this.titles, ['A']);
  assert.equal(h.$('#toast-undo').hidden, true, 'the confirmation carries no second Undo');
});

test('a done project opens read-only from Done, and Reopen brings it back to Plan', () => {
  const seed = doc([project({ id: 'y', title: 'Y', status: 'completed', completed_at: '2026-03-01T09:00:00.000Z', estimated_cost: 200, effort: 'S' })], { year: 2026, amount: 1000, currency: 'USD' });
  const h = boot({ seed: { [KEY]: seed } });
  h.click('#tab-done'); h.open('y');
  assert.equal(h.sheetOpen(), true);
  assert.equal(h.$('#s-when').textContent, 'Done Mar 1, 2026');
  assert.equal(h.$('#s-done'), null);
  assert.equal(h.$('#s-delete'), null, 'done projects are never deleted');
  for (const sel of ['#s-title', '#s-month', '#s-cost', '#s-notes', '[data-eff="S"]']) assert.equal(h.$(sel).disabled, true, sel);
  h.click('[data-eff="L"]');
  h.set('s-cost', '999');
  assert.deepEqual(h.stored(), seed, 'nothing in a done project changes');
  h.click('#tab-budget');
  assert.equal(h.figures().spent, '$200');
  h.click('#tab-done'); h.open('y'); h.click('#s-reopen');
  assert.equal(h.sheetOpen(), false);
  assert.equal(h.$('#tab-plan').getAttribute('aria-selected'), 'true');
  assert.deepEqual(h.titles('plan'), ['Y']);
  assert.equal(h.stored().projects[0].completed_at, null);
  h.click('#tab-budget');
  assert.deepEqual([h.figures().spent, h.$('#not-planned b').textContent], ['$0', '$200'], 'reopened without a month: not planned yet');
});

test('Delete asks, then removes an open project; a done project is never deleted', () => {
  const seed = doc([project({ id: 'a', title: 'A' }), project({ id: 'b', title: 'B' }), project({ id: 'y', title: 'Y', status: 'completed', completed_at: '2026-01-01T00:00:00.000Z' })]);
  const no = boot({ seed: { [KEY]: seed }, confirm: false });
  no.open('a'); no.click('#s-delete');
  assert.deepEqual(no.titles('plan'), ['A', 'B']);
  assert.equal(no.sheetOpen(), true);
  const yes = boot({ seed: { [KEY]: seed }, confirm: true });
  yes.open('a'); yes.click('#s-delete');
  assert.deepEqual(yes.titles('plan'), ['B']);
  assert.equal(yes.sheetOpen(), false);
  assert.equal(yes.w.askDelete('y'), false);
  assert.equal(yes.stored().projects.length, 2);
});

/* ---- old documents ---- */

test('an activated record from before is simply open; an old record without target_month loads as later', () => {
  const old = project({ id: 'o', title: 'Old', priority_order: 3 });
  delete old.target_month;
  const h = boot({ seed: { [KEY]: doc([project({ id: 'act', title: 'Was active', status: 'activated', target_month: '2026-09' }), old]) } });
  assert.deepEqual(groupsOf(h).this.titles, ['Was active']);
  assert.deepEqual(groupsOf(h).later.titles, ['Old']);
  h.open('o'); h.click('[data-eff="S"]');
  const saved = h.stored().projects.find(p => p.id === 'o');
  assert.equal(saved.target_month, null);
  assert.equal(saved.priority_order, 3, 'priority_order stays in the document');
  assert.equal(h.stored().projects.find(p => p.id === 'act').status, 'activated', 'status is not rewritten');
  h.open('act'); h.click('#s-done');
  assert.equal(h.stored().projects.find(p => p.id === 'act').status, 'completed');
});

/* ---- months (D7) ---- */

const groupsOf = h => Object.fromEntries(h.$$('#plan [data-group]').map(g => [g.dataset.group, {
  head: g.querySelector('h2').textContent,
  range: g.querySelector('.sum').textContent,
  empty: g.querySelector('.sechead').classList.contains('empty'),
  titles: [...g.querySelectorAll('.title')].map(e => e.textContent),
}]));
// Six months around the Q3 → Q4 boundary, one project each, plus one with no month.
const MONTH_DOC = () => doc([
  project({ id: 'aug', title: 'Aug', target_month: '2026-08' }),
  project({ id: 'sep', title: 'Sep', target_month: '2026-09', estimated_cost: 100 }),
  project({ id: 'oct', title: 'Oct', target_month: '2026-10' }),
  project({ id: 'nov', title: 'Nov', target_month: '2026-11' }),
  project({ id: 'dec', title: 'Dec', target_month: '2026-12' }),
  project({ id: 'jan', title: 'Jan', target_month: '2027-01' }),
  project({ id: 'none', title: 'None' }),
]);

test('Plan groups by month: this · next · next quarter · later, computed against today (end of Q3)', () => {
  const h = boot({ now: new Date('2026-09-25T12:00:00.000Z'), seed: { [KEY]: MONTH_DOC() } });
  const g = groupsOf(h);
  assert.deepEqual(Object.keys(g), ['this', 'next', 'quarter', 'later']);
  assert.deepEqual(g.this, { head: 'This month', range: 'Sep · $100', empty: false, titles: ['Aug', 'Sep'] }, 'a past month is overdue, not forgotten');
  assert.deepEqual(g.next.titles, ['Oct']);
  assert.equal(g.quarter.range, 'Nov – Dec · $0');
  assert.deepEqual(g.quarter.titles, ['Nov', 'Dec']);
  assert.deepEqual(g.later.titles, ['Jan', 'None'], 'beyond the next quarter is later; no month comes last');
  assert.equal(g.later.range, '$0', 'no stray separator when a group has no range');
  assert.equal(h.$('#plan-aside').textContent, '7 open');
});

test('crossing into October moves projects between groups with nothing stored changing', () => {
  const seed = MONTH_DOC();
  const h = boot({ now: new Date('2026-10-02T12:00:00.000Z'), seed: { [KEY]: seed } });
  const g = groupsOf(h);
  assert.deepEqual(g.this.titles, ['Aug', 'Sep', 'Oct']);
  assert.deepEqual(g.next.titles, ['Nov']);
  assert.equal(g.quarter.range, "Dec – Mar '27 · $0");
  assert.deepEqual(g.quarter.titles, ['Dec', 'Jan']);
  assert.deepEqual(g.later.titles, ['None']);
  assert.deepEqual(h.stored(), seed, 'rendering never writes');
});

test('empty groups keep their heading, greyed; within a group the newest is last', () => {
  const h = boot({ now: new Date('2026-09-25T12:00:00.000Z'), seed: { [KEY]: doc([
    project({ id: 'b', title: 'Newer', target_month: '2026-10', created_at: '2026-09-20T10:00:00.000Z' }),
    project({ id: 'a', title: 'Older', target_month: '2026-10', created_at: '2026-09-01T10:00:00.000Z' }),
  ]) } });
  const g = groupsOf(h);
  assert.deepEqual(g.next.titles, ['Older', 'Newer']);
  assert.deepEqual([g.this.empty, g.next.empty, g.quarter.empty, g.later.empty], [true, false, true, true]);
});

test('the month is picked in the sheet: this month and the eleven after it, or later; a past month stays offered', () => {
  const h = boot({ now: new Date('2026-09-25T12:00:00.000Z'), seed: { [KEY]: doc([project({ id: 'a', title: 'A' }), project({ id: 'p', title: 'P', target_month: '2026-07' })]) } });
  h.open('a');
  const opts = h.$$('#s-month option');
  assert.deepEqual(opts.map(o => o.value), ['', '2026-09', '2026-10', '2026-11', '2026-12', '2027-01', '2027-02', '2027-03', '2027-04', '2027-05', '2027-06', '2027-07', '2027-08']);
  assert.equal(opts[2].textContent, 'October 2026');
  h.set('s-month', '2026-10');
  assert.equal(h.stored().projects[0].target_month, '2026-10');
  assert.deepEqual(groupsOf(h).next.titles, ['A']);
  h.set('s-month', '');
  assert.equal(h.stored().projects[0].target_month, null);
  h.click('#dim'); h.open('p');
  assert.equal(h.$('#s-month').value, '2026-07');
});

/* ---- the budget view ---- */

test('the budget is set by tapping the figure on its own view, and persists', () => {
  const h = boot();
  h.click('#tab-budget');
  assert.equal(h.$('[data-budget]').textContent, 'Set the 2026 budget');
  h.editBudget('12000');
  assert.equal(h.$('[data-budget]').textContent, '$12,000');
  assert.equal(h.stored().budget.amount, 12000);
  assert.equal(h.figures().remaining, '$12,000');
  const again = boot({ seed: { [KEY]: h.stored() } });
  assert.equal(again.$('[data-budget]').textContent, '$12,000');
});

test('planned = open with a month this year, spent = done this year, remaining = budget − both; nothing stored', () => {
  const seed = doc([
    project({ id: 'p1', target_month: '2026-10', estimated_cost: 4000 }),
    project({ id: 'p2', status: 'activated', target_month: '2026-08', estimated_cost: 350.5 }),   // past month: still planned
    project({ id: 'l1', estimated_cost: 999 }),                                                   // no month: not planned
    project({ id: 'n1', target_month: '2027-02', estimated_cost: 700 }),                          // next year: not this budget
    project({ id: 'c1', status: 'completed', estimated_cost: 2100, completed_at: '2026-02-10T00:00:00.000Z' }),
    project({ id: 'c0', status: 'completed', estimated_cost: 5000, completed_at: '2025-12-30T00:00:00.000Z' }),
  ], { year: 2026, amount: 12000, currency: 'USD' });
  const h = boot({ seed: { [KEY]: seed } });
  assert.deepEqual(h.figures(), { spent: '$2,100', planned: '$4,350.50', remaining: '$5,549.50', uncosted: null });
  assert.equal(h.$('#remaining-big').textContent, '$5,549.50');
  assert.deepEqual(h.$$('#by-month .mrow').map(r => `${r.querySelector('.k').textContent} ${r.querySelector('b').textContent}`),
    ['August 2026 · 1 $350.50', 'October 2026 · 1 $4,000', 'Not planned yet · 1 $999', 'Planned for another year · 1 $700']);
  assert.equal(Object.keys(h.stored().budget).sort().join(), 'amount,currency,year');
});

test('costs missing from planned or spent are counted; overspend shows negative', () => {
  const seed = doc([
    project({ id: 'a', target_month: '2026-09', estimated_cost: 1500 }),
    project({ id: 'b', target_month: '2026-11' }),
    project({ id: 'c', status: 'completed', completed_at: '2026-05-01T00:00:00.000Z' }),
    project({ id: 'l' }),   // not planned: not a caveat
  ], { year: 2026, amount: 1000, currency: 'USD' });
  const h = boot({ seed: { [KEY]: seed } });
  assert.deepEqual(h.figures(), { spent: '$0', planned: '$1,500', remaining: '$-500', uncosted: '2 projects without a cost yet' });
  assert.ok(h.$('#remaining-big').classList.contains('neg'));
});

test('marking done moves the cost from planned to spent', () => {
  const h = boot({ seed: { [KEY]: doc([project({ id: 'a', target_month: '2026-09', estimated_cost: 300 })], { year: 2026, amount: 1000, currency: 'USD' }) } });
  assert.deepEqual(h.figures(), { spent: '$0', planned: '$300', remaining: '$700', uncosted: null });
  h.open('a'); h.click('#s-done');
  assert.deepEqual(h.figures(), { spent: '$300', planned: '$0', remaining: '$700', uncosted: null });
});

/* ---- reload round-trip ---- */

test('a reload shows exactly what was stored', () => {
  const first = boot();
  first.type('Fix garage door');
  const id = first.stored().projects[0].id;
  first.open(id); first.set('s-cost', '500'); first.click('[data-eff="S"]'); first.click('#dim');
  first.click('#tab-budget'); first.editBudget('9000');
  const again = boot({ seed: { [KEY]: first.stored() } });
  assert.deepEqual(again.titles('plan'), ['Fix garage door']);
  assert.equal(again.$('#plan .cost').textContent, '$500');
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
// The vendor sheet (D9b-2b): tap the row, change a field, Enter commits.
function editVendor(h, id, field, value, key = 'Enter') {
  if (!h.$('#sheet [data-vfield]')) h.click(`[data-vsheet="${id}"]`);
  const input = h.$(`#vs-${field}`);
  assert.ok(input, `the sheet shows ${field}`);
  input.value = value;
  if (key === 'Escape'){ h.w.document.dispatchEvent(new h.w.KeyboardEvent('keydown', { key, bubbles: true })); return; }
  if (input.tagName === 'TEXTAREA'){ input.dispatchEvent(new h.w.Event('change', { bubbles: true })); return; }
  input.dispatchEvent(new h.w.KeyboardEvent('keydown', { key, bubbles: true }));
}
// A vendor's page opens from its sheet.
function openPage(h, id) {
  h.click(`[data-vsheet="${id}"]`);
  h.click(`#sheet [data-open="${id}"]`);
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
  assert.equal(h.$('#vendors-aside').textContent, '2');
  const v = h.stored().vendors.find(x => x.name === 'Zed Plumbing');
  assert.deepEqual([v.category, v.phone, v.email, v.website, v.notes], ['', '', '', '', '']);
  assert.equal(v.created_at, '2026-09-19T10:00:00.000Z');
  typeVendor(h, '  ');
  assert.equal(h.stored().vendors.length, 2);
});

test('the vendors list is a name and one quiet line; a tap opens the sheet, where fields edit and clear, links form and an empty name keeps the old one', () => {
  const h = boot({ seed: { [KEY]: docV([vendor({ id: 'v', name: 'Ace' })]) } });
  h.click('#tab-vendors');
  assert.equal(h.$('#vendors [data-vsheet="v"] .sub').textContent, 'no details yet');
  assert.equal(h.$('#vendors input'), null, 'nothing edits on the list');
  editVendor(h, 'v', 'name', 'Ace Electric');
  assert.deepEqual(h.titles('vendors'), ['Ace Electric']);
  assert.equal(h.$('#sheet').hidden, false, 'the sheet stays open while editing');
  editVendor(h, 'v', 'name', '');
  assert.deepEqual(h.titles('vendors'), ['Ace Electric']);
  assert.equal(h.$('#vs-name').value, 'Ace Electric');
  editVendor(h, 'v', 'phone', '(555) 010-2030');
  assert.equal(h.$('#sheet a[href="tel:5550102030"]').textContent, 'Call');
  editVendor(h, 'v', 'email', 'ace@example.com');
  assert.ok(h.$('#sheet a[href="mailto:ace@example.com"]'));
  editVendor(h, 'v', 'website', 'ace.example.com');
  assert.ok(h.$('#sheet a[href="https://ace.example.com"]'));
  editVendor(h, 'v', 'category', 'Electrician');
  editVendor(h, 'v', 'notes', 'Licensed; came recommended.');
  const v = h.stored().vendors[0];
  assert.deepEqual([v.category, v.phone, v.email, v.website, v.notes], ['Electrician', '(555) 010-2030', 'ace@example.com', 'ace.example.com', 'Licensed; came recommended.']);
  assert.equal(h.$('#vendors [data-vsheet="v"] .sub').textContent, 'Electrician · (555) 010-2030');
  editVendor(h, 'v', 'phone', '');
  assert.equal(h.stored().vendors[0].phone, '');
  assert.equal(h.$('#sheet a[href^="tel:"]'), null);
  editVendor(h, 'v', 'category', 'thrown away', 'Escape');
  assert.equal(h.$('#sheet').hidden, true, 'Escape closes');
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

test('Delete in the vendor sheet asks, removes and closes; a vendor a project names stays, its sheet open', () => {
  const seed = docV([vendor({ id: 'free', name: 'Free' }), vendor({ id: 'used', name: 'Used' })], [project({ id: 'p', vendor_ids: ['used'] })]);
  const h = boot({ seed: { [KEY]: seed }, confirm: true });
  h.click('#tab-vendors');
  h.click('[data-vsheet="used"]'); h.click('#vs-delete');
  assert.equal(h.$('#sheet').hidden, false);
  assert.match(h.$('#status').textContent, /Used is named by a project/);
  h.click('#s-close');
  h.click('[data-vsheet="free"]'); h.click('#vs-delete');
  assert.equal(h.$('#sheet').hidden, true);
  assert.deepEqual(h.titles('vendors'), ['Used']);
});

test('vendors survive a reload alongside projects and the budget', () => {
  const first = boot();
  first.type('Fix garage door');
  typeVendor(first, 'Ace');
  const again = boot({ seed: { [KEY]: first.stored() } });
  assert.deepEqual(again.titles('plan'), ['Fix garage door']);
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
  assert.equal(h.$('#vendors-aside').textContent, '3');
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
  h.click(`[data-vsheet="${acme.id}"]`);
  assert.ok(h.$('#sheet a[href="tel:+15550102030"]'), 'the phone is callable from the sheet');
  h.click('#s-close');
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
  // FileReader is async: wait for the status line, not a fixed delay (50 ms
  // was flaky under load).
  for (let t = 0; t < 100 && !h.$('#status').textContent; t++) await new Promise(r => setTimeout(r, 20));
  assert.equal(h.$('#status').textContent, 'Imported 3 vendors.');
  assert.equal(h.stored().vendors.length, 3);
});

/* ---- the vendor page (D6, grouped by month since D9b-1) ---- */

const PAGE_DOC = () => docV(
  [vendor({ id: 'ace', name: 'Ace Electric', category: 'Electrician', phone: '555-0100' }), vendor({ id: 'idle', name: 'Idle Co' })],
  [
    project({ id: 'a', title: 'Panel upgrade', status: 'activated', effort: 'L', estimated_cost: 2400, vendor_ids: ['ace'], target_month: '2026-09' }),
    project({ id: 'b', title: 'Outlet in garage', effort: 'S', estimated_cost: 150, vendor_ids: ['ace'], target_month: '2026-10' }),
    project({ id: 'b2', title: 'Porch light', vendor_ids: ['ace'] }),
    project({ id: 'c', title: 'Fan install', status: 'completed', completed_at: '2026-03-01T10:00:00.000Z', estimated_cost: 300, vendor_ids: ['ace'] }),
    project({ id: 'd', title: 'Old rewiring', status: 'completed', completed_at: '2025-06-01T10:00:00.000Z', estimated_cost: 1000, vendor_ids: ['ace'] }),
    project({ id: 'x', title: 'Not theirs', vendor_ids: [] }),
  ]);
const pageText = (h, sel) => [...h.w.document.querySelectorAll(sel)].map(e => e.textContent.trim());

test('a vendor opens its page: open work by month, done collapsed by year, nothing to tap on the list; back returns', () => {
  const h = boot({ seed: { [KEY]: PAGE_DOC() } });
  h.click('#tab-vendors');
  assert.deepEqual(pageText(h, '#vendors .count'), ['5 projects', 'no projects']);
  assert.equal(h.$('#vendors [data-open]'), null, 'the page opens from the sheet');
  openPage(h, 'ace');
  assert.equal(h.$('#sheet').hidden, true, 'opening the page closes the sheet');
  assert.equal(h.$('#view-vendor').hidden, false);
  assert.equal(h.$('#view-vendors').hidden, true);
  assert.equal(h.$('#tab-vendors').getAttribute('aria-selected'), 'true');
  assert.equal(h.$('#vendor-page h1').textContent, 'Ace Electric');
  assert.equal(h.$('#vendor-page .vsub').textContent, 'Electrician · 555-0100 · Sep 19, 2026');
  assert.deepEqual(pageText(h, '#vendor-page .sechead h2'), ['September 2026', 'October 2026', 'No month yet', 'Done · 2']);
  assert.deepEqual(pageText(h, '#vendor-page .title'), ['Panel upgrade', 'Outlet in garage', 'Porch light', 'Fan install', 'Old rewiring']);
  assert.equal(h.$('#vendor-completed').open, false);
  assert.deepEqual(pageText(h, '#vendor-totals span'), ['open $2,550', 'done 2026 $300', 'done 2025 $1,000']);
  assert.equal(h.$('#vendor-page [data-project]'), null, 'the page is read-only');
  h.click('#vendor-back');
  assert.equal(h.$('#view-vendors').hidden, false);
  openPage(h, 'idle');
  assert.deepEqual(pageText(h, '#vendor-page .board-empty'), ['Nothing open.', 'Nothing done yet.']);
});

test('the costs toggle hides every cost and the totals; it holds across a re-render', () => {
  const h = boot({ seed: { [KEY]: PAGE_DOC() } });
  h.click('#tab-vendors'); openPage(h, 'ace');
  h.click('#vendor-costs');
  assert.equal(h.$('#vendor-page .cost'), null);
  assert.equal(h.$('#vendor-totals'), null);
  assert.equal(h.$('#vendor-costs').getAttribute('aria-pressed'), 'false');
  h.click('#vendor-back'); openPage(h, 'ace');
  assert.equal(h.$('#vendor-page .cost'), null, 'still hidden');
  h.click('#vendor-costs');
  assert.equal(pageText(h, '#vendor-page .cost').length, 5);
});

test('Copy as text gives a message to send as it is: one numbered list, months in brackets, notes indented, costs only when shown, done never', async () => {
  const doc = PAGE_DOC();
  doc.projects.find(p => p.id === 'a').description = 'Main panel in the basement\n\n  200A, the old one is 100A';
  doc.projects.push(project({ id: 'far', title: 'Attic fan', vendor_ids: ['ace'], target_month: '2027-11' }));
  const h = boot({ seed: { [KEY]: doc } });
  let copied = null;
  Object.defineProperty(h.w.navigator, 'clipboard', { value: { writeText: t => { copied = t; return Promise.resolve(); } }, configurable: true });
  h.click('#tab-vendors'); openPage(h, 'ace');
  h.$('#vendor-completed').open = true;
  h.$('#vendor-completed').dispatchEvent(new h.w.Event('toggle'));
  h.click('#vendor-copy');
  await new Promise(r => setTimeout(r, 0));
  assert.equal(copied, [
    'Hi, here are the jobs I have for you:', '',
    '1. Panel upgrade (September) — $2,400',
    '   Main panel in the basement',
    '   200A, the old one is 100A',
    '2. Outlet in garage (October) — $150',
    '3. Attic fan (November 2027)',
    '4. Porch light', '',
    'Thanks!', '',
  ].join('\n'), 'done work stays out even when Done is expanded; a year or more away carries its year');
  assert.equal(h.$('#status').textContent, 'Copied.');
  h.click('#vendor-costs');
  h.click('#vendor-copy');
  await new Promise(r => setTimeout(r, 0));
  assert.match(copied, /^1\. Panel upgrade \(September\)$/m);
  assert.doesNotMatch(copied, /\$/, 'no cost anywhere once costs are hidden');
  h.click('#vendor-back'); openPage(h, 'idle');
  h.click('#vendor-copy');
  await new Promise(r => setTimeout(r, 0));
  assert.equal(copied, 'Hi, I have no open jobs for you right now.\n');
});

test('projects are cards tinted by their first vendor: the same vendor, the same tint, on Plan and its page; no vendor stays untinted', () => {
  const h = boot({ seed: { [KEY]: PAGE_DOC() } });
  const tint = el => [...el.classList].find(c => /^t\d$/.test(c)) || '';
  const cards = [...h.w.document.querySelectorAll('#plan .list.cards [data-project]')];
  assert.ok(cards.length >= 3, 'Plan shows its projects as cards');
  const byId = id => h.$(`#plan [data-project="${id}"]`);
  assert.ok(tint(byId('a')), 'a vendor gives a tint');
  assert.equal(tint(byId('a')), tint(byId('b')), 'same vendor, same tint');
  assert.equal(tint(byId('x')), '', 'no vendor, no tint');
  h.click('#tab-vendors'); openPage(h, 'ace');
  const page = [...h.w.document.querySelectorAll('#vendor-page .list.cards .item')];
  assert.ok(page.length && page.every(el => tint(el) === tint(byId('a'))), 'the vendor page wears the same tint');
});

test('a page whose vendor is deleted falls back to the Vendors list', () => {
  const h = boot({ seed: { [KEY]: PAGE_DOC() } });
  h.click('#tab-vendors'); openPage(h, 'idle');
  assert.equal(h.w.askDeleteVendor('idle'), true);
  assert.equal(h.$('#view-vendor').hidden, true);
  assert.equal(h.$('#view-vendors').hidden, false);
});
