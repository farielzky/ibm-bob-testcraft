/**
 * QA TestCraft — script.js
 * ─────────────────────────────────────────────────────────────
 * Architecture:
 *   - State: single `state` object (testCases[], filters, editingId)
 *   - Persistence: localStorage via loadState() / saveState()
 *   - Render: renderList() reads state and rebuilds the DOM
 *   - Events: all wired in initEventListeners()
 * ─────────────────────────────────────────────────────────────
 */

'use strict';

/* ─────────────────────────────────────────────
   1. STATE & PERSISTENCE
   ───────────────────────────────────────────── */

/** Application state — single source of truth */
const state = {
  testCases: [],    // Array<TestCase>
  editingId: null,  // ID of the test case currently being edited (null = create mode)
  exportTarget: null, // TestCase currently loaded in the export modal
  filters: {
    search:   '',
    priority: '',
    type:     '',
    status:   '',
  },
};

const STORAGE_KEY = 'qa_testcraft_v1';

/** Persist the testCases array to localStorage */
function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.testCases));
}

/** Restore testCases from localStorage on page load */
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) state.testCases = JSON.parse(raw);
  } catch (_) {
    state.testCases = [];
  }
}

/* ─────────────────────────────────────────────
   2. ID GENERATION
   ───────────────────────────────────────────── */

/**
 * Generate the next sequential test case ID.
 * Scans existing IDs (format "TC-NNN") and increments the max.
 * @returns {string} e.g. "TC-001"
 */
function generateId() {
  const nums = state.testCases
    .map(tc => {
      const m = tc.id.match(/^TC-(\d+)$/);
      return m ? parseInt(m[1], 10) : 0;
    });
  const next = nums.length ? Math.max(...nums) + 1 : 1;
  return `TC-${String(next).padStart(3, '0')}`;
}

/* ─────────────────────────────────────────────
   3. CRUD OPERATIONS
   ───────────────────────────────────────────── */

/**
 * Create a new test case and save.
 * @param {object} data - Form data object
 */
function createTestCase(data) {
  const tc = {
    id:            generateId(),
    module:        data.module,
    title:         data.title,
    preconditions: data.preconditions,
    steps:         data.steps,        // string[]
    testData:      data.testData,
    expected:      data.expected,
    severity:      data.severity,
    priority:      data.priority,
    type:          data.type,
    status:        data.status,
    createdAt:     new Date().toISOString(),
    updatedAt:     new Date().toISOString(),
  };
  state.testCases.unshift(tc); // newest first
  saveState();
  return tc;
}

/**
 * Update an existing test case by ID.
 * @param {string} id
 * @param {object} data - Updated form data
 */
function updateTestCase(id, data) {
  const idx = state.testCases.findIndex(tc => tc.id === id);
  if (idx === -1) return;
  state.testCases[idx] = {
    ...state.testCases[idx],
    module:        data.module,
    title:         data.title,
    preconditions: data.preconditions,
    steps:         data.steps,
    testData:      data.testData,
    expected:      data.expected,
    severity:      data.severity,
    priority:      data.priority,
    type:          data.type,
    status:        data.status,
    updatedAt:     new Date().toISOString(),
  };
  saveState();
}

/**
 * Delete a test case by ID with a brief card fade-out.
 * @param {string} id
 */
function deleteTestCase(id) {
  const card = document.querySelector(`[data-tc-id="${id}"]`);
  if (card) {
    card.style.transition = 'opacity 0.2s, transform 0.2s';
    card.style.opacity = '0';
    card.style.transform = 'scale(0.96)';
    setTimeout(() => {
      state.testCases = state.testCases.filter(tc => tc.id !== id);
      saveState();
      renderList();
      updateStats();
    }, 200);
  } else {
    state.testCases = state.testCases.filter(tc => tc.id !== id);
    saveState();
    renderList();
    updateStats();
  }
}

/* ─────────────────────────────────────────────
   4. FILTERING & SEARCH
   ───────────────────────────────────────────── */

/**
 * Return a filtered subset of testCases based on current state.filters.
 * @returns {TestCase[]}
 */
