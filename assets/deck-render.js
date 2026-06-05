/* Renders all data-driven content into the deck slides. */
(function () {
  const data = window.DEEPTECH_DATA;
  const byIso = {}; data.countries.forEach(c => byIso[c.iso3] = c);
  const ranked = data.countries.slice().sort((a, b) => a.composite.rankOverall - b.composite.rankOverall);
  const flag = (c, w) => `https://flagcdn.com/w${w || 40}/${c.iso2.toLowerCase()}.png`;
  const fmtZ = (n) => n == null ? '—' : (n >= 0 ? '+' : '−') + Math.abs(n).toFixed(2);

  const PILLAR_DESC = {
    humanCapital: 'Researchers, STEM talent, elite universities',
    financialCapacity: 'R&D spend, venture capital, credit depth',
    infrastructure: 'Labs, data centres, connectivity',
    ecosystem: 'University–industry links, support actors',
    policy: 'Rule of law, openness, startup legislation',
    output: 'Patents, publications, startups, unicorns'
  };

  // ---- slide 2: pillar cards ----
  document.getElementById('deck-pgrid').innerHTML = data.pillars.map((p, i) => `
    <div class="pcard"><div class="pn">P${i + 1}</div><h4>${p.name}</h4><p>${PILLAR_DESC[p.id]}</p></div>`).join('');

  // ---- slide 3: map + leaders ----
  if (window.DeeptechMap) {
    DeeptechMap.render({
      container: '#deck-map', lowColor: '#e6eefb', highColor: '#163e8c',
      contextFill: '#eceff4', contextStroke: '#dfe4ec', stroke: '#ffffff', countryHref: null,
      onReady: ({ min, max }) => {
        const a = document.getElementById('dlg-min'), b = document.getElementById('dlg-max');
        if (a) a.textContent = min.toFixed(1); if (b) b.textContent = '+' + max.toFixed(1);
      }
    });
  }
  document.getElementById('deck-leaders').innerHTML = ranked.slice(0, 10).map(c => `
    <div class="lr"><span class="rk">${c.composite.rankOverall}</span><img src="${flag(c, 80)}" alt="">
      <span class="nm">${c.name}</span><span class="sc">${fmtZ(c.composite.score)}</span></div>`).join('');

  // ---- slide 4: rankings, two columns ----
  function rankRow(c) {
    const cls = c.continent === 'Europe' ? 'eu' : 'af';
    return `<div class="rrow ${cls}"><span class="rk">${c.composite.rankOverall}</span>
      <span class="cy"><img src="${flag(c, 80)}" alt="">${c.name}</span>
      <span class="ct">${c.continent === 'Europe' ? 'EU' : 'AF'}</span>
      <span class="sc">${fmtZ(c.composite.score)}</span></div>`;
  }
  document.getElementById('rank-col-1').innerHTML = ranked.slice(0, 13).map(rankRow).join('');
  document.getElementById('rank-col-2').innerHTML = ranked.slice(13).map(rankRow).join('');

  // ---- slide 5: pillar leaders ----
  document.getElementById('deck-pl').innerHTML = data.pillars.map((p, i) => {
    const top3 = data.countries.slice().sort((a, b) => b.pillars[p.id].score - a.pillars[p.id].score).slice(0, 3);
    const w = top3[0];
    const runners = top3.slice(1).map((c, idx) => `
      <div class="rr"><span class="rrk">${idx + 2}</span><img src="${flag(c, 40)}" alt="">
        <span class="rn">${c.name}</span><span class="rs">${fmtZ(c.pillars[p.id].score)}</span></div>`).join('');
    return `<div class="plcard">
      <div class="pln">P${i + 1} · Pillar</div><h4>${p.name}</h4>
      <div class="winner"><img src="${flag(w, 80)}" alt=""><span class="wn">${w.name}</span><span class="ws">${fmtZ(w.pillars[p.id].score)}</span></div>
      <div class="runners">${runners}</div>
    </div>`;
  }).join('');

  // ---- slide 6: spotlight radar (Mauritius) ----
  const mu = byIso['MUS'];
  if (window.DTCharts && mu) {
    DTCharts.radar('#sp-radar', {
      axes: data.pillars.map(p => ({ label: p.id === 'financialCapacity' ? 'Finance' : (p.id === 'humanCapital' ? 'Human' : (p.id === 'infrastructure' ? 'Infra' : p.name)) })),
      series: [{ name: 'Mauritius', color: '#163e8c', values: data.pillars.map(p => mu.pillars[p.id].score) }],
      domain: [-1.4, 1.6], rings: 4, width: 520, height: 520, labelPad: 96
    });
  }

  // ---- slide 7: Europe vs Africa grouped bars ----
  if (window.DTCharts) {
    const conts = ['Europe', 'Africa'];
    const avg = {};
    conts.forEach(ct => {
      const list = data.countries.filter(c => c.continent === ct);
      avg[ct] = {}; data.pillars.forEach(p => { avg[ct][p.id] = list.reduce((s, c) => s + c.pillars[p.id].score, 0) / list.length; });
    });
    DTCharts.bars('#ea-bars', {
      categories: data.pillars.map(p => p.id === 'financialCapacity' ? 'Finance' : (p.id === 'humanCapital' ? 'Human' : (p.id === 'infrastructure' ? 'Infra' : p.name))),
      series: [
        { name: 'Europe', color: '#163e8c', values: data.pillars.map(p => avg.Europe[p.id]) },
        { name: 'Africa', color: '#d98c34', values: data.pillars.map(p => avg.Africa[p.id]) }
      ],
      domain: [-1.0, 0.8], height: 470, maxBar: 46
    });
  }
})();
