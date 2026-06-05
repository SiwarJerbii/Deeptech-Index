/* Compare tool — countries × (pillars | indicators), rendered as bars / radar / table. */
(function () {
  const data = window.DEEPTECH_DATA;
  const byIso = {}; data.countries.forEach(c => byIso[c.iso3] = c);
  const ranked = data.countries.slice().sort((a, b) => a.composite.rankOverall - b.composite.rankOverall);
  const PAL = DTCharts.PALETTE;
  const MAX = 6;
  const flag = (c, w) => `https://flagcdn.com/w${w || 40}/${c.iso2.toLowerCase()}.png`;
  const fmtZ = (n) => n == null ? '—' : (n >= 0 ? '+' : '') + (+n).toFixed(2);

  const state = {
    selected: [],          // iso3[]
    mode: 'pillars',       // 'pillars' | 'indicators'
    metrics: [],           // pillar ids OR indicator ids
    view: 'bars'
  };

  // seed from ?c= and add 2 sensible defaults
  const seed = (new URLSearchParams(location.search).get('c') || '').toUpperCase();
  if (seed && byIso[seed]) state.selected.push(seed);
  ['CHE', 'DEU', 'KEN'].forEach(i => { if (state.selected.length < 3 && !state.selected.includes(i)) state.selected.push(i); });
  state.metrics = data.pillars.map(p => p.id); // all pillars by default

  // ---- metric helpers ----
  function pillarById(id) { return data.pillars.find(p => p.id === id); }
  function indicatorMeta(id) { return data.indicators.find(i => i.id === id); }
  function valueFor(c, mode, id) {
    if (mode === 'pillars') { const p = c.pillars[id]; return { z: p.score, rankO: p.rankOverall, rankC: p.rankContinent }; }
    // indicator: find inside its pillar
    const meta = indicatorMeta(id); if (!meta) return { z: null };
    const pd = c.pillars[meta.pillar];
    const ind = pd.indicators.find(x => x.id === id);
    return ind ? { z: ind.z, rankO: ind.rankOverall, rankC: ind.rankContinent } : { z: null };
  }
  function metricLabel(mode, id, short) {
    if (mode === 'pillars') return pillarById(id).name;
    const m = indicatorMeta(id); if (!m) return id;
    return short ? m.name.replace(/ \(.*\)/, '') : m.name;
  }
  function colorFor(iso) { return PAL[state.selected.indexOf(iso) % PAL.length]; }

  // ================= LEFT PANEL =================
  function renderChips() {
    document.getElementById('cc-count').textContent = `${state.selected.length} / ${MAX}`;
    document.getElementById('sel-chips').innerHTML = state.selected.map(iso => {
      const c = byIso[iso];
      return `<span class="selchip" style="background:${colorFor(iso)}"><img src="${flag(c)}"> ${c.name}<button data-rm="${iso}">✕</button></span>`;
    }).join('') || '<span style="font-size:12px;color:var(--ink-3)">No countries selected</span>';
    document.querySelectorAll('#sel-chips [data-rm]').forEach(b => b.onclick = () => toggleCountry(b.dataset.rm));
  }

  function renderCountryList(filter) {
    filter = (filter || '').toLowerCase();
    const list = ranked.filter(c => c.name.toLowerCase().includes(filter) || c.iso3.toLowerCase().includes(filter));
    const atMax = state.selected.length >= MAX;
    document.getElementById('clist').innerHTML = list.map(c => {
      const sel = state.selected.includes(c.iso3);
      const dis = !sel && atMax ? 'disabled' : '';
      return `<div class="crow ${dis}" data-iso="${c.iso3}" aria-selected="${sel}" style="--sel:${sel ? colorFor(c.iso3) : '#1d4ed8'}">
        <span class="chk"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 12l5 5L20 6"/></svg></span>
        <img src="${flag(c)}"><span class="nm">${c.name}</span><span class="rk">#${c.composite.rankOverall}</span>
      </div>`;
    }).join('');
    document.querySelectorAll('#clist .crow').forEach(r => r.onclick = () => toggleCountry(r.dataset.iso));
  }

  function toggleCountry(iso) {
    const i = state.selected.indexOf(iso);
    if (i >= 0) state.selected.splice(i, 1);
    else { if (state.selected.length >= MAX) return; state.selected.push(iso); }
    renderChips(); renderCountryList(document.getElementById('csearch').value); render();
  }

  function renderMetricList() {
    const el = document.getElementById('mlist');
    if (state.mode === 'pillars') {
      el.innerHTML = `<div class="mgroup-h">Six pillars <span class="sel-all" data-all="pillars">select all</span></div>` +
        data.pillars.map(p => {
          const sel = state.metrics.includes(p.id);
          return `<div class="mrow" data-id="${p.id}" aria-selected="${sel}">
            <span class="chk"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 12l5 5L20 6"/></svg></span>
            ${p.name}</div>`;
        }).join('');
    } else {
      el.innerHTML = data.pillars.map(p => {
        const inds = data.indicators.filter(i => i.pillar === p.id);
        return `<div class="mgroup-h">${p.name} <span class="sel-all" data-all="${p.id}">all</span></div>` +
          inds.map(m => {
            const sel = state.metrics.includes(m.id);
            return `<div class="mrow" data-id="${m.id}" aria-selected="${sel}">
              <span class="chk"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 12l5 5L20 6"/></svg></span>
              <span>${m.name.replace(/ \(.*\)/, '')}</span><span class="src">${m.source}</span></div>`;
          }).join('');
      }).join('');
    }
    el.querySelectorAll('.mrow').forEach(r => r.onclick = () => toggleMetric(r.dataset.id));
    el.querySelectorAll('.sel-all').forEach(b => b.onclick = (e) => { e.stopPropagation(); selectAllMetrics(b.dataset.all); });
  }

  function toggleMetric(id) {
    const i = state.metrics.indexOf(id);
    if (i >= 0) state.metrics.splice(i, 1); else state.metrics.push(id);
    renderMetricList(); render();
  }
  function selectAllMetrics(group) {
    let ids;
    if (group === 'pillars') ids = data.pillars.map(p => p.id);
    else ids = data.indicators.filter(i => i.pillar === group).map(i => i.id);
    const allOn = ids.every(id => state.metrics.includes(id));
    if (allOn) state.metrics = state.metrics.filter(id => !ids.includes(id));
    else ids.forEach(id => { if (!state.metrics.includes(id)) state.metrics.push(id); });
    renderMetricList(); render();
  }

  // mode switch
  document.querySelectorAll('#mode-seg button').forEach(b => b.onclick = () => {
    document.querySelectorAll('#mode-seg button').forEach(x => x.setAttribute('aria-pressed', 'false'));
    b.setAttribute('aria-pressed', 'true');
    state.mode = b.dataset.mode;
    state.metrics = state.mode === 'pillars' ? data.pillars.map(p => p.id) : [];
    // radar needs ≥3 axes; if indicators empty default a sensible set later
    renderMetricList(); render();
  });
  // view switch
  document.querySelectorAll('#view-seg button').forEach(b => b.onclick = () => {
    document.querySelectorAll('#view-seg button').forEach(x => x.setAttribute('aria-pressed', 'false'));
    b.setAttribute('aria-pressed', 'true');
    state.view = b.dataset.view; render();
  });
  // quick actions
  document.querySelectorAll('[data-quick]').forEach(b => b.onclick = () => {
    const q = b.dataset.quick;
    if (q === 'clear') state.selected = [];
    if (q === 'topEu') state.selected = ranked.filter(c => c.continent === 'Europe').slice(0, 3).map(c => c.iso3);
    if (q === 'topAf') state.selected = ranked.filter(c => c.continent === 'Africa').slice(0, 3).map(c => c.iso3);
    renderChips(); renderCountryList(document.getElementById('csearch').value); render();
  });
  document.getElementById('csearch').oninput = (e) => renderCountryList(e.target.value);

  // ================= RESULTS =================
  function emptyState(msg) {
    return `<div class="empty">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
      <h4>${msg.h}</h4><p>${msg.p}</p></div>`;
  }

  function metricsActive() { return state.metrics.slice(); }

  function render() {
    const card = document.getElementById('result-card');
    const meta = document.getElementById('results-meta');
    const sel = state.selected, mets = metricsActive();
    meta.textContent = `${sel.length} countr${sel.length === 1 ? 'y' : 'ies'} · ${mets.length} metric${mets.length === 1 ? '' : 's'}`;

    if (sel.length === 0) { card.innerHTML = emptyState({ h: 'Pick countries to compare', p: 'Choose up to six from the panel on the left. Try “Top Europe” or “Top Africa” to start fast.' }); return; }
    if (mets.length === 0) { card.innerHTML = emptyState({ h: 'Choose what to measure', p: 'Select one or more pillars — or switch to Indicators and drill into specific metrics.' }); return; }

    // disable radar option visually if <3 metrics
    const radarBtn = document.querySelector('#view-seg button[data-view="radar"]');
    radarBtn.style.opacity = mets.length < 3 ? .4 : 1;
    let view = state.view;
    if (view === 'radar' && mets.length < 3) view = 'bars';

    if (view === 'bars') renderBars(card, sel, mets);
    else if (view === 'radar') renderRadar(card, sel, mets);
    else renderTable(card, sel, mets);
  }

  function titleFor(mets) {
    if (state.mode === 'pillars') return mets.length === data.pillars.length ? 'All six pillars' : mets.map(m => pillarById(m).name).join(' · ');
    return mets.length === 1 ? metricLabel('indicators', mets[0]) : `${mets.length} indicators`;
  }

  function renderBars(card, sel, mets) {
    // grouped bars: categories = metrics, series = countries
    const cats = mets.map(m => metricLabel(state.mode, m, true));
    const series = sel.map(iso => ({
      name: byIso[iso].name, color: colorFor(iso),
      values: mets.map(m => valueFor(byIso[iso], state.mode, m).z)
    }));
    const single = mets.length === 1;
    card.innerHTML = `<div class="result-title">${titleFor(mets)}</div>
      <div class="result-sub">Grouped by ${single ? 'country' : 'metric'} · z-scores (panel mean = 0)</div>
      <div id="chart"></div>${legendHtml(sel)}`;
    // single metric -> horizontal ranked bars reads better
    if (single) {
      const order = sel.slice().sort((a, b) => (valueFor(byIso[b], state.mode, mets[0]).z ?? -9) - (valueFor(byIso[a], state.mode, mets[0]).z ?? -9));
      DTCharts.bars('#chart', {
        horizontal: true, categories: order.map(i => byIso[i].name),
        series: [{ name: cats[0], colors: order.map(i => colorFor(i)), values: order.map(i => valueFor(byIso[i], state.mode, mets[0]).z) }],
        rowH: 30, padL: 130
      });
      card.querySelector('.result-sub').textContent = `${cats[0]} · ranked · z-scores (panel mean = 0)`;
    } else {
      DTCharts.bars('#chart', { categories: cats, series, height: Math.max(320, 40 + cats.length * 6), maxBar: 40 });
    }
  }

  function renderRadar(card, sel, mets) {
    const axes = mets.map(m => ({ label: metricLabel(state.mode, m, true) }));
    const series = sel.map(iso => ({ name: byIso[iso].name, color: colorFor(iso), values: mets.map(m => valueFor(byIso[iso], state.mode, m).z) }));
    card.innerHTML = `<div class="result-title">${titleFor(mets)}</div>
      <div class="result-sub">Radar · z-scores · dashed ring = panel average (0)</div>
      <div id="chart" style="max-width:560px;margin:0 auto"></div>${legendHtml(sel)}`;
    const w = Math.min(540, card.querySelector('#chart').clientWidth || 540);
    DTCharts.radar('#chart', { axes, series, domain: [-1.6, 2.6], rings: 4, width: w, height: w, labelPad: 92 });
  }

  function renderTable(card, sel, mets) {
    // rows = metrics, columns = countries; highlight best per row
    const head = `<th class="left">Metric</th>` + sel.map(iso => {
      const c = byIso[iso];
      return `<th><div class="ch"><img src="${flag(c)}">${c.name}</div></th>`;
    }).join('');
    const rows = mets.map(m => {
      const vals = sel.map(iso => valueFor(byIso[iso], state.mode, m).z);
      const best = Math.max(...vals.filter(v => v != null));
      const cells = sel.map((iso, idx) => {
        const v = valueFor(byIso[iso], state.mode, m);
        const isBest = v.z != null && v.z === best && sel.length > 1;
        return `<td class="${isBest ? 'best' : ''}">${v.z == null ? '<span class="z" style="color:var(--ink-3)">n/a</span>'
          : `<span class="z">${fmtZ(v.z)}</span><span class="rk">#${v.rankO} of ${data.countries.length}</span>`}</td>`;
      }).join('');
      const sub = state.mode === 'indicators' ? `<small>${indicatorMeta(m).source} · ${indicatorMeta(m).unit}</small>` : `<small>pillar</small>`;
      return `<tr><td class="left metric-cell">${metricLabel(state.mode, m)}${sub}</td>${cells}</tr>`;
    }).join('');
    // overall row when comparing pillars
    let overall = '';
    if (state.mode === 'pillars') {
      const vals = sel.map(iso => byIso[iso].composite.score);
      const best = Math.max(...vals);
      overall = `<tr style="border-top:2px solid var(--line)"><td class="left metric-cell" style="font-weight:600">Overall index<small>composite</small></td>` +
        sel.map(iso => {
          const c = byIso[iso]; const isBest = c.composite.score === best && sel.length > 1;
          return `<td class="${isBest ? 'best' : ''}"><span class="z">${fmtZ(c.composite.score)}</span><span class="rk">#${c.composite.rankOverall} of ${data.countries.length}</span></td>`;
        }).join('') + '</tr>';
    }
    card.innerHTML = `<div class="result-title">${titleFor(mets)}</div>
      <div class="result-sub">Best value per row highlighted · z-scores with overall rank</div>
      <div style="overflow-x:auto"><table class="ctable"><thead><tr>${head}</tr></thead><tbody>${rows}${overall}</tbody></table></div>`;
  }

  function legendHtml(sel) {
    return `<div class="legend">` + sel.map(iso => {
      const c = byIso[iso];
      return `<div class="li"><span class="sw" style="background:${colorFor(iso)}"></span><img src="${flag(c)}">${c.name}</div>`;
    }).join('') + `</div>`;
  }

  // init
  renderChips(); renderCountryList(''); renderMetricList(); render();
})();