function getFilteredTestCases() {
  const { search, priority, type, status } = state.filters;
  const q = search.toLowerCase().trim();

  return state.testCases.filter(tc => {
    const matchSearch = !q ||
      tc.id.toLowerCase().includes(q) ||
      tc.title.toLowerCase().includes(q) ||
      tc.module.toLowerCase().includes(q);

    const matchPriority = !priority || tc.priority === priority;
    const matchType     = !type     || tc.type     === type;
    const matchStatus   = !status   || tc.status   === status;

    return matchSearch && matchPriority && matchType && matchStatus;
  });
}

/* ─────────────────────────────────────────────
   5. RENDER
   ───────────────────────────────────────────── */

/** Rebuild the test case card grid */
function renderList() {
  const list      = document.getElementById('tc-list');
  const emptyEl   = document.getElementById('empty-state');
  const countEl   = document.getElementById('list-count');
  const filtered  = getFilteredTestCases();

  list.innerHTML = '';

  if (filtered.length === 0) {
    emptyEl.style.display = 'flex';
    countEl.textContent = '(0)';
    return;
  }

  emptyEl.style.display = 'none';
  countEl.textContent = `(${filtered.length})`;

  filtered.forEach(tc => {
    const card = buildCard(tc);
    list.appendChild(card);
  });
}

/**
 * Build a single test case card DOM element.
 * @param {object} tc - TestCase object
 * @returns {HTMLElement}
 */
function buildCard(tc) {
  const card = document.createElement('article');
  card.className = 'tc-card';
  card.setAttribute('data-tc-id', tc.id);
  card.setAttribute('data-priority', tc.priority);

  const stepsPreview = tc.steps.slice(0, 2).map((s, i) => `${i + 1}. ${escHtml(s)}`).join('<br>');
  const moreSteps = tc.steps.length > 2 ? `<span class="text-slate-400">+${tc.steps.length - 2} more…</span>` : '';

  card.innerHTML = `
    <!-- Card header -->
    <div class="pl-5 pr-4 pt-4 pb-3 border-b border-slate-100">
      <div class="flex items-start justify-between gap-2">
        <div class="min-w-0">
          <span class="text-xs font-mono text-brand-500 font-semibold">${escHtml(tc.id)}</span>
          <h3 class="text-sm font-bold text-slate-800 leading-tight mt-0.5 truncate" title="${escHtml(tc.title)}">${escHtml(tc.title)}</h3>
          <p class="text-xs text-slate-500 mt-0.5 truncate">${escHtml(tc.module)}</p>
        </div>
        <!-- Status badge -->
        <span class="badge badge-status-${tc.status} flex-shrink-0 mt-0.5">${tc.status}</span>
      </div>

      <!-- Badges row -->
      <div class="flex flex-wrap gap-1.5 mt-2">
        <span class="badge badge-priority-${tc.priority}">${tc.priority}</span>
        <span class="badge badge-type">${escHtml(tc.type)}</span>
        ${tc.severity !== tc.priority ? `<span class="badge" style="background:#f1f5f9;color:#475569">Sev: ${tc.severity}</span>` : ''}
      </div>
    </div>

    <!-- Card body -->
    <div class="pl-5 pr-4 py-3 flex-1 space-y-2 text-xs text-slate-600">
      ${tc.preconditions ? `
      <div>
        <span class="font-semibold text-slate-500 uppercase tracking-wide text-[10px]">Pre-conditions</span>
        <p class="mt-0.5 line-clamp-2">${escHtml(tc.preconditions)}</p>
      </div>` : ''}

      ${tc.steps.length ? `
      <div>
        <span class="font-semibold text-slate-500 uppercase tracking-wide text-[10px]">Steps (${tc.steps.length})</span>
        <p class="mt-0.5 leading-relaxed">${stepsPreview}${moreSteps ? '<br>' + moreSteps : ''}</p>
      </div>` : ''}

      ${tc.expected ? `
      <div>
        <span class="font-semibold text-slate-500 uppercase tracking-wide text-[10px]">Expected</span>
        <p class="mt-0.5 line-clamp-2">${escHtml(tc.expected)}</p>
      </div>` : ''}
    </div>

    <!-- Card footer actions -->
    <div class="pl-5 pr-4 py-2.5 border-t border-slate-100 flex items-center justify-between">
      <span class="text-[10px] text-slate-400">${formatDate(tc.updatedAt)}</span>
      <div class="flex items-center gap-1">
        <!-- Quick status cycle -->
        <button class="btn-status-cycle px-2 py-1 rounded-md text-[10px] font-semibold bg-slate-50 hover:bg-brand-50 text-slate-500 hover:text-brand-600 border border-slate-200 hover:border-brand-200 transition"
          data-id="${tc.id}" title="Cycle status">⟳ Status</button>
        <!-- Export/Copy -->
        <button class="btn-export-tc w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:bg-blue-50 hover:text-brand-600 transition" data-id="${tc.id}" title="Copy / Export">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path stroke-linecap="round" stroke-linejoin="round" d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
        </button>
        <!-- Edit -->
        <button class="btn-edit-tc w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:bg-yellow-50 hover:text-yellow-600 transition" data-id="${tc.id}" title="Edit">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
        </button>
        <!-- Delete -->
        <button class="btn-delete-tc w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 transition" data-id="${tc.id}" title="Delete">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path stroke-linecap="round" stroke-linejoin="round" d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6m5 0V4a1 1 0 011-1h2a1 1 0 011 1v2"/></svg>
        </button>
      </div>
    </div>
  `;

  return card;
}

