/* inventory-finder.js */
/* Requires @supabase/supabase-js v2 loaded before this script */

const SUPABASE_URL = 'https://iynuqsbgnshlromwkzfl.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5bnVxc2JnbnNobHJvbXdremZsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1MDQ5NzcsImV4cCI6MjA5MTA4MDk3N30.SGvfrCXQbgbZk_ptt97R3sYGetFdB6KfRmJvoF1LpGI';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const SITE_SYSTEM_MAP = {
  'HMC-MAIN':  'HMC-PYXIS',
  'UWMC-MAIN': 'UWMC-PYXIS',
  'NWH-MAIN':  'NWH-PYXIS',
};
const SITE_LABELS = {
  'HMC-MAIN':  'Harborview (HMC-MAIN)',
  'UWMC-MAIN': 'Montlake (UWMC-MAIN)',
  'NWH-MAIN':  'Northwest (NWH-MAIN)',
};

let currentSite      = null;
let searchTimeout    = null;
let selectedGateOption = null;

/* ─────────────────────────────────────────────
   DEBUG
───────────────────────────────────────────── */
const debugLines = [];

function debugLog(label, msg) {
  const ts = new Date().toISOString().slice(11, 23);
  debugLines.unshift(`[${ts}] ${label}: ${String(msg).slice(0, 400)}`);
  if (debugLines.length > 80) debugLines.pop();
  const panel = document.getElementById('debug-panel');
  if (panel) panel.textContent = debugLines.join('\n');
}

function toggleDebug() {
  const wrap = document.getElementById('debug-wrap');
  if (wrap) wrap.style.display = wrap.style.display === 'none' ? 'block' : 'none';
}

/* ─────────────────────────────────────────────
   GATE
───────────────────────────────────────────── */
function selectSite(el) {
  document.querySelectorAll('.gate-option').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
  selectedGateOption = el;
  document.getElementById('gate-btn').disabled = false;
}

function confirmSite() {
  if (!selectedGateOption) return;
  applySite(selectedGateOption.dataset.site);
  document.getElementById('gate-overlay').style.display = 'none';
}

function applySite(site) {
  currentSite = site;
  sessionStorage.setItem('inv_site', site);
  document.getElementById('site-badge').style.display = 'inline-flex';
  document.getElementById('site-badge-text').textContent = SITE_LABELS[site];
  document.getElementById('header-site').value = site;
  const q = document.getElementById('search-input').value.trim();
  if (q.length >= 2) performSearch(q);
}

function changeSiteFromHeader(site) {
  if (!site) return;
  currentSite = site;
  sessionStorage.setItem('inv_site', site);
  document.getElementById('site-badge').style.display = 'inline-flex';
  document.getElementById('site-badge-text').textContent = SITE_LABELS[site];
  document.getElementById('gate-overlay').style.display = 'none';
  const q = document.getElementById('search-input').value.trim();
  if (q.length >= 2) performSearch(q);
}

window.addEventListener('DOMContentLoaded', () => {
  const saved = sessionStorage.getItem('inv_site');
  if (saved && SITE_SYSTEM_MAP[saved]) {
    const opt = document.querySelector(`.gate-option[data-site="${saved}"]`);
    if (opt) selectSite(opt);
  }
});

/* ─────────────────────────────────────────────
   SEARCH INPUT
───────────────────────────────────────────── */
function onSearchInput(val) {
  document.getElementById('search-clear').classList.toggle('visible', val.length > 0);
  clearTimeout(searchTimeout);
  if (val.trim().length < 2) { showIdle(); return; }
  searchTimeout = setTimeout(() => performSearch(val.trim()), 200);
}

function clearSearch() {
  const inp = document.getElementById('search-input');
  inp.value = '';
  document.getElementById('search-clear').classList.remove('visible');
  showIdle();
  inp.focus();
}

function showIdle() {
  document.getElementById('results-area').innerHTML = `
    <div class="idle-state">
      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--uw-purple)"
           stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
      <p>Enter a drug name, item number, or Pyxis ID to find its location</p>
    </div>`;
}

/* ─────────────────────────────────────────────
   SUPABASE QUERIES
───────────────────────────────────────────── */
async function queryInventory(query, site) {
  debugLog('iv-query', `${site} / "${query}"`);
  const { data, error } = await sb
    .from('wms_iv_f')
    .select('item,item_description,package_code,actual_location,type_description')
    .eq('pharmacy', site)
    .or(`item_description.ilike.%${query}%,item.ilike.%${query}%`)
    .limit(50);
  if (error) throw new Error(`wms_iv_f: ${error.message}`);
  debugLog('iv-rows', data.length);
  return data;
}

