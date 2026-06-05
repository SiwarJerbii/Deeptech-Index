/* Country profile renderer. Reads ?c=ISO3 from the URL. */
(function () {
  const data = window.DEEPTECH_DATA;
  const byIso = {}; data.countries.forEach(c => byIso[c.iso3] = c);
  const params = new URLSearchParams(location.search);
  let iso = (params.get('c') || 'CHE').toUpperCase();
  let c = byIso[iso] || data.countries.slice().sort((a, b) => a.composite.rankOverall - b.composite.rankOverall)[0];

  const fmtZ = (n) => n === null || n === undefined ? null : (n >= 0 ? '+' : '') + (+n).toFixed(2);
  const flag = (x, w) => `https://flagcdn.com/w${w || 80}/${x.iso2.toLowerCase()}.png`;
  const N = data.countries.length;

  // z -> color (red↔neutral↔blue), matching charts
  const zColor = (z) => {
    if (z == null) return '#c2cbdb';
    if (z >= 0) { const t = Math.min(1, z / 2.2); return d3.interpolateLab('#aebfdd', '#163e8c')(t); }
    const t = Math.min(1, -z / 1.6); return d3.interpolateLab('#cdd6e6', '#d98c8c')(t);
  };
  // z bar geometry within a centered [-domain,+domain] track
  const DOM = 2.4;
  function zbarFill(z) {
    if (z == null) return '';
    const half = 50; // percent each side
    const frac = Math.max(-1, Math.min(1, z / DOM));
    if (z >= 0) return `left:50%;width:${frac * half}%;background:${zColor(z)}`;
    return `right:50%;width:${-frac * half}%;background:${zColor(z)}`;
  }

  function fmtNum(n) {
    if (n == null) return '—';
    if (n >= 1e12) return (n / 1e12).toFixed(2) + 'T';
    if (n >= 1e9) return (n / 1e9).toFixed(n >= 1e10 ? 0 : 1) + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(0) + 'K';
    return '' + n;
  }
  function fmtPop(n) {
    if (n == null) return '—';
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(0) + 'K';
    return '' + n;
  }

  document.title = `${c.name} — Deeptech Index`;
  document.getElementById('crumb-name').textContent = c.name;

  const contN = data.countries.filter(x => x.continent === c.continent).length;

  // strengths/weaknesses are pillar names -> map to pillar object for rank
  const pillarByName = {}; data.pillars.forEach(p => pillarByName[p.name] = p);
  function pillarRankByName(name) {
    const p = data.pillars.find(p => p.name === name); if (!p) return null;
    return c.pillars[p.id];
  }

  function chev() { return `<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>`; }

  function indicatorRow(ind) {
    const z = ind.z;
    const zs = fmtZ(z);
    const rank = z == null ? '' : `#${ind.rankOverall} <span style="opacity:.6">/${N}</span>`;
    return `<div class="ind">
      <div><div class="iname">${ind.name}</div><div class="isrc">${ind.source} · ${ind.unit}</div></div>
      <div class="izbar"><span class="zmid"></span><span class="f" style="${zbarFill(z)}"></span></div>
      <div class="ivals">${z == null
        ? '<span class="iz na">n/a</span><span class="irank"></span>'
        : `<span class="iz" style="color:${z >= 0 ? 'var(--ink)' : '#c0392b'}">${zs}</span><span class="irank">${rank}</span>`}</div>
    </div>`;
  }

  function pillarBlock(p, i) {
    const pd = c.pillars[p.id];
    const open = i === 0 ? 'open' : '';
    let inner = '';
    if (pd.subpillars && pd.subpillars.length) {
      inner = pd.subpillars.map(sp => {
        const inds = sp.indicators.map(id => pd.indicators.find(x => x.id === id)).filter(Boolean);
        return `<div class="subgroup-label">${sp.name} <span class="ss">· avg ${fmtZ(sp.score)}</span></div>` +
          inds.map(indicatorRow).join('');
      }).join('');
    } else {
      inner = pd.indicators.map(indicatorRow).join('');
    }
    const fillStyle = zbarFill(pd.score);
    return `<div class="pillar ${open}" data-pillar="${p.id}">
      <div class="pillar-head">
        <div class="pillar-rank">#${pd.rankOverall}<span style="opacity:.5">/${N}</span></div>
        <div class="pillar-name">P${i + 1} · ${p.name}<span class="full">${p.fullName}</span></div>
        <div class="zbar"><span class="zmid"></span><span class="zfill" style="${fillStyle}"></span></div>
        <div style="display:flex;align-items:center;gap:14px">
          <div class="pillar-score" style="color:${pd.score >= 0 ? 'var(--blue)' : '#c0392b'}">${fmtZ(pd.score)}</div>
          ${chev()}
        </div>
      </div>
      <div class="pillar-body">${inner}</div>
    </div>`;
  }

  function swItem(name, kind) {
    const pd = pillarRankByName(name);
    const rankTxt = pd ? `Ranks #${pd.rankContinent} in ${c.continent} · #${pd.rankOverall} overall · ${fmtZ(pd.score)}` : '';
    const verb = kind === 'up'
      ? 'A leading pillar for this country, well above the panel average.'
      : 'A relative gap — this pillar sits below the panel average and drags on the composite.';
    return `<div class="sw-item">
      <div class="sw-ic ${kind}">${kind === 'up' ? '▲' : '▼'}</div>
      <div><div class="t">${name}</div><div class="d">${verb}<br><span style="font-family:'IBM Plex Mono';font-size:11px;color:var(--ink-3)">${rankTxt}</span></div></div>
    </div>`;
  }

  // prev/next by overall rank
  const ranked = data.countries.slice().sort((a, b) => a.composite.rankOverall - b.composite.rankOverall);
  const idx = ranked.findIndex(x => x.iso3 === c.iso3);
  const prev = ranked[idx - 1], next = ranked[idx + 1];
  function navCard(country, dir) {
    if (!country) return `<span style="flex:1"></span>`;
    const cls = dir === 'next' ? 'next' : 'prev';
    return `<a class="${cls}" href="country.html?c=${country.iso3}">
      <div class="dir">${dir === 'next' ? 'Next · higher rank' : 'Previous · lower rank'}</div>
      <div class="nm">${dir === 'next' ? '' : `<img src="${flag(country, 40)}">`}#${country.composite.rankOverall} ${country.name}${dir === 'next' ? `<img src="${flag(country, 40)}">` : ''}</div>
    </a>`;
  }

  const gdpStr = c.gdpUsd ? '$' + fmtNum(c.gdpUsd) : '—';
  const gdpPc = (c.gdpUsd && c.population) ? '$' + Math.round(c.gdpUsd / c.population).toLocaleString() : '—';

  const html = `
    <div class="chead">
      <div class="chead-top">
        <div class="ctitle">
          <img src="${flag(c, 160)}" alt="${c.name} flag">
          <div>
            <h1>${c.name}</h1>
            <div class="ct-sub"><span class="badge">${c.continent}</span><span>${c.iso3}</span></div>
          </div>
        </div>
        <div class="rankbox">
          <div class="rb"><span class="l">Overall rank</span><span class="v">#${c.composite.rankOverall}<small>/${N}</small></span></div>
          <div class="rb"><span class="l">In ${c.continent}</span><span class="v">#${c.composite.rankContinent}<small>/${contN}</small></span></div>
          <div class="rb score"><span class="l">Index score</span><span class="v">${fmtZ(c.composite.score)}</span></div>
        </div>
      </div>
      <div class="facts">
        <div class="fact"><div class="l">Population</div><div class="v">${fmtPop(c.population)}</div></div>
        <div class="fact"><div class="l">GDP (nominal)</div><div class="v">${gdpStr}<small> USD</small></div></div>
        <div class="fact"><div class="l">GDP per capita</div><div class="v">${gdpPc}</div></div>
        <div class="fact"><div class="l">Continent rank</div><div class="v">#${c.composite.rankContinent} <small>of ${contN}</small></div></div>
      </div>
    </div>

    <div class="layout">
      <div>
        <div class="sec-h"><h2>Performance by pillar</h2><span class="hint">Click a pillar to expand its indicators</span></div>
        <div id="pillars">${data.pillars.map((p, i) => pillarBlock(p, i)).join('')}</div>
      </div>
      <div>
        <div class="aside-card">
          <h3>Pillar profile</h3>
          <div id="radar"></div>
          <div class="radar-legend"><span style="display:flex;align-items:center;gap:7px"><span style="width:18px;height:3px;background:#1d4ed8;display:inline-block;border-radius:2px"></span>${c.name}</span><span style="display:flex;align-items:center;gap:7px"><span style="width:18px;height:0;border-top:1.5px dashed #9fb0cc;display:inline-block"></span>panel avg</span></div>
        </div>
        <div class="aside-card">
          <h3>Strengths</h3>
          <div class="sw-row">${(c.strengths || []).map(s => swItem(s, 'up')).join('') || '<div class="d" style="color:var(--ink-3)">—</div>'}</div>
        </div>
        <div class="aside-card">
          <h3>Relative weaknesses</h3>
          <div class="sw-row">${(c.weaknesses || []).map(s => swItem(s, 'dn')).join('') || '<div class="d" style="color:var(--ink-3)">—</div>'}</div>
        </div>
        <div class="aside-card" style="padding:18px 22px">
          <a class="btn btn-primary" style="width:100%;text-align:center" href="compare.html?c=${c.iso3}">Compare ${c.name} with others →</a>
        </div>
      </div>
    </div>

    <div class="navlinks">${navCard(prev, 'prev')}${navCard(next, 'next')}</div>
  `;

  document.getElementById('content').innerHTML = html;

  // accordion
  document.querySelectorAll('.pillar-head').forEach(h => {
    h.addEventListener('click', () => h.closest('.pillar').classList.toggle('open'));
  });

  // radar: country vs panel-average (0 across all)
  DTCharts.radar('#radar', {
    axes: data.pillars.map(p => ({ label: p.name.split(' ')[0] === 'Financial' ? 'Finance' : (p.name.split(' ')[0] === 'Human' ? 'Human' : p.name) })),
    series: [{ name: c.name, color: '#1d4ed8', values: data.pillars.map(p => c.pillars[p.id].score) }],
    domain: [-1.6, 2.4], rings: 4, height: 340
  });
})();