/** Update header stat counters */
function updateStats() {
  const tcs = state.testCases;
  document.getElementById('stat-total').textContent  = tcs.length;
  document.getElementById('stat-passed').textContent = tcs.filter(t => t.status === 'Passed').length;
  document.getElementById('stat-failed').textContent = tcs.filter(t => t.status === 'Failed').length;
  document.getElementById('stat-draft').textContent  = tcs.filter(t => t.status === 'Draft').length;
}

/* ─────────────────────────────────────────────
   6. MODAL: CREATE / EDIT
   ───────────────────────────────────────────── */

/** Open the create/edit modal */
function openModal(tc = null) {
  state.editingId = tc ? tc.id : null;

  // Update modal header
  document.getElementById('modal-title').textContent = tc ? 'Edit Test Case' : 'New Test Case';
  const idPreview = document.getElementById('modal-id-preview');
  idPreview.textContent = tc ? tc.id : `Will be assigned: ${generateId()}`;

  // Populate or reset form
  document.getElementById('form-id').value           = tc ? tc.id : '';
  document.getElementById('form-module').value       = tc ? tc.module       : '';
  document.getElementById('form-title').value        = tc ? tc.title        : '';
  document.getElementById('form-preconditions').value = tc ? tc.preconditions : '';
  document.getElementById('form-testdata').value     = tc ? tc.testData     : '';
  document.getElementById('form-expected').value     = tc ? tc.expected     : '';
  setSelectValue('form-severity', tc ? tc.severity : 'Medium');
  setSelectValue('form-priority', tc ? tc.priority : 'Medium');
  setSelectValue('form-type',     tc ? tc.type     : 'Functional');
  setSelectValue('form-status',   tc ? tc.status   : 'Draft');

  // Rebuild steps
  const steps = tc ? tc.steps : [''];
  rebuildSteps(steps);

  // Remove any previous error states
  document.querySelectorAll('.form-input.error').forEach(el => el.classList.remove('error'));

  // Show modal
  const overlay = document.getElementById('modal-overlay');
  overlay.classList.remove('hidden');
  overlay.style.display = 'flex';

  // Focus first input
  setTimeout(() => document.getElementById('form-module').focus(), 80);
}

/** Close the create/edit modal */
function closeModal() {
  const overlay = document.getElementById('modal-overlay');
  overlay.classList.add('hidden');
  state.editingId = null;
}

/* ─────────────────────────────────────────────
   7. DYNAMIC STEPS
   ───────────────────────────────────────────── */