async function queryLocation(query, site) {
  debugLog('lc-query', `${site} / "${query}"`);
  const { data, error } = await sb
    .from('wms_lc_f')
    .select('location,forward_pick_item,type_description')
    .eq('pharmacy', site)
    .ilike('forward_pick_item', `%${query}%`)
    .limit(50);
  if (error) throw new Error(`wms_lc_f: ${error.message}`);
  debugLog('lc-rows', data.length);
  return data;
}

async function queryPyxisByExternalItem(query, system) {
  debugLog('ext-query', `${system} / "${query}"`);
  const { data, error } = await sb
    .from('dms_extsys_item_valid')
    .select('item,item_description,external_item')
    .ilike('external_item', `%${query}%`)
    .eq('external_system_name', system)
    .eq('active', 1)
    .limit(20);
  if (error) throw new Error(`dms_extsys_item_valid: ${error.message}`);
  debugLog('ext-rows', data.length);
  return data;
}

async function batchGetPyxisIds(items, system) {
  if (!items.length) return {};
  const { data, error } = await sb
    .from('dms_extsys_item_valid')
    .select('item,external_item')
    .in('item', items)
    .eq('external_system_name', system)
    .eq('active', 1)
    .limit(500);
  if (error) { debugLog('pyxis-batch-err', error.message); return {}; }
  const map = {};
  for (const r of (data || [])) if (!map[r.item]) map[r.item] = r.external_item;
  return map;
}

async function batchGetExtDetails(items, system) {
  if (!items.length) return {};
  const { data, error } = await sb
    .from('dms_extsys_item_valid')
    .select('item,item_description,external_item_uom')
    .in('item', items)
    .eq('external_system_name', system)
    .eq('active', 1)
    .limit(500);
  if (error) { debugLog('ext-detail-err', error.message); return {}; }
  const map = {};
  for (const r of (data || [])) if (!map[r.item]) map[r.item] = r;
  return map;
}

async function batchGetInventoryByItems(items, site) {
  if (!items.length) return {};
  const { data, error } = await sb
    .from('wms_iv_f')
    .select('item,item_description,package_code,actual_location,type_description')
    .eq('pharmacy', site)
    .in('item', items)
    .limit(50);
  if (error) { debugLog('iv-batch-err', error.message); return {}; }
  const map = {};
  for (const r of (data || [])) map[r.item] = r;
  return map;
}

/* ─────────────────────────────────────────────
   WATERFALL SEARCH
───────────────────────────────────────────── */
async function performSearch(query) {
  if (!currentSite) return;
  const area = document.getElementById('results-area');
  area.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Searching inventory…</p></div>';
  debugLog('SEARCH', `"${query}" @ ${currentSite}`);

  try {
    const system  = SITE_SYSTEM_MAP[currentSite];
    let   results = [];

    // ── Step 1: primary inventory table ──
    const ivRows = await queryInventory(query, currentSite);

    if (ivRows.length > 0) {
      const pyxisMap = await batchGetPyxisIds(ivRows.map(r => r.item), system);
      for (const row of ivRows) {
        results.push({
          source:           'inventory',
          item:             row.item,
          item_description: row.item_description,
          package_code:     row.package_code,
          location:         row.actual_location,
          type_description: row.type_description,
          pyxis_id:         pyxisMap[row.item] || null,
        });
      }

    } else {
      // ── Step 2: location table fallback ──
      debugLog('fallback', 'trying wms_lc_f');
      const lcRows = await queryLocation(query, currentSite);

      if (lcRows.length > 0) {
        const items = [...new Set(lcRows.map(r => r.forward_pick_item).filter(Boolean))];
        const [pyxisMap, extMap] = await Promise.all([
          batchGetPyxisIds(items, system),
          batchGetExtDetails(items, system),
        ]);
        for (const row of lcRows) {
          const det = extMap[row.forward_pick_item] || {};
          results.push({
            source:           'location',
            item:             row.forward_pick_item,
            item_description: det.item_description     || '',
            package_code:     det.external_item_uom    || '',
            location:         row.location,
            type_description: 'Home / Forward Pick',
            pyxis_id:         pyxisMap[row.forward_pick_item] || null,
          });
        }
      }
    }

    // ── Step 3: Pyxis ID search ──
    if (results.length === 0) {
      debugLog('fallback', 'trying Pyxis ID search');
      const extRows = await queryPyxisByExternalItem(query, system);

      if (extRows.length > 0) {
        const items = [...new Set(extRows.map(r => r.item).filter(Boolean))];
        const ivMap = await batchGetInventoryByItems(items, currentSite);
        for (const row of extRows) {
          const inv = ivMap[row.item];
          results.push({
            source:           inv ? 'inventory' : 'pyxis_lookup',
            item:             row.item,
            item_description: row.item_description          || (inv && inv.item_description) || '',
            package_code:     (inv && inv.package_code)     || '',
            location:         (inv && inv.actual_location)  || '—',
            type_description: (inv && inv.type_description) || 'Pyxis Match',
            pyxis_id:         row.external_item,
          });
        }
      }
    }

    debugLog('results', results.length);
    renderResults(results, query);

  } catch (err) {
    debugLog('ERROR', err.message);
    area.innerHTML = `
      <div class="error-banner">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="2" stroke-linecap="round">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8"  x2="12"    y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <div>
          <strong>Query failed.</strong> ${escHtml(err.message)}
          <br>
          <button class="debug-toggle-btn" onclick="toggleDebug()" style="margin-top:6px;">
            Show debug log
          </button>
        </div>
      </div>
      <div id="debug-wrap" class="debug-wrap">
        <pre id="debug-panel" class="debug-panel"></pre>
      </div>`;
    setTimeout(() => {
      const p = document.getElementById('debug-panel');
      if (p) p.textContent = debugLines.join('\n');
    }, 0);
  }
}

