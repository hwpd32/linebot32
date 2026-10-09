/* charts.js — กราฟ SVG ขนาดเล็กสำหรับหน้าสรุป (ไม่ใช้ไลบรารีภายนอก ทำงานออฟไลน์ในเว็บวิวของไลน์) */
(function () {
  var NS = 'http://www.w3.org/2000/svg';
  // ชุดสีเดียวกันทั้งหน้า: ใบสั่ง = น้ำเงิน, ขนส่ง = ส้ม, รถยนต์ = ฟ้า, จราจร = ม่วง, ว.42 = เขียวเข้ม, ช่วยเหลือ = เขียวอ่อน, จับกุม = แดง
  var C = { ticket: '#1f5fbf', T: '#e8812b', C: '#4ea1e6', R: '#8b5cf6', escort: '#0f7a5c', assist: '#5fb779', arrest: '#d64545', warning: '#9aa6b5', muted: '#94a3b8', grid: '#e5e9f0', ink: '#1e293b' };
  function el(tag, attrs, text) { var e = document.createElementNS(NS, tag); Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); }); if (text != null) e.textContent = text; return e; }
  function svg(w, h) { var s = el('svg', { viewBox: '0 0 ' + w + ' ' + h, width: '100%', role: 'img' }); s.style.display = 'block'; s.style.height = 'auto'; return s; }
  function niceMax(v) { if (v <= 0) return 1; var p = Math.pow(10, Math.floor(Math.log10(v))), m = v / p; var n = m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10; return n * p; }
  function fmt(n) { return (Math.round(n * 10) / 10).toLocaleString('th-TH'); }
  function legend(items) {
    var d = document.createElement('div'); d.className = 'chart-legend';
    items.forEach(function (it) { var s = document.createElement('span'); var dot = document.createElement('i'); dot.style.background = it[1]; s.appendChild(dot); s.appendChild(document.createTextNode(it[0])); d.appendChild(s); });
    return d;
  }
  function empty(msg) { var d = document.createElement('p'); d.className = 'muted small center'; d.textContent = msg || 'ยังไม่มีข้อมูลในช่วงนี้'; return d; }

  /** กราฟเส้นรายวัน: series = [{key,label,color}], rows = [{label, values:{key:n}}] */
  function lineChart(rows, series, opts) {
    opts = opts || {};
    var W = 360, H = opts.height || 170, L = 30, R = 8, T = 10, B = 26;
    if (!rows.length) return empty();
    var max = 0; rows.forEach(function (r) { series.forEach(function (s) { max = Math.max(max, +r.values[s.key] || 0); }); });
    var ymax = niceMax(max), s = svg(W, H), iw = W - L - R, ih = H - T - B;
    var x = function (i) { return rows.length === 1 ? L + iw / 2 : L + (i * iw) / (rows.length - 1); }, y = function (v) { return T + ih - (v / ymax) * ih; };
    [0, 0.5, 1].forEach(function (f) { var yy = y(ymax * f); s.appendChild(el('line', { x1: L, x2: W - R, y1: yy, y2: yy, stroke: C.grid })); s.appendChild(el('text', { x: L - 4, y: yy + 4, 'text-anchor': 'end', 'font-size': 10, fill: C.muted }, fmt(ymax * f))); });
    var step = Math.ceil(rows.length / 6);
    rows.forEach(function (r, i) { if (i % step === 0 || i === rows.length - 1) s.appendChild(el('text', { x: x(i), y: H - 8, 'text-anchor': 'middle', 'font-size': 10, fill: C.muted }, r.label)); });
    series.forEach(function (sr) {
      var pts = rows.map(function (r, i) { return x(i) + ',' + y(+r.values[sr.key] || 0); });
      if (rows.length > 1) s.appendChild(el('polyline', { points: pts.join(' '), fill: 'none', stroke: sr.color, 'stroke-width': 2.2, 'stroke-linejoin': 'round' }));
      rows.forEach(function (r, i) { var v = +r.values[sr.key] || 0; var c = el('circle', { cx: x(i), cy: y(v), r: rows.length > 20 ? 2 : 3, fill: sr.color }); c.appendChild(el('title', {}, r.label + ' · ' + sr.label + ' ' + v)); s.appendChild(c); });
    });
    var wrap = document.createElement('div'); wrap.appendChild(s); wrap.appendChild(legend(series.map(function (sr) { return [sr.label, sr.color]; })));
    return wrap;
  }

  /** แท่งแนวนอน (เรียงจากมาก→น้อย) อาจซ้อนหลายชุด: rows = [{label, values:{key:n}, sub?}] */
  function hbarChart(rows, series, opts) {
    opts = opts || {};
    if (!rows.length) return empty();
    var W = 360, rowH = 26, L = opts.labelW || 92, R = 36, s, H = rows.length * rowH + 6;
    var max = 0; rows.forEach(function (r) { var t = 0; series.forEach(function (sr) { t += +r.values[sr.key] || 0; }); max = Math.max(max, t); });
    var xmax = niceMax(max) || 1, iw = W - L - R; s = svg(W, H);
    rows.forEach(function (r, i) {
      var y = i * rowH + 4, x0 = L, total = 0;
      s.appendChild(el('text', { x: L - 6, y: y + 15, 'text-anchor': 'end', 'font-size': 12, fill: C.ink }, r.label));
      series.forEach(function (sr) {
        var v = +r.values[sr.key] || 0; if (!v) return; var w = (v / xmax) * iw;
        var rect = el('rect', { x: x0, y: y + 3, width: Math.max(w, 1), height: rowH - 10, rx: 4, fill: sr.color }); rect.appendChild(el('title', {}, r.label + ' · ' + sr.label + ' ' + v)); s.appendChild(rect);
        if (w > 22 && series.length > 1) s.appendChild(el('text', { x: x0 + w / 2, y: y + 15, 'text-anchor': 'middle', 'font-size': 10, fill: '#fff' }, v));
        x0 += w; total += v;
      });
      s.appendChild(el('text', { x: x0 + 5, y: y + 15, 'font-size': 12, 'font-weight': 700, fill: C.ink }, fmt(total)));
    });
    var wrap = document.createElement('div'); wrap.appendChild(s);
    if (series.length > 1) wrap.appendChild(legend(series.map(function (sr) { return [sr.label, sr.color]; })));
    return wrap;
  }

  /** แท่งแนวตั้งกลุ่ม: rows = [{label, values}], series */
  function barChart(rows, series, opts) {
    opts = opts || {};
    if (!rows.length) return empty();
    var W = 360, H = opts.height || 170, L = 30, R = 8, T = 10, B = 26, iw = W - L - R, ih = H - T - B;
    var max = 0; rows.forEach(function (r) { series.forEach(function (sr) { max = Math.max(max, +r.values[sr.key] || 0); }); });
    var ymax = niceMax(max), s = svg(W, H), gw = iw / rows.length, bw = Math.min(26, (gw - 8) / series.length);
    [0, 0.5, 1].forEach(function (f) { var yy = T + ih - f * ih; s.appendChild(el('line', { x1: L, x2: W - R, y1: yy, y2: yy, stroke: C.grid })); s.appendChild(el('text', { x: L - 4, y: yy + 4, 'text-anchor': 'end', 'font-size': 10, fill: C.muted }, fmt(ymax * f))); });
    rows.forEach(function (r, i) {
      var cx = L + gw * i + gw / 2, x0 = cx - (bw * series.length) / 2;
      series.forEach(function (sr, j) {
        var v = +r.values[sr.key] || 0, hh = (v / ymax) * ih;
        var rect = el('rect', { x: x0 + j * bw + 1, y: T + ih - hh, width: bw - 2, height: hh, rx: 3, fill: sr.color }); rect.appendChild(el('title', {}, r.label + ' · ' + sr.label + ' ' + v)); s.appendChild(rect);
        if (v) s.appendChild(el('text', { x: x0 + j * bw + bw / 2, y: T + ih - hh - 3, 'text-anchor': 'middle', 'font-size': 10, fill: C.ink }, v));
      });
      s.appendChild(el('text', { x: cx, y: H - 8, 'text-anchor': 'middle', 'font-size': 11, fill: C.muted }, r.label));
    });
    var wrap = document.createElement('div'); wrap.appendChild(s); wrap.appendChild(legend(series.map(function (sr) { return [sr.label, sr.color]; })));
    return wrap;
  }

  /** แถบสัดส่วน 100% + รายการ (แทนกราฟวงกลม อ่านง่ายกว่าบนจอเล็ก): items = [{label, value, color?}] */
  function shareChart(items, palette) {
    items = items.filter(function (x) { return x.value > 0; }).sort(function (a, b) { return b.value - a.value; });
    if (!items.length) return empty();
    var total = items.reduce(function (a, x) { return a + x.value; }, 0), pal = palette || ['#1f5fbf', '#e8812b', '#0f7a5c', '#8b5cf6', '#d64545', '#4ea1e6', '#5fb779', '#f2c94c', '#9aa6b5', '#c084fc'];
    var wrap = document.createElement('div'), bar = document.createElement('div'); bar.className = 'share-bar';
    items.forEach(function (x, i) { var seg = document.createElement('span'); seg.style.width = (x.value * 100 / total) + '%'; seg.style.background = x.color || pal[i % pal.length]; seg.title = x.label + ' ' + x.value; bar.appendChild(seg); });
    wrap.appendChild(bar);
    var list = document.createElement('div'); list.className = 'share-list';
    items.slice(0, 10).forEach(function (x, i) {
      var row = document.createElement('div'); row.className = 'share-row';
      var dot = document.createElement('i'); dot.style.background = x.color || pal[i % pal.length];
      var lb = document.createElement('span'); lb.className = 'lb'; lb.textContent = x.label;
      var n = document.createElement('b'); n.textContent = x.value + ' (' + Math.round(x.value * 100 / total) + '%)';
      row.appendChild(dot); row.appendChild(lb); row.appendChild(n); list.appendChild(row);
    });
    wrap.appendChild(list);
    return wrap;
  }

  /** มาตรวัดร้อยละ (วินัยการรายงาน) */
  function gauge(pct, label) {
    var wrap = document.createElement('div'); wrap.className = 'gauge';
    var track = document.createElement('div'); track.className = 'gauge-track';
    var fill = document.createElement('div'); fill.className = 'gauge-fill'; fill.style.width = Math.max(0, Math.min(100, pct)) + '%'; fill.style.background = pct >= 95 ? C.escort : pct >= 80 ? C.T : C.arrest;
    track.appendChild(fill); wrap.appendChild(track);
    var t = document.createElement('div'); t.className = 'gauge-label'; t.textContent = label; wrap.appendChild(t);
    return wrap;
  }

  window.Charts = { line: lineChart, hbar: hbarChart, bar: barChart, share: shareChart, gauge: gauge, COLORS: C };
})();