/**
 * Rebuild the steps container from an array of step strings.
 * @param {string[]} steps
 */
function rebuildSteps(steps) {
  const container = document.getElementById('steps-container');
  container.innerHTML = '';
  (steps.length ? steps : ['']).forEach(s => addStepRow(s));
}

/**
 * Append one step row to the steps container.
 * @param {string} value - Pre-fill value
 */
function addStepRow(value = '') {
  const container = document.getElementById('steps-container');
  const idx = container.children.length + 1;

  const row = document.createElement('div');
  row.className = 'step-row';
  row.innerHTML = `
    <span class="step-number">${idx}</span>
    <input type="text" class="step-input" placeholder="Describe step ${idx}…" value="${escAttr(value)}" />
    <button type="button" class="btn-remove-step" title="Remove step">
      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
      </svg>
    </button>
  `;

  // Remove step handler
  row.querySelector('.btn-remove-step').addEventListener('click', () => {
    row.remove();
    renumberSteps();
  });

  container.appendChild(row);
}

/** Re-number step indicators after removal */
function renumberSteps() {
  document.querySelectorAll('#steps-container .step-row').forEach((row, i) => {
    row.querySelector('.step-number').textContent = i + 1;
    row.querySelector('.step-input').placeholder = `Describe step ${i + 1}…`;
  });
}

/** Collect step values from the DOM */
function getStepsFromDOM() {
  return Array.from(document.querySelectorAll('#steps-container .step-input'))
    .map(el => el.value.trim())
    .filter(Boolean);
}

/* ─────────────────────────────────────────────
   8. FORM VALIDATION & SUBMIT
   ───────────────────────────────────────────── */

/**
 * Validate required fields. Highlights errors and returns bool.
 * @returns {boolean}
 */
function validateForm() {
  let valid = true;
  const required = ['form-module', 'form-title', 'form-expected'];

  required.forEach(id => {
    const el = document.getElementById(id);
    if (!el.value.trim()) {
      el.classList.add('error');
      el.addEventListener('input', () => el.classList.remove('error'), { once: true });
      valid = false;
    }
  });

  const steps = getStepsFromDOM();
  if (steps.length === 0) {
    // Highlight the add step button area
    const container = document.getElementById('steps-container');
    container.style.outline = '2px solid #f87171';
    container.style.borderRadius = '0.5rem';
    setTimeout(() => { container.style.outline = ''; }, 1500);
    valid = false;
  }

  if (!valid) {
    showToast('Please fill in all required fields.', 'error');
  }

  return valid;
}

/** Handle form submission (create or update) */
function handleFormSubmit(e) {
  e.preventDefault();
  if (!validateForm()) return;

  const data = {
    module:        document.getElementById('form-module').value.trim(),
    title:         document.getElementById('form-title').value.trim(),
    preconditions: document.getElementById('form-preconditions').value.trim(),
    steps:         getStepsFromDOM(),
    testData:      document.getElementById('form-testdata').value.trim(),
    expected:      document.getElementById('form-expected').value.trim(),
    severity:      document.getElementById('form-severity').value,
    priority:      document.getElementById('form-priority').value,
    type:          document.getElementById('form-type').value,
    status:        document.getElementById('form-status').value,
  };

  if (state.editingId) {
    updateTestCase(state.editingId, data);
    showToast(`Test case ${state.editingId} updated.`, 'success');
  } else {
    const tc = createTestCase(data);
    showToast(`Test case ${tc.id} created.`, 'success');
  }

  closeModal();
  renderList();
  updateStats();
}

/* ─────────────────────────────────────────────
   9. STATUS CYCLE
   ───────────────────────────────────────────── */

const STATUS_CYCLE = ['Draft', 'Ready', 'Passed', 'Failed'];

/**
 * Cycle a test case's status to the next in the sequence.
 * @param {string} id
 */
function cycleStatus(id) {
  const tc = state.testCases.find(t => t.id === id);
  if (!tc) return;
  const nextIdx = (STATUS_CYCLE.indexOf(tc.status) + 1) % STATUS_CYCLE.length;
  tc.status = STATUS_CYCLE[nextIdx];
  tc.updatedAt = new Date().toISOString();
  saveState();
  renderList();
  updateStats();
  showToast(`${id} → ${tc.status}`, 'info');
}

