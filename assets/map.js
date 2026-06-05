/* Shared choropleth renderer for the Deeptech Index.
   Requires d3 (v7) and topojson-client to be loaded before this script.
   Usage:
     DeeptechMap.render({
       container: '#map',           // selector or element
       lowColor: '#e6eefb',         // score = min
       highColor: '#0a2a6b',        // score = max
       contextFill: '#eceff4',      // non-indexed countries
       contextStroke: '#dfe4ec',
       stroke: '#ffffff',
       countryHref: (c) => 'country.html?c=' + c.iso3,  // or null to disable nav
       graticule: false,
       onReady: () => {}
     });
*/
(function () {
  const ATLAS = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

  // Region clip box (lon/lat) tight on Africa + Europe.
  const REGION = {
    type: 'Polygon',
    coordinates: [[[-26, 73], [66, 73], [66, -37], [-26, -37], [-26, 73]]]
  };

  // Fallback centroids for tiny states that don't render at 110m resolution.
  const FALLBACK = { MUS: [57.55, -20.35], MLT: [14.45, 35.9] };

  // Natural Earth name -> our iso3, for matching topojson features.
  const NAME_TO_ISO3 = {
    'Algeria': 'DZA', 'Austria': 'AUT', 'Belgium': 'BEL', 'Denmark': 'DNK',
    'Egypt': 'EGY', 'Estonia': 'EST', 'Finland': 'FIN', 'France': 'FRA',
    'Germany': 'DEU', 'Ghana': 'GHA', 'Hungary': 'HUN', 'Ireland': 'IRL',
    'Italy': 'ITA', 'Kenya': 'KEN', 'Mauritius': 'MUS', 'Morocco': 'MAR',
    'Netherlands': 'NLD', 'Nigeria': 'NGA', 'Rwanda': 'RWA', 'Senegal': 'SEN',
    'South Africa': 'ZAF', 'Spain': 'ESP', 'Sweden': 'SWE', 'Switzerland': 'CHE',
    'Tunisia': 'TUN', 'United Kingdom': 'GBR'
  };

  let cachedTopo = null;

  async function loadTopo() {
    if (cachedTopo) return cachedTopo;
    const res = await fetch(ATLAS);
    cachedTopo = await res.json();
    return cachedTopo;
  }

  function resolveEl(c) {
    return typeof c === 'string' ? document.querySelector(c) : c;
  }

  async function render(opts) {
    const el = resolveEl(opts.container);
    if (!el) return;
    const data = window.DEEPTECH_DATA;
    const byIso = {};
    data.countries.forEach(c => { byIso[c.iso3] = c; });

    const scores = data.countries.map(c => c.composite.score);
    const min = Math.min(...scores), max = Math.max(...scores);
    const color = d3.scaleLinear().domain([min, max])
      .range([opts.lowColor || '#e6eefb', opts.highColor || '#0a2a6b'])
      .interpolate(d3.interpolateLab).clamp(true);

    const topo = await loadTopo();
    const countries = topojson.feature(topo, topo.objects.countries).features;
    const borders = topojson.mesh(topo, topo.objects.countries, (a, b) => a !== b);

    // size
    const rect = el.getBoundingClientRect();
    const W = Math.max(320, rect.width || 800);
    const H = Math.max(240, rect.height || (W * 0.78));

    const projection = d3.geoMercator();
    projection.fitExtent([[8, 8], [W - 8, H - 8]], REGION);
    const path = d3.geoPath(projection);

    el.innerHTML = '';
    el.style.position = el.style.position || 'relative';
    const svg = d3.select(el).append('svg')
      .attr('viewBox', `0 0 ${W} ${H}`)
      .attr('width', '100%').attr('height', '100%')
      .attr('preserveAspectRatio', 'xMidYMid meet')
      .style('display', 'block')
      .style('overflow', 'hidden');

    // clip to viewport so out-of-region geometry is hidden
    const clipId = 'mapclip-' + Math.random().toString(36).slice(2, 8);
    svg.append('clipPath').attr('id', clipId).append('rect')
      .attr('width', W).attr('height', H);
    const g = svg.append('g').attr('clip-path', `url(#${clipId})`);

    if (opts.graticule) {
      const grat = d3.geoGraticule10();
      g.append('path').datum(grat).attr('d', path)
        .attr('fill', 'none').attr('stroke', opts.graticuleStroke || 'rgba(120,140,180,0.12)')
        .attr('stroke-width', 0.5);
    }

    // tooltip
    let tip = el.querySelector('.dtmap-tip');
    if (!tip) {
      tip = document.createElement('div');
      tip.className = 'dtmap-tip';
      tip.style.cssText = 'position:absolute;pointer-events:none;opacity:0;transition:opacity .12s;z-index:20;';
      el.appendChild(tip);
    }

    const fmt = (n) => (n >= 0 ? '+' : '') + n.toFixed(2);
    function tipHtml(c) {
      const fl = `<img class="dtmap-tip-flag" src="https://flagcdn.com/w40/${c.iso2.toLowerCase()}.png" alt="${c.name}" width="34" style="border-radius:3px;display:block" />`;
      return `${fl}
        <div class="dtmap-tip-body">
          <div class="dtmap-tip-name">${c.name}</div>
          <div class="dtmap-tip-meta"><span>#${c.composite.rankOverall} overall</span><span>#${c.composite.rankContinent} in ${c.continent}</span></div>
          <div class="dtmap-tip-score">${fmt(c.composite.score)}<span>index score</span></div>
        </div>`;
    }
    function move(ev) {
      const b = el.getBoundingClientRect();
      let x = ev.clientX - b.left + 16;
      let y = ev.clientY - b.top + 16;
      const tw = tip.offsetWidth, th = tip.offsetHeight;
      if (x + tw > b.width) x = ev.clientX - b.left - tw - 16;
      if (y + th > b.height) y = ev.clientY - b.top - th - 16;
      tip.style.left = x + 'px'; tip.style.top = y + 'px';
    }

    const indexed = new Set();
    function bind(sel) {
      sel.on('mousemove', function (ev, d) {
        const c = d.__country; if (!c) return;
        tip.innerHTML = tipHtml(c); tip.style.opacity = '1'; move(ev);
      }).on('mouseleave', function () { tip.style.opacity = '0'; })
        .on('click', function (ev, d) {
          const c = d.__country; if (!c || !opts.countryHref) return;
          window.location.href = opts.countryHref(c);
        });
    }

    // context + indexed paths
    const ctxNodes = [], hotNodes = [];
    countries.forEach(f => {
      const iso3 = NAME_TO_ISO3[f.properties.name];
      const c = iso3 ? byIso[iso3] : null;
      if (c) { f.__country = c; indexed.add(iso3); hotNodes.push(f); }
      else ctxNodes.push(f);
    });

    g.append('g').selectAll('path').data(ctxNodes).join('path')
      .attr('d', path).attr('fill', opts.contextFill || '#eceff4')
      .attr('stroke', opts.contextStroke || '#dfe4ec').attr('stroke-width', 0.5);

    const hot = g.append('g').selectAll('path').data(hotNodes).join('path')
      .attr('d', path)
      .attr('fill', d => color(d.__country.composite.score))
      .attr('stroke', opts.stroke || '#fff').attr('stroke-width', 0.7)
      .attr('cursor', opts.countryHref ? 'pointer' : 'default')
      .style('transition', 'fill .15s, stroke-width .15s');
    hot.on('mouseenter', function () { d3.select(this).attr('stroke-width', 1.6).raise(); })
       .on('mouseleave', function () { d3.select(this).attr('stroke-width', 0.7); });
    bind(hot);

    // borders overlay
    g.append('path').datum(borders).attr('d', path)
      .attr('fill', 'none').attr('stroke', opts.stroke || '#fff')
      .attr('stroke-width', 0.4).attr('opacity', 0.6).attr('pointer-events', 'none');

    // fallback markers for tiny/missing states
    data.countries.forEach(c => {
      if (indexed.has(c.iso3)) return;
      const coord = FALLBACK[c.iso3];
      if (!coord) return;
      const p = projection(coord); if (!p) return;
      const node = g.append('circle')
        .attr('cx', p[0]).attr('cy', p[1]).attr('r', 5)
        .attr('fill', color(c.composite.score))
        .attr('stroke', opts.stroke || '#fff').attr('stroke-width', 1.2)
        .attr('cursor', opts.countryHref ? 'pointer' : 'default');
      node.each(function () { this.__data__ = { __country: c }; });
      node.on('mousemove', function (ev) { tip.innerHTML = tipHtml(c); tip.style.opacity = '1'; move(ev); })
        .on('mouseleave', function () { tip.style.opacity = '0'; })
        .on('mouseenter', function () { d3.select(this).attr('r', 7); })
        .on('click', function () { if (opts.countryHref) window.location.href = opts.countryHref(c); });
    });

    if (opts.onReady) opts.onReady({ color, min, max });
    return { color, min, max };
  }

  window.DeeptechMap = { render, loadTopo };
})();
