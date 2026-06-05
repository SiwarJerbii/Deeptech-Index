/* Lightweight, dependency-free SVG charts for the Deeptech Index.
   DTCharts.radar(el, opts) and DTCharts.bars(el, opts).
   Designed for z-scores (can be negative); a zero reference is emphasised. */
(function () {
  const NS = 'http://www.w3.org/2000/svg';
  const el = (t, a) => { const n = document.createElementNS(NS, t); for (const k in (a || {})) n.setAttribute(k, a[k]); return n; };

  // On-brand categorical palette: blue-led, extends to distinct hues for 4-6 series.
  const PALETTE = ['#1d4ed8', '#0e9bb0', '#7c3aed', '#e07a1f', '#15803d', '#be1e6b'];

  function ensureTip(host) {
    let tip = host.querySelector('.dtchart-tip');
    if (!tip) {
      tip = document.createElement('div');
      tip.className = 'dtchart-tip';
      tip.style.cssText = 'position:absolute;pointer-events:none;opacity:0;transition:opacity .12s;z-index:30;background:#0d1422;color:#fff;font:500 12px/1.4 "IBM Plex Mono",monospace;padding:8px 11px;border-radius:8px;box-shadow:0 10px 24px rgba(13,20,34,.28);white-space:nowrap;';
      host.appendChild(tip);
    }
    return tip;
  }
  function moveTip(host, tip, ev) {
    const b = host.getBoundingClientRect();
    let x = ev.clientX - b.left + 14, y = ev.clientY - b.top + 14;
    if (x + tip.offsetWidth > b.width) x = ev.clientX - b.left - tip.offsetWidth - 14;
    if (y + tip.offsetHeight > b.height) y = ev.clientY - b.top - tip.offsetHeight - 14;
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
  }
  const fmt = (n) => n === null || n === undefined ? '—' : (n >= 0 ? '+' : '') + (+n).toFixed(2);

  /* ---------------- RADAR ---------------- */
  function radar(host, opts) {
    host = typeof host === 'string' ? document.querySelector(host) : host;
    if (!host) return;
    const axes = opts.axes;                       // [{label}]
    const series = opts.series;                   // [{name,color,values:[]}]
    const n = axes.length;
    const W = opts.width || host.clientWidth || 460;
    const H = opts.height || W;
    const cx = W / 2, cy = H / 2 + 6;
    const pad = opts.labelPad || 78;
    const R = Math.min(W, H) / 2 - pad;
    const dmin = opts.domain ? opts.domain[0] : -1.5;
    const dmax = opts.domain ? opts.domain[1] : 2.5;
    const rings = opts.rings || 4;
    const ink3 = '#73809a', line = '#e3e8f0';

    host.style.position = host.style.position || 'relative';
    host.innerHTML = '';
    const tip = ensureTip(host);
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', height: '100%', style: 'display:block;overflow:visible' });

    const ang = (i) => (-Math.PI / 2) + i * (2 * Math.PI / n);
    const rad = (v) => R * Math.max(0, Math.min(1, (v - dmin) / (dmax - dmin)));
    const pt = (i, v) => [cx + Math.cos(ang(i)) * rad(v), cy + Math.sin(ang(i)) * rad(v)];

    // rings
    for (let r = 1; r <= rings; r++) {
      const frac = r / rings, val = dmin + frac * (dmax - dmin);
      const pts = axes.map((_, i) => { const rr = R * frac; return [cx + Math.cos(ang(i)) * rr, cy + Math.sin(ang(i)) * rr].join(','); }).join(' ');
      const isZero = Math.abs(val) < 1e-9;
      svg.appendChild(el('polygon', { points: pts, fill: 'none', stroke: line, 'stroke-width': 1 }));
    }
    // zero ring emphasised (panel average)
    if (dmin < 0 && dmax > 0) {
      const pts = axes.map((_, i) => pt(i, 0).join(',')).join(' ');
      svg.appendChild(el('polygon', { points: pts, fill: 'none', stroke: '#9fb0cc', 'stroke-width': 1.4, 'stroke-dasharray': '4 4' }));
    }
    // spokes + labels
    axes.forEach((a, i) => {
      const o = pt(i, dmax);
      svg.appendChild(el('line', { x1: cx, y1: cy, x2: o[0], y2: o[1], stroke: line, 'stroke-width': 1 }));
      const lx = cx + Math.cos(ang(i)) * (R + 20), ly = cy + Math.sin(ang(i)) * (R + 20);
      const anchor = Math.abs(Math.cos(ang(i))) < 0.3 ? 'middle' : (Math.cos(ang(i)) > 0 ? 'start' : 'end');
      const t = el('text', { x: lx, y: ly, 'text-anchor': anchor, 'dominant-baseline': 'middle', fill: '#3d4860', 'font-family': 'Space Grotesk, sans-serif', 'font-size': 12.5, 'font-weight': 600 });
      t.textContent = a.label;
      svg.appendChild(t);
    });

    // series polygons
    series.forEach((s, si) => {
      const color = s.color || PALETTE[si % PALETTE.length];
      const pts = s.values.map((v, i) => pt(i, v == null ? dmin : v).join(',')).join(' ');
      svg.appendChild(el('polygon', { points: pts, fill: color, 'fill-opacity': series.length > 1 ? 0.1 : 0.16, stroke: color, 'stroke-width': 2, 'stroke-linejoin': 'round' }));
    });
    // dots on top
    series.forEach((s, si) => {
      const color = s.color || PALETTE[si % PALETTE.length];
      s.values.forEach((v, i) => {
        if (v == null) return;
        const p = pt(i, v);
        const c = el('circle', { cx: p[0], cy: p[1], r: 3.6, fill: '#fff', stroke: color, 'stroke-width': 2, style: 'cursor:pointer' });
        c.addEventListener('mousemove', (ev) => { tip.innerHTML = `${s.name} · ${axes[i].label}: <b style="color:#7da6f5">${fmt(v)}</b>`; tip.style.opacity = 1; moveTip(host, tip, ev); });
        c.addEventListener('mouseleave', () => tip.style.opacity = 0);
        svg.appendChild(c);
      });
    });
    host.appendChild(svg);
  }

  /* ---------------- BARS ---------------- */
  // opts: { categories:[labels], series:[{name,color,values}], domain, horizontal, valueLabels }
  function bars(host, opts) {
    host = typeof host === 'string' ? document.querySelector(host) : host;
    if (!host) return;
    const cats = opts.categories, series = opts.series;
    const horizontal = !!opts.horizontal;
    host.style.position = host.style.position || 'relative';
    host.innerHTML = '';
    const tip = ensureTip(host);

    // domain
    let lo = Infinity, hi = -Infinity;
    series.forEach(s => s.values.forEach(v => { if (v == null) return; lo = Math.min(lo, v); hi = Math.max(hi, v); }));
    if (opts.domain) { lo = opts.domain[0]; hi = opts.domain[1]; }
    else { lo = Math.min(0, lo) - 0.15; hi = Math.max(0, hi) + 0.25; }
    const line = '#e3e8f0', ink3 = '#73809a';

    const W = opts.width || host.clientWidth || 700;
    if (horizontal) {
      const rowH = opts.rowH || 34, gap = 10, padL = opts.padL || 132, padR = 56, padT = 8, padB = 22;
      const H = padT + padB + cats.length * (rowH + gap);
      const innerW = W - padL - padR;
      const x = (v) => padL + ((v - lo) / (hi - lo)) * innerW;
      const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', height: H, style: 'display:block' });
      // zero line
      const zx = x(0);
      svg.appendChild(el('line', { x1: zx, y1: padT, x2: zx, y2: H - padB, stroke: '#9fb0cc', 'stroke-width': 1.2 }));
      const zt = el('text', { x: zx, y: H - 6, 'text-anchor': 'middle', fill: ink3, 'font-family': 'IBM Plex Mono, monospace', 'font-size': 10 }); zt.textContent = '0'; svg.appendChild(zt);
      cats.forEach((cat, i) => {
        const y = padT + i * (rowH + gap);
        const s = series[0]; const v = s.values[i];
        const color = (s.colors && s.colors[i]) || s.color || PALETTE[0];
        // label
        const lab = el('text', { x: padL - 12, y: y + rowH / 2, 'text-anchor': 'end', 'dominant-baseline': 'middle', fill: '#3d4860', 'font-family': 'IBM Plex Sans, sans-serif', 'font-size': 12.5 });
        lab.textContent = cat; svg.appendChild(lab);
        if (v == null) { const t = el('text', { x: zx + 8, y: y + rowH / 2, 'dominant-baseline': 'middle', fill: ink3, 'font-family': 'IBM Plex Mono', 'font-size': 11 }); t.textContent = 'n/a'; svg.appendChild(t); return; }
        const bx = Math.min(zx, x(v)), bw = Math.abs(x(v) - zx);
        const r = el('rect', { x: bx, y: y + 3, width: Math.max(1, bw), height: rowH - 6, rx: 3, fill: color, style: 'cursor:pointer;transition:opacity .12s' });
        r.addEventListener('mousemove', (ev) => { tip.innerHTML = `${cat}: <b style="color:#7da6f5">${fmt(v)}</b>`; tip.style.opacity = 1; moveTip(host, tip, ev); });
        r.addEventListener('mouseleave', () => tip.style.opacity = 0);
        svg.appendChild(r);
        const vt = el('text', { x: v >= 0 ? x(v) + 7 : x(v) - 7, y: y + rowH / 2, 'text-anchor': v >= 0 ? 'start' : 'end', 'dominant-baseline': 'middle', fill: '#0d1422', 'font-family': 'Space Grotesk', 'font-size': 12, 'font-weight': 600 });
        vt.textContent = fmt(v); svg.appendChild(vt);
      });
      host.appendChild(svg);
      return;
    }

    // vertical grouped
    const padL = 40, padR = 12, padT = 14, padB = 46;
    const H = opts.height || 360;
    const innerH = H - padT - padB, innerW = W - padL - padR;
    const y = (v) => padT + (1 - (v - lo) / (hi - lo)) * innerH;
    const gw = innerW / cats.length;        // group width
    const ns = series.length;
    const bw = Math.min(opts.maxBar || 46, (gw * 0.7) / ns);
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', height: H, style: 'display:block' });
    // gridlines (at 0 and a few ticks)
    const ticks = niceTicks(lo, hi, 5);
    ticks.forEach(t => {
      const yy = y(t);
      svg.appendChild(el('line', { x1: padL, y1: yy, x2: W - padR, y2: yy, stroke: Math.abs(t) < 1e-9 ? '#9fb0cc' : line, 'stroke-width': Math.abs(t) < 1e-9 ? 1.2 : 1 }));
      const tl = el('text', { x: padL - 8, y: yy, 'text-anchor': 'end', 'dominant-baseline': 'middle', fill: ink3, 'font-family': 'IBM Plex Mono', 'font-size': 10 });
      tl.textContent = (t > 0 ? '+' : '') + t.toFixed(1); svg.appendChild(tl);
    });
    cats.forEach((cat, ci) => {
      const gx = padL + ci * gw;
      const groupW = bw * ns;
      const startX = gx + (gw - groupW) / 2;
      series.forEach((s, si) => {
        const v = s.values[ci];
        const color = s.color || PALETTE[si % PALETTE.length];
        const bx = startX + si * bw;
        if (v == null) return;
        const y0 = y(0), yv = y(v);
        const r = el('rect', { x: bx + 1, y: Math.min(y0, yv), width: bw - 2, height: Math.max(1, Math.abs(yv - y0)), rx: 2.5, fill: color, style: 'cursor:pointer' });
        r.addEventListener('mousemove', (ev) => { tip.innerHTML = `${s.name} · ${cat}: <b style="color:#7da6f5">${fmt(v)}</b>`; tip.style.opacity = 1; moveTip(host, tip, ev); });
        r.addEventListener('mouseleave', () => tip.style.opacity = 0);
        svg.appendChild(r);
      });
      const cl = el('text', { x: gx + gw / 2, y: H - padB + 18, 'text-anchor': 'middle', fill: '#3d4860', 'font-family': 'Space Grotesk', 'font-size': 12, 'font-weight': 500 });
      cl.textContent = cat; svg.appendChild(cl);
    });
    host.appendChild(svg);
  }

  function niceTicks(lo, hi, count) {
    const span = hi - lo, step0 = span / count;
    const mag = Math.pow(10, Math.floor(Math.log10(step0)));
    const norm = step0 / mag;
    const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
    const start = Math.ceil(lo / step) * step;
    const out = [];
    for (let v = start; v <= hi + 1e-9; v += step) out.push(Math.round(v * 100) / 100);
    if (!out.some(v => Math.abs(v) < 1e-9) && lo < 0 && hi > 0) out.push(0);
    return out;
  }

  window.DTCharts = { radar, bars, PALETTE };
})();