/* ─────────────────────────────────────────────
   10. EXPORT MODAL (Markdown / Gherkin)
   ───────────────────────────────────────────── */

let currentExportFormat = 'markdown'; // 'markdown' | 'gherkin'

/**
 * Open the copy/export modal for a single test case.
 * @param {string} id
 */
function openExportModal(id) {
  const tc = state.testCases.find(t => t.id === id);
  if (!tc) return;
  state.exportTarget = tc;
  currentExportFormat = 'markdown';

  // Sync button states
  document.getElementById('fmt-markdown').classList.add('active-fmt');
  document.getElementById('fmt-gherkin').classList.remove('active-fmt');

  updateExportPreview(tc, 'markdown');

  const overlay = document.getElementById('export-modal-overlay');
  overlay.classList.remove('hidden');
  overlay.style.display = 'flex';
}

/** Close the export modal */
function closeExportModal() {
  document.getElementById('export-modal-overlay').classList.add('hidden');
  state.exportTarget = null;
}

/**
 * Render the formatted preview in the export modal.
 * @param {object} tc
 * @param {'markdown'|'gherkin'} format
 */
function updateExportPreview(tc, format) {
  const preview = document.getElementById('export-preview');
  preview.textContent = format === 'markdown'
    ? formatAsMarkdown(tc)
    : formatAsGherkin(tc);
}

/**
 * Format a test case as a Markdown table.
 * @param {object} tc
 * @returns {string}
 */
function formatAsMarkdown(tc) {
  const steps = tc.steps.map((s, i) => `${i + 1}. ${s}`).join('\n');
  return [
    `## ${tc.id}: ${tc.title}`,
    '',
    `| Field           | Value                          |`,
    `|-----------------|--------------------------------|`,
    `| **Module**      | ${tc.module}                   |`,
    `| **Type**        | ${tc.type}                     |`,
    `| **Priority**    | ${tc.priority}                 |`,
    `| **Severity**    | ${tc.severity}                 |`,
    `| **Status**      | ${tc.status}                   |`,
    `| **Pre-cond.**   | ${tc.preconditions || '—'}     |`,
    `| **Test Data**   | ${tc.testData || '—'}          |`,
    `| **Expected**    | ${tc.expected}                 |`,
    '',
    `### Steps`,
    steps,
  ].join('\n');
}

/**
 * Format a test case as Gherkin (Given-When-Then).
 * @param {object} tc
 * @returns {string}
 */
function formatAsGherkin(tc) {
  const stepsGherkin = tc.steps.map((s, i) => {
    const keyword = i === 0 ? 'Given' : i === 1 ? 'When' : 'And';
    return `  ${keyword} ${s}`;
  }).join('\n');

  const dataLines = tc.testData
    ? tc.testData.split('\n').map(l => `      | ${l.trim()} |`).join('\n')
    : '';

  return [
    `Feature: ${tc.module}`,
    '',
    `  Scenario: ${tc.title}`,
    `    # ID: ${tc.id} | Priority: ${tc.priority} | Type: ${tc.type}`,
    tc.preconditions ? `    # Pre-condition: ${tc.preconditions}` : '',
    '',
    stepsGherkin,
    dataLines ? `    And the test data is:\n      | Field     | Value |\n${dataLines}` : '',
    `  Then ${tc.expected}`,
  ].filter(l => l !== null).join('\n');
}

/* ─────────────────────────────────────────────
   11. BULK EXPORT: JSON & CSV
   ───────────────────────────────────────────── */

/** Export all test cases as a JSON file download */
function exportJSON() {
  if (!state.testCases.length) {
    showToast('No test cases to export.', 'error');
    return;
  }
  const blob = new Blob(
    [JSON.stringify(state.testCases, null, 2)],
    { type: 'application/json' }
  );
  triggerDownload(blob, `qa_testcraft_${datestamp()}.json`);
  showToast('Exported as JSON.', 'success');
}

