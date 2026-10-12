/* LineBot ส.ทล.2 กก.3 บก.ทล. — หน้าเว็บ LIFF (JavaScript ล้วน ไม่มีข้อมูลลับ) */
(function () {
  'use strict';
  var CFG = window.APP_CONFIG || {};
  var S = { boot: null, params: {}, idToken: '', uid: '', stack: [] };
  var $app = document.getElementById('app');

  // ---------- ตัวช่วย DOM (ใช้ textContent เสมอ กันการฝังสคริปต์) ----------
  function h(tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'style') el.setAttribute('style', v);
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
      else if (k === 'value') el.value = v;
      else if (k === 'checked' || k === 'disabled' || k === 'selected' || k === 'hidden') el[k] = !!v;
      else el.setAttribute(k, v);
    });
    for (var i = 2; i < arguments.length; i++) add(el, arguments[i]);
    return el;
  }
  function add(el) {
    for (var i = 1; i < arguments.length; i++) {
      var c = arguments[i];
      if (c == null || c === false) continue;
      if (Array.isArray(c)) { c.forEach(function (x) { add(el, x); }); continue; }
      el.appendChild(typeof c === 'object' ? c : document.createTextNode(String(c)));
    }
    return el;
  }
  function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }
  function toast(t, ms) { var el = document.getElementById('toast'); el.textContent = t; el.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(function () { el.classList.remove('show'); }, ms || 2600); }
  function setTitle(t, sub) { document.getElementById('title').textContent = t; document.getElementById('subtitle').textContent = sub || ''; document.title = t; }
  function spinner() {
    var el = h('div', { class: 'spin' });
    // สำรองกรณี CSS animation ไม่ทำงานในเว็บวิวบางรุ่น — หมุนด้วย JS ขณะยังอยู่บนหน้า
    var deg = 0, t0 = Date.now();
    (function tick() { if (!el.isConnected && Date.now() - t0 > 2000) return; deg = (deg + 12) % 360; el.style.transform = 'rotate(' + deg + 'deg)'; setTimeout(tick, 40); })();
    return el;
  }
  function skeleton(n) { var w = h('div', { class: 'skel' }); for (var i = 0; i < (n || 3); i++) add(w, h('div', { class: 'skel-card' }, h('div', { class: 'skel-line w60' }), h('div', { class: 'skel-line' }), h('div', { class: 'skel-line w80' }))); return w; }
  function loading(msg) { clear($app); add($app, h('div', { class: 'loading' }, spinner(), h('p', { text: msg || 'กำลังโหลด…' })), skeleton(2)); }
  function errorBox(msg) { return h('div', { class: 'err', text: '⚠️ ' + msg }); }
  function card(title, right) { var c = h('div', { class: 'card' }); if (title) add(c, h('h3', null, title, right ? h('span', { class: 'right' }, right) : null)); return c; }
  function bar() { var b = h('div', { class: 'bar' }); add(b, Array.prototype.slice.call(arguments)); return b; }

  // ---------- วันที่ ----------
  var TH_M = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function bkkNow() { return new Date(Date.now() + (7 * 60 + new Date().getTimezoneOffset()) * 60000); }
  function isoOf(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function today() { return isoOf(bkkNow()); }
  function addDays(iso, n) { var p = iso.split('-'); var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]) + n * 864e5); return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()); }
  function th(iso) { if (!iso) return ''; var p = iso.split('-'); return (+p[2]) + ' ' + TH_M[+p[1] - 1] + String(+p[0] + 543).slice(2); }
  function hm(isoTime) { return isoTime ? String(isoTime).slice(11, 16) : ''; }
  function cycleOf(iso) {
    var d = +iso.slice(8, 10), n = d <= 10 ? 1 : d <= 20 ? 2 : 3, y = +iso.slice(0, 4), m = +iso.slice(5, 7);
    var last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return { from: iso.slice(0, 8) + (n === 1 ? '01' : n === 2 ? '11' : '21'), to: iso.slice(0, 8) + (n === 1 ? '10' : n === 2 ? '20' : pad(last)) };
  }
  var SHIFT = { D: { label: 'กลางวัน', icon: '☀️' }, N: { label: 'กลางคืน', icon: '🌙' } };

  // ---------- API ----------
  // จำกัดเวลารอ — กันหน้าจอหมุนค้างไม่รู้จบเมื่อสัญญาณ/LINE/เซิร์ฟเวอร์ไม่ตอบ
  function withTimeout(p, ms, msg) {
    var t; return Promise.race([p, new Promise(function (_, rej) { t = setTimeout(function () { var e = new Error(msg); e.code = 'TIMEOUT'; rej(e); }, ms); })])
      .then(function (v) { clearTimeout(t); return v; }, function (e) { clearTimeout(t); throw e; });
  }
  function stage(msg) { window.__stage = msg; var p = $app.querySelector('.loading p'); if (p) p.textContent = msg; }
  // แคชคำตอบระยะสั้นสำหรับคำขออ่านอย่างเดียว (เปิดหน้าเดิมซ้ำไม่ต้องรอเซิร์ฟเวอร์) + รวมคำขอซ้ำที่กำลังรอ
  // คำขออ่านอย่างเดียว: ไม่ล้างแคช · ลองใหม่อัตโนมัติ 1 ครั้งเมื่อเน็ตสะดุด/ตอบช้า (คำขอบันทึกไม่ลองซ้ำเอง)
  var READS = {}; ['bootstrap', 'dash', 'home', 'shift.list', 'shift.get', 'arrest.list', 'arrest.detail', 'history.list', 'history.timeline', 'duty.board', 'duty.week', 'daily.report', 'fine.dash', 'fine.badges',
    'now', 'summary', 'texts', 'roster.day', 'admin.people', 'admin.meta', 'codes.list', 'admin.registrations', 'score.get', 'score.text', 'admin.audit', 'settings.get', 'export.daily', 'export.events',
    'escort.open', 'file.list', 'suspect.search'].forEach(function (a) { READS[a] = 1; });
  // ---------- บัตรผ่านของระบบ (v1.13): ใช้แทน ID token ของ LINE ที่หมดอายุเร็ว อายุ 24 ชม. ----------
  var SESS_KEY = 'sess:' + (CFG.LIFF_ID || '');
  function sessExp(t) { try { return JSON.parse(decodeURIComponent(escape(atob(String(t).split('.')[0].replace(/-/g, '+').replace(/_/g, '/'))))).e * 1000; } catch (e) { return 0; } }
  function sessLoad(uid) { try { var j = JSON.parse(localStorage.getItem(SESS_KEY) || 'null'); if (j && j.uid === uid && sessExp(j.t) > Date.now() + 300000) S.sess = j.t; } catch (e) { } }
  function sessSave(t) { S.sess = t; try { if (S.uid) localStorage.setItem(SESS_KEY, JSON.stringify({ uid: S.uid, t: t })); } catch (e) { } }
  function sessClear() { S.sess = null; try { localStorage.removeItem(SESS_KEY); } catch (e) { } }
  function authLost() {
    if (authLost.shown) return; authLost.shown = true;
    var m = document.getElementById('modal'); clear(m); m.hidden = false;
    add(m, h('div', { class: 'sheet' }, h('h3', { text: '🔄 ต้องเชื่อมต่อใหม่' }),
      h('p', { class: 'small', text: 'การยืนยันตัวตนกับ LINE หมดอายุ (เปิดแอปค้างไว้นาน) — แตะปุ่มด้านล่าง ระบบจะเปิดหน้านี้ใหม่ภายในไม่กี่วินาที' }),
      h('button', { class: 'btn block', onclick: reconnect, text: '🔄 เชื่อมต่อใหม่' }),
      h('button', { class: 'btn gray block', style: 'margin-top:8px', onclick: function () { authLost.shown = false; closeModal(); }, text: 'ภายหลัง' })));
  }
  function reconnect() {
    try { sessionStorage.setItem('relogin', '0'); } catch (e) { }
    try { if (window.liff && liff.isLoggedIn()) liff.logout(); } catch (e) { }
    location.replace(location.href.replace(/[?#].*$/, '') + '?v=' + encodeURIComponent(S.view || 'home'));
  }
  var READ_TTL = { 'shift.get': 45000, now: 30000, summary: 60000, 'shift.list': 60000, 'arrest.list': 30000, 'admin.meta': 60000, 'score.get': 60000, 'score.text': 60000 };
  var apiCache = {}, inflight = {};
  function apiKey(action, data) { return action + ':' + JSON.stringify(data || {}); }
  function apiFresh(action, data) { var k = apiKey(action, data), c = apiCache[k]; return c && Date.now() - c.at < (READ_TTL[action] || 0) ? c.v : null; }
  function apiInvalidate() { apiCache = {}; }
  function api(action, data, opts) {
    var ttl = READ_TTL[action] || 0, k = apiKey(action, data);
    if (ttl && !(opts && opts.fresh)) {
      var hit = apiCache[k]; if (hit && Date.now() - hit.at < ttl) return Promise.resolve(hit.v);
      if (inflight[k]) return inflight[k];
    }
    if (!READS[action]) apiInvalidate(); // คำขอเขียน → ข้อมูลที่จำไว้อาจเก่า
    var p = apiTry(action, data).then(function (v) { if (ttl) apiCache[k] = { at: Date.now(), v: v }; delete inflight[k]; return v; }, function (e) {
      delete inflight[k];
      // ระบบพบรายการที่อาจซ้ำ → แสดงรายการเดิมให้ตรวจ แล้วให้ผู้ใช้ยืนยันก่อนบันทึก
      if (e.code === 'DUP' && e.dup && !(data && data.confirmDup)) return dupConfirm(e).then(function (yes) {
        if (!yes) { var x = new Error('ยกเลิกการบันทึก'); x.code = 'CANCEL'; throw x; }
        return api(action, Object.assign({}, data, { confirmDup: true }), opts);
      });
      throw e;
    });
    if (ttl) inflight[k] = p;
    return p;
  }
  // ---------- แสดงข้อมูลชุดล่าสุดที่เคยโหลดทันที แล้วอัปเดตตามหลัง (v1.13) ----------
  // เก็บในเครื่องของผู้ใช้ (ต่อบัญชี LINE) ไม่เกิน 40 ชุด/36 ชม. — ไม่เก็บข้อมูลคดี/ผู้ต้องหา · โหมดจำลองมุมมองไม่ใช้
  var SWR_PRE = 'swr1:' + (CFG.LIFF_ID || '') + ':', SWR_MAX_AGE = 36 * 3600000, SWR_MAX_N = 40;
  function swrKey(action, data) { var d = {}; Object.keys(data || {}).forEach(function (k) { if (k !== 'fresh') d[k] = data[k]; }); return SWR_PRE + (S.uid || '-') + ':' + action + ':' + JSON.stringify(d); }
  function swrGet(k) { try { var j = JSON.parse(localStorage.getItem(k) || 'null'); return j && Date.now() - j.at < SWR_MAX_AGE ? j : null; } catch (e) { return null; } }
  function swrPut(k, v) {
    try {
      var str = JSON.stringify({ at: Date.now(), v: v }); if (str.length > 300000) return;
      var idx = []; try { idx = JSON.parse(localStorage.getItem(SWR_PRE + 'idx') || '[]'); } catch (e) { }
      idx = idx.filter(function (x) { return x !== k; }); idx.push(k);
      while (idx.length > SWR_MAX_N) localStorage.removeItem(idx.shift());
      for (;;) { try { localStorage.setItem(k, str); break; } catch (e) { if (idx.length <= 1) throw e; localStorage.removeItem(idx.shift()); } }
      localStorage.setItem(SWR_PRE + 'idx', JSON.stringify(idx));
    } catch (e) { }
  }
  /** cb(v, meta) อาจถูกเรียก 2 ครั้ง: ข้อมูลที่จำไว้ (meta.stale) แล้วข้อมูลล่าสุด (ถ้าต่างกัน) · เปลี่ยนหน้าไปแล้วจะไม่วาดทับ */
  function live(action, data, cb, onErr) {
    var off = S.viewAs || !S.uid, seq = S.viewSeq, k = swrKey(action, data), c = off ? null : swrGet(k);
    if (c) { try { cb(c.v, { stale: true, at: c.at }); } catch (e) { } stalePill(c.at, 'loading'); }
    return api(action, data, { fresh: true }).then(function (v) {
      if (!off) swrPut(k, v);
      if (seq !== S.viewSeq) return;
      stalePill(null);
      if (!c || JSON.stringify(c.v) !== JSON.stringify(v)) cb(v, { stale: false });
    }, function (e) {
      if (seq !== S.viewSeq) return;
      if (c) stalePill(c.at, 'error'); else if (onErr) onErr(e);
    });
  }
  /** โหลดล่วงหน้าเงียบ ๆ (เก็บไว้ให้เปิดหน้าครั้งแรกขึ้นทันที) */
  function prefetch(action, data) { if (S.viewAs || !S.uid) return Promise.resolve(); var k = swrKey(action, data); return api(action, data, { fresh: true }).then(function (v) { swrPut(k, v); }, function () { }); }
  function stalePill(at, state) {
    var el = document.getElementById('stale');
    if (!el) { el = h('div', { id: 'stale', role: 'status' }); document.body.appendChild(el); }
    clear(el); el.hidden = !at; el.className = 'stale' + (state === 'error' ? ' err' : '');
    if (!at) return;
    var t = new Date(at), txt = 'ข้อมูลเมื่อ ' + pad(t.getHours()) + ':' + pad(t.getMinutes()) + ' น.';
    if (state === 'error') add(el, h('span', { text: '⚠️ ' + txt + ' · อัปเดตไม่สำเร็จ' }), h('button', { onclick: function () { stalePill(null); VIEWS[S.view](S.params); }, text: 'ลองใหม่' }));
    else add(el, h('i', { class: 'stale-dot' }), h('span', { text: txt + ' · กำลังอัปเดต…' }));
  }
  /** คำขออ่าน: เน็ตสะดุด/ตอบช้า → รอ 0.8 วินาทีแล้วลองใหม่เอง 1 ครั้ง */
  function apiTry(action, data) {
    return apiRaw(action, data).then(null, function (e) {
      if (!READS[action] || !window.__booted || (e.code !== 'TIMEOUT' && e.code !== 'NET')) throw e; // ช่วงเปิดแอปมีตัวกันค้าง + ปุ่มลองใหม่ของตัวเองอยู่แล้ว
      return new Promise(function (r) { setTimeout(r, 800); }).then(function () { return apiRaw(action, data); });
    });
  }
  // คำสั่งที่ประมวลผลนาน (รวบรวมข้อมูลหลายเดือน/สร้างไฟล์) รอได้นานกว่าปกติ
  var LONG_MS = { 'export.backup': 150000, 'fine.match': 170000, 'export.xlsx': 120000, 'export.pdf': 120000, 'file.upload': 170000, 'file.get': 120000, 'file.preview': 150000, 'file.confirm': 170000 };
  function apiRaw(action, data) {
    var ctl = window.AbortController ? new AbortController() : null;
    var req = fetch(CFG.API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: action, data: data || {}, idToken: S.idToken, sess: S.sess || undefined, viewAs: S.viewAs || undefined }), signal: ctl ? ctl.signal : undefined });
    var ms = LONG_MS[action] || CFG.API_TIMEOUT_MS || (READS[action] ? 15000 : 45000); // อ่าน: 15 วิ + ลองใหม่ 1 ครั้ง · บันทึก: รอได้ 45 วิ (อาจรอคิวล็อก)
    return withTimeout(req, ms, 'ระบบตอบช้าเกินไป (เกิน ' + Math.round(ms / 1000) + ' วินาที) กรุณากดลองใหม่').then(null, function (e) { if (ctl && e.code === 'TIMEOUT') ctl.abort(); throw e; })
      .then(function (r) { return r.json().catch(function () { throw new Error('ระบบตอบกลับผิดรูปแบบ (HTTP ' + r.status + ') กรุณาลองใหม่'); }); }, function (e) { if (e.code === 'TIMEOUT') throw e; var x = new Error('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสัญญาณแล้วลองใหม่'); x.code = 'NET'; throw x; })
      .then(function (j) {
        // คำขอถูกเปลี่ยนเป็น GET ระหว่างทาง (ได้คำตอบ health แทน) = ระบบยังไม่ได้ทำรายการ → แจ้งให้ลองใหม่ ไม่ถือว่าสำเร็จ
        if (j && j.app && j.version && !('data' in j) && !j.error) throw new Error('การเชื่อมต่อสะดุด ระบบยังไม่ได้รับรายการ กรุณากดลองใหม่');
        if (j.sess) sessSave(j.sess);
        if (j.ok) return j.data;
        if (j.code === 'AUTH') { sessClear(); authLost(); }
        var e = new Error(j.error || 'เกิดข้อผิดพลาด'); e.code = j.code; if (j.dup) e.dup = j.dup; throw e;
      });
  }
  var DUP_KIND = { shift: '🚓', escort: '🚔', assist: '🤝', arrest: '🚨', mission: '🎖️' };
  function dupConfirm(e) {
    return new Promise(function (res) {
      var m = document.getElementById('modal'); clear(m); m.hidden = false;
      var list = h('div', { class: 'dup-list' });
      e.dup.forEach(function (x) {
        add(list, h('div', { class: 'dup-it' }, h('b', { text: (DUP_KIND[x.kind] || '•') + ' ' + x.title }),
          h('small', { text: [x.car ? 'รถ ' + x.car : '', x.date ? th(x.date) + (x.shift && SHIFT[x.shift] ? ' ' + SHIFT[x.shift].label : '') : '', x.at && x.at.length > 12 ? hm(x.at) + ' น.' : '', x.by ? 'บันทึกโดย ' + x.by : ''].filter(String).join(' · ') }),
          x.why ? h('div', { class: 'dup-why', text: '⚠️ ' + x.why }) : null));
      });
      function fin(v) { m.hidden = true; clear(m); res(v); }
      add(m, h('div', { class: 'sheet' }, h('h3', { text: '⚠️ อาจเป็นการบันทึกซ้ำ' }),
        h('p', { class: 'muted small', style: 'margin:0 0 8px', text: 'มีรายการที่บันทึกไว้แล้วซึ่งคล้ายกัน — ตรวจก่อนว่าเป็นเรื่องเดียวกันหรือไม่' }), list,
        h('div', { class: 'row', style: 'margin-top:12px' }, h('button', { class: 'btn gray grow', onclick: function () { fin(false); }, text: '✋ ไม่บันทึก' }),
          h('button', { class: 'btn amber grow', onclick: function () { fin(true); }, text: 'ไม่ซ้ำ บันทึกต่อ' })),
        h('button', { class: 'btn ghost block', style: 'margin-top:8px', onclick: function () { fin(false); go('history'); }, text: '📝 ดูรายการที่ส่งแล้ว' })));
      m.onclick = function (ev) { if (ev.target === m) fin(false); };
    });
  }
  function can(cap) { return !!(S.boot && S.boot.perms && S.boot.perms.caps[cap]); }
  function person(pid) { var ps = S.boot.people; for (var i = 0; i < ps.length; i++) if (ps[i].pid === pid) return ps[i]; return { pid: pid, short: pid, name: pid }; }

  // ---------- ส่งข้อความเข้ากลุ่ม (ในนามผู้รายงาน — ไม่เสียโควตาบอท) ----------
  function postToChat(text) {
    var msg = [{ type: 'text', text: text.slice(0, 4900) }];
    var ctx = window.liff && liff.getContext ? liff.getContext() : null;
    var inGroup = ctx && (ctx.type === 'group' || ctx.type === 'room');
    var p = Promise.resolve(null);
    if (inGroup && liff.isInClient && liff.isInClient()) {
      p = liff.sendMessages(msg).then(function () { return 'sent'; }, function () { return null; });
    }
    return p.then(function (r) {
      if (r) return r;
      if (window.liff && liff.isApiAvailable && liff.isApiAvailable('shareTargetPicker')) {
        return liff.shareTargetPicker(msg).then(function (res) { return res ? 'shared' : 'cancel'; }, function () { return copyText(text).then(function () { return 'copied'; }); });
      }
      return copyText(text).then(function () { return 'copied'; });
    });
  }
  function copyText(t) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(t).catch(function () { fallbackCopy(t); });
    fallbackCopy(t); return Promise.resolve();
  }
  function fallbackCopy(t) { var ta = h('textarea', { style: 'position:fixed;opacity:0' }); ta.value = t; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch (e) { } document.body.removeChild(ta); }
  function closeOrHome() { if (window.liff && liff.isInClient && liff.isInClient()) liff.closeWindow(); else go('home', {}, true); }
  function openExternal(url) { if (window.liff && liff.openWindow) liff.openWindow({ url: url, external: true }); else window.open(url, '_blank', 'noopener'); }
  /** เก็บร่างแบบฟอร์มในเครื่อง (หายเมื่อส่งสำเร็จหรือเกิน 24 ชม.) — ใช้ try/catch เพราะบางเบราว์เซอร์ปิด storage */
  var Draft = {
    get: function (k) { try { var o = JSON.parse(localStorage.getItem('draft:' + k) || 'null'); return o && Date.now() - o.t < 864e5 ? o.v : null; } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem('draft:' + k, JSON.stringify({ t: Date.now(), v: v })); } catch (e) { } },
    del: function (k) { try { localStorage.removeItem('draft:' + k); } catch (e) { } }
  };

  /** หน้าแสดงผลหลังบันทึก + ส่งข้อความขึ้นกลุ่ม */
  function done(title, message, opts) {
    opts = opts || {};
    clear($app);
    var status = h('p', { class: 'muted', text: 'กำลังส่งข้อความเข้ากลุ่ม…' });
    add($app, h('div', { class: 'card success' }, h('div', { class: 'big', text: '✅' }), h('h2', { text: title }), status, opts.extra || null),
      card('ข้อความที่ส่ง', h('button', { class: 'btn ghost sm', onclick: function () { copyText(message).then(function () { toast('📋 คัดลอกแล้ว'); }); }, text: '📋 คัดลอก' })),
      bar(h('button', { class: 'btn gray', onclick: function () { go(opts.next || 'home', opts.nextParams || {}, !TOP[opts.next || 'home']); }, text: opts.nextText || 'ทำรายการต่อ' }), h('button', { class: 'btn', onclick: closeOrHome, text: 'ปิด' })));
    add($app.children[1], h('div', { class: 'msg-preview', text: message }));
    add($app.children[1], h('p', { class: 'muted small', style: 'margin:8px 0 0' }, 'ส่งผิด? แก้ไขหรือยกเลิกได้ที่ ', h('a', { href: '#', onclick: function (e) { e.preventDefault(); go('history'); }, text: 'รายการที่ส่งแล้ว' })));
    if (opts.noPost) { status.textContent = 'บันทึกเรียบร้อย'; return; }
    postToChat(message).then(function (r) {
      status.textContent = r === 'sent' ? '💬 ส่งเข้ากลุ่มแล้ว' : r === 'shared' ? '💬 แชร์แล้ว' : r === 'copied' ? '📋 บันทึกแล้ว — คัดลอกข้อความไว้ วางในกลุ่มได้เลย' : 'บันทึกแล้ว (ยังไม่ได้ส่งข้อความเข้ากลุ่ม)';
      if (r === 'cancel') add($app.children[0], h('button', { class: 'btn ghost', onclick: function () { postToChat(message).then(function (x) { if (x !== 'cancel') status.textContent = '💬 ส่งแล้ว'; }); }, text: 'ส่งเข้ากลุ่มอีกครั้ง' }));
    });
  }

  // ---------- เส้นทางหน้า + แถบเมนูล่าง ----------
  var VIEWS = {};
  // หน้าระดับบนสุด → แท็บที่สว่าง (แถบเมนูล่างแสดงเฉพาะหน้าเหล่านี้ หน้าฟอร์มจะซ่อนเพื่อให้ปุ่มบันทึกเด่น)
  var TOP = { home: 'home', report: 'report', overview: 'results', now: 'results', summary: 'results', me: 'results', score: 'results', more: 'more' };
  var TABS = [['home', '🏠', 'หน้าแรก'], ['report', '📝', 'รายงาน'], ['results', '📈', 'ผลงาน'], ['more', '☰', 'เพิ่มเติม']];
  function go(view, params, replace) {
    if (view === 'menu') view = 'home';
    if (view === 'results') view = S.resultsLast || 'overview';
    if (TOP[view] === 'results') S.resultsLast = view;
    if (!VIEWS[view]) view = 'home';
    if (TOP[view]) S.stack = [];
    else if (!replace && S.view) S.stack.push({ view: S.view, params: S.params });
    S.view = view; S.params = params || {}; S.viewSeq = (S.viewSeq || 0) + 1; stalePill(null);
    var reg = view === 'register';
    document.getElementById('back').hidden = !S.stack.length || !!TOP[view];
    document.getElementById('home').hidden = !!TOP[view] || reg || !!S.stack.length;
    renderTabs(reg ? null : TOP[view]);
    renderSubnav(view);
    document.body.classList.toggle('has-tabs', !!TOP[view] && !reg);
    window.scrollTo(0, 0);
    try { VIEWS[view](S.params); } catch (e) { clear($app); add($app, errorBox(e.message)); }
  }
  function pendingTotal() { var p = S.boot && S.boot.pending; return (p ? (can('case.approve') ? p.arrest : 0) + (can('people.manage') ? p.reg : 0) : 0) + ((S.boot && S.boot.filesPending) || 0); }
  function renderTabs(active) {
    var nav = document.getElementById('tabs'); clear(nav); nav.hidden = !active;
    if (!active) return;
    TABS.forEach(function (t) {
      var n = t[0] === 'more' ? pendingTotal() : 0;
      add(nav, h('button', { class: active === t[0] ? 'on' : '', 'aria-current': active === t[0] ? 'page' : null, onclick: function () { go(t[0], {}, true); } },
        h('span', { class: 'ti', text: t[1] }), h('span', { class: 'tl', text: t[2] }), n ? h('span', { class: 'dot', text: n > 99 ? '99+' : String(n) }) : null));
    });
  }
  function renderSubnav(view) {
    var nav = document.getElementById('subnav'); clear(nav);
    var items = [['overview', 'ภาพรวม', null], ['now', 'ตอนนี้', 'view.now'], ['summary', 'สรุปผล', 'view.now'], ['me', 'ของฉัน', null], ['score', 'คะแนน', null]].filter(function (x) { return !x[2] || can(x[2]); });
    nav.hidden = TOP[view] !== 'results' || items.length < 2;
    if (nav.hidden) return;
    var seg = h('div', { class: 'seg' + (items.length > 4 ? ' n5' : '') });
    items.forEach(function (x) { add(seg, h('button', { class: x[0] === view ? 'on' : '', onclick: function () { go(x[0], {}, true); }, text: x[1] })); });
    add(nav, seg);
  }
  document.getElementById('back').onclick = function () { var p = S.stack.pop(); if (p) go(p.view, p.params, true); else go('home', {}, true); };
  document.getElementById('home').onclick = function () { go('home', {}, true); };
  function fail(e, retry) {
    clear($app); add($app, errorBox(e.message || String(e)));
    if (retry) add($app, h('button', { class: 'btn block', onclick: retry, text: 'ลองใหม่' }));
  }

  // ---------- เริ่มต้น ----------
  function start() {
    if (!CFG.LIFF_ID || /ใส่_/.test(CFG.LIFF_ID)) return fail(new Error('ยังไม่ได้ตั้งค่า LIFF_ID / API_URL ในไฟล์ config.js'));
    stage('กำลังยืนยันตัวตนกับ LINE…');
    withTimeout(liff.init({ liffId: CFG.LIFF_ID }), CFG.INIT_TIMEOUT_MS || 20000, 'เชื่อมต่อ LINE ไม่สำเร็จ (ขั้นยืนยันตัวตน) — กรุณาปิดหน้านี้แล้วเปิดใหม่จากแชทบอท').then(function () {
      if (!liff.isLoggedIn()) { liff.login({ redirectUri: location.href }); return; }
      var dec = liff.getDecodedIDToken && liff.getDecodedIDToken();
      if (dec && dec.sub) { S.uid = dec.sub; sessLoad(dec.sub); }
      // ID token ของ LINE หมดอายุและไม่มีบัตรผ่านของระบบ → ขอใหม่จาก LINE (กันวนซ้ำ: ครั้งเดียวต่อ 2 นาที)
      if (dec && dec.exp && dec.exp * 1000 < Date.now() + 60000 && !S.sess) {
        var last = 0; try { last = +(sessionStorage.getItem('relogin') || 0); } catch (e) { }
        if (Date.now() - last > 120000) {
          try { sessionStorage.setItem('relogin', String(Date.now())); } catch (e) { }
          liff.logout(); if (liff.isInClient()) location.reload(); else liff.login({ redirectUri: location.href }); return;
        }
      }
      S.idToken = liff.getIDToken();
      var q = new URLSearchParams(location.search);
      var params = {}; q.forEach(function (v, k) { params[k] = v; });
      // เปิดผ่าน https://liff.line.me/<id>?v=... ครั้งแรก พารามิเตอร์อยู่ใน liff.state
      if (params['liff.state']) { new URLSearchParams(String(params['liff.state']).replace(/^[^?]*\?/, '')).forEach(function (v, k) { params[k] = v; }); }
      if (!S.idToken) throw new Error('LINE ไม่ส่งข้อมูลยืนยันตัวตน — กรุณาปิดหน้านี้แล้วเปิดใหม่จากแชทบอท');
      S.uid = dec && dec.sub ? dec.sub : '';
      stage('กำลังโหลดข้อมูลจากระบบ…');
      function open() {
        window.__booted = true;
        if (!S.boot.registered) return go('register', {}, true);
        var v = params.v === 'more' && !VIEWS.more ? 'home' : params.v;
        if (v === 'register') { v = 'home'; toast('✅ ท่านลงทะเบียนแล้ว — ใช้งานได้เลย', 3000); } // กดปุ่ม "ลงทะเบียน" ในแชทซ้ำหลังผูกแล้ว
        go(VIEWS[v] ? v : 'home', params, true);
        prefetchCurrentShift();
        // โหลดหน้าที่ใช้บ่อยไว้ล่วงหน้าทีละหน้า (หลังหน้าแรกขึ้นแล้ว) — เปิดครั้งแรกจะขึ้นทันที
        setTimeout(function () {
          if (S.viewAs || !S.boot || !S.boot.registered) return;
          var t = today(), q = [];
          if (S.view !== 'report') q.push(['duty.week', {}]);
          if (can('view.now') && S.view !== 'now') q.push(['now', {}]);
          q.reduce(function (p, x) { return p.then(function () { return prefetch(x[0], x[1]); }); }, Promise.resolve());
        }, 2500);
      }
      var cached = S.uid && !S.viewAs ? bootCacheGet(S.uid) : null;
      if (cached) { applyBoot(cached); open(); refreshBootQuiet(); return; }
      return boot().then(open);
    }).catch(function (e) { window.__booted = true; fail(e, function () { location.reload(); }); });
  }
  // จำ bootstrap ไว้ในเครื่อง (ต่อบัญชี LINE) → เปิดครั้งถัดไปหน้าขึ้นทันที แล้วค่อยอัปเดตเบื้องหลัง
  var BOOT_KEY = 'boot:' + (CFG.LIFF_ID || ''), BOOT_MAX_AGE = 12 * 3600000;
  function bootCacheGet(uid) { try { var j = JSON.parse(localStorage.getItem(BOOT_KEY) || 'null'); return j && j.uid === uid && Date.now() - j.at < BOOT_MAX_AGE && j.b && j.b.registered ? j.b : null; } catch (e) { return null; } }
  function bootCachePut(uid, b) { try { if (b && b.registered) localStorage.setItem(BOOT_KEY, JSON.stringify({ uid: uid, at: Date.now(), b: b })); else localStorage.removeItem(BOOT_KEY); } catch (e) { } }
  function applyBoot(b) { S.boot = b; S._bootAt = Date.now(); if (S.view && S.view !== 'home') return; setTitle('รายงานผล ' + (b.station || '').split(' ')[0], b.me ? b.me.name + ' · ' + (b.perms.roleLabel || '') : ''); }
  function boot() { return api('bootstrap').then(function (b) { applyBoot(b); if (!S.viewAs) bootCachePut(S.uid, b); viewBanner(); return b; }); }
  // ---------- โหมดจำลองมุมมอง (แอดมิน) ----------
  try { S.viewAs = JSON.parse(sessionStorage.getItem('viewAs') || 'null'); } catch (e) { S.viewAs = null; }
  function setViewAs(v) {
    S.viewAs = v; try { if (v) sessionStorage.setItem('viewAs', JSON.stringify(v)); else sessionStorage.removeItem('viewAs'); } catch (e) { }
    apiInvalidate(); loading(v ? 'กำลังสลับมุมมอง…' : 'กำลังกลับสู่มุมมองแอดมิน…');
    return boot().then(function () { go('home', {}, true); }, function (e) { if (v) { toast('⚠️ ' + e.message, 4000); setViewAs(null); } });
  }
  function viewBanner() {
    var b = document.getElementById('viewas'); if (!b) { b = h('div', { id: 'viewas' }); document.body.insertBefore(b, document.body.firstChild); }
    var v = S.boot && S.boot.viewAs; b.hidden = !v; clear(b); document.body.classList.toggle('viewing', !!v);
    if (!v) return;
    add(b, h('span', { class: 'grow', text: '👁 จำลองมุมมอง: ' + v.name + ' (' + v.roleLabel + ')' + (v.sample ? ' · ตัวแทนบทบาท' : '') + ' — กดบันทึก = บันทึกจริงในนามแอดมิน' }),
      h('button', { onclick: function () { setViewAs(null); }, text: 'ออก' }));
  }
  function refreshBoot() { return boot().then(function () { renderTabs(TOP[S.view]); }, function () { }); }
  // อัปเดตเบื้องหลังหลังเปิดจากแคช: ถ้าข้อมูลเปลี่ยนและผู้ใช้ยังไม่ได้กรอกอะไร ให้วาดหน้าหลัก/ตอนนี้ใหม่
  function refreshBootQuiet() {
    var before = JSON.stringify(S.boot);
    return boot().then(function (b) {
      renderTabs(TOP[S.view]);
      var typing = document.activeElement && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
      if (JSON.stringify(b) !== before && !typing && (S.view === 'home' || S.view === 'more')) VIEWS[S.view](S.params);
    }, function () { });
  }
  function prefetchCurrentShift() {
    var mine = (S.boot && S.boot.myShifts) || [], cur = S.boot && S.boot.current; if (!cur) return;
    var sel = mine.filter(function (x) { return x.dutyDate === cur.dutyDate && x.shift === cur.shift; })[0] || mine[0];
    if (sel) api('shift.get', { dutyDate: sel.dutyDate, shift: sel.shift, car: sel.car }).then(null, function () { });
  }
  window.__app = { go: go, S: S, api: api }; // สำหรับทดสอบ

  // ======================= ลงทะเบียน =======================
  VIEWS.register = function () {
    setTitle('ลงทะเบียนครั้งแรก', 'ผูกบัญชี LINE กับรายชื่อของท่าน');
    clear($app);
    if (S.boot.pending && !S.regRetry) {
      add($app, card('⏳ รอแอดมินอนุมัติ'), h('p', { class: 'muted', text: 'ส่งคำขอแล้ว เมื่ออนุมัติจะใช้งานได้ทันที (เปิดหน้านี้ใหม่)' }),
        h('p', { class: 'muted small', text: 'ใส่เลขเบอร์ผิด หรือท่านเป็นแอดมิน (พิมพ์ "ผูกแอดมิน" ในแชทบอทแล้ว)? กดลงทะเบียนใหม่ได้ — ถ้าเลข 4 ตัวท้ายตรงกับทะเบียน หรือท่านเป็นแอดมิน จะใช้งานได้ทันที' }),
        h('button', { class: 'btn block', onclick: function () { S.regRetry = true; VIEWS.register(); }, text: '📝 ลงทะเบียนใหม่' }));
      return;
    }
    // ขั้น 1 เลือกชื่อ → รายการยุบเหลือชื่อที่เลือก แล้วช่องเลข 4 ตัวท้ายขึ้นทันที (ไม่ต้องเลื่อนหา)
    var chosen = null, list = h('div'), err = h('div');
    var last4 = h('input', { inputmode: 'numeric', pattern: '[0-9]*', maxlength: '4', placeholder: '••••', autocomplete: 'off', class: 'last4', 'aria-label': 'เลข 4 ตัวท้ายเบอร์โทร' });
    var search = h('input', { placeholder: '🔎 พิมพ์ชื่อหรือนามสกุล', oninput: render });
    var c = card('1) เลือกชื่อของท่าน'), c2 = card('2) เลข 4 ตัวท้ายเบอร์โทรของท่าน');
    add(c2, last4, h('p', { class: 'muted small', text: 'ถ้าตรงกับเบอร์ในทะเบียนกำลังพล จะใช้งานได้ทันที ถ้าไม่ตรงจะส่งให้แอดมินตรวจ' }), err);
    function who(p) { return h('div', { class: 'who' }, h('b', { text: p.name }), p.position ? h('small', { class: 'muted', text: p.position }) : null); }
    function render() {
      clear(c); add(c, h('h3', { text: '1) เลือกชื่อของท่าน' }));
      if (chosen) {
        add(c, h('div', { class: 'person' }, h('span', { class: 'ok-dot', text: '✅' }), who(chosen),
          h('button', { class: 'btn ghost sm', onclick: function () { chosen = null; c2.hidden = true; render(); search.focus(); }, text: 'เปลี่ยน' })));
        c2.hidden = false; return;
      }
      add(c, search, list); clear(list);
      var q = search.value.trim();
      S.boot.people.filter(function (p) { return !q || (p.first + p.last + (p.nick || '')).indexOf(q.replace(/\s/g, '')) >= 0 || p.name.indexOf(q) >= 0; }).slice(0, 40).forEach(function (p) {
        add(list, h('div', { class: 'person', style: 'cursor:pointer', onclick: function () { chosen = p; render(); setTimeout(function () { last4.focus(); c2.scrollIntoView({ block: 'center' }); }, 50); } },
          h('input', { type: 'radio', name: 'me' }), who(p)));
      });
      if (!list.children.length) add(list, h('p', { class: 'muted', text: 'ไม่พบชื่อ — ใช้ "ไม่พบชื่อของฉัน" ด้านล่าง' }));
    }
    c2.hidden = true; render();
    add($app, c, c2, h('button', { class: 'btn ghost block', onclick: notFound, text: 'ไม่พบชื่อของฉัน' }),
      bar(h('button', { class: 'btn green', onclick: submit, text: 'ลงทะเบียน' })));
    function problem(msg, el) { clear(err); add(err, errorBox(msg)); toast('⚠️ ' + msg, 3500); if (el) { el.focus(); el.scrollIntoView({ block: 'center' }); } }
    function submit() {
      clear(err);
      if (!chosen) return problem('กรุณาเลือกชื่อของท่านก่อน', search);
      var d = last4.value.replace(/\D/g, '');
      if (d.length !== 4) return problem('กรุณาใส่เลข 4 ตัวท้ายเบอร์โทรของท่าน', last4);
      api('register', { pid: chosen.pid, last4: d }).then(function (r) {
        if (r.status === 'linked') return boot().then(function () { toast('✅ ลงทะเบียนสำเร็จ'); go('home', {}, true); });
        S.boot.pending = true; S.regRetry = false; VIEWS.register(); toast('เลขไม่ตรงกับทะเบียน — ส่งคำขอให้แอดมินตรวจแล้ว', 4000);
      }, function (e) { problem(e.message); });
    }
    function notFound() {
      var rank = h('input', { placeholder: 'ยศ เช่น ด.ต.' }), first = h('input', { placeholder: 'ชื่อ' }), last = h('input', { placeholder: 'นามสกุล' }), phone = h('input', { placeholder: 'เบอร์โทร', inputmode: 'tel' });
      modal('ลงทะเบียน (ไม่พบชื่อในทะเบียน)', [rank, first, last, phone, h('p', { class: 'muted small', text: 'แอดมินจะตรวจและเพิ่มชื่อให้' })], 'ส่งคำขอ', function () {
        if (!first.value.trim()) { toast('กรุณากรอกชื่อ'); return false; }
        return api('register', { extra: { rank: rank.value.trim(), first: first.value.trim(), last: last.value.trim(), phone: phone.value.trim() } }).then(function (r) {
          if (r.status === 'linked') return boot().then(function () { go('home', {}, true); });
          S.boot.pending = true; S.regRetry = false; VIEWS.register(); toast('ส่งคำขอให้แอดมินตรวจแล้ว', 3500);
        });
      });
    }
  };

  // ======================= หน้าแรก: สิ่งที่ต้องทำตอนนี้ =======================
  var SHIFT_TIME = { D: '06.00–18.00 น.', N: '18.00–06.00 น.' };
  function stationTitle() { setTitle('รายงานผล ' + (S.boot.station || '').split(' ')[0], S.boot.me.name + ' · ' + S.boot.perms.roleLabel); }
  function rowLink(ic, title, sub, onclick, badge) {
    return h('button', { class: 'rowlink', onclick: onclick }, h('span', { class: 'ic', text: ic }),
      h('span', { class: 'tx' }, h('b', { text: title }), sub ? h('small', { text: sub }) : null), badge ? h('span', { class: 'badge red', text: badge }) : null, h('span', { class: 'chev', text: '›' }));
  }
  VIEWS.home = function () {
    stationTitle();
    clear($app);
    var mine = S.boot.myShifts || [], cur = S.boot.current;
    // ผลัดที่ควรทำตอนนี้: ผลัดปัจจุบัน > ผลัดที่เข้าเวรแล้วแต่ยังไม่ส่ง > ผลัดถัดไป
    var pick = mine.filter(function (x) { return x.state === 'เข้าเวร'; })[0] || mine.filter(function (x) { return x.dutyDate === cur.dutyDate && x.shift === cur.shift; })[0] ||
      mine.filter(function (x) { return x.dutyDate + x.shift > cur.dutyDate + cur.shift; })[0] || mine[mine.length - 1];
    var p = can('report.own') ? h('div', { class: 'hero' }) : null;
    if (p && pick) {
      var prm = { d: pick.dutyDate, s: pick.shift, car: pick.car };
      add(p, h('div', { class: 'eyebrow', text: pick.dutyDate === cur.dutyDate && pick.shift === cur.shift ? 'ผลัดปัจจุบันของท่าน' : 'ผลัดของท่าน' }),
        h('div', { class: 'big', text: SHIFT[pick.shift].icon + ' ' + SHIFT[pick.shift].label + ' ' + th(pick.dutyDate) }),
        h('div', { class: 'meta', text: 'รถ ' + pick.car + ' · เขต ' + pick.zone + ' · ' + SHIFT_TIME[pick.shift] + (pick.role ? ' · ' + pick.role : '') }));
      if (!pick.state) add(p, h('button', { class: 'btn green block xl', onclick: function () { go('checkin', prm); }, text: '🟢 เข้าเวร' }));
      else if (pick.state === 'เข้าเวร') {
        add(p, h('div', { class: 'state', text: '🟢 เข้าเวรแล้ว ' + (pick.checkinAt ? hm(pick.checkinAt) + ' น.' : '') }),
          h('button', { class: 'btn block xl', onclick: function () { go('checkout', prm); }, text: '✅ ส่งเวร / ลงผลการปฏิบัติ' }),
          h('div', { class: 'quick' }, [['🚔', 'ว.42', 'escort'], ['🤝', 'ช่วยเหลือ', 'assist'], ['🚨', 'จับกุม', 'arrest']].map(function (q) {
            return h('button', { onclick: function () { go(q[2], prm); } }, h('span', { text: q[0] }), q[1]); })));
      } else {
        add(p, h('div', { class: 'state', text: '✅ ' + pick.state + 'แล้ว ' + (pick.checkoutAt ? th(pick.checkoutAt.slice(0, 10)) + ' ' + hm(pick.checkoutAt) + ' น.' : '') }),
          h('button', { class: 'btn ghost-light block', onclick: function () { go('checkout', prm); }, text: '✏️ แก้ผลส่งเวร (ภายใน 24 ชม.)' }));
      }
    } else if (p) {
      add(p, h('div', { class: 'eyebrow', text: 'ผลัดของท่าน' }), h('div', { class: 'meta', text: 'ไม่พบชื่อท่านในตารางเวร 24 ชม. นี้ — ถ้าขึ้นรถแทน/เสริม ให้กด "เข้าเวร" แล้วเลือกรถเอง' }),
        h('div', { class: 'row' }, h('button', { class: 'btn green grow', onclick: function () { go('checkin'); }, text: '🟢 เข้าเวร' }), h('button', { class: 'btn grow', onclick: function () { go('checkout'); }, text: '✅ ส่งเวร' })));
    }
    if (p) add($app, p);
    // ว.42 ที่รออยู่: นัดไว้ · กำลังนำ · รอรับกลับ (ผู้เห็นภาพรวมเห็นทั้งสถานี เจ้าหน้าที่เห็นของตน) — ของตนเองขึ้นก่อน
    var escs = (S.boot.escorts || []).slice().sort(function (a, b) { return (escMine(b) ? 1 : 0) - (escMine(a) ? 1 : 0); });
    if (escs.length) {
      var ecard = card('🚔 ว.42 ที่รออยู่', escs.length + ' ขบวน');
      escs.slice(0, 8).forEach(function (e) { add(ecard, escRow(e)); });
      if (escs.length > 8) add(ecard, h('button', { class: 'btn ghost sm', onclick: function () { go('escort'); }, text: 'ดูทั้งหมด ' + escs.length + ' ขบวน ›' }));
      add($app, ecard);
    }
    // งานรอดำเนินการของผู้ตรวจ/ผู้ดูแล
    var pend = S.boot.pending || {};
    if (can('case.approve') && pend.arrest) add($app, h('button', { class: 'alert red', onclick: function () { go('cases'); } }, h('b', { text: '📥 คดีจับกุมรอตรวจ ' + pend.arrest + ' คดี' }), h('small', { text: 'แตะเพื่อตรวจและอนุมัติ (คดีที่ท่านอยู่ในชุดจับกุมอนุมัติเองไม่ได้)' })));
    if (S.boot.filesPending) add($app, h('button', { class: 'alert amber', onclick: function () { go('files'); } }, h('b', { text: '📥 ไฟล์รอตรวจนำเข้า ' + S.boot.filesPending + ' ไฟล์' }), h('small', { text: 'คำสั่งเวร/แบ่งตามสายงาน/รายชื่อที่เจ้าหน้าที่ส่งมา — ตรวจแล้วกดยืนยัน' })));
    if (can('people.manage') && pend.reg) add($app, h('button', { class: 'alert red', onclick: function () { go('registrations'); } }, h('b', { text: '📝 คำขอลงทะเบียน ' + pend.reg + ' รายการ' }), h('small', { text: 'ตรวจว่าชื่อ LINE ตรงตัวก่อนอนุมัติ' })));
    // ภาพรวมสถานี (ทุกคนเห็น) แบบย่อ — โหลดตามหลัง ไม่หน่วงปุ่มเข้าเวร/ส่งเวร · กราฟเต็มอยู่หน้า "ภาพรวม"
    add($app, homeDash('brief'));
    // ทางลัด
    var list = h('div', { class: 'list' });
    if (can('report.own')) add(list, rowLink('🚨', 'รายงานจับกุม', 'แบบ CCOC — ส่งให้ผู้ตรวจอนุมัติ', function () { go('arrest'); }));
    add(list, rowLink('📝', 'รายการที่ส่งแล้ว', 'ดู · แก้ไข · ยกเลิก', function () { go('history'); }));
    add(list, rowLink('📅', 'ภาพสรุปผลประจำวัน', 'ส่งให้ผู้บังคับบัญชา', function () { go('daily'); }));
    add(list, rowLink('👤', 'ผลของฉัน', 'ผลงานรายวงรอบ · คะแนนและอันดับ', function () { go('me'); }));
    if (can('pr.make')) add(list, rowLink('🖼', 'สร้างภาพประชาสัมพันธ์', 'prompt สำหรับ ChatGPT + เบลอรูปบนเครื่อง', function () { go('pr'); }));
    add($app, h('div', { class: 'section-label', text: 'ทางลัด' }), list);
    add($app, h('p', { class: 'muted small center', text: 'v' + S.boot.version + ' · ติดปัญหา แจ้งแอดมินหรือพิมพ์ "ช่วย" ในกลุ่ม' }));
    if (!S._bootAt || Date.now() - S._bootAt > 60000) { S._bootAt = Date.now(); refreshBoot().then(function () { if (S.view === 'home' && JSON.stringify(mine) !== JSON.stringify(S.boot.myShifts || [])) VIEWS.home(); }); }
  };
  VIEWS.menu = VIEWS.home;

  // ======================= แท็บรายงาน =======================
  // ---------- สถานะการรายงานตามตารางเวร (บนสุดของหน้า "รายงาน") ----------
  // ✅ ทำแล้ว · 🟡 ถึงเวลาแล้ว · 🔴 เลยกำหนด · ⚪ ยังไม่ถึงเวลา · ➖ ยกเลิก — ของฉันมีปุ่มทำต่อ, ผู้ดูภาพรวมเห็นทั้งสถานี
  var DB_ST = { done: ['✅', 'st-done'], due: ['🟡', 'st-due'], late: ['🔴', 'st-late'], wait: ['⚪', 'st-wait'], void: ['➖', 'st-void'] };
  function dbWhen(at, base) { at = String(at || ''); var d = at.slice(0, 10); return (d && d !== base ? th(d) + ' ' : '') + hm(at) + ' น.'; }
  function dbLate(due) { var t = new Date(String(due).slice(0, 19) + '+07:00').getTime(), m = Math.max(0, Math.round((Date.now() - t) / 60000)); return m >= 60 ? Math.floor(m / 60) + ' ชม.' + (m % 60 ? ' ' + (m % 60) + ' นาที' : '') : m + ' นาที'; }
  function dbStepText(kind, x, base) {
    var w = kind === 'in' ? 'เข้าเวร' : 'ส่งเวร';
    if (x.state === 'done') return w + (x.noResult ? ' (ไม่มีผล)' : '') + ' ' + dbWhen(x.at, base) + (x.by ? ' · ' + x.by : '');
    if (x.state === 'due') return 'ถึงเวลา' + w + ' — รายงานภายใน ' + dbWhen(x.due, base);
    if (x.state === 'late') return x.skipped ? 'ไม่ได้รายงานเข้าเวร (ส่งเวรแล้ว)' : 'เลยกำหนด' + w + ' ' + dbLate(x.due) + ' (กำหนด ' + dbWhen(x.due, base) + ')';
    if (x.state === 'wait') return w + 'ได้ตั้งแต่ ' + dbWhen(x.from, base);
    return 'ผลัดนี้ถูกยกเลิก';
  }
  function dutyBoardCard(container, opt) {
    opt = opt || {};
    // วันที่ "วันนี้" ใช้เวลาของเซิร์ฟเวอร์ (โหลดครั้งแรกไม่ส่งวันที่) — กันเครื่องตั้งเวลาไม่ตรง
    var t = today(), y = addDays(t, -1), sel = null, chips = h('div', { class: 'chips' }), body = h('div');
    var dateIn = h('input', { type: 'date', class: 'db-date', max: addDays(t, 1), min: addDays(t, -31), value: t });
    function setToday(d) { if (d && d !== t) { t = d; y = addDays(t, -1); dateIn.max = addDays(t, 1); dateIn.min = addDays(t, -31); } if (!sel) { sel = t; dateIn.value = t; } rc(); }
    function rc() {
      clear(chips);
      [['วันนี้', t], ['เมื่อวาน', y]].forEach(function (x) { add(chips, h('button', { class: 'chip' + (sel === x[1] ? ' on' : ''), onclick: function () { sel = x[1]; dateIn.value = sel; rc(); load(); }, text: x[0] })); });
      add(chips, h('label', { class: 'chip db-pick' + (sel !== t && sel !== y ? ' on' : '') }, '📅 ', dateIn));
    }
    dateIn.onchange = function () { if (dateIn.value) { sel = dateIn.value; rc(); load(); } };
    if (opt.bare) add(container, h('div', { class: 'db' }, chips, body));
    else add(container, h('div', { class: 'card db' }, h('h3', null, '📋 สถานะการรายงานตามตารางเวร'), chips, body));
    function stepRow(kind, x, base, act) {
      var st = DB_ST[x.state] || DB_ST.wait, row = h('div', { class: 'db-step ' + st[1] }, h('span', { class: 'db-ic', text: st[0] }), h('span', { class: 'grow', text: dbStepText(kind, x, base) }));
      if (act && (x.state === 'due' || x.state === 'late') && !x.skipped) add(row, h('button', { class: 'btn sm ' + (x.state === 'late' ? 'red' : 'amber'), onclick: act, text: (kind === 'in' ? 'เข้าเวร' : 'ส่งเวร') + 'เลย ›' }));
      return row;
    }
    function worst(c) { var r = ['late', 'due', 'wait', 'done', 'void'], ss = [c.checkin.state, c.checkout.state, c.escort ? c.escort.state : 'done']; for (var i = 0; i < r.length; i++) if (ss.indexOf(r[i]) >= 0) return r[i]; return 'done'; }
    function load() {
      clear(body); add(body, h('div', { class: 'loading' }, spinner()));
      live('duty.board', sel ? { date: sel } : {}, function (b) {
        setToday(b.today);
        clear(body);
        add(body, h('div', { class: 'db-date-label', text: th(b.date) + (b.date === t ? ' (วันนี้)' : b.date === y ? ' (เมื่อวาน)' : '') }));
        // ของฉัน (หน้ารายงานใหม่แสดงไว้ในการ์ดประจำผลัดแล้ว → opt.noMine)
        var mine = [], todo = 0;
        b.shifts.forEach(function (s) { s.cars.forEach(function (c) { if (c.mine) mine.push([s, c]); }); });
        var me = h('div', { class: 'db-mine' }); if (!opt.noMine) add(body, h('div', { class: 'section-label', text: '👤 ของฉัน' }), me);
        if (!mine.length) add(me, h('p', { class: 'muted small', text: 'ไม่มีเวรของท่านตามตารางใน' + (b.date === t ? 'วันนี้' : 'วันที่เลือก') }));
        mine.forEach(function (sc) {
          var s = sc[0], c = sc[1], q = { d: b.date, s: s.shift, car: c.car }, wst = worst(c);
          if (wst === 'late' || wst === 'due') todo++;
          var blk = h('div', { class: 'db-car ' + DB_ST[wst][1] }, h('div', { class: 'db-head' }, h('b', { text: SHIFT[s.shift].icon + ' ผลัด' + SHIFT[s.shift].label + ' · รถ ' + c.car + ' · เขต ' + c.zone }),
            h('div', { class: 'small muted', text: c.crew.join(', ') })),
            stepRow('in', c.checkin, b.date, function () { go('checkin', q); }), stepRow('out', c.checkout, b.date, function () { go('checkout', q); }));
          if (c.escort) add(blk, h('div', { class: 'db-step ' + DB_ST[c.escort.state][1] }, h('span', { class: 'db-ic', text: '🟠' }), h('span', { class: 'grow', text: 'ว.42 "' + c.escort.name + '" ยังไม่กดจบขบวน' }),
            h('button', { class: 'btn sm amber', onclick: function () { go('escort'); }, text: 'จบขบวน ›' })));
          add(me, blk);
        });
        b.cases.forEach(function (k) {
          todo += k.status === 'returned' ? 1 : 0;
          add(me, h('div', { class: 'db-step ' + (k.status === 'returned' ? 'st-late' : 'st-due') }, h('span', { class: 'db-ic', text: k.status === 'returned' ? '🔴' : '🟡' }),
            h('span', { class: 'grow', text: (k.status === 'returned' ? 'คดีถูกส่งกลับให้แก้: ' : 'คดีรออนุมัติ: ') + k.title + ' (' + th(k.date) + ')' + (k.note ? ' — ' + k.note : '') }),
            h('button', { class: 'btn sm ' + (k.status === 'returned' ? 'red' : 'ghost'), onclick: function () { go(k.status === 'returned' ? 'arrest' : 'case', { id: k.id }); }, text: k.status === 'returned' ? 'แก้คดี ›' : 'เปิดคดี ›' })));
        });
        if (b.toApprove) add(me, h('div', { class: 'db-step st-due' }, h('span', { class: 'db-ic', text: '🟡' }), h('span', { class: 'grow', text: 'มีคดีรอท่านตรวจ/อนุมัติ ' + b.toApprove + ' คดี' }),
          h('button', { class: 'btn sm amber', onclick: function () { go('cases'); }, text: 'ตรวจคดี ›' })));
        if (mine.length && !todo) add(me, h('p', { class: 'db-ok', text: '👍 ไม่มีรายการค้าง' }));
        // ทั้งสถานี
        if (!b.all && opt.noMine) add(body, h('p', { class: 'muted small', text: 'สถานะทั้งสถานีแสดงเฉพาะผู้มีสิทธิ์ดูภาพรวม ธุรการ และร้อยเวรประจำวัน' }));
        if (b.all) {
          add(body, h('div', { class: 'section-label', text: '🏢 ทั้งสถานี' + (b.zone ? ' (เขต ' + b.zone + ')' : '') }));
          b.shifts.forEach(function (s) {
            var n = s.count, sc = card(SHIFT[s.shift].icon + ' ผลัด' + SHIFT[s.shift].label + ' ' + hm(s.start).replace(':', '.') + '–' + hm(s.end).replace(':', '.') + ' น.');
            add(sc, h('div', { class: 'db-sum' }, h('span', { text: 'เข้าเวร ' + n.checkin + '/' + n.cars }), h('span', { text: 'ส่งเวร ' + n.checkout + '/' + n.cars }),
              n.late ? h('span', { class: 'st-late', text: '🔴 เลยกำหนด ' + n.late }) : null, n.due ? h('span', { class: 'st-due', text: '🟡 ถึงเวลา ' + n.due }) : null));
            if (!s.cars.length) add(sc, h('p', { class: 'muted small', text: 'ไม่มีรถในตารางเวรผลัดนี้' }));
            var tb = h('div', { class: 'db-tbl' }, h('div', { class: 'db-tr db-th' }, h('span', { text: 'รถ / เจ้าหน้าที่' }), h('span', { text: 'เข้าเวร' }), h('span', { text: 'ส่งเวร' })));
            s.cars.forEach(function (c) {
              function cell(x) { var st = DB_ST[x.state] || DB_ST.wait; return h('span', { class: 'db-cell ' + st[1] }, st[0] + ' ' + (x.state === 'done' ? hm(x.at) + (x.noResult ? ' ไม่มีผล' : '') : x.state === 'late' ? (x.skipped ? 'ไม่ได้รายงาน' : 'เลยกำหนด') : x.state === 'due' ? 'ถึงเวลา' : x.state === 'wait' ? 'ยังไม่ถึง' : 'ยกเลิก')); }
              add(tb, h('div', { class: 'db-tr' + (c.mine ? ' db-me' : '') }, h('span', { class: 'db-cn' }, h('b', { text: 'เขต ' + c.zone + ' · ' + c.car }), c.escort ? h('span', { class: 'st-due', text: ' 🟠 ว.42 ค้าง' }) : null,
                h('small', { class: 'muted', text: c.crew.join(', ') })), cell(c.checkin), cell(c.checkout)));
            });
            add(sc, tb); add(body, sc);
          });
        }
        var r = b.rules;
        add(body, statusKey());
        add(body, h('details', { class: 'note db-legend' }, h('summary', { text: 'ℹ️ คำแนะนำ: ต้องทำอะไรบ้าง' }),
          h('div', { text: '✅ ทำแล้ว (แสดงเวลาและผู้รายงาน) · ⚪ ยังไม่ถึงเวลา · ➖ ผลัดถูกยกเลิก' }),
          h('div', { text: '🟡 ถึงเวลาแล้ว ให้รายงานทันที — เข้าเวรได้ตั้งแต่ ' + r.early + ' นาทีก่อนเริ่มผลัด และภายใน ' + r.checkin + ' นาทีหลังเริ่มผลัด · ส่งเวรภายใน ' + (r.checkout / 60) + ' ชม. หลังจบผลัด' }),
          h('div', { text: '🔴 เลยกำหนด ให้รีบรายงาน (ถ้าส่งไม่ได้ให้แจ้งธุรการ) — ผลัดที่ไม่ส่งเวรอาจถูกหักคะแนนตามเกณฑ์ · 🟠 ว.42 ที่ยังไม่กดจบ ให้กด "จบขบวน" เมื่อส่งต่อแล้ว' }),
          h('div', { text: 'ผลัดกลางวัน ' + String(r.D.start).padStart(2, '0') + '.00–' + r.D.end + '.00 น. · ผลัดกลางคืน ' + r.N.start + '.00–' + String(r.N.end - 24).padStart(2, '0') + '.00 น. (นับเป็นวันที่เริ่มผลัด) · รายชื่อตามตารางเวรและการสลับเวร' })));
      }, function (e) { clear(body); add(body, errorBox(e.message)); });
    }
    load();
  }
  /** คำอธิบายสัญลักษณ์สถานะชุดเดียวทั้งระบบ */
  function statusKey(extra) { return h('div', { class: 'db-key' }, '✅ ทำแล้ว · 🟡 ถึงเวลา ทำทันที · 🔴 เลยกำหนด · ⚪ ยังไม่ถึงเวลา' + (extra ? ' · ' + extra : '')); }
  /** ผลัดที่ควรทำตอนนี้จากข้อมูล bootstrap: ผลัดที่เข้าเวรแล้วแต่ยังไม่ส่ง > ผลัดปัจจุบัน > ผลัดถัดไป > ผลัดล่าสุด */
  function pickMyShift() {
    var mine = S.boot.myShifts || [], cur = S.boot.current || {};
    return mine.filter(function (x) { return x.state === 'เข้าเวร'; })[0] || mine.filter(function (x) { return x.dutyDate === cur.dutyDate && x.shift === cur.shift; })[0] ||
      mine.filter(function (x) { return x.dutyDate + x.shift > cur.dutyDate + cur.shift; })[0] || mine[mine.length - 1] || null;
  }
  /** แถบสถานะผลัดของฉัน (บนสุดของหน้ารายงาน): ผลัด · รถ · เข้าเวร/ส่งเวร/ว.42 เป็นป้ายสั้น ๆ + ปุ่มทำต่อ · คดีที่ต้องทำต่อ */
  function myDutyStrip(container) {
    var pick = pickMyShift(), t = today(), date = pick && pick.dutyDate < t ? pick.dutyDate : t, box = h('div', { class: 'md' }); add(container, box);
    function fromBoot() { // ระหว่างรอข้อมูลจากเซิร์ฟเวอร์ แสดงจาก bootstrap ก่อน
      clear(box);
      if (!pick) return add(box, h('div', { class: 'md-none', text: 'ไม่พบชื่อท่านในตารางเวร 24 ชม. นี้ — ถ้าขึ้นรถแทน/เสริม ให้กด "เข้าเวร" แล้วเลือกรถเอง' }));
      add(box, h('div', { class: 'md-row' }, h('div', { class: 'md-h' }, h('b', { text: SHIFT[pick.shift].icon + ' ผลัด' + SHIFT[pick.shift].label + ' · รถ ' + pick.car + ' · เขต ' + pick.zone }), h('small', { text: th(pick.dutyDate) })),
        h('div', { class: 'md-steps' }, h('span', { class: 'md-chip', text: pick.state ? '✅ ' + pick.state + 'แล้ว' : '⏳ กำลังตรวจสถานะ…' }))));
    }
    fromBoot();
    function chip(kind, x, act) {
      var st = DB_ST[x.state] || DB_ST.wait, w = kind === 'in' ? 'เข้าเวร' : 'ส่งเวร', txt;
      if (x.state === 'done') txt = w + ' ' + hm(x.at) + (x.noResult ? ' (ไม่มีผล)' : '');
      else if (x.state === 'due') txt = w + 'ภายใน ' + hm(x.due);
      else if (x.state === 'late') txt = x.skipped ? 'ไม่ได้กดเข้าเวร' : 'เลยกำหนด' + w + ' ' + dbLate(x.due);
      else if (x.state === 'wait') txt = w + 'ได้ ' + hm(x.from);
      else txt = 'ยกเลิก';
      var el = h('span', { class: 'md-chip ' + st[1] }, st[0] + ' ' + txt);
      if (act && (x.state === 'due' || x.state === 'late') && !x.skipped) add(el, h('button', { class: 'btn sm ' + (x.state === 'late' ? 'red' : 'amber'), onclick: act, text: w + 'เลย ›' }));
      return el;
    }
    live('duty.board', date === t ? {} : { date: date }, function (b) {
      clear(box);
      var mine = []; b.shifts.forEach(function (s) { s.cars.forEach(function (c) { if (c.mine) mine.push([s, c]); }); });
      if (!mine.length) add(box, h('div', { class: 'md-none', text: 'ไม่มีเวรของท่าน' + (b.date === t ? 'วันนี้' : ' ' + th(b.date)) + 'ตามตารางเวร — ถ้าขึ้นรถแทน/เสริม ให้กด "เข้าเวร" แล้วเลือกรถเอง' }));
      mine.forEach(function (sc) {
        var s = sc[0], c = sc[1], q = { d: b.date, s: s.shift, car: c.car };
        var steps = h('div', { class: 'md-steps' }, chip('in', c.checkin, function () { go('checkin', q); }), chip('out', c.checkout, function () { go('checkout', q); }));
        if (c.escort) add(steps, h('span', { class: 'md-chip st-due' }, '🟠 ว.42 ยังไม่จบ', h('button', { class: 'btn sm amber', onclick: function () { go('escort'); }, text: 'จบขบวน ›' })));
        add(box, h('div', { class: 'md-row' }, h('div', { class: 'md-h' }, h('b', { text: SHIFT[s.shift].icon + ' ผลัด' + SHIFT[s.shift].label + ' · รถ ' + c.car + ' · เขต ' + c.zone }), h('small', { text: th(b.date) + ' · ' + c.crew.join(', ') })), steps));
      });
      b.cases.forEach(function (k) {
        add(box, h('div', { class: 'md-row' }, h('div', { class: 'md-steps' }, h('span', { class: 'md-chip ' + (k.status === 'returned' ? 'st-late' : 'st-due') }, (k.status === 'returned' ? '🔴 คดีถูกส่งกลับให้แก้: ' : '🟡 คดีรออนุมัติ: ') + k.title,
          h('button', { class: 'btn sm ' + (k.status === 'returned' ? 'red' : 'ghost'), onclick: function () { go(k.status === 'returned' ? 'arrest' : 'case', { id: k.id }); }, text: k.status === 'returned' ? 'แก้คดี ›' : 'เปิด ›' })))));
      });
      if (b.toApprove) add(box, h('div', { class: 'md-row' }, h('div', { class: 'md-steps' }, h('span', { class: 'md-chip st-due' }, '🟡 คดีรอท่านตรวจ/อนุมัติ ' + b.toApprove + ' คดี', h('button', { class: 'btn sm amber', onclick: function () { go('cases'); }, text: 'ตรวจคดี ›' })))));
    }, function () { });
  }
  // ---------- ย้อนหลัง 7 วัน: ตรวจว่าใครรายงานครบ/ตกหล่น (ทุกคนเห็นทั้งสถานี · แก้ได้ตามสิทธิ์) ----------
  var WK_ST = { ok: ['✅', 'wk-ok'], miss: ['🔴', 'wk-miss'], warn: ['🟠', 'wk-warn'], live: ['🔵', 'wk-live'], wait: ['⚪', 'wk-wait'], void: ['➖', 'wk-void'] };
  var WD = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
  function wd(iso) { var p = iso.split('-'); return WD[new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])).getUTCDay()]; }
  var WK_N = [['T', 'ขส'], ['C', 'รย'], ['R', 'จร'], ['warning', 'ตักเตือน'], ['truck_check', 'รถบรรทุก'], ['suspect_check', 'รถต้องสงสัย'], ['assist', 'ช่วยเหลือ'],
    ['warrant', 'หมายจับ'], ['crime', 'อาญา'], ['escort', 'ว.42'], ['mission', 'ภารกิจ']];
  var WK_TXT = { ok: '✅ ครบ', miss: '🔴 ไม่ได้รายงาน', warn: '🟠 ไม่สมบูรณ์/ช้า', live: '🔵 กำลังปฏิบัติ', wait: '⚪ ยังไม่ถึงเวลา', void: '➖ ยกเลิก' };
  function weekXlsx(w) {
    var rows = w.rows.slice().sort(function (a, b) { return (a.shift === b.shift ? 0 : a.shift === 'D' ? -1 : 1) || (a.zone || 99) - (b.zone || 99) || String(a.car).localeCompare(String(b.car), 'th', { numeric: true }); });
    var grid = rows.map(function (r) { return [r.car, r.zone || 'นอกตาราง', SHIFT[r.shift].label].concat(w.days.map(function (d) { var c = r.cells[d]; return c ? (WK_TXT[c.st] || c.st) + (c.n && c.n.total ? ' (' + c.n.total + ')' : '') : ''; })); });
    var fix = [];
    rows.forEach(function (r) { w.days.forEach(function (d) { var c = r.cells[d]; if (c) c.flags.forEach(function (f) { fix.push([d, SHIFT[r.shift].label, r.car, r.zone || '', f.lv === 'miss' ? 'ไม่ได้รายงาน' : 'ไม่สมบูรณ์', f.text, (c.crew || []).join(', ')]); }); }); });
    var res = [];
    rows.forEach(function (r) { w.days.forEach(function (d) { var c = r.cells[d]; if (c && c.n && c.n.total) res.push([d, SHIFT[r.shift].label, r.car, r.zone || ''].concat(WK_N.map(function (x) { return c.n[x[0]] || 0; })).concat([c.n.total, (c.crew || []).join(', ')])); }); });
    xlsxDownload('ตรวจการรายงาน7วัน_' + w.from + '_' + w.to + '.xlsx', [
      { name: 'ตาราง 7 วัน', head: ['รถ', 'เขต', 'ผลัด'].concat(w.days.map(function (d) { return wd(d) + ' ' + th(d); })), rows: grid },
      { name: 'รายการที่ต้องแก้', head: ['วันที่', 'ผลัด', 'รถ', 'เขต', 'ระดับ', 'ปัญหา', 'เจ้าหน้าที่'], rows: fix },
      { name: 'ผลที่รายงาน', head: ['วันที่', 'ผลัด', 'รถ', 'เขต'].concat(WK_N.map(function (x) { return x[1]; })).concat(['รวม', 'เจ้าหน้าที่']), rows: res }],
      [['ช่วงวันที่', th(w.from) + ' – ' + th(w.to)], ['สรุป', 'ไม่ได้รายงาน ' + w.sum.miss + ' · ไม่สมบูรณ์/ช้า ' + w.sum.warn + ' · ครบ ' + w.sum.ok + ' ผลัด']]);
  }
  function weekBoardCard(container) {
    var cur = S.boot.current || {}, sh = cur.shift === 'N' ? 'N' : 'D', only = '', data = null;
    var seg = h('div', { class: 'seg' }), filt = h('div', { class: 'chips', style: 'margin-top:8px' }), sum = h('div', { class: 'wk-sum' }), body = h('div');
    add(container, h('div', { class: 'card wk' }, h('h3', null, '🗓 ย้อนหลัง 7 วัน', h('span', { class: 'right', text: 'ตรวจการรายงานทั้งสถานี' })), sum, seg, filt, body));
    function rs() { clear(seg); ['D', 'N'].forEach(function (k) { add(seg, h('button', { class: k === sh ? 'on' : '', onclick: function () { sh = k; rs(); draw(); }, text: SHIFT[k].icon + ' ผลัด' + SHIFT[k].label })); }); }
    function rf() {
      clear(filt);
      var mine = data && data.rows.some(function (r) { return r.mine; });
      [['', 'ทุกคัน'], ['fix', '🔴🟠 ต้องแก้']].concat(mine ? [['mine', '👤 ของฉัน']] : []).forEach(function (x) {
        add(filt, h('button', { class: 'chip' + (only === x[0] ? ' on' : ''), onclick: function () { only = x[0]; rf(); draw(); }, text: x[1] }));
      });
    }
    function bad(r) { return Object.keys(r.cells).some(function (d) { var s = r.cells[d].st; return s === 'miss' || s === 'warn'; }); }
    function draw() {
      if (!data) return;
      clear(body);
      var rows = data.rows.filter(function (r) { return r.shift === sh && (!only || (only === 'fix' ? bad(r) : r.mine)); });
      if (!rows.length) {
        add(body, h('p', { class: 'muted small', style: 'margin:10px 2px', text: only === 'fix' ? '👍 ผลัด' + SHIFT[sh].label + 'ไม่มีรายการที่ต้องแก้ใน 7 วันนี้' : 'ไม่มีรถในตารางเวรผลัดนี้ช่วง 7 วัน (ตรวจว่าส่งคำสั่งเวรเข้าระบบแล้ว)' }));
        return;
      }
      var t = h('table', { class: 'wk-t' }), hr = h('tr', null, h('th', { class: 'wk-car', text: 'รถ' }));
      data.days.forEach(function (d) { add(hr, h('th', { class: d === data.today ? 'wk-today' : '' }, h('small', { text: wd(d) }), h('b', { text: String(+d.slice(8)) }))); });
      add(t, h('thead', null, hr));
      var tb = h('tbody'), lastZone = null;
      rows.forEach(function (r) {
        var tr = h('tr', { class: (r.mine ? 'wk-me' : '') + (lastZone !== null && r.zone !== lastZone ? ' wk-zs' : '') }); lastZone = r.zone;
        add(tr, h('th', { class: 'wk-car' }, h('b', { text: r.car }), h('small', { text: r.zone ? 'เขต ' + r.zone : 'นอกตาราง' })));
        data.days.forEach(function (d) {
          var c = r.cells[d];
          if (!c) return add(tr, h('td', { class: 'wk-none', text: '·' }));
          var st = WK_ST[c.st] || WK_ST.wait, n = c.n ? c.n.total : 0;
          add(tr, h('td', { class: 'wk-c ' + st[1] + (d === data.today ? ' wk-today' : '') }, h('button', { onclick: function () { wkDetail(r, d, c); }, title: th(d) },
            h('span', { class: 'wk-ic', text: st[0] }), h('small', { text: c.st === 'wait' || c.st === 'void' || (c.st === 'miss' && !n) ? '' : String(n) }))));
        });
        add(tb, tr);
      });
      add(t, tb);
      add(body, h('div', { class: 'wk-scroll' }, t));
    }
    function wkDetail(r, d, c) {
      var b = h('div', { class: 'wk-det' }), q = { d: d, s: r.shift, car: r.car };
      function line(ic, txt, cls) { return h('div', { class: 'db-step ' + (cls || '') }, h('span', { class: 'db-ic', text: ic }), h('span', { class: 'grow', text: txt })); }
      function when(at) { return hm(at) + ' น.' + (String(at).slice(0, 10) !== d ? ' (' + th(String(at).slice(0, 10)) + ')' : ''); }
      add(b, h('p', { class: 'muted small', style: 'margin:0 0 6px', text: '👥 ' + (c.crew.join(', ') || 'ไม่มีรายชื่อเจ้าหน้าที่') + (r.zone ? ' · เขต ' + r.zone : '') }));
      if (c.st === 'void') add(b, line('➖', 'ผลัดนี้ถูกยกเลิก'));
      else {
        add(b, line(c.in ? '✅' : c.phase === 'wait' ? '⚪' : '🔴', c.in ? 'เข้าเวร ' + when(c.in.at) + (c.in.by ? ' · ' + c.in.by : '') : c.phase === 'wait' ? 'ยังไม่ถึงเวลาเข้าเวร' : 'ไม่ได้กดเข้าเวร', c.in ? 'st-done' : ''));
        add(b, line(c.out ? (c.out.slow ? '🟠' : '✅') : c.phase === 'past' ? '🔴' : '⚪', c.out ? 'ส่งเวร ' + when(c.out.at) + (c.out.by ? ' · ' + c.out.by : '') + (c.out.noResult ? ' (ไม่มีผล)' : '') : c.phase === 'past' ? 'ไม่ได้ส่งเวร' : 'ยังไม่ถึงกำหนดส่งเวร', c.out && !c.out.slow ? 'st-done' : ''));
      }
      var parts = WK_N.filter(function (x) { return c.n && c.n[x[0]]; }).map(function (x) { return x[1] + ' ' + c.n[x[0]]; });
      add(b, h('div', { class: 'wk-res' }, h('b', { text: 'ผลที่รายงาน: ' }), parts.length ? parts.join(' · ') : 'ยังไม่มี'));
      var fixable = false;
      c.flags.forEach(function (f) {
        var act = null;
        if (c.can) {
          if (f.k === 'noin' && c.canBack) act = ['เข้าเวร ›', 'checkin', q];
          else if (f.k === 'noout' && c.canBack) act = ['ส่งเวร ›', 'checkout', q];
          else if (f.k === 'escort' || f.k === 'escortPlan' || f.k === 'escortWait') act = [f.k === 'escort' ? 'จบขบวน ›' : 'เปิด ว.42 ›', 'escort', { id: f.id }];
          else if (f.k === 'returned') act = ['แก้คดี ›', 'arrest', { id: f.id }];
          else if (f.k === 'pending') act = ['เปิดคดี ›', 'case', { id: f.id }];
          else if (f.k === 'escortAuto') act = ['ตรวจ/แก้ ›', 'history'];
        }
        if (f.k !== 'slow') fixable = true;
        var el = line(f.lv === 'miss' ? '🔴' : '🟠', f.text, f.lv === 'miss' ? 'st-late' : 'st-due');
        if (act) add(el, h('button', { class: 'btn sm ' + (f.lv === 'miss' ? 'red' : 'amber'), onclick: function () { closeModal(); go(act[1], act[2] || {}); }, text: act[0] }));
        add(b, el);
      });
      if (c.can && c.out && c.canBack) add(b, h('button', { class: 'btn ghost block', style: 'margin-top:10px', onclick: function () { closeModal(); go('checkout', q); }, text: '✏️ เพิ่ม/แก้ผลการปฏิบัติของผลัดนี้' }));
      if (!c.can && fixable) add(b, h('p', { class: 'muted small', style: 'margin:8px 0 0', text: 'ผลัดนี้ไม่ใช่ของท่าน — แจ้งเจ้าหน้าที่ของรถคันนี้ หรือธุรการ (ผู้มีสิทธิ์แก้รายงานผู้อื่น) ให้รายงานให้ครบ' }));
      if (c.can && !c.canBack && fixable) add(b, h('p', { class: 'muted small', style: 'margin:8px 0 0', text: 'เกิน ' + data.backDays + ' วันแล้ว ต้องให้ธุรการบันทึกแทน' }));
      modal(SHIFT[r.shift].icon + ' ' + wd(d) + ' ' + th(d) + ' · ผลัด' + SHIFT[r.shift].label + ' · รถ ' + r.car, b);
    }
    rs();
    add(body, h('div', { class: 'loading' }, spinner()));
    live('duty.week', {}, function (w) {
      data = w; var s = w.sum; clear(sum);
      add(sum, h('span', { class: 'wk-miss', text: '🔴 ไม่ได้รายงาน ' + s.miss }), h('span', { class: 'wk-warn', text: '🟠 ไม่สมบูรณ์/ช้า ' + s.warn }), h('span', { class: 'wk-ok', text: '✅ ครบ ' + s.ok }),
        h('small', { class: 'muted', text: 'ผลัด · ' + th(w.from) + '–' + th(w.to) }));
      rf(); draw();
      add(body.parentNode, h('details', { class: 'note db-legend' }, h('summary', { text: 'ℹ️ ความหมาย' }),
        h('div', { text: '✅ เข้าเวรและส่งเวรครบตามเวลา · 🔴 ไม่ได้เข้าเวร/ไม่ได้ส่งเวร · 🟠 ไม่สมบูรณ์: ส่งเวรช้า (เกิน ' + (w.rules.checkout / 60) + ' ชม. หลังจบผลัด) ว.42 ไม่กดจบ/นัดหรือรอรับกลับค้างเกิน 24 ชม. หรือคดีรออนุมัติ/ถูกส่งกลับ · 🔵 กำลังปฏิบัติ · ⚪ ยังไม่ถึงเวลา · ➖ ยกเลิกผลัด' }),
        h('div', { text: 'ตัวเลขในช่อง = ผลรวมที่รายงานในผลัดนั้น (ใบสั่ง ตักเตือน ตรวจรถ ช่วยเหลือ จับกุม ว.42 ภารกิจ) · แตะช่องเพื่อดูรายละเอียด' }),
        h('div', { text: 'เจ้าหน้าที่ส่งเข้าเวร/ส่งเวรย้อนหลังเองได้ภายใน ' + w.backDays + ' วัน (ระบบบันทึกว่าส่งช้า) · เกินนั้นหรือผลัดของผู้อื่นให้ธุรการบันทึกแทน' })));
    }, function (e) { clear(body); add(body, errorBox(e.message)); });
  }

  // หน้า "รายงาน" (v1.14): การ์ดประจำผลัด (สถานะผลัดของฉัน + 6 ปุ่ม) → ย้อนหลัง 7 วัน → หลังรายงาน → สถานะทั้งสถานี (พับไว้)
  VIEWS.report = function () {
    setTitle('📝 รายงาน', 'ประจำผลัด · ตรวจย้อนหลัง');
    clear($app);
    function tile(ic, color, title, sub, view) { return h('button', { class: 'tile', onclick: function () { go(view); } }, h('span', { class: 'ic', style: 'background:' + color, text: ic }), h('b', { text: title }), sub ? h('small', { text: sub }) : null); }
    if (can('report.own')) {
      var rp = h('div', { class: 'card rp' }); add($app, rp);
      add(rp, h('h3', null, '🧭 ประจำผลัด'));
      myDutyStrip(rp);
      add(rp, h('div', { class: 'tiles' },
        tile('▶', 'var(--green)', 'เข้าเวร', 'ยืนยันเจ้าหน้าที่/อุปกรณ์', 'checkin'),
        tile('✓', 'var(--blue)', 'ส่งเวร', 'ใบสั่งและผลการปฏิบัติ', 'checkout'),
        tile('🚔', 'var(--amber)', 'ว.42', 'ลงนัด · เริ่ม/จบ', 'escort'),
        tile('🤝', 'var(--teal)', 'ช่วยเหลือ', 'ว.18 ว.40 เหตุการณ์', 'assist'),
        tile('🚨', 'var(--red)', 'จับกุม', 'แบบ CCOC', 'arrest'),
        tile('🎖️', 'var(--violet)', 'ภารกิจ', 'จิตอาสา/ปฏิบัติการ', 'mission')));
    } else add($app, card('บทบาทของท่านไม่มีสิทธิ์ส่งรายงาน — ติดต่อแอดมิน'));
    add($app, h('div', { class: 'section-label', text: 'ตรวจย้อนหลัง' })); weekBoardCard($app);
    var more = h('div', { class: 'list' });
    add(more, rowLink('📁', 'คดีจับกุม', can('case.approve') ? 'ตรวจ/อนุมัติ/แก้ไข' : 'ติดตามคดี/แก้ไข', function () { go('cases'); }, can('case.approve') && S.boot.pending && S.boot.pending.arrest ? String(S.boot.pending.arrest) : ''));
    if (can('pr.make')) add(more, rowLink('🖼', 'สร้างภาพประชาสัมพันธ์', 'จากคดี/ผลการปฏิบัติ', function () { go('pr'); }));
    add($app, h('div', { class: 'section-label', text: 'หลังรายงาน' }), more);
    if (can('report.own')) { // สถานะการรายงานตามตารางเวร ทั้งสถานี — พับไว้ โหลดเมื่อเปิด
      var inner = h('div'), det = h('details', { class: 'card fold' }, h('summary', null, h('b', { text: '📋 สถานะการรายงานทั้งสถานี' }), h('small', { text: 'ตามตารางเวร' })), inner), loaded = false;
      det.addEventListener('toggle', function () { if (det.open && !loaded) { loaded = true; dutyBoardCard(inner, { bare: true, noMine: true }); } });
      add($app, det);
    }
  };

  // ======================= แท็บเพิ่มเติม =======================
  VIEWS.more = function () {
    setTitle('☰ เพิ่มเติม', S.boot.me.name + ' · ' + S.boot.perms.roleLabel);
    clear($app);
    var pend = S.boot.pending || {};
    function group(label, rows) { rows = rows.filter(Boolean); if (rows.length) add($app, h('div', { class: 'section-label', text: label }), h('div', { class: 'list' }, rows)); }
    group('ส่งรายงานผู้บังคับบัญชา', [
      rowLink('📅', 'ภาพสรุปผลประจำวัน', 'ภาพ 16:9 + รายละเอียดรายรถ · ส่งภาพ + ข้อความเข้าไลน์', function () { go('daily'); }),
      rowLink('📊', 'ภาพรายงานวงรอบ/เดือน', 'Dashboard · ตารางรายรถ · สัดส่วนภารกิจ · คดี', function () { go('dash'); }),
      can('export') ? rowLink('⬇️', 'ส่งออกไฟล์', 'Excel สถิติ · PDF · ข้อความ บก.ทล. · ไฟล์สำรอง', function () { go('export'); }) : null]);
    group('ผลงานและคะแนน', [rowLink('📝', 'รายการที่ส่งแล้ว', 'ดู · แก้ไข · ยกเลิก', function () { go('history'); }),
      rowLink('🏅', 'คะแนนผลการปฏิบัติ', 'เกณฑ์ · คะแนนและอันดับ', function () { go('score'); }),
      can('score.manage') ? rowLink('⚙️', 'ตั้งเกณฑ์คะแนน', 'ช่วงคะแนน · เกณฑ์มาตรฐาน · ประกาศเข้ากลุ่ม', function () { go('scoreAdmin'); }) : null]);
    group('💰 ธุรการค่าปรับ', [rowLink('💰', 'ภาพรวมค่าปรับ', fineAll() ? 'ยอดรับชำระ · รายคน/รายรถ · อัตราชำระ · สถานะทะเบียน' : 'ใบสั่งของฉันที่ชำระแล้ว', function () { go('fines'); }),
      can('fine.manage') ? rowLink('🧮', 'โปรแกรมทะเบียนค่าปรับ', 'กระทบยอด PTM ↔ KTB · ลงทะเบียน Excel (ใช้บนคอมพิวเตอร์)', openFines) : null,
      can('fine.manage') || S.boot.perms.admin ? rowLink('🎫', 'รหัสหมวก ↔ เจ้าหน้าที่', 'จับคู่อัตโนมัติ · แอดมินยืนยัน', function () { go('fineBadges'); }) : null]);
    group('งานคดี', [
      rowLink('📁', 'คดีจับกุม', can('case.approve') ? 'ตรวจ/อนุมัติ/แก้ไข' : 'ติดตามคดี', function () { go('cases'); }, can('case.approve') && pend.arrest ? String(pend.arrest) : ''),
      can('view.suspect') ? rowLink('🔎', 'ค้นหาผู้ต้องหา', 'ชื่อ / เลขบัตร / เบอร์ — ทุกการค้นหาถูกบันทึก', function () { go('suspects'); }) : null,
      can('pr.make') ? rowLink('🖼', 'สร้างภาพประชาสัมพันธ์', 'prompt + เบลอรูป', function () { go('pr'); }) : null]);
    group('ตารางเวรและเอกสาร', [
      can('view.now') ? rowLink('🗓', 'ตารางเวร', 'ใครเข้าผลัดไหน · สลับเวร', function () { go('roster'); }) : null,
      rowLink('📥', 'นำเข้าไฟล์ / คลังเอกสาร', 'คำสั่งเวร · แบ่งตามสายงาน · รายชื่อ · PDF/รูป', function () { go('files'); }, S.boot.filesPending ? String(S.boot.filesPending) : '')]);
    var pm = can('people.manage'), ad = S.boot.perms.admin;
    group('บุคลากร', [
      pm || can('perm.manage') || can('view.eval') ? rowLink('👥', 'บุคลากรและสิทธิ์', 'บทบาท · แท็กทักษะ · ผูก LINE', function () { go('admin'); }) : null,
      pm ? rowLink('📝', 'คำขอลงทะเบียน', '', function () { go('registrations'); }, pend.reg ? String(pend.reg) : '') : null,
      pm ? rowLink('📥', 'นำเข้า/อัปเดตกำลังพล', 'จากไฟล์ Excel (.xlsx) หรือ CSV', function () { go('peopleImport'); }) : null,
      pm || can('perm.manage') ? rowLink('🧾', 'ประวัติการใช้งาน', 'การแก้ไข · การเปิดดูข้อมูลผู้ต้องหา', function () { go('audit'); }) : null]);
    if (ad) group('งานระบบ (เฉพาะแอดมิน)', [
      rowLink('👁', 'จำลองมุมมองตามสิทธิ์', 'ดูแอปในมุมของแต่ละบทบาทหรือรายคน', function () { go('viewAs'); }),
      rowLink('🔐', 'สิทธิ์ตามบทบาท', 'กำหนดว่าแต่ละบทบาทเห็น/ทำอะไรได้', function () { go('roles'); }),
      rowLink('🧾', 'รหัสความผิด', 'เพิ่ม/แก้/ปิดรายการความผิด', function () { go('codes'); }),
      rowLink('⚙️', 'ตั้งค่าระบบ', 'โควตาข้อความ · การแจ้งเตือน · ข้อความมาตรฐาน', function () { go('settings'); })]);
    add($app, h('p', { class: 'muted small center', text: 'v' + S.boot.version + ' · ' + (S.boot.station || '') }));
  };

  // ======================= ธุรการค่าปรับ (v1.9) =======================
  function fineAll() { var p = S.boot.perms; return !!(p.admin || can('fine.manage') || (can('view.people') && p.scope === 'station')); }
  function finesUrl() { return location.href.replace(/[?#].*$/, '').replace(/[^\/]*$/, '') + 'fines.html'; }
  function openFines() {
    var u = finesUrl();
    if (window.liff && liff.isInClient && liff.isInClient()) openExternal(u); else window.open(u, '_blank', 'noopener');
    toast('เปิดโปรแกรมทะเบียนค่าปรับ — ใช้บนคอมพิวเตอร์ด้วย Google Chrome หรือ Microsoft Edge', 5000);
  }
  function baht(n) { n = +n || 0; return n.toLocaleString('en-US', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 }); }
  function pctTxt(v) { return v == null ? '–' : v + '%'; }
  function finePicker(onChange) {
    var t = today(), c = cycleOf(t), pc = cycleOf(addDays(c.from, -1)), m0 = t.slice(0, 8) + '01', pm = addDays(m0, -1);
    var a0 = +t.slice(8) >= 24 ? t.slice(0, 8) + '24' : addDays(m0, -1).slice(0, 8) + '24', a1 = addDays(a0.slice(0, 8) + '01', 40).slice(0, 8) + '23';
    var presets = [['วันนี้', t, t], ['เมื่อวาน', addDays(t, -1), addDays(t, -1)], ['วงรอบนี้', c.from, c.to], ['วงรอบก่อน', pc.from, pc.to], ['เดือนนี้', m0, t], ['เดือนก่อน', pm.slice(0, 8) + '01', pm], ['รอบบัญชี 24–23', a0, a1]];
    var sel = 4, chips = h('div', { class: 'chips' }), f = h('input', { type: 'date' }), to = h('input', { type: 'date' }), custom = h('div', { class: 'row', hidden: true, style: 'margin-top:8px' }, f, to);
    function r() {
      clear(chips);
      presets.forEach(function (p, i) { add(chips, h('button', { class: 'chip' + (i === sel ? ' on' : ''), onclick: function () { sel = i; custom.hidden = true; r(); onChange(p[1], p[2]); }, text: p[0] })); });
      add(chips, h('button', { class: 'chip' + (sel === -1 ? ' on' : ''), onclick: function () { sel = -1; custom.hidden = false; r(); }, text: 'กำหนดเอง' }));
    }
    f.onchange = to.onchange = function () { if (f.value && to.value) onChange(f.value, to.value); };
    r(); setTimeout(function () { onChange(presets[sel][1], presets[sel][2]); }, 0);
    return h('div', { class: 'card' }, chips, custom);
  }
  VIEWS.fines = function (params) {
    var all = fineAll();
    setTitle('💰 ธุรการค่าปรับ', all ? 'ภาพรวมค่าปรับทั้งสถานี' : 'ใบสั่งของฉันที่ชำระแล้ว');
    clear($app);
    if (can('fine.manage') || S.boot.perms.admin) {
      var tools = h('div', { class: 'list' });
      if (can('fine.manage')) add(tools, rowLink('🧮', 'โปรแกรมทะเบียนค่าปรับ', 'กระทบยอด PTM ↔ KTB · ลงทะเบียน Excel (ใช้บนคอมพิวเตอร์ ขั้นตอนเหมือนเดิม)', openFines));
      add(tools, rowLink('🎫', 'รหัสหมวก ↔ เจ้าหน้าที่', 'จับคู่อัตโนมัติจากชื่อ · แอดมินยืนยัน', function () { go('fineBadges'); }));
      add($app, tools);
    }
    var tab = params.tab || (all ? 'recv' : 'mine'), data = null, out = h('div'), segWrap = h('div', { class: 'card', style: 'padding:6px' });
    var TABS_ = all ? [['recv', '💵 ยอดรับชำระ'], ['people', '👮 รายคน/รถ'], ['rate', '📈 อัตราชำระ'], ['ledger', '📒 ทะเบียน']] : [];
    function seg() {
      clear(segWrap); if (!TABS_.length) { segWrap.hidden = true; return; }
      var s = h('div', { class: 'seg fn-seg' }); TABS_.forEach(function (x) { add(s, h('button', { class: x[0] === tab ? 'on' : '', onclick: function () { tab = x[0]; seg(); paint(); }, text: x[1] })); }); add(segWrap, s);
    }
    add($app, finePicker(load), segWrap, out); seg();
    function load(a, b) {
      clear(out); add(out, h('div', { class: 'loading' }, spinner()), skeleton(2));
      live('fine.dash', { from: a, to: b }, function (d) { data = d; paint(); }, function (e) { clear(out); add(out, errorBox(e.message)); });
    }
    function paint() {
      if (!data) return; clear(out);
      var rg = data.from === data.to ? th(data.from) : th(data.from) + ' – ' + th(data.to);
      if (data.scope !== 'all') return fineMine(out, data, rg);
      if (tab === 'recv') fineRecv(out, data, rg);
      else if (tab === 'people') finePeople(out, data, rg);
      else if (tab === 'rate') fineRate(out, data, rg);
      else fineLedger(out, data);
      add(out, h('div', { class: 'center', style: 'margin:4px 0 12px' }, xlBtn('ภาพรวมค่าปรับเป็น .xlsx', function () { fineXlsx(data, rg); })));
    }
  };
  function fineXlsx(d, rg) {
    var sh = [], r = d.received;
    if (r) {
      sh.push({ name: 'รับชำระรายวัน', head: ['วันที่', 'ใบสั่งที่ชำระ', 'ยอดรับชำระ (PTM)', 'เงินเข้า KTB', 'ลงทะเบียน'], rows: r.byDay.map(function (x) { return [x.date, x.n, x.amt, x.ktb, x.booked]; }) });
      sh.push({ name: 'แยก พ.ร.บ.', head: ['พ.ร.บ.', 'ใบสั่ง', 'บาท'], rows: Object.keys(r.byAct).map(function (a) { return [a, r.byAct[a].n, r.byAct[a].amt]; }) });
      sh.push({ name: 'แยกช่องทาง', head: ['ช่องทาง', 'ใบสั่ง', 'บาท'], rows: Object.keys(r.byGroup).map(function (g) { return [d.groups[g] || g, r.byGroup[g].n, r.byGroup[g].amt]; }) });
    }
    sh.push({ name: 'รายคน', head: ['ชื่อ', 'รายงาน (ออกเอง)', 'ชำระแล้ว', 'อัตรา %', 'บาท', 'ใบสั่งกล้อง'], rows: (d.officers || []).map(function (p) { return [p.name, p.reported, p.paid, p.rate == null ? '' : p.rate, p.paidAmt, p.cam || 0]; }) });
    if (d.cars) sh.push({ name: 'รายรถ', head: ['รถ', 'รายงาน', 'ชำระแล้ว', 'อัตรา %', 'บาท'], rows: d.cars.map(function (x) { return [x.car, x.reported, x.paid, x.rate == null ? '' : x.rate, x.paidAmt]; }) });
    if (d.unmatched) sh.push({ name: 'ยังไม่ทราบผู้ออก', head: ['รหัสหมวก', 'ชื่อใน PTM', 'ใบ', 'ใบสั่งกล้อง', 'บาท'], rows: d.unmatched.map(function (u) { return [u.badge || '', u.name || '', u.n, u.cam || 0, u.amt]; }) });
    if (d.rate) sh.push({ name: 'อัตราชำระ', head: ['พ.ร.บ.', 'รายงาน', 'ชำระแล้ว', 'อัตรา %'], rows: d.rate.byAct.map(function (x) { return [x.act, x.reported, x.paid, x.rate == null ? '' : x.rate]; }).concat([['รวม', d.rate.reported, d.rate.paid, d.rate.rate == null ? '' : d.rate.rate]]) });
    var info = [['ช่วงวันที่', rg]];
    if (d.issuers) info.push(['ผู้ออกใบสั่ง', 'รายงาน ' + d.issuers.tickets + ' ใบ · ปรับตาม PTM ' + d.issuers.ptm + ' · รอเทียบ PTM ' + d.issuers.unknown]);
    xlsxDownload('ค่าปรับ_' + d.from + '_' + d.to + '.xlsx', sh, info);
  }
  /** เทียบผู้ออกใบสั่งกับ PTM ทีละเดือน (ตั้งแต่ ส.ค. 69 ที่เริ่มมีข้อมูล) */
  function fineMatchAll(btn, done2) {
    var months = [], d = '2026-08-01', end = today();
    while (d <= end) { // ครึ่งเดือนต่อครั้ง (1–15, 16–สิ้นเดือน) กันเกินเวลารอ
      var last = +d.slice(8) <= 15 ? d.slice(0, 8) + '15' : addDays(addDays(d.slice(0, 8) + '28', 4).slice(0, 8) + '01', -1);
      months.push([d, last > end ? end : last]); d = addDays(last, 1);
    }
    var sum = { changed: 0, moved: 0, unknown: 0 }, i = 0;
    function next() {
      if (i >= months.length) return Promise.resolve(sum);
      var m = months[i++]; btn.textContent = 'กำลังเทียบ ' + th(m[0]) + '–' + th(m[1]) + '… (' + i + '/' + months.length + ')';
      return api('fine.match', { from: m[0], to: m[1] }).then(function (r) { sum.changed += r.changed; sum.moved += r.moved; sum.unknown += r.unknown; return next(); });
    }
    return next().then(function (r) { toast('✅ เทียบเสร็จ: ปรับ ' + r.changed + ' ผลัด (' + r.moved + ' ใบ) · ยังรอเทียบ ' + r.unknown + ' ใบ', 6000); if (done2) done2(); });
  }
  function kpiBox(items) { var k = h('div', { class: 'kpis' }); items.forEach(function (x) { add(k, h('div', { class: 'kpi', style: 'border-top:3px solid ' + (x[2] || '#94a3b8') }, h('div', { class: 'n', text: x[0] }), h('div', { class: 't', text: x[1] }))); }); return k; }
  function fineTable(head, rows) {
    var t = h('table', { class: 't' }), hr = h('tr'); head.forEach(function (x) { add(hr, h('th', { text: x })); }); add(t, h('thead', null, hr));
    var tb = h('tbody'); rows.forEach(function (r) { var tr = h('tr'); r.forEach(function (c) { add(tr, c && c.nodeType ? h('td', null, c) : h('td', { text: c == null ? '' : String(c) })); }); add(tb, tr); }); add(t, tb);
    return h('div', { class: 'tscroll' }, t);
  }
  function rateChip(v) { return h('span', { class: 'fn-rate ' + (v == null ? 'na' : v >= 70 ? 'hi' : v >= 40 ? 'mid' : 'lo'), text: pctTxt(v) }); }
  function fineRecv(out, d, rg) {
    var r = d.received; if (!r) return;
    var c = card('💵 ยอดรับชำระค่าปรับ', rg);
    add(c, kpiBox([[baht(r.amt), 'ยอดรับชำระ (บาท)', '#0f7a5c'], [fmtN(r.n), 'ใบสั่งที่ชำระ', '#1f5fbf'], [baht(r.ktb), 'เงินเข้า KTB (บาท)', '#8b5cf6'], [baht(r.booked), 'ลงทะเบียน (บาท)', '#e8812b'], [r.daysSaved, 'วันที่บันทึกทะเบียน', '#64748b']]));
    if (r.byDay.length > 1) add(c, h('div', { class: 'small muted', style: 'margin:10px 0 2px', text: 'ยอดรับชำระรายวัน (พันบาท)' }), Charts.bar(r.byDay.slice(-31).map(function (x) { return { label: String(+x.date.slice(8)), values: { a: Math.round(x.amt / 100) / 10, k: Math.round(x.ktb / 100) / 10 } }; }), [{ key: 'a', label: 'รับชำระ (PTM)', color: '#0f7a5c' }, { key: 'k', label: 'เงินเข้า KTB', color: '#8b5cf6' }]));
    add(out, c);
    var acts = Object.keys(r.byAct).sort(function (a, b) { return r.byAct[b].amt - r.byAct[a].amt; });
    var ca = card('⚖️ แยกตาม พ.ร.บ.'); add(ca, fineTable(['พ.ร.บ.', 'ใบสั่ง', 'บาท', 'สัดส่วน'], acts.map(function (a) { var x = r.byAct[a]; return [a + (a === d.camAct ? ' 📷' : ''), fmtN(x.n), baht(x.amt), r.amt ? Math.round(x.amt * 100 / r.amt) + '%' : '']; })));
    add(ca, h('p', { class: 'small muted', style: 'margin:6px 0 0', text: '📷 พ.ร.บ.ทางหลวง ส่วนใหญ่เป็นใบสั่งจากกล้อง (ความเร็ว/ไฟแดง)' }));
    var gs = Object.keys(r.byGroup).sort(function (a, b) { return r.byGroup[b].amt - r.byGroup[a].amt; });
    var cg = card('🏦 แยกตามช่องทางชำระ'); add(cg, Charts.share(gs.map(function (g) { return { label: (d.groups[g] || g) + ' · ' + baht(r.byGroup[g].amt) + ' บ.', value: r.byGroup[g].n }; })));
    add(out, ca, cg, h('p', { class: 'small muted center', text: 'ยอดรับชำระตามวันที่ชำระ (รายงาน PTM) · เงินเข้า KTB/ลงทะเบียน จากโปรแกรมทะเบียนค่าปรับ' }));
  }
  function finePeople(out, d, rg) {
    if (d.issuers) {
      var iss = d.issuers, ic = card('🧾 ผู้ออกใบสั่ง (เทียบ PTM)', rg);
      add(ic, h('div', { class: 'iss-row' }, h('div', null, h('b', { text: fmtN(iss.tickets) }), h('small', { text: 'ใบสั่งที่รายงาน' })),
        h('div', null, h('b', { text: fmtN(iss.ptm) }), h('small', { text: 'ปรับผู้ออกตาม PTM' })), h('div', null, h('b', { text: fmtN(iss.unknown), style: iss.unknown ? 'color:#6d28d9' : '' }), h('small', { text: '❓ รอเทียบ PTM' }))),
        h('p', { class: 'small muted', style: 'margin:0', text: 'เมื่อบันทึกวันในโปรแกรมทะเบียน ระบบเทียบผู้ออกใบสั่งตาม PTM อัตโนมัติ (ไฟล์ทางการที่สุด) · ใบที่ยังไม่ชำระคง "รอเทียบ" จนกว่าจะพบใน PTM · ยอดรถ/สถานีไม่เปลี่ยน' }));
      if (iss.canMatch) { var mb = submitBtn('🔄 เทียบย้อนหลังทั้งหมดตอนนี้', 'ghost block', function () { return fineMatchAll(mb, function () { VIEWS.fines({ tab: 'people' }); }); }); add(ic, h('div', { style: 'margin-top:8px' }, mb)); }
      add(out, ic);
    }
    var c = card('👮 รายคน: รายงาน vs ชำระแล้ว', rg);
    var ppl = d.officers || [];
    add(c, ppl.length ? fineTable(['ชื่อ', 'รายงาน', 'ชำระ', '%', 'บาท', '📷'], ppl.map(function (p) { return [p.name, fmtN(p.reported), fmtN(p.paid), rateChip(p.rate), baht(p.paidAmt), p.cam ? fmtN(p.cam) : '']; }))
      : h('p', { class: 'muted small', text: 'ยังไม่มีข้อมูลในช่วงนี้' }));
    if (!d.issuerKnown && (d.cars || []).some(function (x) { return x.reported; })) add(c, h('div', { class: 'fn-notes', text: 'ℹ️ ช่วงนี้มีข้อมูลที่นำเข้าจาก Excel ซึ่งไม่ระบุผู้ออกใบสั่งรายคน — ช่อง "รายงาน" รายคนจึงว่าง ดูการเทียบได้ที่ตารางรายรถและแท็บอัตราชำระ' }));
    add(c, h('p', { class: 'small muted', style: 'margin:6px 0 0', text: 'นับตามวันที่ออกใบสั่ง · "ชำระแล้ว" ไม่รวมใบสั่งกล้อง (พ.ร.บ.ทางหลวง) ซึ่งไม่ได้รายงานผ่านระบบ · ใบสั่งส่วนใหญ่ชำระภายใน 8–30 วัน ช่วงล่าสุดจึงยังต่ำ' }));
    add(out, c);
    if (d.cars && d.cars.length) {
      var cc = card('🚓 รายรถ', 'ตามรถที่ผู้ออกใบสั่งขึ้นในวันนั้น');
      add(cc, fineTable(['รถ', 'รายงาน', 'ชำระ', '%', 'บาท'], d.cars.map(function (x) { return [x.car, fmtN(x.reported), fmtN(x.paid), rateChip(x.rate), baht(x.paidAmt)]; })));
      add(out, cc);
    }
    if (d.unmatched && d.unmatched.length) {
      var cu = card('❔ ยังไม่ทราบผู้ออกใบสั่ง', d.unmatched.reduce(function (a, u) { return a + u.n; }, 0) + ' ใบ');
      add(cu, fineTable(['รหัสหมวก / ชื่อใน PTM', 'ใบ', 'บาท'], d.unmatched.map(function (u) { return [(u.badge ? u.badge + ' · ' : '') + (u.name || '(ไม่มีชื่อ)'), fmtN(u.n) + (u.cam ? ' (📷' + u.cam + ')' : ''), baht(u.amt)]; })));
      if (can('fine.manage') || S.boot.perms.admin) add(cu, h('button', { class: 'btn gray block', style: 'margin-top:8px', onclick: function () { go('fineBadges'); }, text: '🎫 จับคู่รหัสหมวก ↔ เจ้าหน้าที่' }));
      add(out, cu);
    }
  }
  function lagBars(lag, labels) { return Charts.hbar(labels.map(function (l, i) { return { label: l, values: { n: lag[i] || 0 } }; }).filter(function (x) { return x.values.n; }), [{ key: 'n', label: 'ใบสั่ง', color: '#1f5fbf' }], { labelW: 96 }); }
  function fineRate(out, d, rg) {
    var r = d.rate, c = card('📈 อัตราการชำระค่าปรับ', rg);
    add(c, kpiBox([[pctTxt(r.rate), 'อัตราการชำระ', '#0f7a5c'], [fmtN(r.reported), 'ใบสั่งที่รายงานในระบบ', '#1f5fbf'], [fmtN(r.paid), 'ชำระแล้ว', '#8b5cf6'], [fmtN(Math.max(0, r.reported - r.paid)), 'ยังไม่ชำระ (โดยประมาณ)', '#d64545']]));
    if (r.rate != null) add(c, Charts.gauge(Math.min(100, r.rate), 'ชำระแล้ว ' + r.paid + ' จาก ' + r.reported + ' ใบที่รายงาน (' + r.rate + '%)'));
    add(out, c);
    var ca = card('⚖️ แยกตาม พ.ร.บ.'); add(ca, fineTable(['พ.ร.บ.', 'รายงาน', 'ชำระแล้ว', '%'], r.byAct.map(function (x) { return [x.act, fmtN(x.reported), fmtN(x.paid), rateChip(x.rate)]; })));
    var cl = card('⏱ ระยะเวลาจากวันออกใบสั่งถึงวันชำระ'); add(cl, lagBars(r.lag, d.lagLabels));
    add(out, ca, cl, card('📷 ใบสั่งจากกล้อง (พ.ร.บ.ทางหลวง)', fmtN(r.cam.n) + ' ใบ · ' + baht(r.cam.amt) + ' บาท'),
      h('p', { class: 'small muted center', text: 'อัตราการชำระ = ใบสั่งที่ออกในช่วงนี้และชำระแล้ว ÷ ใบสั่งที่รายงานผ่านระบบ (โดยประมาณ) — ไม่รวมใบสั่งกล้อง' }));
  }
  function fineLedger(out, d) {
    var L = d.ledger || {};
    if (L.empty) { add(out, card('📒 สถานะทะเบียนค่าปรับ'), h('p', { class: 'muted center', text: 'ยังไม่มีข้อมูลจากโปรแกรมทะเบียนค่าปรับ — เจ้าหน้าที่การเงินเปิดโปรแกรมจากเมนูนี้บนคอมพิวเตอร์แล้วบันทึกวันตามปกติ ระบบจะได้รับข้อมูลอัตโนมัติ' })); return; }
    var c = card('📒 รอบบัญชี ' + th(L.cycleStart) + ' – ' + th(L.cycleEnd), L.file || '');
    var st = L.missing.length > 1 ? 'late' : L.missing.length ? 'due' : 'done';
    add(c, h('div', { class: 'fn-status f-' + st }, h('b', { text: (st === 'done' ? '✅ บันทึกครบถึงเมื่อวาน' : st === 'due' ? '🟡 ค้างบันทึก 1 วัน' : '🔴 ค้างบันทึก ' + L.missing.length + ' วัน') }),
      h('span', { text: ' · บันทึกแล้ว ' + L.saved + '/' + L.days + ' วัน · ล่าสุดวันที่ ' + th(L.lastDate) })));
    add(c, kpiBox([[baht(L.ptm), 'ยอด PTM ในรอบ', '#0f7a5c'], [baht(L.ktb), 'เงินเข้า KTB', '#8b5cf6'], [baht(L.booked), 'ลงทะเบียน', '#e8812b'], [baht(L.pending), 'ค้างรับ (' + L.pendingCount + ' รายการ)', '#d64545'], [L.offbookOpen, 'นอกทะเบียนค้างจัดการ', L.offbookOpen ? '#d64545' : '#94a3b8']]));
    var notes = [];
    if (L.missing.length) notes.push('📅 ยังไม่บันทึก: ' + L.missing.slice(0, 12).map(th).join(', ') + (L.missing.length > 12 ? ' …' : ''));
    if (L.undone.length) notes.push('↩️ ยกเลิกวันแล้วยังไม่บันทึกใหม่: ' + L.undone.map(th).join(', '));
    L.flags.forEach(function (f) { notes.push('⚠️ ' + th(f.date) + ': ' + [f.manual ? 'กรอกยอดเอง' : '', f.check1 === '✗' ? 'ตรวจ 1 ไม่ผ่าน' : '', f.check2 === '✗' ? 'ตรวจ 2 ไม่ผ่าน' : ''].filter(String).join(' · ')); });
    var pb = Object.keys(L.pendingBy || {}); if (pb.length) notes.push('⏳ ค้างรับแยกช่องทาง: ' + pb.map(function (g) { return (d.groups[g] || g) + ' ' + baht(L.pendingBy[g]); }).join(' · '));
    if (notes.length) add(c, h('div', { class: 'fn-notes' }, notes.map(function (n) { return h('div', { text: n }); })));
    add(c, h('p', { class: 'small muted', style: 'margin:8px 0 0', text: 'ส่งข้อมูลล่าสุด ' + (L.sentAt ? th(L.sentAt.slice(0, 10)) + ' ' + hm(L.sentAt) + ' น.' : '-') + (L.sentBy ? ' โดย ' + L.sentBy : '') }));
    add(out, c, h('details', { class: 'card small' }, h('summary', { text: 'ℹ️ ความหมายของสถานะ' }), h('div', { class: 'muted', style: 'margin-top:6px', text: '✅ บันทึกครบถึงเมื่อวาน · 🟡 ค้าง 1 วัน (ปกติ เพราะไฟล์ PTM/KTB ของเมื่อวานออกวันนี้) · 🔴 ค้างตั้งแต่ 2 วัน ควรติดตาม · ค้างรับ = เงินไปรษณีย์/ต่างสถานีที่ยังไม่เข้าบัญชี · นอกทะเบียน = เงินเข้าบัญชีแล้วแต่ไม่มีช่องในทะเบียน ต้องจัดการตามระเบียบ' })));
  }
  function fineMine(out, d, rg) {
    var me = (d.officers || [])[0] || { reported: 0, paid: 0, paidAmt: 0, rate: null, cam: 0, lag: [] };
    var c = card('🧾 ใบสั่งของฉัน', rg);
    add(c, kpiBox([[fmtN(me.reported), 'รายงานในระบบ', '#1f5fbf'], [fmtN(me.paid), 'ชำระแล้ว', '#0f7a5c'], [pctTxt(me.rate), 'อัตราการชำระ', '#8b5cf6'], [baht(me.paidAmt), 'ยอดชำระ (บาท)', '#e8812b']]));
    if (me.lag && me.lag.some(Boolean)) add(c, h('div', { class: 'small muted', style: 'margin-top:8px', text: 'ระยะเวลาถึงวันชำระ' }), lagBars(me.lag, d.lagLabels));
    add(out, c);
    var list = card('✅ ใบสั่งที่ชำระแล้ว', (d.mine || []).length + ' ใบ');
    add(list, (d.mine || []).length ? fineTable(['ชำระ', 'เลขใบสั่ง', 'พ.ร.บ.', 'บาท'], d.mine.map(function (t) { return [th(t.payDate), t.ticket, String(t.act).replace('พ.ร.บ.', ''), baht(t.amount)]; })) : h('p', { class: 'muted small', text: 'ยังไม่มีใบสั่งที่ชำระในช่วงนี้' }));
    add(out, list, h('p', { class: 'small muted center', text: 'ข้อมูลจากรายงานการรับชำระ PTM ที่เจ้าหน้าที่การเงินบันทึก · ไม่รวมใบสั่งกล้อง · ไม่แสดงข้อมูลผู้ชำระ' }));
  }
  VIEWS.fineBadges = function () {
    setTitle('🎫 รหัสหมวก ↔ เจ้าหน้าที่', 'จากรายงาน PTM');
    loading();
    api('fine.badges').then(function (d) {
      clear($app);
      var ST = { none: ['🔴', 'ยังไม่พบเจ้าหน้าที่'], auto: ['🟡', 'จับคู่อัตโนมัติ (รอยืนยัน)'], confirmed: ['✅', 'ยืนยันแล้ว'] };
      var cnt = { none: 0, auto: 0, confirmed: 0 }; d.rows.forEach(function (r) { cnt[r.status] = (cnt[r.status] || 0) + 1; });
      var head = card('สรุป', d.rows.length + ' รหัส/ชื่อ');
      add(head, h('div', { class: 'small', text: Object.keys(ST).map(function (k) { return ST[k][0] + ' ' + ST[k][1] + ' ' + cnt[k]; }).join(' · ') }));
      if (d.canConfirm && cnt.auto) add(head, h('button', { class: 'btn block', style: 'margin-top:8px', onclick: function (e) {
        e.currentTarget.disabled = true; api('fine.badge.confirmAll').then(function (r) { toast('ยืนยันแล้ว ' + r.confirmed + ' รายการ'); apiInvalidate(); VIEWS.fineBadges(); }, function (er) { toast(er.message, 4000); });
      }, text: '✅ ยืนยันทั้งหมดที่จับคู่อัตโนมัติ (' + cnt.auto + ')' }));
      if (!d.canConfirm) add(head, h('p', { class: 'small muted', style: 'margin:6px 0 0', text: 'แก้/ยืนยันการจับคู่ได้เฉพาะแอดมิน' }));
      add($app, head);
      if (!d.rows.length) add($app, h('p', { class: 'muted center', text: 'ยังไม่มีข้อมูล — จะขึ้นเมื่อโปรแกรมทะเบียนค่าปรับส่งข้อมูลใบสั่งเข้าระบบ' }));
      var list = h('div');
      d.rows.forEach(function (r) {
        var sel = h('select', { disabled: !d.canConfirm }, h('option', { value: '', text: '— ไม่ใช่เจ้าหน้าที่ในระบบ / กล้อง —' }));
        S.boot.people.slice().sort(function (a, b) { return a.first.localeCompare(b.first, 'th'); }).forEach(function (p) { add(sel, h('option', { value: p.pid, text: p.name, selected: p.pid === r.pid })); });
        var row = h('div', { class: 'card fn-badge f-' + (r.status === 'confirmed' ? 'done' : r.status === 'auto' ? 'due' : 'late') },
          h('div', { class: 'row' }, h('b', { class: 'grow', text: ST[r.status][0] + ' ' + (r.badge ? 'รหัส ' + r.badge : 'ไม่มีรหัสหมวก') }), h('small', { class: 'muted', text: r.n ? r.n + ' ใบ (120 วัน)' + (r.cam ? ' · 📷' + r.cam : '') : '' })),
          h('div', { class: 'small', text: 'ชื่อใน PTM: ' + ((r.names && r.names.length ? r.names : [r.ptmName]).filter(String).join(' / ') || '-') }),
          h('div', { class: 'small', text: 'ในระบบ: ' + (r.person || (r.status === 'confirmed' ? 'ไม่ใช่เจ้าหน้าที่ในระบบ' : 'ยังไม่พบ')) + (r.by ? ' · ยืนยันโดย ' + r.by : '') }),
          d.canConfirm ? h('div', { class: 'row', style: 'margin-top:6px' }, sel, h('button', { class: 'btn', onclick: function (e) {
            var b = e.currentTarget; b.disabled = true;
            api('fine.badge.set', { key: r.key, pid: sel.value }).then(function () { toast('บันทึกแล้ว'); apiInvalidate(); VIEWS.fineBadges(); }, function (er) { b.disabled = false; toast(er.message, 4000); });
          }, text: r.status === 'confirmed' ? 'แก้' : 'ยืนยัน' })) : null);
        add(list, row);
      });
      add($app, list);
    }, function (e) { clear($app); add($app, errorBox(e.message)); });
  };

  // ======================= ส่วนประกอบ: เลือกผลัด/รถ =======================
  function shiftPicker(mode, params, onChange) {
    var wrap = card('🚓 ผลัดและรถ');
    var mine = S.boot.myShifts || [];
    var cur = S.boot.current, guess = mode === 'checkout' ? S.boot.checkoutGuess : cur;
    var sel = null;
    if (params.d && params.s && params.car) sel = { dutyDate: params.d, shift: params.s, car: params.car };
    if (!sel) sel = mine.filter(function (x) { return x.dutyDate === guess.dutyDate && x.shift === guess.shift; })[0];
    if (!sel && mode !== 'checkout') sel = mine.filter(function (x) { return x.dutyDate + x.shift >= cur.dutyDate + cur.shift; })[0];
    if (!sel && mode === 'checkout') sel = mine.filter(function (x) { return x.dutyDate === cur.dutyDate && x.shift === cur.shift; })[0];
    var chips = h('div', { class: 'chips' }), manual = h('div', { hidden: true });
    function label(x) { return SHIFT[x.shift].icon + ' ' + th(x.dutyDate) + ' · ' + x.car; }
    function renderChips() {
      clear(chips);
      var seen = {};
      mine.concat(sel && !mine.some(function (x) { return same(x, sel); }) ? [sel] : []).forEach(function (x) {
        var k = x.dutyDate + x.shift + x.car; if (seen[k]) return; seen[k] = 1;
        add(chips, h('button', { class: 'chip' + (sel && same(x, sel) ? ' on' : ''), onclick: function () { sel = x; manual.hidden = true; renderChips(); onChange(sel); }, text: label(x) }));
      });
      add(chips, h('button', { class: 'chip' + (manual.hidden ? '' : ' on'), onclick: function () { manual.hidden = !manual.hidden; renderChips(); }, text: '✏️ เลือกเอง' }));
    }
    function same(a, b) { return a.dutyDate === b.dutyDate && a.shift === b.shift && String(a.car) === String(b.car); }
    var dIn = h('input', { type: 'date', value: (sel || guess).dutyDate }), sh = (sel || guess).shift;
    var seg = h('div', { class: 'seg' }), carSel = h('select');
    function renderSeg() { clear(seg); ['D', 'N'].forEach(function (k) { add(seg, h('button', { class: k === sh ? 'on' : '', onclick: function () { sh = k; renderSeg(); loadCars(); }, text: SHIFT[k].icon + ' ' + SHIFT[k].label })); }); }
    function loadCars() {
      clear(carSel); add(carSel, h('option', { text: 'กำลังโหลด…', value: '' }));
      api('shift.list', { dutyDate: dIn.value, shift: sh }).then(function (list) {
        clear(carSel); add(carSel, h('option', { value: '', text: '— เลือกรถ —' }));
        list.forEach(function (c) { add(carSel, h('option', { value: c.car + '|' + c.zone, text: 'เขต ' + c.zone + ' · ' + c.car + (c.status ? ' (' + c.status + ')' : '') + ' — ' + c.crew.map(function (m) { return person(m.pid).short; }).join(',') })); });
        add(carSel, h('option', { value: 'other', text: 'รถนอกตาราง…' }));
      }, function (e) { toast(e.message); });
    }
    carSel.onchange = function () {
      var v = carSel.value; if (!v) return;
      if (v === 'other') { var c = prompt('เลขรถ เช่น 3201 หรือ จ.326'); if (!c) return; var z = prompt('เขต (1-6)'); sel = { dutyDate: dIn.value, shift: sh, car: c.trim(), zone: +z || 0 }; }
      else sel = { dutyDate: dIn.value, shift: sh, car: v.split('|')[0], zone: +v.split('|')[1] };
      renderChips(); onChange(sel);
    };
    dIn.onchange = loadCars;
    renderSeg();
    add(manual, h('label', { class: 'f', text: 'วันที่เข้าเวร (ผลัดคืน = วันที่เริ่ม 18.00 น.)' }), dIn, h('label', { class: 'f', text: 'ผลัด' }), seg, h('label', { class: 'f', text: 'รถ' }), carSel);
    add(wrap, chips, manual);
    if (!mine.length) { manual.hidden = false; loadCars(); add(wrap, h('p', { class: 'muted small', text: 'ไม่พบผลัดของท่านในตารางเวรช่วงนี้ — เลือกวัน ผลัด และรถเอง' })); }
    renderChips();
    setTimeout(function () { if (sel) onChange(sel); }, 0);
    return wrap;
  }

  // ======================= ส่วนประกอบ: เจ้าหน้าที่ =======================
  var ROLES = ['พลขับ', 'พงว.', 'ประจำรถ', 'ผบ.รถ', 'แทน', 'เสริม'];
  function crewEditor(expected, existing) {
    var box = card('👮 เจ้าหน้าที่', 'ติ๊กเฉพาะคนที่ขึ้นรถจริง');
    var rows = [];
    var base = existing && existing.length ? existing.map(function (c) { return { pid: c.pid, role: c.role, on: true }; }) : [];
    (expected || []).forEach(function (c) {
      if (base.some(function (b) { return b.pid === c.pid; })) return;
      base.push({ pid: c.pid, role: c.role, on: !existing || !existing.length ? !c.away : false, away: c.away });
    });
    var list = h('div');
    function render() {
      clear(list);
      rows = base;
      base.forEach(function (c) {
        var p = person(c.pid);
        var role = h('select', { style: 'width:auto;padding:6px', onchange: function () { c.role = role.value; } });
        ROLES.concat(ROLES.indexOf(c.role) < 0 && c.role ? [c.role] : []).forEach(function (r) { add(role, h('option', { value: r, text: r, selected: r === c.role })); });
        add(list, h('div', { class: 'person' },
          h('input', { type: 'checkbox', checked: c.on, onchange: function (e) { c.on = e.target.checked; box.dispatchEvent(new Event('crewchange')); } }),
          h('div', { class: 'who' }, h('b', { text: p.name }), c.away ? h('span', { class: 'badge amber', text: c.away }) : null), role));
      });
    }
    render();
    add(box, list, h('button', { class: 'btn ghost sm', style: 'margin-top:8px', onclick: function () {
      pickPerson('เพิ่มเจ้าหน้าที่', function (p) { if (!base.some(function (b) { return b.pid === p.pid; })) base.push({ pid: p.pid, role: 'แทน', on: true }); render(); box.dispatchEvent(new Event('crewchange')); });
    }, text: '➕ เพิ่มคน (มาแทน/เสริม)' }));
    box.getCrew = function () { return base.filter(function (c) { return c.on; }).map(function (c) { return { pid: c.pid, role: c.role || 'ประจำรถ' }; }); };
    return box;
  }
  function pickPerson(title, cb, filterFn) {
    var q = h('input', { placeholder: '🔎 ค้นหาชื่อ', oninput: render }), list = h('div');
    function render() {
      clear(list);
      var s = q.value.trim().replace(/\s/g, '');
      S.boot.people.filter(function (p) { return (!filterFn || filterFn(p)) && (!s || (p.first + p.last + (p.nick || '')).indexOf(s) >= 0); }).slice(0, 50).forEach(function (p) {
        add(list, h('div', { class: 'person', style: 'cursor:pointer', onclick: function () { closeModal(); cb(p); } }, h('div', { class: 'who' }, h('b', { text: p.name }))));
      });
    }
    render();
    modal(title, [h('div', { class: 'search' }, q), list]);
    setTimeout(function () { q.focus(); }, 50);
  }
  function modal(title, body, okText, onOk) {
    var m = document.getElementById('modal'); clear(m); m.hidden = false;
    var sheet = h('div', { class: 'sheet' }, h('h3', { text: title }), body);
    var btns = h('div', { class: 'row', style: 'margin-top:12px' }, h('button', { class: 'btn gray grow', onclick: closeModal, text: 'ปิด' }));
    if (okText) add(btns, h('button', { class: 'btn grow', onclick: function (e) {
      var b = e.currentTarget; b.disabled = true;
      Promise.resolve(onOk()).then(function (r) { b.disabled = false; if (r !== false) closeModal(); }, function (err) { b.disabled = false; toast(err.message, 4000); });
    }, text: okText }));
    add(sheet, btns); add(m, sheet);
    m.onclick = function (e) { if (e.target === m) closeModal(); };
  }
  function closeModal() { var m = document.getElementById('modal'); m.hidden = true; clear(m); }
  function stepper(val, onChange, max) {
    var inp = h('input', { type: 'number', inputmode: 'numeric', min: '0', value: String(val || 0) });
    function set(v) { v = Math.max(0, Math.min(max || 999, v | 0)); inp.value = String(v); onChange(v); }
    inp.onchange = function () { set(+inp.value); };
    return h('div', { class: 'stepper' }, h('button', { type: 'button', onclick: function () { set((+inp.value || 0) - 1); }, text: '−' }), inp, h('button', { type: 'button', onclick: function () { set((+inp.value || 0) + 1); }, text: '+' }));
  }
  function submitBtn(text, cls, fn) {
    var b = h('button', { class: 'btn ' + (cls || ''), text: text });
    b.onclick = function () {
      if (b.disabled) return; b.disabled = true; var old = b.textContent; b.textContent = 'กำลังบันทึก…';
      Promise.resolve().then(fn).then(function () { b.disabled = false; b.textContent = old; }, function (e) { b.disabled = false; b.textContent = old; toast(e.code === 'CANCEL' ? 'ไม่ได้บันทึก (ยกเลิกเพราะซ้ำ)' : '⚠️ ' + e.message, 5000); });
    };
    return b;
  }

  // ======================= เข้าเวร =======================
  VIEWS.checkin = function (params) {
    setTitle('🟢 เข้าเวร', S.boot.me.name);
    clear($app);
    var body = h('div'), cur = null, crewBox = null, eq = {}, checks = {}, route = h('input', { placeholder: 'เช่น ทล.3 กม.87–130 / จุดตรวจ…' }), note = h('textarea', { placeholder: 'สภาพจราจร/อื่นๆ (ไม่บังคับ)' });
    add($app, shiftPicker('checkin', params, function (sel) {
      cur = sel; clear(body); add(body, h('div', { class: 'loading' }, spinner()), skeleton(2));
      api('shift.get', { dutyDate: sel.dutyDate, shift: sel.shift, car: sel.car }).then(function (g) {
        clear(body);
        if (g.record && g.record.checkinAt) add(body, h('div', { class: 'note', text: 'ผลัดนี้กดเข้าเวรแล้วเมื่อ ' + hm(g.record.checkinAt) + ' น. — บันทึกอีกครั้งเพื่อแก้เจ้าหน้าที่/อุปกรณ์' }));
        crewBox = crewEditor(g.expected, g.record && g.record.crew);
        // รายการตรวจ 3 ข้อ (ค่าตั้งต้นปกติ) — ติ๊กออกแล้วพิมพ์สิ่งที่ไม่ปกติแทน
        var ckBox = card('📋 รายการตรวจ', 'ติ๊กออกถ้าไม่ปกติ แล้วพิมพ์รายละเอียด');
        var saved = (g.record && g.record.checks) || {};
        (S.boot.checkinItems || []).forEach(function (it) {
          var key = it[0], ok = saved[key] === undefined || saved[key] === true, txt = h('input', { placeholder: it[2] + ' … (พิมพ์สิ่งที่พบ)', value: typeof saved[key] === 'string' ? saved[key] : '' });
          var cb = h('input', { type: 'checkbox', checked: ok });
          var row = h('div', { class: 'checkrow' }, h('label', { class: 'cap' }, cb, it[1]), txt);
          txt.hidden = ok; checks[key] = ok ? true : (txt.value || '');
          cb.onchange = function () { txt.hidden = cb.checked; checks[key] = cb.checked ? true : txt.value; if (!cb.checked) txt.focus(); };
          txt.oninput = function () { checks[key] = txt.value; };
          add(ckBox, row);
        });
        var eqBox = card('🧰 อุปกรณ์ประจำรถ', 'แตะเพื่อสลับ ✅/❌'), chips = h('div', { class: 'chips' });
        (S.boot.equipment || []).forEach(function (k) {
          eq[k] = !(g.record && g.record.equipment && g.record.equipment[k] === false);
          var b = h('button', { class: 'chip on', text: '✅ ' + k });
          function paint() { b.className = 'chip' + (eq[k] ? ' on' : ' warn'); b.textContent = (eq[k] ? '✅ ' : '❌ ') + k; }
          b.onclick = function () { eq[k] = !eq[k]; paint(); }; paint(); add(chips, b);
        });
        add(eqBox, chips);
        if (g.record) { route.value = g.record.route || ''; note.value = g.record.note || ''; }
        var r = card('🛣 เส้นทาง/หมายเหตุ'); add(r, route, h('label', { class: 'f', text: 'หมายเหตุ (จะขึ้นในรายงาน)' }), note);
        add(body, crewBox, ckBox, eqBox, r);
      }, function (e) { clear(body); add(body, errorBox(e.message)); });
    }), body, bar(submitBtn('🟢 ยืนยันเข้าเวร', 'green', function () {
      if (!cur) throw new Error('กรุณาเลือกผลัดและรถ');
      return api('checkin', { dutyDate: cur.dutyDate, shift: cur.shift, car: cur.car, zone: cur.zone, crew: crewBox.getCrew(), equipment: eq, checks: checks, route: route.value, note: note.value })
        .then(function (r) { refreshBoot(); done('เข้าเวรเรียบร้อย', r.message, { next: 'home' }); });
    })));
  };

  // ======================= ส่งเวร / ผลการปฏิบัติ =======================
  VIEWS.checkout = function (params) {
    setTitle('✅ ส่งเวร', 'ผลการปฏิบัติประจำผลัด');
    clear($app);
    var body = h('div'), cur = null, crewBox = null, rec = null;
    var state = { tickets: {}, warnings: 0, truckChecks: 0, suspectChecks: 0 }; // tickets[pid][code] = n
    var reason = h('textarea', { placeholder: 'เหตุผลการแก้ไข (จำเป็นเมื่อแก้หลัง 24 ชม. หรือแก้แทนผู้อื่น)' }), note = h('textarea', { placeholder: 'หมายเหตุ (ไม่บังคับ)' });
    add($app, shiftPicker('checkout', params, function (sel) {
      cur = sel; clear(body); add(body, h('div', { class: 'loading' }, spinner()), skeleton(2));
      api('shift.get', { dutyDate: sel.dutyDate, shift: sel.shift, car: sel.car }).then(function (g) {
        rec = g.record; state.tickets = {}; state.warnings = state.truckChecks = state.suspectChecks = 0;
        g.events.forEach(function (e) {
          if (e.type === 'ticket') { var ik = e.issuerId || '?'; state.tickets[ik] = state.tickets[ik] || {}; state.tickets[ik][e.sub] = (state.tickets[ik][e.sub] || 0) + e.count; }
          if (e.type === 'warning') state.warnings += e.count;
          if (e.type === 'truck_check') state.truckChecks += e.count;
          if (e.type === 'suspect_check') state.suspectChecks += e.count;
        });
        if (rec && rec.note) note.value = rec.note;
        render(g);
      }, function (e) { clear(body); add(body, errorBox(e.message)); });
    }), body);
    function render(g) {
      clear(body);
      if (rec && rec.checkoutAt) add(body, h('div', { class: 'note', text: '✏️ ผลัดนี้ส่งเวรแล้วเมื่อ ' + th(rec.checkoutAt.slice(0, 10)) + ' ' + hm(rec.checkoutAt) + ' น. — การส่งครั้งนี้จะแทนที่ข้อมูลเดิม (ไม่นับซ้ำ)' }));
      crewBox = crewEditor(g.expected, rec && rec.crew);
      crewBox.addEventListener('crewchange', function () { renderTickets(); });
      add(body, crewBox);
      var during = g.events.filter(function (e) { return e.type === 'escort' || e.type === 'assist' || e.type === 'arrest'; });
      if (during.length) {
        var c = card('📌 รายการระหว่างผลัด (บันทึกไว้แล้ว)');
        during.forEach(function (e) { add(c, h('div', { class: 'list-item' }, h('span', { text: e.type === 'escort' ? '🚔' : e.type === 'assist' ? '🤝' : '🚨' }), h('div', { class: 'grow', text: e.sub + (e.payload && e.payload.name ? ' · ' + e.payload.name : '') }), e.status === 'active' ? h('span', { class: 'badge amber', text: 'ยังไม่จบ' }) : e.status === 'waiting' ? h('span', { class: 'badge purple', text: 'รอรับกลับ' }) : null)); });
        add(body, c);
      }
      add(body, ticketsCard);
      var other = card('📋 งานอื่นในผลัด');
      [['warnings', '🗣️ ว่ากล่าวตักเตือน', 'ราย'], ['truckChecks', '🚛 ตรวจสอบรถบรรทุก', 'คัน'], ['suspectChecks', '🔎 ตรวจรถต้องสงสัย', 'คัน']].forEach(function (x) {
        add(other, h('div', { class: 'vrow' }, h('div', { class: 'lbl' }, x[1], h('small', { text: x[2] })), stepper(state[x[0]], function (v) { state[x[0]] = v; updateBar(); })));
      });
      add(body, other);
      var nc = card('📝 หมายเหตุ'); add(nc, note); add(body, nc);
      if (rec && rec.checkoutAt) { var rc = card('เหตุผลการแก้ไข'); add(rc, reason); add(body, rc); }
      add(body, barEl);
      renderTickets();
    }
    // --- ใบสั่งรายผู้ออก ---
    var ticketsCard = card('🧾 ใบสั่ง', 'เลือกผู้ออก แล้วกด + ตามความผิด');
    var issuer = null, group = 'truck';
    function renderTickets() {
      clear(ticketsCard); add(ticketsCard, h('h3', null, '🧾 ใบสั่ง', h('span', { class: 'right', text: 'เลือกผู้ออก แล้วกด + ตามความผิด' })));
      var crew = crewBox ? crewBox.getCrew() : [];
      if (!crew.length) { add(ticketsCard, h('p', { class: 'muted', text: 'ติ๊กเจ้าหน้าที่ก่อน' })); updateBar(); return; }
      // "ยังไม่ระบุผู้ออก (รอเทียบ PTM)" — เฉพาะผู้บันทึกแทน (เจ้าหน้าที่เห็นเมื่อธุรการลงไว้แล้ว: คงไว้/ลดได้)
      var unkOk = can('report.editOthers') || sumObj(state.tickets['?']) > 0;
      if (!issuer || (issuer === '?' ? !unkOk : !crew.some(function (c) { return c.pid === issuer; }))) issuer = crew[0].pid;
      var who = h('div', { class: 'chips', style: 'margin-bottom:10px' });
      crew.forEach(function (c) {
        var n = sumObj(state.tickets[c.pid]);
        add(who, h('button', { class: 'chip' + (c.pid === issuer ? ' on' : ''), onclick: function () { issuer = c.pid; renderTickets(); }, text: '👮 ' + person(c.pid).short + (n ? ' (' + n + ')' : '') }));
      });
      if (unkOk) { var nu = sumObj(state.tickets['?']); add(who, h('button', { class: 'chip unk' + (issuer === '?' ? ' on' : ''), onclick: function () { issuer = '?'; renderTickets(); }, text: '❓ ยังไม่ระบุผู้ออก (รอเทียบ PTM)' + (nu ? ' (' + nu + ')' : '') })); }
      var seg = h('div', { class: 'seg', style: 'margin-bottom:6px' });
      Object.keys(S.boot.groups).forEach(function (g) { add(seg, h('button', { class: g === group ? 'on' : '', onclick: function () { group = g; renderTickets(); }, text: S.boot.groups[g] })); });
      add(ticketsCard, who);
      if (issuer === '?') add(ticketsCard, h('p', { class: 'note small', style: 'margin:0 0 8px', text: '❓ ใช้เมื่อไม่ทราบว่าใครออก — นับเข้ารถ/สถานีทันที ระบบจะเปลี่ยนเป็นผู้ออกตามไฟล์ PTM อัตโนมัติเมื่อเจ้าหน้าที่การเงินอัปเดต (ใบที่ยังไม่ชำระคง "รอเทียบ")' + (can('report.editOthers') ? '' : ' · เจ้าหน้าที่เพิ่มเองไม่ได้ ลดหรือย้ายไปที่ชื่อผู้ออกได้') }));
      add(ticketsCard, seg);
      var mine = state.tickets[issuer] = state.tickets[issuer] || {};
      S.boot.violations.filter(function (v) { return v.group === group; }).forEach(function (v) {
        var row = h('div', { class: 'vrow' + (mine[v.code] ? ' has' : '') }, h('div', { class: 'lbl' }, v.label, h('small', { text: 'พ.ร.บ.' + v.act })),
          stepper(mine[v.code] || 0, function (n) { if (n) mine[v.code] = n; else delete mine[v.code]; row.className = 'vrow' + (n ? ' has' : ''); summaryLine(); updateBar(); }, 300));
        add(ticketsCard, row);
      });
      var sumBox = h('div', { class: 'small', style: 'margin-top:10px' });
      add(ticketsCard, sumBox);
      function summaryLine() {
        clear(sumBox);
        var lines = [];
        Object.keys(state.tickets).forEach(function (pid) { Object.keys(state.tickets[pid]).forEach(function (code) { var v = S.boot.violations.filter(function (x) { return x.code === code; })[0]; lines.push((v ? v.short : code) + ' ' + state.tickets[pid][code] + ' — ' + (pid === '?' ? 'ยังไม่ระบุ' : person(pid).short)); }); });
        if (lines.length) add(sumBox, h('b', { text: 'รวม: ' }), lines.join(' · '));
      }
      summaryLine(); updateBar();
    }
    function sumObj(o) { var s = 0; Object.keys(o || {}).forEach(function (k) { s += o[k]; }); return s; }
    function totalTickets() { var s = 0; Object.keys(state.tickets).forEach(function (p) { s += sumObj(state.tickets[p]); }); return s; }
    var mainBtn = submitBtn('✅ ส่งเวร', 'green', function () { return send(false); });
    var noBtn = submitBtn('⚪ ไม่มีผล', 'gray', function () { return send(true); });
    var barEl = bar(noBtn, mainBtn);
    function updateBar() {
      var n = totalTickets(), other = state.warnings + state.truckChecks + state.suspectChecks;
      mainBtn.textContent = '✅ ส่งเวร' + (n ? ' · ใบสั่ง ' + n : '');
      noBtn.hidden = !!(n || other);
    }
    function send(noResult) {
      if (!cur) throw new Error('กรุณาเลือกผลัดและรถ');
      var crew = crewBox.getCrew(), tickets = [];
      Object.keys(state.tickets).forEach(function (pid) {
        Object.keys(state.tickets[pid]).forEach(function (code) {
          if (pid !== '?' && !crew.some(function (c) { return c.pid === pid; })) throw new Error(person(pid).short + ' ไม่ได้อยู่ในเจ้าหน้าที่ แต่มีใบสั่ง — ติ๊กชื่อหรือลบใบสั่ง');
          tickets.push({ pid: pid, code: code, count: state.tickets[pid][code] });
        });
      });
      if (noResult && !confirm('ยืนยัน "ไม่มีผล" ในผลัดนี้?')) return;
      return api('checkout', { dutyDate: cur.dutyDate, shift: cur.shift, car: cur.car, zone: cur.zone, crew: crew, tickets: tickets, warnings: state.warnings,
        truckChecks: state.truckChecks, suspectChecks: state.suspectChecks, noResult: noResult, note: note.value, reason: reason.value })
        .then(function (r) { refreshBoot(); done(noResult ? 'ส่งเวร (ไม่มีผล) เรียบร้อย' : 'ส่งเวรเรียบร้อย', r.message); });
    }
  };

  // ======================= ว.42 =======================
  // ======================= ว.42: ลงนัด → ขาไป → รอรับกลับ → ขากลับ → จบ (ปุ่มเดียวตามขั้น) =======================
  var ESC_CANCEL = ['ขบวนยกเลิก', 'เปลี่ยนภารกิจ', 'หน่วยอื่นรับแทน', 'ลงนัดผิด'];
  function nowLocal() { var t = bkkNow(); return isoOf(t) + 'T' + pad(t.getHours()) + ':' + pad(t.getMinutes()); }
  function minsBetween(a, b) { var x = Date.parse(String(a).slice(0, 16) + ':00+07:00'), y = Date.parse(String(b).slice(0, 16) + ':00+07:00'); return isNaN(x) || isNaN(y) ? 0 : Math.round((y - x) / 60000); }
  function durTxt(m) { m = Math.abs(m); return m < 60 ? m + ' น.' : Math.floor(m / 60) + ' ชม.' + (m % 60 ? ' ' + (m % 60) + ' น.' : ''); }
  function addMin(iso, m) { var t = new Date(Date.parse(String(iso).slice(0, 16) + ':00+07:00') + m * 60000 + (7 * 60 + new Date().getTimezoneOffset()) * 60000); return isoOf(t) + 'T' + pad(t.getHours()) + ':' + pad(t.getMinutes()); }
  function whenTxt(iso) { if (!iso) return ''; return (iso.slice(0, 10) !== today() ? th(iso.slice(0, 10)) + ' ' : '') + hm(iso).replace(':', '.') + ' น.'; }
  function escMine(e) {
    var me = S.boot.me.pid, cars = (S.boot.myShifts || []).map(function (m) { return String(m.car); });
    return can('report.editOthers') || e.resp === me || e.schedBy === me || (e.crew || []).indexOf(me) >= 0 || cars.indexOf(e.car) >= 0 || cars.indexOf(e.curCar) >= 0;
  }
  function escState(e) {
    if (e.status === 'scheduled') { var late = minsBetween(e.plan, nowLocal()); return { ic: '🕒', cls: late > 0 ? 'late' : 'plan', txt: 'นัด ' + whenTxt(e.plan) + (late > 0 ? ' · เลยเวลานัด ' + durTxt(late) : '') }; }
    if (e.status === 'waiting') return { ic: '🟣', cls: 'wait', txt: 'รอรับกลับ · ส่งถึง ' + whenTxt(e.outEnd) };
    if (e.leg === 2) return { ic: '🔵', cls: 'live', txt: 'กำลังนำขากลับ · เริ่ม ' + whenTxt(e.retStart) + (e.retCar && e.retCar !== e.car ? ' · รถ ' + e.retCar : '') };
    return { ic: '🔵', cls: 'live', txt: 'กำลังนำ' + (e.legs === 2 ? 'ขาไป' : '') + ' · เริ่ม ' + whenTxt(e.start) };
  }
  function escSteps(e) {
    var st = e.status === 'scheduled' ? 0 : e.status === 'waiting' ? 2 : e.leg === 2 ? 3 : 1;
    var L = e.legs === 2 ? [['นัด', 0], ['ขาไป', 1], ['รอรับกลับ', 2], ['ขากลับ', 3], ['จบ', 4]] : [['นัด', 0], ['นำขบวน', 1], ['จบ', 4]];
    return h('div', { class: 'esc-steps' }, L.map(function (x) { return h('span', { class: x[1] < st ? 'done' : x[1] === st ? 'on' : '', text: x[0] }); }));
  }
  /** แถวสรุปขบวน (หน้าแรก/หน้าตอนนี้) — แตะไปหน้า ว.42 */
  function escRow(e) {
    var s = escState(e);
    return h('button', { class: 'esc-row ' + s.cls, onclick: function () { go('escort', { id: e.id }); } }, h('span', { class: 'esc-ic', text: s.ic }),
      h('span', { class: 'grow' }, h('b', { text: e.curCar + ' · ' + e.name + (e.legs === 2 ? ' (ไป-กลับ)' : '') }), h('small', { text: s.txt + (e.respName ? ' · ' + e.respName : '') })), h('span', { class: 'esc-go', text: '›' }));
  }
  function escReload(then) {
    return api('escort.open', {}, { fresh: true }).then(function (list) {
      S.boot.escorts = list;
      S.boot.activeEscorts = list.filter(function (x) { return x.status === 'active'; }).map(function (x) { return { id: x.id, car: x.curCar, sub: x.sub, payload: x.payload, crew: x.crew }; });
      if (then) then();
    });
  }
  function timeAsk(title, def, cb) {
    var inp = h('input', { type: 'datetime-local', value: def || nowLocal(), max: nowLocal() });
    modal(title, [h('p', { class: 'muted small', text: 'ใช้เมื่อกดช้ากว่าเวลาจริง (ย้อนได้ไม่เกิน 24 ชม.)' }), inp], 'ตกลง', function () { if (!inp.value) throw new Error('กรุณาระบุเวลา'); return cb(inp.value.slice(0, 16)); });
  }
  function escCancelAsk(e, waiting) {
    var why = waiting ? ESC_CANCEL.slice(0, 3).concat(['กลับเอง/ไม่ต้องนำกลับ']) : ESC_CANCEL, pick = '', chips = h('div', { class: 'chips' }), other = h('input', { placeholder: 'เหตุผลอื่น (ถ้ามี)' });
    function rc() { clear(chips); why.forEach(function (w) { add(chips, h('button', { class: 'chip' + (pick === w ? ' on' : ''), onclick: function () { pick = w; rc(); }, text: w })); }); }
    rc();
    modal(waiting ? '✖ ไม่มีขากลับ — จบขบวน 1 ขา' : '✖ ยกเลิกขบวน ' + e.name, [h('p', { class: 'muted small', text: waiting ? 'นับ 1 ขบวน (ขาไป) จบที่เวลาส่งถึงปลายทาง' : 'รายการนี้จะไม่นับในสถิติ (เก็บประวัติไว้)' }), chips, other], waiting ? 'จบขบวน' : 'ยกเลิกขบวน', function () {
      var reason = [pick, other.value.trim()].filter(String).join(' · ');
      if (!reason) throw new Error('กรุณาเลือกเหตุผล');
      return api('escort.cancel', { eventId: e.id, reason: reason }).then(function (r) { toast(waiting ? '🏁 จบขบวนแล้ว (ไม่มีขากลับ)' : '✖ ยกเลิกแล้ว'); return escReload(function () { VIEWS.escort({ _fresh: 1 }); }); });
    });
  }
  function escEdit(e) {
    var editor = can('report.editOthers'), kind = e.sub, kinds = h('div', { class: 'chips' });
    function rk() { clear(kinds); S.boot.escortTypes.forEach(function (k) { add(kinds, h('button', { class: 'chip' + (k === kind ? ' on' : ''), onclick: function () { kind = k; rk(); }, text: k })); }); }
    rk();
    var name = h('input', { value: e.name }), from = h('input', { value: e.from, placeholder: 'ต้นทาง' }), to = h('input', { value: e.to, placeholder: 'ปลายทาง' });
    var rt = h('input', { type: 'checkbox', checked: e.legs === 2, disabled: e.leg === 2 }), resp = e.resp, rb = h('button', { class: 'chip', text: '👤 ' + (e.respName || 'เลือก') });
    rb.onclick = function () { pickPerson('ผู้รับผิดชอบขบวน', function (p) { resp = p.pid; rb.textContent = '👤 ' + p.short; }); };
    var body = [h('label', { class: 'f', text: 'ประเภท' }), kinds, h('label', { class: 'f', text: 'ชื่อขบวน' }), name, h('div', { class: 'row2' }, from, to),
      h('label', { class: 'cap' }, rt, ' ไป-กลับ (ส่งถึงแล้วรอรับกลับ) — เปลี่ยนได้ทุกขั้น นับ 1 ขบวนเสมอ')];
    var dt = null, car = null;
    if (e.status === 'scheduled') {
      dt = h('input', { type: 'datetime-local', value: e.plan.slice(0, 16) }); car = h('input', { value: e.car, placeholder: 'เลขรถ' });
      body.push(h('div', { class: 'row2' }, h('div', null, h('label', { class: 'f', text: 'วัน-เวลานัด (โดยประมาณ)' }), dt), h('div', null, h('label', { class: 'f', text: 'รถ' }), car)));
    }
    if (editor) body.push(h('label', { class: 'f', text: 'ผู้รับผิดชอบ' }), rb);
    modal('✏️ แก้ไขขบวน', body, 'บันทึก', function () {
      var f = { kind: kind, name: name.value, from: from.value, to: to.value, legs: rt.checked ? 2 : 1 };
      if (dt) { f.plan = dt.value.slice(0, 16); f.car = car.value.trim(); }
      if (editor && resp !== e.resp) f.resp = resp;
      return api('escort.edit', { eventId: e.id, fields: f }).then(function (r) { toast(r.status === 'ok' ? '🏁 จบขบวนแล้ว (1 ขา)' : '✅ บันทึกแล้ว'); return escReload(function () { VIEWS.escort({ id: e.id, _fresh: 1 }); }); });
    });
  }
  function escCard(e, focus) {
    var s = escState(e), mine = escMine(e), c = h('div', { class: 'card esc-card esc-' + s.cls + (focus ? ' esc-focus' : '') });
    add(c, h('div', { class: 'esc-h' }, h('b', { text: '🚔 ' + e.curCar + ' · ' + e.name }), h('span', { class: 'badge ' + (s.cls === 'late' ? 'amber' : s.cls === 'wait' ? 'purple' : s.cls === 'live' ? 'blue' : 'gray'), text: s.ic + ' ' + (e.status === 'scheduled' ? 'รอเริ่ม' : e.status === 'waiting' ? 'รอรับกลับ' : 'กำลังนำ') })),
      escSteps(e), h('div', { class: 'small', text: s.txt }),
      h('div', { class: 'muted small', text: [e.sub, e.from || e.to ? [e.from, e.to].filter(String).join(' → ') : '', e.legs === 2 ? 'ไป-กลับ' : 'ไปอย่างเดียว', e.respName ? 'ผู้รับผิดชอบ ' + e.respName : ''].filter(String).join(' · ') }));
    if (!mine) { add(c, h('p', { class: 'muted small', style: 'margin:6px 0 0', text: 'ดูได้อย่างเดียว — ผู้รับผิดชอบ/เจ้าหน้าที่ในรถหรือธุรการเป็นผู้กด' })); return c; }
    var acts = h('div', { class: 'esc-acts' }), more = h('div', { class: 'chips', style: 'margin-top:8px' });
    var ho = h('input', { placeholder: 'ส่งต่อให้ (ถ้ามี) เช่น ส.ทล.3' }), res = h('input', { placeholder: 'ผล/หมายเหตุ (ไม่บังคับ)' });
    function startAt(at) {
      return api('escort.start', { eventId: e.id, at: at || undefined }).then(function (r) { return escReload(function () { done(e.status === 'waiting' ? 'เริ่มขากลับแล้ว' : 'เริ่ม ว.42 แล้ว', r.message, { next: 'escort' }); }); });
    }
    function endAt(wait, at) {
      return api('escort.end', { eventId: e.id, wait: !!wait, at: at || undefined, handoverTo: ho.value, result: res.value }).then(function (r) {
        return escReload(function () { done(wait ? 'ส่งถึงปลายทาง · รอรับกลับ' : 'จบขบวนแล้ว', r.message, { next: 'escort' }); });
      });
    }
    var big = function (t, cls, fn) { var b = submitBtn(t, cls + ' block xl', fn); return b; };
    if (e.status === 'scheduled') {
      add(acts, big('▶ รับขบวนแล้ว เริ่มนำขบวน', 'green', function () { return startAt(); }));
      [['⏰ +30 น.', 30], ['⏰ +1 ชม.', 60]].forEach(function (x) {
        add(more, submitBtn(x[0], 'ghost sm', function () { var base = minsBetween(e.plan, nowLocal()) > 0 ? nowLocal() : e.plan; return api('escort.edit', { eventId: e.id, fields: { plan: addMin(base, x[1]) } }).then(function () { toast('⏰ เลื่อนนัดแล้ว'); return escReload(function () { VIEWS.escort({ id: e.id, _fresh: 1 }); }); }); }));
      });
      add(more, h('button', { class: 'btn ghost sm', onclick: function () { timeAsk('🕘 เริ่มไปแล้วเมื่อ', nowLocal(), startAt); }, text: '🕘 เริ่มไปแล้วเมื่อ…' }));
    } else if (e.status === 'waiting') {
      add(acts, big('▶ เริ่มขากลับ', 'green', function () { return startAt(); }));
      add(more, h('button', { class: 'btn ghost sm', onclick: function () { timeAsk('🕘 เริ่มขากลับไปแล้วเมื่อ', nowLocal(), startAt); }, text: '🕘 เริ่มไปแล้วเมื่อ…' }),
        h('button', { class: 'btn ghost sm', onclick: function () {
          var cin = h('input', { placeholder: 'เลขรถ เช่น 3216', value: e.retCar || e.car });
          modal('🚓 ขากลับใช้รถคันอื่น', [cin], '▶ เริ่มขากลับ', function () { if (!cin.value.trim()) throw new Error('กรุณาใส่เลขรถ'); return api('escort.start', { eventId: e.id, car: cin.value.trim() }).then(function (r) { return escReload(function () { done('เริ่มขากลับแล้ว', r.message, { next: 'escort' }); }); }); });
        }, text: '🚓 ใช้รถคันอื่น' }));
    } else {
      if (e.legs === 2 && e.leg !== 2) {
        add(acts, big('🏁 ส่งถึงปลายทาง · รอรับกลับ', 'amber', function () { return endAt(true); }));
        add(acts, h('div', { style: 'margin-top:8px' }, submitBtn('🏁 จบขบวน (ไม่มีขากลับ)', 'ghost block', function () { return endAt(false); })));
      } else {
        add(acts, big('🏁 จบขบวน', 'amber', function () { return endAt(false); }));
        if (e.leg !== 2) add(more, submitBtn('↩️ มีขากลับ: ส่งถึงแล้วรอรับกลับ', 'ghost sm', function () { return endAt(true); }));
      }
      add(more, h('button', { class: 'btn ghost sm', onclick: function () { timeAsk('🕘 ถึงปลายทาง/จบไปแล้วเมื่อ', nowLocal(), function (t) { return endAt(e.legs === 2 && e.leg !== 2, t); }); }, text: '🕘 จบไปแล้วเมื่อ…' }));
      add(acts, h('details', { class: 'esc-more' }, h('summary', { text: 'ส่งต่อ / ผล (ไม่บังคับ)' }), ho, res));
    }
    add(more, h('button', { class: 'btn ghost sm', onclick: function () { escEdit(e); }, text: '✏️ แก้ไข/เปลี่ยนเส้นทาง' }),
      h('button', { class: 'btn ghost sm red-t', onclick: function () { escCancelAsk(e, e.status === 'waiting'); }, text: e.status === 'waiting' ? '✖ ไม่มีขากลับ' : '✖ ยกเลิก' }));
    add(c, acts, more);
    if (e.status === 'scheduled' && minsBetween(e.plan, nowLocal()) > 0) add(c, h('p', { class: 'muted small', style: 'margin:8px 0 0', text: 'เวลานัดเป็นเวลาโดยประมาณ — ขบวนมาช้าไม่ถือว่าผิด กดเริ่มเมื่อรับขบวนจริง หรือเลื่อนนัด' }));
    return c;
  }
  VIEWS.escort = function (params) {
    params = params || {};
    setTitle('🚔 นำขบวน ว.42', 'ลงนัดล่วงหน้า · เริ่ม/จบ · รอรับกลับ');
    clear($app);
    var list = S.boot.escorts || [], mine = list.filter(escMine), others = list.filter(function (e) { return !escMine(e); });
    var top = h('div');
    function drawList() {
      clear(top);
      if (mine.length) {
        add(top, h('div', { class: 'section-label', text: 'ขบวนที่รออยู่/กำลังนำ (' + mine.length + ')' }));
        mine.forEach(function (e) { var el = escCard(e, e.id === params.id); add(top, el); if (e.id === params.id) setTimeout(function () { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 60); });
      }
      if (others.length) {
        var oc = card('🚔 ขบวนอื่นในสถานี', others.length + ' รายการ');
        others.forEach(function (e) { add(oc, escRow(e)); });
        add(top, oc);
      }
      if (top.childNodes.length && !top.parentNode && f.parentNode) $app.insertBefore(top, f); // แสดงเฉพาะเมื่อมีขบวน
    }
    // ---- ฟอร์ม: ลงนัดล่วงหน้า / เริ่มเลย ----
    var mode = params.mode || 'plan', seg = h('div', { class: 'seg' }), planBox = h('div'), nowBox = h('div');
    var kind = (S.boot.escortTypes || [])[0] || 'ขบวนทั่วไป', kinds = h('div', { class: 'chips' });
    var name = h('input', { placeholder: 'เช่น นำส่งอวัยวะ / คณะดูงาน มศว.' }), origin = h('input', { placeholder: 'ต้นทาง เช่น รพ.ชลบุรี' }), dest = h('input', { placeholder: 'ปลายทาง เช่น รพ.ศิริราช' });
    var hfrom = h('input', { placeholder: 'รับช่วงจาก (ถ้ามี) เช่น ส.ทล.1' }), note = h('input', { placeholder: 'หมายเหตุ เช่น เบอร์ผู้ประสาน (ไม่บังคับ)' }), rt = h('input', { type: 'checkbox' });
    function rk() { clear(kinds); S.boot.escortTypes.forEach(function (k) { add(kinds, h('button', { class: 'chip' + (k === kind ? ' on' : ''), onclick: function () { kind = k; if (!name.value || S.boot.escortTypes.indexOf(name.value) >= 0) name.value = k; rk(); }, text: k === 'ขบวนเสด็จ' ? 'ขบวนเสด็จ (ถปภ.)' : k })); }); }
    rk(); name.value = kind;
    var t0 = bkkNow(); t0.setMinutes(0); t0.setHours(t0.getHours() + 1);
    var pDate = h('input', { type: 'date', value: isoOf(t0), min: addDays(today(), -1) }), pTime = h('input', { type: 'time', value: pad(t0.getHours()) + ':00' });
    var carIn = h('input', { placeholder: 'เลขรถ เช่น 3215', list: 'esc-cars' }), dl = h('datalist', { id: 'esc-cars' });
    var myCar = (S.boot.myShifts || []).filter(function (m) { return m.dutyDate >= S.boot.current.dutyDate; })[0]; if (myCar) carIn.value = myCar.car;
    function loadCars() {
      var hh = +String(pTime.value || '12').slice(0, 2), sh = hh >= 6 && hh < 18 ? 'D' : 'N', dd = hh < 6 ? addDays(pDate.value, -1) : pDate.value;
      api('shift.list', { dutyDate: dd, shift: sh }).then(function (l) { clear(dl); l.forEach(function (c) { add(dl, h('option', { value: c.car, label: 'เขต ' + c.zone + ' · ' + c.crew.map(function (m) { return person(m.pid).short; }).join(',') })); }); }, function () { });
    }
    pDate.onchange = loadCars; pTime.onchange = loadCars; loadCars();
    var resp = S.boot.me.pid, rb = h('button', { class: 'chip on', text: '👤 ' + S.boot.me.short + ' (ท่านเอง)' });
    rb.onclick = function () { pickPerson('ผู้รับผิดชอบขบวน', function (p) { resp = p.pid; rb.textContent = '👤 ' + p.short; }); };
    add(planBox, h('div', { class: 'row2' }, h('div', null, h('label', { class: 'f', text: 'วันที่นัด' }), pDate), h('div', null, h('label', { class: 'f', text: 'เวลา (โดยประมาณ)' }), pTime)),
      h('label', { class: 'f', text: 'รถที่จะนำขบวน' }), carIn, dl);
    if (can('report.editOthers')) add(planBox, h('label', { class: 'f', text: 'ผู้รับผิดชอบ (ลงแทนได้)' }), rb);
    add(planBox, info('ผู้บังคับบัญชาจะเห็นนัดนี้ในหน้าแรกและหน้า "ตอนนี้" · ถึงเวลาแล้วกด "เริ่ม" — ขบวนมาช้าก็กดเริ่มตอนรับขบวนจริง ไม่ถือว่าผิด'));
    var cur = null;
    add(nowBox, shiftPicker('checkin', params, function (x) { cur = x; }));
    var details = card('📝 รายละเอียดขบวน');
    add(details, h('label', { class: 'f', text: 'ประเภทขบวน' }), kinds, h('label', { class: 'f', text: 'ชื่อขบวน (จะขึ้นในรายงาน)' }), name, h('div', { class: 'row2' }, origin, dest),
      h('label', { class: 'cap', style: 'margin-top:8px' }, rt, ' ไป-กลับ (ส่งถึงแล้วรอรับกลับ) — เปลี่ยนภายหลังได้ นับ 1 ขบวน'), h('label', { class: 'f', text: 'รับช่วง / หมายเหตุ' }), hfrom, note);
    var btn = h('div');
    function rs() {
      clear(seg); [['plan', '📅 ลงนัดล่วงหน้า'], ['now', '▶ เริ่มนำขบวนเลย']].forEach(function (m) { add(seg, h('button', { class: m[0] === mode ? 'on' : '', onclick: function () { mode = m[0]; rs(); }, text: m[1] })); });
      planBox.hidden = mode !== 'plan'; nowBox.hidden = mode !== 'now';
      clear(btn); add(btn, bar(mode === 'plan' ? submitBtn('📅 บันทึกนัด', 'green', function () {
        if (!pDate.value || !pTime.value) throw new Error('กรุณาระบุวันและเวลานัด');
        if (!carIn.value.trim()) throw new Error('กรุณาระบุรถ');
        if (!name.value.trim()) throw new Error('กรุณาระบุชื่อขบวน');
        return api('escort.schedule', { plan: pDate.value + 'T' + pTime.value.slice(0, 5), car: carIn.value.trim(), resp: resp, kind: kind, name: name.value, from: origin.value, to: dest.value, legs: rt.checked ? 2 : 1, handoverFrom: hfrom.value, note: note.value })
          .then(function (r) { toast('📅 ลงนัดแล้ว — ผู้บังคับบัญชาเห็นในหน้าแรก', 4000); return escReload(function () { VIEWS.escort({ id: r.eventId, _fresh: 1 }); }); });
      }) : submitBtn('▶ เริ่ม ว.42', 'amber', function () {
        if (!cur) throw new Error('กรุณาเลือกผลัดและรถ');
        if (!name.value.trim()) throw new Error('กรุณาระบุชื่อขบวน');
        return api('escort.start', { dutyDate: cur.dutyDate, shift: cur.shift, car: cur.car, kind: kind, name: name.value, from: origin.value, to: dest.value, legs: rt.checked ? 2 : 1, handoverFrom: hfrom.value, note: note.value })
          .then(function (r) { return escReload(function () { done('เริ่ม ว.42 แล้ว', r.message, { next: 'escort' }); }); });
      })));
    }
    var f = card('➕ ขบวนใหม่');
    add(f, seg, planBox, nowBox);
    rs();
    add($app, f, details, btn);
    drawList();
    if (!params._fresh) escReload(function () { if (S.view === 'escort') { list = S.boot.escorts; mine = list.filter(escMine); others = list.filter(function (e) { return !escMine(e); }); drawList(); } }).catch(function () { });
  };

  // ======================= ช่วยเหลือ/เหตุการณ์ =======================
  VIEWS.assist = function (params) {
    setTitle('🤝 ช่วยเหลือ/เหตุการณ์', '');
    clear($app);
    var cur = null, type = S.boot.assistTypes[0];
    var types = h('div', { class: 'chips' }), acc = h('div');
    var road = h('input', { placeholder: 'เช่น 3', inputmode: 'numeric' }), km = h('input', { placeholder: 'เช่น 101+500' }), dir = h('input', { placeholder: 'ขาเข้า/ขาออก/หน้า…' });
    var dead = { v: 0 }, inj = { v: 0 }, damage = h('input', { type: 'number', inputmode: 'numeric', placeholder: 'บาท' }), result = h('textarea', { placeholder: 'การดำเนินการ/ผล' });
    var geo = { lat: '', lng: '' }, geoBtn = h('button', { class: 'btn ghost sm', text: '📍 แนบพิกัดตอนนี้', onclick: function () {
      if (!navigator.geolocation) return toast('อุปกรณ์ไม่รองรับพิกัด');
      navigator.geolocation.getCurrentPosition(function (p) { geo.lat = p.coords.latitude.toFixed(6); geo.lng = p.coords.longitude.toFixed(6); geoBtn.textContent = '📍 ' + geo.lat + ', ' + geo.lng; }, function () { toast('อ่านพิกัดไม่ได้'); });
    } });
    function rt() {
      clear(types); S.boot.assistTypes.forEach(function (k) { add(types, h('button', { class: 'chip' + (k === type ? ' on' : ''), onclick: function () { type = k; rt(); }, text: k })); });
      acc.hidden = !/อุบัติเหตุ/.test(type);
    }
    add(acc, h('div', { class: 'vrow' }, h('div', { class: 'lbl', text: '☠️ เสียชีวิต (ราย)' }), stepper(0, function (v) { dead.v = v; }, 99)),
      h('div', { class: 'vrow' }, h('div', { class: 'lbl', text: '🚑 บาดเจ็บ (ราย)' }), stepper(0, function (v) { inj.v = v; }, 99)), h('label', { class: 'f', text: 'มูลค่าความเสียหาย' }), damage);
    rt();
    var f = card('รายละเอียด');
    add(f, h('label', { class: 'f', text: 'ประเภท' }), types, h('div', { class: 'row' }, h('div', { class: 'grow' }, h('label', { class: 'f', text: 'ทล.' }), road), h('div', { class: 'grow' }, h('label', { class: 'f', text: 'กม.' }), km)),
      h('label', { class: 'f', text: 'ทิศทาง/สถานที่' }), dir, acc, h('label', { class: 'f', text: 'ผล' }), result, h('div', { style: 'margin-top:8px' }, geoBtn));
    add($app, shiftPicker('checkin', params, function (s) { cur = s; }), f, bar(submitBtn('💾 บันทึก', 'green', function () {
      if (!cur) throw new Error('กรุณาเลือกผลัดและรถ');
      return api('assist', { dutyDate: cur.dutyDate, shift: cur.shift, car: cur.car, type: type, road: road.value, km: km.value, dir: dir.value, dead: dead.v, injured: inj.v, damage: damage.value, result: result.value, lat: geo.lat, lng: geo.lng })
        .then(function (r) { done('บันทึกแล้ว', r.message, { next: 'assist' }); });
    })));
  };

  // ======================= ภารกิจ/จิตอาสา =======================
  VIEWS.mission = function () {
    setTitle('🎖️ ภารกิจ/จิตอาสา', '');
    clear($app);
    var type = S.boot.missionTypes[0], types = h('div', { class: 'chips' });
    function rt() { clear(types); S.boot.missionTypes.forEach(function (k) { add(types, h('button', { class: 'chip' + (k === type ? ' on' : ''), onclick: function () { type = k; rt(); }, text: k })); }); }
    rt();
    var date = h('input', { type: 'date', value: today() }), time = h('input', { placeholder: 'เช่น 09.00–12.00 น.' }), title = h('input', { placeholder: 'ชื่อภารกิจ/กิจกรรม' }), place = h('input', { placeholder: 'สถานที่' }), detail = h('textarea', { placeholder: 'รายละเอียด/ผล' });
    var parts = [S.boot.me.pid], pl = h('div', { class: 'chips' });
    function rp() { clear(pl); parts.forEach(function (pid) { add(pl, h('span', { class: 'tag' }, person(pid).short, h('button', { onclick: function () { parts = parts.filter(function (x) { return x !== pid; }); rp(); }, text: '×' }))); });
      add(pl, h('button', { class: 'chip', onclick: function () { pickPerson('เพิ่มผู้ร่วม', function (p) { if (parts.indexOf(p.pid) < 0) parts.push(p.pid); rp(); }); }, text: '➕ เพิ่ม' })); }
    rp();
    var f = card('รายละเอียด'); add(f, h('label', { class: 'f', text: 'ประเภท' }), types, h('label', { class: 'f', text: 'ชื่อ' }), title, h('div', { class: 'row' }, h('div', { class: 'grow' }, h('label', { class: 'f', text: 'วันที่' }), date), h('div', { class: 'grow' }, h('label', { class: 'f', text: 'เวลา' }), time)),
      h('label', { class: 'f', text: 'สถานที่' }), place, h('label', { class: 'f', text: 'ผู้ร่วมปฏิบัติ' }), pl, h('label', { class: 'f', text: 'รายละเอียด' }), detail);
    add($app, f, bar(submitBtn('💾 บันทึก', 'green', function () {
      if (!title.value.trim()) throw new Error('กรุณาใส่ชื่อภารกิจ');
      return api('mission', { type: type, title: title.value, date: date.value, time: time.value, place: place.value, participants: parts, detail: detail.value }).then(function (r) { done('บันทึกภารกิจแล้ว', r.message); });
    })));
  };

  // ======================= จับกุม (แบบ CCOC) =======================
  var KIND_LABEL = { 'ซึ่งหน้า': '⚡ ซึ่งหน้า', 'หมายจับ': '📜 หมายจับ', 'ตรวจยึด': '📦 ตรวจยึด' };
  function segPick(options, value, onChange) {
    var seg = h('div', { class: 'seg' });
    function r() { clear(seg); options.forEach(function (o) { add(seg, h('button', { type: 'button', class: o[0] === value ? 'on' : '', onclick: function () { value = o[0]; r(); onChange(value); }, text: o[1] })); }); }
    r(); return seg;
  }
  function field(label, el, hint) { return h('div', { class: 'fld' }, h('label', { class: 'f', text: label }), el, hint ? h('div', { class: 'hint', text: hint }) : null); }
  VIEWS.arrest = function (params) {
    params = params || {};
    var editId = params.id || '';
    setTitle(editId ? '✏️ แก้ไขรายงานจับกุม' : '🚨 รายงานจับกุม', 'เรียงตามแบบ CCOC · ผู้ตรวจอนุมัติก่อนนับยอด');
    if (editId) {
      loading('กำลังโหลดคดี…');
      return api('arrest.detail', { id: editId, why: 'แก้ไขรายงาน' }).then(function (d) {
        var p = d.payload, sus = (d.sensitive && d.sensitive.suspects) || [];
        renderArrestForm({ id: d.id, kind: d.kind, by: p.by || 'เอง', bwc: !!p.bwc, title: p.title || p.charge || '', occurredAt: String(d.occurredAt).slice(0, 16), cat: p.cat, catNote: p.catNote || '',
          warrants: p.warrants || 1, warrantInfo: p.warrantInfo || '', team: (p.team || []).map(function (t) { return { pid: t.pid, role: t.role }; }), lead: p.lead || '', director: p.director || '',
          suspectList: sus.length ? sus : [], suspects: d.count, charge: p.charge || '', place: p.place || '', road: p.road || '', km: p.km || '', lat: p.lat, lng: p.lng,
          evidence: p.evidence || [], detail: (d.sensitive && d.sensitive.detail) || '', handover: p.handover || '', car: '' }, params);
      }, function (e) { fail(e); });
    }
    var draft = Draft.get('arrest');
    var now = bkkNow();
    var base = draft || { kind: 'ซึ่งหน้า', by: 'เอง', bwc: false, title: '', occurredAt: isoOf(now) + 'T' + pad(now.getHours()) + ':' + pad(now.getMinutes()), cat: S.boot.arrestCats[0],
      warrants: 1, warrantInfo: '', team: [{ pid: S.boot.me.pid, role: 'primary' }], lead: '', director: S.boot.arrestDirector || '', suspectList: [blankSuspect()], charge: '', place: '', road: '', km: '', lat: '', lng: '',
      evidence: [], detail: '', handover: '', car: '' };
    renderArrestForm(base, params, !!draft);
  };
  function blankSuspect() { return { name: '', idNo: '', nationality: 'ไทย', age: '', phone: '', address: '', note: '' }; }
  function renderArrestForm(f, params, fromDraft) {
    clear($app);
    var editing = !!f.id;
    function save() { if (!editing) Draft.set('arrest', f); }
    var timer = null; function autosave() { clearTimeout(timer); timer = setTimeout(save, 600); }
    function inp(key, attrs) { var el = h(attrs && attrs.tag || 'input', Object.assign({ value: f[key] == null ? '' : String(f[key]) }, attrs || {})); el.oninput = function () { f[key] = el.value; autosave(); }; return el; }
    if (fromDraft) add($app, h('div', { class: 'note' }, 'กู้คืนร่างที่กรอกค้างไว้แล้ว ', h('button', { class: 'btn ghost sm', onclick: function () { Draft.del('arrest'); VIEWS.arrest(params); }, text: 'เริ่มใหม่' })));
    // รถ/ผลัด: ตั้งต้นจากผลัดปัจจุบันของผู้รายงาน และเติมชุดจับกุมจากเจ้าหน้าที่
    var m = (S.boot.myShifts || []).filter(function (x) { return params.car ? x.car === params.car && x.dutyDate === params.d : x.state === 'เข้าเวร' || (x.dutyDate === S.boot.current.dutyDate && x.shift === S.boot.current.shift); })[0];
    if (m && !editing) f.car = m.car;
    // 1) ประเภท
    var warrantBox = h('div');
    function rw() {
      clear(warrantBox); warrantBox.hidden = f.kind !== 'หมายจับ';
      add(warrantBox, h('div', { class: 'vrow' }, h('div', { class: 'lbl', text: 'จำนวนหมายจับ' }), stepper(f.warrants || 1, function (v) { f.warrants = Math.max(1, v); autosave(); }, 500)),
        field('หมายจับศาล / เลขที่ / ลงวันที่', inp('warrantInfo', { placeholder: 'เช่น ศาลแขวงพัทยา ที่ 846/2569 ลงวันที่ 25 ส.ค.2569' })));
    }
    rw();
    var bwc = h('input', { type: 'checkbox', checked: !!f.bwc, onchange: function () { f.bwc = bwc.checked; autosave(); } });
    var c1 = card('1) หัวข้อและประเภท');
    // หมวด "อื่นๆ" ต้องระบุข้อหาโดยย่อ — แสดงแทนคำว่า "อื่นๆ" ในภาพ/ข้อความรายงานผู้บังคับบัญชา
    var noteBox = field('ข้อหาโดยย่อ (หมวดอื่นๆ)', inp('catNote', { placeholder: 'เช่น พ.ร.บ.เช็ค · แจ้งความเท็จ · ทำร้ายร่างกาย', maxlength: 60 }), 'แสดงแทนคำว่า "อื่นๆ" ในรายงานผู้บังคับบัญชา');
    add(c1, field('หัวข้อ', inp('title', { tag: 'textarea', rows: 2, placeholder: 'เช่น จับกุมปลอมและใช้เอกสารราชการปลอม (รถสวมป้ายทะเบียน)' })),
      field('ประเภทการจับกุม', segPick([['ซึ่งหน้า', '⚡ ซึ่งหน้า'], ['หมายจับ', '📜 หมายจับศาล'], ['ตรวจยึด', '📦 ตรวจยึด']], f.kind, function (v) { f.kind = v; rw(); autosave(); })),
      warrantBox,
      field('จับโดย', segPick([['เอง', 'จับกุมเอง'], ['ร่วม', 'จับกุมร่วม']], f.by, function (v) { f.by = v; autosave(); })),
      h('label', { class: 'cap' }, bwc, 'บันทึกด้วยกล้อง Body Worn Camera'),
      field('วันเวลาจับกุม', inp('occurredAt', { type: 'datetime-local' }), 'นับสถิติตามวันเวลานี้'),
      field('หมวดคดี (ใช้ในรายงาน บก.ทล.)', (function () { var sel = h('select', { onchange: function () { f.cat = sel.value; noteBox.hidden = f.cat !== 'อื่นๆ'; autosave(); } }); S.boot.arrestCats.forEach(function (c) { add(sel, h('option', { value: c, text: c, selected: c === f.cat })); }); return sel; })()),
      noteBox);
    noteBox.hidden = f.cat !== 'อื่นๆ';
    // 2) ชุดจับกุม
    var teamBox = h('div');
    function rteam() {
      clear(teamBox);
      f.team.forEach(function (t, i) {
        var lead = h('button', { type: 'button', class: 'chip' + (f.lead === t.pid ? ' on' : ''), onclick: function () { f.lead = f.lead === t.pid ? '' : t.pid; rteam(); autosave(); }, text: f.lead === t.pid ? '★ นำโดย' : '☆ นำโดย' });
        var sel = h('select', { style: 'width:auto', onchange: function () { t.role = sel.value; autosave(); } }, h('option', { value: 'primary', text: 'ผู้จับหลัก', selected: t.role === 'primary' }), h('option', { value: 'joint', text: 'ร่วมจับ', selected: t.role !== 'primary' }));
        add(teamBox, h('div', { class: 'subcard' }, h('div', { class: 'row' }, h('b', { class: 'grow', text: person(t.pid).name }),
          h('button', { class: 'btn gray sm', 'aria-label': 'ลบ ' + person(t.pid).name, onclick: function () { f.team.splice(i, 1); if (f.lead === t.pid) f.lead = ''; rteam(); autosave(); }, text: '×' })),
          person(t.pid).position ? h('div', { class: 'small muted', text: person(t.pid).position }) : null, h('div', { class: 'row', style: 'margin-top:6px' }, h('div', { class: 'grow' }, sel), lead)));
      });
      add(teamBox, h('button', { class: 'btn ghost sm', style: 'margin-top:8px', onclick: function () { pickPerson('เพิ่มผู้ร่วมจับกุม', function (p) { if (!f.team.some(function (t) { return t.pid === p.pid; })) f.team.push({ pid: p.pid, role: 'joint' }); rteam(); autosave(); }); }, text: '➕ เพิ่มเจ้าหน้าที่' }));
    }
    if (m && !editing && f.team.length === 1 && !fromDraft) api('shift.get', { dutyDate: m.dutyDate, shift: m.shift, car: m.car }).then(function (g) {
      (g.record && g.record.crew && g.record.crew.length ? g.record.crew : g.expected.filter(function (c) { return !c.away; })).forEach(function (c) { if (!f.team.some(function (t) { return t.pid === c.pid; })) f.team.push({ pid: c.pid, role: 'joint' }); });
      rteam();
    }, function () { });
    rteam();
    var c2 = card('2) เจ้าหน้าที่ชุดจับกุม', 'ไม่เลือก "นำโดย" = เรียงตามยศ');
    add(c2, field('โดยการอำนวยการของ', inp('director', { tag: 'textarea', rows: 3 }), 'ข้อความตั้งต้นแก้ได้ในตั้งค่าระบบ — แก้เฉพาะคดีนี้ได้ที่นี่'), teamBox);
    // 3) ผู้ต้องหา
    var susBox = h('div');
    function rsus() {
      clear(susBox);
      if (!f.suspectList.length) add(susBox, h('p', { class: 'muted', text: f.kind === 'ตรวจยึด' ? 'ไม่มีผู้ต้องหา (ตรวจยึดอย่างเดียว)' : 'ยังไม่มีผู้ต้องหา' }));
      f.suspectList.forEach(function (x, i) {
        function si(key, attrs) { var el = h(attrs && attrs.tag || 'input', Object.assign({ value: x[key] == null ? '' : String(x[key]) }, attrs || {})); el.oninput = function () { x[key] = el.value; autosave(); }; return el; }
        var nat = h('select', { onchange: function () { x.nationality = nat.value === 'อื่นๆ' ? '' : nat.value; natOther.hidden = nat.value !== 'อื่นๆ'; autosave(); } });
        var known = S.boot.nationalities.indexOf(x.nationality) >= 0;
        S.boot.nationalities.forEach(function (n) { add(nat, h('option', { value: n, text: n, selected: known ? n === x.nationality : n === 'อื่นๆ' })); });
        var natOther = si('nationality', { placeholder: 'ระบุสัญชาติ' }); natOther.hidden = known;
        add(susBox, h('div', { class: 'subcard' }, h('div', { class: 'row' }, h('b', { class: 'grow', text: 'ผู้ต้องหาที่ ' + (i + 1) }),
          h('button', { class: 'btn gray sm', onclick: function () { f.suspectList.splice(i, 1); rsus(); autosave(); }, text: 'ลบ' })),
          field('ชื่อ-สกุล', si('name', { placeholder: 'เช่น นายสมชาย ใจดี', autocomplete: 'off' })),
          h('div', { class: 'row' }, h('div', { class: 'grow' }, field('เลขบัตรประชาชน/พาสปอร์ต', si('idNo', { autocomplete: 'off' }))), h('div', { style: 'width:96px' }, field('อายุ (ปี)', si('age', { inputmode: 'numeric' })))),
          h('div', { class: 'row' }, h('div', { class: 'grow' }, field('สัญชาติ', nat), natOther), h('div', { class: 'grow' }, field('โทร', si('phone', { inputmode: 'tel', autocomplete: 'off' })))),
          field('ที่อยู่', si('address', { tag: 'textarea', rows: 2 })), field('หมายเหตุ', si('note', { placeholder: 'เช่น ไม่มีหนังสือเดินทาง' }))));
      });
      add(susBox, h('button', { class: 'btn ghost sm', onclick: function () { f.suspectList.push(blankSuspect()); rsus(); autosave(); }, text: '➕ เพิ่มผู้ต้องหา' }));
    }
    rsus();
    var c3 = card('3) ข้อมูลผู้ต้องหา', '🔒 เก็บแยกไฟล์ · บันทึกทุกการเปิดดู');
    add(c3, susBox, field('ข้อหา', inp('charge', { tag: 'textarea', rows: 3, placeholder: 'เช่น 1. ปลอมและใช้เอกสารราชการปลอม 2. ขับรถโดยไม่ได้รับใบอนุญาตขับรถ' })));
    // 4) สถานที่ + พิกัด
    var lat = inp('lat', { inputmode: 'decimal', placeholder: 'ละติจูด' }), lng = inp('lng', { inputmode: 'decimal', placeholder: 'ลองจิจูด' });
    var gps = h('button', { class: 'btn ghost sm', type: 'button', text: '📍 ใช้พิกัดตอนนี้', onclick: function () {
      if (!navigator.geolocation) return toast('อุปกรณ์ไม่รองรับพิกัด');
      gps.textContent = 'กำลังอ่านพิกัด…';
      navigator.geolocation.getCurrentPosition(function (pos) { f.lat = lat.value = pos.coords.latitude.toFixed(6); f.lng = lng.value = pos.coords.longitude.toFixed(6); gps.textContent = '📍 ได้พิกัดแล้ว (±' + Math.round(pos.coords.accuracy) + ' ม.)'; autosave(); },
        function () { gps.textContent = '📍 ใช้พิกัดตอนนี้'; toast('อ่านพิกัดไม่ได้ — เปิด GPS/อนุญาตตำแหน่ง แล้วลองใหม่ หรือกรอกเอง', 5000); }, { enableHighAccuracy: true, timeout: 15000 });
    } });
    var c4 = card('4) สถานที่จับกุม/เกิดเหตุ');
    add(c4, field('สถานที่', inp('place', { tag: 'textarea', rows: 2, placeholder: 'เช่น ทล.3 กม.150-151 ขาออก กทม. ต.หนองปรือ อ.บางละมุง จ.ชลบุรี' })),
      h('div', { class: 'row' }, h('div', { class: 'grow' }, field('ทล.', inp('road', { inputmode: 'numeric' }))), h('div', { class: 'grow' }, field('กม.', inp('km')))),
      h('div', { class: 'row' }, h('div', { class: 'grow' }, lat), h('div', { class: 'grow' }, lng)), h('div', { style: 'margin-top:8px' }, gps));
    // 5) ของกลาง
    var evBox = h('div');
    function unitOf(it) { var u = S.boot.evidenceUnits.filter(function (x) { return x[0] === it; })[0]; return u ? u[1] : ''; }
    function rev() {
      clear(evBox);
      if (!f.evidence.length) add(evBox, h('p', { class: 'muted', text: 'ไม่มีของกลาง (ข้อความจะแสดง "ของกลาง: ไม่มี")' }));
      f.evidence.forEach(function (x, i) {
        var item = h('select', { onchange: function () { x.item = item.value; x.unit = unitOf(x.item); unit.value = x.unit; autosave(); } });
        S.boot.evidenceUnits.forEach(function (u) { add(item, h('option', { value: u[0], text: u[0], selected: u[0] === x.item })); });
        var det = h('textarea', { rows: 2, placeholder: 'รายละเอียด เช่น รถยนต์ HONDA CIVIC สีขาว ทะเบียน…', value: x.detail || '', oninput: function () { x.detail = det.value; autosave(); } });
        var qty = h('input', { type: 'number', inputmode: 'decimal', value: String(x.qty || ''), oninput: function () { x.qty = +qty.value; autosave(); } });
        var unit = h('input', { value: x.unit || '', oninput: function () { x.unit = unit.value; autosave(); } });
        add(evBox, h('div', { class: 'subcard' }, h('div', { class: 'row' }, h('b', { class: 'grow', text: 'ลำดับที่ ' + (i + 1) }), h('button', { class: 'btn gray sm', onclick: function () { f.evidence.splice(i, 1); rev(); autosave(); }, text: 'ลบ' })),
          field('ชนิด (ใช้นับสถิติ)', item), field('รายละเอียด', det), h('div', { class: 'row' }, h('div', { class: 'grow' }, field('จำนวน', qty)), h('div', { class: 'grow' }, field('หน่วย', unit)))));
      });
      add(evBox, h('button', { class: 'btn ghost sm', onclick: function () { var o = S.boot.evidenceUnits[S.boot.evidenceUnits.length - 1]; f.evidence.push({ item: o[0], unit: o[1], qty: 1, detail: '' }); rev(); autosave(); }, text: '➕ เพิ่มของกลาง' }));
    }
    rev();
    var c5 = card('5) ของกลาง'); add(c5, evBox);
    var c6 = card('6) พฤติการณ์และการส่งต่อ');
    add(c6, field('พฤติการณ์', inp('detail', { tag: 'textarea', rows: 6, placeholder: 'วันนี้ (…) เวลาประมาณ … น. ชุดจับกุม…' })), field('การดำเนินการส่งต่อ', inp('handover', { placeholder: 'เช่น สภ.เมืองพัทยา' })));
    var reason = editing ? field('เหตุผลการแก้ไข', inp('reason', { placeholder: 'เช่น แก้ข้อหา/เพิ่มของกลาง' })) : null;
    add($app, c1, c2, c3, c4, c5, c6, reason ? card(null) : null);
    if (reason) add($app.lastChild, reason);
    add($app, bar(submitBtn(editing ? '💾 บันทึกการแก้ไข' : '🚨 ส่งรายงานจับกุม', 'red', function () {
      if (!String(f.title || '').trim()) throw new Error('กรุณาใส่หัวข้อ (ส่วนที่ 1)');
      if (f.kind !== 'ตรวจยึด' && !f.suspectList.some(function (x) { return String(x.name || x.idNo).trim(); })) throw new Error('กรุณากรอกผู้ต้องหาอย่างน้อย 1 ราย (ส่วนที่ 3)');
      if (f.kind !== 'ตรวจยึด' && !String(f.charge || '').trim()) throw new Error('กรุณาใส่ข้อหา (ส่วนที่ 3)');
      if (f.kind !== 'ตรวจยึด' && f.cat === 'อื่นๆ' && !String(f.catNote || '').trim()) throw new Error('หมวดคดี "อื่นๆ" กรุณาระบุข้อหาโดยย่อ (ส่วนที่ 1)');
      if (!f.team.some(function (t) { return t.role === 'primary'; })) throw new Error('กรุณาเลือกผู้จับหลักอย่างน้อย 1 คน (ส่วนที่ 2)');
      var body = Object.assign({}, f, { suspectList: f.suspectList.filter(function (x) { return String(x.name || x.idNo).trim(); }), evidence: f.evidence.filter(function (x) { return x.item || x.detail; }) });
      body.suspects = body.suspectList.length;
      return api('arrest', body).then(function (r) {
        Draft.del('arrest'); refreshBoot();
        done(editing ? 'บันทึกการแก้ไขแล้ว (รอตรวจใหม่)' : 'ส่งรายงานจับกุมแล้ว (รอตรวจ)', r.message, { next: 'case', nextParams: { id: r.eventId }, nextText: 'ดูคดีนี้',
          extra: can('pr.make') ? h('button', { class: 'btn ghost', style: 'margin-top:10px', onclick: function () { go('pr', { caseId: r.eventId }); }, text: '🖼 สร้างภาพประชาสัมพันธ์จากคดีนี้' }) : null });
      });
    })));
  }

  // ======================= คดี =======================
  var ST = { pending: ['⏳ รอตรวจ', 'amber'], approved: ['✅ อนุมัติแล้ว', 'green'], returned: ['↩️ ส่งกลับแก้', 'red'], void: ['ยกเลิก', 'gray'] };
  VIEWS.cases = function () {
    setTitle('📁 คดีจับกุม', can('case.approve') ? 'ตรวจ/อนุมัติ/แก้ไข · 40 วันล่าสุด' : 'คดีในสถานี · 40 วันล่าสุด');
    loading();
    api('arrest.list', {}).then(function (list) {
      clear($app);
      if (can('view.suspect')) add($app, h('button', { class: 'btn ghost block', style: 'margin-bottom:12px', onclick: function () { go('suspects'); }, text: '🔎 ค้นหาผู้ต้องหาจากคดีเก่า' }));
      if (!list.length) return add($app, card('ยังไม่มีคดีใน 40 วันล่าสุด'));
      var groups = [['รอตรวจ', list.filter(function (x) { return x.status === 'pending'; })], ['ส่งกลับแก้', list.filter(function (x) { return x.status === 'returned'; })],
        ['อนุมัติแล้ว', list.filter(function (x) { return x.status === 'approved'; })], ['ยกเลิก', list.filter(function (x) { return x.status === 'void'; })]];
      groups.forEach(function (g) {
        if (!g[1].length) return;
        add($app, h('div', { class: 'section-label', text: g[0] + ' (' + g[1].length + ')' }));
        g[1].forEach(function (x) {
          add($app, h('button', { class: 'card clickable', onclick: function () { go('case', { id: x.id }); } },
            h('div', { class: 'row' }, h('b', { class: 'grow', text: (KIND_LABEL[x.kind] || x.kind) + ' · ' + x.cat }), x.mine ? h('span', { class: 'badge', text: 'ของฉัน' }) : null, h('span', { class: 'badge ' + ST[x.status][1], text: ST[x.status][0] })),
            h('div', { class: 'clamp2', text: x.title || x.charge || '-' }),
            h('div', { class: 'muted small', text: th(x.statDate) + ' ' + hm(x.occurredAt) + ' น. · ' + x.count + ' ราย' + (x.warrants ? ' · ' + x.warrants + ' หมาย' : '') + ' · ' + x.team.map(function (t) { return t.name + (t.role === 'primary' ? '★' : ''); }).join(', ') })));
        });
      });
    }, function (e) { fail(e, VIEWS.cases); });
  };
  VIEWS.case = function (p) {
    setTitle('🚨 รายละเอียดคดี', '');
    loading();
    api('arrest.detail', { id: p.id }).then(function (d) {
      clear($app);
      setTitle('🚨 ' + (KIND_LABEL[d.kind] || d.kind), th(d.statDate) + ' · ' + ST[d.status][0]);
      if (d.payload.review && d.payload.review.note) add($app, h('div', { class: 'note', text: (d.payload.review.approve ? '✅ ' : '↩️ ') + 'ผู้ตรวจ: ' + d.payload.review.note }));
      if (d.status === 'void' && d.payload.replacedBy) add($app, h('div', { class: 'note' }, 'ฉบับนี้ถูกแก้ไขแล้ว ', h('button', { class: 'btn ghost sm', onclick: function () { go('case', { id: d.payload.replacedBy }, true); }, text: 'ดูฉบับล่าสุด' })));
      if (d.sensitive && d.sensitive.suspects.length) {
        var s = card('🔒 ผู้ต้องหา', 'การเปิดดูถูกบันทึก');
        d.sensitive.suspects.forEach(function (x, i) {
          add(s, h('div', { class: 'list-item', style: 'display:block' }, h('b', { text: (i + 1) + '. ' + (x.name || '-') }),
            h('div', { class: 'small', text: [x.idNo && 'เลขบัตร ' + x.idNo, x.nationality && 'สัญชาติ ' + x.nationality, x.age && 'อายุ ' + x.age + ' ปี', x.note].filter(Boolean).join(' · ') }),
            x.address ? h('div', { class: 'small muted', text: 'ที่อยู่ ' + x.address }) : null,
            x.phone ? h('a', { class: 'btn ghost sm', style: 'margin-top:6px', href: 'tel:' + String(x.phone).replace(/[^\d+]/g, ''), text: '📞 ' + x.phone }) : null));
        });
        add($app, s);
      }
      var c = card('ข้อความแบบ CCOC', h('button', { class: 'btn ghost sm', onclick: function () { copyText(d.text).then(function () { toast('📋 คัดลอกแล้ว — วางในกลุ่ม CCOC ได้เลย'); }); }, text: '📋 คัดลอก' }));
      add(c, h('div', { class: 'msg-preview', text: d.text }));
      add($app, c);
      var acts = h('div', { class: 'list' });
      add(acts, rowLink('💬', 'ส่งข้อความเข้ากลุ่ม', 'เลือกกลุ่มปลายทาง เช่น กลุ่ม CCOC', function () { postToChat(d.text).then(function (r) { toast(r === 'copied' ? '📋 คัดลอกแล้ว' : r === 'cancel' ? 'ยกเลิก' : '💬 ส่งแล้ว'); }); }));
      if (d.sensitive && can('export')) add(acts, rowLink('📄', 'ส่งออก PDF รายงานจับกุม', 'แบบ CCOC ทุกบรรทัด — เก็บใน Drive ของสถานี', function () {
        toast('กำลังสร้าง PDF…', 6000);
        api('export.arrestPdf', { id: d.id }).then(function (r) { var m = h('div'); add(m, fileCard(r, 'PDF รายงานจับกุม')); modal('ส่งออกแล้ว', [m]); }, function (e) { toast(e.message, 4000); });
      }));
      if (d.canEdit) add(acts, rowLink('✏️', 'แก้ไขรายงาน', d.status === 'approved' ? 'แก้แล้วต้องอนุมัติใหม่' : 'ฉบับเดิมจะถูกแทนที่', function () { go('arrest', { id: d.id }); }));
      if (can('pr.make') && d.status !== 'void') add(acts, rowLink('🖼', 'สร้างภาพประชาสัมพันธ์', 'ใช้ข้อมูลคดีนี้ (ตัดข้อมูลส่วนบุคคลออกให้)', function () { go('pr', { caseId: d.id }); }));
      add($app, acts);
      add($app, h('p', { class: 'muted small', text: 'ผู้รายงาน: ' + d.reporter + ' · รหัส ' + d.id }));
      if (d.canApprove) add($app, bar(
        submitBtn('↩️ ส่งกลับแก้', 'gray', function () { var n = prompt('เหตุผลที่ส่งกลับแก้ (ผู้รายงานจะเห็น)'); if (n == null) return; return api('arrest.decide', { id: d.id, approve: false, note: n }).then(function () { toast('ส่งกลับแล้ว'); refreshBoot(); go('cases', {}, true); }); }),
        submitBtn('✅ อนุมัติ', 'green', function () { return api('arrest.decide', { id: d.id, approve: true }).then(function () { toast('อนุมัติแล้ว — นับยอดแล้ว'); refreshBoot(); go('cases', {}, true); }); })));
      else if (d.status === 'pending' && can('case.approve')) add($app, h('div', { class: 'note', text: 'ท่านอยู่ในชุดจับกุมคดีนี้ — ให้ผู้ตรวจท่านอื่นอนุมัติ' }));
    }, function (e) { fail(e); });
  };
  VIEWS.suspects = function () {
    setTitle('🔎 ค้นหาผู้ต้องหา', 'ทุกการค้นหาถูกบันทึกในประวัติ');
    clear($app);
    var q = h('input', { placeholder: 'ชื่อ / เลขบัตร / เบอร์โทร (อย่างน้อย 3 ตัวอักษร)', autocomplete: 'off', enterkeyhint: 'search' }), out = h('div');
    function run() {
      clear(out); add(out, h('div', { class: 'loading' }, spinner()), skeleton(2));
      api('suspect.search', { q: q.value }).then(function (list) {
        clear(out);
        if (!list.length) return add(out, card('ไม่พบในคดีที่บันทึกในระบบ'));
        list.forEach(function (x) {
          add(out, h('button', { class: 'card clickable', onclick: function () { go('case', { id: x.id }); } }, h('div', { class: 'row' }, h('b', { class: 'grow', text: x.name || '-' }), h('span', { class: 'badge ' + ST[x.status][1], text: ST[x.status][0] })),
            h('div', { class: 'small', text: [x.idNo, x.nationality, x.age && x.age + ' ปี', x.phone].filter(Boolean).join(' · ') }), h('div', { class: 'muted small clamp2', text: th(x.statDate) + ' · ' + (x.title || '') })));
        });
      }, function (e) { clear(out); add(out, errorBox(e.message)); });
    }
    q.onkeydown = function (e) { if (e.key === 'Enter') run(); };
    add($app, h('div', { class: 'card' }, q, h('button', { class: 'btn block', style: 'margin-top:10px', onclick: run, text: 'ค้นหา' })), out);
    setTimeout(function () { q.focus(); }, 50);
  };

  // ======================= ภาพประชาสัมพันธ์: prompt + เบลอรูป =======================
  VIEWS.pr = function (params) {
    params = params || {};
    setTitle('🖼 ภาพประชาสัมพันธ์', 'สร้าง prompt ให้ ChatGPT ของสถานี');
    if (params.caseId && !params._loaded) {
      loading('กำลังดึงข้อมูลคดี…');
      return api('arrest.detail', { id: params.caseId, why: 'สร้างภาพประชาสัมพันธ์' }).then(function (d) {
        var p = d.payload;
        var src = { kind: d.kind, cat: p.cat, title: p.title, charge: p.charge, evidence: p.evidence };
        renderPr({ type: PR.guessType(src), date: PR.thDate(d.statDate), time: hm(d.occurredAt) + ' น.', place: PR.sanitize(p.place), charge: PR.sanitize(p.charge || p.title),
          count: d.count, evidence: PR.evidenceText(p.evidence), head: '', sub: '' });
      }, function (e) { fail(e); });
    }
    renderPr({ type: params.type || 'arrest', date: PR.thDate(today()), time: '', place: '', charge: '', count: '', evidence: '', head: '', sub: '' });
  };
  function renderPr(o) {
    clear($app);
    o.size = o.size || 'land';
    var T = function () { return PR.TYPES.filter(function (t) { return t.id === o.type; })[0]; };
    if (!o.head) o.head = T().head;
    if (o.warn == null) o.warn = T().warn;
    o.photos = o.photos || 0; o.hasLogo = o.hasLogo !== false;
    var steps = h('ol', { class: 'steps' }, h('li', { text: 'เลือกประเภทและขนาดภาพ ตรวจข้อความในภาพ' }), h('li', { text: 'เลือกรูปถ่าย → แตะลากคลุมหน้าผู้ต้องหาและป้ายทะเบียน → บันทึกรูปที่เบลอแล้ว' }),
      h('li', { text: 'กด "คัดลอก prompt" → เปิด ChatGPT ของสถานี → แนบรูปที่เบลอแล้ว (และโลโก้) → วาง prompt → ส่ง' }), h('li', { text: 'ตรวจภาพก่อนโพสต์: ตัวสะกด, ไม่มีหน้า/ชื่อผู้ต้องหา, ไม่มีเลขทะเบียน' }));
    add($app, h('div', { class: 'card' }, h('h3', { text: 'ขั้นตอน' }), steps));
    // ประเภท
    var typeBox = h('div');
    function rtype() {
      clear(typeBox);
      ['จับกุม', 'ผลการปฏิบัติ/ช่วยเหลือ'].forEach(function (g) {
        var chips = h('div', { class: 'chips', style: 'margin-bottom:8px' });
        PR.TYPES.filter(function (t) { return t.group === g; }).forEach(function (t) {
          add(chips, h('button', { class: 'chip' + (t.id === o.type ? ' on' : ''), onclick: function () { var oldT = T(); o.type = t.id; if (o.head === oldT.head) o.head = t.head; if (o.warn === oldT.warn) o.warn = t.warn; rtype(); rtext(); rprompt(); }, text: t.icon + ' ' + t.label }));
        });
        add(typeBox, h('div', { class: 'small muted', text: g }), chips);
      });
    }
    rtype();
    var sizeBox = h('div', { class: 'radios' });
    PR.SIZES.forEach(function (z) {
      var r = h('input', { type: 'radio', name: 'prsize', checked: z.id === o.size, onchange: function () { o.size = z.id; rprompt(); } });
      add(sizeBox, h('label', { class: 'radio' }, r, h('span', null, h('b', { text: z.label + (z.id === 'land' ? ' (ค่าตั้งต้น)' : '') }), h('small', { text: z.note }))));
    });
    add($app, h('div', { class: 'card' }, h('h3', { text: '1) ประเภทภาพ' }), typeBox), h('div', { class: 'card' }, h('h3', { text: '2) ขนาดภาพ' }), sizeBox));
    // ข้อความในภาพ
    var textBox = h('div');
    function rtext() {
      clear(textBox);
      var isArrest = T().group === 'จับกุม';
      function ti(key, label, attrs) { var el = h(attrs && attrs.tag || 'input', Object.assign({ value: o[key] == null ? '' : String(o[key]) }, attrs || {})); el.oninput = function () { o[key] = el.value; rprompt(); }; return field(label, el); }
      add(textBox, ti('head', 'หัวข้อใหญ่'), ti('sub', 'หัวข้อรอง (ไม่บังคับ)', { placeholder: 'เช่น ห่วงใยทุกชีวิต เป็นมิตรทุกเส้นทาง' }),
        h('div', { class: 'row' }, h('div', { class: 'grow' }, ti('date', 'วันที่')), h('div', { class: 'grow' }, ti('time', 'เวลา'))), ti('place', 'สถานที่', { tag: 'textarea', rows: 2 }),
        isArrest ? ti('charge', 'ข้อหา', { tag: 'textarea', rows: 2 }) : null, isArrest ? ti('count', 'จำนวนผู้ต้องหา (ราย)', { inputmode: 'numeric' }) : null,
        ti('evidence', isArrest ? 'ของกลาง' : 'ผลการปฏิบัติ', { tag: 'textarea', rows: 2 }), ti('warn', 'ข้อความเตือนภัยประชาชน (ว่าง = ไม่ใส่กล่องเตือนภัย)', { tag: 'textarea', rows: 2 }),
        h('label', { class: 'cap' }, h('input', { type: 'checkbox', checked: o.hasLogo, onchange: function (e) { o.hasLogo = e.target.checked; rprompt(); } }), 'จะแนบรูปโลโก้ตำรวจทางหลวงไปด้วย'),
        h('div', { class: 'hint', text: 'ระบบตัดชื่อ เลขบัตร เบอร์โทร และเลขทะเบียนรถออกให้อัตโนมัติ — ตรวจซ้ำอีกครั้งก่อนคัดลอก' }));
    }
    rtext();
    add($app, h('div', { class: 'card' }, h('h3', { text: '3) ข้อความในภาพ' }), textBox));
    // รูป + เบลอ
    var photoCard = h('div', { class: 'card' }, h('h3', { text: '4) รูปถ่าย — เบลอบนเครื่องนี้' }), h('p', { class: 'small muted', text: 'รูปไม่ถูกอัปโหลดไปไหน · เบลอหน้าผู้ต้องหาและป้ายทะเบียน ไม่ต้องเบลอหน้าเจ้าหน้าที่ · รูปที่บันทึกจะไม่มีข้อมูลพิกัด' }));
    var file = h('input', { type: 'file', accept: 'image/*', multiple: true, hidden: true });
    var editors = h('div');
    file.onchange = function () { Array.prototype.slice.call(file.files || []).slice(0, 6).forEach(function (f) { PR.loadImage(f).then(function (c) { add(editors, blurEditor(c, function () { o.photos = editors.querySelectorAll('.blur-ed.saved').length || editors.children.length; rprompt(); })); o.photos = editors.children.length; rprompt(); }, function (e) { toast(e.message); }); }); file.value = ''; };
    add(photoCard, file, h('button', { class: 'btn block', onclick: function () { file.click(); }, text: '📷 เลือกรูป (สูงสุด 6 รูป)' }), editors);
    add($app, photoCard);
    // prompt
    var pre = h('textarea', { class: 'prompt', readonly: true, rows: 12 });
    function rprompt() { pre.value = PR.buildPrompt(o); }
    rprompt();
    add($app, h('div', { class: 'card' }, h('h3', { text: '5) Prompt สำหรับ ChatGPT' }), pre));
    add($app, bar(h('button', { class: 'btn gray', onclick: function () { openExternal('https://chatgpt.com/'); }, text: '↗ เปิด ChatGPT' }),
      h('button', { class: 'btn green', onclick: function () { copyText(pre.value).then(function () { toast('📋 คัดลอก prompt แล้ว — ไปวางใน ChatGPT พร้อมแนบรูป'); }); }, text: '📋 คัดลอก prompt' })));
  }
  /** ตัวแก้รูป: แตะลากเพื่อเลือกพื้นที่เบลอ (วงรี = หน้า, สี่เหลี่ยม = ป้ายทะเบียน/ข้อมูล) */
  function blurEditor(src, onSaved) {
    var regions = [], shape = 'ellipse', drag = null;
    var cv = h('canvas', { class: 'blur-canvas' }); cv.width = src.width; cv.height = src.height;
    var g = cv.getContext('2d'), out = src;
    function paint() { out = PR.applyBlur(src, regions); overlay(); }
    function overlay() {
      g.drawImage(out, 0, 0);
      if (drag) { g.save(); g.strokeStyle = '#facc15'; g.lineWidth = Math.max(3, cv.width / 300); g.setLineDash([12, 8]); var r = norm(drag);
        if (shape === 'ellipse') { g.beginPath(); g.ellipse((r.x + r.w / 2) * cv.width, (r.y + r.h / 2) * cv.height, r.w * cv.width / 2, r.h * cv.height / 2, 0, 0, Math.PI * 2); g.stroke(); }
        else g.strokeRect(r.x * cv.width, r.y * cv.height, r.w * cv.width, r.h * cv.height); g.restore(); }
      count.textContent = regions.length ? 'เบลอแล้ว ' + regions.length + ' จุด' : 'ยังไม่ได้เบลอ — แตะลากคลุมหน้าผู้ต้องหา/ป้ายทะเบียน';
    }
    function pos(e) { var r = cv.getBoundingClientRect(); return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) }; }
    function norm(d) { return { x: Math.min(d.a.x, d.b.x), y: Math.min(d.a.y, d.b.y), w: Math.abs(d.b.x - d.a.x), h: Math.abs(d.b.y - d.a.y) }; }
    cv.addEventListener('pointerdown', function (e) { e.preventDefault(); cv.setPointerCapture(e.pointerId); var p = pos(e); drag = { a: p, b: p }; });
    cv.addEventListener('pointermove', function (e) { if (!drag) return; drag.b = pos(e); overlay(); });
    cv.addEventListener('pointerup', function () {
      if (!drag) return; var r = norm(drag);
      if (r.w < 0.015 && r.h < 0.015) { var s = shape === 'ellipse' ? 0.09 : 0.12; r = { x: drag.a.x - s / 2, y: drag.a.y - s / 4, w: s, h: shape === 'ellipse' ? s * 1.25 * cv.width / cv.height : s / 3 * cv.width / cv.height }; } // แตะครั้งเดียว = วางขนาดมาตรฐาน
      r.shape = shape; regions.push(r); drag = null; saved.hidden = true; wrap.classList.remove('saved'); paint();
    });
    var count = h('div', { class: 'small muted' });
    var seg = segPick([['ellipse', '🙂 หน้าผู้ต้องหา'], ['rect', '🚗 ป้ายทะเบียน/ข้อมูล']], shape, function (v) { shape = v; });
    var saved = h('div', { hidden: true });
    var wrap = h('div', { class: 'blur-ed' }, seg, cv, count,
      h('div', { class: 'row', style: 'margin-top:8px' },
        h('button', { class: 'btn gray sm', onclick: function () { regions.pop(); paint(); }, text: '↩️ ย้อน' }),
        h('button', { class: 'btn gray sm', onclick: function () { regions = []; paint(); }, text: '🗑 ล้าง' }),
        h('button', { class: 'btn gray sm', onclick: function () { wrap.remove(); onSaved(); }, text: 'ลบรูปนี้' }),
        h('button', { class: 'btn green sm grow', onclick: function () {
          if (!regions.length && !confirm('รูปนี้ยังไม่ได้เบลอ — ไม่มีหน้าผู้ต้องหา/ป้ายทะเบียนในรูปใช่ไหม?')) return;
          out.toBlob(function (blob) {
            var url = URL.createObjectURL(blob), name = 'pr_blur_' + Date.now() + '.jpg';
            clear(saved); saved.hidden = false; wrap.classList.add('saved');
            var fileObj = null; try { fileObj = new File([blob], name, { type: 'image/jpeg' }); } catch (e) { }
            if (fileObj && navigator.canShare && navigator.canShare({ files: [fileObj] })) add(saved, h('button', { class: 'btn block', style: 'margin-top:8px', onclick: function () { navigator.share({ files: [fileObj] }).catch(function () { }); }, text: '📤 แชร์/บันทึกรูปลงเครื่อง' }));
            add(saved, h('a', { class: 'btn ghost block', style: 'margin-top:8px', href: url, download: name, text: '⬇️ ดาวน์โหลดรูปที่เบลอแล้ว' }),
              h('p', { class: 'small muted', text: 'ถ้ากดแล้วไม่บันทึก: กดค้างที่รูปด้านล่าง → บันทึกรูปภาพ' }), h('img', { src: url, alt: 'รูปที่เบลอแล้ว', class: 'blur-out' }));
            onSaved();
          }, 'image/jpeg', 0.9);
        }, text: '✅ บันทึกรูปที่เบลอแล้ว' })), saved);
    paint();
    return wrap;
  }

  // ======================= ตอนนี้ =======================
  var STI = { done: ['✅', 'ส่งเวร'], noresult: ['⚪', 'ไม่มีผล'], on: ['🟢', 'เข้าเวร'], escort: ['🚔', 'ว.42'], missing: ['🔴', 'ยังไม่รายงาน'], waiting: ['⏳', 'ยังไม่ถึงเวลา'] };
  VIEWS.now = function () {
    setTitle('📍 ตอนนี้', '');
    loading();
    live('now', {}, function (n) {
      clear($app);
      setTitle('📍 ตอนนี้', SHIFT[n.shift].icon + ' ' + SHIFT[n.shift].label + ' ' + th(n.dutyDate) + ' · ' + hm(n.at) + ' น.');
      var k = card('ผลวันนี้', 'เทียบเมื่อวาน'), kp = h('div', { class: 'kpis' });
      [['🧾', 'ใบสั่ง', 'ticket'], ['🚔', 'ว.42', 'escort'], ['🤝', 'ช่วยเหลือ', 'assist'], ['🚨', 'จับกุม', 'arrest'], ['🗣️', 'ตักเตือน', 'warning'], ['🛡️', 'ถปภ.', 'escortRoyal']].forEach(function (x) {
        var a = n.today[x[2]] || 0, b = n.yesterday[x[2]] || 0;
        add(kp, h('div', { class: 'kpi' }, h('div', { class: 'n', text: a }), h('div', { class: 't', text: x[0] + ' ' + x[1] }), h('div', { class: 'd ' + (a > b ? 'up' : a < b ? 'down' : ''), text: a > b ? '▲' + (a - b) : a < b ? '▼' + (b - a) : '＝' })));
      });
      add(k, kp); add($app, k);
      // ขบวน ว.42 ที่กำลังนำอยู่ (รวมผลัดก่อนที่ยังไม่กดจบ)
      var myCarsNow = (S.boot.myShifts || []).map(function (m) { return String(m.car); });
      if ((n.escorts || []).length) {
        var ec = card('🔵 กำลังนำขบวน ว.42', n.escorts.length + ' คัน');
        n.escorts.forEach(function (e) {
          var mayEnd = can('report.editOthers') || myCarsNow.indexOf(e.car) >= 0 || e.crew.indexOf(S.boot.me.pid) >= 0;
          add(ec, h('div', { class: 'list-item' }, h('div', { class: 'grow' }, h('b', { text: 'รถ ' + e.car + ' · ' + e.name }),
            h('div', { class: 'small muted', text: [e.from && e.to ? e.from + ' → ' + e.to : e.from || e.to, e.start ? 'เริ่ม ' + th(e.start.slice(0, 10)) + ' ' + hm(e.start) + ' น.' : ''].filter(Boolean).join(' · ') })),
            mayEnd ? h('button', { class: 'btn amber sm', onclick: function () { go('escort', { id: e.id }); }, text: e.leg === 2 ? '🏁 จบขากลับ' : '🏁 จบขบวน' }) : null));
        });
        add(ec, info('เจ้าหน้าที่ และหัวหน้าสถานี/จ่ากอง/เจ้าหน้าที่รายงาน/แอดมิน กดจบได้ · ถ้าไม่มีใครกด ระบบปิดเองเมื่อพ้นผลัด 2 ชม.'));
        add($app, ec);
      }
      if ((n.escOpen || []).length) {
        var eo = card('🕒 ว.42 ที่นัดไว้ / รอรับกลับ', n.escOpen.length + ' ขบวน');
        n.escOpen.forEach(function (e) { add(eo, escRow(e)); });
        add($app, eo);
      }
      var zc = card('🚓 รถใน' + SHIFT[n.shift].label + 'นี้', n.cars.filter(function (c) { return c.status === 'done' || c.status === 'noresult'; }).length + '/' + n.cars.length + ' ส่งเวรแล้ว');
      var cars = h('div', { class: 'cars' });
      n.cars.forEach(function (c) {
        add(cars, h('div', { class: 'car ' + c.status, onclick: function () { carSheet(c); } },
          h('div', { class: 'h' }, h('span', { class: 'st', text: STI[c.status][0] }), h('span', { class: 'grow', text: c.car + (c.crewType === 'จักรยานยนต์' ? ' 🏍' : '') }), h('span', { class: 'badge gray', text: 'เขต ' + c.zone })),
          h('div', { class: 'crew', text: c.crew.map(function (m) { return m.name; }).join(' · ') || '—' }),
          c.escort ? h('div', { class: 'small', text: '🚔 ' + c.escort }) : null,
          (c.escNext || []).map(function (x) { return h('div', { class: 'esc-tag ' + (x.status === 'waiting' ? 'wait' : 'plan'), text: x.status === 'waiting' ? '🟣 รอรับกลับ ' + x.name : '🕒 นัด ' + whenTxt(x.plan) + ' ' + x.name }); }),
          c.totals && c.totals.ticket ? h('div', { class: 'small', text: '🧾 ' + c.totals.ticket + ' (🚚' + (c.totals.T || 0) + ' 🚗' + (c.totals.C || 0) + ')' }) : null));
      });
      add(zc, cars, h('p', { class: 'muted small', style: 'margin:10px 0 0', text: Object.keys(STI).map(function (s) { return STI[s][0] + ' ' + STI[s][1]; }).join('   ') }));
      if (!n.cars.length) add(zc, h('p', { class: 'muted', text: 'ยังไม่มีตารางเวรของผลัดนี้ — ธุรการส่งไฟล์คำสั่งเวร .docx ให้บอทในแชท 1:1' }));
      add($app, zc);
      if (n.officers.length || n.duty.length) {
        var d = card('👮 เวรวันนี้');
        n.officers.forEach(function (o) { add(d, h('div', { class: 'list-item' }, h('span', { text: '⭐' }), h('div', { class: 'grow', text: 'ร้อยเวร: ' + o.name }), o.phone ? h('a', { href: 'tel:' + o.phone, class: 'btn ghost sm', text: '📞' }) : null)); });
        n.duty.forEach(function (o) { add(d, h('div', { class: 'list-item' }, h('span', { text: o.slot === 'N' ? '🌙' : o.slot === 'D' ? '☀️' : '•' }), h('div', { class: 'grow', text: o.duty + (o.zone ? ' เขต ' + o.zone : '') + ': ' + o.name }), o.phone ? h('a', { href: 'tel:' + o.phone, class: 'btn ghost sm', text: '📞' }) : null)); });
        add($app, d);
      }
      add($app, h('button', { class: 'btn gray block', onclick: VIEWS.now, text: '🔄 รีเฟรช' }));
    }, function (e) { fail(e, VIEWS.now); });
  };
  function carSheet(c) {
    var b = [h('p', { class: 'muted', text: STI[c.status][0] + ' ' + STI[c.status][1] + (c.since ? ' ตั้งแต่ ' + hm(c.since) + ' น.' : '') })];
    c.crew.forEach(function (m) { b.push(h('div', { class: 'person' }, h('div', { class: 'who' }, h('b', { text: m.full }), h('span', { class: 'muted small', text: m.role })), m.phone ? h('a', { class: 'btn ghost sm', href: 'tel:' + m.phone, text: '📞 โทร' }) : null)); });
    if (c.status === 'escort' && (can('report.editOthers') || (S.boot.myShifts || []).some(function (m) { return String(m.car) === String(c.car); }) || c.crew.some(function (m) { return m.pid === S.boot.me.pid; }))) b.push(h('button', { class: 'btn amber block', onclick: function () { closeModal(); go('escort'); }, text: '🏁 จบขบวน ว.42 ของรถคันนี้' }));
    if (c.totals) b.push(h('p', { text: '🧾 ' + (c.totals.ticket || 0) + ' (🚚' + (c.totals.T || 0) + ' 🚗' + (c.totals.C || 0) + ') · 🚔 ' + (c.totals.escort || 0) + ' · 🤝 ' + (c.totals.assist || 0) }));
    modal('รถ ' + c.car + ' · เขต ' + c.zone, b);
  }

  // ======================= สรุปผล =======================
  function rangePicker(onChange, initial) {
    var t = today(), c = cycleOf(t), pc = cycleOf(addDays(c.from, -1));
    var presets = [['วันนี้', t, t], ['เมื่อวาน', addDays(t, -1), addDays(t, -1)], ['วงรอบนี้', c.from, c.to], ['วงรอบก่อน', pc.from, pc.to], ['เดือนนี้', t.slice(0, 8) + '01', t], ['7 วัน', addDays(t, -6), t]];
    var sel = initial || 2, chips = h('div', { class: 'chips' }), f = h('input', { type: 'date' }), to = h('input', { type: 'date' }), custom = h('div', { class: 'row', hidden: true, style: 'margin-top:8px' }, f, to);
    function r() {
      clear(chips);
      presets.forEach(function (p, i) { add(chips, h('button', { class: 'chip' + (i === sel ? ' on' : ''), onclick: function () { sel = i; custom.hidden = true; r(); onChange(p[1], p[2]); }, text: p[0] })); });
      add(chips, h('button', { class: 'chip' + (sel === -1 ? ' on' : ''), onclick: function () { sel = -1; custom.hidden = false; r(); }, text: 'กำหนดเอง' }));
    }
    f.onchange = to.onchange = function () { if (f.value && to.value) onChange(f.value, to.value); };
    r();
    setTimeout(function () { onChange(presets[sel][1], presets[sel][2]); }, 0);
    return h('div', { class: 'card' }, chips, custom);
  }
  // ======================= ตารางรายคัน / รายการคดี / ภาพรวมหน้าแรก (ในแอป) =======================
  function heatBg(v, max) { return v > 0 ? 'background:rgba(37,99,235,' + (0.06 + 0.3 * v / Math.max(max, 1)).toFixed(3) + ')' : ''; }
  function dlt(cur, prev) {
    if (prev == null) return null;
    var d = Math.round(((+cur || 0) - (+prev || 0)) * 10) / 10;
    return d ? h('span', { class: 'dl ' + (d > 0 ? 'up' : 'dn'), text: (d > 0 ? '▲' : '▼') + Math.abs(d) }) : null;
  }
  function activeCars(list) { return (list || []).filter(function (c) { return c.shifts || c.arrest || c.ticket || c.escort || c.assist || c.checks || c.score; }); }
  /** ตารางรายคัน (จัดกลุ่มตามเขต) — compact = หน้าแรก (คอลัมน์หลัก), เต็ม = หน้าสรุปผล (ผลัด ฐานความผิด เจ้าหน้าที่ ต่อผลัด) */
  function boardTable(cars, opts) {
    opts = opts || {}; cars = activeCars(cars);
    if (!cars.length) return h('p', { class: 'muted small', text: 'ยังไม่มีข้อมูลรายรถในช่วงนี้' });
    var cols = opts.compact
      ? [['รถ', 'car'], ['อาญา', 'arrest', 1], ['จราจร', 'ticket', 1], ['ว.42', 'escort', 1], ['ช่วยเหลือ', 'assist', 1], ['คะแนน', 'score', 1]]
      : [['รถ', 'car'], ['ผลัด', 'shifts'], ['อาญา', 'arrest', 1], ['ฐานความผิด', 'crimes'], ['จราจร', 'ticket', 1], ['ว.42', 'escort', 1], ['ช่วยเหลือ', 'assist', 1], ['คะแนน', 'score', 1], ['ต่อผลัด', 'perShift', 1], ['เจ้าหน้าที่', 'crew']];
    var max = {}; cols.forEach(function (k) { if (k[2]) max[k[1]] = Math.max.apply(null, cars.map(function (c) { return +c[k[1]] || 0; }).concat([1])); });
    var t = h('table', { class: 't bt' }), hr = h('tr'); cols.forEach(function (k) { add(hr, h('th', { text: k[0] })); }); add(t, h('thead', null, hr));
    var tb = h('tbody'), z = null, zn = S.boot.zones || {};
    cars.forEach(function (c) {
      if (+c.zone !== z) { z = +c.zone; add(tb, h('tr', { class: 'zr' }, h('td', { colspan: cols.length, text: z ? 'เขต ' + z + ' ' + String(zn[z] || '').replace(/^เขต\s*\d+\s*/, '') : 'ไม่ระบุเขต' }))); }
      var tr = h('tr');
      cols.forEach(function (k) {
        var key = k[1], v = c[key], td;
        if (key === 'car') td = h('td', null, h('b', { text: c.car }));
        else if (key === 'shifts') td = h('td', { text: c.shifts + (c.D != null ? ' (☀️' + c.D + '/🌙' + c.N + ')' : '') });
        else if (key === 'crimes') td = h('td', { class: 'wrap' }, (c.crimes || []).map(function (x) { return (DASH_CAT[x.label] || x.label) + ' ' + x.n; }).join(' · ') || '-', c.joint ? h('span', { class: 'jt', text: ' (ร่วม ' + c.joint + ')' }) : null);
        else if (key === 'crew') td = h('td', { class: 'wrap small' }, (c.crew || []).map(function (m) { return m.name + (c.crew[0] && m.n < c.crew[0].n ? '(' + m.n + ')' : ''); }).join(' · ') || '-');
        else {
          td = h('td', { style: k[2] ? heatBg(+v || 0, max[key]) : '' }, h('b', { text: fmtN(v) }), key === 'perShift' || key === 'checks' ? null : dlt(v, c.prev ? c.prev[key] : null));
          if (key === 'score' && c.rank && !opts.compact) add(td, h('div', { class: 'small muted', text: 'อันดับ ' + c.rank }));
          if (key === 'arrest' && !opts.compact && (c.warrant || c.flag)) add(td, h('div', { class: 'small muted', text: 'หมาย ' + c.warrant + '/ซ.หน้า ' + c.flag }));
        }
        add(tr, td);
      });
      add(tb, tr);
    });
    add(t, tb);
    return h('div', { class: 'scroll-x' }, t);
  }
  var KIND_PILL = { 'หมายจับ': 'navy', 'ซึ่งหน้า': 'amber', 'ตรวจยึด': 'teal' };
  /** รายการคดี (ไม่มีข้อมูลผู้ต้องหา) */
  function caseList(cases) {
    if (!cases.length) return h('p', { class: 'muted small', text: 'ไม่มีคดีอาญาในช่วงนี้' });
    var box = h('div', { class: 'cl' });
    cases.forEach(function (c) {
      add(box, h('div', { class: 'cl-i' },
        h('div', { class: 'row' }, h('b', { text: th(c.date) + (c.time ? ' ' + c.time.replace(':', '.') + ' น.' : '') }), h('span', { class: 'kp ' + (KIND_PILL[c.kind] || 'amber'), text: c.kind }), h('span', { class: 'grow' }),
          h('span', { class: 'cars', text: c.cars.length ? 'รถ ' + c.cars.join(' · ') : '-' })),
        h('div', { class: 'lb', text: (DASH_CAT[c.label] || c.label) + (c.joint ? ' · จับร่วม ' + c.cars.length + ' คัน' : '') }),
        h('div', { class: 'small', text: c.title + (c.offense && c.title.indexOf(c.offense.replace(/…$/, '')) < 0 ? ' — ' + c.offense : '') }),
        c.evidence.length ? h('div', { class: 'small muted', text: '📦 ' + c.evidence.map(function (x) { return x.item + ' ' + fmtN(x.qty) + ' ' + x.unit; }).join(' · ') }) : null));
    });
    return box;
  }
  /** กราฟแท่งเล็กรายวัน (แต่ละงานสเกลของตัวเอง — ไม่ใช้แกนร่วม) */
  function sparkBars(days, key, color) {
    var W = 300, H = 64, n = days.length || 1, bw = W / n, max = Math.max.apply(null, days.map(function (d) { return d[key] || 0; }).concat([1]));
    var s = sv('svg', { viewBox: '0 0 ' + W + ' ' + (H + 16), width: '100%', preserveAspectRatio: 'none' });
    days.forEach(function (d, i) {
      var v = d[key] || 0, bh = v ? Math.max(3, v / max * H) : 1.5;
      s.appendChild(sv('rect', { x: (i * bw + bw * 0.14).toFixed(1), y: (H - bh).toFixed(1), width: (bw * 0.72).toFixed(1), height: bh.toFixed(1), rx: 2, fill: v ? color : '#d5dde8' }));
      if (n <= 11 || i % Math.ceil(n / 10) === 0) { var t = sv('text', { x: (i * bw + bw / 2).toFixed(1), y: H + 13, 'text-anchor': 'middle', 'font-size': 10, fill: '#64748b' }); t.textContent = +d.d.slice(8); s.appendChild(t); }
    });
    return s;
  }
  var HOME_KIND = [['day', 'วันนี้'], ['cycle', 'วงรอบนี้'], ['month', 'เดือนนี้'], ['custom', '📅 กำหนดเอง']];
  function cycleRange(iso) { var d = +iso.slice(8), a = d <= 10 ? 1 : d <= 20 ? 11 : 21, f = iso.slice(0, 8) + pad(a); return [f, a === 21 ? lastDay(iso) : iso.slice(0, 8) + pad(a + 9)]; }
  /** ช่วงกำหนดเอง: ทางลัด (เมื่อวาน / วงรอบก่อน / เดือนก่อน) + วันเริ่ม–วันสิ้นสุด · ไม่เกิน 6 เดือน */
  function homeRangePanel(cur, onPick) {
    var t = today(), f = h('input', { type: 'date', max: t, value: cur ? cur[0] : '' }), to = h('input', { type: 'date', max: t, value: cur ? cur[1] : '' });
    function use(a, b) { f.value = a; to.value = b; onPick(a, b); }
    var pc = cycleRange(addDays(cycleRange(t)[0], -1)), pmE = addDays(t.slice(0, 8) + '01', -1);
    var sc = h('div', { class: 'chips' }, h('button', { class: 'chip', onclick: function () { var y = addDays(t, -1); use(y, y); }, text: 'เมื่อวาน' }),
      h('button', { class: 'chip', onclick: function () { use(pc[0], pc[1]); }, text: 'วงรอบก่อน' }), h('button', { class: 'chip', onclick: function () { use(pmE.slice(0, 8) + '01', pmE); }, text: 'เดือนก่อน' }));
    var go1 = h('button', { class: 'btn sm', onclick: function () {
      var a = f.value, b = to.value;
      if (!a || !b) { toast('เลือกวันเริ่มและวันสิ้นสุด'); return; }
      if (a > b) { var x = a; a = b; b = x; }
      if (b > t) { toast('วันสิ้นสุดต้องไม่เกินวันนี้'); return; }
      if (addDays(a, 185) < b) { toast('เลือกได้ครั้งละไม่เกิน 6 เดือน'); return; }
      use(a, b);
    }, text: 'ดูผล' });
    return h('div', { class: 'card hr-panel' }, sc, h('div', { class: 'row hr-dates' }, h('label', { class: 'grow' }, h('small', { class: 'muted', text: 'ตั้งแต่' }), f), h('label', { class: 'grow' }, h('small', { class: 'muted', text: 'ถึง' }), to), go1),
      info('▲▼ เทียบช่วงยาวเท่ากันก่อนหน้า (เลือกวงรอบ/เดือนเต็มจะเทียบวงรอบ/เดือนก่อน) · เลือกได้ครั้งละไม่เกิน 6 เดือน'));
  }
  /** แนวโน้มช่วงยาว (> 62 วัน) รวมเป็นรายสัปดาห์ */
  function weekly(days) {
    if (days.length <= 62) return days;
    var out = [];
    for (var i = 0; i < days.length; i += 7) { var w = { d: days[i].d }; days.slice(i, i + 7).forEach(function (x) { ['ticket', 'arrest', 'escort', 'assist'].forEach(function (k) { w[k] = (w[k] || 0) + (x[k] || 0); }); }); out.push(w); }
    return out;
  }
  /** ภาพรวมสถานีบนหน้าแรก (ทุกคนเห็น) */
  /** ภาพรวมสถานี — mode 'brief' = หน้าแรก (ตอนนี้ 1 บรรทัด + ตัวเลขหลัก + ปุ่มดูเต็ม) · 'full' = หน้าภาพรวม (ทุกกราฟ) */
  function homeDash(mode) {
    var brief = mode === 'brief', kind = S.homeKind || 'cycle', chips = h('div', { class: 'chips' }), panel = h('div'), body = h('div'), seqH = 0;
    if (brief && kind === 'custom') kind = 'cycle';
    function rc() {
      clear(chips); HOME_KIND.filter(function (x) { return !brief || x[0] !== 'custom'; }).forEach(function (x) { add(chips, h('button', { class: 'chip' + (kind === x[0] ? ' on' : ''), onclick: function () { kind = S.homeKind = x[0]; rc(); if (kind !== 'custom' || S.homeRange) load(); else { clear(body); } }, text: x[1] })); });
      clear(panel); if (kind === 'custom') add(panel, homeRangePanel(S.homeRange, function (a, b) { S.homeRange = [a, b]; load(); }));
    }
    function load(fresh) {
      var my = ++seqH; clear(body); add(body, skeleton(2));
      var q = { kind: kind, fresh: !!fresh }; if (kind === 'custom') { q.from = S.homeRange[0]; q.to = S.homeRange[1]; }
      live('home', q, function (d) { if (my === seqH) render(d); }, function (e) { if (my === seqH) { clear(body); add(body, errorBox(e.message)); } });
    }
    function rangeText(a, b) { return a === b ? th(a) : th(a) + ' – ' + th(b); }
    function render(d) {
      clear(body);
      var t = d.total, p = d.prevTotal, CL = Charts.COLORS, custom = d.kind === 'custom';
      add(body, h('div', { class: 'small muted', style: 'margin:2px 4px 8px' }, rangeText(d.from, d.to) + ' · ▲▼ เทียบ ' + rangeText(d.prev.from, d.prev.to) + ' · อัปเดต ' + hm(d.at) + ' น. ',
        h('button', { class: 'linkbtn', onclick: function () { load(true); }, text: '↻ รีเฟรช' })));
      // 1) ตัวเลขหลัก
      function tile(ic, label, v, pv, sub, color, cls) { return h('div', { class: 'kpi hk' + (cls ? ' ' + cls : ''), style: 'border-top:3px solid ' + color }, h('div', { class: 't', text: ic + ' ' + label }), h('div', { class: 'n' }, fmtN(v), dlt(v, pv)), sub ? h('div', { class: 'd muted', text: sub }) : null); }
      // 1) ตอนนี้ (หน้าแรกย่อเป็น 1 บรรทัด) — รถออกปฏิบัติ/ส่งเวร/ยังไม่เข้าเวร/นำขบวน
      var n = d.now, nOn = n.on.length + n.escorts.filter(function (e) { return n.on.indexOf(e.car) < 0; }).length;
      var NOW_ST = [['🟢', 'ออกปฏิบัติ', nOn, 'green'], ['✅', 'ส่งเวรแล้ว', n.done.length, 'blue'], ['⏳', 'รอเข้าเวร', n.waiting.length, 'gray'], ['🔴', 'ยังไม่เข้าเวร', n.missing.length, 'red'], ['🚔', 'กำลังนำขบวน', n.escorts.length, 'amber']];
      var nc = card('📍 ตอนนี้ · ' + SHIFT[n.shift].icon + ' ' + SHIFT[n.shift].label + (brief ? '' : ' ' + th(n.dutyDate)), can('view.now') ? h('button', { class: 'linkbtn', onclick: function () { go('now'); }, text: 'ดูรายคัน ›' }) : null);
      if (brief) {
        var ln = h('div', { class: 'now-line' });
        NOW_ST.forEach(function (x) { if (x[2] || x[3] === 'green' || x[3] === 'red') add(ln, h('span', { class: 'ns-pill ' + x[3] }, h('b', { text: String(x[2]) }), ' ' + x[0] + ' ' + x[1])); });
        add(nc, ln);
      } else {
        var st = h('div', { class: 'nowst' });
        NOW_ST.forEach(function (x) { add(st, h('div', { class: 'ns ' + x[3] }, h('b', { text: x[2] }), h('span', { text: x[0] + ' ' + x[1] }))); });
        add(nc, st);
      }
      if (n.missing.length) add(nc, h('div', { class: 'small', style: 'margin-top:8px' }, h('b', { style: 'color:var(--red)', text: '🔴 ยังไม่เข้าเวร: ' }), n.missing.join(', ')));
      n.escorts.forEach(function (e) { add(nc, h('div', { class: 'small', style: 'margin-top:4px', text: '🚔 รถ ' + e.car + ' · ' + e.name + (e.start ? ' · เริ่ม ' + hm(e.start) + ' น.' : '') })); });
      if (n.overdue.length) add(nc, h('div', { class: 'small', style: 'margin-top:6px' }, h('b', { style: 'color:var(--amber)', text: '⚠️ เลยกำหนดส่งเวร ' + (brief ? n.overdue.length + ' ผลัด' : ': ') }), brief ? '' : n.overdue.map(function (m) { return th(m.date) + (m.shift === 'N' ? '🌙' : '☀️') + m.car; }).join(' · ')));
      add(body, nc);
      // 2) ตัวเลขหลัก (สีหมวดงานชุดเดียวกับภาพรายงาน)
      var kp = h('div', { class: 'kpis' });
      add(kp, tile('🚨', 'จับกุมอาญา', t.arrest, p.arrest, 'หมายจับ ' + t.arrestWarrant + ' หมาย' + (t.arrestWarrant ? ' (' + (t.warrantPersons || 0) + ' ราย)' : '') + ' · ซึ่งหน้า ' + t.arrestFlag + ' ราย' + (t.overweight ? ' · รถหนัก ' + t.overweight + ' ราย' : '') + (t.arrestPending ? ' · รอตรวจ ' + t.arrestPending : ''), CAT.arrest),
        tile('🧾', 'ใบสั่งจราจร', t.ticket, p.ticket, 'ขส ' + t.T + ' · รย ' + t.C + (t.R ? ' · จร ' + t.R : ''), CAT.ticket),
        tile('🚔', 'นำขบวน ว.42', t.escort, p.escort, '', CAT.escort), tile('🤝', 'ช่วยเหลือ', t.assist, p.assist, '', CAT.assist),
        tile('🛡️', 'ถปภ.', t.escortRoyal || 0, p.escortRoyal || 0, 'ถวายความปลอดภัย (ขบวน)', '#b45309', 'nz'),
        tile('📦', 'ของกลาง', t.evidence.length, null, t.evidence.slice(0, 3).map(function (x) { return x.item + ' ' + fmtN(x.qty) + ' ' + x.unit; }).join(' · ') || 'ไม่มี', CAT.evidence));
      var k = card('📊 ผลการปฏิบัติ' + (custom ? ' ' + rangeText(d.from, d.to) : d.kind === 'day' ? 'วันนี้' : d.kind === 'month' ? 'เดือนนี้' : 'วงรอบนี้')); add(k, kp);
      var crimes = Object.keys(t.byCrime || {}).filter(function (x) { return t.byCrime[x]; }).sort(function (a, b) { return t.byCrime[b] - t.byCrime[a]; });
      if (crimes.length) add(k, h('div', { class: 'small', style: 'margin-top:8px' }, h('b', { text: 'ฐานความผิด: ' }), crimes.map(function (x) { return (DASH_CAT[x] || x) + ' ' + t.byCrime[x]; }).join(' · ')));
      if (d.discipline.scheduled) add(k, h('div', { class: 'small muted', style: 'margin-top:6px', text: '📋 ส่งเวรแล้ว ' + d.discipline.reported + '/' + d.discipline.scheduled + ' ผลัด (' + Math.round(d.discipline.reported * 100 / d.discipline.scheduled) + '%)' }));
      if (brief) add(k, h('button', { class: 'btn ghost block', style: 'margin-top:10px', onclick: function () { go('overview'); }, text: '📈 ดูภาพรวมเต็ม ›' }));
      add(body, markZeros(k));
      if (brief) return;
      // 3) แนวโน้มรายวัน (กราฟเล็กแยกงาน แต่ละกราฟสเกลของตัวเอง)
      var days = weekly(d.days), wk = days.length < d.days.length;
      var tc = card(wk ? '📈 แนวโน้มรายสัปดาห์' : '📈 แนวโน้มรายวัน', d.from === d.to ? '7 วันล่าสุด' : custom ? rangeText(d.from, d.to) : 'ตั้งแต่ต้น' + (d.kind === 'month' ? 'เดือน' : 'วงรอบ')), grid = h('div', { class: 'spk' });
      [['ticket', '🧾 จราจร', CL.ticket || DK.blue], ['arrest', '🚨 อาญา', CL.arrest || DK.navy], ['escort', '🚔 ว.42', CL.escort || DK.amber], ['assist', '🤝 ช่วยเหลือ', CL.assist || DK.teal]].forEach(function (x) {
        var sum = days.reduce(function (s, r) { return s + (r[x[0]] || 0); }, 0);
        add(grid, h('div', { class: 'spk-i' }, h('div', { class: 'row' }, h('span', { class: 'small', text: x[1] }), h('b', { class: 'grow', style: 'text-align:right', text: fmtN(sum) })), sparkBars(days, x[0], x[2])));
      });
      add(tc, grid); add(body, markZeros(tc));
      // 4) รายเขต
      var zc = card('🗺️ แยกเขตตรวจ'), zmax = { arrest: 1, ticket: 1, escort: 1 };
      d.zones.forEach(function (z) { Object.keys(zmax).forEach(function (k2) { zmax[k2] = Math.max(zmax[k2], z[k2] || 0); }); });
      var zt = h('div', { class: 'zrows' }); add(zt, h('div', { class: 'zh' }, h('span', { text: '' }), h('span', { text: 'อาญา' }), h('span', { text: 'จราจร' }), h('span', { text: 'ว.42' })));
      d.zones.forEach(function (z) {
        function bar(k2, color) { return h('div', { class: 'zb' }, h('i', { style: 'width:' + Math.max(z[k2] ? 6 : 0, (z[k2] || 0) / zmax[k2] * 100) + '%;background:' + color }), h('b', { text: fmtN(z[k2] || 0) })); }
        add(zt, h('div', { class: 'zl' }, h('span', null, h('b', { text: 'เขต ' + z.zone }), h('small', { text: ' ' + String(z.name).replace(/^เขต\s*\d+\s*/, '') })), bar('arrest', DK.navy), bar('ticket', DK.blue), bar('escort', DK.amber)));
      });
      add(zc, zt); add(body, markZeros(zc));
      // 5) รายรถ
      var cc = card('🚓 คะแนนผลงานรายรถ', h('button', { class: 'linkbtn', onclick: function () { go('summary'); }, text: 'ตารางเต็ม ›' }));
      add(cc, carScoreList(d.cars), h('p', { class: 'small muted', style: 'margin:8px 0 0', text: 'เรียงตามคะแนนรวม (เกณฑ์คะแนนของสถานี) · แถบสี = คะแนนที่ได้จากแต่ละงาน · ▲▼ เทียบช่วงก่อน' }),
        d.criteria ? h('p', { class: 'small muted', style: 'margin:4px 0 0', text: weightNote(d.criteria) }) : null);
      add(body, markZeros(cc));
      // 5.5) สัดส่วนภารกิจ (ทั้งสถานี + รายรถ)
      add(body, markZeros(mixCard(d.mix, d.cars)));
      // 6) คดีล่าสุด
      var kc = card('🚨 คดีล่าสุด', d.nCases > d.cases.length ? 'ทั้งหมด ' + d.nCases + ' คดี' : ''); add(kc, caseList(d.cases)); add(body, kc);
    }
    rc(); if (kind !== 'custom' || S.homeRange) load();
    return h('div', { class: 'home-dash' }, brief ? h('div', { class: 'section-label', text: 'ภาพรวมสถานี' }) : null, chips, panel, h('div', { style: 'height:8px' }), body);
  }
  /** หน้า "ภาพรวม" (แท็บผลงาน): กราฟทั้งหมดที่เคยอยู่หน้าแรก */
  VIEWS.overview = function () {
    setTitle('📈 ภาพรวมสถานี', 'แนวโน้ม · รายเขต · รายรถ · สัดส่วนภารกิจ · คดี');
    clear($app); add($app, homeDash('full'));
  };
  VIEWS.summary = function () {
    setTitle('📊 สรุปผล', '');
    clear($app);
    var zone = '', out = h('div'), last = null;
    var zsel = h('select', { onchange: function () { zone = zsel.value; if (last) load(last[0], last[1]); } }, h('option', { value: '', text: 'ทั้งสถานี' }));
    Object.keys(S.boot.zones).forEach(function (z) { add(zsel, h('option', { value: z, text: S.boot.zones[z] })); });
    if (S.boot.perms.zone) { zsel.value = String(S.boot.perms.zone); zone = zsel.value; zsel.disabled = true; }
    add($app, rangePicker(function (a, b) { load(a, b); }), h('div', { class: 'card' }, zsel), out);
    function load(a, b) {
      last = [a, b]; clear(out); add(out, h('div', { class: 'loading' }, spinner()), skeleton(2));
      live('summary', { from: a, to: b, zone: zone }, function (s) { renderSummary(out, s); }, function (e) { clear(out); add(out, errorBox(e.message)); });
    }
  };
  function renderSummary(out, s) {
    clear(out);
    var t = s.total, CL = Charts.COLORS, vmap = {}; (S.boot.violations || []).forEach(function (v) { vmap[v.code] = v; });
    var multiDay = s.from !== s.to;
    // 1) ตัวเลขหลัก
    var k = card('รวม ' + (multiDay ? th(s.from) + ' – ' + th(s.to) : th(s.from))), kp = h('div', { class: 'kpis' });
    [['🧾 ใบสั่ง', t.ticket, 'ticket'], ['🚚 พ.ร.บ.ขนส่ง', t.T, 'T'], ['🚗 พ.ร.บ.รถยนต์', t.C, 'C'], ['🚨 จับกุม (ราย/หมาย)', t.arrest + (t.arrestPending ? ' (+' + t.arrestPending + '⏳)' : ''), 'arrest'],
      ['🚔 ว.42', t.escort, 'escort'], ['🤝 ช่วยเหลือ', t.assist, 'assist'], ['🗣️ ตักเตือน', t.warning, 'warning'], ['🛡️ ถปภ.', t.escortRoyal || 0, 'escort', 'nz']].forEach(function (x) {
      add(kp, h('div', { class: 'kpi' + (x[3] ? ' ' + x[3] : ''), style: 'border-top:3px solid ' + (CL[x[2]] || CL.muted) }, h('div', { class: 'n', text: x[1] }), h('div', { class: 't', text: x[0] })));
    });
    add(k, kp);
    // 2) วินัยการรายงาน
    var d = s.discipline, pct = d.scheduled ? Math.round(d.reported * 100 / d.scheduled) : 0;
    if (d.scheduled) {
      add(k, Charts.gauge(pct, '📋 วินัยการรายงาน: ส่งเวร ' + d.reported + '/' + d.scheduled + ' ผลัด (' + pct + '%)' + (d.noResult ? ' · ไม่มีผล ' + d.noResult : '') + (d.checkedInOnly ? ' · เข้าเวรแต่ไม่ส่ง ' + d.checkedInOnly : '')));
      if (d.missing.length) add(k, h('details', null, h('summary', { class: 'small', text: '🔴 ผลัดที่ยังไม่ส่งเวร ' + d.missing.length + ' ผลัด' }), h('div', { class: 'small', text: d.missing.map(function (m) { return th(m.date) + (m.shift === 'N' ? '🌙' : '☀️') + m.car; }).join(' · ') })));
    }
    add(out, markZeros(k));
    // 2.5) รายรถ + รายการคดี (ผู้บังคับบัญชาต้องเห็นว่าคันไหนทำอะไร)
    if (s.board) {
      var bc = card('🚓 คะแนนผลงานรายรถ', '▲▼ เทียบ ' + th(s.board.prev.from) + (s.board.prev.to !== s.board.prev.from ? ' – ' + th(s.board.prev.to) : ''));
      add(bc, carScoreList(s.board.cars),
        h('details', { style: 'margin-top:10px' }, h('summary', { class: 'small', text: '📋 ตารางละเอียดรายรถ (ผลัด · ฐานความผิด · เจ้าหน้าที่ · ต่อผลัด)' }), boardTable(s.board.cars),
          info('คดีจับร่วมนับให้ทุกคันที่ร่วม · (ตัวเลข) หลังชื่อ = จำนวนผลัดที่ขึ้นรถคันนั้น · ต่อผลัด = คะแนน ÷ ผลัด')),
        s.board.criteria ? h('p', { class: 'small muted', style: 'margin:4px 0 0', text: weightNote(s.board.criteria) }) : null);
      add(out, markZeros(bc));
      add(out, markZeros(mixCard(s.board.mix, s.board.cars)));
      var cl = card('🚨 รายการคดีอาญา', s.board.cases.length + ' คดี'); add(cl, caseList(s.board.cases)); add(out, cl);
    }
    // 3) แนวโน้มรายวัน (เฉพาะช่วงหลายวัน)
    var days = Object.keys(s.byDay || {}).sort();
    if (multiDay) {
      var all = [], cur = s.from; while (cur <= s.to && all.length < 62) { all.push(cur); cur = addDays(cur, 1); }
      var rows = all.map(function (dt) { var b = s.byDay[dt] || {}; return { label: String(+dt.slice(8, 10)), values: { ticket: b.ticket || 0, escort: b.escort || 0, arrest: b.arrest || 0, assist: b.assist || 0 } }; });
      var tc = card('📈 แนวโน้มรายวัน', 'แกนนอน = วันที่');
      add(tc, Charts.line(rows, [{ key: 'ticket', label: 'ใบสั่ง', color: CL.ticket }, { key: 'escort', label: 'ว.42', color: CL.escort }, { key: 'assist', label: 'ช่วยเหลือ', color: CL.assist }, { key: 'arrest', label: 'จับกุม', color: CL.arrest }]));
      add(out, tc);
    }
    // 4) รายเขต (ซ้อน ขนส่ง/รถยนต์/จราจร) + ว.42/ช่วยเหลือ/จับกุม
    var zr = []; for (var z = 1; z <= 6; z++) { var b = s.byZone[z] || {}; zr.push({ label: 'เขต ' + z, values: { T: b.T || 0, C: b.C || 0, R: b.R || 0 }, ev: { escort: b.escort || 0, assist: b.assist || 0, arrest: b.arrest || 0 } }); }
    var zc = card('📍 ใบสั่งรายเขต');
    add(zc, Charts.hbar(zr, [{ key: 'T', label: 'พ.ร.บ.ขนส่ง', color: CL.T }, { key: 'C', label: 'พ.ร.บ.รถยนต์', color: CL.C }, { key: 'R', label: 'พ.ร.บ.จราจร', color: CL.R }], { labelW: 60 }));
    add(zc, h('h3', { style: 'margin-top:12px', text: 'ว.42 · ช่วยเหลือ · จับกุม รายเขต' }));
    add(zc, Charts.bar(zr.map(function (r) { return { label: r.label.replace('เขต ', ''), values: r.ev }; }), [{ key: 'escort', label: 'ว.42', color: CL.escort }, { key: 'assist', label: 'ช่วยเหลือ', color: CL.assist }, { key: 'arrest', label: 'จับกุม', color: CL.arrest }], { height: 150 }));
    add(out, zc);
    // 5) รายรถ
    var cars = Object.keys(s.byCar).sort(function (a, b) { return s.byCar[b].ticket - s.byCar[a].ticket || String(a).localeCompare(b); });
    if (cars.length) {
      var cc = card('🚓 ใบสั่งรายรถ', 'เรียงมาก → น้อย');
      add(cc, Charts.hbar(cars.map(function (c) { var b = s.byCar[c]; return { label: c + (b.zone ? ' (ข.' + b.zone + ')' : ''), values: { T: b.T, C: b.C, R: b.R } }; }), [{ key: 'T', label: 'ขนส่ง', color: CL.T }, { key: 'C', label: 'รถยนต์', color: CL.C }, { key: 'R', label: 'จราจร', color: CL.R }], { labelW: 86 }));
      add(out, cc);
    }
    // 6) สัดส่วนประเภทความผิด / ประเภทคดี / กลางวัน-กลางคืน
    var codes = Object.keys(t.byCode || {}).map(function (c) { return { label: (vmap[c] && (vmap[c].short || vmap[c].label)) || c, value: t.byCode[c] }; });
    if (codes.length) { var vc = card('🧾 สัดส่วนประเภทความผิด'); add(vc, Charts.share(codes)); add(out, vc); }
    var cm = t.byCrime || t.byArrestCat || {}, cats = Object.keys(cm).filter(function (c) { return cm[c]; }).map(function (c) { return { label: DASH_CAT[c] || c, value: cm[c] }; });
    if (cats.length) { var ac = card('🚨 สัดส่วนประเภทคดี'); add(ac, Charts.share(cats)); add(out, ac); }
    var ds = card('☀️ กลางวัน vs 🌙 กลางคืน');
    add(ds, Charts.bar([{ label: 'ใบสั่ง', values: { D: s.byShift.D.ticket, N: s.byShift.N.ticket } }, { label: 'ว.42', values: { D: s.byShift.D.escort, N: s.byShift.N.escort } }, { label: 'ช่วยเหลือ', values: { D: s.byShift.D.assist, N: s.byShift.N.assist } }, { label: 'จับกุม', values: { D: s.byShift.D.arrest, N: s.byShift.N.arrest } }],
      [{ key: 'D', label: 'กลางวัน', color: '#f2b544' }, { key: 'N', label: 'กลางคืน', color: '#3b4a6b' }], { height: 150 }));
    add(out, ds);
    // 7) รายบุคคล
    var ppl = Object.keys(s.people).map(function (k) { var p = s.people[k]; if (p.tickets == null) p.tickets = (p.issued || 0) + (p.ticketJoint || 0); return p; }).sort(function (a, b) { return b.tickets - a.tickets || b.nShifts - a.nShifts; });
    if (ppl.length) {
      var pc = card('👮 ผลงานรายบุคคล', 'ใบสั่งของรถที่ขึ้นปฏิบัติ (ทุกคนในรถได้เท่ากัน) · ออกเอง = เทียบ PTM');
      add(pc, Charts.hbar(ppl.slice(0, 15).map(function (p) { return { label: p.short || p.pid, values: { tickets: p.tickets } }; }), [{ key: 'tickets', label: 'ใบสั่ง', color: CL.ticket }], { labelW: 88 }));
      add(pc, h('details', null, h('summary', { class: 'small', text: 'ตารางละเอียด' }),
        table(['ชื่อ', 'ผลัด', 'ใบสั่ง', 'ออกเอง', 'ต่อผลัด', 'จับ(หลัก/ร่วม)', 'ว.42', 'ช่วย'], ppl.map(function (p) { return [p.short || p.pid, p.nShifts + ' (☀️' + p.nDay + '/🌙' + p.nNight + ')', p.tickets, p.issued, p.ratePerShift, p.arrestPrimary + '/' + p.arrestJoint, p.escort, p.assist]; }))));
      add(out, pc);
    }
  }
  function table(head, rows) {
    var t = h('table', { class: 't' }), tr = h('tr');
    head.forEach(function (x) { add(tr, h('th', { text: x })); }); add(t, h('thead', null, tr));
    var tb = h('tbody'); rows.forEach(function (r) { var row = h('tr'); r.forEach(function (x) { add(row, h('td', { text: x == null ? '' : x })); }); add(tb, row); }); add(t, tb);
    return h('div', { class: 'scroll-x' }, t);
  }

  // ======================= รายการที่ส่งแล้ว (แก้ไข/ยกเลิก) =======================
  var KIND_ICON = { shift: '🚓', escort: '🚔', assist: '🤝', arrest: '🚨', mission: '🎖️' };
  VIEWS.history = function (params) {
    setTitle('📝 รายการที่ส่งแล้ว', can('report.editOthers') ? 'ทั้งสถานี · แก้ไข/ยกเลิกได้ทุกรายการ' : 'ของท่าน · แก้ไข/ยกเลิกได้ภายใน 24 ชม.');
    clear($app);
    var out = h('div'), last = null;
    var t = today(), c = cycleOf(t);
    var presets = [['7 วันล่าสุด', addDays(t, -6), t], ['วงรอบนี้', c.from, c.to], ['30 วัน', addDays(t, -29), t]], sel = 0, chips = h('div', { class: 'chips' });
    function rc() { clear(chips); presets.forEach(function (p, i) { add(chips, h('button', { class: 'chip' + (i === sel ? ' on' : ''), onclick: function () { sel = i; rc(); load(); }, text: p[0] })); }); }
    rc(); add($app, h('div', { class: 'card' }, chips), out);
    function load(fresh) {
      var p = presets[sel]; last = p; clear(out); add(out, h('div', { class: 'loading' }, spinner()), skeleton(3));
      live('history.list', { from: p[1], to: p[2] }, function (rows) { if (last !== p) return;
        clear(out);
        if (!rows.length) { var e0 = card('ไม่มีรายการ'); add(e0, h('p', { class: 'muted', text: 'ยังไม่มีรายการที่ส่งในช่วงนี้' })); return add(out, e0); }
        add(out, h('div', { class: 'center', style: 'margin:0 0 8px' }, xlBtn('รายการทั้งหมดเป็น .xlsx', function () {
          xlsxDownload('รายการที่ส่งแล้ว_' + p[1] + '_' + p[2] + '.xlsx', [{ name: 'รายการที่ส่งแล้ว', head: ['วันที่', 'ผลัด', 'เขต', 'รถ', 'ประเภท', 'รายการ', 'สถานะ', 'ผู้ดำเนินการ', 'แก้ไข (ครั้ง)', 'แก้ไขล่าสุด'],
            rows: rows.map(function (r) { var au = r.audit || {}, l = au.last;
              return [r.dutyDate, r.shift === 'N' ? 'กลางคืน' : r.shift === 'D' ? 'กลางวัน' : '', r.zone || '', r.car || '', { shift: 'ผลัด', escort: 'ว.42', assist: 'ช่วยเหลือ', arrest: 'จับกุม', mission: 'ภารกิจ' }[r.kind] || r.kind,
                r.kind === 'shift' ? 'เจ้าหน้าที่: ' + (r.crew || []).join(', ') + (r.totals && r.totals.ticket ? ' · ใบสั่ง ' + r.totals.ticket : '') : r.title, statusTxt(r).replace(/^\S+\s/, ''),
                r.kind === 'shift' ? [r.checkinBy && 'เข้าเวร ' + r.checkinBy, r.checkoutBy && 'ส่งเวร ' + r.checkoutBy].filter(Boolean).join(' · ') : [r.reporter && 'บันทึก ' + r.reporter, r.endBy && 'จบ ' + r.endBy].filter(Boolean).join(' · '),
                au.edits || 0, l ? l.label + ' โดย ' + l.by + ' ' + String(l.at).replace('T', ' ').slice(0, 16) : '']; }) }], [['ช่วงวันที่', th(p[1]) + ' – ' + th(p[2])]]);
        })));
        var byDay = {}; rows.forEach(function (r) { (byDay[r.dutyDate] = byDay[r.dutyDate] || []).push(r); });
        Object.keys(byDay).sort().reverse().forEach(function (d) {
          var cd = card(th(d)), list = h('div', { class: 'list' });
          byDay[d].forEach(function (r) { add(list, row(r)); });
          add(cd, list); add(out, cd);
        });
      }, function (e) { clear(out); add(out, errorBox(e.message)); });
    }
    function statusTxt(r) {
      if (r.kind === 'shift') return r.status === 'ยกเลิก' ? '🗑 ยกเลิกแล้ว' : r.status === 'ส่งเวร' ? '✅ ส่งเวรแล้ว ' + hm(r.checkoutAt) : r.status === 'ไม่มีผล' ? '⚪ ส่งเวร (ไม่มีผล)' : '🟢 เข้าเวรแล้ว ' + hm(r.checkinAt) + ' (ยังไม่ส่งเวร)';
      var m = { void: '🗑 ยกเลิกแล้ว', active: '⏱ กำลังนำขบวน', waiting: '🟣 รอรับกลับ', scheduled: '🕒 ลงนัดไว้', pending: '⏳ รอตรวจ', approved: '✅ อนุมัติแล้ว', returned: '↩️ ส่งกลับแก้', ok: '✅ บันทึกแล้ว' };
      return (m[r.status] || r.status) + (r.at ? ' ' + hm(r.at) : '');
    }
    function row(r) {
      var title = r.kind === 'shift' ? (r.shift === 'N' ? '🌙' : '☀️') + ' ผลัด' + (r.shift === 'N' ? 'กลางคืน' : 'กลางวัน') + ' · รถ ' + r.car + ' · เขต ' + r.zone : r.title + (r.car ? ' · รถ ' + r.car : '');
      var sub = statusTxt(r) + (r.kind === 'shift' && r.totals && r.totals.ticket ? ' · ใบสั่ง ' + r.totals.ticket : '');
      // ผู้ดำเนินการ: ใครเข้าเวร/ส่งเวร/บันทึก/จบขบวน + แก้ไขล่าสุดโดยใคร
      var who = r.kind === 'shift' ? [r.checkinBy && 'เข้าเวร: ' + r.checkinBy, r.checkoutBy && 'ส่งเวร: ' + r.checkoutBy] : [r.reporter && 'บันทึก: ' + r.reporter, r.endBy && 'จบขบวน: ' + r.endBy];
      who = who.filter(Boolean).join(' · ');
      var au = r.audit || {}, last = au.last;
      var el = h('div', { class: 'list-item hist' + (r.status === 'void' || r.status === 'ยกเลิก' ? ' off' : '') },
        h('div', { class: 'hist-main' }, h('span', { class: 'ic', text: KIND_ICON[r.kind] || '•' }), h('div', { class: 'tx' }, h('b', { text: title }), h('small', { text: sub }),
          who ? h('small', { class: 'hist-who', text: '👤 ' + who }) : null,
          last ? h('small', { class: 'hist-edit', text: (au.edits ? '✏️ แก้ไขแล้ว ' + au.edits + ' ครั้ง · ' : '') + 'ล่าสุด: ' + last.label + ' โดย ' + last.by + ' ' + whenTxt(last.at) }) : null)));
      var btns = h('div', { class: 'hist-btns' });
      if (r.canEdit) add(btns, h('button', { class: 'btn ghost sm', onclick: function () { edit(r); }, text: '✏️ แก้ไข' }));
      if (r.canVoid) add(btns, h('button', { class: 'btn ghost sm red-ghost', onclick: function () { cancel(r); }, text: '🗑 ยกเลิก' }));
      if (r.kind === 'arrest') add(btns, h('button', { class: 'btn ghost sm', onclick: function () { go('case', { id: r.id }); }, text: '📄 เปิดคดี' }));
      add(btns, h('button', { class: 'btn ghost sm', onclick: function () { timeline(r, title); }, text: '🕘 ประวัติ' }));
      add(el, btns);
      return el;
    }
    function whenTxt(at) { at = String(at || ''); var d = at.slice(0, 10); return (d === today() ? '' : th(d) + ' ') + hm(at) + ' น.'; }
    /** ไทม์ไลน์: ใครทำอะไร เมื่อไร แก้จากอะไรเป็นอะไร และเหตุผล */
    function timeline(r, title) {
      var box = h('div', { class: 'tl' }, h('div', { class: 'loading' }, spinner()));
      modal('🕘 ประวัติรายการ', [h('div', { class: 'small muted', text: th(r.dutyDate) + ' · ' + title }), box], null);
      api('history.timeline', { id: r.id }, { fresh: true }).then(function (list) {
        clear(box);
        if (!list.length) return add(box, h('p', { class: 'muted', text: 'ยังไม่มีประวัติ' }));
        list.forEach(function (x) {
          add(box, h('div', { class: 'tl-item' }, h('div', { class: 'tl-dot' }), h('div', { class: 'tl-body' },
            h('div', null, h('b', { text: x.label }), h('span', { class: 'small muted', text: ' · ' + whenTxt(x.at) })),
            h('div', { class: 'small', text: '👤 ' + (x.by || '-') }),
            x.lines.length ? h('ul', { class: 'tl-lines' }, x.lines.map(function (l) { return h('li', { text: l }); })) : null,
            x.reason ? h('div', { class: 'small muted', text: 'เหตุผล: ' + x.reason }) : null)));
        });
      }, function (e) { clear(box); add(box, errorBox(e.message)); });
    }
    function edit(r) {
      if (r.kind === 'shift') {
        var q = { d: r.dutyDate, s: r.shift, car: r.car };
        if (r.status === 'ส่งเวร' || r.status === 'ไม่มีผล') return go('checkout', q);
        return modal('แก้ไขผลัดนี้', [h('p', { class: 'muted', text: 'เลือกสิ่งที่ต้องการแก้' }),
          h('button', { class: 'btn block', style: 'margin-bottom:8px', onclick: function () { closeModal(); go('checkin', q); }, text: '🟢 แก้เจ้าหน้าที่/รายการตรวจ (เข้าเวร)' }),
          h('button', { class: 'btn green block', onclick: function () { closeModal(); go('checkout', q); }, text: '✅ ส่งเวร/แก้ผลการปฏิบัติ' })]);
      }
      if (r.kind === 'arrest') return go('arrest', { id: r.id });
      if (r.kind === 'escort' && /^(scheduled|active|waiting)$/.test(r.status)) return go('escort', { id: r.id }); // ขบวนที่ยังไม่จบ แก้ที่หน้า ว.42
      if (r.kind === 'escort') return editEscort(r);
      if (r.kind === 'assist') return editAssist(r);
      toast('รายการประเภทนี้แก้ไขจากหน้านี้ไม่ได้');
    }
    function reasonBox() { return h('textarea', { placeholder: 'เหตุผลการแก้ไข (จำเป็น)' }); }
    function afterEdit(res) { apiInvalidate(); refreshBoot(); done('แก้ไขแล้ว', res.message, { next: 'history', nextText: 'กลับไปรายการ' }); }
    function editEscort(r) {
      var p = r.payload || {};
      var name = h('input', { value: p.name || '', placeholder: 'ชื่อขบวน' }), from = h('input', { value: p.from || '', placeholder: 'ต้นทาง' }), to = h('input', { value: p.to || '', placeholder: 'ปลายทาง' });
      var hf = h('input', { value: p.handoverFrom || '', placeholder: 'รับช่วงจาก' }), ht = h('input', { value: p.handoverTo || '', placeholder: 'ส่งต่อให้' }), res = h('input', { value: p.result || '', placeholder: 'ผล/หมายเหตุ' });
      var rt = h('input', { type: 'checkbox', checked: p.trips === 2 }), reason = reasonBox();
      modal('แก้ไข ว.42', [h('label', { class: 'f', text: 'ชื่อขบวน' }), name, h('div', { class: 'row2' }, from, to), h('div', { class: 'row2' }, hf, ht), res,
        p.end ? h('label', { class: 'cap' }, rt, ' ไป-กลับ (นับ 1 ขบวน)') : null, h('label', { class: 'f', text: 'เหตุผล' }), reason], 'บันทึกการแก้ไข', function () {
        return api('event.update', { id: r.id, reason: reason.value, fields: { name: name.value, from: from.value, to: to.value, handoverFrom: hf.value, handoverTo: ht.value, result: res.value, roundTrip: rt.checked } }).then(afterEdit);
      });
    }
    function editAssist(r) {
      var p = r.payload || {}, type = r.title, types = h('div', { class: 'chips' });
      function rt() { clear(types); S.boot.assistTypes.forEach(function (k) { add(types, h('button', { class: 'chip' + (k === type ? ' on' : ''), onclick: function () { type = k; rt(); }, text: k })); }); }
      rt();
      var road = h('input', { value: p.road || '', placeholder: 'ทล.' }), km = h('input', { value: p.km || '', placeholder: 'กม.' }), dir = h('input', { value: p.dir || '', placeholder: 'ขาเข้า/ขาออก' });
      var dead = h('input', { type: 'number', value: p.dead || 0 }), inj = h('input', { type: 'number', value: p.injured || 0 }), dmg = h('input', { type: 'number', value: p.damage || '', placeholder: 'ความเสียหาย (บาท)' });
      var res = h('textarea', { value: p.result || '', placeholder: 'การดำเนินการ/ผล' }), reason = reasonBox();
      res.value = p.result || '';
      modal('แก้ไขช่วยเหลือ/เหตุการณ์', [types, h('div', { class: 'row2' }, road, km), dir, h('label', { class: 'f', text: 'เสียชีวิต / บาดเจ็บ' }), h('div', { class: 'row2' }, dead, inj), dmg, res, h('label', { class: 'f', text: 'เหตุผล' }), reason], 'บันทึกการแก้ไข', function () {
        return api('event.update', { id: r.id, reason: reason.value, fields: { type: type, road: road.value, km: km.value, dir: dir.value, dead: dead.value, injured: inj.value, damage: dmg.value, result: res.value } }).then(afterEdit);
      });
    }
    function cancel(r) {
      var reason = h('textarea', { placeholder: 'เหตุผลการยกเลิก (จำเป็น) เช่น ส่งผิดรถ / ซ้ำ' });
      var what = r.kind === 'shift' ? 'รายงานผลัดนี้ทั้งหมด (เข้าเวร + ผลการปฏิบัติ)' : r.title;
      modal('ยกเลิก ' + what, [h('p', { class: 'muted small', text: 'ระบบจะไม่นับรายการนี้ในสถิติ และเก็บประวัติไว้ว่าใครยกเลิกเมื่อไร (ไม่ลบจริง)' }), reason], '🗑 ยืนยันยกเลิก', function () {
        var call = r.kind === 'shift' ? api('shift.void', { id: r.id, reason: reason.value }) : api('event.void', { id: r.id, reason: reason.value });
        return call.then(function () { toast('ยกเลิกแล้ว'); apiInvalidate(); refreshBoot(); load(true); });
      });
    }
    load();
  };

  // ======================= ผลของฉัน =======================
  VIEWS.me = function () {
    setTitle('👤 ผลของฉัน', S.boot.me.name);
    clear($app);
    var out = h('div');
    add($app, rangePicker(function (a, b) {
      clear(out); add(out, h('div', { class: 'loading' }, spinner()), skeleton(2));
      live('summary', { from: a, to: b }, function (s) {
        clear(out);
        var p = s.people[S.boot.me.pid] || { tickets: 0, issued: 0, ticketJoint: 0, arrestPrimary: 0, arrestJoint: 0, escort: 0, assist: 0, mission: 0, warning: 0, checks: 0, nShifts: 0, nDay: 0, nNight: 0, ratePerShift: 0 };
        var c = card('ผลงาน ' + th(a) + ' – ' + th(b)), kp = h('div', { class: 'kpis' });
        [['🗓 ผลัด', p.nShifts], ['☀️ กลางวัน', p.nDay], ['🌙 กลางคืน', p.nNight], ['🧾 ใบสั่ง (ทั้งรถ)', p.tickets != null ? p.tickets : (p.issued || 0) + (p.ticketJoint || 0)], ['✍️ ออกเอง (PTM)', p.issued], ['📈 ใบ/ผลัด', p.ratePerShift],
          ['🚨 จับ (หลัก)', p.arrestPrimary], ['🚨 จับ (ร่วม)', p.arrestJoint], ['🚔 ว.42', p.escort], ['🤝 ช่วยเหลือ', p.assist], ['🎖️ ภารกิจ', p.mission], ['🗣️ ตักเตือน', p.warning]].forEach(function (x) {
          add(kp, h('div', { class: 'kpi' }, h('div', { class: 'n', text: x[1] }), h('div', { class: 't', text: x[0] })));
        });
        add(c, kp); add(out, c);
      }, function (e) { clear(out); add(out, errorBox(e.message)); });
    }), out);
  };

  // ======================= คะแนนผลการปฏิบัติ =======================
  function fmtPts(n) { n = Math.round((+n || 0) * 100) / 100; return (n > 0 ? '' : '') + n.toLocaleString('th-TH'); }
  /** แถบคะแนน (รองรับค่าติดลบ — แสดงเป็นแถบสีแดง) */
  function scoreBars(rows) {
    var max = 0; rows.forEach(function (r) { max = Math.max(max, Math.abs(r.value)); });
    var box = h('div', { class: 'sbars' });
    rows.forEach(function (r) {
      var w = max ? Math.max(2, Math.round(Math.abs(r.value) * 100 / max)) : 0;
      add(box, h('div', { class: 'sbar' }, h('span', { class: 'lb', text: r.label }), h('span', { class: 'tr' }, h('i', { class: r.value < 0 ? 'neg' : '', style: 'width:' + w + '%' })), h('b', { class: r.value < 0 ? 'neg' : '', text: fmtPts(r.value) })));
    });
    return box;
  }
  function announceScore(id) {
    return api('score.text', { id: id }).then(function (t) { return postToChat(t); }).then(function (r) {
      toast(r === 'sent' ? 'ส่งประกาศเข้ากลุ่มแล้ว' : r === 'shared' ? 'แชร์ประกาศแล้ว' : r === 'copied' ? '📋 คัดลอกประกาศแล้ว — วางในกลุ่มรายงานได้เลย' : 'ยกเลิก', 3500);
    });
  }
  /** การ์ดเกณฑ์คะแนน 1 ชุด */
  function criteriaCard(w, L, canManage) {
    var x = w.weights, c = card('📋 ' + w.name, w.id === 'default' ? 'เกณฑ์มาตรฐาน' : th(w.from) + ' – ' + th(w.to));
    var items = [];
    ['T', 'C', 'R'].forEach(function (k) { items.push(['🧾 ' + L.act[k], x.act[k], 'ใบ']); });
    var cmap = {}; (L.codes || S.boot.violations || []).forEach(function (v) { cmap[v.code] = v; });
    var emph = Object.keys(x.code || {});
    items.push(['🚨 จับกุมตามหมายจับ', x.warrant, 'หมาย'], ['🚨 จับกุมซึ่งหน้า', x.flag, 'ราย']);
    Object.keys(x.cat || {}).forEach(function (k) { if (x.cat[k] !== x.flag && k !== 'พ.ร.บ.ยาเสพติด') items.push(['🚨 ซึ่งหน้า ' + k, x.cat[k], 'ราย']); });
    var dg = x.drug; // ยาเสพติด: ต่อคดีตามของกลางรวม
    if (dg) items.push(['💊 ยาบ้า 1–' + fmtN(dg.methCut1) + ' เม็ด', dg.meth1, 'คดี'], ['💊 ยาบ้า ' + fmtN(dg.methCut1 + 1) + '–' + fmtN(dg.methCut2) + ' เม็ด', dg.meth2, 'คดี'], ['💊 ยาบ้า เกิน ' + fmtN(dg.methCut2) + ' เม็ด', dg.meth3, 'คดี'],
      ['💊 ไอซ์ ไม่เกิน ' + fmtN(dg.iceCut1) + ' กรัม', dg.ice1, 'คดี'], ['💊 ไอซ์ ' + fmtN(dg.iceCut1) + '–' + fmtN(dg.iceCut2) + ' กรัม', dg.ice2, 'คดี'], ['💊 ไอซ์ เกิน ' + fmtN(dg.iceCut2) + ' กรัม', dg.ice3, 'คดี'],
      ['💊 ยาเสพติดชนิดอื่น', dg.other, 'คดี'], ['💊 ไม่มีของกลาง (เสพ)', dg.none, 'คดี']);
    L.items.forEach(function (i) { if (x[i[0]]) items.push([i[1], x[i[0]], i[2]]); });
    if (x.missed) items.push(['🔴 ไม่ส่งเวรตามกำหนด', x.missed, 'ผลัด']);
    if (emph.length) add(c, h('div', { class: 'emph' }, h('b', { text: '⭐ เน้นย้ำช่วงนี้' }), emph.map(function (k) { return h('div', { text: (cmap[k] ? cmap[k].label : k) + ' — ' + fmtPts(x.code[k]) + ' คะแนน/ใบ' }); })));
    var tbl = h('div', { class: 'crit' });
    items.forEach(function (i) { add(tbl, h('div', { class: 'ci' }, h('span', { text: i[0] }), h('b', { class: i[1] < 0 ? 'neg' : '', text: fmtPts(i[1]) + ' / ' + i[2] }))); });
    add(c, tbl, h('p', { class: 'muted small', text: 'ใบสั่ง: เจ้าหน้าที่ทุกคนในรถได้คะแนนเท่ากัน · จับกุม: หมายจับคิดต่อหมาย (1 ราย 3 หมาย = 3 หมาย) ซึ่งหน้าคิดต่อราย · ยาเสพติดคิดต่อคดีตามของกลางรวม (ไม่คูณจำนวนผู้ต้องหา หลายชนิดใช้ขั้นสูงสุด) · คดีร่วมหลายคัน: รถผู้จับหลักได้ ' + fmtPts(x.primaryPct != null ? x.primaryPct : 60) + '% รถที่ร่วมแบ่งส่วนที่เหลือ (รวม 100%) ระบุรถหลักไม่ได้หารเท่ากัน · ทุกคนในรถได้เท่าส่วนของรถ' }));
    if (w.note) add(c, h('p', { class: 'small', text: 'หมายเหตุ: ' + w.note }));
    if (canManage) add(c, h('div', { class: 'row', style: 'margin-top:8px' }, submitBtn('📣 ประกาศเกณฑ์นี้เข้ากลุ่ม', 'ghost sm grow', function () { return announceScore(w.id); })));
    return c;
  }
  VIEWS.score = function () {
    setTitle('🏅 คะแนนผลการปฏิบัติ', S.boot.me.name);
    clear($app);
    var t = today(), cy = cycleOf(t), sel = null, out = h('div'), chips = h('div', { class: 'chips' }), info = null;
    add($app, h('div', { class: 'card' }, chips), out);
    function presets() {
      var ps = [];
      if (info && info.current) ps.push(['cur', '⭐ ' + info.current.name, info.current.from, info.current.to]);
      ((info && info.periods) || []).filter(function (p) { return !info.current || p.id !== info.current.id; }).slice(0, 3).forEach(function (p) { ps.push(['p' + p.id, p.name, p.from, p.to]); });
      ps.push(['cycle', 'วงรอบนี้', cy.from, cy.to], ['month', 'เดือนนี้', t.slice(0, 8) + '01', t]);
      return ps;
    }
    function drawChips() {
      clear(chips);
      presets().forEach(function (p) { add(chips, h('button', { class: 'chip' + (p[0] === sel ? ' on' : ''), onclick: function () { load(p); }, text: p[0] === 'cur' || p[0] === 'cycle' || p[0] === 'month' ? p[1] : p[1] + ' (' + th(p[2]) + '–' + th(p[3]) + ')' })); });
    }
    function load(p) {
      sel = p[0]; drawChips(); clear(out); add(out, h('div', { class: 'loading' }, spinner()), skeleton(3));
      api('score.get', { from: p[2], to: p[3] }).then(function (d) {
        var first = !info; info = d;
        if (first && d.current && sel === 'cycle') return load(presets()[0]); // มีช่วงคะแนนปัจจุบัน → เปิดช่วงนั้นก่อน
        drawChips(); render(d);
      }, function (e) { clear(out); add(out, errorBox(e.message)); });
    }
    function render(d) {
      clear(out);
      var L = d.labels;
      // คะแนนของฉัน
      var mc = card('👤 คะแนนของฉัน', th(d.from < d.start ? d.start : d.from) + ' – ' + th(d.to));
      if (d.from < d.start) add(out, h('p', { class: 'muted small', text: 'เริ่มคิดคะแนนตั้งแต่ ' + th(d.start) + ' — วันที่ก่อนหน้านั้นไม่คิดคะแนนและไม่หัก' }));
      if (d.group === 'ไม่คิดคะแนน') add(mc, h('p', { class: 'muted', text: 'ท่านอยู่หมวด "ไม่คิดคะแนน" — ดูเกณฑ์ด้านล่างได้' }));
      else if (!d.me) add(mc, h('p', { class: 'muted', text: d.group === 'ธุรการ' ? 'หมวดธุรการ: ได้คะแนนเฉพาะผลัดที่ขึ้นรถตรวจ — ช่วงนี้ยังไม่มี' : 'ยังไม่มีคะแนนในช่วงนี้' }));
      else {
        var m = d.me;
        add(mc, h('div', { class: 'score-hero' }, h('div', { class: 'n' + (m.score < 0 ? ' neg' : ''), text: fmtPts(m.score) }), h('div', null,
          h('b', { text: 'อันดับ ' + m.rank + ' จาก ' + m.of }), h('div', { class: 'small muted', text: (m.group === 'ธุรการ' ? 'ธุรการที่ออกตรวจ' : 'สายตรวจ') + ' · ' + m.shifts + ' ผลัด · เฉลี่ย ' + fmtPts(m.avg) + '/ผลัด' }),
          m.missed ? h('div', { class: 'small', style: 'color:var(--red)', text: '🔴 ไม่ส่งเวรตามกำหนด ' + m.missed + ' ผลัด' }) : null)));
        add(mc, scoreBars(L.parts.filter(function (p) { return m.parts[p[0]]; }).map(function (p) { return { label: p[1], value: m.parts[p[0]] }; })));
      }
      add(out, mc);
      // เกณฑ์ที่ใช้ในช่วงนี้
      if (d.criteria.length > 1) add(out, h('p', { class: 'muted small', text: 'ช่วงที่เลือกใช้เกณฑ์ ' + d.criteria.length + ' ชุด — คิดคะแนนแต่ละวันตามเกณฑ์ของวันนั้น' }));
      d.criteria.forEach(function (w) { add(out, criteriaCard(w, L, d.canManage)); });
      // ตารางอันดับ (ผู้บังคับบัญชา)
      if (d.canViewAll) {
        function rankTable(list, title, sub) {
          var c = card(title, sub);
          if (!list.length) { add(c, h('p', { class: 'muted', text: 'ยังไม่มีข้อมูลในช่วงนี้' })); return c; }
          add(c, scoreBars(list.slice(0, 15).map(function (p) { return { label: p.rank + '. ' + (p.short || p.name), value: p.score }; })));
          add(c, h('details', null, h('summary', { class: 'small', text: 'ตารางทั้งหมด ' + list.length + ' นาย' }),
            table(['#', 'ชื่อ', 'คะแนน', 'เฉลี่ย/ผลัด', 'ผลัด', 'ใบสั่ง', 'จับกุม', 'บริการ', 'หัก'], list.map(function (p) {
              return [p.rank, p.short || p.name, fmtPts(p.score), fmtPts(p.avg), p.shifts, fmtPts(p.parts.ticket), fmtPts(p.parts.arrest), fmtPts(p.parts.service + p.parts.mission), fmtPts(p.parts.penalty)]; }))));
          return c;
        }
        add(out, rankTable(d.patrol, '🏆 อันดับสายตรวจ', 'เรียงตามคะแนนรวม'));
        if (d.office.length) add(out, rankTable(d.office, '🗂 ธุรการที่ออกตรวจ', 'นับเฉพาะผลัดที่ขึ้นรถ · ไม่จัดอันดับรวมกับสายตรวจ'));
        var cc = card('🚓 คะแนนรายรถ', 'ผลของรถนับครั้งเดียว');
        if (d.cars.length) add(cc, scoreBars(d.cars.slice(0, 20).map(function (c) { return { label: c.car + ' · เขต ' + c.zone, value: c.score }; }))); else add(cc, h('p', { class: 'muted', text: 'ยังไม่มีข้อมูล' }));
        add(out, cc);
        var zc = card('🗺 คะแนนรายเขต');
        add(zc, scoreBars(Object.keys(d.zones).map(function (z) { return { label: S.boot.zones[z] || ('เขต ' + z), value: d.zones[z] }; })));
        add(out, zc);
      }
      if (d.canManage) add(out, h('div', { class: 'list' }, rowLink('⚙️', 'ตั้งเกณฑ์คะแนน', 'สร้าง/แก้ช่วงคะแนน · เกณฑ์มาตรฐาน · ประกาศเข้ากลุ่ม', function () { go('scoreAdmin'); })));
      add(out, h('p', { class: 'muted small center', text: 'คะแนนคำนวณจากรายงานในระบบ (คดีนับเมื่ออนุมัติแล้ว) · ใบสั่งรายบุคคลไม่ใช่ยอดตาม PTM' }));
    }
    load(['cycle', 'วงรอบนี้', cy.from, cy.to]);
  };

  // ตั้งเกณฑ์คะแนน (หัวหน้าสถานี/แอดมิน)
  VIEWS.scoreAdmin = function (params) {
    setTitle('⚙️ ตั้งเกณฑ์คะแนน', 'แต่ละช่วงแก้ได้โดยไม่กระทบช่วงอื่น');
    loading();
    api('score.get', { from: today(), to: today() }, { fresh: true }).then(function (d) {
      if (!d.canManage) { clear($app); add($app, errorBox('ไม่มีสิทธิ์ตั้งเกณฑ์คะแนน')); return; }
      clear($app);
      var t = today(), L = d.labels;
      if (params && params.saved) add($app, h('div', { class: 'card success' }, h('b', { text: '✅ บันทึก "' + params.savedName + '" แล้ว' }), h('p', { class: 'small', text: 'ประกาศให้เจ้าหน้าที่ทราบเกณฑ์ใหม่' }),
        submitBtn('📣 ประกาศเข้ากลุ่มรายงาน', 'green block', function () { return announceScore(params.saved); })));
      add($app, h('div', { class: 'note', text: 'วันที่ไม่อยู่ในช่วงใด ใช้เกณฑ์มาตรฐาน · ช่วงห้ามทับกัน · แก้เกณฑ์แล้วคะแนนในช่วงนั้นคำนวณใหม่ทันที' }));
      var stIn = h('input', { type: 'date', value: d.start });
      add($app, h('div', { class: 'card' }, field('เริ่มคิดคะแนนตั้งแต่วันที่', stIn, 'ก่อนวันนี้ไม่คิดคะแนนและไม่หักคะแนนไม่ส่งเวร (เช่น ช่วงก่อนเปิดใช้ระบบ)'),
        submitBtn('บันทึกวันเริ่ม', 'ghost sm', function () { return api('score.start', { date: stIn.value }).then(function () { apiInvalidate(); toast('บันทึกวันเริ่มคิดคะแนนแล้ว'); }); })));
      add($app, h('button', { class: 'btn block', style: 'margin:8px 0', onclick: function () { editor(null, d.standard); }, text: '+ สร้างช่วงคะแนนใหม่' }));
      function row(w, isStd) {
        var now = !isStd && w.from <= t && t <= w.to, past = !isStd && w.to < t;
        var c = card(w.name, isStd ? 'เกณฑ์มาตรฐาน' : th(w.from) + ' – ' + th(w.to));
        add(c, h('div', { class: 'row' }, now ? h('span', { class: 'badge green', text: 'ใช้อยู่ตอนนี้' }) : past ? h('span', { class: 'badge gray', text: 'ผ่านไปแล้ว' }) : isStd ? null : h('span', { class: 'badge amber', text: 'ยังไม่ถึง' }),
          Object.keys(w.weights.code).length ? h('span', { class: 'small muted', text: '⭐ เน้นย้ำ ' + Object.keys(w.weights.code).length + ' รายการ' }) : null));
        add(c, h('div', { class: 'row', style: 'margin-top:8px;flex-wrap:wrap' },
          h('button', { class: 'btn sm', onclick: function () { editor(w); }, text: '✏️ แก้ไข' }),
          isStd ? null : h('button', { class: 'btn ghost sm', onclick: function () { editor(null, w); }, text: '📄 คัดลอกเป็นช่วงใหม่' }),
          submitBtn('📣 ประกาศ', 'ghost sm', function () { return announceScore(w.id); }),
          isStd ? null : submitBtn('ลบ', 'gray sm', function () { if (!confirm('ลบช่วง "' + w.name + '"? วันที่ในช่วงนี้จะกลับไปใช้เกณฑ์มาตรฐาน')) return; return api('score.delete', { id: w.id }).then(function () { toast('ลบแล้ว'); VIEWS.scoreAdmin(); }); })));
        return c;
      }
      add($app, row(d.standard, true));
      if (d.allPeriods.length) add($app, h('div', { class: 'section-label', text: 'ช่วงที่กำหนดเอง ' + d.allPeriods.length + ' ช่วง' }));
      d.allPeriods.forEach(function (w) { add($app, row(w, false)); });

      function editor(w, copyFrom) {
        var isStd = w && w.id === 'default', src = (w || copyFrom).weights, x = JSON.parse(JSON.stringify(src));
        setTitle(w ? '✏️ แก้เกณฑ์คะแนน' : '+ ช่วงคะแนนใหม่', w ? w.name : 'ค่าเริ่มจาก ' + (copyFrom.name || 'เกณฑ์มาตรฐาน'));
        clear($app); window.scrollTo(0, 0);
        function num(v, step) { return h('input', { type: 'number', inputmode: 'decimal', step: step || '0.5', value: v == null ? '' : String(v) }); }
        var name = h('input', { value: w ? w.name : '', placeholder: 'เช่น เน้นรถบรรทุก ต.ค. 69' });
        var nf = addDays(t, 1), from = h('input', { type: 'date', value: w ? w.from : nf }), to = h('input', { type: 'date', value: w ? w.to : addDays(nf, 9) });
        var head = card('ข้อมูลช่วง');
        add(head, field('ชื่อ', name));
        // คืนค่ามาตรฐานของระบบ (ค่าที่สถานีตั้งเป็นมาตรฐาน) — เติมทุกช่องใหม่ ยังไม่บันทึกจนกดบันทึก
        add(head, h('button', { class: 'btn ghost sm', type: 'button', onclick: function () {
          if (!confirm('เติมค่ามาตรฐานของระบบลงทุกช่อง? (ยังไม่บันทึกจนกด "บันทึกเกณฑ์")')) return;
          var base = { weights: JSON.parse(JSON.stringify(L.base)) };
          if (w) editor(Object.assign({}, w, base, { name: name.value }), copyFrom); else editor(null, Object.assign({}, copyFrom, base, { name: 'ค่ามาตรฐานของระบบ' }));
          toast('เติมค่ามาตรฐานแล้ว — ตรวจแล้วกดบันทึก');
        }, text: '↺ คืนค่ามาตรฐานของระบบ' }));
        if (!isStd) add(head, h('div', { class: 'row2' }, field('ตั้งแต่', from), field('ถึง', to)));
        add($app, head);
        // ใบสั่ง
        var actIn = {}, tc = card('🧾 ใบสั่ง (คะแนนต่อใบ)', 'ทุกคนในรถได้เท่ากัน');
        var ar = h('div', { class: 'grid3' }); ['T', 'C', 'R'].forEach(function (k) { actIn[k] = num(x.act[k]); add(ar, field(L.act[k], actIn[k])); }); add(tc, ar);
        var emBox = h('div'), codes = L.codes || [];
        function drawEm() {
          clear(emBox);
          Object.keys(x.code).forEach(function (k) {
            var v = codes.filter(function (c) { return c.code === k; })[0], inp = num(x.code[k]);
            inp.oninput = function () { x.code[k] = inp.value; };
            add(emBox, h('div', { class: 'em-row' }, h('span', { class: 'grow', text: '⭐ ' + (v ? v.label : k) }), inp, h('button', { class: 'btn gray sm', onclick: function () { delete x.code[k]; drawEm(); }, text: '×' })));
          });
        }
        drawEm();
        var csel = h('select', null, h('option', { value: '', text: '+ เลือกความผิดที่ต้องการเน้นย้ำ' }));
        codes.forEach(function (c) { add(csel, h('option', { value: c.code, text: c.label + ' (' + L.act[c.act] + ')' })); });
        csel.onchange = function () { if (csel.value && !(csel.value in x.code)) { x.code[csel.value] = Math.max(2, (+actIn[(codes.filter(function (c) { return c.code === csel.value; })[0] || {}).act || 'C'].value || 1) * 2); drawEm(); } csel.value = ''; };
        add(tc, h('label', { class: 'f', text: 'ความผิดที่เน้นย้ำ (คะแนนต่อใบแทนค่าตาม พ.ร.บ.)' }), emBox, csel);
        add($app, tc);
        // จับกุม
        var war = num(x.warrant), flag = num(x.flag), joint = num(x.primaryPct != null ? x.primaryPct : 60, '5'), catIn = {}, ac = card('🚨 จับกุมคดีอาญา', 'นับเมื่อคดีอนุมัติแล้ว');
        add(ac, h('div', { class: 'grid2' }, field('ตามหมายจับ (ต่อหมาย)', war), field('ซึ่งหน้า ทั่วไป (ต่อราย)', flag)));
        var cg = h('div', { class: 'grid2' });
        L.cats.forEach(function (k) { catIn[k] = num(x.cat[k]); catIn[k].placeholder = 'ใช้ค่าซึ่งหน้า'; add(cg, field('ซึ่งหน้า ' + k, catIn[k])); });
        // ยาเสพติด: แบ่งขั้นตามของกลางรวมของคดี
        var dg = x.drug || L.base.drug, dIn = {}, dc = h('div');
        function dnum(k, step) { dIn[k] = num(dg[k], step || '0.5'); return dIn[k]; }
        add(dc, h('label', { class: 'f', text: '💊 ยาเสพติด (ต่อคดี ตามของกลางรวม · หลายชนิดใช้ขั้นสูงสุด)' }),
          h('div', { class: 'small muted', text: 'ยาบ้า (เม็ด): ขั้น 1 ไม่เกิน / ขั้น 2 ไม่เกิน / เกินขั้น 2' }),
          h('div', { class: 'grid2' }, field('ขั้น 1 ไม่เกิน (เม็ด)', dnum('methCut1', '1')), field('ขั้น 2 ไม่เกิน (เม็ด)', dnum('methCut2', '1'))),
          h('div', { class: 'grid3' }, field('ขั้น 1 คะแนน', dnum('meth1')), field('ขั้น 2 คะแนน', dnum('meth2')), field('เกินขั้น 2', dnum('meth3'))),
          h('div', { class: 'small muted', text: 'ไอซ์ (กรัม)' }),
          h('div', { class: 'grid2' }, field('ขั้น 1 ไม่เกิน (กรัม)', dnum('iceCut1')), field('ขั้น 2 ไม่เกิน (กรัม)', dnum('iceCut2'))),
          h('div', { class: 'grid3' }, field('ขั้น 1 คะแนน', dnum('ice1')), field('ขั้น 2 คะแนน', dnum('ice2')), field('เกินขั้น 2', dnum('ice3'))),
          h('div', { class: 'grid2' }, field('ยาเสพติดชนิดอื่น (ต่อคดี)', dnum('other')), field('ไม่มีของกลาง/เสพ (ต่อคดี)', dnum('none'))));
        add(ac, dc);
        add(ac, cg, field('คดีร่วมหลายคัน: รถผู้จับหลักได้ (%)', joint, 'รถที่ร่วมแบ่งส่วนที่เหลือเท่ากัน รวม 100% · ระบุรถหลักไม่ได้หารเท่ากัน · ทุกคนในรถได้เท่าส่วนของรถ'));
        add($app, ac);
        // บริการ/ภารกิจ/วินัย
        var itIn = {}, sc = card('🤝 งานบริการ ภารกิจ และวินัย');
        var ig = h('div', { class: 'grid2' });
        L.items.forEach(function (i) { itIn[i[0]] = num(x[i[0]]); add(ig, field(i[1] + ' (ต่อ' + i[2] + ')', itIn[i[0]])); });
        var missed = num(Math.abs(x.missed));
        add(ig, field('🔴 ไม่ส่งเวร หัก (ต่อผลัด)', missed, 'หักเจ้าหน้าที่ทุกคนในรถ'));
        add(sc, ig); add($app, sc);
        var note = h('textarea', { placeholder: 'ข้อความเน้นย้ำถึงเจ้าหน้าที่ (แสดงในประกาศ)' }); note.value = w ? w.note || '' : (copyFrom && copyFrom.note) || '';
        var reason = h('input', { placeholder: 'เหตุผลการแก้ไข (บันทึกในประวัติ)' });
        var ncard = card('📝 หมายเหตุ'); add(ncard, note); if (w) add(ncard, field('เหตุผลการแก้ไข', reason)); add($app, ncard);
        add($app, bar(h('button', { class: 'btn gray', onclick: function () { VIEWS.scoreAdmin(); }, text: 'ยกเลิก' }), submitBtn('บันทึกเกณฑ์', 'green grow', function () {
          var cat = {}; L.cats.forEach(function (k) { if (catIn[k].value !== '') cat[k] = catIn[k].value; });
          var drug = {}; Object.keys(dIn).forEach(function (k) { drug[k] = dIn[k].value; });
          var wts = { act: { T: actIn.T.value, C: actIn.C.value, R: actIn.R.value }, code: x.code, warrant: war.value, flag: flag.value, cat: cat, primaryPct: joint.value, missed: missed.value, drug: drug };
          L.items.forEach(function (i) { wts[i[0]] = itIn[i[0]].value; });
          return api('score.save', { id: w ? w.id : '', name: name.value, from: from.value, to: to.value, weights: wts, note: note.value, reason: reason.value }).then(function (r) {
            apiInvalidate(); go('scoreAdmin', { saved: r.id, savedName: r.name }, true);
          });
        })));
      }
    }, function (e) { fail(e, VIEWS.scoreAdmin); });
  };

  // ======================= ตารางเวร + สลับเวร =======================
  VIEWS.roster = function (p) {
    setTitle('🗓 ตารางเวร', '');
    clear($app);
    var date = h('input', { type: 'date', value: (p && p.date) || today(), onchange: load }), out = h('div');
    add($app, h('div', { class: 'card' }, h('div', { class: 'row' }, h('button', { class: 'btn gray sm', onclick: function () { date.value = addDays(date.value, -1); load(); }, text: '‹' }), h('div', { class: 'grow' }, date), h('button', { class: 'btn gray sm', onclick: function () { date.value = addDays(date.value, 1); load(); }, text: '›' }))), out);
    if (can('roster.swap')) add($app, bar(h('button', { class: 'btn', onclick: swapForm, text: '🔁 สลับเวรชั่วคราว' })));
    var data = null;
    function load() {
      clear(out); add(out, h('div', { class: 'loading' }, spinner()), skeleton(2));
      var dv = date.value;
      live('roster.day', { date: dv }, function (d) { if (dv !== date.value) return;
        data = d; clear(out);
        ['D', 'N'].forEach(function (sh) {
          var c = card(SHIFT[sh].icon + ' ' + SHIFT[sh].label + ' ' + th(d.date));
          if (!d[sh].length) add(c, h('p', { class: 'muted', text: 'ไม่มีข้อมูล — ยังไม่ได้นำเข้าคำสั่งเวรช่วงนี้' }));
          d[sh].forEach(function (g) {
            add(c, h('div', { class: 'list-item', style: 'align-items:flex-start' }, h('b', { style: 'min-width:86px', text: 'เขต ' + g.zone + ' ' + g.car }),
              h('div', { class: 'grow' }, g.crew.map(function (m) { return h('span', { class: 'tag', style: m.away ? 'background:#fef3c7;color:#92400e' : '', text: m.name + (m.away ? ' (' + m.away + ')' : '') }); }))));
          });
          add(out, c);
        });
        if (d.officers.length || d.duties.length) {
          var dc = card('👮 หน้าที่รายวัน');
          d.officers.forEach(function (o) { add(dc, h('div', { class: 'list-item', text: '⭐ ร้อยเวร: ' + o.name + (o.duty ? ' (' + o.duty + ')' : '') })); });
          d.duties.forEach(function (o) { add(dc, h('div', { class: 'list-item', text: (o.slot === 'N' ? '🌙 ' : o.slot === 'D' ? '☀️ ' : '• ') + o.duty + (o.zone ? ' เขต ' + o.zone : '') + ': ' + o.name })); });
          add(out, dc);
        }
        if (d.swaps.length) {
          var sc = card('🔁 สลับเวรที่มีผล');
          d.swaps.forEach(function (s) {
            add(sc, h('div', { class: 'list-item' }, h('div', { class: 'grow', text: th(s.from) + (s.to !== s.from ? '–' + th(s.to) : '') + ' ' + (s.shift === 'A' ? 'ทั้งวัน' : SHIFT[s.shift].label) + ' · ' + s.car + ': ' + (s.out || '-') + ' → ' + (s.in || '-') + (s.reason ? ' (' + s.reason + ')' : '') }),
              can('roster.swap') ? submitBtn('ยกเลิก', 'gray sm', function () { return api('swap.cancel', { id: s.id }).then(function () { toast('ยกเลิกแล้ว'); load(); }); }) : null));
          });
          add(out, sc);
        }
        var oc = card('📄 คำสั่งเวรที่นำเข้าล่าสุด');
        d.orders.forEach(function (o) { add(oc, h('div', { class: 'list-item' }, h('div', { class: 'grow' }, h('b', { text: 'ที่ ' + o.orderNo + ' ' }), th(o.cycleStart) + '–' + th(o.cycleEnd) + ' · ' + o.orderType), o.warnings ? h('span', { class: 'badge amber', text: '⚠️' }) : null)); });
        add(oc, h('button', { class: 'btn ghost block', style: 'margin-top:8px', onclick: function () { go('files'); }, text: '📥 อัปโหลดคำสั่งเวรยาม / แบ่งตามสายงาน (.docx)' }));
        add(oc, info('เจ้าหน้าที่ทุกคนส่งไฟล์ได้ (ในแอปหรือส่งให้บอทในแชท 1:1) — ผู้มีสิทธิ์นำเข้าตรวจแล้วกดยืนยันก่อนตารางเวรจึงเปลี่ยน'));
        add(out, oc);
      }, function (e) { clear(out); add(out, errorBox(e.message)); });
    }
    load();
    function swapForm() {
      var f = h('input', { type: 'date', value: date.value }), t = h('input', { type: 'date', value: date.value }), sh = h('select', null, h('option', { value: 'A', text: 'ทั้งวัน (ทุกผลัด)' }), h('option', { value: 'D', text: '☀️ กลางวัน' }), h('option', { value: 'N', text: '🌙 กลางคืน' }));
      var car = h('select'); (data ? data.D.concat(data.N) : []).forEach(function (g) { if (![].slice.call(car.options).some(function (o) { return o.value === g.car; })) add(car, h('option', { value: g.car, text: 'เขต ' + g.zone + ' · ' + g.car })); });
      var outP = null, inP = null, outB = h('button', { class: 'btn ghost sm', text: 'เลือกคนออก' }), inB = h('button', { class: 'btn ghost sm', text: 'เลือกคนแทน' });
      outB.onclick = function () { pickPerson('คนที่ออก', function (p) { outP = p.pid; outB.textContent = '➖ ' + p.short; swapForm2(); }); };
      inB.onclick = function () { pickPerson('คนที่เข้าแทน', function (p) { inP = p.pid; inB.textContent = '➕ ' + p.short; swapForm2(); }); };
      var reason = h('input', { placeholder: 'เหตุผล เช่น ภารกิจพิเศษ/บริหารภายใน' });
      var body = [h('label', { class: 'f', text: 'ตั้งแต่' }), f, h('label', { class: 'f', text: 'ถึง' }), t, h('label', { class: 'f', text: 'ผลัด' }), sh, h('label', { class: 'f', text: 'รถ' }), car,
        h('div', { class: 'row', style: 'margin-top:10px' }, outB, inB), h('label', { class: 'f', text: 'เหตุผล' }), reason];
      function swapForm2() { }
      modal('🔁 สลับเวรชั่วคราว', body, 'บันทึก', function () {
        return api('swap.add', { from: f.value, to: t.value, shift: sh.value, car: car.value, outPid: outP, inPid: inP, reason: reason.value }).then(function () { toast('บันทึกแล้ว'); load(); });
      });
    }
  };

  // ======================= ส่งออก =======================
  VIEWS.export = function () {
    setTitle('⬇️ ส่งออก', 'ไฟล์เก็บใน Google Drive ของสถานี — เปิด/แชร์เข้าไลน์ได้ทันที');
    clear($app);
    var cur = null, out = h('div'), zone = '';
    var zsel = h('select', { onchange: function () { zone = zsel.value; } }, h('option', { value: '', text: 'ทั้งสถานี' }));
    Object.keys(S.boot.zones).forEach(function (z) { add(zsel, h('option', { value: z, text: S.boot.zones[z] })); });
    if (S.boot.perms.zone) { zsel.value = String(S.boot.perms.zone); zone = zsel.value; zsel.disabled = true; }
    add($app, rangePicker(function (a, b) { cur = [a, b]; }, 2), h('div', { class: 'card' }, zsel), out);
    function show(r, label) { clear(out); add(out, fileCard(r, label)); out.scrollIntoView({ behavior: 'smooth' }); }
    var c = card('📄 รายงานสรุป PDF', 'หัวกระดาษสถานี + ตาราง + แท่งเปรียบเทียบ');
    add(c, info('ตัวเลขหลัก · รายเขต · รายรถ · ประเภทความผิด · ประเภทคดี · รายบุคคล (เฉพาะผู้มีสิทธิ์) · วินัยการรายงาน'),
      submitBtn('📄 สร้าง PDF สรุปผล', 'block', function () {
        if (!cur) throw new Error('เลือกช่วงวัน');
        toast('กำลังสร้าง PDF… ประมาณ 10–20 วินาที', 8000);
        return api('export.pdf', { from: cur[0], to: cur[1], zone: zone }).then(function (r) { show(r, 'PDF สรุปผล'); });
      }));
    var c1 = card('📗 Excel แบบเจ้าหน้าที่สถิติ', '1 ชีตต่อวัน + สรุป + รายบุคคล');
    add(c1, info('หัวคอลัมน์เดิม: พ.ร.บ.ขนส่ง · พ.ร.บ.รถยนต์ · ตรวจสอบฯรถบรรทุก · ตรวจรถต้องสงสัย · ช่วยเหลือฯ · หมายจับ · อาญาทั่วไป · ว.42 · ภารกิจ + หมายเหตุอัตโนมัติ (ไม่เกิน 31 วัน)'),
      submitBtn('📗 สร้างไฟล์ .xlsx', 'block', function () {
        if (!cur) throw new Error('เลือกช่วงวัน');
        toast('กำลังสร้างไฟล์… อาจใช้เวลา 10–30 วินาที', 8000);
        return api('export.xlsx', { from: cur[0], to: cur[1], zone: zone }).then(function (r) { show(r, 'Excel'); });
      }));
    var c2 = card('🖼 รูปภาพหน้าสรุปกราฟ (PNG)', 'ส่งเข้ากลุ่ม/ใส่สไลด์ได้ทันที');
    add(c2, submitBtn('🖼 สร้างรูปหน้าสรุป', 'block', function () {
      if (!cur) throw new Error('เลือกช่วงวัน');
      toast('กำลังวาดกราฟ…', 5000);
      // วาดหน้าสรุปไว้นอกจอ (ความกว้างคงที่ 720px) แล้วถ่ายเป็นรูป
      var stage = h('div', { class: 'capture', style: 'position:absolute;left:-10000px;top:0;width:720px;background:#f1f4f8;padding:16px' });
      document.body.appendChild(stage);
      return api('summary', { from: cur[0], to: cur[1], zone: zone }).then(function (sm) {
        add(stage, h('div', { class: 'capture-head' }, h('b', { text: S.boot.station + ' — สรุปผลการปฏิบัติ' }), h('div', { class: 'muted', text: (cur[0] === cur[1] ? th(cur[0]) : th(cur[0]) + ' – ' + th(cur[1])) + (zone ? ' · ' + S.boot.zones[zone] : '') })));
        var body = h('div'); add(stage, body); renderSummary(body, sm);
        stage.querySelectorAll('details').forEach(function (d) { d.remove(); });
        return captureNode(stage);
      }).then(function (b64) {
        stage.remove(); toast('กำลังบันทึกรูปไว้ใน Drive…', 5000);
        return api('export.image', { base64: b64, name: 'สรุปผล ' + th(cur[0]).replace(/\s/g, '') + (cur[0] !== cur[1] ? '-' + th(cur[1]).replace(/\s/g, '') : '') + '.png' });
      }).then(function (r) { show(r, 'รูปภาพ PNG'); }, function (e) { stage.remove(); throw e; });
    }));
    var c3 = card('💬 ข้อความสำเร็จรูป', 'กดคัดลอกแล้ววางในไลน์');
    [['bk', '📮 แบบ บก.ทล. 7 หัวข้อ'], ['cycle', '📊 สรุปวงรอบ'], ['morning', '🌅 สรุปเช้า (ของวันสุดท้ายในช่วง)']].forEach(function (k) {
      add(c3, h('div', { style: 'margin-bottom:8px' }, submitBtn(k[1], 'ghost block', function () {
        if (!cur) throw new Error('เลือกช่วงวัน');
        return api('texts', { kind: k[0], from: cur[0], to: cur[1], date: k[0] === 'morning' ? addDays(cur[1], 1) : cur[1] }).then(function (t) {
          clear(out); add(out, card(k[1]), h('div', { class: 'msg-preview', text: t }));
          copyText(t).then(function () { toast('📋 คัดลอกแล้ว'); });
        });
      })));
    });
    var c4 = card('🧾 ข้อมูลดิบทุกรายการ (.xlsx)', 'ทุกรายการในช่วง 1 แถวต่อรายการ');
    add(c4, submitBtn('⬇️ ดาวน์โหลด .xlsx', 'gray block', function () {
      if (!cur) throw new Error('เลือกช่วงวัน');
      return api('export.events', { from: cur[0], to: cur[1] }).then(function (rows) {
        var SH = { D: 'กลางวัน', N: 'กลางคืน' }, ST = { ok: 'ปกติ', void: 'ยกเลิก', active: 'กำลังนำ', waiting: 'รอรับกลับ', scheduled: 'นัดไว้', pending: 'รอตรวจ', approved: 'อนุมัติ', returned: 'ส่งกลับ' };
        xlsxDownload('รายการ_' + cur[0] + '_' + cur[1] + '.xlsx', [{ name: 'รายการทั้งหมด', head: ['รหัส', 'วันที่นับสถิติ', 'วันเข้าเวร', 'ผลัด', 'เขต', 'รถ', 'ประเภท', 'รายการ', 'พ.ร.บ./หมวด', 'จำนวน', 'สถานะ', 'ผู้ออกใบสั่ง', 'ผู้บันทึก', 'รายละเอียด'],
          rows: rows.map(function (r) { return [r.id, r.statDate, r.dutyDate, SH[r.shift] || '', +r.zone || '', String(r.car || ''), r.type, r.sub, r.act, +r.count || 0, ST[r.status] || r.status, r.issuer || (r.type === 'ใบสั่ง' ? 'ยังไม่ระบุ (รอเทียบ PTM)' : ''), r.reporter, r.detail]; }) }],
          [['ช่วงวันที่', th(cur[0]) + ' – ' + th(cur[1])]]);
      });
    }));
    var c5 = card('🗓 ตรวจการรายงาน 7 วัน (.xlsx)', 'ตาราง 7 วัน × รถ · รายการที่ต้องแก้ · ผลที่รายงาน');
    add(c5, submitBtn('⬇️ ดาวน์โหลด 7 วันล่าสุด (ถึงวันสุดท้ายของช่วง)', 'gray block', function () {
      return api('duty.week', cur ? { end: cur[1] } : {}).then(function (w) { weekXlsx(w); });
    }));
    // ไฟล์สำรองรวมทุกหมวด (ธุรการเก็บในคอมพิวเตอร์) — ไม่เกิน 92 วันต่อไฟล์
    var c0 = card('💾 ไฟล์สำรองข้อมูล (.xlsx)', 'ทุกหมวดในไฟล์เดียว · ดาวน์โหลดลงเครื่องโดยตรง');
    add(c0, h('p', { class: 'muted small', text: 'สรุปรายรถ · สรุปรายคน · ผลัด · ใบสั่ง (ผู้ออก/รอเทียบ PTM) · ว.42 · ช่วยเหลือ · จับกุม · ภารกิจ · งานอื่นในผลัด · ตารางเวร' +
      (can('fine.manage') || S.boot.perms.admin || (can('view.people') && S.boot.perms.scope === 'station') ? ' · ค่าปรับรายวัน · ใบสั่งชำระแล้ว' : '') + (can('view.suspect') ? ' · ผู้ต้องหา (ข้อมูลลับ)' : '') +
      ' — ครั้งละไม่เกิน 92 วัน (แนะนำส่งออกทุกสิ้นวงรอบ/สิ้นเดือน) · ระบบบันทึกประวัติทุกครั้งที่ส่งออก' }),
      can('view.suspect') ? h('p', { class: 'note small', text: '🔒 ไฟล์ที่มีข้อมูลผู้ต้องหา: เก็บในเครื่องที่ตั้งรหัสผ่าน ห้ามส่งต่อทางไลน์/อีเมล/อัปโหลดขึ้นบริการภายนอก ใช้เฉพาะงานคดี' }) : null,
      submitBtn('💾 สร้างไฟล์สำรอง .xlsx', 'green block', function () {
        if (!cur) throw new Error('เลือกช่วงวัน');
        toast('กำลังรวบรวมข้อมูล… ประมาณ 10–40 วินาที', 8000);
        return api('export.backup', { from: cur[0], to: cur[1] }).then(function (r) {
          var n = r.sheets.reduce(function (a, x) { return a + x.rows.length; }, 0);
          xlsxDownload('สำรองข้อมูล_' + S.boot.station.replace(/[\s.]/g, '') + '_' + r.from + '_' + r.to + '.xlsx', r.sheets,
            [['ช่วงวันที่', th(r.from) + ' – ' + th(r.to)], ['ขอบเขต', r.scope === 'station' ? 'ทั้งสถานี' : r.scope === 'zone' ? 'เขต ' + r.zone : 'เฉพาะของผู้ส่งออก'], ['จำนวนแถวรวม', n]]);
        });
      }));
    add($app, c0, c, c1, c2, c3, c4, c5);
  };
  /** การ์ดผลลัพธ์ไฟล์ที่เก็บใน Google Drive: เปิด / แชร์เข้าไลน์ / คัดลอกลิงก์ */
  function fileCard(r, label) {
    var c = card('✅ สร้างไฟล์แล้ว', label || '');
    add(c, h('p', { text: r.name, style: 'word-break:break-all;margin:0 0 6px' }), h('p', { class: 'muted small', text: r.restricted ? 'ไฟล์นี้มีข้อมูลผู้ต้องหา จึงไม่เปิดลิงก์สาธารณะ — เปิดด้วยบัญชี Google ของสถานี หรือบันทึกจากปุ่มด้านล่าง' : 'ไฟล์อยู่ในโฟลเดอร์ "LineBot ส่งออก" ใน Google Drive ของสถานี ผู้มีลิงก์เปิดดูได้' }));
    var row = h('div', { class: 'chips', style: 'margin-top:8px' });
    add(row, h('button', { class: 'btn sm', onclick: function () { openExternal(r.url); }, text: '🔗 เปิดไฟล์' }));
    if (!r.restricted) {
      add(row, h('button', { class: 'btn green sm', onclick: function () { postToChat('ไฟล์ ' + r.name + '\n' + r.url).then(function (x) { toast(x === 'copied' ? '📋 คัดลอกลิงก์แล้ว' : x === 'cancel' ? 'ยกเลิก' : '💬 ส่งแล้ว'); }); }, text: '💬 ส่งเข้าไลน์' }));
      add(row, h('button', { class: 'btn ghost sm', onclick: function () { copyText(r.url).then(function () { toast('📋 คัดลอกลิงก์แล้ว'); }); }, text: '📋 คัดลอกลิงก์' }));
    }
    if (r.base64) add(row, h('button', { class: 'btn ghost sm', onclick: function () { downloadB64(r.base64, r.name, 'application/pdf'); }, text: '⬇️ บันทึกไฟล์' }));
    add(c, row);
    return c;
  }
  /** วาดหน้าสรุป (DOM) เป็น PNG ด้วย html2canvas (โหลดเมื่อใช้) */
  function captureNode(node) {
    function run() { return window.html2canvas(node, { backgroundColor: '#f1f4f8', scale: 2, useCORS: true, logging: false }).then(function (cv) { return cv.toDataURL('image/png').split(',')[1]; }); }
    if (window.html2canvas) return run();
    return new Promise(function (res, rej) { var sc = h('script', { src: 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js' }); sc.onload = res; sc.onerror = function () { rej(new Error('โหลดตัวสร้างรูปไม่ได้ กรุณาตรวจสัญญาณ')); }; document.head.appendChild(sc); }).then(run);
  }
  // ======================= ไฟล์ .xlsx (สร้างในเครื่อง ไม่ใช้ไลบรารีภายนอก — ข้อมูลไม่ออกนอกเครื่อง) =======================
  var Xlsx = (function () {
    var enc = new TextEncoder();
    var CRC = (function () { var t = new Uint32Array(256); for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
    function crc32(b) { var c = 0xFFFFFFFF; for (var i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
    function zip(files) {
      var parts = [], central = [], off = 0;
      files.forEach(function (f) {
        var nm = enc.encode(f.name), d = typeof f.data === 'string' ? enc.encode(f.data) : f.data, c = crc32(d);
        var lh = new DataView(new ArrayBuffer(30));
        lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(12, 0x21, true);
        lh.setUint32(14, c, true); lh.setUint32(18, d.length, true); lh.setUint32(22, d.length, true); lh.setUint16(26, nm.length, true);
        parts.push(new Uint8Array(lh.buffer), nm, d);
        var ch = new DataView(new ArrayBuffer(46));
        ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(14, 0x21, true);
        ch.setUint32(16, c, true); ch.setUint32(20, d.length, true); ch.setUint32(24, d.length, true); ch.setUint16(28, nm.length, true); ch.setUint32(42, off, true);
        central.push(new Uint8Array(ch.buffer), nm);
        off += 30 + nm.length + d.length;
      });
      var cd = central.reduce(function (a, b) { return a + b.length; }, 0), end = new DataView(new ArrayBuffer(22));
      end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true); end.setUint32(12, cd, true); end.setUint32(16, off, true);
      var all = parts.concat(central, [new Uint8Array(end.buffer)]), out = new Uint8Array(all.reduce(function (a, b) { return a + b.length; }, 0)), p = 0;
      all.forEach(function (b) { out.set(b, p); p += b.length; });
      return out;
    }
    function esc(v) { return String(v).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, ''); }
    function col(i) { var s = ''; i++; while (i > 0) { var m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }
    function cell(r, c, v, st) {
      var ref = col(c) + r, sa = st ? ' s="' + st + '"' : '';
      if (v === null || v === undefined || v === '') return st ? '<c r="' + ref + '"' + sa + '/>' : '';
      if (typeof v === 'number' && isFinite(v)) return '<c r="' + ref + '"' + sa + '><v>' + v + '</v></c>';
      v = String(v); if (v.length > 32000) v = v.slice(0, 32000);
      return '<c r="' + ref + '" t="inlineStr"' + sa + '><is><t xml:space="preserve">' + esc(v) + '</t></is></c>';
    }
    function sname(n, used) { var b = String(n || 'Sheet').replace(/[\[\]:*?\/\\]/g, '-').slice(0, 31) || 'Sheet', x = b, i = 2; while (used[x.toLowerCase()]) x = b.slice(0, 28) + ' ' + i++; used[x.toLowerCase()] = 1; return x; }
    function sheetXml(sh) {
      var head = sh.head || [], rows = sh.rows || [], r0 = sh.title ? 2 : 1, ncol = Math.max(head.length, 1);
      var w = head.map(function (hh, i) { var m = String(hh).length; rows.slice(0, 400).forEach(function (row) { var v = row[i], l = v == null ? 0 : String(v).length; if (l > m) m = l; }); return Math.min(60, Math.max(7, Math.round(m * 1.15) + 2)); });
      var x = ['<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'];
      x.push('<sheetViews><sheetView workbookViewId="0"><pane ySplit="' + r0 + '" topLeftCell="A' + (r0 + 1) + '" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/>');
      if (w.length) x.push('<cols>' + w.map(function (v, i) { return '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + v + '" customWidth="1"/>'; }).join('') + '</cols>');
      x.push('<sheetData>');
      if (sh.title) x.push('<row r="1">' + cell(1, 0, sh.title, 3) + '</row>');
      x.push('<row r="' + r0 + '">' + head.map(function (hh, i) { return cell(r0, i, hh, 1); }).join('') + '</row>');
      rows.forEach(function (row, j) { var r = r0 + 1 + j; x.push('<row r="' + r + '">' + row.map(function (v, i) { return cell(r, i, v, typeof v === 'number' ? 2 : 0); }).join('') + '</row>'); });
      x.push('</sheetData>');
      if (rows.length && head.length) x.push('<autoFilter ref="A' + r0 + ':' + col(ncol - 1) + (r0 + rows.length) + '"/>');
      x.push('<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/><pageSetup orientation="landscape" paperSize="9" fitToWidth="1" fitToHeight="0"/></worksheet>');
      return x.join('');
    }
    var STYLES = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<fonts count="3"><font><sz val="11"/><name val="Tahoma"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Tahoma"/></font><font><b/><sz val="14"/><color rgb="FF0F2744"/><name val="Tahoma"/></font></fonts>' +
      '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1F3B63"/><bgColor indexed="64"/></patternFill></fill></fills>' +
      '<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFC9D3DF"/></left><right style="thin"><color rgb="FFC9D3DF"/></right><top style="thin"><color rgb="FFC9D3DF"/></top><bottom style="thin"><color rgb="FFC9D3DF"/></bottom><diagonal/></border></borders>' +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      '<cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="top"/></xf>' +
      '<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>' +
      '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="top"/></xf>' +
      '<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>' +
      '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
    /** sheets = [{ name, head: [], rows: [[]], title? }] → Uint8Array ของไฟล์ .xlsx */
    function build(sheets) {
      var used = {}, list = sheets.map(function (sh) { return Object.assign({}, sh, { name: sname(sh.name, used) }); });
      var files = [{ name: '[Content_Types].xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        list.map(function (_, i) { return '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'; }).join('') + '</Types>' },
        { name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
        { name: 'xl/workbook.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets>' +
          list.map(function (sh, i) { return '<sheet name="' + esc(sh.name) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>'; }).join('') + '</sheets>' +
          (function () { var dn = list.map(function (sh, i) { var r0 = sh.title ? 2 : 1, n = (sh.head || []).length; return sh.rows && sh.rows.length && n ? '<definedName name="_xlnm._FilterDatabase" localSheetId="' + i + '" hidden="1">\'' + esc(sh.name.replace(/'/g, "''")) + '\'!$A$' + r0 + ':$' + col(n - 1) + '$' + (r0 + sh.rows.length) + '</definedName>' : ''; }).join(''); return dn ? '<definedNames>' + dn + '</definedNames>' : ''; })() + '</workbook>' },
        { name: 'xl/_rels/workbook.xml.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
          list.map(function (_, i) { return '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>'; }).join('') +
          '<Relationship Id="rId' + (list.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' },
        { name: 'xl/styles.xml', data: STYLES }];
      list.forEach(function (sh, i) { files.push({ name: 'xl/worksheets/sheet' + (i + 1) + '.xml', data: sheetXml(sh) }); });
      return zip(files);
    }
    return { build: build, _col: col };
  })();
  var XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  function fileStamp() { var t = bkkNow(); return isoOf(t) + '_' + pad(t.getHours()) + pad(t.getMinutes()); }
  /** สร้างและดาวน์โหลด .xlsx — sheets ตามรูปแบบ Xlsx.build · มีชีต "รายละเอียด" นำหน้าเสมอ */
  function xlsxDownload(name, sheets, info) {
    var meta = [['หน่วยงาน', S.boot.station], ['ส่งออกโดย', S.boot.me.name], ['เวลาส่งออก', th(today()) + ' ' + hm(nowLocal()) + ' น.']].concat(info || []);
    meta.push(['ชีตในไฟล์', sheets.map(function (x) { return x.name + ' (' + x.rows.length + ')'; }).join(', ')]);
    if (sheets.some(function (x) { return x.secret; })) meta.push(['⚠️ ข้อมูลลับ', 'มีข้อมูลผู้ต้องหา — เก็บในเครื่องที่มีรหัสผ่าน ห้ามส่งต่อ/อัปโหลดขึ้นบริการภายนอก ใช้เฉพาะงานคดี']);
    var u8 = Xlsx.build([{ name: 'รายละเอียด', head: ['รายการ', 'ข้อมูล'], rows: meta }].concat(sheets));
    var url = URL.createObjectURL(new Blob([u8], { type: XLSX_TYPE })), a = h('a', { href: url, download: name });
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 4000);
    if (window.liff && liff.isInClient && liff.isInClient()) toast('ถ้าไฟล์ไม่ดาวน์โหลด ให้เปิดหน้านี้ในเบราว์เซอร์บนคอมพิวเตอร์ (เมนู ⋮ → เปิดในเบราว์เซอร์)', 6000);
    else toast('⬇️ ดาวน์โหลด ' + name, 3500);
    return u8.length;
  }
  /** คำอธิบายแบบพับ (ℹ️) แทนย่อหน้ายาว — หน้าจอสะอาด กดอ่านเมื่อต้องการ */
  function info(text, label) { return h('details', { class: 'info' }, h('summary', { text: 'ℹ️ ' + (label || 'คำอธิบาย') }), h('div', { text: text })); }
  function xlBtn(label, fn) { return submitBtn('⬇️ ' + (label || '.xlsx'), 'ghost sm xl-btn', fn); }

  function downloadB64(b64, name, type) {
    var bin = atob(b64), arr = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    var url = URL.createObjectURL(new Blob([arr], { type: type })), a = h('a', { href: url, download: name });
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 4000);
    if (window.liff && liff.isInClient && liff.isInClient()) toast('ถ้าไฟล์ไม่ดาวน์โหลด ให้เปิดหน้านี้ในเบราว์เซอร์ (เมนู ⋮ → เปิดในเบราว์เซอร์)', 6000);
  }

  // ======================= ภาพ Dashboard รายงานผู้บังคับบัญชา =======================
  // วาดเป็นหน้า HTML ขนาดคงที่ 1920×1080 → ถ่ายเป็น PNG ในเครื่อง → เก็บใน Drive ของสถานี → ส่งภาพ + ข้อความเข้าไลน์
  var TH_MF = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
  var DASH_BK = { 'ไม่ชิดขอบทางด้านซ้าย': 'ไม่ชิดซ้าย', 'ดัดแปลงสภาพรถ': 'ดัดแปลงรถ', 'อุปกรณ์ส่วนควบไม่ครบ': 'ส่วนควบไม่ครบ', 'ฝ่าฝืนเครื่องหมายจราจร': 'ฝ่าป้าย',
    'ฝ่าฝืนเครื่องสัญญาณไฟจราจร': 'ฝ่าไฟแดง', 'ขับรถเร็วเกินกำหนด': 'ขับเร็ว', 'ไม่ติดแผ่นป้ายทะเบียน': 'ไม่ติดป้ายทะเบียน', 'ขาดต่อภาษี/พ.ร.บ.ฯ': 'ขาดภาษี/พ.ร.บ.' };
  var DASH_CAT = { 'พ.ร.บ.ยาเสพติด': 'ยาเสพติด', 'พ.ร.บ.อาวุธปืน': 'อาวุธปืน', 'พ.ร.บ.คนเข้าเมือง': 'คนเข้าเมือง', 'รถบรรทุกน้ำหนักเกินฯ': 'รถหนัก', 'ขับรถขณะเมาสุรา': 'เมาแล้วขับ',
    'ปลอม/ใช้เอกสารราชการปลอม (สวมทะเบียน)': 'สวมทะเบียน/เอกสารปลอม', 'ฉ้อโกง/อาชญากรรมออนไลน์/บัญชีม้า': 'ฉ้อโกง/ออนไลน์', 'ลักทรัพย์/รับของโจร': 'ลักทรัพย์/รับของโจร', 'ขับรถประมาท/พ.ร.บ.จราจรฯ': 'ขับรถประมาท' };
  var DASH_PAL = ['#0f2744', '#2563eb', '#f59e0b', '#0d9488', '#60a5fa', '#b45309', '#1e40af', '#fcd34d', '#94a3b8', '#cbd5e1'];
  function fmtN(n) { return (Math.round((+n || 0) * 100) / 100).toLocaleString('en-US'); }
  function thD(iso, full) { var p = iso.split('-'); return +p[2] + ' ' + (full ? TH_MF : TH_M)[+p[1] - 1]; }
  function thY(iso) { return +iso.slice(0, 4) + 543; }
  function lastDay(iso) { return addDays(addDays(iso.slice(0, 8) + '01', 32).slice(0, 8) + '01', -1); }
  function dashTitle(f, t, full, kind) {
    var M = full ? TH_MF : TH_M, y = thY(t), sameM = f.slice(0, 7) === t.slice(0, 7), df = +f.slice(8), dt = +t.slice(8), mn = M[+f.slice(5, 7) - 1];
    if (f === t) return 'ผลการปฏิบัติงานประจำวันที่ ' + thD(f, full) + ' ' + y;
    if (sameM && df === 1 && t === lastDay(t)) return 'ผลการปฏิบัติงานประจำเดือน ' + mn + ' ' + y;
    if (kind === 'month' && sameM && df === 1) return 'ผลการปฏิบัติงานประจำเดือน ' + mn + ' ' + y + (t === lastDay(t) ? '' : ' (1 - ' + dt + ' ' + mn + ')');
    if (sameM && /^c[123]$/.test(kind || 'c') && ((df === 1 && dt <= 10) || (df === 11 && dt <= 20) || (df === 21 && dt <= +lastDay(t).slice(8)))) return 'ผลการปฏิบัติงานประจำวงรอบ ' + df + ' - ' + dt + ' ' + mn + ' ' + y;
    if (sameM && df === 1) return 'ผลการปฏิบัติงานประจำเดือน ' + mn + ' ' + y + ' (1 - ' + dt + ' ' + mn + ')';
    if (sameM) return 'ผลการปฏิบัติงานระหว่างวันที่ ' + df + ' - ' + dt + ' ' + mn + ' ' + y;
    return 'ผลการปฏิบัติงานระหว่างวันที่ ' + thD(f, full) + (f.slice(0, 4) !== t.slice(0, 4) ? ' ' + thY(f) : '') + ' - ' + thD(t, full) + ' ' + y;
  }
  var SVGNS = 'http://www.w3.org/2000/svg';
  function sv(tag, attrs) { var e = document.createElementNS(SVGNS, tag); Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); }); for (var i = 2; i < arguments.length; i++) if (arguments[i]) e.appendChild(arguments[i]); return e; }
  /** วงแหวน: parts = [{v, c}] */
  function donut(size, thick, parts) {
    var r = (size - thick) / 2, C = 2 * Math.PI * r, tot = parts.reduce(function (s, p) { return s + (+p.v || 0); }, 0), off = 0;
    var s = sv('svg', { width: size, height: size, viewBox: '0 0 ' + size + ' ' + size });
    s.appendChild(sv('circle', { cx: size / 2, cy: size / 2, r: r, fill: 'none', stroke: '#e2e8f0', 'stroke-width': thick }));
    if (tot) parts.forEach(function (p) {
      var len = (+p.v || 0) / tot * C; if (!len) return;
      s.appendChild(sv('circle', { cx: size / 2, cy: size / 2, r: r, fill: 'none', stroke: p.c, 'stroke-width': thick, 'stroke-dasharray': len + ' ' + (C - len), 'stroke-dashoffset': -off, transform: 'rotate(-90 ' + size / 2 + ' ' + size / 2 + ')' }));
      off += len;
    });
    return s;
  }
  function ab(cls, x, y, w, hh, style) { return h('div', { class: 'ab ' + cls, style: 'left:' + x + 'px;top:' + y + 'px;' + (w ? 'width:' + w + 'px;' : '') + (hh ? 'height:' + hh + 'px;' : '') + (style || '') }); }
  function bigNum(n) { var s = fmtN(n).length; return s >= 6 ? 50 : s >= 4 ? 62 : s === 3 ? 76 : 92; }
  function evidenceItems(list, max) {
    var out = h('div', { class: 'ev' });
    if (!list.length) { add(out, h('span', { class: 'muted', text: 'ไม่มีการตรวจยึดของกลางในช่วงนี้' })); return out; }
    list.slice(0, max).forEach(function (x) { add(out, h('span', { class: 'evi' }, (x.item === 'อื่นๆ' ? 'อื่นๆ ' : x.item + ' '), h('b', { text: fmtN(x.qty) }), ' ' + x.unit)); });
    if (list.length > max) add(out, h('span', { class: 'evi muted', text: '+' + (list.length - max) + ' รายการ' }));
    return out;
  }
  // โทนสีของระบบ (เหมือนหน้าแอป): กรมท่า · ฟ้า · อำพัน
  var DK = { navy: '#0f2744', navy2: '#16365e', blue: '#2563eb', amber: '#f59e0b', amberD: '#b45309', teal: '#0d9488', prev: '#b8c4d6', muted: '#64748b', band: '#e6edf7', band2: '#f3f6fb', hl: '#dbeafe' };
  // ชุดสีหมวดงาน ใช้ร่วมกันทั้งแอปและภาพ: ใบสั่ง/จราจร น้ำเงิน · จับกุม/อาญา กรมท่า · ว.42 อำพัน · ช่วยเหลือ เขียว · ภารกิจ ม่วง · ของกลาง เทา
  var CAT = { ticket: DK.blue, arrest: DK.navy, escort: DK.amber, assist: DK.teal, mission: '#7c3aed', evidence: '#64748b' };
  function header(d) {
    var band = ab('d-band', 0, 0, 1920, 126), org = ab('d-org', 46, 16, 1400, null);
    add(org, h('b', { text: 'สถานีตำรวจทางหลวง 2 กองกำกับการ 3 กองบังคับการตำรวจทางหลวง' }), h('span', { text: 'ตำรวจทางหลวงชลบุรี · Highway Police' }));
    add(band, ab('d-slash', 1500, 0, 520, 64), org);
    return [band, h('img', { class: 'd-logo', src: 'logo.png', alt: '' })];
  }
  function sumBy(list, k) { return list.reduce(function (s, x) { return s + (+x[k] || 0); }, 0); }
  /** แบบสรุป (ตามภาพตัวอย่าง 2026-10-09) — ถ้าเลือกวันเดียวจะเทียบกับค่าเฉลี่ยของเดือน */
  function dashCompact(d) {
    var t = d.total, daily = d.from === d.to, st = ab('dsh', 0, 0), x;
    add(st, header(d), ab('d-title', 46, 142, 1830, null, '')); st.querySelector('.d-title').textContent = dashTitle(d.from, d.to, false, d._kind);
    function note(cur, avg) {
      if (!daily) return 'เฉลี่ย ' + fmtN(Math.round(cur / d.days * 10) / 10) + ' ราย/วัน';
      return (cur > avg ? 'สูงกว่า' : cur < avg ? 'ต่ำกว่า' : 'เท่ากับ') + 'เฉลี่ยเดือนนี้ (' + fmtN(avg) + ' ราย/วัน)';
    }
    function head(card, title, nt) { var a = ab('d-h2', 24, 18), b = ab('d-note', 0, 30, 0, null, 'right:26px;left:auto'); a.textContent = title; b.textContent = nt || ''; add(card, a, b); }
    // จับกุมคดีอาญา
    var A = ab('d-card', 46, 236, 997, 346); add(st, A); head(A, 'จับกุมคดีอาญา', note(t.arrest, d.monthAvg.arrest));
    // รวม = ซึ่งหน้า (ราย) + หมายจับ (หมาย) · ผู้ต้องหา 1 ราย 3 หมาย นับ 3
    var dn = ab('d-donut', 30, 90, 236, 236); add(dn, donut(236, 34, [{ v: t.arrestWarrant, c: DK.navy }, { v: t.arrestFlag, c: DK.amber }]), h('div', { class: 'd-center' }, h('b', { style: 'font-size:' + bigNum(t.arrest) + 'px', text: fmtN(t.arrest) }), h('span', { style: t.arrestWarrant ? 'font-size:23px' : '', text: t.arrestWarrant ? 'ราย/หมาย' : 'ราย' })));
    add(A, dn);
    x = ab('d-leg', 318, 82, 652, 60); add(x, h('i', { class: 'sq', style: 'background:' + DK.navy }), h('span', { class: 'lb', text: 'หมายจับ' }), h('span', { class: 'wd', text: crimeText(d.warrantCat) }),
      h('div', { class: 'vu', style: 'width:252px' }, h('b', { class: 'v', text: fmtN(t.arrestWarrant) }), h('span', { class: 'un', text: 'หมาย' + (t.arrestWarrant ? ' (' + fmtN(t.warrantPersons || 0) + ' ราย)' : '') }))); add(A, x);
    var box = ab('d-flag', 306, 142, 664, 186); add(A, box);
    add(box, h('div', { class: 'fh' }, h('i', { class: 'sq', style: 'background:' + DK.amber }), h('span', { class: 'lb', text: 'ซึ่งหน้า' }), h('small', { text: 'แยกตามฐานความผิด' }), h('div', { class: 'vu', style: 'width:232px' }, h('b', { class: 'v', text: fmtN(t.arrestFlag) }), h('span', { class: 'un', text: 'ราย' }))));
    var cats = crimeRows(d.flagCat);
    var grid = h('div', { class: 'fg' }); add(box, grid);
    if (!cats.length) add(grid, h('div', { class: 'muted', style: 'font-size:26px;padding:12px 6px', text: 'ไม่มีการจับกุมความผิดซึ่งหน้าในช่วงนี้' }));
    cats.slice(0, 6).forEach(function (r) { add(grid, h('div', { class: 'chipv' }, h('span', { text: r[0] }), h('b', { text: fmtN(r[1]) }))); });
    // จับกุมคดีจราจร
    var B = ab('d-card', 1073, 236, 802, 346); add(st, B); head(B, 'จับกุมคดีจราจร', note(t.ticket, d.monthAvg.ticket));
    var bk = trafficRows(d);
    var dn2 = ab('d-donut', 34, 82, 226, 226); add(dn2, donut(226, 32, bk.map(function (r, i) { return { v: r[1], c: DASH_PAL[i % 10] }; })), h('div', { class: 'd-center' }, h('b', { style: 'font-size:' + bigNum(t.ticket) + 'px', text: fmtN(t.ticket) }), h('span', { text: 'ราย' })));
    add(B, dn2, ab('d-act', 10, 314, 280, null)); B.lastChild.textContent = 'ขนส่ง ' + fmtN(t.T) + ' · รถยนต์ ' + fmtN(t.C) + (t.R ? ' · จราจร ' + fmtN(t.R) : '');
    var lg = ab('d-list', 318, 70, 456, 272); add(B, lg);
    if (!bk.length) add(lg, h('div', { class: 'muted', style: 'font-size:26px', text: 'ไม่มีการจับกุมคดีจราจรในช่วงนี้' }));
    bk.slice(0, 10).forEach(function (r, i) { add(lg, h('div', { class: 'li' }, h('i', { class: 'dot', style: 'background:' + DASH_PAL[i % 10] }), h('span', { text: r[0] }), h('b', { text: fmtN(r[1]) }))); });
    // แถบกลาง: จับรถน้ำหนักเกิน | ถปภ. (แสดงแม้เป็น 0 · ถปภ. เป็นภารกิจพิเศษ ไม่ทำ 0 เป็นตัวแดง) คู่กับของกลาง
    var O = ab('d-card sm ow-card', 46, 592, 640, 80); add(st, O);
    add(O, h('div', { class: 'owb' }, h('span', { class: 'ol', text: 'จับรถน้ำหนักเกิน' }), h('b', { text: fmtN(t.overweight || 0) }), h('span', { text: 'ราย' })), h('i', { class: 'sep' }),
      h('div', { class: 'owb nz' }, h('span', { class: 'ol', text: 'ถปภ.' }), h('b', { text: fmtN(t.escortRoyal || 0) }), h('span', { text: 'ขบวน' })));
    var G = ab('d-card sm ev-card', 698, 592, 556, 80); add(st, G);
    add(G, h('b', { class: 'evh', text: 'ของกลาง' }), evidenceItems(d.evidence, 4));
    // ผลงานแยกรายรถ (จัดกลุ่มตามเขตตรวจ) — รายละเอียดเต็มอยู่ในภาพรายรถที่ส่งคู่กัน · หมายเหตุน้ำหนักคะแนนท้ายการ์ด
    var Cc = ab('d-card', 46, 684, 1208, 376); add(st, Cc); head(Cc, 'คะแนนผลงานรายรถ');
    if (d.board) {
      add(Cc, scoreLegend(), carScoreBars(d.board, 30, 72, 1150, 250));
      var wn = ab('d-note sb-wn', 30, 324, 1150, 44); weightItems(d.board.criteria).forEach(function (x, i) { add(wn, h('span', { text: (i ? ' · ' : '') }), h('span', { class: 'nw', text: x })); }); add(Cc, wn);
    } else add(Cc, zoneBars(d, [['arrest', DK.navy], ['overweight', DK.amber]], 1160, 250, 24, 70, false));
    // สัดส่วนภารกิจ (ตามคะแนนเกณฑ์)
    var M = ab('d-card', 1270, 592, 605, 300); add(st, M); head(M, 'สัดส่วนภารกิจ', 'ตามคะแนนเกณฑ์');
    var mr = mixRows(d.board && d.board.mix, true), mv = mixView(mr, 7);
    var dm = ab('d-donut', 16, 84, 200, 200); add(dm, donut(200, 32, mv.parts), h('div', { class: 'd-center' }, h('b', { style: 'font-size:' + (mr.total >= 10000 ? 36 : 44) + 'px', text: fmtN(Math.round(mr.total)) }), h('span', { style: 'font-size:22px;margin-top:2px', text: 'คะแนน' }))); add(M, dm);
    add(M, mixLegend(mv.list, 232, 80, 352, 30, 21, 1, false));
    // แยกเขตตรวจ (กระชับ)
    var Z = ab('d-card', 1270, 904, 605, 156); add(st, Z);
    var zt = ab('d-h2', 24, 10, null, null, 'font-size:30px'); zt.textContent = 'แยกเขตตรวจ'; add(Z, zt);
    add(Z, ab('d-legr', 0, 16, 0, null, 'right:22px;left:auto;font-size:21px'));
    add(Z.lastChild, h('i', { class: 'sq', style: 'width:18px;height:18px;background:' + DK.navy }), h('span', { text: 'อาญา' }), h('i', { class: 'sq', style: 'width:18px;height:18px;background:' + DK.blue + ';margin-left:14px' }), h('span', { text: 'จราจร' }));
    add(Z, zoneGrid(d.zones, 18, 56, 575, 92));
    return markZeros(st);
  }
  /** แถวแยกเขต: ชื่อเขต | คอลัมน์ละชุด (แท่ง + ตัวเลข) — สเกลแยกแต่ละชุด */
  function zoneRows(zones, series, x0, y0, w, hh, compact2) {
    var box = ab('z-rows', x0, y0, w, hh), rh = hh / zones.length, mx = {}, nameW = compact2 ? 158 : 200, valW = compact2 ? 52 : 60, gap = 14;
    var colW = (w - nameW - 10) / series.length, barW = colW - valW - gap;
    series.forEach(function (s) { mx[s[0]] = Math.max(1, Math.max.apply(null, zones.map(function (z) { return z[s[0]] || 0; }))); });
    zones.forEach(function (z, i) {
      var row = ab('z-row', 0, i * rh, w, rh - 4, i % 2 ? '' : 'background:' + DK.band2);
      var nm = ab('z-name', 10, 0, nameW, rh - 4); add(nm, h('b', { text: 'เขต ' + z.zone }), h('span', { text: ' ' + String(z.name).replace(/^เขต\s*\d+\s*/, '') })); add(row, nm);
      var bh = Math.min(16, rh - 18), y = (rh - 4 - bh) / 2;
      series.forEach(function (s, j) {
        var v = z[s[0]] || 0, bx = nameW + 10 + j * colW;
        add(row, ab('z-track', bx, y, barW, bh), ab('z-bar', bx, y, Math.max(v ? 5 : 0, v / mx[s[0]] * barW), bh, 'background:' + s[1]));
        var lab = ab('z-v', bx + barW + 8, 0, valW, rh - 4, 'color:' + (v ? s[1] : '#a3adbd') + (compact2 ? ';font-size:18px' : '')); lab.textContent = fmtN(v); add(row, lab);
      });
      add(box, row);
    });
    return box;
  }
  /** แท่งแยกรถ จัดกลุ่มตามเขต: แถบพื้นสลับสี + ชื่อเขต + เลขรถสลับสี — series = [[key, color]], key 'prev.x' = ค่าช่วงก่อน */
  function zoneBars(d, series, w, hh, x0, y0, mini) {
    var groups = [], byZ = {};
    d.cars.forEach(function (c) { var z = +c.zone || 0; if (!byZ[z]) { byZ[z] = { zone: z, cars: [] }; groups.push(byZ[z]); } byZ[z].cars.push(c); });
    var n = d.cars.length || 1, gap = mini ? 8 : 14, slot = (w - gap * (groups.length - 1)) / n;
    var box = ab('d-bars', x0, y0, w, hh), max = 1;
    function val(c, k) { return k.indexOf('prev.') === 0 ? c.prev[k.slice(5)] || 0 : c[k] || 0; }
    d.cars.forEach(function (c) { series.forEach(function (s) { max = Math.max(max, val(c, s[0])); }); });
    var zh = mini ? 0 : 54, lh = mini ? 42 : 36, base = hh - lh, top = zh + (mini ? 22 : 40), avail = base - top - 4, bw = Math.min(mini ? 18 : 38, (slot - 10) / series.length - 4), gx = 0;
    groups.forEach(function (g, gi) {
      var gw = slot * g.cars.length, zs = (d.zones || []).filter(function (z) { return z.zone === g.zone; })[0];
      add(box, ab('d-zband', gx, 0, gw, hh, 'background:' + (gi % 2 ? DK.band2 : DK.band)));
      if (!mini) {
        var zl = ab('d-zl', gx, 6, gw, null); add(zl, h('b', { text: g.zone ? 'เขต ' + g.zone : 'อื่นๆ' }), h('span', { text: zs ? String(zs.name).replace(/^เขต\s*\d+\s*/, '') : '' })); add(box, zl);
      } else { var zm = ab('d-zm', gx, hh - 20, gw, null); zm.textContent = g.zone ? 'เขต ' + g.zone : 'อื่น'; add(box, zm); }
      g.cars.forEach(function (c, ci) {
        var cx = gx + ci * slot, used = bw * series.length + 4 * (series.length - 1);
        series.forEach(function (s, j) {
          var v = val(c, s[0]), isPrev = s[0].indexOf('prev.') === 0, bh = v ? Math.max(5, v / max * avail) : 3, bx = cx + (slot - used) / 2 + j * (bw + 4);
          add(box, ab('d-bar', bx, base - bh, bw, bh, 'background:' + (v ? s[1] : '#cfd6e2')));
          if (v || !mini) {
            var lab = ab('d-bv', bx - 18, base - bh - (mini ? (isPrev ? 18 : 22) : 42), bw + 36, null, mini ? (isPrev ? 'font-size:14px;color:#7b879b;font-weight:600' : 'font-size:17px;color:' + DK.navy) : (v ? 'color:' + s[1] : 'color:#a3adbd'));
            lab.textContent = fmtN(v); add(box, lab);
          }
        });
        var cl = ab('d-bl', cx, base + (mini ? 2 : 4), slot, null, 'color:' + (ci % 2 ? DK.blue : DK.navy) + (mini ? ';font-size:' + (slot < 44 ? 14 : 16) + 'px' : ';font-size:' + (slot < 84 ? 22 : 26) + 'px'));
        cl.textContent = c.car; add(box, cl);
      });
      gx += gw + gap;
    });
    add(box, ab('d-axis', 0, base, w, 2));
    return box;
  }
  var DASH_ICON = {
    siren: '<path d="M12 22h24v8H12z"/><path d="M15 22a9 9 0 0118 0z"/><path d="M24 6v6M10 12l4 4M38 12l-4 4" stroke="#0f2744" stroke-width="3" fill="none"/>',
    doc: '<path d="M13 6h16l8 8v28H13z"/><path d="M18 22h14M18 28h14M18 34h9" stroke="#f59e0b" stroke-width="3"/>',
    hand: '<circle cx="24" cy="24" r="16"/><path d="M24 14v13" stroke="#f59e0b" stroke-width="4"/><circle cx="24" cy="33" r="2.6" fill="#f59e0b"/>',
    cone: '<path d="M20 8h8l9 30H11z"/><path d="M8 38h32v4H8z"/><path d="M16 22h16M14 30h20" stroke="#f59e0b" stroke-width="3"/>',
    truck: '<path d="M6 14h22v18H6zM28 20h8l6 7v5H28z"/><circle cx="14" cy="35" r="4"/><circle cx="35" cy="35" r="4"/>',
    flag: '<path d="M12 6v36" stroke="#0f2744" stroke-width="4"/><path d="M14 8h22l-5 7 5 7H14z"/>'
  };
  function icon(k, size) { var s = sv('svg', { width: size, height: size, viewBox: '0 0 48 48', fill: '#0f2744' }); s.innerHTML = DASH_ICON[k]; return s; }
  /** แบบละเอียด (ตามภาพตัวอย่าง mtd-full) */
  function dashFull(d) {
    var t = d.total, st = ab('dsh full', 0, 0), pv = d.prev, pl, cl;
    if (pv.month) { pl = TH_M[+pv.from.slice(5, 7) - 1]; cl = TH_M[+d.from.slice(5, 7) - 1]; } else { pl = 'ช่วงก่อน'; cl = 'ช่วงนี้'; }
    var band = ab('f-band', 0, 0, 1920, 96); add(st, band);
    add(band, ab('f-left', -40, 0, 900, 96), h('img', { class: 'f-logo', src: 'logo.png', alt: '' }), ab('f-org', 112, 14, 760, null), ab('f-ttl', 0, 10, 0, null, 'right:40px;left:auto'));
    band.querySelector('.f-org').appendChild(h('b', { text: 'สถานีตำรวจทางหลวง 2 กก.3 บก.ทล.' })); band.querySelector('.f-org').appendChild(h('span', { text: 'ตำรวจทางหลวงชลบุรี' }));
    band.querySelector('.f-ttl').appendChild(h('b', { text: dashTitle(d.from, d.to, true, d._kind) }));
    band.querySelector('.f-ttl').appendChild(h('span', { text: 'เทียบ' + (pv.month ? 'เดือน ' + pl : 'ช่วงก่อนหน้า ' + thD(pv.from) + ' - ' + thD(pv.to)) }));
    var K = [['siren', t.arrest, 'จับกุมทั้งหมด'], ['doc', t.arrestWarrant, 'หมายจับ (' + fmtN(t.warrantPersons || 0) + ' ราย)'], ['hand', t.arrestFlag, 'ความผิดซึ่งหน้า'], ['cone', t.ticket, 'คดีจราจร'], ['truck', t.overweight, 'รถน้ำหนักเกิน'], ['flag', t.escort, 'นำขบวน']];
    K.forEach(function (k, i) { var c = ab('f-kpi', 12 + i * 318, 108, 306, 118); add(c, h('div', { class: 'ic' }, icon(k[0], 52)), h('b', { text: fmtN(k[1]) }), h('span', { text: k[2] })); add(st, c); });
    function listCard(x, w, title, top, rows, color) {
      var c = ab('f-card', x, 240, w, 572, 'border-top:7px solid ' + top); add(c, h('div', { class: 'fh2', text: title })); add(st, c);
      var max = rows.reduce(function (m, r) { return Math.max(m, r[1]); }, 1);
      if (!rows.length) add(c, h('div', { class: 'muted', style: 'font-size:24px;padding:20px 26px', text: 'ไม่มีข้อมูลในช่วงนี้' }));
      var rh = Math.min(62, Math.floor(480 / Math.max(rows.length, 7)));
      rows.slice(0, 10).forEach(function (r) { add(c, h('div', { class: 'fr', style: 'height:' + rh + 'px' }, h('span', { class: 'fl', text: r[0] }), h('div', { class: 'ft' }, h('i', { style: 'width:' + Math.max(1.2, r[1] / max * 100) + '%;background:' + color })), h('b', { text: fmtN(r[1]) }))); });
      return c;
    }
    listCard(12, 640, 'ฐานความผิด (อาญา)', DK.navy, crimeRows(d.byCrime || d.byArrestCat), DK.navy);
    listCard(664, 606, 'คดีจราจร', DK.blue, trafficRows(d), DK.blue);
    // หมายจับ / ขบวน / ของกลาง
    var w = d.warrant, W = ab('f-card', 12, 826, 314, 246, 'border-top:7px solid ' + DK.navy); add(st, W);
    add(W, h('div', { class: 'fh2', text: 'หมายจับ' + (w.persons ? ' · ' + fmtN(w.persons) + ' ราย' : '') }));
    var dw = ab('f-donut', 18, 66, 160, 160); add(dw, donut(160, 26, [{ v: w.bwc, c: DK.navy }, { v: w.joint, c: DK.amber }, { v: w.total - w.bwc - w.joint, c: DK.prev }]), h('div', { class: 'd-center' }, h('b', { style: 'font-size:46px', text: fmtN(w.total) }), h('span', { style: 'font-size:20px;margin-top:0', text: 'หมาย' }))); add(W, dw);
    add(W, ab('f-mini', 190, 60, 118, null)); [['Body Worn', w.bwc], ['จับร่วม', w.joint], ['ทั่วไป', w.total - w.bwc - w.joint]].forEach(function (r) { add(W.lastChild, h('div', null, h('b', { text: fmtN(r[1]) }), h('span', { text: r[0] }))); });
    // สัดส่วนภารกิจ (ตามคะแนนเกณฑ์) + ของกลาง
    var Mf = ab('f-card', 338, 826, 932, 246, 'border-top:7px solid ' + DK.amber); add(st, Mf);
    add(Mf, h('div', { class: 'fh2', text: 'สัดส่วนภารกิจ (ตามคะแนนเกณฑ์)' }));
    var fr = mixRows(d.board && d.board.mix, true), fv = mixView(fr, 10);
    var dfm = ab('f-donut', 18, 62, 160, 160); add(dfm, donut(160, 26, fv.parts), h('div', { class: 'd-center' }, h('b', { style: 'font-size:' + (fr.total >= 10000 ? 30 : 36) + 'px', text: fmtN(Math.round(fr.total)) }), h('span', { style: 'font-size:18px;margin-top:0', text: 'คะแนน' }))); add(Mf, dfm);
    add(Mf, mixLegend(fv.list, 196, 56, 716, 30, 19, 2, false));
    var evl = ab('d-note', 196, 210, 716, null, 'font-size:18px;overflow:hidden;text-overflow:ellipsis'); evl.textContent = 'ของกลาง: ' + (d.evidence.length ? d.evidence.slice(0, 6).map(function (x) { return x.item + ' ' + fmtN(x.qty) + ' ' + x.unit; }).join(' · ') : 'ไม่มี'); add(Mf, evl);
    // แยกรถตามเขต: ช่วงก่อน (เทา) เทียบช่วงนี้ · แยกเขตตรวจ
    [['อาญา แยกรถตามเขต', 'arrest', DK.navy], ['จราจร แยกรถตามเขต', 'ticket', DK.blue]].forEach(function (r, i) {
      var c = ab('f-card', 1284, 240 + i * 278, 624, 268, 'border-top:7px solid ' + r[2]); add(st, c);
      add(c, h('div', { class: 'fh2', text: r[0] }), ab('f-lg', 0, 22, 0, null, 'right:18px;left:auto'));
      add(c.lastChild, h('i', { class: 'sq', style: 'background:' + DK.prev }), h('span', { text: pl }), h('i', { class: 'sq', style: 'background:' + r[2] + ';margin-left:14px' }), h('span', { text: cl }));
      add(c, zoneBars(d, [['prev.' + r[1], DK.prev], [r[1], r[2]]], 600, 196, 12, 64, true));
    });
    var Zc = ab('f-card', 1284, 796, 624, 268, 'border-top:7px solid ' + DK.teal); add(st, Zc);
    add(Zc, h('div', { class: 'fh2', text: 'แยกเขตตรวจ (' + cl + ')' }), ab('f-lg', 0, 22, 0, null, 'right:18px;left:auto'));
    add(Zc.lastChild, h('i', { class: 'sq', style: 'background:' + DK.navy }), h('span', { text: 'อาญา' }), h('i', { class: 'sq', style: 'background:' + DK.blue + ';margin-left:14px' }), h('span', { text: 'จราจร' }));
    add(Zc, zoneRows(d.zones, [['arrest', DK.navy], ['ticket', DK.blue]], 14, 64, 596, 194, true));
    add(st, ab('f-foot', 0, 1072, 1920, 8));
    return markZeros(st);
  }
  // ---------- ภาพรายรถ + รายการคดี (ผู้บังคับบัญชาขอรายละเอียด: คันไหนทำอะไร ไม่ต้องนึกเอง) ----------
  var TRAFFIC_SHORT = { 'ไม่มี/ไม่แสดงใบอนุญาตขับขี่': 'ไม่มีใบขับขี่', 'ใช้รถไม่ตรงตามประเภทที่จดทะเบียน': 'ใช้รถผิดประเภท', 'ใบอนุญาตขับรถขนส่ง': 'ใบขับขี่รถขนส่ง',
    'ไม่สวมหมวกนิรภัย': 'ไม่สวมหมวกนิรภัย', 'ไม่คาดเข็มขัดนิรภัย': 'ไม่คาดเข็มขัด' };
  function trafficShort(l) { if (TRAFFIC_SHORT[l]) return TRAFFIC_SHORT[l]; var m = String(l).match(/^อื่นๆ ตาม (.+?) \(ไม่ระบุ\)$/); return m ? 'อื่นๆ ' + m[1] : l; }
  /** หมวดจราจรแบบ บก. แต่แตก "อื่นๆ" เป็นชื่อความผิดจริง → [[ชื่อ, จำนวน]] มาก→น้อย */
  function trafficRows(d) {
    var rows = Object.keys(d.byBk || {}).filter(function (k) { return d.byBk[k] && k !== 'อื่นๆ'; }).map(function (k) { return [DASH_BK[k] || k, d.byBk[k]]; });
    var oth = d.bkOther || {}, sumO = 0;
    Object.keys(oth).forEach(function (k) { if (oth[k]) { rows.push([trafficShort(k), oth[k]]); sumO += oth[k]; } });
    if (((d.byBk || {})['อื่นๆ'] || 0) > sumO) rows.push(['อื่นๆ', d.byBk['อื่นๆ'] - sumO]);
    return rows.sort(function (a, b) { return b[1] - a[1]; });
  }
  function crimeRows(map) { return Object.keys(map || {}).filter(function (k) { return map[k]; }).sort(function (a, b) { return map[b] - map[a]; }).map(function (k) { return [DASH_CAT[k] || k, map[k]]; }); }
  function crimeText(map, sep) { return crimeRows(map).map(function (r) { return r[0] + ' ' + fmtN(r[1]); }).join(sep || ' · '); }
  function prevLabel(p) {
    if (!p) return '';
    if (p.kind === 'cycle') return 'วงรอบ ' + +p.from.slice(8) + '–' + thD(p.to) + ' ' + thY(p.to);
    if (p.kind === 'month') return 'เดือน' + TH_MF[+p.from.slice(5, 7) - 1] + ' ' + thY(p.from);
    return thD(p.from) + ' – ' + thD(p.to) + ' ' + thY(p.to);
  }
  function delta(cur, prev) {
    var dv = Math.round(((+cur || 0) - (+prev || 0)) * 10) / 10;
    return h('i', { class: dv > 0 ? 'dl-up' : dv < 0 ? 'dl-dn' : 'dl-eq', text: dv > 0 ? '▲' + fmtN(dv) : dv < 0 ? '▼' + fmtN(-dv) : '=' });
  }
  /** ตารางย่อรายคันในภาพแบบสรุป: แถว = งาน, คอลัมน์ = รถ (จัดกลุ่มตามเขต) · สีพื้นเข้มตามค่าในแถวนั้น (โทนเดียว) */
  function carGrid(b, x0, y0, w, hh) {
    var box = ab('cg', x0, y0, w, hh), cars = ((b && b.cars) || []).filter(function (c) { return c.shifts || c.arrest || c.ticket || c.escort || c.assist; });
    var R = [['arrest', 'อาญา'], ['ticket', 'จราจร'], ['escort', 'ว.42'], ['assist', 'ช่วยเหลือ'], ['score', 'คะแนน']];
    var labW = 124, n = Math.max(cars.length, 1), colW = (w - labW) / n, headH = 68, rh = (hh - headH) / R.length, zones = [];
    cars.forEach(function (c, i) { var z = +c.zone || 0; if (!zones.length || zones[zones.length - 1].z !== z) zones.push({ z: z, start: i, n: 0 }); zones[zones.length - 1].n++; });
    zones.forEach(function (g, k) {
      var gx = labW + g.start * colW;
      add(box, ab('cg-band', gx + 2, 0, g.n * colW - 4, hh, 'background:' + (k % 2 ? DK.band2 : DK.band)));
      var zl = ab('cg-z', gx, 6, g.n * colW, null); zl.textContent = g.z ? 'เขต ' + g.z : 'อื่นๆ'; add(box, zl);
    });
    cars.forEach(function (c, i) { var cl = ab('cg-car', labW + i * colW, 34, colW, null, 'color:' + (i % 2 ? DK.blue : DK.navy) + (colW < 64 ? ';font-size:18px' : '')); cl.textContent = c.car; add(box, cl); });
    R.forEach(function (r, j) {
      var y = headH + j * rh, max = Math.max.apply(null, cars.map(function (c) { return +c[r[0]] || 0; }).concat([1]));
      var lb = ab('cg-lab', 0, y, labW - 8, rh); lb.textContent = r[1]; add(box, lb);
      cars.forEach(function (c, i) {
        var v = +c[r[0]] || 0, a = v > 0 ? 0.08 + 0.52 * v / max : 0;
        var cell = ab('cg-cell', labW + i * colW + 3, y + 3, colW - 6, rh - 6, 'background:rgba(37,99,235,' + a.toFixed(3) + ');' + (a > 0.42 ? 'color:#fff' : v ? '' : 'color:#a3adbd') + (colW < 64 ? ';font-size:19px' : ''));
        cell.textContent = fmtN(v); add(box, cell);
      });
    });
    return box;
  }
  // ---------- แท่งคะแนนรายคัน (เรียงมาก→น้อย แบ่งสีตามงาน) — ภาพรวมที่อ่านง่ายกว่าตาราง ----------
  var SCORE_PARTS = [['arrest', 'อาญา', CAT.arrest], ['ticket', 'จราจร', CAT.ticket], ['service', 'ว.42/ช่วยเหลือ', CAT.escort], ['mission', 'ภารกิจ/จิตอาสา', CAT.mission]];
  function posScore(c) { var p = c.parts || {}; return SCORE_PARTS.reduce(function (s2, k) { return s2 + Math.max(0, +p[k[0]] || 0); }, 0); }
  function countsText(c) {
    var a = [];
    a.push('อาญา ' + (c.arrest || 0)); if (c.ticket) a.push('จราจร ' + c.ticket); if (c.escort) a.push('ว.42 ' + c.escort); if (c.assist) a.push('ช่วยเหลือ ' + c.assist); if (c.mission) a.push('ภารกิจ ' + c.mission);
    return a.join(' · '); // อาญาแสดงเสมอ (0 = ตัวแดง ผ่าน markZeros)
  }
  function byScore(cars) { return activeCars(cars).slice().sort(function (a, b) { return b.score - a.score || b.ticket - a.ticket || String(a.car).localeCompare(String(b.car)); }); }
  /** ภาพ: แท่งคะแนนรายคัน 1–2 คอลัมน์ */
  function carScoreBars(b, x0, y0, w, hh) {
    var cars = byScore(b.cars), n = cars.length, box = ab('sb', x0, y0, w, hh);
    if (!n) { var e = ab('d-note', 0, 20, w, null); e.textContent = 'ยังไม่มีข้อมูลรายรถในช่วงนี้'; add(box, e); return box; }
    // แต่ละแถว: [ลำดับ รถ เขต] | แถบคะแนน + คะแนน (บรรทัดบน) · จำนวนงานจริง (บรรทัดล่าง)
    var cols = n > 6 ? 2 : 1, rows = Math.ceil(n / cols), gap = 36, colW = (w - gap * (cols - 1)) / cols, rh = Math.min(64, hh / rows);
    var labW = 166, barW = colW - labW - 78, max = Math.max.apply(null, cars.map(posScore).concat([1])), fs = rh < 42 ? 14 : 16, bh = rh < 42 ? 10 : 14;
    cars.forEach(function (c, i) {
      var col = Math.floor(i / rows), r = i % rows, x = col * (colW + gap), y = r * rh;
      if (r % 2 === 0) add(box, ab('sb-band', x - 6, y, colW + 12, rh));
      var lb = ab('sb-lab', x, y, labW, rh); add(lb, h('i', { text: String(i + 1) }), h('b', { class: 'cno', style: 'font-size:' + (rh < 36 ? 20 : 23) + 'px', text: c.car }), h('small', { text: c.zone ? 'เขต ' + c.zone : '' })); add(box, lb);
      var top = y + 4, bx = x + labW, ps = c.parts || {};
      SCORE_PARTS.forEach(function (k) { var v = Math.max(0, +ps[k[0]] || 0); if (!v) return; var ww = v / max * barW; add(box, ab('sb-seg', bx, top + 2, Math.max(2, ww - 2), bh, 'background:' + k[2])); bx += ww; });
      var sv2 = ab('sb-v', bx + 8, top - 6, 76, bh + 16, 'font-size:' + (fs + 4) + 'px'); sv2.textContent = fmt1(c.score); add(box, sv2);
      var tx = ab('sb-t', x + labW, top + bh + 5, colW - labW, rh - bh - 9, 'font-size:' + fs + 'px'); tx.textContent = countsText(c); add(box, tx);
    });
    return box;
  }
  function fmt1(v) { return fmtN(Math.round((+v || 0) * 10) / 10); }
  /** หมายเหตุน้ำหนักคะแนนตามเกณฑ์ที่ใช้ในช่วงนั้น (เกณฑ์ล่าสุดถ้าช่วงคร่อมหลายเกณฑ์) */
  function weightNote(cr) { return weightItems(cr).join(' · '); }
  // หมายเหตุแสดงเฉพาะ (ผู้ใช้กำหนด 10 ต.ค. 69): ซึ่งหน้า · ยาเสพติด · อาวุธปืน · สวมทะเบียน/เอกสารปลอม · หมายจับ · ใบสั่ง · ว.42 · ช่วยเหลือ · ภารกิจ/จิตอาสา · คดีร่วมหลายคัน
  var NOTE_CATS = ['พ.ร.บ.ยาเสพติด', 'พ.ร.บ.อาวุธปืน', 'ปลอม/ใช้เอกสารราชการปลอม (สวมทะเบียน)'];
  function weightItems(cr) {
    if (!cr || !cr.weights) return [];
    // คะแนนที่เป็น 0 ไม่แสดง · เรียงน้ำหนักมาก → น้อย (ผู้ใช้กำหนด 10 ต.ค. 69) · คดีร่วมหลายคันไว้ท้าย
    var w = cr.weights, a = w.act || {}, f = fmtN, X = [];
    // หมวดที่กำหนดให้แสดงเสมอ (ไม่ได้ตั้งแยก = ใช้ค่าซึ่งหน้าทั่วไป)
    function cw(k) { return w.cat && w.cat[k] != null && w.cat[k] !== '' ? +w.cat[k] : +w.flag; }
    var dg = w.drug, cats = NOTE_CATS.filter(function (k) { return dg && k === 'พ.ร.บ.ยาเสพติด' ? false : cw(k); });
    cats.forEach(function (k) { X.push([(DASH_CAT[k] || k) + ' ' + f(cw(k)) + '/ราย', cw(k)]); });
    if (dg) { // ยาเสพติดแบ่งขั้นตามของกลาง (ต่อคดี) → แสดงช่วงคะแนน
      var dv = [dg.meth1, dg.meth2, dg.meth3, dg.ice1, dg.ice2, dg.ice3, dg.other].map(Number).filter(function (v) { return v; });
      if (dv.length) { var lo = Math.min.apply(null, dv), hi = Math.max.apply(null, dv); X.push(['ยาเสพติด ' + (lo === hi ? f(hi) : f(lo) + '–' + f(hi)) + '/คดี', hi]); }
    }
    if (+w.flag) X.push(['ซึ่งหน้า' + (cats.length ? ' (ทั่วไป)' : '') + ' ' + f(w.flag) + '/ราย', +w.flag]);
    if (+w.warrant) X.push(['หมายจับ ' + f(w.warrant) + '/หมาย', +w.warrant]);
    var acts = [['ขส', a.T], ['รย', a.C], ['จร', a.R]].filter(function (x) { return +x[1]; });
    if (acts.length) X.push([acts.length === 3 && +a.T === +a.C && +a.C === +a.R ? 'ใบสั่ง ' + f(a.T) + '/ราย' : 'ใบสั่ง ' + acts.map(function (x) { return x[0] + ' ' + f(x[1]); }).join(' · ') + ' /ราย',
      Math.max.apply(null, acts.map(function (x) { return +x[1]; }))]);
    [['ว.42', w.escort, 'ขบวน'], ['ช่วยเหลือ', w.assist, 'ครั้ง'], ['ภารกิจ/จิตอาสา', w.mission, 'ครั้ง']].forEach(function (x) { if (+x[1]) X.push([x[0] + ' ' + f(x[1]) + '/' + x[2], +x[1]]); });
    X.forEach(function (x, i) { x.push(i); });
    X.sort(function (p, q) { return q[1] - p[1] || p[2] - q[2]; });
    var L = X.map(function (x) { return x[0]; }), pp = w.primaryPct == null ? 60 : +w.primaryPct;
    L.push('คดีร่วมหลายคัน: รถผู้จับหลัก ' + f(pp) + '% รถร่วมแบ่ง ' + f(100 - pp) + '% (ระบุไม่ได้หารเท่ากัน)');
    L[0] = 'น้ำหนักคะแนน' + (cr.n > 1 ? ' (เกณฑ์ล่าสุด "' + cr.name + '" · ช่วงนี้ใช้ ' + cr.n + ' เกณฑ์)' : cr.name && cr.name !== 'เกณฑ์มาตรฐาน' ? ' ("' + cr.name + '")' : '') + ': ' + L[0];
    return L;
  }
  /** ผลที่เป็น 0 → ตัวหนังสือสีแดง (ห่อเฉพาะตัวเลข 0 ในข้อความ ไม่แตะกราฟ SVG / ส่วนที่ติด .nz) */
  var ZRE = /(^|[\s(:\/])(0(?:\.0+)?%?)(?=$|[\s·),\/])/g;
  function markZeros(root) {
    if (!root || !document.createTreeWalker) return root;
    var tw = document.createTreeWalker(root, 4, null), list = [], n;
    while ((n = tw.nextNode())) { var pe = n.parentNode; if (pe && pe.closest && !pe.closest('svg, .nz, .zero, select, option, button') && /(^|[\s(:\/])0/.test(n.nodeValue)) list.push(n); }
    list.forEach(function (tn) {
      var t = tn.nodeValue, frag = h('span'), last = 0, m, hit = false; ZRE.lastIndex = 0; // ห่อทั้งข้อความใน span เดียว (กันช่องว่างหายใน flex)
      while ((m = ZRE.exec(t))) { var st = m.index + m[1].length; hit = true; if (st > last) frag.appendChild(document.createTextNode(t.slice(last, st))); frag.appendChild(h('span', { class: 'zero', text: m[2] })); last = st + m[2].length; }
      if (!hit) return;
      if (last < t.length) frag.appendChild(document.createTextNode(t.slice(last)));
      tn.parentNode.replaceChild(frag, tn);
    });
    return root;
  }
  function scoreLegend() { var lg = ab('d-legr', 0, 30, 0, null, 'right:24px;left:auto;font-size:20px'); SCORE_PARTS.forEach(function (k, i) { add(lg, h('i', { class: 'sq', style: 'width:20px;height:20px;background:' + k[2] + (i ? ';margin-left:16px' : '') }), h('span', { text: k[1] })); }); return lg; }
  /** แอป (มือถือ): แท่งคะแนนรายคัน + จำนวนงานจริง */
  function carScoreList(cars) {
    cars = byScore(cars);
    if (!cars.length) return h('p', { class: 'muted small', text: 'ยังไม่มีข้อมูลรายรถในช่วงนี้' });
    var max = Math.max.apply(null, cars.map(posScore).concat([1])), box = h('div', { class: 'sbl' });
    add(box, h('div', { class: 'sb-lg' }, SCORE_PARTS.map(function (k) { return h('span', null, h('i', { style: 'background:' + k[2] }), k[1]); })));
    cars.forEach(function (c, i) {
      var bar = h('div', { class: 'sb-bar' }), ps = c.parts || {};
      SCORE_PARTS.forEach(function (k) { var v = Math.max(0, +ps[k[0]] || 0); if (v) add(bar, h('i', { style: 'width:' + (v / max * 100).toFixed(1) + '%;background:' + k[2] })); });
      add(box, h('div', { class: 'sb-r' },
        h('div', { class: 'sb-h' }, h('span', { class: 'sb-rank', text: String(i + 1) }), h('b', { class: 'cno', text: c.car }), h('small', { class: 'muted', text: c.zone ? 'เขต ' + c.zone : '' }), h('span', { class: 'grow' }),
          h('b', { class: 'sb-score', text: fmt1(c.score) }), h('small', { class: 'muted', text: ' คะแนน' }), dlt(c.score, c.prev ? c.prev.score : null)),
        bar, h('div', { class: 'small muted', text: countsText(c) + (c.shifts ? ' · ' + c.shifts + ' ผลัด' : '') })));
    });
    return box;
  }
  // ---------- สัดส่วนภารกิจ (คิดตามคะแนนเกณฑ์ของสถานี) ----------
  // [key, ชื่อเต็ม, ชื่อย่อ, หน่วย, สี] — สีตระกูลเดียวกันต่อกลุ่มงาน: ขบวน=อำพัน · อาญา=กรมท่า · จราจร=ฟ้า · ช่วยเหลือ=เขียวน้ำทะเล · ภารกิจ=ม่วง
  var MIX_CATS = [
    ['royal', 'ถวายความปลอดภัย (ถปภ.)', 'ถปภ.', 'ขบวน', '#b45309'],
    ['escort', 'นำขบวน ว.42', 'ว.42', 'ขบวน', '#f59e0b'],
    ['medical', 'นำส่งผู้ป่วย/อวัยวะ', 'นำส่งผู้ป่วย', 'ครั้ง', '#fcd34d'],
    ['warrant', 'จับกุมตามหมายจับ', 'หมายจับ', 'หมาย', '#0f2744'],
    ['flag', 'จับกุมคดีอาญา (ซึ่งหน้า)', 'อาญาซึ่งหน้า', 'ราย', '#3f5a8a'],
    ['seizure', 'ตรวจยึดรถ/ของกลาง', 'ตรวจยึด', 'ครั้ง', '#9f1239'],
    ['ticket', 'ออกใบสั่งจราจร', 'ใบสั่ง', 'ราย', '#2563eb'],
    ['warning', 'ว่ากล่าวตักเตือน', 'ตักเตือน', 'ราย', '#93c5fd'],
    ['assist', 'ช่วยเหลือประชาชน', 'ช่วยเหลือ', 'ครั้ง', '#0d9488'],
    ['accident', 'ช่วยเหลืออุบัติเหตุ ว.40', 'อุบัติเหตุ', 'ครั้ง', '#5eead4'],
    ['volunteer', 'ภารกิจจิตอาสา', 'จิตอาสา', 'ครั้ง', '#7c3aed'],
    ['mission', 'ภารกิจอื่น', 'ภารกิจอื่น', 'ครั้ง', '#c4b5fd']];
  var MIX_OTHER = '#d4dbe6';
  /** แถวสัดส่วน เรียงคะแนนมาก→น้อย · keepRoyal = แสดง ถปภ. แม้เป็น 0 */
  function mixRows(mix, keepRoyal) {
    mix = mix || {}; var tot = 0;
    var rows = MIX_CATS.map(function (c) { var m = mix[c[0]] || {}; return { k: c[0], label: c[1], short: c[2], unit: c[3], color: c[4], p: Math.max(0, +m.p || 0), n: +m.n || 0 }; })
      .filter(function (r) { return r.p > 0 || r.n > 0 || (keepRoyal && r.k === 'royal'); });
    rows.forEach(function (r) { tot += r.p; });
    rows.forEach(function (r) { r.pct = tot ? r.p / tot * 100 : 0; });
    rows.sort(function (a, b) { return b.p - a.p || b.n - a.n; });
    rows.total = Math.round(tot * 10) / 10; return rows;
  }
  function pctText(v) { return v >= 9.95 || v === 0 ? Math.round(v) + '%' : (Math.round(v * 10) / 10) + '%'; }
  /** แบ่งสำหรับแสดง: max บรรทัด (หมวดเล็กรวมเป็น "อื่นๆ" · ถปภ. ที่เป็น 0 แสดงท้ายสุด) */
  function mixView(rows, max) {
    var pos = rows.filter(function (r) { return r.p > 0; }), royal0 = rows.filter(function (r) { return r.k === 'royal' && !r.p; })[0] || null;
    var slots = max - (royal0 ? 1 : 0), shown = pos.length > slots ? pos.slice(0, slots - 1) : pos, rest = pos.slice(shown.length), other = null;
    if (rest.length) other = { k: 'other', label: 'อื่นๆ (' + rest.map(function (r) { return r.short; }).join(', ') + ')', short: 'อื่นๆ ' + rest.length + ' หมวด', unit: '', color: MIX_OTHER,
      p: rest.reduce(function (s, r) { return s + r.p; }, 0), pct: rest.reduce(function (s, r) { return s + r.pct; }, 0), n: null };
    var list = shown.concat(other ? [other] : []).concat(royal0 ? [royal0] : []);
    return { list: list, parts: shown.concat(other ? [other] : []).map(function (r) { return { v: r.p, c: r.color }; }) };
  }
  function primaryPctOf(b) { var w = b && b.criteria && b.criteria.weights; return w && w.primaryPct != null ? +w.primaryPct : 60; }
  function darkColor(hex) { var n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255; return (r * 299 + g * 587 + b * 114) / 1000 < 150; }
  /** ภาพ: รายการสัดส่วน (cols คอลัมน์ เรียงลงก่อน) */
  function mixLegend(list, x0, y0, w, rh, fs, cols, full) {
    cols = cols || 1; var per = Math.ceil(list.length / cols), cw = w / cols, box = ab('mxl', x0, y0, w, per * rh);
    list.forEach(function (r, i) {
      var row = ab('mxl-r' + (r.k === 'royal' ? ' nz' : ''), Math.floor(i / per) * cw, (i % per) * rh, cw - (cols > 1 ? 24 : 0), rh, 'font-size:' + fs + 'px'); // ถปภ. = ภารกิจพิเศษ ไม่ทำ 0 เป็นตัวแดง
      add(row, h('i', { style: 'background:' + r.color + ';width:' + Math.round(fs * 0.8) + 'px;height:' + Math.round(fs * 0.8) + 'px' }), h('span', { class: 'l', text: full ? r.label : r.short }),
        r.n != null ? h('small', { text: fmtN(r.n) + (r.unit ? ' ' + r.unit : '') }) : null, h('b', { text: pctText(r.pct) }));
      add(box, row);
    });
    return box;
  }
  /** ภาพ: แยกเขตตรวจแบบกระชับ 2 คอลัมน์ (อาญา · จราจร) */
  function zoneGrid(zones, x0, y0, w, hh) {
    var box = ab('zg', x0, y0, w, hh), rows = Math.ceil(zones.length / 2), rh = hh / rows, cw = w / 2;
    zones.forEach(function (z, i) {
      var c = ab('zg-c', (i % 2) * cw, Math.floor(i / 2) * rh, cw - 12, rh - 4, Math.floor(i / 2) % 2 ? '' : 'background:' + DK.band2);
      add(c, h('b', { text: 'เขต ' + z.zone }), h('span', { class: 'nm', text: String(z.name).replace(/^เขต\s*\d+\s*/, '') }), h('span', { class: 'v', style: 'color:' + DK.navy, text: fmtN(z.arrest || 0) }), h('span', { class: 'v', style: 'color:' + DK.blue, text: fmtN(z.ticket || 0) }));
      add(box, c);
    });
    return box;
  }
  /** ภาพที่ 4: สัดส่วนภารกิจทั้งสถานี + แท่ง 100% รายรถ (เรียงตามคะแนน) — 16:9 แบ่งหน้าเมื่อรถมาก → [node, ...] */
  function dashMix(d) {
    var b = d.board, rows = mixRows(b.mix, true), v = mixView(rows, 9);
    var cars = byScore(b.cars).filter(function (c) { return c.mix && Object.keys(c.mix).length; });
    var ch = 818, rh = 48, lh = 34, per = Math.floor((ch - 132 - 96) / rh), pages = pager(cars.length ? cars : [null], function () { return 1; }, per);
    return pages.map(function (pg, pi) {
      var st = ab('dsh', 0, 0, 1920, 1080); st.setAttribute('data-h', 1080);
      add(st, header(d));
      var tt = ab('d-title', 46, 140, 1500, null, 'font-size:52px'); tt.textContent = 'สัดส่วนภารกิจ ' + dashTitle(d.from, d.to, false, d._kind).replace(/^ผลการปฏิบัติงาน/, ''); add(st, tt);
      var pn = ab('d-note', 0, 200, 0, null, 'right:48px;left:auto;font-size:24px'); pn.textContent = 'คิดตามคะแนนเกณฑ์ของสถานี'; add(st, pn);
      pageTag(st, pi + 1, pages.length);
      // ทั้งสถานี
      var L = ab('d-card', 46, 222, 640, ch); add(st, L);
      var t1 = ab('d-h2', 30, 22, null, null, 'font-size:36px'); t1.textContent = 'ทั้งสถานี'; add(L, t1);
      var dn = ab('d-donut', 150, 86, 340, 340); add(dn, donut(340, 56, v.parts), h('div', { class: 'd-center' }, h('b', { style: 'font-size:72px', text: fmtN(Math.round(rows.total)) }), h('span', { text: 'คะแนน' }))); add(L, dn);
      add(L, mixLegend(v.list, 34, 446, 572, lh, 22, 1, true));
      // รายรถ
      var R = ab('d-card', 706, 222, 1168, ch); add(st, R);
      var t2 = ab('d-h2', 30, 22, null, null, 'font-size:36px'); t2.textContent = 'แยกรายรถ (เรียงตามคะแนน)'; add(R, t2);
      var used = MIX_CATS.filter(function (c) { return cars.some(function (x) { return x.mix[c[0]] && x.mix[c[0]].p > 0; }); });
      var lg = ab('mx-key', 30, 78, 1110, 40); used.forEach(function (c) { add(lg, h('span', null, h('i', { style: 'background:' + c[4] }), c[2])); }); add(R, lg);
      var bx = 250, bw = 740;
      pg.forEach(function (c, i) {
        if (!c) return;
        var y = 132 + i * rh, rr = mixRows(c.mix), x = bx, no = pi * per + i + 1;
        if (i % 2 === 0) add(R, ab('sb-band', 16, y, 1136, rh));
        var lab = ab('sb-lab', 30, y, 210, rh); add(lab, h('i', { text: String(no) }), h('b', { class: 'cno', style: 'font-size:26px', text: c.car }), h('small', { text: c.zone ? 'เขต ' + c.zone : '' })); add(R, lab);
        rr.forEach(function (r) {
          if (!(r.pct > 0)) return;
          var ww = r.pct / 100 * bw, seg = ab('mx-seg', x, y + 7, Math.max(1, ww - 2), rh - 14, 'background:' + r.color + ';color:' + (darkColor(r.color) ? '#fff' : DK.navy));
          if (ww >= 64) seg.textContent = (ww >= 150 ? r.short + ' ' : '') + pctText(r.pct);
          add(R, seg); x += ww;
        });
        var sc = ab('mx-sc', bx + bw + 16, y, 140, rh); add(sc, h('b', { text: fmt1(c.score) }), h('span', { text: ' คะแนน' })); add(R, sc);
      });
      if (!cars.length) { var e = ab('d-note', 30, 140, 1000, null); e.textContent = 'ยังไม่มีผลงานรายรถในช่วงนี้'; add(R, e); }
      var ft = ab('d-note', 30, ch - 74, 1110, null, 'font-size:20px;white-space:normal'); ft.textContent = 'แถบ = สัดส่วนคะแนนของรถคันนั้นแยกตามภารกิจ (ยาวเท่ากันทุกคัน) · คดีร่วมหลายคัน: รถผู้จับหลักได้ ' + fmtN(primaryPctOf(b)) + '% รถร่วมแบ่งส่วนที่เหลือ · ตรวจยึดที่ไม่มีผู้ต้องหาคิดรายครั้ง (ยาเสพติดตามขั้นของกลาง) · หักคะแนนไม่ส่งเวรไม่รวมในสัดส่วน'; add(R, ft);
      return markZeros(st);
    });
  }
  /** แอป: โดนัทสัดส่วนภารกิจของสถานี + แท่ง 100% รายรถ */
  function mixCard(mix, cars, title) {
    var rows = mixRows(mix, true), c = card(title || '🧭 สัดส่วนภารกิจ', 'ตามคะแนนเกณฑ์');
    if (!rows.total) { add(c, h('p', { class: 'muted small', text: 'ยังไม่มีผลงานในช่วงนี้' })); return c; }
    var v = mixView(rows, 13), dn = h('div', { class: 'mx-donut' });
    add(dn, donut(150, 24, v.parts), h('div', { class: 'mx-c' }, h('b', { text: fmtN(Math.round(rows.total)) }), h('span', { text: 'คะแนน' })));
    var lg = h('div', { class: 'mx-lg' });
    v.list.forEach(function (r) { add(lg, h('div', { class: 'mx-li' + (r.k === 'royal' ? ' nz' : '') }, h('i', { style: 'background:' + r.color }), h('span', { class: 'l', text: r.label }), r.n != null ? h('span', { class: 'n', text: fmtN(r.n) + ' ' + r.unit }) : null, h('b', { text: pctText(r.pct) }))); });
    add(c, h('div', { class: 'mx-top' }, dn, lg));
    var list = byScore(cars || []).filter(function (x) { return x.mix && Object.keys(x.mix).length; });
    if (list.length) {
      add(c, h('h3', { style: 'margin:14px 0 6px', text: 'สัดส่วนภารกิจรายรถ' }));
      var box = h('div', { class: 'mx-cars' });
      list.forEach(function (x) {
        var rr = mixRows(x.mix), bar = h('div', { class: 'mx-bar' });
        rr.forEach(function (r) { if (r.pct > 0) add(bar, h('i', { style: 'width:' + r.pct.toFixed(2) + '%;background:' + r.color, title: r.short + ' ' + pctText(r.pct) })); });
        var main = rr.filter(function (r) { return r.p > 0; }).slice(0, 3).map(function (r) { return r.short + ' ' + pctText(r.pct); }).join(' · ');
        add(box, h('div', { class: 'mx-r' }, h('div', { class: 'mx-h' }, h('b', { class: 'cno', text: x.car }), h('small', { class: 'muted', text: x.zone ? 'เขต ' + x.zone : '' }), h('span', { class: 'grow' }), h('small', { class: 'muted', text: fmt1(x.score) + ' คะแนน' })),
          bar, h('div', { class: 'small muted', text: main })));
      });
      add(c, box);
    }
    add(c, info('คิดสัดส่วนจากคะแนนตามเกณฑ์ของสถานี (งานยาก/สำคัญมีน้ำหนักมากกว่า) · ตัวเลขข้างชื่อ = จำนวนจริง · ตรวจยึดที่ไม่มีผู้ต้องหาคิดรายครั้ง (ยาเสพติดตามขั้นของกลาง)'));
    return c;
  }
  /** ภาพตารางรายรถ 1920×1080 — แบ่งหน้าเมื่อรถเกิน 12 คัน → [node, ...] */
  function dashCars(d) {
    var b = d.board, all = b.cars.filter(function (c) { return c.shifts || c.arrest || c.ticket || c.escort || c.assist || c.checks || c.score; });
    var headH = 66, totH = 60, rh = 52, per = Math.floor((1080 - 222 - 100 - headH - totH) / rh), pages = pager(all, function () { return 1; }, per);
    return pages.map(function (cars, pi) { return dashCarsPage(d, all, cars, pi, pages.length, headH, totH, rh); });
  }
  function dashCarsPage(d, all, cars, pi, np, headH, totH, rh) {
    var b = d.board, last = pi === np - 1, tblH = headH + cars.length * rh + (last ? totH : 0);
    var st = ab('dsh', 0, 0, 1920, 1080); st.setAttribute('data-h', 1080);
    add(st, header(d));
    var tt = ab('d-title', 46, 140, 1500, null, 'font-size:52px'); tt.textContent = 'ผลการปฏิบัติแยกรายรถ ' + dashTitle(d.from, d.to, false, d._kind).replace(/^ผลการปฏิบัติงาน/, ''); add(st, tt);
    var pn = ab('d-note', 0, 200, 0, null, 'right:48px;left:auto;font-size:24px'); pn.textContent = '▲▼ เทียบ' + prevLabel(b.prev); add(st, pn);
    pageTag(st, pi + 1, np);
    var big = Math.round(Math.min(30, rh * 0.5)), sm = rh >= 52 ? 17 : 15;
    var T = ab('d-card ct', 46, 222, 1828, tblH); add(st, T);
    function num(v, pv, extra) { var x = h('div', { class: 'nv' }, h('b', { style: 'font-size:' + big + 'px', text: fmtN(v) }), pv == null ? null : delta(v, pv)); return extra ? [x, h('small', { style: 'font-size:' + sm + 'px', text: extra })] : [x]; }
    var maxOf = {}; ['arrest', 'ticket', 'escort', 'assist', 'score', 'perShift'].forEach(function (k) { maxOf[k] = Math.max.apply(null, cars.map(function (c) { return +c[k] || 0; }).concat([1])); });
    function heat(k, v) { return v > 0 ? 'background:rgba(37,99,235,' + (0.05 + 0.2 * v / maxOf[k]).toFixed(3) + ')' : ''; }
    var COLS = [
      ['เขต', 84], ['รถ', 110, function (c) { return [h('b', { style: 'font-size:' + (big - 1) + 'px', text: c.car })]; }],
      ['ผลัดที่ออก', 120, function (c) { return num(c.shifts, null, 'วัน ' + c.D + ' · คืน ' + c.N); }],
      ['เจ้าหน้าที่', 300, function (c) { var top = c.crew.length ? c.crew[0].n : 0; return [h('div', { class: 't', style: 'font-size:' + (sm + 2) + 'px;max-height:' + (rh - 6) + 'px', text: c.crew.map(function (m) { return m.name + (m.n < top ? '(' + m.n + ')' : ''); }).join(' · ') || '-' })]; }, 'l'],
      ['อาญา', 180, function (c) { return num(c.arrest, c.prev.arrest, 'หมายจับ ' + c.warrant + ' · ซึ่งหน้า ' + c.flag); }, '', 'arrest'],
      ['ฐานความผิด', 440, function (c) { var m = {}; c.crimes.forEach(function (x) { m[x.label] = x.n; }); return [h('div', { class: 't', style: 'font-size:' + (sm + 2) + 'px;max-height:' + (rh - 6) + 'px' }, c.crimes.length ? crimeText(m) : h('span', { class: 'muted', text: '-' }), c.joint ? h('span', { class: 'jt', text: ' (จับร่วม ' + c.joint + ')' }) : null)]; }, 'l'],
      ['จราจร', 150, function (c) { return num(c.ticket, c.prev.ticket, 'ขส ' + c.T + ' · รย ' + c.C + (c.R ? ' · จร ' + c.R : '')); }, '', 'ticket'],
      ['ว.42', 100, function (c) { return num(c.escort, c.prev.escort); }, '', 'escort'],
      ['ช่วยเหลือ', 110, function (c) { return num(c.assist, c.prev.assist); }, '', 'assist'],
      ['คะแนน', 130, function (c) { return num(Math.round((+c.score || 0) * 10) / 10, c.prev.score, c.rank ? 'อันดับ ' + c.rank + '/' + b.ranked : ''); }, '', 'score'],
      ['ต่อผลัด', 104, function (c) { return num(c.perShift); }, '', 'perShift']];
    var hr = ab('ct-row ct-head', 0, 0, 1828, headH); COLS.forEach(function (k) { add(hr, h('div', { class: 'ct-c', style: 'width:' + k[1] + 'px', text: k[0] })); }); add(T, hr);
    var zoneStart = 0;
    cars.forEach(function (c, i) {
      var y = headH + i * rh, row = ab('ct-row', 0, y, 1828, rh, (i % 2 ? 'background:#f8fafc;' : '') + (i && +cars[i - 1].zone !== +c.zone ? 'border-top:2px solid #c9d5e6' : ''));
      COLS.forEach(function (k, j) { var cell = h('div', { class: 'ct-c' + (k[3] === 'l' ? ' l' : ''), style: 'width:' + k[1] + 'px;' + (k[4] ? heat(k[4], +c[k[4]] || 0) : '') }); if (j && k[2]) k[2](c).forEach(function (x) { add(cell, x); }); add(row, cell); });
      add(T, row);
      if (i === cars.length - 1 || +cars[i + 1].zone !== +c.zone) { // ช่องเขต (รวมแถวของเขตเดียวกัน)
        var zs = (d.zones || []).filter(function (z) { return +z.zone === +c.zone; })[0], zc = ab('ct-zone', 0, headH + zoneStart * rh, 84, (i - zoneStart + 1) * rh, (zoneStart ? 'border-top:2px solid #c9d5e6' : ''));
        add(zc, h('b', { text: c.zone ? 'เขต ' + c.zone : '-' }), zs ? h('span', { text: String(zs.name).replace(/^เขต\s*\d+\s*/, '') }) : null); add(T, zc);
        zoneStart = i + 1;
      }
    });
    // รวมทั้งสถานี (ยอดสถานีตามรายงาน ไม่นับคดีร่วมซ้ำ) — เฉพาะหน้าสุดท้าย
    var t = d.total, sc = all.reduce(function (s, c) { return s + (+c.score || 0); }, 0), shs = all.reduce(function (s, c) { return s + c.shifts; }, 0);
    if (!last) { var ft0 = ab('d-note', 46, 222 + tblH + 16, 1828, null, 'font-size:21px'); ft0.textContent = 'ต่อหน้าถัดไป · ▲▼ เทียบ' + prevLabel(b.prev); add(st, ft0); return markZeros(st); }
    var tr = ab('ct-row ct-tot', 0, headH + cars.length * rh, 1828, totH), TOT = [[h('b', { text: 'รวมทั้งสถานี' })], null, [h('b', { text: fmtN(shs) })], [h('small', { text: all.length + ' คัน' })],
      [h('b', { text: fmtN(t.arrest) }), h('small', { text: 'หมายจับ ' + t.arrestWarrant + ' · ซึ่งหน้า ' + t.arrestFlag })], [h('div', { class: 't', style: 'font-size:17px;max-height:' + (totH - 6) + 'px', text: crimeText(d.byCrime) || '-' })],
      [h('b', { text: fmtN(t.ticket) })], [h('b', { text: fmtN(t.escort) })], [h('b', { text: fmtN(t.assist) })],
      [h('b', { text: fmtN(Math.round(sc * 10) / 10) })], [h('b', { text: shs ? fmtN(Math.round(sc / shs * 10) / 10) : '0' })]];
    COLS.forEach(function (k, j) { if (j === 1) return; var w = j === 0 ? k[1] + COLS[1][1] : k[1], cell = h('div', { class: 'ct-c' + (COLS[j][3] === 'l' || j === 0 ? ' l' : ''), style: 'width:' + w + 'px' }); (TOT[j] || []).forEach(function (x) { add(cell, x); }); add(tr, cell); });
    add(T, tr);
    var ft = ab('d-note', 46, 222 + tblH + 16, 1828, null, 'font-size:21px;white-space:normal');
    ft.textContent = '▲▼ เทียบ' + prevLabel(b.prev) + ' · อาญา: ซึ่งหน้านับเป็นราย หมายจับนับเป็นหมาย · คดีจับร่วมนับให้ทุกคันที่ร่วม (ยอดรวมสถานีนับครั้งเดียว) · คะแนนคดีร่วม: รถผู้จับหลัก ' + fmtN(primaryPctOf(b)) + '% รถร่วมแบ่ง ' + fmtN(100 - primaryPctOf(b)) + '% · ต่อผลัด = คะแนน ÷ ผลัดที่ออก · (ตัวเลข) หลังชื่อ = จำนวนผลัดที่ขึ้นรถคันนั้น';
    add(st, ft);
    return markZeros(st);
  }
  /** ภาพรายการคดีอาญา/ตรวจยึด — 16:9 แบ่งหน้าละ 9 คดี → [node, ...] · ไม่มีข้อมูลผู้ต้องหา */
  function dashCases(d) {
    var all = d.board.cases, rh = 70, top = 296, headH = 56, per = Math.floor((1080 - top - headH - 90) / rh), pages = pager(all, function () { return 1; }, per);
    return pages.map(function (cs, pi) { return dashCasesPage(d, all, cs, pi, pages.length, rh, top, headH); });
  }
  function dashCasesPage(d, all, cs, pi, np, rh, top, headH) {
    var st = ab('dsh', 0, 0, 1920, 1080); st.setAttribute('data-h', 1080);
    add(st, header(d));
    var tt = ab('d-title', 46, 140, 1600, null, 'font-size:52px'); tt.textContent = 'รายละเอียดคดีอาญาและของกลาง ' + dashTitle(d.from, d.to, false, d._kind).replace(/^ผลการปฏิบัติงาน/, ''); add(st, tt);
    pageTag(st, pi + 1, np);
    var nW = all.filter(function (c) { return c.kind === 'หมายจับ'; }).length, nF = all.filter(function (c) { return c.kind === 'ซึ่งหน้า'; }).length, nS = all.length - nW - nF;
    var sumL = ab('d-note', 46, 226, 1700, null, 'font-size:27px;color:#334155;overflow:hidden;text-overflow:ellipsis');
    sumL.textContent = 'รวม ' + all.length + ' คดี · หมายจับ ' + nW + ' · ซึ่งหน้า ' + nF + (nS ? ' · ตรวจยึด ' + nS : '') + '   |   ยอดจับกุมนับในสถิติ ' + fmtN(d.total.arrest) + (d.total.arrestWarrant ? ' (ซึ่งหน้า ' + fmtN(d.total.arrestFlag) + ' ราย · หมายจับ ' + fmtN(d.total.arrestWarrant) + ' หมาย ' + fmtN(d.total.warrantPersons || 0) + ' ราย)' : ' ราย') + (d.evidence.length ? '   |   ของกลาง: ' + d.evidence.map(function (x) { return x.item + ' ' + fmtN(x.qty) + ' ' + x.unit; }).join(', ') : '');
    add(st, sumL);
    var COLS = [['#', 56], ['วัน เวลา', 168], ['รถ', 206], ['ประเภท', 130], ['ฐานความผิด', 300], ['เรื่อง / ข้อหา', 580], ['ผู้ต้องหา', 112], ['ของกลาง', 276]];
    var T = ab('d-card ct', 46, top, 1828, headH + cs.length * rh); add(st, T);
    var hr = ab('ct-row ct-head', 0, 0, 1828, headH); COLS.forEach(function (k) { add(hr, h('div', { class: 'ct-c', style: 'width:' + k[1] + 'px', text: k[0] })); }); add(T, hr);
    var PILL = { 'หมายจับ': 'background:#0f2744;color:#fff', 'ซึ่งหน้า': 'background:#f59e0b;color:#0f2744', 'ตรวจยึด': 'background:#0d9488;color:#fff' };
    var base = all.indexOf(cs[0]);
    cs.forEach(function (c, i) {
      var row = ab('ct-row', 0, headH + i * rh, 1828, rh, i % 2 ? 'background:#f8fafc' : ''), sameT = !c.offense || c.title.indexOf(c.offense.replace(/…$/, '')) >= 0;
      var cells = [
        [h('b', { style: 'font-size:22px', text: String(base + i + 1) })],
        [h('b', { style: 'font-size:24px', text: thD(c.date) }), c.time ? h('small', { text: c.time.replace(':', '.') + ' น.' }) : null],
        [c.cars.length > 3 ? h('div', { class: 't', style: 'font-size:17px;font-weight:700;color:#0f2744;text-align:center;max-height:' + (rh - 26) + 'px', text: c.cars.join(' · ') }) : h('b', { style: 'font-size:' + (c.cars.length > 2 ? 20 : 24) + 'px', text: c.cars.join(' · ') || '-' }), h('small', { text: c.joint ? 'จับร่วม ' + c.cars.length + ' คัน' : c.zone ? 'เขต ' + c.zone : '' })],
        [h('span', { class: 'pill', style: PILL[c.kind] || PILL['ซึ่งหน้า'], text: c.kind })],
        [h('div', { class: 't', style: 'font-size:20px;font-weight:600;color:#0f2744;max-height:' + (rh - 8) + 'px', text: c.label })],
        [h('div', { class: 't', style: 'font-size:20px;max-height:' + (sameT ? rh - 8 : 52) + 'px', text: c.title || '-' }), sameT ? null : h('small', { style: 'font-size:16px;white-space:nowrap;overflow:hidden;max-width:560px', text: 'ข้อหา: ' + c.offense })],
        c.kind === 'ตรวจยึด' ? [h('span', { class: 'muted', text: '-' })] : [h('b', { style: 'font-size:22px', text: c.suspects + ' ราย' }), c.warrants ? h('small', { text: c.warrants + ' หมาย' }) : null],
        [h('div', { class: 't', style: 'font-size:18px;max-height:' + (rh - 8) + 'px', text: c.evidence.map(function (x) { return x.item + ' ' + fmtN(x.qty) + ' ' + x.unit; }).join(' · ') || '-' })]];
      COLS.forEach(function (k, j) { var cell = h('div', { class: 'ct-c' + (j === 4 || j === 5 || j === 7 ? ' l' : ''), style: 'width:' + k[1] + 'px' }); cells[j].forEach(function (x) { if (x) add(cell, x); }); add(row, cell); });
      add(T, row);
    });
    var ft = ab('d-note', 46, top + headH + cs.length * rh + 18, 1828, null, 'font-size:21px;white-space:normal');
    ft.textContent = 'ไม่แสดงชื่อ/ข้อมูลส่วนบุคคลของผู้ต้องหา · คดีที่หลายคันรายงานร่วมกันแสดงเป็นแถวเดียว · "ไม่ระบุข้อหา" = รายการที่นำเข้าจากสถิติโดยไม่มีรายละเอียด (แก้ไขได้ที่เมนูคดีจับกุม)';
    add(st, ft);
    return markZeros(st);
  }
  function dashFont() {
    if (!document.getElementById('font-prompt')) document.head.appendChild(h('link', { id: 'font-prompt', rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Prompt:wght@400;500;600;700&display=swap' }));
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    var p = Promise.all(['400 30px Prompt', '600 30px Prompt', '700 60px Prompt'].map(function (f) { return document.fonts.load(f, 'กขค 0123'); }));
    return Promise.race([p, new Promise(function (r) { setTimeout(r, 5000); })]);
  }
  function loadImg(img) { return img.complete && img.naturalWidth ? Promise.resolve() : new Promise(function (r) { img.onload = img.onerror = function () { r(); }; setTimeout(r, 4000); }); }
  function captureDash(node) {
    var H = +node.getAttribute('data-h') || 1080;
    function run() {
      return Promise.all([].slice.call(node.querySelectorAll('img')).map(loadImg)).then(function () {
        return window.html2canvas(node, { backgroundColor: '#eef2f7', scale: 1, width: 1920, height: H, windowWidth: 1920, windowHeight: H, useCORS: true, logging: false,
          // เอกสารสำเนาที่ใช้วาดต้องโหลดฟอนต์ให้เสร็จก่อน ไม่เช่นนั้นตำแหน่งตัวอักษรไทยจะเพี้ยน (มีช่องว่างแทรก)
          onclone: function (doc) {
            if (!doc.fonts || !doc.fonts.load) return;
            var ps = ['400 30px Prompt', '500 30px Prompt', '600 30px Prompt', '700 60px Prompt'].map(function (f) { return doc.fonts.load(f, 'กขคงจ ปฏิบัติ 0123'); });
            return Promise.race([Promise.all(ps).then(function () { return doc.fonts.ready; }), new Promise(function (r) { setTimeout(r, 5000); })]).then(function () { return new Promise(function (r) { setTimeout(r, 120); }); });
          } });
      }).then(function (cv) { return cv.toDataURL('image/png').split(',')[1]; });
    }
    if (window.html2canvas) return run();
    return new Promise(function (res, rej) { var sc = h('script', { src: 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js' }); sc.onload = res; sc.onerror = function () { rej(new Error('โหลดตัวสร้างรูปไม่ได้ กรุณาตรวจสัญญาณ')); }; document.head.appendChild(sc); }).then(run);
  }
  /** ส่งหลายข้อความ (ภาพ + ข้อความ) เข้าห้องแชท: ในกลุ่มส่งตรง · นอกกลุ่มให้เลือกห้อง */
  function sendToChat(msgs, fallbackText) {
    var ctx = window.liff && liff.getContext ? liff.getContext() : null, inGroup = ctx && (ctx.type === 'group' || ctx.type === 'room');
    var chunks = []; for (var i = 0; i < msgs.length; i += 5) chunks.push(msgs.slice(i, i + 5)); // LINE รับได้ครั้งละ 5 ข้อความ
    function seq(fn) { return chunks.reduce(function (p, c, k) { return p.then(function (r) { return r === 'cancel' || r === null ? r : fn(c, k); }); }, Promise.resolve('start')); }
    var p = inGroup && liff.isInClient && liff.isInClient() ? seq(function (c) { return liff.sendMessages(c).then(function () { return 'sent'; }, function () { return null; }); }) : Promise.resolve(null);
    return p.then(function (r) {
      if (r) return r;
      if (window.liff && liff.isApiAvailable && liff.isApiAvailable('shareTargetPicker')) return seq(function (c, k) {
        if (k) toast('เลือกห้องเดิมอีกครั้ง เพื่อส่งชุดที่ ' + (k + 1) + '/' + chunks.length, 5000);
        return liff.shareTargetPicker(c).then(function (x) { return x ? 'shared' : 'cancel'; }, function () { return copyText(fallbackText).then(function () { return 'copied'; }); });
      });
      return copyText(fallbackText).then(function () { return 'copied'; });
    });
  }
  function dashPicker(onChange) {
    var t = today(), sel = 'month', ym = t.slice(0, 7), months = [];
    for (var i = 0, y0 = +t.slice(0, 4), m0 = +t.slice(5, 7); i < 12; i++) { months.push(y0 + '-' + pad(m0)); if (--m0 < 1) { m0 = 12; y0--; } }
    var row1 = h('div', { class: 'chips' }), row2 = h('div', { class: 'chips', style: 'margin-top:8px' });
    var msel = h('select', { style: 'margin-top:8px', onchange: function () { ym = msel.value; pick(sel === 'day' || sel === 'yday' || sel === 'custom' ? 'month' : sel); } });
    months.forEach(function (m) { add(msel, h('option', { value: m, text: TH_MF[+m.slice(5) - 1] + ' ' + (+m.slice(0, 4) + 543) })); });
    var f = h('input', { type: 'date' }), to = h('input', { type: 'date' }), custom = h('div', { class: 'row', hidden: true, style: 'margin-top:8px' }, f, to);
    function clamp(x) { return x > t ? t : x; }
    function range(k) {
      var a = ym + '-01', e = lastDay(a);
      if (k === 'day') return [t, t];
      if (k === 'yday') return [addDays(t, -1), addDays(t, -1)];
      if (k === 'month') return [a, clamp(e)];
      if (k === 'c1') return [a, clamp(ym + '-10')];
      if (k === 'c2') return [ym + '-11', clamp(ym + '-20')];
      if (k === 'c3') return [ym + '-21', clamp(e)];
      return null;
    }
    function pick(k) {
      sel = k; custom.hidden = k !== 'custom'; render();
      if (k === 'custom') { if (f.value && to.value) onChange(f.value, to.value, 'custom'); return; }
      var r = range(k); if (r[0] > t) { toast('ช่วงนี้ยังไม่ถึง'); return; } onChange(r[0], r[1], k);
    }
    function chip(row, k, label) { add(row, h('button', { class: 'chip' + (sel === k ? ' on' : ''), onclick: function () { pick(k); }, text: label })); }
    function render() {
      clear(row1); clear(row2);
      chip(row1, 'yday', 'เมื่อวาน'); chip(row1, 'day', 'วันนี้'); chip(row1, 'custom', 'กำหนดเอง');
      chip(row2, 'month', 'ทั้งเดือน'); chip(row2, 'c1', 'วงรอบ 1–10'); chip(row2, 'c2', '11–20'); chip(row2, 'c3', '21–สิ้นเดือน');
    }
    f.onchange = to.onchange = function () { if (f.value && to.value) onChange(f.value <= to.value ? f.value : to.value, f.value <= to.value ? to.value : f.value, 'custom'); };
    render(); setTimeout(function () { pick('month'); }, 0);
    return h('div', { class: 'card' }, row1, custom, h('div', { class: 'section-label', style: 'margin:10px 0 0', text: 'รายเดือน / รายวงรอบ' }), msel, row2);
  }
  VIEWS.dash = function () {
    setTitle('📊 ภาพรายงานผู้บังคับบัญชา', 'เลือกช่วง → ดูตัวอย่าง → ส่งภาพ + ข้อความเข้าไลน์');
    clear($app); dashFont();
    var data = null, layout = 'compact', out = h('div'), seq = 0;
    var lchips = h('div', { class: 'chips' });
    function lr() { clear(lchips); [['compact', 'แบบสรุป'], ['full', 'แบบละเอียด']].forEach(function (x) { add(lchips, h('button', { class: 'chip' + (layout === x[0] ? ' on' : ''), onclick: function () { layout = x[0]; lr(); draw(); }, text: x[1] })); }); }
    lr();
    add($app, dashPicker(load), h('div', { class: 'card' }, h('div', { class: 'section-label', style: 'margin:0 0 6px', text: 'รูปแบบภาพหลัก' }), lchips,
      info('ส่งครั้งเดียวได้ครบ: ภาพหลัก + ตารางรายรถ (ผลัด เจ้าหน้าที่ อาญา จราจร ว.42 ช่วยเหลือ คะแนน เทียบรอบก่อน) + สัดส่วนภารกิจรายรถ + รายการคดีอาญา + ข้อความรายงาน')), out);
    function range() { return data.from + (data.to !== data.from ? '_' + data.to : ''); }
    /** ภาพที่ส่ง (ทุกภาพ 1920×1080): ภาพหลัก → ตารางรายรถ → สัดส่วนภารกิจรายรถ → รายการคดี (ถ้ามีคดี) — ชนิดที่ยาวแบ่งเป็นหลายหน้า */
    var PAGE_LABEL = { main: 'ภาพหลัก', cars: 'ตารางรายรถ', mix: 'สัดส่วนภารกิจรายรถ', cases: 'รายการคดีอาญา' };
    function pages() {
      var a = [{ key: 'main', name: 'Dashboard ' + range() + (layout === 'full' ? ' ละเอียด' : '') + '.png', node: layout === 'full' ? dashFull(data) : dashCompact(data) }];
      function push(key, name, nodes) { nodes.forEach(function (nd, i) { a.push({ key: key, name: name + ' ' + range() + (nodes.length > 1 ? ' (' + (i + 1) + ')' : '') + '.png', node: nd, pg: nodes.length > 1 ? (i + 1) + '/' + nodes.length : '' }); }); }
      if (data.board) {
        push('cars', 'รายรถ', dashCars(data));
        if (data.board.mix && Object.keys(data.board.mix).length) push('mix', 'สัดส่วนภารกิจ', dashMix(data));
        if (data.board.cases.length) push('cases', 'คดีอาญา', dashCases(data));
      }
      return a;
    }
    function load(a, b, kind) {
      var my = ++seq; clear(out); add(out, h('div', { class: 'loading' }, spinner(), h('p', { text: 'กำลังรวมผล ' + th(a) + (a !== b ? ' – ' + th(b) : '') + '…' })));
      api('dash', { from: a, to: b }).then(function (d) { if (my !== seq) return; d._kind = kind; data = d; draw(); }, function (e) { if (my === seq) { clear(out); add(out, errorBox(e.message)); } });
    }
    function draw() {
      if (!data) return;
      clear(out);
      var ps = pages(), fits = [];
      ps.forEach(function (pg, i) {
        var H = +pg.node.getAttribute('data-h') || 1080, wrap = h('div', { class: 'dsh-wrap' }); add(wrap, pg.node);
        if (ps.length > 1) add(out, h('div', { class: 'section-label', style: 'margin:4px 2px 6px', text: 'ภาพที่ ' + (i + 1) + ' · ' + PAGE_LABEL[pg.key] + (pg.key === 'cases' ? ' (' + data.board.cases.length + ' คดี)' : '') + (pg.pg ? ' · หน้า ' + pg.pg : '') }));
        add(out, wrap);
        fits.push(function () { var sc = wrap.clientWidth / 1920; pg.node.style.transform = 'scale(' + sc + ')'; wrap.style.height = Math.ceil(H * sc) + 'px'; });
      });
      function fit() { fits.forEach(function (f) { f(); }); }
      fit(); setTimeout(fit, 50); window.onresize = fit;
      var res = h('div');
      add(out, h('div', { class: 'card' },
        submitBtn('📤 ส่งภาพ ' + ps.length + ' ภาพ + ข้อความรายงานเข้าไลน์', 'green block', function () { return make().then(function (rs) {
          var msgs = rs.map(function (r) { return { type: 'image', originalContentUrl: r.direct, previewImageUrl: r.direct }; });
          msgs.push({ type: 'text', text: data.text.slice(0, 4900) });
          return sendToChat(msgs, data.text).then(function (x) {
            toast(x === 'sent' ? '✅ ส่งเข้ากลุ่มแล้ว' : x === 'shared' ? '✅ ส่งแล้ว' : x === 'cancel' ? 'ยกเลิก' : '📋 คัดลอกข้อความแล้ว — เปิดลิงก์รูปเพื่อบันทึก');
            showFiles(rs);
          });
        }); }),
        h('div', { class: 'row', style: 'margin-top:8px' },
          submitBtn('🖼 บันทึกรูป', 'ghost grow', function () { return make().then(function (rs) { showFiles(rs); rs.forEach(function (r) { if (r.b64) downloadB64(r.b64, r.name, 'image/png'); }); }); }),
          h('button', { class: 'btn ghost grow', onclick: function () { copyText(data.text).then(function () { toast('📋 คัดลอกข้อความแล้ว'); }); }, text: '📋 คัดลอกข้อความ' })),
        h('div', { style: 'margin-top:8px' }, xlBtn('ตารางเป็น .xlsx', function () { dashXlsx(data); })),
        res));
      add(out, card('ข้อความรายงาน (ส่งคู่กับภาพ)'), h('div', { class: 'msg-preview', text: data.text }));
      var made = null;
      /** ถ่ายภาพทีละหน้า → เก็บใน Drive ของสถานี */
      function make() {
        var key = layout + data.from + data.to;
        if (made && made.key === key) return Promise.resolve(made.list);
        var list = [], todo = pages();
        function next(i) {
          if (i >= todo.length) { made = { key: key, list: list }; return Promise.resolve(list); }
          var pg = todo[i], H = +pg.node.getAttribute('data-h') || 1080;
          toast('กำลังสร้างภาพที่ ' + (i + 1) + '/' + todo.length + '…', 8000);
          var off = h('div', { style: 'position:fixed;left:-30000px;top:0;width:1920px;height:' + H + 'px;overflow:hidden' }); add(off, pg.node); document.body.appendChild(off);
          return dashFont().then(function () { return captureDash(pg.node); }).then(function (b64) {
            off.remove(); toast('กำลังบันทึกภาพที่ ' + (i + 1) + '/' + todo.length + ' ไว้ใน Drive ของสถานี…', 8000);
            return api('dash.image', { base64: b64, name: pg.name }).then(function (r) { r.b64 = b64; r.name = pg.name; list.push(r); return next(i + 1); });
          }, function (e) { off.remove(); throw e; });
        }
        return next(0);
      }
      function showFiles(rs) {
        clear(res);
        rs.forEach(function (r, i) { add(res, h('div', { class: 'row', style: 'margin-top:8px' }, h('button', { class: 'btn ghost sm grow', onclick: function () { openExternal(r.url); }, text: '🔗 ภาพที่ ' + (i + 1) + ' ใน Drive' }), h('button', { class: 'btn ghost sm grow', onclick: function () { copyText(r.url).then(function () { toast('📋 คัดลอกลิงก์แล้ว'); }); }, text: '📋 ลิงก์ภาพที่ ' + (i + 1) }))); });
      }
    }
  };

  // ======================= ภาพสรุปผลการปฏิบัติประจำวัน (v1.14: 16:9 โทนเดียวกับภาพวงรอบ · ไม่ใช้คะแนน) =======================
  // ภาพที่ 1 = การ์ดตัวเลขหลัก 5 ใบ (เทียบเมื่อวาน + สะสมวงรอบ) + ของกลาง + แท่งผลงานรายรถแยกเขต + แยกเขตตรวจ
  // ภาพที่ 2.. = รายละเอียดรายรถ (ข้อหาใบสั่ง คดี ขบวน จุดช่วยเหลือ ภารกิจ) แบ่งหน้าเท่า 16:9
  var DY_COLS = [['T', 'พ.ร.บ.', 'ขนส่ง', 'tk'], ['C', 'พ.ร.บ.', 'รถยนต์', 'tk'], ['R', 'พ.ร.บ.', 'จราจร', 'tk'],
    ['assist', 'ช่วย', 'เหลือ', 'as'], ['warrant', 'หมาย', 'จับ', 'ar'], ['crime', 'อาญา', 'ทั่วไป', 'ar'], ['escort', 'ว.42', '', 'es'], ['mission', 'ภารกิจ', '', 'mi']];
  var TH_WDF = ['วันอาทิตย์', 'วันจันทร์', 'วันอังคาร', 'วันพุธ', 'วันพฤหัสบดี', 'วันศุกร์', 'วันเสาร์'];
  function thLong(iso) { var p = iso.split('-'); return TH_WDF[new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])).getUTCDay()] + 'ที่ ' + (+p[2]) + ' ' + TH_MF[+p[1] - 1] + ' ' + (+p[0] + 543); }
  function dailyXlsx(d) {
    var head = ['เขต', 'รถ', 'ผลัด', 'เจ้าหน้าที่'].concat(DY_COLS.map(function (c) { return (c[1] + ' ' + (c[2] || '')).trim(); })).concat(['รวม', 'หมายเหตุ', 'สะสมวงรอบ', 'ผลัดในวงรอบ']);
    var nums = function (n) { return DY_COLS.map(function (c) { return n[c[0]] || 0; }).concat([n.total || 0]); };
    var rows = d.rows.map(function (r) { var m = (d.ctd || {})[r.car] || { total: 0, shifts: 0 };
      return [r.zone || '', r.car, r.carry ? 'คืนก่อน (หลังเที่ยงคืน)' : r.shift === 'D' ? 'กลางวัน' : 'กลางคืน', r.crew.join(', ')].concat(nums(r.n)).concat([r.notes.map(function (x) { return x.text || x; }).join(' / '), m.total, m.shifts]); });
    if (d.loose && d.loose.length) rows.push(['', 'ภารกิจ (ไม่ระบุรถ)', '', ''].concat(nums(d.looseN)).concat([d.loose.map(function (x) { return x.text || x; }).join(' / '), '', '']));
    rows.push(['รวมทั้งสถานี', '', '', ''].concat(nums(d.total)).concat(['', '', '']));
    rows.push(['เมื่อวาน', '', '', ''].concat(nums(d.yesterday)).concat(['', '', '']));
    rows.push(['สะสมวงรอบ ' + th(d.cycleFrom) + '–' + th(d.date), '', '', ''].concat(nums(d.cycle)).concat(['', '', '']));
    xlsxDownload('ผลการปฏิบัติประจำวัน_' + d.date + '.xlsx', [{ name: 'ผลประจำวัน', title: 'ผลการปฏิบัติประจำวัน ' + th(d.date) + ' — ' + S.boot.station, head: head, rows: rows },
      { name: 'ข้อความรายงาน', head: ['ข้อความ'], rows: d.text.split('\n').map(function (l) { return [l]; }) }], [['วันที่', th(d.date)]]);
  }
  function dyTickets(n) { return (n.T || 0) + (n.C || 0) + (n.R || 0); }
  /** ภาพรายงานผู้บังคับบัญชา → .xlsx: ตารางรายรถ + รายการคดี + ข้อความ */
  function dashXlsx(d) {
    var b = d.board || { cars: [], cases: [] }, rg = th(d.from) + (d.to !== d.from ? '–' + th(d.to) : '');
    var cars = (b.cars || []).map(function (c) { return [c.zone || '', c.car, c.shifts || 0, c.D || 0, c.N || 0, (c.crew || []).map(function (m) { return m.name + ' (' + m.n + ')'; }).join(', '), c.arrest || 0, c.warrant || 0, c.flag || 0,
      (c.crimes || []).map(function (x) { return x.label + ' ' + x.n; }).join(', '), c.ticket || 0, c.T || 0, c.C || 0, c.R || 0, c.escort || 0, c.assist || 0, Math.round((+c.score || 0) * 10) / 10, c.rank || '']; });
    var cases = (b.cases || []).map(function (c) { return [c.date, c.time || '', c.cars.join(', '), c.kind, c.label, c.title || '', c.kind === 'ตรวจยึด' ? '' : c.suspects, c.warrants || '', c.evidence.map(function (x) { return x.item + ' ' + x.qty + ' ' + x.unit; }).join(', ')]; });
    xlsxDownload('รายงานผู้บังคับบัญชา_' + d.from + (d.to !== d.from ? '_' + d.to : '') + '.xlsx', [
      { name: 'รายรถ', title: 'ผลการปฏิบัติแยกรายรถ ' + rg, head: ['เขต', 'รถ', 'ผลัดที่ออก', 'กลางวัน', 'กลางคืน', 'เจ้าหน้าที่ (ผลัด)', 'อาญา', 'หมายจับ', 'ซึ่งหน้า', 'ฐานความผิด', 'จราจร', 'ขส', 'รย', 'จร', 'ว.42', 'ช่วยเหลือ', 'คะแนน', 'อันดับ'], rows: cars },
      { name: 'คดีอาญา', head: ['วันที่', 'เวลา', 'รถ', 'ประเภท', 'ฐานความผิด', 'เรื่อง', 'ผู้ต้องหา (ราย)', 'หมาย', 'ของกลาง'], rows: cases },
      { name: 'ข้อความรายงาน', head: ['ข้อความ'], rows: String(d.text || '').split('\n').map(function (l) { return [l]; }) }], [['ช่วง', rg]]);
  }
  /** หมวดงานในภาพประจำวัน: [key, ชื่อ, หน่วย, สี, ค่าจาก n, บรรทัดย่อยจาก n] */
  var DY_CATS = [
    ['ticket', 'ใบสั่ง', 'ราย', CAT.ticket, dyTickets, function (n) { return 'ขส ' + fmtN(n.T || 0) + ' · รย ' + fmtN(n.C || 0) + ' · จร ' + fmtN(n.R || 0); }],
    ['arrest', 'จับกุม', 'ราย/หมาย', CAT.arrest, function (n) { return (n.warrant || 0) + (n.crime || 0); }, function (n) { return 'หมายจับ ' + fmtN(n.warrant || 0) + ' · อาญา ' + fmtN(n.crime || 0); }],
    ['escort', 'ว.42', 'ขบวน', CAT.escort, function (n) { return n.escort || 0; }, function () { return 'นำขบวน'; }],
    ['assist', 'ช่วยเหลือ', 'ครั้ง', CAT.assist, function (n) { return n.assist || 0; }, function () { return 'ช่วยเหลือประชาชน/เหตุการณ์'; }],
    ['mission', 'ภารกิจ', 'ครั้ง', CAT.mission, function (n) { return n.mission || 0; }, function () { return 'ภารกิจ/จิตอาสา'; }]];
  /** แบ่งรายการเป็นหน้า: hOf(item) = ความสูง, avail = ความสูงที่ใช้ได้ต่อหน้า */
  function pager(items, hOf, avail) {
    var pages = [[]], used = 0;
    items.forEach(function (it) { var hh = hOf(it); if (used + hh > avail && pages[pages.length - 1].length) { pages.push([]); used = 0; } pages[pages.length - 1].push(it); used += hh; });
    return pages;
  }
  /** ป้าย "หน้า i/N" มุมขวาบนของภาพ (เฉพาะเมื่อมีหลายหน้า) */
  function pageTag(st, i, n) { if (n > 1) { var p = ab('d-page', 0, 166, null, null, 'right:48px;left:auto'); p.textContent = 'หน้า ' + i + '/' + n; add(st, p); } return st; }
  function dyRowsOf(d, opt) {
    var rows = (d.rows || []).map(function (r) { return { car: r.car, zone: +r.zone || 0, shift: r.shift, carry: r.carry, extra: r.extra, crew: r.crew || [], n: r.n, notes: r.notes || [], me: !!(opt && opt.me && (r.pids || []).indexOf(opt.me) >= 0) }; });
    if (d.loose && d.loose.length) rows.push({ car: '', label: 'ภารกิจ (ไม่ระบุรถ)', zone: 0, shift: '', crew: [], n: d.looseN, notes: d.loose, loose: true });
    return rows;
  }
  /** ภาพประจำวันแผ่นเดียว 1920×1080 — โครงเดียวกับภาพวงรอบ (แบบสรุป): จับกุมคดีอาญา | ใบสั่งจราจร · ว.42/ช่วยเหลือ/ภารกิจ | ของกลาง | รายการ · ผลงานรายรถ | แยกเขตตรวจ — opt.me = เน้นแถวของฉัน (เฉพาะในแอป) */
  function dailyMain(d, opt) {
    opt = opt || {};
    var st = ab('dsh dy', 0, 0, 1920, 1080); st.setAttribute('data-h', 1080);
    add(st, header(d));
    var cyc = th(d.cycleFrom).replace(/\s.*$/, '') + '–' + th(d.date), t = d.total, y = d.yesterday, c = d.cycle, rows = dyRowsOf(d, opt);
    var tt = ab('d-title', 46, 140, 1500, null, 'font-size:52px'); tt.textContent = 'ผลการปฏิบัติประจำวัน · ' + thLong(d.date); add(st, tt);
    var pn = ab('d-note', 0, 160, 0, null, 'right:48px;left:auto;font-size:25px;text-align:right');
    pn.textContent = d.final ? 'สะสมวงรอบ ' + cyc : 'ข้อมูล ณ ' + hm(d.now) + ' น. (ผลัดกลางคืนยังไม่ครบกำหนดส่งเวร)'; add(st, pn);
    function head(card, title, nt) { var a = ab('d-h2', 24, 18), b = ab('d-note nz', 0, 30, 0, null, 'right:26px;left:auto'); a.textContent = title; b.textContent = nt || ''; add(card, a, b); }
    function cmp(cur, prev, cyc) { var dv = cur - prev; return (dv > 0 ? '▲' + fmtN(dv) : dv < 0 ? '▼' + fmtN(-dv) : '=') + ' เทียบเมื่อวาน ' + fmtN(prev) + ' · วงรอบ ' + fmtN(cyc); }
    function carNote(r) { return r.loose ? '' : r.car + (r.carry ? ' 🌙' : ''); }
    // ---------- 1) จับกุมคดีอาญา: โดนัท หมายจับ/ซึ่งหน้า + ฐานความผิด + รายคดี (ข้อหาแบบย่อ) ----------
    var nA = (t.warrant || 0) + (t.crime || 0), A = ab('d-card', 46, 236, 997, 346); add(st, A); head(A, 'จับกุมคดีอาญา', cmp(nA, (y.warrant || 0) + (y.crime || 0), (c.warrant || 0) + (c.crime || 0)));
    var dn = ab('d-donut', 30, 90, 236, 236); add(dn, donut(236, 34, [{ v: t.warrant || 0, c: CAT.arrest }, { v: t.crime || 0, c: DK.amber }]), h('div', { class: 'd-center' }, h('b', { style: 'font-size:' + bigNum(nA) + 'px', text: fmtN(nA) }), h('span', { style: t.warrant ? 'font-size:23px' : '', text: t.warrant ? 'ราย/หมาย' : 'ราย' }))); add(A, dn);
    var crime = d.crime || {}, x = ab('d-leg', 318, 82, 652, 60); add(x, h('i', { class: 'sq', style: 'background:' + CAT.arrest }), h('span', { class: 'lb', text: 'หมายจับ' }), h('span', { class: 'wd', text: crimeText(crime.warrant) }),
      h('div', { class: 'vu', style: 'width:252px' }, h('b', { class: 'v', text: fmtN(t.warrant || 0) }), h('span', { class: 'un', text: 'หมาย' }))); add(A, x);
    var box = ab('d-flag', 306, 142, 664, 186); add(A, box);
    add(box, h('div', { class: 'fh' }, h('i', { class: 'sq', style: 'background:' + DK.amber }), h('span', { class: 'lb', text: 'ซึ่งหน้า' }), h('small', { text: crimeText(crime.flag) || 'แยกตามฐานความผิด' }), h('div', { class: 'vu', style: 'width:232px' }, h('b', { class: 'v', text: fmtN(t.crime || 0) }), h('span', { class: 'un', text: 'ราย' }))));
    var cases = []; rows.forEach(function (r) { r.notes.forEach(function (n) { if (n.k === 'arrest' || n.k === 'seizure') cases.push({ car: carNote(r), n: n }); }); });
    cases.sort(function (a, b) { return (b.n.kind === 'หมายจับ') - (a.n.kind === 'หมายจับ'); });
    var cl = h('div', { class: 'dy-cases' + (cases.length <= 2 ? ' wrap' : '') }); add(box, cl);
    if (!cases.length) add(cl, h('div', { class: 'muted', style: 'font-size:24px;padding:10px 6px', text: 'ไม่มีการจับกุมในวันนี้' }));
    cases.slice(0, 4).forEach(function (x2) { // รถ · [หมายจับ] ฐานความผิด — ข้อหาแบบย่อ · จำนวน
      var n = x2.n, cat = DASH_CAT[n.cat] || n.cat || '', txt = n.k === 'seizure' ? n.text : (n.kind === 'หมายจับ' ? 'หมายจับ ' : '') + cat + (n.charge && n.charge !== n.cat ? ' — ' + n.charge : '') + ' · ' + fmtN(n.n || 1) + (n.kind === 'หมายจับ' ? ' หมาย' : ' ราย');
      add(cl, h('div', { class: 'dy-case' }, h('b', { text: x2.car }), h('span', { text: txt })));
    });
    if (cases.length > 4) add(cl, h('div', { class: 'dy-case muted', text: '+' + (cases.length - 4) + ' คดี' }));
    // ---------- 2) ใบสั่งจราจร: โดนัทตามข้อหา + รายการข้อหา ----------
    var nB = dyTickets(t), B = ab('d-card', 1073, 236, 802, 346); add(st, B); head(B, 'ใบสั่งจราจร', cmp(nB, dyTickets(y), dyTickets(c)));
    var bk = trafficRows(d);
    var dn2 = ab('d-donut', 34, 82, 226, 226); add(dn2, donut(226, 32, bk.map(function (r, i) { return { v: r[1], c: DASH_PAL[i % 10] }; })), h('div', { class: 'd-center' }, h('b', { style: 'font-size:' + bigNum(nB) + 'px', text: fmtN(nB) }), h('span', { text: 'ราย' })));
    add(B, dn2, ab('d-act', 10, 314, 280, null)); B.lastChild.textContent = 'ขนส่ง ' + fmtN(t.T || 0) + ' · รถยนต์ ' + fmtN(t.C || 0) + (t.R ? ' · จราจร ' + fmtN(t.R) : '');
    var lg = ab('d-list', 318, 70, 456, 272); add(B, lg);
    if (!bk.length) add(lg, h('div', { class: 'muted', style: 'font-size:26px', text: 'ไม่มีการออกใบสั่งในวันนี้' }));
    bk.slice(0, 10).forEach(function (r, i) { add(lg, h('div', { class: 'li' }, h('i', { class: 'dot', style: 'background:' + DASH_PAL[i % 10] }), h('span', { text: r[0] }), h('b', { text: fmtN(r[1]) }))); });
    // ---------- 3) แถบกลาง: ว.42 | ช่วยเหลือ | ภารกิจ  ·  ของกลาง ----------
    var O = ab('d-card sm ow-card three', 46, 592, 660, 80); add(st, O);
    [['ว.42', t.escort || 0, 'ขบวน'], ['ช่วยเหลือ', t.assist || 0, 'ครั้ง'], ['ภารกิจ', t.mission || 0, 'ครั้ง']].forEach(function (k, i) {
      if (i) add(O, h('i', { class: 'sep' }));
      add(O, h('div', { class: 'owb' }, h('span', { class: 'ol', text: k[0] }), h('b', { text: fmtN(k[1]) }), h('span', { text: k[2] })));
    });
    var G = ab('d-card sm ev-card', 718, 592, 536, 80); add(st, G);
    add(G, h('b', { class: 'evh', text: 'ของกลาง' }), evidenceItems(d.evidence || [], 4));
    // ---------- 4) ผลงานรายรถ: แท่งซ้อน 5 หมวด 2 คอลัมน์ + ชื่อเจ้าหน้าที่ ----------
    var Cc = ab('d-card', 46, 684, 1208, 376); add(st, Cc); head(Cc, 'ผลงานรายรถ');
    var lgd = ab('d-legr', 0, 30, 0, null, 'right:24px;left:auto;font-size:20px');
    DY_CATS.forEach(function (k, i) { add(lgd, h('i', { class: 'sq', style: 'width:20px;height:20px;background:' + k[3] + (i ? ';margin-left:16px' : '') }), h('span', { text: k[1] })); }); add(Cc, lgd);
    add(Cc, dyCarBars(rows, d, 30, 72, 1150, 250));
    var wn = ab('d-note sb-wn', 30, 326, 1150, 44); wn.textContent = 'แถบ = จำนวนผลงานแยกหมวด (ตัวเลขในแถบ) · ในแต่ละเขตเรียงผลัดกลางวันก่อนกลางคืน 🌙 = ผลงานหลังเที่ยงคืนของผลัดคืนก่อน · คดีจับร่วมนับให้ทุกคันที่ร่วม (ยอดสถานีนับครั้งเดียว) · ไม่ใช้คะแนน'; add(Cc, wn);
    // ---------- 5) ขวากลาง: รายการ ว.42 · ช่วยเหลือ · ภารกิจ ----------
    var M = ab('d-card', 1270, 592, 605, 300); add(st, M);
    var mt = ab('d-h2', 24, 14, null, null, 'font-size:30px'); mt.textContent = 'ว.42 · ช่วยเหลือ · ภารกิจ'; add(M, mt);
    var items = []; rows.forEach(function (r) { r.notes.forEach(function (n) { if (n.k === 'escort' || n.k === 'assist' || n.k === 'mission') items.push({ car: carNote(r), n: n }); }); });
    var ICO = { escort: ['🚔', CAT.escort], assist: ['🤝', CAT.assist], mission: ['🎖️', CAT.mission] }, il = ab('dy-items', 20, 62, 565, 226); add(M, il);
    if (!items.length) add(il, h('div', { class: 'muted', style: 'font-size:24px;padding:6px', text: 'ไม่มี ว.42 / ช่วยเหลือ / ภารกิจ ในวันนี้' }));
    var maxI = items.length > 7 ? 6 : 7;
    items.slice(0, maxI).forEach(function (x2) { add(il, h('div', { class: 'dy-item' }, h('i', { style: 'background:' + ICO[x2.n.k][1] }), x2.car ? h('b', { text: x2.car }) : null, h('span', { text: String(x2.n.text).replace(/^ว\.42\s+/, '') }))); });
    if (items.length > maxI) add(il, h('div', { class: 'dy-item muted', text: '+' + (items.length - maxI) + ' รายการ' }));
    // ---------- 6) แยกเขตตรวจ (ใบสั่ง · จับกุม) ----------
    var Z = ab('d-card', 1270, 904, 605, 156); add(st, Z);
    var zt = ab('d-h2', 24, 10, null, null, 'font-size:30px'); zt.textContent = 'แยกเขตตรวจ'; add(Z, zt);
    add(Z, ab('d-legr', 0, 16, 0, null, 'right:22px;left:auto;font-size:21px'));
    add(Z.lastChild, h('i', { class: 'sq', style: 'width:18px;height:18px;background:' + CAT.arrest }), h('span', { text: 'จับกุม' }), h('i', { class: 'sq', style: 'width:18px;height:18px;background:' + CAT.ticket + ';margin-left:14px' }), h('span', { text: 'ใบสั่ง' }));
    var zs = (d.zones || []).map(function (z) { var o = { zone: z.zone, name: z.name, ticket: 0, arrest: 0 }; (d.rows || []).forEach(function (r) { if (+r.zone === z.zone) { o.ticket += dyTickets(r.n); o.arrest += (r.n.warrant || 0) + (r.n.crime || 0); } }); return o; });
    add(Z, zoneGrid(zs, 18, 56, 575, 92));
    return markZeros(st);
  }
  /** แท่งผลงานรายรถ 1–2 คอลัมน์ (แบบแท่งคะแนนในภาพวงรอบ): [รถ ผลัด เขต] แถบซ้อน 5 หมวด + รวม · บรรทัดล่าง = เจ้าหน้าที่ */
  function dyCarBars(rows, d, x0, y0, w, hh) {
    var n = rows.length, box = ab('sb dyb', x0, y0, w, hh);
    if (!n) { var e = ab('d-note', 0, 20, w, null); e.textContent = 'ไม่มีรถในตารางเวรและไม่มีรายงานของวันนี้'; add(box, e); return box; }
    var cols = n > 6 ? 2 : 1, per = Math.ceil(n / cols), gap = 36, colW = (w - gap * (cols - 1)) / cols, rh = Math.min(64, hh / per);
    var labW = 150, totW = 56, barW = colW - labW - totW - 12, max = Math.max(1, Math.max.apply(null, rows.map(function (r) { return r.n.total || 0; })));
    var fs = rh < 42 ? 14 : 16, bh = rh < 36 ? 12 : rh < 42 ? 14 : 18, zoneIdx = {}, zi = 0;
    rows.forEach(function (r) { var k = r.loose ? 'x' : r.zone; if (!(k in zoneIdx)) zoneIdx[k] = zi++; });
    rows.forEach(function (r, i) {
      var col = Math.floor(i / per), ri = i % per, x = col * (colW + gap), yy = ri * rh, zk = r.loose ? 'x' : r.zone;
      if (zoneIdx[zk] % 2 === 0) add(box, ab('sb-band', x - 6, yy, colW + 12, rh));
      if (r.me) add(box, ab('dy-mebg', x - 6, yy + 1, colW + 12, rh - 2));
      var lb = ab('sb-lab', x, yy, labW, rh);
      if (r.loose) add(lb, h('b', { style: 'font-size:' + (rh < 36 ? 15 : 17) + 'px;white-space:normal;line-height:1.05', text: 'ไม่ระบุรถ' }));
      else add(lb, h('b', { class: 'cno', style: 'font-size:' + (rh < 36 ? 19 : 22) + 'px', text: r.car }), h('span', { style: 'font-size:' + (rh < 36 ? 15 : 18) + 'px', text: r.carry ? '🌙' : SHIFT[r.shift] ? SHIFT[r.shift].icon : '•' }), h('small', { text: r.zone ? 'เขต ' + r.zone : '' }));
      add(box, lb);
      var top = yy + 3, bx = x + labW, tot = r.n.total || 0;
      if (tot) {
        DY_CATS.forEach(function (k) {
          var v = k[4](r.n); if (!v) return;
          var ww = v / max * barW, seg = ab('dy-seg', bx, top + 1, Math.max(2, ww - 2), bh, 'background:' + k[3] + ';color:' + (darkColor(k[3]) ? '#fff' : DK.navy) + ';font-size:' + (bh < 16 ? 12 : 14) + 'px');
          if (ww >= 24) seg.textContent = fmtN(v);
          add(box, seg); bx += ww;
        });
      } else add(box, ab('dy-seg', bx, top + bh / 2 - 1, barW, 3, 'background:#e2e8f0'));
      var sv2 = ab('sb-v', x + labW + barW + 8, top - 5, totW, bh + 12, 'font-size:' + (fs + 4) + 'px' + (tot ? '' : ';color:#a3adbd')); sv2.textContent = tot ? fmtN(tot) : '–'; add(box, sv2);
      var tx = ab('sb-t', x + labW, top + bh + 3, colW - labW, rh - bh - 7, 'font-size:' + fs + 'px'); tx.textContent = r.loose ? (r.notes[0] ? r.notes[0].text : '') : (r.crew.join(' · ') || '-'); add(box, tx);
    });
    return box;
  }
  /** ทุกภาพของวันนั้น (แผ่นเดียว) */
  function dailyPages(d, opt) { return [{ key: 'main', name: 'สรุปประจำวัน ' + d.date + '.png', node: dailyMain(d, opt) }]; }
  VIEWS.daily = function (params) {
    setTitle('📅 ภาพสรุปผลประจำวัน', 'ส่งให้ผู้บังคับบัญชา');
    clear($app); dashFont();
    var t = today(), sel = params && /^\d{4}-\d{2}-\d{2}$/.test(params.date || '') ? params.date : addDays(t, -1), data = null, seq = 0, made = null;
    var chips = h('div', { class: 'chips' }), dateIn = h('input', { type: 'date', class: 'db-date', max: t, value: sel }), out = h('div');
    function rc() {
      clear(chips);
      [['เมื่อวาน', addDays(t, -1)], ['วันนี้', t]].forEach(function (x) { add(chips, h('button', { class: 'chip' + (sel === x[1] ? ' on' : ''), onclick: function () { sel = x[1]; dateIn.value = sel; rc(); load(); }, text: x[0] })); });
      add(chips, h('label', { class: 'chip db-pick' + (sel !== t && sel !== addDays(t, -1) ? ' on' : '') }, '📅 ', dateIn));
    }
    dateIn.onchange = function () { if (dateIn.value) { sel = dateIn.value; rc(); load(); } };
    rc();
    add($app, h('div', { class: 'card' }, chips), out);
    function load() {
      var my = ++seq; made = null; clear(out); add(out, h('div', { class: 'loading' }, spinner(), h('p', { text: 'กำลังรวมผล ' + th(sel) + '…' })));
      api('daily.report', { date: sel }, { fresh: true }).then(function (d) { if (my !== seq) return; data = d; draw(); }, function (e) { if (my === seq) { clear(out); add(out, errorBox(e.message)); } });
    }
    function draw() {
      clear(out);
      var me = S.boot.me.pid, mine = data.rows.filter(function (r) { return (r.pids || []).indexOf(me) >= 0; });
      if (mine.length) {
        var mc = card('👤 ผลัดของท่าน · ' + th(data.date));
        mine.forEach(function (r) {
          var parts = WK_N.filter(function (x) { return r.n[x[0]]; }).map(function (x) { return x[1] + ' ' + r.n[x[0]]; });
          var bad = r.report.flags.filter(function (f) { return f.lv; });
          add(mc, h('div', { class: 'db-step ' + (bad.some(function (f) { return f.lv === 'miss'; }) ? 'st-late' : bad.length ? 'st-due' : 'st-done') }, h('span', { class: 'db-ic', text: r.carry ? '🌙' : SHIFT[r.shift] ? SHIFT[r.shift].icon : '•' }),
            h('span', { class: 'grow', text: 'รถ ' + r.car + ' · ' + (parts.length ? parts.join(' · ') : 'ไม่มีผล') + (bad.length ? ' — ' + bad.map(function (f) { return f.text; }).join(', ') : '') })));
        });
        add(mc, h('button', { class: 'btn ghost block', style: 'margin-top:8px', onclick: function () { go('me'); }, text: '📈 ผลของฉันสะสม ›' }));
        add(out, mc);
      }
      var ps = dailyPages(data, { me: me }), fits = [];
      ps.forEach(function (pg, i) {
        var wrap = h('div', { class: 'dsh-wrap' }); add(wrap, pg.node);
        add(out, wrap);
        add(wrap, h('button', { class: 'dy-zoom', onclick: function () { openBig(pg); }, text: '🔍 ขยาย' }));
        fits.push(function () { var sc = wrap.clientWidth / 1920; pg.node.style.transform = 'scale(' + sc + ')'; wrap.style.height = Math.ceil(1080 * sc) + 'px'; });
      });
      function fit() { fits.forEach(function (f) { f(); }); }
      fit(); setTimeout(fit, 60); dashFont().then(fit); window.onresize = fit;
      var res = h('div');
      add(out, h('div', { class: 'card' },
        submitBtn('📤 ส่งภาพ' + (ps.length > 1 ? ' ' + ps.length + ' ภาพ' : '') + ' + ข้อความเข้าไลน์', 'green block', function () { return make().then(function (rs) {
          var msgs = rs.map(function (r) { return { type: 'image', originalContentUrl: r.direct, previewImageUrl: r.direct }; });
          msgs.push({ type: 'text', text: data.text.slice(0, 4900) });
          return sendToChat(msgs, data.text).then(function (x) { toast(x === 'sent' ? '✅ ส่งเข้ากลุ่มแล้ว' : x === 'shared' ? '✅ ส่งแล้ว' : x === 'cancel' ? 'ยกเลิก' : '📋 คัดลอกข้อความแล้ว — เปิดลิงก์รูปเพื่อบันทึก'); show(rs); });
        }); }),
        h('div', { class: 'row', style: 'margin-top:8px' },
          submitBtn('🖼 บันทึกรูป', 'ghost grow', function () { return make().then(function (rs) { show(rs); rs.forEach(function (r) { if (r.b64) downloadB64(r.b64, r.name, 'image/png'); }); }); }),
          h('button', { class: 'btn ghost grow', onclick: function () { copyText(data.text).then(function () { toast('📋 คัดลอกข้อความแล้ว'); }); }, text: '📋 คัดลอกข้อความ' })),
        res));
      add(out, h('details', { class: 'note' }, h('summary', { text: 'ℹ️ เกี่ยวกับภาพนี้' }),
        h('div', { text: 'ภาพ 16:9 โทนเดียวกับภาพรายงานวงรอบ · แถบสีเหลือง = ผลัดของท่าน (เฉพาะในแอป ไม่อยู่ในภาพที่ส่ง) · ส่งผ่านการเลือกห้อง LINE ไม่ใช้โควตาข้อความของระบบ · การเข้าเวร/ส่งเวรดูที่ "ย้อนหลัง 7 วัน" ในหน้ารายงาน' })));
      add(out, card('ข้อความรายงาน (ส่งคู่กับภาพ)'), h('div', { class: 'msg-preview', text: data.text }));
      function show(rs) { clear(res); rs.forEach(function (r, i) { add(res, h('div', { class: 'row', style: 'margin-top:8px' }, h('button', { class: 'btn ghost sm grow', onclick: function () { openExternal(r.url); }, text: '🔗 ภาพที่ ' + (i + 1) + ' ใน Drive' }), h('button', { class: 'btn ghost sm grow', onclick: function () { copyText(r.url).then(function () { toast('📋 คัดลอกลิงก์แล้ว'); }); }, text: '📋 ลิงก์ภาพที่ ' + (i + 1) }))); }); }
      function openBig(pg) {
        var n2 = dailyMain(data, { me: me }), inner = h('div', { class: 'dy-big-in' }), b = h('div', { class: 'dy-big' }, inner); add(inner, n2);
        modal('ภาพ ' + th(data.date) + ' — เลื่อนดูได้', b);
        setTimeout(function () { var sc = 0.5; n2.style.transform = 'scale(' + sc + ')'; inner.style.width = Math.ceil(1920 * sc) + 'px'; inner.style.height = Math.ceil(1080 * sc) + 'px'; }, 30);
      }
    }
    /** ถ่ายภาพทุกหน้า (ไม่มีแถบสีของผู้ใช้) → เก็บใน Drive ของสถานี */
    function make() {
      if (made && made.date === data.date) return Promise.resolve(made.list);
      var todo = dailyPages(data, {}), list = [];
      toast('กำลังสร้างภาพ…', 8000);
      function next(i) {
        if (i >= todo.length) { made = { date: data.date, list: list }; return Promise.resolve(list); }
        var pg = todo[i], off = h('div', { style: 'position:fixed;left:-30000px;top:0;width:1920px;height:1080px;overflow:hidden' }); add(off, pg.node); document.body.appendChild(off);
        return dashFont().then(function () { return captureDash(pg.node); }).then(function (b64) {
          off.remove(); toast('กำลังบันทึกภาพที่ ' + (i + 1) + '/' + todo.length + ' ไว้ใน Drive ของสถานี…', 8000);
          return api('dash.image', { base64: b64, name: pg.name }).then(function (r) { r.b64 = b64; r.name = pg.name; list.push(r); return next(i + 1); });
        }, function (e) { off.remove(); throw e; });
      }
      return next(0);
    }
    load();
  };

  // ======================= บุคลากรและสิทธิ์ =======================
  VIEWS.admin = function () {
    setTitle('👥 บุคลากรและสิทธิ์', '');
    loading();
    Promise.all([api('admin.people'), api('admin.meta')]).then(function (r) {
      var people = r[0], meta = r[1];
      clear($app);
      var q = h('input', { placeholder: '🔎 ค้นหาชื่อ/นามเรียกขาน/สายงาน', oninput: render }), roleF = h('select', { onchange: render }, h('option', { value: '', text: 'ทุกบทบาท' }), h('option', { value: 'admin', text: 'แอดมิน/แอดมินสำรอง' }));
      meta.roles.forEach(function (x) { add(roleF, h('option', { value: x.id, text: x.label })); });
      var stF = h('select', { onchange: render }, h('option', { value: 'active', text: 'ใช้งานอยู่' }), h('option', { value: 'unlinked', text: 'ยังไม่ผูก LINE' }), h('option', { value: 'inactive', text: 'ปิดบัญชีแล้ว' }), h('option', { value: '', text: 'ทั้งหมด' }));
      var tagF = h('input', { placeholder: '🏷 กรองแท็ก เช่น ประสานศาล', oninput: render });
      var list = h('div');
      add($app, h('div', { class: 'card' }, q, h('div', { class: 'row', style: 'margin-top:8px' }, h('div', { class: 'grow' }, roleF), h('div', { class: 'grow' }, stF)), h('div', { style: 'margin-top:8px' }, tagF)), list);
      if (can('tags.manage')) add($app.firstChild, h('button', { class: 'btn ghost sm', style: 'margin-top:8px', onclick: tagCatalogView, text: '🏷 คลังแท็กทักษะ (' + (meta.tagCatalog || []).length + ')' }));
      if (meta.isSuper) add($app, h('p', { class: 'muted small', text: 'แต่งตั้งแอดมินสำรอง: แตะชื่อ → "แต่งตั้งเป็นแอดมินสำรอง" (มีได้ 1 คน · ทุกการแก้สิทธิ์/ตั้งค่าของแอดมินสำรองจะแจ้งท่าน)' }));
      /** คลังแท็กกลาง: นับคนต่อแท็ก แตะเพื่อกรองรายชื่อ · เพิ่มแท็ก (ผู้มีสิทธิ์จัดการแท็ก) · เปลี่ยนชื่อ/ลบ (แอดมิน) */
      function tagCatalogView() {
        var box = h('div'), grpSel = h('select'), inp = h('input', { placeholder: 'ชื่อแท็กใหม่', maxlength: '40', enterkeyhint: 'done' });
        (meta.tagGroups || []).forEach(function (g) { add(grpSel, h('option', { value: g.id, text: g.icon + ' ' + g.id, selected: g.id === 'อื่นๆ' })); });
        function count(t) { return people.filter(function (p) { return p.status !== 'inactive' && p.tags.indexOf(t) >= 0; }).length; }
        function after(r, msg) { meta.tagCatalog = r.catalog; toast(msg); draw(); }
        function draw() {
          clear(box);
          (meta.tagGroups || []).forEach(function (g) {
            var items = (meta.tagCatalog || []).filter(function (x) { return x.group === g.id; }); if (!items.length) return;
            add(box, h('div', { class: 'section-label', text: g.icon + ' ' + g.id }));
            items.forEach(function (x) {
              var n = count(x.tag), btns = h('span', { class: 'row', style: 'gap:4px' });
              if (meta.canEditTagCatalog) {
                add(btns, h('button', { class: 'btn ghost sm', type: 'button', text: '✏️', 'aria-label': 'เปลี่ยนชื่อ', onclick: function () {
                  var to = prompt('เปลี่ยนชื่อแท็ก "' + x.tag + '" เป็น' + (n ? ' (แก้ให้ ' + n + ' คนที่ติดแท็กนี้)' : ''), x.tag); if (to == null || !to.trim() || to.trim() === x.tag) return;
                  api('tags.rename', { from: x.tag, to: to.trim(), group: x.group }).then(function (r) { people.forEach(function (p) { var i = p.tags.indexOf(x.tag); if (i >= 0) p.tags[i] = r.tag; }); after(r, '✅ เปลี่ยนชื่อแล้ว' + (r.people ? ' (แก้ ' + r.people + ' คน)' : '')); }, function (e) { toast('⚠️ ' + e.message, 5000); });
                } }), h('button', { class: 'btn ghost sm red-ghost', type: 'button', text: '🗑', 'aria-label': 'ลบ', onclick: function () {
                  if (!confirm('ลบแท็ก "' + x.tag + '" ออกจากคลัง' + (n ? ' และเอาออกจาก ' + n + ' คน' : '') + '?')) return;
                  api('tags.remove', { tag: x.tag }).then(function (r) { people.forEach(function (p) { var i = p.tags.indexOf(x.tag); if (i >= 0) p.tags.splice(i, 1); }); after(r, '🗑 ลบแล้ว'); }, function (e) { toast('⚠️ ' + e.message, 5000); });
                } }));
              }
              add(box, h('div', { class: 'list-item' }, h('button', { class: 'grow linklike', type: 'button', style: 'text-align:left', onclick: function () { tagF.value = x.tag; closeModal(); render(); } },
                h('b', { text: x.tag }), h('span', { class: 'small muted', text: ' · ' + n + ' คน' + (x.custom ? ' · เพิ่มเอง' : '') })), btns));
            });
          });
        }
        draw();
        var addNew = function () {
          var v = inp.value.trim(); if (!v) return toast('พิมพ์ชื่อแท็กก่อน');
          return api('tags.add', { tag: v, group: grpSel.value }).then(function (r) { inp.value = ''; after(r, '✅ เพิ่มแท็ก "' + r.tag + '" แล้ว'); }, function (e) { toast('⚠️ ' + e.message, 5000); });
        };
        inp.onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); addNew(); } };
        modal('🏷 คลังแท็กทักษะ', [h('p', { class: 'muted small', text: 'แตะชื่อแท็กเพื่อกรองรายชื่อ' + (meta.canEditTagCatalog ? ' · ✏️ เปลี่ยนชื่อ / 🗑 ลบ จะแก้ให้ทุกคนที่ติดแท็กนั้น' : '') }), box,
          h('div', { class: 'hr' }), h('label', { class: 'f', text: '➕ เพิ่มแท็กใหม่เข้าคลัง' }), h('div', { class: 'row' }, h('div', { class: 'grow' }, inp), h('div', null, grpSel)),
          h('button', { class: 'btn block', type: 'button', style: 'margin-top:6px', onclick: addNew, text: '+ เพิ่มแท็ก' })], null);
      }
      function render() {
        clear(list);
        var s = q.value.trim().replace(/\s/g, ''), tf = tagF.value.trim();
        var rows = people.filter(function (p) {
          if (stF.value === 'active' && p.status === 'inactive') return false;
          if (stF.value === 'inactive' && p.status !== 'inactive') return false;
          if (stF.value === 'unlinked' && (p.linked || p.status === 'inactive')) return false;
          if (roleF.value === 'admin') { if (!p.superadmin && !p.backup) return false; } else if (roleF.value && p.effRole !== roleF.value) return false;
          return (!s || (p.first + p.last + (p.callsign || '') + (p.section || '')).replace(/\s/g, '').indexOf(s) >= 0) && (!tf || p.tags.some(function (t) { return t.indexOf(tf) >= 0; }));
        });
        add(list, h('div', { class: 'section-label', text: rows.length + ' นาย · ผูก LINE แล้ว ' + rows.filter(function (p) { return p.linked; }).length }));
        rows.forEach(function (p) {
          add(list, h('button', { class: 'card clickable', style: 'padding:10px 12px', onclick: function () { edit(p); } },
            h('div', { class: 'row' }, h('b', { class: 'grow', text: p.name }), p.status === 'inactive' ? h('span', { class: 'badge gray', text: 'ปิด' }) : null,
              h('span', { class: 'badge ' + (p.superadmin || p.backup ? 'red' : 'green'), text: p.roleLabel || p.effRole }), h('span', { class: 'badge ' + (p.linked ? 'green' : 'gray'), text: p.linked ? 'LINE ✓' : 'ยังไม่ผูก' })),
            h('div', { class: 'small muted', text: [p.position, p.section && 'สายงาน: ' + p.section + (p.sectionNote ? ' (' + p.sectionNote + ')' : ''), p.callsign && 'นามเรียกขาน ' + p.callsign, p.scoreGroupEff && p.scoreGroupEff !== 'สายตรวจ' && 'หมวดคะแนน: ' + p.scoreGroupEff].filter(Boolean).join(' · ') }),
            p.lineName ? h('div', { class: 'small muted', text: 'ชื่อในไลน์: ' + p.lineName }) : null,
            (p.grants.length || p.revokes.length || p.ovScope || p.expires || p.tags.length) ? h('div', { class: 'small muted', text: (p.grants.length ? '➕' + p.grants.length + ' ' : '') + (p.revokes.length ? '➖' + p.revokes.length + ' ' : '') + (p.ovScope ? 'ขอบเขต ' + p.ovScope + ' ' : '') + (p.expires ? '⏳ ถึง ' + th(p.expires) + ' ' : '') + (p.tags.length ? '🏷 ' + p.tags.join(', ') : '') }) : null));
        });
      }
      render();
      function edit(p) {
        var body = [], canPerm = can('perm.manage') && !p.superadmin && p.pid !== S.boot.me.pid && !(p.backup && !meta.isSuper);
        if (p.phone) body.push(h('a', { class: 'btn ghost sm', href: 'tel:' + p.phone, text: '📞 ' + p.phone }));
        var roleSel = h('select'), grants = p.grants.slice(), revokes = p.revokes.slice(), capsBox = h('div');
        meta.roles.forEach(function (x) { add(roleSel, h('option', { value: x.id, text: x.label + ' — ' + x.note, selected: x.id === p.role })); });
        function rc() {
          clear(capsBox);
          var base = (meta.roles.filter(function (x) { return x.id === roleSel.value; })[0] || { caps: [] }).caps;
          Object.keys(meta.caps).forEach(function (c) {
            var inRole = base.indexOf(c) >= 0, on = inRole ? revokes.indexOf(c) < 0 : grants.indexOf(c) >= 0;
            var cb = h('input', { type: 'checkbox', checked: on, disabled: !canPerm, onchange: function () {
              grants = grants.filter(function (x) { return x !== c; }); revokes = revokes.filter(function (x) { return x !== c; });
              if (inRole && !cb.checked) revokes.push(c); if (!inRole && cb.checked) grants.push(c);
            } });
            add(capsBox, h('label', { class: 'cap' }, cb, h('span', { class: 'grow', text: meta.caps[c] }), inRole ? h('span', { class: 'badge gray', text: 'ตามบทบาท' }) : null));
          });
        }
        roleSel.onchange = function () { grants = []; revokes = []; rc(); };
        roleSel.disabled = !canPerm;
        rc();
        var scope = h('select', { disabled: !canPerm }, h('option', { value: '', text: 'ตามบทบาท' }), h('option', { value: 'station', text: 'ทั้งสถานี' }), h('option', { value: 'self', text: 'เฉพาะตนเอง' }));
        for (var z = 1; z <= 6; z++) add(scope, h('option', { value: 'zone:' + z, text: 'เฉพาะเขต ' + z }));
        scope.value = p.ovScope || '';
        var exp = h('input', { type: 'date', value: p.expires || '', disabled: !canPerm }), note = h('input', { placeholder: 'เหตุผล (บันทึกในประวัติ)', disabled: !canPerm });
        if (p.superadmin || p.backup) body.push(h('div', { class: 'note', text: p.superadmin ? 'แอดมิน — มีสิทธิ์ทุกอย่าง' : 'แอดมินสำรอง — มีสิทธิ์ทุกอย่าง (แจ้งแอดมินทุกครั้งที่แก้สิทธิ์/ตั้งค่า)' }));
        else body.push(field('บทบาท', roleSel), h('label', { class: 'f', text: 'สิทธิ์รายคน (ติ๊กเพิ่ม/เอาออกจากบทบาท)' }), capsBox, field('ขอบเขตข้อมูลรายคน', scope), field('สิทธิ์ที่ปรับรายคนหมดอายุ (ว่าง = ไม่หมด)', exp), field('หมายเหตุ', note));
        if (!canPerm && !p.superadmin && !p.backup) body.push(h('p', { class: 'muted small', text: 'แก้บทบาท/สิทธิ์ได้เฉพาะแอดมินและแอดมินสำรอง' }));
        var tags = null;
        if (can('tags.manage')) { // แท็กทักษะ: แตะเลือกจากคลังกลาง หรือพิมพ์แท็กใหม่แล้วกด "+ เพิ่ม" (แท็กใหม่เข้าคลังให้ใช้กับคนอื่นต่อ)
          tags = p.tags.slice();
          var tb = h('div', { class: 'tag-sel' }), catBox = h('div', { class: 'tag-cat' });
          var ti = h('input', { placeholder: 'พิมพ์แท็กใหม่ที่ไม่มีในรายการ', enterkeyhint: 'done', maxlength: '40' });
          var addTyped = function () { var v = ti.value.trim().replace(/,/g, ' '); if (!v) return toast('พิมพ์ชื่อแท็กก่อน'); if (tags.indexOf(v) < 0) tags.push(v); ti.value = ''; rt(); };
          ti.onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); addTyped(); } };
          var rt = function () {
            clear(tb);
            if (!tags.length) add(tb, h('span', { class: 'muted small', text: 'ยังไม่มีแท็ก — แตะแท็กด้านล่างเพื่อเลือก' }));
            tags.forEach(function (t, i) { add(tb, h('span', { class: 'tag' }, t, h('button', { type: 'button', 'aria-label': 'เอาออก', onclick: function () { tags.splice(i, 1); rt(); }, text: '×' }))); });
            clear(catBox);
            (meta.tagGroups || []).forEach(function (g) {
              var items = (meta.tagCatalog || []).filter(function (x) { return x.group === g.id; }); if (!items.length) return;
              var row = h('div', { class: 'chips' });
              items.forEach(function (x) { var on = tags.indexOf(x.tag) >= 0; add(row, h('button', { type: 'button', class: 'chip' + (on ? ' on' : ''), onclick: function () { if (on) tags.splice(tags.indexOf(x.tag), 1); else tags.push(x.tag); rt(); }, text: (on ? '✓ ' : '+ ') + x.tag })); });
              add(catBox, h('div', { class: 'tag-grp' }, h('div', { class: 'small muted', text: g.icon + ' ' + g.id }), row));
            });
          };
          rt();
          body.push(h('div', { class: 'hr' }), h('label', { class: 'f', text: '🏷 แท็กทักษะ' }), tb, catBox,
            h('div', { class: 'row', style: 'margin-top:6px' }, h('div', { class: 'grow' }, ti), h('button', { type: 'button', class: 'btn sm', onclick: addTyped, text: '+ เพิ่ม' })),
            h('div', { class: 'hint', text: 'แท็กที่พิมพ์ใหม่จะเข้าคลังกลางเมื่อกดบันทึก และใช้แท็กให้คนอื่นต่อได้' }));
        }
        var sgSel = null;
        if (can('people.manage')) { // หมวดคะแนน (แยกจากสิทธิ์) — ธุรการได้คะแนนเฉพาะผลัดที่ขึ้นรถ
          sgSel = h('select', null, h('option', { value: '', text: 'ตามบทบาท (ตอนนี้: ' + (p.scoreGroupEff || '-') + ')' }), h('option', { value: 'สายตรวจ', text: 'สายตรวจ — จัดอันดับคะแนน' }),
            h('option', { value: 'ธุรการ', text: 'ธุรการ — คิดเฉพาะผลัดที่ขึ้นรถ แสดงแยก' }), h('option', { value: 'ไม่คิดคะแนน', text: 'ไม่คิดคะแนน' }));
          sgSel.value = p.scoreGroup || '';
          body.push(h('div', { class: 'hr' }), field('🏅 หมวดคะแนน', sgSel));
        }
        var extra = h('div', { class: 'row', style: 'margin-top:10px' });
        if (can('people.manage') && !p.superadmin) {
          add(extra, submitBtn(p.status === 'inactive' ? 'เปิดใช้งาน' : 'ปิดบัญชี (ย้าย/ออก)', 'gray sm', function () { var why = prompt('เหตุผล'); if (why == null) return; return api('admin.status', { pid: p.pid, status: p.status === 'inactive' ? 'active' : 'inactive', reason: why }).then(function () { toast('บันทึกแล้ว'); closeModal(); VIEWS.admin(); }); }));
          if (p.linked) add(extra, submitBtn('ยกเลิกผูก LINE', 'gray sm', function () { if (!confirm('ยกเลิกการผูกบัญชี LINE ของ ' + p.name + '?')) return; return api('admin.unlink', { pid: p.pid }).then(function () { toast('ยกเลิกแล้ว'); closeModal(); VIEWS.admin(); }); }));
        }
        if (meta.isSuper && !p.superadmin) {
          if (p.backup) add(extra, submitBtn('ถอดจากแอดมินสำรอง', 'red sm', function () { if (!confirm('ถอด ' + p.name + ' จากแอดมินสำรอง?')) return; return api('admin.setBackup', { pid: '' }).then(function () { toast('ถอดแล้ว'); closeModal(); VIEWS.admin(); }); }));
          else if (p.linked && p.status !== 'inactive') add(extra, submitBtn('แต่งตั้งเป็นแอดมินสำรอง', 'amber sm', function () { if (!confirm('แต่งตั้ง ' + p.name + ' เป็นแอดมินสำรอง (แทนคนเดิมถ้ามี)?')) return; return api('admin.setBackup', { pid: p.pid }).then(function () { toast('แต่งตั้งแล้ว'); closeModal(); VIEWS.admin(); }); }));
        }
        body.push(extra);
        var canSave = canPerm || tags || sgSel;
        modal(p.name, body, canSave ? 'บันทึก' : null, function () {
          // บันทึกทีละรายการต่อกัน และเฉพาะส่วนที่แก้ (เดิมยิงพร้อมกัน → บันทึกสิทธิ์ทับแท็กหาย)
          var same = function (a, b) { return a.slice().sort().join('|') === b.slice().sort().join('|'); }, steps = [];
          var accessChanged = canPerm && (roleSel.value !== p.role || !same(grants, p.grants) || !same(revokes, p.revokes) || scope.value !== (p.ovScope || '') || exp.value !== (p.expires || '') || !!note.value.trim());
          if (accessChanged) steps.push(function () { return api('admin.setAccess', { pid: p.pid, role: roleSel.value, grants: grants, revokes: revokes, scope: scope.value, expires: exp.value, note: note.value }); });
          if (tags && !same(tags, p.tags)) steps.push(function () { return api('admin.profile', { pid: p.pid, tags: tags }); });
          if (sgSel && sgSel.value !== (p.scoreGroup || '')) steps.push(function () { return api('admin.profile', { pid: p.pid, scoreGroup: sgSel.value }); });
          if (!steps.length) { toast('ไม่มีการเปลี่ยนแปลง'); return; }
          return steps.reduce(function (pr, f) { return pr.then(f); }, Promise.resolve()).then(function () { toast('✅ บันทึกแล้ว'); VIEWS.admin(); });
        });
      }
    }, function (e) { fail(e, VIEWS.admin); });
  };
  // จำลองมุมมองตามบทบาท/รายคน (แอดมิน)
  VIEWS.viewAs = function () {
    setTitle('👁 จำลองมุมมองตามสิทธิ์', 'เห็นแอปเหมือนที่บุคคลนั้นเห็นจริง');
    loading();
    Promise.all([api('admin.meta'), api('admin.people')]).then(function (r) {
      var meta = r[0], people = r[1]; clear($app);
      add($app, h('div', { class: 'note', text: 'ระหว่างจำลอง เมนู ปุ่ม และข้อมูลจะเป็นตามสิทธิ์ของบุคคลนั้น มีแถบสีส้มด้านบน กด "ออก" เพื่อกลับ · ถ้ากดบันทึก/ส่งรายงาน จะบันทึกจริงในนามแอดมิน' }));
      var rc = card('ดูตามบทบาท', 'ใช้ตัวแทนคนแรกของบทบาท');
      meta.roles.forEach(function (x) {
        var rep = people.filter(function (p) { return p.role === x.id && !p.superadmin && !p.backup && p.status !== 'inactive'; })[0];
        add(rc, h('div', { class: 'list-item' }, h('div', { class: 'grow' }, h('b', { text: x.label }), h('div', { class: 'small muted', text: (rep ? 'ตัวแทน: ' + rep.name : 'ยังไม่มีคนในบทบาทนี้ (ใช้ตัวอย่าง)') + ' · ' + x.caps.length + ' สิทธิ์ · ' + (x.scope === 'station' ? 'เห็นทั้งสถานี' : 'เห็นเฉพาะตนเอง') })),
          h('button', { class: 'btn sm', onclick: function () { setViewAs({ role: x.id }); }, text: 'ดูมุมนี้' })));
      });
      add($app, rc);
      var pc = card('ดูรายคน'), q = h('input', { placeholder: '🔎 พิมพ์ชื่อ', oninput: draw }), list = h('div');
      function draw() {
        clear(list); var s = q.value.trim();
        if (s.length < 1) return add(list, h('p', { class: 'muted small', text: 'พิมพ์ชื่อเพื่อค้นหา' }));
        people.filter(function (p) { return !p.superadmin && (p.first + p.last + (p.nick || '')).indexOf(s) >= 0; }).slice(0, 12).forEach(function (p) {
          add(list, h('div', { class: 'list-item' }, h('div', { class: 'grow' }, h('b', { text: p.name }), h('div', { class: 'small muted', text: (p.roleLabel || p.role) + (p.linked ? '' : ' · ยังไม่ผูก LINE') })),
            h('button', { class: 'btn ghost sm', onclick: function () { setViewAs({ pid: p.pid }); }, text: 'ดูมุมนี้' })));
        });
      }
      draw(); add(pc, q, list); add($app, pc);
    }, function (e) { fail(e, VIEWS.viewAs); });
  };
  // ตารางสิทธิ์ตามบทบาท (งานระบบ)
  VIEWS.roles = function () {
    setTitle('🔐 สิทธิ์ตามบทบาท', 'มีผลกับทุกคนในบทบาทนั้นทันที');
    loading();
    api('admin.meta').then(function (meta) {
      clear($app);
      add($app, h('div', { class: 'note', text: 'งานระบบ (' + meta.systemCaps.map(function (c) { return c.label.replace(/\s*\(งานระบบ\)/, ''); }).join(', ') + ') สงวนไว้สำหรับแอดมินและแอดมินสำรองเท่านั้น' }));
      meta.roles.forEach(function (r) {
        var caps = r.caps.slice(), c = card(r.label, r.custom ? 'ปรับแล้ว' : 'ค่าตั้งต้น');
        add(c, h('p', { class: 'small muted', text: r.note }));
        Object.keys(meta.caps).forEach(function (k) {
          var cb = h('input', { type: 'checkbox', checked: caps.indexOf(k) >= 0, onchange: function () { caps = caps.filter(function (x) { return x !== k; }); if (cb.checked) caps.push(k); } });
          add(c, h('label', { class: 'cap' }, cb, h('span', { class: 'grow', text: meta.caps[k] })));
        });
        var sc = h('select', null, h('option', { value: 'station', text: 'เห็นผลงานรายคนทั้งสถานี', selected: r.scope === 'station' }), h('option', { value: 'self', text: 'เห็นผลงานรายคนเฉพาะตนเอง (+ ภาพรวมสถานี)', selected: r.scope === 'self' }));
        add(c, field('ขอบเขตข้อมูล', sc), h('div', { class: 'row', style: 'margin-top:10px' },
          submitBtn('คืนค่าตั้งต้น', 'gray sm', function () { if (!confirm('คืนค่าตั้งต้นของบทบาท ' + r.label + '?')) return; return api('roles.reset', { role: r.id }).then(function () { toast('คืนค่าแล้ว'); VIEWS.roles(); }); }),
          submitBtn('บันทึก', 'sm grow', function () { return api('roles.set', { role: r.id, caps: caps, scope: sc.value }).then(function () { toast('✅ บันทึกสิทธิ์ ' + r.label + ' แล้ว'); refreshBoot(); }); })));
        add($app, c);
      });
    }, function (e) { fail(e, VIEWS.roles); });
  };
  // รหัสความผิด (งานระบบ)
  VIEWS.codes = function () {
    setTitle('🧾 รหัสความผิด', 'ใช้ในหน้าส่งเวรและรายงาน บก.ทล.');
    loading();
    api('codes.list').then(function (d) {
      clear($app);
      add($app, h('button', { class: 'btn block', style: 'margin-bottom:12px', onclick: function () { edit({ code: '', label: '', short: '', group: 'car', act: 'รถยนต์', bkCat: 'อื่นๆ', aliases: '', active: true }); }, text: '➕ เพิ่มรหัสความผิด' }));
      Object.keys(d.groups).forEach(function (g) {
        var c = card(d.groups[g]);
        d.codes.filter(function (x) { return x.group === g; }).sort(function (a, b) { return a.order - b.order; }).forEach(function (x) {
          add(c, h('button', { class: 'list-item clickable', onclick: function () { edit(x); } }, h('b', { style: 'min-width:46px', text: x.code }), h('span', { class: 'grow', text: x.label }), x.active ? null : h('span', { class: 'badge gray', text: 'ปิด' })));
        });
        add($app, c);
      });
      function edit(x) {
        var code = h('input', { value: x.code, placeholder: 'เช่น C09', disabled: !!x.code }), label = h('input', { value: x.label }), short = h('input', { value: x.short || '', placeholder: 'ชื่อย่อในข้อความ เช่น ภาษี' });
        var group = h('select'); Object.keys(d.groups).forEach(function (g) { add(group, h('option', { value: g, text: d.groups[g], selected: g === x.group })); });
        var act = h('select'); d.acts.forEach(function (a) { add(act, h('option', { value: a, text: 'พ.ร.บ.' + a, selected: a === x.act })); });
        var bk = h('select'); d.bkCats.forEach(function (a) { add(bk, h('option', { value: a, text: a, selected: a === x.bkCat })); });
        var aliases = h('input', { value: x.aliases || '', placeholder: 'คำเรียกอื่นสำหรับพิมพ์ # คั่นด้วย ,' }), active = h('input', { type: 'checkbox', checked: x.active !== false });
        modal(x.code ? 'แก้รหัส ' + x.code : 'เพิ่มรหัสความผิด', [field('รหัส', code), field('ชื่อความผิด', label), field('ชื่อย่อ', short), field('กลุ่ม', group), field('พ.ร.บ. (คอลัมน์ Excel)', act), field('หมวดรายงาน บก.ทล.', bk), field('คำเรียกอื่น', aliases), h('label', { class: 'cap' }, active, 'ใช้งานอยู่ (ปิด = ซ่อนจากหน้าส่งเวร แต่ข้อมูลเดิมยังอยู่)')],
          'บันทึก', function () { return api('codes.save', { code: { code: code.value, label: label.value, short: short.value, group: group.value, act: act.value, bkCat: bk.value, aliases: aliases.value, order: x.order, active: active.checked } }).then(function () { toast('✅ บันทึกแล้ว'); refreshBoot(); VIEWS.codes(); }); });
      }
    }, function (e) { fail(e, VIEWS.codes); });
  };
  // นำเข้า/อัปเดตกำลังพลจาก CSV
  function parseCsv(text) {
    text = text.replace(/^﻿/, ''); var rows = [], row = [], cur = '', q = false;
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (q) { if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
      else if (ch === '"') q = true; else if (ch === ',') { row.push(cur); cur = ''; } else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; } else cur += ch;
    }
    if (cur || row.length) { row.push(cur); rows.push(row); }
    var head = (rows.shift() || []).map(function (x) { return x.trim(); });
    return rows.filter(function (r) { return r.some(function (x) { return String(x).trim(); }); }).map(function (r) { var o = {}; head.forEach(function (k, i) { o[k] = (r[i] || '').trim(); }); return o; });
  }
  VIEWS.peopleImport = function () {
    setTitle('📥 นำเข้า/อัปเดตกำลังพล', 'จากไฟล์ Excel (.xlsx) หรือ CSV');
    clear($app);
    var rows = null, file = h('input', { type: 'file', accept: '.xlsx,.csv,text/csv' }), info = h('div');
    var ow = h('input', { type: 'checkbox' }), deact = h('input', { type: 'checkbox' });
    add($app, h('div', { class: 'card' }, h('p', { class: 'small', text: 'หัวคอลัมน์: rank, first, last, nick, callsign, position, phone, birthYear, role, note (ระบบไม่รับเลขบัตร/เลขบัญชี) · role ใส่ได้ทั้งรหัสหรือภาษาไทย เช่น หัวหน้าสถานี' }),
      file, info, h('label', { class: 'cap' }, ow, 'ใช้เบอร์โทรจากไฟล์แทนเบอร์เดิม'), S.boot.perms.admin ? h('label', { class: 'cap' }, deact, 'ปิดบัญชีคนที่ไม่อยู่ในไฟล์ (ย้ายออก) — เฉพาะแอดมิน') : null));
    add($app, h('div', { class: 'note', text: 'Excel (.xlsx): ระบบอ่านหัวตาราง ยศ / ชื่อ / ชื่อสกุล / ชื่อเล่น / นามเรียกขาน / ตำแหน่ง / หมายเลขโทรศัพท์ / หมายเหตุ เท่านั้น — คอลัมน์อื่น เช่น บัตรประชาชน เลขบัญชี กรุ๊ปเลือด ถูกตัดทิ้งและไม่เก็บไฟล์ต้นฉบับ แล้วแสดงผลให้ตรวจก่อนยืนยัน' }));
    file.onchange = function () {
      var f = file.files && file.files[0]; if (!f) return;
      if (/\.xlsx$/i.test(f.name)) {
        rows = null; clear(info); add(info, h('div', { class: 'up-line' }, spinner(), h('span', { text: 'กำลังส่ง ' + f.name + '…' })));
        uploadFile(f).then(function (x) {
          clear(info); file.value = '';
          if (x.kind !== 'people') return add(info, errorBox('ไม่พบหัวตารางรายชื่อ (ต้องมีคอลัมน์ "ชื่อ" และ "ชื่อสกุล" หรือ "ยศ") — ไฟล์ถูกเก็บในคลังเอกสารแทน'));
          add(info, h('p', { class: 'small', text: (x.dup ? 'ไฟล์นี้มีในคลังแล้ว · ' : '') + x.summary }));
          if (x.canReview) reviewFile(x.id, function () { go('files', { id: x.id }); });
        }, function (e) { clear(info); file.value = ''; add(info, errorBox(e.message)); });
        return;
      }
      var rd = new FileReader();
      rd.onload = function () {
        try { rows = parseCsv(String(rd.result)); } catch (e) { rows = null; }
        clear(info);
        if (!rows || !rows.length || !('first' in rows[0])) { rows = null; return add(info, errorBox('อ่านไฟล์ไม่ได้ หรือไม่มีคอลัมน์ first')); }
        add(info, h('p', { text: 'พบ ' + rows.length + ' รายชื่อ เช่น ' + rows.slice(0, 3).map(function (r) { return (r.rank || '') + r.first + ' ' + (r.last || ''); }).join(', ') }));
      };
      rd.readAsText(f, 'utf-8');
    };
    add($app, bar(submitBtn('📥 นำเข้า', 'green', function () {
      if (!rows) throw new Error('เลือกไฟล์ CSV ก่อน');
      if (deact.checked && !confirm('ยืนยันปิดบัญชีทุกคนที่ไม่อยู่ในไฟล์นี้?')) return;
      return api('people.import', { rows: rows, overwritePhone: ow.checked, deactivateMissing: deact.checked }).then(function (r) {
        clear(info); add(info, h('div', { class: 'note', text: '✅ เพิ่มใหม่ ' + r.created + ' · ปรับปรุง ' + r.updated + (r.deactivated.length ? ' · ปิดบัญชี ' + r.deactivated.length : '') + (r.fuzzy.length ? '\nชื่อสะกดต่าง (จับคู่ให้แล้ว): ' + r.fuzzy.join(', ') : '') }));
        refreshBoot();
      });
    })));
  };
  // ======================= นำเข้าไฟล์ / คลังเอกสาร (v1.12) =======================
  // ทุกคนส่งไฟล์ได้ → ระบบแยกชนิดเอง: คำสั่งเวรยาม/แบ่งตามสายงาน/รายชื่อกำลังพล เข้าคิวให้ผู้มีสิทธิ์ตรวจก่อนนำเข้า · ไฟล์อื่นเก็บในคลัง
  var FILE_ACCEPT = '.docx,.doc,.xlsx,.csv,.pdf,.pptx,.ppt,.txt,.rtf,.odt,.ods,.odp,image/*,video/*,audio/*';
  var FILE_MAX = 10 * 1024 * 1024;
  var FILE_ST = { pending: 'amber', done: 'green', rejected: 'gray', stored: 'blue', deleted: 'gray' };
  function fileSize(n) { n = +n || 0; return n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; }
  function readB64(file) {
    return new Promise(function (res, rej) {
      var rd = new FileReader();
      rd.onload = function () { res(String(rd.result).replace(/^data:[^,]*,/, '')); };
      rd.onerror = function () { rej(new Error('อ่านไฟล์ในเครื่องไม่ได้')); };
      rd.readAsDataURL(file);
    });
  }
  function uploadFile(file) {
    if (file.size > FILE_MAX) return Promise.reject(new Error(file.name + ': ใหญ่เกิน 10 MB — กรุณาย่อขนาดหรือแยกไฟล์'));
    if (/\.xls$/i.test(file.name)) return Promise.reject(new Error(file.name + ': ไฟล์ Excel รุ่นเก่า (.xls) — เปิดใน Excel แล้ว "บันทึกเป็น" .xlsx ก่อนส่ง'));
    return readB64(file).then(function (b64) { return api('file.upload', { name: file.name, mime: file.type || '', b64: b64 }); });
  }
  function b64Blob(b64, type) { var bin = atob(b64), arr = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i); return new Blob([arr], { type: type }); }
  function openFile(x) {
    return api('file.get', { id: x.id }).then(function (f) {
      var url = URL.createObjectURL(b64Blob(f.b64, f.mime)), img = /^image\//.test(f.mime), body = [];
      if (img) body.push(h('img', { src: url, alt: f.name, style: 'max-width:100%;border-radius:10px;display:block;margin:0 auto 10px' }));
      body.push(h('a', { class: 'btn block', href: url, download: f.name, text: '⬇️ บันทึกไฟล์ลงเครื่อง' }));
      if (!img) body.push(h('a', { class: 'btn ghost block', style: 'margin-top:8px', href: url, target: '_blank', rel: 'noopener', text: '📖 เปิดดู' }));
      if (window.liff && liff.isInClient && liff.isInClient()) body.push(h('p', { class: 'muted small', text: 'ถ้าเปิด/บันทึกในไลน์ไม่ได้ ให้เปิดแอปในเบราว์เซอร์ (เมนู ⋮ → เปิดในเบราว์เซอร์)' }));
      modal('📂 ' + f.name, body);
    });
  }
  function previewLine(l) { return /^- |ไม่พบ|ไม่ตรง|สะกดต่าง|ควรตรวจ|ไม่ได้|ไม่มีใน|ล้างสายงาน|รอบเก่ากว่า|เขียนทับ/.test(l); }
  /** ตรวจผลอ่านไฟล์ก่อนนำเข้า (ผู้มีสิทธิ์) */
  function reviewFile(id, after) {
    var body = h('div', { class: 'pv' }, h('div', { class: 'loading' }, spinner(), h('p', { text: 'กำลังอ่านไฟล์…' })));
    modal('🔎 ตรวจก่อนนำเข้า', body);
    api('file.preview', { id: id }).then(function (p) {
      clear(body);
      add(body, h('div', { class: 'muted small', text: p.file.name + ' · ' + p.file.kindLabel + ' · ส่งโดย ' + p.file.byName }));
      if (p.again) add(body, h('div', { class: 'note', text: 'ไฟล์นี้นำเข้าแล้ว — ยืนยันอีกครั้งจะเขียนทับข้อมูลช่วงเดียวกันด้วยไฟล์นี้' }));
      add(body, h('h4', { style: 'margin:8px 0 6px', text: p.title }));
      var box = h('div', { class: 'pv-lines' });
      p.lines.forEach(function (l) { add(box, h('div', { class: 'pv-line' + (previewLine(l) ? ' warn' : ''), text: l })); });
      add(body, box);
      var ow = null, de = null;
      if (p.options) {
        ow = h('input', { type: 'checkbox' }); ow.checked = true;
        add(body, h('label', { class: 'cap' }, ow, 'ใช้เบอร์โทรจากไฟล์แทนเบอร์เดิม'));
        if (p.options.deactivateMissing) { de = h('input', { type: 'checkbox' }); add(body, h('label', { class: 'cap' }, de, 'ปิดบัญชีคนที่ไม่อยู่ในไฟล์ (ย้ายออก) — เฉพาะแอดมิน')); }
      }
      add(body, h('div', { class: 'row', style: 'margin-top:12px' }, submitBtn('✅ ยืนยันนำเข้า', 'green grow', function () {
        return api('file.confirm', { id: id, importId: p.importId, overwritePhone: ow ? ow.checked : undefined, deactivateMissing: de ? de.checked : false }).then(function (r) {
          closeModal(); toast('✅ ' + r.result, 6000); refreshBoot(); if (after) after();
        });
      })));
    }, function (e) { clear(body); add(body, errorBox(e.message)); });
  }
  VIEWS.files = function (params) {
    params = params || {};
    setTitle('📥 นำเข้าไฟล์', 'ส่งไฟล์ให้ระบบ · คลังเอกสาร');
    clear($app);
    var input = h('input', { type: 'file', accept: FILE_ACCEPT, multiple: true, class: 'drop-input', 'aria-label': 'เลือกไฟล์' });
    var drop = h('label', { class: 'drop' }, input, h('div', { class: 'drop-ic', text: '📤' }), h('b', { text: 'แตะเพื่อเลือกไฟล์' }),
      h('small', { text: 'Word · Excel (.xlsx) · CSV · PDF · รูปภาพ — ไม่เกิน 10 MB ต่อไฟล์ เลือกหลายไฟล์พร้อมกันได้' }));
    var status = h('div');
    add($app, h('div', { class: 'card' }, drop, status,
      h('details', { class: 'small', style: 'margin-top:10px' }, h('summary', { text: 'ระบบทำอะไรกับไฟล์แต่ละแบบ' }),
        h('ul', { class: 'small', style: 'padding-left:18px;margin:6px 0' },
          h('li', { text: '🗓 คำสั่งเวรยาม (.docx) → ตารางเวร หน้าที่รายวัน ลา/ภารกิจ' }),
          h('li', { text: '🧭 แบ่งตามสายงาน (.docx) → สายงานของแต่ละคน · ลา/อบรม/ช่วยราชการ · เทียบตารางรถกับคำสั่งเวร (แจ้งเตือนเมื่อไม่ตรง)' }),
          h('li', { text: '👥 รายชื่อกำลังพล (.xlsx/.csv) → ยศ ชื่อ ตำแหน่ง เบอร์ (เก็บเฉพาะคอลัมน์ที่ระบบใช้ ไม่เก็บเลขบัตร/เลขบัญชี/ไฟล์ต้นฉบับ)' }),
          h('li', { text: '📄 PDF/รูป/เอกสารอื่น → เก็บในคลังเอกสาร ผู้ส่งและผู้มีสิทธิ์นำเข้าเปิดดูได้' }),
          h('li', { text: 'สามแบบแรกต้องให้ผู้มีสิทธิ์นำเข้าตรวจแล้วกดยืนยันก่อน ข้อมูลในระบบจึงเปลี่ยน' }),
          h('li', { text: '⚠️ ไม่รับไฟล์ที่มีเลขประจำตัวประชาชน/เลขบัญชีธนาคาร และไม่รับ .xls รุ่นเก่า' }),
          h('li', { text: 'ส่งไฟล์ให้บอทในแชท 1:1 ได้เหมือนกัน' })))));
    var chips = h('div', { class: 'chips' }), out = h('div'), filt = null, data = null;
    add($app, h('div', { class: 'section-label', text: 'คลังเอกสาร' }), chips, h('div', { style: 'height:8px' }), out);
    input.onchange = function () {
      var list = [].slice.call(input.files || []); input.value = '';
      if (!list.length) return;
      clear(status);
      var chain = Promise.resolve(), last = null;
      list.forEach(function (f) {
        chain = chain.then(function () {
          var line = h('div', { class: 'up-line' }, spinner(), h('span', { text: 'กำลังส่ง ' + f.name + ' (' + fileSize(f.size) + ')…' }));
          add(status, line);
          return uploadFile(f).then(function (x) {
            clear(line); last = x;
            add(line, h('span', { text: (x.dup ? 'ℹ️ มีในคลังแล้ว: ' : '✅ ') + x.name + ' · ' + x.kindLabel + (x.status === 'pending' ? (x.canReview ? ' · พร้อมตรวจนำเข้า' : ' · ส่งให้ผู้มีสิทธิ์ตรวจแล้ว') : ' · เก็บในคลังแล้ว') }));
          }, function (e) { clear(line); line.classList.add('bad'); add(line, h('span', { text: '⚠️ ' + e.message })); });
        });
      });
      chain.then(function () {
        if (list.length === 1 && last && last.canReview && last.status === 'pending') { filt = 'pending'; reviewFile(last.id, load); }
        load();
      });
    };
    function render() {
      clear(chips); clear(out);
      var opts = data.reviewer ? [['pending', 'รอตรวจ' + (data.pending ? ' (' + data.pending + ')' : '')], ['all', 'ทั้งหมด'], ['mine', 'ของฉัน']] : [['mine', 'ไฟล์ที่ฉันส่ง']];
      if (!filt) filt = data.reviewer && data.pending ? 'pending' : data.reviewer ? 'all' : 'mine';
      opts.forEach(function (o) { add(chips, h('button', { class: 'chip' + (filt === o[0] ? ' on' : ''), onclick: function () { filt = o[0]; render(); }, text: o[1] })); });
      var items = data.items.filter(function (x) { return filt === 'pending' ? x.status === 'pending' : filt === 'mine' ? x.mine : true; });
      if (!items.length) return add(out, h('p', { class: 'muted center', text: filt === 'pending' ? '✅ ไม่มีไฟล์รอตรวจ' : 'ยังไม่มีไฟล์' }));
      items.forEach(function (x) { add(out, fileCard(x)); });
    }
    function fileCard(x) {
      var c = h('div', { class: 'card file-card' + (params.id === x.id ? ' hl' : ''), id: 'file-' + x.id });
      add(c, h('div', { class: 'row', style: 'align-items:flex-start' }, h('b', { class: 'grow', style: 'word-break:break-word', text: x.name }), h('span', { class: 'badge ' + (FILE_ST[x.status] || 'gray'), text: x.statusLabel })));
      add(c, h('div', { class: 'small', text: x.kindLabel + (x.summary ? ' · ' + x.summary : '') }));
      add(c, h('div', { class: 'muted small', text: 'ส่งโดย ' + x.byName + ' · ' + th(String(x.at).slice(0, 10)) + ' ' + hm(x.at) + ' น. · ' + fileSize(x.size) + (x.via === 'line' ? ' · ทางแชท LINE' : '') }));
      if (x.result) add(c, h('div', { class: 'small', style: 'margin-top:4px', text: (x.status === 'done' ? '✅ ' : '') + x.result + (x.decidedBy ? ' — ' + x.decidedBy : '') }));
      if (x.note) add(c, h('div', { class: 'muted small', text: x.note }));
      var b = h('div', { class: 'row', style: 'margin-top:8px;flex-wrap:wrap;gap:6px' });
      add(b, submitBtn('📂 เปิด', 'ghost sm', function () { return openFile(x); }));
      if (x.canReview) add(b, h('button', { class: 'btn sm' + (x.status === 'pending' ? '' : ' ghost'), onclick: function () { reviewFile(x.id, load); },
        text: x.status === 'pending' ? '🔎 ตรวจและนำเข้า' : x.status === 'done' ? '🔁 นำเข้าอีกครั้ง' : '🔎 ตรวจ/นำเข้า' }));
      if (x.canReview && x.status === 'pending') add(b, h('button', { class: 'btn gray sm', onclick: function () {
        var note = h('input', { placeholder: 'เหตุผล (ไม่บังคับ) เช่น ไฟล์เก่า/ส่งผิด' });
        modal('ไม่นำเข้าไฟล์นี้?', [h('p', { class: 'small', text: x.name + ' — ไฟล์ยังอยู่ในคลัง นำเข้าภายหลังได้' }), note], 'ไม่นำเข้า', function () {
          return api('file.reject', { id: x.id, note: note.value }).then(function () { toast('บันทึกแล้ว'); refreshBoot(); load(); });
        });
      }, text: 'ไม่นำเข้า' }));
      if (x.canRemove) add(b, h('button', { class: 'btn ghost sm red-t', onclick: function () {
        modal('ลบไฟล์นี้?', [h('p', { class: 'small', text: x.name + ' — ย้ายลงถังขยะของ Google Drive ระบบ (ผู้ดูแลกู้คืนได้ภายใน 30 วัน)' })], '🗑 ลบ', function () {
          return api('file.remove', { id: x.id }).then(function () { toast('ลบแล้ว'); refreshBoot(); load(); });
        });
      }, text: '🗑 ลบ' }));
      add(c, b);
      return c;
    }
    function load() {
      if (!data) { clear(out); add(out, h('div', { class: 'loading' }, spinner())); }
      live('file.list', {}, function (d) {
        data = d; if (S.boot) S.boot.filesPending = d.pending; render();
        if (params.id) { var el = document.getElementById('file-' + params.id); if (el) el.scrollIntoView({ block: 'center' }); }
        if (params.id && !load.opened) { load.opened = true; var it = d.items.filter(function (x) { return x.id === params.id; })[0]; if (it && it.canReview && it.status === 'pending') reviewFile(it.id, load); }
      }, function (e) { clear(out); add(out, errorBox(e.message)); });
    }
    load.opened = false;
    load();
  };
  VIEWS.registrations = function () {
    setTitle('📝 คำขอลงทะเบียน', '');
    loading();
    api('admin.registrations').then(function (list) {
      clear($app);
      if (!list.length) return add($app, card('✅ ไม่มีคำขอค้าง'));
      list.forEach(function (r) {
        var pick = r.pid, lbl = h('span', { text: r.name || (r.extra ? '🆕 สร้างรายชื่อใหม่: ' + r.extra : '— ยังไม่ได้เลือกชื่อ —') });
        add($app, h('div', { class: 'card' }, h('b', { text: 'LINE: ' + r.lineName }), h('div', { class: 'muted small', text: 'ขอเมื่อ ' + th(r.at.slice(0, 10)) + ' ' + hm(r.at) + (r.pid ? (r.phoneMatch ? ' · เบอร์ตรง' : ' · ⚠️ เบอร์ 4 ตัวท้ายไม่ตรง') : ' · ไม่พบชื่อในทะเบียน') }),
          h('div', { class: 'row', style: 'margin:8px 0' }, h('div', { class: 'grow' }, 'ผูกกับ: ', lbl), h('button', { class: 'btn ghost sm', onclick: function () { pickPerson('เลือกรายชื่อ', function (p) { pick = p.pid; lbl.textContent = p.name; }); }, text: 'เลือก' })),
          h('div', { class: 'row' }, submitBtn('ปฏิเสธ', 'gray grow', function () { return api('admin.decide', { id: r.id, approve: false }).then(VIEWS.registrations); }),
            submitBtn('✅ อนุมัติ', 'green grow', function () { return api('admin.decide', { id: r.id, approve: true, pid: pick }).then(function () { toast('อนุมัติแล้ว'); VIEWS.registrations(); }); }))));
      });
    }, function (e) { fail(e, VIEWS.registrations); });
  };
  var AUDIT_LABEL = { 'suspect.view': '🔒 เปิดดูข้อมูลผู้ต้องหา', 'suspect.search': '🔎 ค้นหาผู้ต้องหา', 'perm.set': '🔐 ปรับสิทธิ์รายคน', 'role.set': '🔐 แก้สิทธิ์บทบาท', 'backup.set': '👑 แต่งตั้งแอดมินสำรอง',
    'backup.remove': '👑 ถอดแอดมินสำรอง', 'settings.set': '⚙️ แก้ตั้งค่า', 'codes.save': '🧾 แก้รหัสความผิด', 'arrest.approved': '✅ อนุมัติคดี', 'arrest.returned': '↩️ ส่งคดีกลับแก้', 'arrest.edit': '✏️ แก้รายงานจับกุม',
    'event.void': '🗑 ยกเลิกรายการ', 'shift.void': '🗑 ยกเลิกรายงานผลัด', 'event.update': '✏️ แก้ไข ว.42/ช่วยเหลือ', 'register.auto': '🔗 ผูก LINE อัตโนมัติ', 'register.approved': '🔗 อนุมัติผูก LINE', 'register.rejected': '⛔ ปฏิเสธคำขอ', 'register.unlink': '🔗 ยกเลิกผูก LINE',
    'people.status': '👤 เปลี่ยนสถานะบัญชี', 'people.import': '📥 นำเข้ากำลังพล', 'people.update': '👤 แก้ข้อมูลกำลังพล', 'score.set': '🏅 ตั้ง/แก้เกณฑ์คะแนน', 'score.delete': '🏅 ลบช่วงคะแนน', 'score.start': '🏅 ตั้งวันเริ่มคิดคะแนน', 'export.xlsx': '⬇️ ส่งออก Excel', 'roster.import': '🗓 นำเข้าตารางเวร' };
  VIEWS.audit = function () {
    setTitle('🧾 ประวัติการใช้งาน', '200 รายการล่าสุด');
    loading();
    api('admin.audit', { limit: 200 }).then(function (list) {
      clear($app);
      var f = h('select', { onchange: render }, h('option', { value: '', text: 'ทุกรายการ' }), h('option', { value: 'suspect.', text: 'การเปิดดู/ค้นหาผู้ต้องหา' }), h('option', { value: 'perm|role|backup|settings|codes', text: 'งานระบบ/สิทธิ์' }), h('option', { value: 'arrest|event', text: 'คดี/รายการ' }));
      var out = h('div');
      add($app, h('div', { class: 'card' }, f), out);
      function render() {
        clear(out); var c = card(null), re = f.value ? new RegExp(f.value) : null;
        list.filter(function (a) { return !re || re.test(a.action); }).forEach(function (a) {
          add(c, h('div', { class: 'list-item', style: 'display:block' }, h('div', { class: 'small muted', text: th(a.at.slice(0, 10)) + ' ' + hm(a.at) + ' · ' + a.actor }), h('b', { text: (AUDIT_LABEL[a.action] || a.action) + ' ' + a.target }),
            a.reason ? h('div', { class: 'small', text: '💬 ' + a.reason }) : null, a.after && !/^suspect/.test(a.action) ? h('div', { class: 'small muted clamp2', text: a.after }) : null));
        });
        if (!c.children.length) add(c, h('p', { class: 'muted', text: 'ไม่มีรายการ' }));
        add(out, c);
      }
      render();
    }, function (e) { fail(e, VIEWS.audit); });
  };
  VIEWS.settings = function () {
    setTitle('⚙️ ตั้งค่าระบบ', 'เฉพาะแอดมิน/แอดมินสำรอง');
    loading();
    api('settings.get').then(function (s) {
      clear($app);
      var q = s.quota, pct = Math.min(100, Math.round(q.used * 100 / Math.max(q.limit, 1)));
      add($app, h('div', { class: 'card' }, h('h3', { text: '📨 โควตาข้อความเดือนนี้' }), h('div', { class: 'meter' }, h('div', { style: 'width:' + pct + '%;background:' + (pct > 85 ? 'var(--red)' : 'var(--green)') })),
        h('p', { class: 'muted', text: 'ใช้ ' + q.used + ' / ' + q.limit + ' ข้อความ (push) — การตอบกลับ (reply) และข้อความที่ส่งจากฟอร์มในนามผู้ใช้ไม่นับ' })));
      var c = card('ค่าที่ปรับได้');
      var KEYS = ['push_limit', 'push_reserve', 'reminder_cap', 'reminders', 'morning_summary', 'morning_time', 'register_auto', 'arrest_director'];
      s.cfg.filter(function (r) { return KEYS.indexOf(r.key) >= 0; }).forEach(function (r) {
        var inp = r.key === 'arrest_director' ? h('textarea', { rows: 4, value: r.value }) : h('input', { value: r.value });
        add(c, field(r.note || r.key, inp), h('div', { class: 'row', style: 'justify-content:flex-end;margin-bottom:6px' }, submitBtn('บันทึก', 'sm', function () { return api('settings.set', { key: r.key, value: inp.value }).then(function () { toast('บันทึกแล้ว'); if (r.key === 'arrest_director') S.boot.arrestDirector = inp.value; }); })));
      });
      add($app, c);
      var g = card('กลุ่มไลน์'); s.cfg.filter(function (r) { return /^group_/.test(r.key); }).forEach(function (r) { add(g, h('div', { class: 'list-item', text: (r.value ? '✅ ' : '⏳ ') + r.note })); });
      add($app, g);
    }, function (e) { fail(e, VIEWS.settings); });
  };


  window.addEventListener('error', function (ev) {
    if (!ev.message) return;
    if (!window.__booted) { window.__booted = true; fail(new Error('หน้าเว็บขัดข้อง: ' + ev.message), function () { location.reload(); }); }
    else toast('⚠️ ' + ev.message, 5000);
  });
  window.addEventListener('unhandledrejection', function (ev) { var m = ev.reason && ev.reason.message ? ev.reason.message : String(ev.reason || ''); if (m) toast('⚠️ ' + m, 5000); });
  if (window.liff) start(); else { window.__booted = true; fail(new Error('โหลด LINE LIFF SDK ไม่สำเร็จ — กรุณาเปิดผ่านแอปไลน์'), function () { location.reload(); }); }
})();
