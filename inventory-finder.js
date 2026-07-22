/* inventory-finder.js */
/* Uses the local Supabase-compatible client loaded before this script. */
const SUPABASE_URL = 'https://iynuqsbgnshlromwkzfl.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5bnVxc2JnbnNobHJvbXdremZsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1MDQ5NzcsImV4cCI6MjA5MTA4MDk3N30.SGvfrCXQbgbZk_ptt97R3sYGetFdB6KfRmJvoF1LpGI';
const sb = window.inventorySb || (window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null);

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

const OFFLINE_CACHE_NAME = 'inventory-finder-cache-v3';
const OFFLINE_TABLE_FILES = [
  './test_dms_extsys_item_valid.json',
  './test_wms_iv_f.json',
  './test_wms_lc_f.json',
];

async function loadOfflineJson(url) {
  if (!('caches' in window)) {
    const response = await fetch(url, { cache: 'reload' });
    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
    }
    return response.json();
  }

  const cache = await caches.open(OFFLINE_CACHE_NAME);
  const cachedResponse = await cache.match(url);
  if (cachedResponse && cachedResponse.ok) {
    return cachedResponse.json();
  }

  const response = await fetch(url, { cache: 'reload' });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }

  await cache.put(url, response.clone());
  return response.json();
}

async function warmOfflineCache() {
  if (!('caches' in window)) return;

  try {
    const cache = await caches.open(OFFLINE_CACHE_NAME);
    await Promise.all(OFFLINE_TABLE_FILES.map(async (url) => {
      try {
        const response = await fetch(url, { cache: 'reload' });
        if (response.ok) {
          await cache.put(url, response.clone());
        }
      } catch (err) {
        console.warn(`Offline cache warm failed for ${url}`, err);
      }
    }));
  } catch (err) {
    console.warn('Offline cache warm failed:', err);
  }
}
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

function updateConnectionStatus() {
  console.log('updateConnectionStatus called, online:', navigator.onLine);
  const status = document.getElementById('connection-status');
  console.log('status element:', status);
  if(!status) return;
  if (navigator.onLine) {
        status.className = 'connection-status online';
        status.textContent = 'Online';
    } else {
        status.className = 'connection-status offline';
        status.textContent = 'Offline — Showing Cached Data (Requires precise search terms)';
    }
}
window.addEventListener('online', updateConnectionStatus);
window.addEventListener('offline', updateConnectionStatus);
window.addEventListener('load', warmOfflineCache);
updateConnectionStatus();