/** Export all test cases as a CSV file download */
function exportCSV() {
  if (!state.testCases.length) {
    showToast('No test cases to export.', 'error');
    return;
  }

  const headers = ['ID','Module','Title','Type','Priority','Severity','Status','Pre-conditions','Steps','Test Data','Expected Result','Created','Updated'];

  const rows = state.testCases.map(tc => [
    tc.id,
    tc.module,
    tc.title,
    tc.type,
    tc.priority,
    tc.severity,
    tc.status,
    tc.preconditions,
    tc.steps.join(' | '),
    tc.testData,
    tc.expected,
    tc.createdAt,
    tc.updatedAt,
  ].map(csvCell));

  const csv = [headers.map(csvCell), ...rows].map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  triggerDownload(blob, `qa_testcraft_${datestamp()}.csv`);
  showToast('Exported as CSV.', 'success');
}

/**
 * Trigger a file download from a Blob.
 * @param {Blob} blob
 * @param {string} filename
 */
function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* ─────────────────────────────────────────────
   12. CLIPBOARD
   ───────────────────────────────────────────── */

/**
 * Copy text to clipboard, with toast feedback.
 * @param {string} text
 */
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast('Copied to clipboard!', 'success');
  } catch (_) {
    // Fallback for older browsers
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showToast('Copied to clipboard!', 'success');
  }
}

/* ─────────────────────────────────────────────
   13. TOAST NOTIFICATIONS
   ───────────────────────────────────────────── */

let toastTimer = null;

/**
 * Show a temporary toast notification.
 * @param {string} msg
 * @param {'success'|'error'|'info'} type
 */
function showToast(msg, type = 'success') {
  const toast   = document.getElementById('toast');
  const msgEl   = document.getElementById('toast-msg');
  const iconEl  = document.getElementById('toast-icon');

  msgEl.textContent = msg;

  // Icon & color per type
  const icons = {
    success: '<path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>',
    error:   '<path stroke-linecap="round" stroke-linejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"/>',
    info:    '<path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>',
  };
  iconEl.innerHTML = icons[type] || icons.info;

  const colors = { success: '#22c55e', error: '#ef4444', info: '#60a5fa' };
  iconEl.style.color = colors[type] || colors.info;

  toast.classList.add('show');

  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
}

/* ─────────────────────────────────────────────
   14. EVENT LISTENERS
   ───────────────────────────────────────────── */