/* ─────────────────────────────────────────────
   RENDER
───────────────────────────────────────────── */
function badgeFor(r) {
  const t = (r.type_description || '').toLowerCase();
  if (t.includes('forward pick') && r.source === 'inventory') return ['Forward Pick',   'badge-fp'];
  if (t.includes('first in') || t.includes('fifo'))           return ['FIFO',           'badge-fifo'];
  if (t.includes('home') || r.source === 'location')          return ['Home Location',  'badge-home'];
  if (r.source === 'pyxis_lookup')                            return ['Pyxis Match',    'badge-fp'];
  return [r.type_description || 'Inventory', 'badge-fifo'];
}

function renderResults(results, query) {
  const area = document.getElementById('results-area');

  if (results.length === 0) {
    area.innerHTML = `
      <div class="empty-state">
        <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="var(--uw-purple)"
             stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"/>
          <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          <line x1="8"  y1="11" x2="14"    y2="11"/>
        </svg>
        <h3>No results found for "${escHtml(query)}"</h3>
        <p>No inventory records match this search at ${SITE_LABELS[currentSite]}.</p>
      </div>`;
    return;
  }

  const cards = results.map(r => {
    const [badgeLabel, badgeClass] = badgeFor(r);
    const loc   = r.location         || '—';
    const pyxis = r.pyxis_id         || '';
    const pkg   = r.package_code     || '';
    const desc  = r.item_description || '';
    return `
      <div class="result-card">
        <div class="result-card-header">
          <span class="result-type-badge ${badgeClass}">${escHtml(badgeLabel)}</span>
          <div class="result-title">
            <div class="result-item-desc">${escHtml(desc || r.item)}</div>
            <div class="result-item-num">Item #: ${escHtml(r.item)}</div>
          </div>
        </div>
        <div class="result-card-body">
          <div class="result-field">
            <label>Location</label>
            <span class="location-value">${escHtml(loc)}</span>
          </div>
          <div class="result-field">
            <label>Pyxis ID</label>
            <span class="${pyxis ? 'pyxis-value' : 'empty'}">
              ${pyxis ? escHtml(pyxis) : 'Not mapped'}
            </span>
          </div>
          ${pkg ? `
          <div class="result-field">
            <label>NDC / Package Code</label>
            <span>${escHtml(pkg)}</span>
          </div>` : ''}
          <div class="result-field">
            <label>Location Type</label>
            <span>${escHtml(r.type_description || '—')}</span>
          </div>
        </div>
      </div>`;
  }).join('');

  area.innerHTML = `
    <div class="results-header">
      <span class="results-count">
        <strong>${results.length}</strong> result${results.length !== 1 ? 's' : ''} for "${escHtml(query)}"
      </span>
      <button class="debug-toggle-btn" onclick="toggleDebug()">Debug log</button>
    </div>
    <div id="debug-wrap" class="debug-wrap">
      <pre id="debug-panel" class="debug-panel">${debugLines.join('\n')}</pre>
    </div>
    ${cards}`;
}

function escHtml(s) {
  return String(s || '')
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;');
}