/* ─────────────────────────────────────────────
   FUZZY WATERFALL SEARCH
───────────────────────────────────────────── */
async function performSearch(query) {
  if(navigator.onLine){
    if (!currentSite) return;
  if (!sb) {
    debugLog('ERROR', 'Supabase client is not available');
    return;
  }
  const resultsArea = document.getElementById('results-area');
  resultsArea.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Searching inventory…</p></div>';
  
  debugLog('SEARCH-START', `"${query}" @ "${currentSite}" (Length: ${currentSite.length})`);

  try {
    // Fire the specialized PostgreSQL fuzzy routine
    const { data, error } = await sb.rpc('fuzzy_search_inventory', {
      search_text: query,
      site_filter: currentSite
    });

    if (error) throw new Error(`Database Error: ${error.message}`);
    
    debugLog('DB-RESPONSE-ROWS', data ? data.length : 0);
    
    const results = (data || []).map(row => ({
      source: row.location_type ? row.location_type.toLowerCase() : 'inventory',
      item: row.item,
      item_description: row.item_description,
      package_code: row.uom || '',
      location: row.location || row.actual_location,
      type_description: row.location_type || 'Inventory',
      pyxis_id: row.pyxis_id || null
    }));

    renderResults(results, query);

  } catch (err) {
    debugLog('ERROR', err.message);
    resultsArea.innerHTML = `
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
          <button class="debug-toggle-btn" style="margin-top:6px;">
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
  } else {
    console.log('Offline fetching JSON files');
    const resultsArea = document.getElementById('results-area');
    if (!currentSite) {
      resultsArea.innerHTML = `
        <div class="error-banner">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8"  x2="12"    y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <div>
            <strong>Offline search is available,</strong> but no site is selected.
            Please choose a site first.
          </div>
        </div>`;
      return;
    }

    try {
      const [table1, table2, table3] = await Promise.all([
        loadOfflineJson('./test_dms_extsys_item_valid.json').then(data => { console.log('table1 fetched'); return data; }),
        loadOfflineJson('./test_wms_iv_f.json').then(data => { console.log('table2 fetched'); return data; }),
        loadOfflineJson('./test_wms_lc_f.json').then(data => { console.log('table3 fetched'); return data; }),
      ]);

      //const normalizeText = (value) => String(value || '').trim().toLowerCase();
      //const queryTerms = normalizeText(query).split(/\s+/).filter(Boolean);
      /*const matchesQuery = (item) => {
        const haystack = Object.values(item)
          .filter(val => val !== null && val !== undefined)
          .map(val => normalizeText(val))
          .join(' ');

        if (!haystack) return false;
        if (normalizeText(query) && haystack.includes(normalizeText(query))) return true;

        return queryTerms.every(term => haystack.includes(term));
      };*/

      
      const siteKey = String(currentSite || '').trim().toUpperCase();
      const systemKey = SITE_SYSTEM_MAP[currentSite] ? String(SITE_SYSTEM_MAP[currentSite]).trim().toUpperCase() : '';
      const siteCandidates = [siteKey, systemKey].filter(Boolean);

      const matchesSite = (item) => {
        if (!currentSite) return true;
        const values = [item.site, item.pharmacy, item.external_system_name, item.site_name, item.system_name]
          .filter(Boolean)
          .map(value => String(value).trim().toUpperCase());
        return values.some(value => siteCandidates.includes(value));
      };

      const fuseOptions = {
        threshold: 0.1,
        keys: [
          'item',
          'item_description',
          'external_item_description',
          'description_1',
          'external_item',
          'uom',
          'location',
          'forward_pick_item',
        ]
      };

      const allItems = [
        ...(table1 || []).filter(item => matchesSite(item)), 
        ...(table2 || []).filter(item => matchesSite(item)), 
        ...(table3 || []).filter(item => matchesSite(item))
      ];

      const fuse = new Fuse(allItems, fuseOptions);
      const fuseResults = fuse.search(query);
      const matchedItems = fuseResults.map(result => result.item);

      const results = fuseResults.map(({ item }) => ({  
          source: item.location_type ? item.location_type.toLowerCase() : 'inventory',
          item: item.item || item.forward_pick_item || item.external_item || '',
          item_description: item.item_description || item.external_item_description || item.description_1 || '',
          package_code: item.uom || item.uom_1 || item.external_item_uom || '',
          location: item.location || item.actual_location || '',
          type_description: item.location_type || item.type_description || item.type || 'Inventory',
          pyxis_id: item.pyxis_id || item.external_item || null
      }));
      //const dmsRows = (table1 || []).filter(item => matchesSite(item) && matchesQuery(item));
      //const ivfRows = (table2 || []).filter(item => matchesSite(item) && matchesQuery(item));
      //const siteLcfRows = (table3 || []).filter(item => matchesSite(item));
      //const lcfRows = siteLcfRows.filter(item => matchesQuery(item));

      //const itemNumbers = new Set();
      /*dmsRows.forEach(row => { if (row.item) itemNumbers.add(String(row.item)); });
      ivfRows.forEach(row => { if (row.item) itemNumbers.add(String(row.item)); });
      lcfRows.forEach(row => {
        const item = row.forward_pick_item || row.item;
        if (item) itemNumbers.add(String(item));
      });

      //const results = [...itemNumbers].flatMap(itemNumber => {
        const dmsRow = dmsRows.find(row => String(row.item) === itemNumber);
        const ivfRow = ivfRows.find(row => String(row.item) === itemNumber);
        const lcfMatches = siteLcfRows.filter(row => String(row.forward_pick_item || row.item) === itemNumber);
        const itemDescription = ivfRow?.item_description || dmsRow?.item_description || dmsRow?.external_item_description || '';
        const packageCode = ivfRow?.uom || ivfRow?.uom_1 || dmsRow?.external_item_uom || '';
        const pyxisId = dmsRow?.external_item || dmsRow?.pyxis_id || null;

        if (lcfMatches.length > 0) {
          return lcfMatches.map(loc => ({
            source: 'location',
            item: itemNumber,
            item_description: itemDescription,
            package_code: packageCode,
            location: loc.location || loc.actual_location || '',
            type_description: loc.type_description || loc.type || loc.location_status || '',
            pyxis_id: pyxisId
          }));
        }

        if (dmsRow || ivfRow) {
          return [{
            source: ivfRow ? 'inventory' : 'dms',
            item: itemNumber,
            item_description: itemDescription,
            package_code: packageCode,
            location: '',
            type_description: ivfRow?.type_description || dmsRow?.type_description || 'Inventory',
            pyxis_id: pyxisId
          }];
        }

        return [];
      });*/

      console.log('results found:', results.length);
      console.log('currentSite:', currentSite);
      console.log('query:', query);
      renderResults(results, query);
    } catch (err) {
      debugLog('OFFLINE-ERROR', err.message);
      resultsArea.innerHTML = `
        <div class="error-banner">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8"  x2="12"    y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <div>
            <strong>Offline lookup failed.</strong> ${escHtml(err.message)}
          </div>
        </div>`;
    }
  }
}


/* ─────────────────────────────────────────────
   RENDER WITH DEDUPLICATION & SORTING
───────────────────────────────────────────── */
function badgeFor(typeDesc, source) {
  const t = (typeDesc || '').toLowerCase();
  if (t.includes('forward pick')) return ['Forward Pick',  'badge-fp'];
  if (t.includes('first in') || t.includes('fifo')) return ['FIFO', 'badge-fifo'];
  if (t.includes('home')) return ['Home Location', 'badge-home'];
  return [typeDesc || 'Inventory', 'badge-fifo'];
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

  // 1. Group by unique item number and wipe out layout duplicate rows
  const groups = new Map();
  let totalLocationsCount = 0;

  for (const r of results) {
    if (!r || !r.item) continue;

    if (!groups.has(r.item)) {
      groups.set(r.item, {
        item:              r.item,
        item_description:  r.item_description,
        package_code:      r.package_code,
        pyxis_id:          r.pyxis_id,
        rows:              [],
        seenLocations:     new Set() // Isolates safety duplicates per record frame
      });
    }

    const g = groups.get(r.item);
    const locKey = (r.location || '—').trim().toUpperCase();

    // DEDUPLICATION: Process location assignment only once per item structure
    if (!g.seenLocations.has(locKey)) {
      g.seenLocations.add(locKey);
      
      if (!g.item_description && r.item_description) g.item_description = r.item_description;
      if (!g.package_code     && r.package_code)     g.package_code     = r.package_code;
      if (!g.pyxis_id         && r.pyxis_id)         g.pyxis_id         = r.pyxis_id;
      
      g.rows.push(r);
      totalLocationsCount++;
    }
  }

  // 2. Sort rows natively: Forward Pick / Home first, then alphanumeric sequence
  for (const g of groups.values()) {
    g.rows.sort((a, b) => {
      const aType = (a.type_description || '').toLowerCase();
      const bType = (b.type_description || '').toLowerCase();
      
      const aIsFP = aType.includes('forward pick') || aType.includes('home') || a.source === 'location';
      const bIsFP = bType.includes('forward pick') || bType.includes('home') || b.source === 'location';

      // Constraint 1: Float Forward Pick environments above baseline FIFO
      if (aIsFP && !bIsFP) return -1;
      if (!aIsFP && bIsFP) return 1;

      // Constraint 2: Fallback to structured natural alphabetical sorting
      const aLoc = (a.location || '—').trim();
      const bLoc = (b.location || '—').trim();
      return aLoc.localeCompare(bLoc, undefined, { numeric: true, sensitivity: 'base' });
    });
  }

  const totalItems = groups.size;

  // 3. Render Template Structure
  const cards = [...groups.values()].map(g => {
    const pyxis = g.pyxis_id      || '';
    const pkg   = g.package_code  || '';
    const desc  = g.item_description || g.item;

    const locationRows = g.rows.map(r => {
      const [badgeLabel, badgeClass] = badgeFor(r.type_description, r.source);
      return `
        <tr class="loc-row">
          <td class="loc-cell loc-cell--location">
            <span class="location-value">${escHtml(r.location || '—')}</span>
          </td>
          <td class="loc-cell loc-cell--type">
            <span class="result-type-badge ${badgeClass}">${escHtml(badgeLabel)}</span>
          </td>
        </tr>`;
    }).join('');

    return `
      <div class="result-card">
        <div class="result-card-header">
          <div class="result-title">
            <div class="result-item-desc">${escHtml(desc)}</div>
            <div class="result-item-meta">
              <span class="result-item-num">Item #: ${escHtml(g.item)}</span>
              ${pkg ? `<span class="result-item-pkg">UOM: ${escHtml(pkg)}</span>` : ''}
            </div>
          </div>
          <div class="result-pyxis-block">
            <div class="result-pyxis-label">Pyxis ID</div>
            <div class="result-pyxis-value ${pyxis ? 'has-value' : 'no-value'}">
              ${pyxis ? escHtml(pyxis) : 'Not mapped'}
            </div>
          </div>
        </div>
        <table class="loc-table">
          <thead>
            <tr>
              <th class="loc-th">Location</th>
              <th class="loc-th">Type</th>
            </tr>
          </thead>
          <tbody>
            ${locationRows}
          </tbody>
        </table>
      </div>`;
  }).join('');

  area.innerHTML = `
    <div class="results-header">
      <span class="results-count">
        <strong>${totalItems}</strong> item${totalItems !== 1 ? 's' : ''}
        &nbsp;&middot;&nbsp;
        <strong>${totalLocationsCount}</strong> unique location${totalLocationsCount !== 1 ? 's' : ''}
        &nbsp;for "${escHtml(query)}"
      </span>
      <button class="debug-toggle-btn">Debug log</button>
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
