/* Shared renderers for pillar grid and rankings table.
   Requires window.DEEPTECH_DATA and d3 (for color interpolation). */
(function () {
  const D = () => window.DEEPTECH_DATA;

  const PILLAR_DESC = {
    humanCapital: 'Researchers, STEM talent and elite universities',
    financialCapacity: 'R&D spend, venture capital and credit depth',
    infrastructure: 'Labs, data centres and connectivity',
    ecosystem: 'University–industry links and support actors',
    policy: 'Rule of law, openness and startup legislation',
    output: 'Patents, publications, startups and unicorns'
  };
  const PILLAR_ABBR = {
    humanCapital: 'Human', financialCapacity: 'Finance', infrastructure: 'Infra',
    ecosystem: 'Ecosys', policy: 'Policy', output: 'Output'
  };

  const fmtZ = (n) => n === null || n === undefined ? '—' : (n >= 0 ? '+' : '') + n.toFixed(2);
  const flagImg = (c) => `<img class="fl" src="https://flagcdn.com/w40/${c.iso2.toLowerCase()}.png" alt="${c.name}" width="26" loading="lazy" />`;

  function pillarScale(theme) {
    // domain across all pillar scores
    let lo = Infinity, hi = -Infinity;
    D().countries.forEach(c => Object.values(c.pillars).forEach(p => {
      if (p.score < lo) lo = p.score; if (p.score > hi) hi = p.score;
    }));
    return d3.scaleLinear().domain([lo, 0, hi])
      .range([theme.cellLow || '#eef3fc', '#cdddf6', theme.cellHigh || '#163e8c'])
      .interpolate(d3.interpolateLab).clamp(true);
  }
  function textOn(bg) {
    const c = d3.lab(bg); return c.l < 62 ? '#fff' : '#0d1422';
  }

  function pillars(sel) {
    const el = document.querySelector(sel);
    if (!el) return;
    el.innerHTML = D().pillars.map((p, i) => `
      <div class="pcell">
        <div class="pnum">P${i + 1}</div>
        <h4>${p.name}</h4>
        <p>${PILLAR_DESC[p.id]}</p>
      </div>`).join('');
  }

  function table(sel, theme) {
    theme = theme || {};
    const variant = theme.variant || 'cells';
    const el = document.querySelector(sel);
    if (!el) return;
    const data = D();
    const scale = pillarScale(theme);
    const state = { cont: 'all', sortKey: 'overall', dir: 1 };

    const pillarIds = data.pillars.map(p => p.id);
    // overall score range for bar scaling
    let sLo = Infinity, sHi = -Infinity;
    data.countries.forEach(c => { sLo = Math.min(sLo, c.composite.score); sHi = Math.max(sHi, c.composite.score); });

    function rankFor(c) { return state.cont === 'all' ? c.composite.rankOverall : c.composite.rankContinent; }

    function rows() {
      let list = data.countries.slice();
      if (state.cont !== 'all') list = list.filter(c => c.continent === state.cont);
      // sort
      const k = state.sortKey;
      list.sort((a, b) => {
        let av, bv;
        if (k === 'overall') { av = a.composite.score; bv = b.composite.score; }
        else { av = a.pillars[k].score; bv = b.pillars[k].score; }
        return (bv - av) * state.dir; // dir 1 => highest score first
      });
      return list;
    }

    function header() {
      const ph = pillarIds.map(id => {
        const active = state.sortKey === id;
        return `<th data-sort="${id}" data-active="${active}" title="${data.pillars.find(p=>p.id===id).fullName}">${PILLAR_ABBR[id]}</th>`;
      }).join('');
      if (variant === 'bars') {
        return `<thead><tr>
          <th class="left" style="width:60px">#</th>
          <th class="left" data-sort="country">Country</th>
          <th class="left" data-sort="overall" data-active="${state.sortKey==='overall'}" style="width:34%">Overall index</th>
          ${ph}
        </tr></thead>`;
      }
      return `<thead><tr>
        <th class="left" style="width:54px">#</th>
        <th class="left" data-sort="country">Country</th>
        <th data-sort="overall" data-active="${state.sortKey==='overall'}">Overall</th>
        ${ph}
      </tr></thead>`;
    }

    function body() {
      const list = rows();
      if (variant === 'bars') {
        return '<tbody>' + list.map(c => {
          const dots = pillarIds.map(id => {
            const s = c.pillars[id].score; const bg = scale(s);
            return `<td class="cell heat-cell" title="${data.pillars.find(p=>p.id===id).name}: ${fmtZ(s)}"><span class="dot" style="background:${bg}"></span></td>`;
          }).join('');
          const w = Math.max(3, ((c.composite.score - sLo) / (sHi - sLo)) * 100);
          return `<tr data-iso="${c.iso3}">
            <td class="c-rank">${rankFor(c)}</td>
            <td class="c-country"><span class="fl">${flagImg(c)}</span><span>${c.name}<br><span class="ct">${c.continent}</span></span></td>
            <td class="c-bar"><span class="barwrap"><span class="bar" style="width:${w}%"></span></span><span class="barval">${fmtZ(c.composite.score)}</span></td>
            ${dots}
          </tr>`;
        }).join('') + '</tbody>';
      }
      return '<tbody>' + list.map(c => {
        const cells = pillarIds.map(id => {
          const s = c.pillars[id].score;
          const bg = scale(s);
          return `<td class="cell pill-cell"><span class="bg" style="background:${bg};opacity:.9"></span><span class="v" style="color:${textOn(bg)}">${fmtZ(s)}</span></td>`;
        }).join('');
        return `<tr data-iso="${c.iso3}">
          <td class="c-rank">${rankFor(c)}</td>
          <td class="c-country"><span class="fl">${flagImg(c)}</span><span>${c.name}<br><span class="ct">${c.continent}</span></span></td>
          <td class="c-score">${fmtZ(c.composite.score)}</td>
          ${cells}
        </tr>`;
      }).join('') + '</tbody>';
    }

    function draw() {
      el.innerHTML = header() + body();
      el.querySelectorAll('thead th[data-sort]').forEach(th => {
        th.addEventListener('click', () => {
          const key = th.getAttribute('data-sort');
          if (key === 'country') return;
          state.sortKey = key; draw();
        });
      });
      el.querySelectorAll('tbody tr').forEach(tr => {
        tr.addEventListener('click', () => {
          const iso = tr.getAttribute('data-iso');
          if (theme.countryHref) window.location.href = theme.countryHref(iso);
        });
      });
    }

    // wire continent chips if present
    document.querySelectorAll('[data-cont]').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('[data-cont]').forEach(c => c.setAttribute('aria-selected', 'false'));
        chip.setAttribute('aria-selected', 'true');
        state.cont = chip.getAttribute('data-cont');
        draw();
      });
    });

    draw();
  }

  window.DTRender = { pillars, table, fmtZ };
})();