function initEventListeners() {

  /* ── New test case button ── */
  document.getElementById('btn-new-tc').addEventListener('click', () => openModal());

  /* ── Modal close buttons ── */
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('btn-cancel-modal').addEventListener('click', closeModal);

  /* ── Close modal on overlay backdrop click ── */
  document.getElementById('modal-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal();
  });

  /* ── Form submit ── */
  document.getElementById('tc-form').addEventListener('submit', handleFormSubmit);

  /* ── Add step button ── */
  document.getElementById('btn-add-step').addEventListener('click', () => {
    addStepRow();
    // Focus the new step input
    const rows = document.querySelectorAll('#steps-container .step-input');
    rows[rows.length - 1]?.focus();
  });

  /* ── Real-time search ── */
  document.getElementById('search-input').addEventListener('input', e => {
    state.filters.search = e.target.value;
    renderList();
  });

  /* ── Filter dropdowns ── */
  document.getElementById('filter-priority').addEventListener('change', e => {
    state.filters.priority = e.target.value;
    renderList();
  });
  document.getElementById('filter-type').addEventListener('change', e => {
    state.filters.type = e.target.value;
    renderList();
  });
  document.getElementById('filter-status').addEventListener('change', e => {
    state.filters.status = e.target.value;
    renderList();
  });

  /* ── Clear filters ── */
  document.getElementById('btn-clear-filters').addEventListener('click', () => {
    state.filters = { search: '', priority: '', type: '', status: '' };
    document.getElementById('search-input').value = '';
    document.getElementById('filter-priority').value = '';
    document.getElementById('filter-type').value = '';
    document.getElementById('filter-status').value = '';
    renderList();
  });

  /* ── Export JSON / CSV ── */
  document.getElementById('btn-export-json').addEventListener('click', exportJSON);
  document.getElementById('btn-export-csv').addEventListener('click', exportCSV);

  /* ── Card action delegation (edit, delete, export, status cycle) ── */
  document.getElementById('tc-list').addEventListener('click', e => {
    const editBtn   = e.target.closest('.btn-edit-tc');
    const deleteBtn = e.target.closest('.btn-delete-tc');
    const exportBtn = e.target.closest('.btn-export-tc');
    const statusBtn = e.target.closest('.btn-status-cycle');

    if (editBtn) {
      const id = editBtn.dataset.id;
      const tc = state.testCases.find(t => t.id === id);
      if (tc) openModal(tc);
    }

    if (deleteBtn) {
      const id = deleteBtn.dataset.id;
      if (confirm(`Delete ${id}? This cannot be undone.`)) {
        deleteTestCase(id);
        showToast(`${id} deleted.`, 'error');
      }
    }

    if (exportBtn) {
      openExportModal(exportBtn.dataset.id);
    }

    if (statusBtn) {
      cycleStatus(statusBtn.dataset.id);
    }
  });

  /* ── Export modal: format toggle ── */
  document.getElementById('fmt-markdown').addEventListener('click', () => {
    currentExportFormat = 'markdown';
    document.getElementById('fmt-markdown').classList.add('active-fmt');
    document.getElementById('fmt-gherkin').classList.remove('active-fmt');
    if (state.exportTarget) updateExportPreview(state.exportTarget, 'markdown');
  });

  document.getElementById('fmt-gherkin').addEventListener('click', () => {
    currentExportFormat = 'gherkin';
    document.getElementById('fmt-gherkin').classList.add('active-fmt');
    document.getElementById('fmt-markdown').classList.remove('active-fmt');
    if (state.exportTarget) updateExportPreview(state.exportTarget, 'gherkin');
  });

  /* ── Export modal: copy button ── */
  document.getElementById('btn-copy-export').addEventListener('click', () => {
    const text = document.getElementById('export-preview').textContent;
    copyToClipboard(text);
  });

  /* ── Export modal: close ── */
  document.getElementById('export-modal-close').addEventListener('click', closeExportModal);
  document.getElementById('export-modal-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeExportModal();
  });

  /* ── Keyboard: Escape closes any open modal ── */
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeModal();
      closeExportModal();
    }
  });
}

/* ─────────────────────────────────────────────
   15. UTILITY HELPERS
   ───────────────────────────────────────────── */

/**
 * Escape a string for safe HTML insertion.
 * @param {string} str
 * @returns {string}
 */
function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Escape a string for use in an HTML attribute value.
 * @param {string} str
 * @returns {string}
 */
function escAttr(str) {
  return escHtml(str).replace(/\n/g, '&#10;');
}

/**
 * Wrap a CSV cell value in quotes if it contains commas, quotes, or newlines.
 * @param {string} val
 * @returns {string}
 */
function csvCell(val) {
  const s = String(val ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * Set a <select> element's value safely.
 * @param {string} id
 * @param {string} val
 */
function setSelectValue(id, val) {
  const el = document.getElementById(id);
  if (!el) return;
  const opt = Array.from(el.options).find(o => o.value === val);
  if (opt) el.value = val;
}

/**
 * Format an ISO date string to a human-readable short form.
 * @param {string} iso
 * @returns {string}
 */
function formatDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  } catch (_) {
    return iso;
  }
}

/** Return YYYYMMDD-HHMM stamp for file names */
function datestamp() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

/* ─────────────────────────────────────────────
   16. BOOTSTRAP
   ───────────────────────────────────────────── */

/**
 * Application entry point.
 * Runs once the DOM is fully parsed.
 */
function init() {
  loadState();
  initEventListeners();
  renderList();
  updateStats();

  // Ensure empty state is hidden if we have data
  const emptyEl = document.getElementById('empty-state');
  if (state.testCases.length > 0) emptyEl.style.display = 'none';
}

// Wait for DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
