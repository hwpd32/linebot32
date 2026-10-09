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
  var READ_TTL = { 'shift.get': 45000, now: 30000, summary: 60000, 'shift.list': 60000, 'arrest.list': 30000, 'admin.meta': 60000 };
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
    if (!ttl) apiInvalidate(); // คำขอเขียน → ข้อมูลที่จำไว้อาจเก่า
    var p = apiRaw(action, data).then(function (v) { if (ttl) apiCache[k] = { at: Date.now(), v: v }; delete inflight[k]; return v; }, function (e) { delete inflight[k]; throw e; });
    if (ttl) inflight[k] = p;
    return p;
  }
  function apiRaw(action, data) {
    var ctl = window.AbortController ? new AbortController() : null;
    var req = fetch(CFG.API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: action, data: data || {}, idToken: S.idToken }), signal: ctl ? ctl.signal : undefined });
    return withTimeout(req, CFG.API_TIMEOUT_MS || 30000, 'ระบบตอบช้าเกินไป (เกิน 30 วินาที) กรุณากดลองใหม่').then(null, function (e) { if (ctl && e.code === 'TIMEOUT') ctl.abort(); throw e; })
      .then(function (r) { return r.json().catch(function () { throw new Error('ระบบตอบกลับผิดรูปแบบ (HTTP ' + r.status + ') กรุณาลองใหม่'); }); }, function (e) { if (e.code === 'TIMEOUT') throw e; throw new Error('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสัญญาณแล้วลองใหม่'); })
      .then(function (j) {
        if (j.ok) return j.data;
        if (j.code === 'AUTH' && window.liff && liff.isLoggedIn()) { try { liff.logout(); if (!liff.isInClient()) liff.login({ redirectUri: location.href }); } catch (x) { } }
        var e = new Error(j.error || 'เกิดข้อผิดพลาด'); e.code = j.code; throw e;
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
  var TOP = { home: 'home', report: 'report', now: 'results', summary: 'results', me: 'results', more: 'more' };
  var TABS = [['home', '🏠', 'หน้าแรก'], ['report', '📝', 'รายงาน'], ['results', '📊', 'ผลงาน'], ['more', '☰', 'เพิ่มเติม']];
  function go(view, params, replace) {
    if (view === 'menu') view = 'home';
    if (view === 'results') view = can('view.now') ? 'now' : 'me';
    if (!VIEWS[view]) view = 'home';
    if (TOP[view]) S.stack = [];
    else if (!replace && S.view) S.stack.push({ view: S.view, params: S.params });
    S.view = view; S.params = params || {};
    var reg = view === 'register';
    document.getElementById('back').hidden = !S.stack.length || !!TOP[view];
    document.getElementById('home').hidden = !!TOP[view] || reg || !!S.stack.length;
    renderTabs(reg ? null : TOP[view]);
    renderSubnav(view);
    document.body.classList.toggle('has-tabs', !!TOP[view] && !reg);
    window.scrollTo(0, 0);
    try { VIEWS[view](S.params); } catch (e) { clear($app); add($app, errorBox(e.message)); }
  }
  function pendingTotal() { var p = S.boot && S.boot.pending; return p ? (can('case.approve') ? p.arrest : 0) + (can('people.manage') ? p.reg : 0) : 0; }
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
    var items = [['now', 'ตอนนี้', 'view.now'], ['summary', 'สรุปผล', 'view.now'], ['me', 'ผลของฉัน', null]].filter(function (x) { return !x[2] || can(x[2]); });
    nav.hidden = TOP[view] !== 'results' || items.length < 2;
    if (nav.hidden) return;
    var seg = h('div', { class: 'seg' });
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
      if (dec && dec.exp && dec.exp * 1000 < Date.now() + 60000) { liff.logout(); liff.login({ redirectUri: location.href }); return; }
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
      }
      var cached = S.uid ? bootCacheGet(S.uid) : null;
      if (cached) { applyBoot(cached); open(); refreshBootQuiet(); return; }
      return boot().then(open);
    }).catch(function (e) { window.__booted = true; fail(e, function () { location.reload(); }); });
  }
  // จำ bootstrap ไว้ในเครื่อง (ต่อบัญชี LINE) → เปิดครั้งถัดไปหน้าขึ้นทันที แล้วค่อยอัปเดตเบื้องหลัง
  var BOOT_KEY = 'boot:' + (CFG.LIFF_ID || ''), BOOT_MAX_AGE = 12 * 3600000;
  function bootCacheGet(uid) { try { var j = JSON.parse(localStorage.getItem(BOOT_KEY) || 'null'); return j && j.uid === uid && Date.now() - j.at < BOOT_MAX_AGE && j.b && j.b.registered ? j.b : null; } catch (e) { return null; } }
  function bootCachePut(uid, b) { try { if (b && b.registered) localStorage.setItem(BOOT_KEY, JSON.stringify({ uid: uid, at: Date.now(), b: b })); else localStorage.removeItem(BOOT_KEY); } catch (e) { } }
  function applyBoot(b) { S.boot = b; S._bootAt = Date.now(); setTitle('รายงานผล ' + (b.station || '').split(' ')[0], b.me ? b.me.name + ' · ' + (b.perms.roleLabel || '') : ''); }
  function boot() { return api('bootstrap').then(function (b) { applyBoot(b); bootCachePut(S.uid, b); return b; }); }
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
    // ขบวนที่กำลังนำ
    var myCars = mine.map(function (m) { return String(m.car); });
    (S.boot.activeEscorts || []).filter(function (e) { return myCars.indexOf(String(e.car)) >= 0; }).forEach(function (e) {
      add($app, h('button', { class: 'alert amber', onclick: function () { go('escort'); } }, h('b', { text: '🚔 กำลังนำขบวน ' + e.car + ' — แตะเพื่อจบขบวน' }), h('small', { text: e.sub + (e.payload.name ? ' · ' + e.payload.name : '') + ' · เริ่ม ' + hm(e.payload.start) + ' น.' })));
    });
    // งานรอดำเนินการของผู้ตรวจ/ผู้ดูแล
    var pend = S.boot.pending || {};
    if (can('case.approve') && pend.arrest) add($app, h('button', { class: 'alert red', onclick: function () { go('cases'); } }, h('b', { text: '📥 คดีจับกุมรอตรวจ ' + pend.arrest + ' คดี' }), h('small', { text: 'แตะเพื่อตรวจและอนุมัติ (คดีที่ท่านอยู่ในชุดจับกุมอนุมัติเองไม่ได้)' })));
    if (can('people.manage') && pend.reg) add($app, h('button', { class: 'alert red', onclick: function () { go('registrations'); } }, h('b', { text: '📝 คำขอลงทะเบียน ' + pend.reg + ' รายการ' }), h('small', { text: 'ตรวจว่าชื่อ LINE ตรงตัวก่อนอนุมัติ' })));
    // ทางลัด
    var list = h('div', { class: 'list' });
    if (can('report.own')) add(list, rowLink('🚨', 'รายงานจับกุม', 'แบบ CCOC — ส่งให้ผู้ตรวจอนุมัติ', function () { go('arrest'); }));
    if (can('view.now')) add(list, rowLink('📍', 'ตอนนี้', 'รถแต่ละคันอยู่สถานะไหน ใครยังไม่รายงาน', function () { go('now'); }));
    add(list, rowLink('📝', 'รายการที่ส่งแล้ว', 'ดู · แก้ไข · ยกเลิก (เข้าเวร ส่งเวร ว.42 ช่วยเหลือ คดี)', function () { go('history'); }));
    add(list, rowLink('👤', 'ผลของฉัน', 'ผลงานรายวงรอบ', function () { go('me'); }));
    if (can('pr.make')) add(list, rowLink('🖼', 'สร้างภาพประชาสัมพันธ์', 'prompt สำหรับ ChatGPT + เบลอรูปบนเครื่อง', function () { go('pr'); }));
    add($app, h('div', { class: 'section-label', text: 'ทางลัด' }), list);
    add($app, h('p', { class: 'muted small center', text: 'v' + S.boot.version + ' · ติดปัญหา แจ้งแอดมินหรือพิมพ์ "ช่วย" ในกลุ่ม' }));
    if (!S._bootAt || Date.now() - S._bootAt > 60000) { S._bootAt = Date.now(); refreshBoot().then(function () { if (S.view === 'home' && JSON.stringify(mine) !== JSON.stringify(S.boot.myShifts || [])) VIEWS.home(); }); }
  };
  VIEWS.menu = VIEWS.home;

  // ======================= แท็บรายงาน =======================
  VIEWS.report = function () {
    setTitle('📝 รายงาน', 'เลือกสิ่งที่จะรายงาน');
    clear($app);
    function tile(ic, color, title, sub, view) { return h('button', { class: 'tile', onclick: function () { go(view); } }, h('span', { class: 'ic', style: 'background:' + color, text: ic }), h('b', { text: title }), sub ? h('small', { text: sub }) : null); }
    if (can('report.own')) {
      add($app, h('div', { class: 'section-label', text: 'ประจำผลัด' }), h('div', { class: 'tiles' },
        tile('▶', 'var(--green)', 'เข้าเวร', 'ยืนยันลูกเรือ/อุปกรณ์', 'checkin'),
        tile('✓', 'var(--blue)', 'ส่งเวร', 'ใบสั่งและผลการปฏิบัติ', 'checkout'),
        tile('🚔', 'var(--amber)', 'ว.42', 'นำขบวน เริ่ม/จบ', 'escort'),
        tile('🤝', 'var(--teal)', 'ช่วยเหลือ', 'ว.18 ว.40 เหตุการณ์', 'assist'),
        tile('🚨', 'var(--red)', 'จับกุม', 'แบบ CCOC', 'arrest'),
        tile('🎖️', 'var(--violet)', 'ภารกิจ', 'จิตอาสา/ปฏิบัติการ', 'mission')));
    } else add($app, card('บทบาทของท่านไม่มีสิทธิ์ส่งรายงาน — ติดต่อแอดมิน'));
    var more = h('div', { class: 'list' });
    add(more, rowLink('📁', 'คดีจับกุม', can('case.approve') ? 'ตรวจ/อนุมัติ/แก้ไข' : 'ติดตามคดี/แก้ไข', function () { go('cases'); }, can('case.approve') && S.boot.pending && S.boot.pending.arrest ? String(S.boot.pending.arrest) : ''));
    if (can('pr.make')) add(more, rowLink('🖼', 'สร้างภาพประชาสัมพันธ์', 'จากคดี/ผลการปฏิบัติ', function () { go('pr'); }));
    add($app, h('div', { class: 'section-label', text: 'หลังรายงาน' }), more);
  };

  // ======================= แท็บเพิ่มเติม =======================
  VIEWS.more = function () {
    setTitle('☰ เพิ่มเติม', S.boot.me.name + ' · ' + S.boot.perms.roleLabel);
    clear($app);
    var pend = S.boot.pending || {};
    function group(label, rows) { rows = rows.filter(Boolean); if (rows.length) add($app, h('div', { class: 'section-label', text: label }), h('div', { class: 'list' }, rows)); }
    group('รายงาน', [rowLink('📝', 'รายการที่ส่งแล้ว', 'ดู · แก้ไข · ยกเลิก', function () { go('history'); })]);
    group('งานคดี', [
      rowLink('📁', 'คดีจับกุม', can('case.approve') ? 'ตรวจ/อนุมัติ/แก้ไข' : 'ติดตามคดี', function () { go('cases'); }, can('case.approve') && pend.arrest ? String(pend.arrest) : ''),
      can('view.suspect') ? rowLink('🔎', 'ค้นหาผู้ต้องหา', 'ชื่อ / เลขบัตร / เบอร์ — ทุกการค้นหาถูกบันทึก', function () { go('suspects'); }) : null,
      can('pr.make') ? rowLink('🖼', 'สร้างภาพประชาสัมพันธ์', 'prompt + เบลอรูป', function () { go('pr'); }) : null]);
    group('ตารางเวรและรายงาน', [
      can('view.now') ? rowLink('🗓', 'ตารางเวร', 'ใครเข้าผลัดไหน · สลับเวร', function () { go('roster'); }) : null,
      can('export') ? rowLink('⬇️', 'ส่งออก', 'Excel สถิติ · ข้อความ บก.ทล.', function () { go('export'); }) : null]);
    var pm = can('people.manage'), ad = S.boot.perms.admin;
    group('บุคลากร', [
      pm || can('perm.manage') || can('view.eval') ? rowLink('👥', 'บุคลากรและสิทธิ์', 'บทบาท · แท็กทักษะ · ผูก LINE', function () { go('admin'); }) : null,
      pm ? rowLink('📝', 'คำขอลงทะเบียน', '', function () { go('registrations'); }, pend.reg ? String(pend.reg) : '') : null,
      pm ? rowLink('📥', 'นำเข้า/อัปเดตกำลังพล', 'จากไฟล์ CSV', function () { go('peopleImport'); }) : null,
      pm || can('perm.manage') ? rowLink('🧾', 'ประวัติการใช้งาน', 'การแก้ไข · การเปิดดูข้อมูลผู้ต้องหา', function () { go('audit'); }) : null]);
    if (ad) group('งานระบบ (เฉพาะแอดมิน)', [
      rowLink('🔐', 'สิทธิ์ตามบทบาท', 'กำหนดว่าแต่ละบทบาทเห็น/ทำอะไรได้', function () { go('roles'); }),
      rowLink('🧾', 'รหัสความผิด', 'เพิ่ม/แก้/ปิดรายการความผิด', function () { go('codes'); }),
      rowLink('⚙️', 'ตั้งค่าระบบ', 'โควตาข้อความ · การแจ้งเตือน · ข้อความมาตรฐาน', function () { go('settings'); })]);
    add($app, h('p', { class: 'muted small center', text: 'v' + S.boot.version + ' · ' + (S.boot.station || '') }));
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

  // ======================= ส่วนประกอบ: ลูกเรือ =======================
  var ROLES = ['พลขับ', 'พงว.', 'ประจำรถ', 'ผบ.รถ', 'แทน', 'เสริม'];
  function crewEditor(expected, existing) {
    var box = card('👮 ลูกเรือ', 'ติ๊กเฉพาะคนที่ขึ้นรถจริง');
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
      pickPerson('เพิ่มลูกเรือ', function (p) { if (!base.some(function (b) { return b.pid === p.pid; })) base.push({ pid: p.pid, role: 'แทน', on: true }); render(); box.dispatchEvent(new Event('crewchange')); });
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
      Promise.resolve().then(fn).then(function () { b.disabled = false; b.textContent = old; }, function (e) { b.disabled = false; b.textContent = old; toast('⚠️ ' + e.message, 5000); });
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
        if (g.record && g.record.checkinAt) add(body, h('div', { class: 'note', text: 'ผลัดนี้กดเข้าเวรแล้วเมื่อ ' + hm(g.record.checkinAt) + ' น. — บันทึกอีกครั้งเพื่อแก้ลูกเรือ/อุปกรณ์' }));
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
          if (e.type === 'ticket') { state.tickets[e.issuerId] = state.tickets[e.issuerId] || {}; state.tickets[e.issuerId][e.sub] = (state.tickets[e.issuerId][e.sub] || 0) + e.count; }
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
        during.forEach(function (e) { add(c, h('div', { class: 'list-item' }, h('span', { text: e.type === 'escort' ? '🚔' : e.type === 'assist' ? '🤝' : '🚨' }), h('div', { class: 'grow', text: e.sub + (e.payload && e.payload.name ? ' · ' + e.payload.name : '') }), e.status === 'active' ? h('span', { class: 'badge amber', text: 'ยังไม่จบ' }) : null)); });
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
      if (!crew.length) { add(ticketsCard, h('p', { class: 'muted', text: 'ติ๊กลูกเรือก่อน' })); updateBar(); return; }
      if (!issuer || !crew.some(function (c) { return c.pid === issuer; })) issuer = crew[0].pid;
      var who = h('div', { class: 'chips', style: 'margin-bottom:10px' });
      crew.forEach(function (c) {
        var n = sumObj(state.tickets[c.pid]);
        add(who, h('button', { class: 'chip' + (c.pid === issuer ? ' on' : ''), onclick: function () { issuer = c.pid; renderTickets(); }, text: '👮 ' + person(c.pid).short + (n ? ' (' + n + ')' : '') }));
      });
      var seg = h('div', { class: 'seg', style: 'margin-bottom:6px' });
      Object.keys(S.boot.groups).forEach(function (g) { add(seg, h('button', { class: g === group ? 'on' : '', onclick: function () { group = g; renderTickets(); }, text: S.boot.groups[g] })); });
      add(ticketsCard, who, seg);
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
        Object.keys(state.tickets).forEach(function (pid) { Object.keys(state.tickets[pid]).forEach(function (code) { var v = S.boot.violations.filter(function (x) { return x.code === code; })[0]; lines.push((v ? v.short : code) + ' ' + state.tickets[pid][code] + ' — ' + person(pid).short); }); });
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
          if (!crew.some(function (c) { return c.pid === pid; })) throw new Error(person(pid).short + ' ไม่ได้อยู่ในลูกเรือ แต่มีใบสั่ง — ติ๊กชื่อหรือลบใบสั่ง');
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
  VIEWS.escort = function (params) {
    setTitle('🚔 นำขบวน ว.42', 'กดเริ่มเมื่อรับขบวน กดจบเมื่อส่งต่อ/ถึงปลายทาง');
    clear($app);
    var active = (S.boot.activeEscorts || []);
    var mine = S.boot.myShifts || [];
    var myCars = mine.map(function (m) { return String(m.car); });
    var act = active.filter(function (e) { return myCars.indexOf(String(e.car)) >= 0; });
    if (act.length) {
      var c = card('⏱ ขบวนที่กำลังนำ');
      act.forEach(function (e) {
        var rt = h('input', { type: 'checkbox' }), ho = h('input', { placeholder: 'ส่งต่อให้ (เช่น ส.ทล.3)' }), res = h('input', { placeholder: 'ผล/หมายเหตุ เช่น ถึงปลายทางปลอดภัย (ไม่บังคับ)' });
        add(c, h('div', { class: 'list-item', style: 'display:block' }, h('b', { text: '🚔 ' + e.car + ' · ' + e.sub + (e.payload.name ? ' · ' + e.payload.name : '') }),
          h('div', { class: 'muted small', text: 'เริ่ม ' + hm(e.payload.start) + ' น.' }), h('label', { class: 'cap' }, rt, 'ไป-กลับ (นับ 2 ขบวน)'), ho, res,
          h('div', { style: 'margin-top:8px' }, submitBtn('🏁 จบขบวน', 'amber block', function () {
            return api('escort.end', { eventId: e.id, roundTrip: rt.checked, handoverTo: ho.value, result: res.value }).then(function (r) { S.boot.activeEscorts = S.boot.activeEscorts.filter(function (x) { return x.id !== e.id; }); done('จบขบวนแล้ว', r.message, { next: 'escort' }); });
          }))));
      });
      add($app, c);
    }
    var cur = null, kind = (S.boot.escortTypes || [])[0] || 'ขบวนทั่วไป';
    var name = h('input', { placeholder: 'เช่น นำส่งอวัยวะ / มศว. / รถอ่อนนุช' }), origin = h('input', { placeholder: 'ต้นทาง เช่น รพ.ชลบุรี' }), dest = h('input', { placeholder: 'ปลายทาง เช่น รพ.ศิริราช' }), from = h('input', { placeholder: 'รับช่วงจาก (ถ้ามี) เช่น ส.ทล.1 / 81' });
    var kinds = h('div', { class: 'chips' });
    function rk() { clear(kinds); S.boot.escortTypes.forEach(function (k) { add(kinds, h('button', { class: 'chip' + (k === kind ? ' on' : ''), onclick: function () { kind = k; if (!name.value || S.boot.escortTypes.indexOf(name.value) >= 0) name.value = k; rk(); }, text: k })); }); }
    rk(); name.value = kind;
    var f = card('▶ เริ่มนำขบวนใหม่'); add(f, h('label', { class: 'f', text: 'ประเภทขบวน' }), kinds, h('label', { class: 'f', text: 'ชื่อขบวน (จะขึ้นในรายงาน)' }), name,
      h('div', { class: 'row2' }, origin, dest), h('label', { class: 'f', text: 'รับช่วง' }), from);
    add($app, shiftPicker('checkin', params, function (s) { cur = s; }), f, bar(submitBtn('▶ เริ่ม ว.42', 'amber', function () {
      if (!cur) throw new Error('กรุณาเลือกผลัดและรถ');
      if (!name.value.trim()) throw new Error('กรุณาระบุชื่อขบวน');
      return api('escort.start', { dutyDate: cur.dutyDate, shift: cur.shift, car: cur.car, kind: kind, name: name.value, from: origin.value, to: dest.value, handoverFrom: from.value }).then(function (r) {
        var t0 = bkkNow(); S.boot.activeEscorts.push({ id: r.eventId, car: cur.car, sub: kind, payload: { name: name.value, start: isoOf(t0) + 'T' + pad(t0.getHours()) + ':' + pad(t0.getMinutes()) } });
        done('เริ่ม ว.42 แล้ว', r.message, { next: 'escort' });
      });
    })));
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
        renderArrestForm({ id: d.id, kind: d.kind, by: p.by || 'เอง', bwc: !!p.bwc, title: p.title || p.charge || '', occurredAt: String(d.occurredAt).slice(0, 16), cat: p.cat,
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
    // รถ/ผลัด: ตั้งต้นจากผลัดปัจจุบันของผู้รายงาน และเติมชุดจับกุมจากลูกเรือ
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
    add(c1, field('หัวข้อ', inp('title', { tag: 'textarea', rows: 2, placeholder: 'เช่น จับกุมปลอมและใช้เอกสารราชการปลอม (รถสวมป้ายทะเบียน)' })),
      field('ประเภทการจับกุม', segPick([['ซึ่งหน้า', '⚡ ซึ่งหน้า'], ['หมายจับ', '📜 หมายจับศาล'], ['ตรวจยึด', '📦 ตรวจยึด']], f.kind, function (v) { f.kind = v; rw(); autosave(); })),
      warrantBox,
      field('จับโดย', segPick([['เอง', 'จับกุมเอง'], ['ร่วม', 'จับกุมร่วม']], f.by, function (v) { f.by = v; autosave(); })),
      h('label', { class: 'cap' }, bwc, 'บันทึกด้วยกล้อง Body Worn Camera'),
      field('วันเวลาจับกุม', inp('occurredAt', { type: 'datetime-local' }), 'นับสถิติตามวันเวลานี้'),
      field('หมวดคดี (ใช้ในรายงาน บก.ทล.)', (function () { var sel = h('select', { onchange: function () { f.cat = sel.value; autosave(); } }); S.boot.arrestCats.forEach(function (c) { add(sel, h('option', { value: c, text: c, selected: c === f.cat })); }); return sel; })()));
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
    api('now').then(function (n) {
      clear($app);
      setTitle('📍 ตอนนี้', SHIFT[n.shift].icon + ' ' + SHIFT[n.shift].label + ' ' + th(n.dutyDate) + ' · ' + hm(n.at) + ' น.');
      var k = card('ผลวันนี้', 'เทียบเมื่อวาน'), kp = h('div', { class: 'kpis' });
      [['🧾', 'ใบสั่ง', 'ticket'], ['🚔', 'ว.42', 'escort'], ['🤝', 'ช่วยเหลือ', 'assist'], ['🚨', 'จับกุม', 'arrest'], ['🗣️', 'ตักเตือน', 'warning'], ['🚛', 'ตรวจรถบรรทุก', 'truck_check']].forEach(function (x) {
        var a = n.today[x[2]] || 0, b = n.yesterday[x[2]] || 0;
        add(kp, h('div', { class: 'kpi' }, h('div', { class: 'n', text: a }), h('div', { class: 't', text: x[0] + ' ' + x[1] }), h('div', { class: 'd ' + (a > b ? 'up' : a < b ? 'down' : ''), text: a > b ? '▲' + (a - b) : a < b ? '▼' + (b - a) : '＝' })));
      });
      add(k, kp); add($app, k);
      var zc = card('🚓 รถใน' + SHIFT[n.shift].label + 'นี้', n.cars.filter(function (c) { return c.status === 'done' || c.status === 'noresult'; }).length + '/' + n.cars.length + ' ส่งเวรแล้ว');
      var cars = h('div', { class: 'cars' });
      n.cars.forEach(function (c) {
        add(cars, h('div', { class: 'car ' + c.status, onclick: function () { carSheet(c); } },
          h('div', { class: 'h' }, h('span', { class: 'st', text: STI[c.status][0] }), h('span', { class: 'grow', text: c.car + (c.crewType === 'จักรยานยนต์' ? ' 🏍' : '') }), h('span', { class: 'badge gray', text: 'เขต ' + c.zone })),
          h('div', { class: 'crew', text: c.crew.map(function (m) { return m.name; }).join(' · ') || '—' }),
          c.escort ? h('div', { class: 'small', text: '🚔 ' + c.escort }) : null,
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
      api('summary', { from: a, to: b, zone: zone }).then(function (s) { renderSummary(out, s); }, function (e) { clear(out); add(out, errorBox(e.message)); });
    }
  };
  function renderSummary(out, s) {
    clear(out);
    var t = s.total, CL = Charts.COLORS, vmap = {}; (S.boot.violations || []).forEach(function (v) { vmap[v.code] = v; });
    var multiDay = s.from !== s.to;
    // 1) ตัวเลขหลัก
    var k = card('รวม ' + (multiDay ? th(s.from) + ' – ' + th(s.to) : th(s.from))), kp = h('div', { class: 'kpis' });
    [['🧾 ใบสั่ง', t.ticket, 'ticket'], ['🚚 พ.ร.บ.ขนส่ง', t.T, 'T'], ['🚗 พ.ร.บ.รถยนต์', t.C, 'C'], ['🚨 จับกุม', t.arrest + (t.arrestPending ? ' (+' + t.arrestPending + '⏳)' : ''), 'arrest'],
      ['🚔 ว.42', t.escort, 'escort'], ['🤝 ช่วยเหลือ', t.assist, 'assist'], ['🗣️ ตักเตือน', t.warning, 'warning'], ['🚛 ตรวจรถบรรทุก', t.truck_check, 'muted']].forEach(function (x) {
      add(kp, h('div', { class: 'kpi', style: 'border-top:3px solid ' + (CL[x[2]] || CL.muted) }, h('div', { class: 'n', text: x[1] }), h('div', { class: 't', text: x[0] })));
    });
    add(k, kp);
    // 2) วินัยการรายงาน
    var d = s.discipline, pct = d.scheduled ? Math.round(d.reported * 100 / d.scheduled) : 0;
    if (d.scheduled) {
      add(k, Charts.gauge(pct, '📋 วินัยการรายงาน: ส่งเวร ' + d.reported + '/' + d.scheduled + ' ผลัด (' + pct + '%)' + (d.noResult ? ' · ไม่มีผล ' + d.noResult : '') + (d.checkedInOnly ? ' · เข้าเวรแต่ไม่ส่ง ' + d.checkedInOnly : '')));
      if (d.missing.length) add(k, h('details', null, h('summary', { class: 'small', text: '🔴 ผลัดที่ยังไม่ส่งเวร ' + d.missing.length + ' ผลัด' }), h('div', { class: 'small', text: d.missing.map(function (m) { return th(m.date) + (m.shift === 'N' ? '🌙' : '☀️') + m.car; }).join(' · ') })));
    }
    add(out, k);
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
    var cats = Object.keys(t.byArrestCat || {}).map(function (c) { return { label: c, value: t.byArrestCat[c] }; });
    if (cats.length) { var ac = card('🚨 สัดส่วนประเภทคดี'); add(ac, Charts.share(cats)); add(out, ac); }
    var ds = card('☀️ กลางวัน vs 🌙 กลางคืน');
    add(ds, Charts.bar([{ label: 'ใบสั่ง', values: { D: s.byShift.D.ticket, N: s.byShift.N.ticket } }, { label: 'ว.42', values: { D: s.byShift.D.escort, N: s.byShift.N.escort } }, { label: 'ช่วยเหลือ', values: { D: s.byShift.D.assist, N: s.byShift.N.assist } }, { label: 'จับกุม', values: { D: s.byShift.D.arrest, N: s.byShift.N.arrest } }],
      [{ key: 'D', label: 'กลางวัน', color: '#f2b544' }, { key: 'N', label: 'กลางคืน', color: '#3b4a6b' }], { height: 150 }));
    add(out, ds);
    // 7) รายบุคคล
    var ppl = Object.keys(s.people).map(function (k) { return s.people[k]; }).sort(function (a, b) { return b.issued - a.issued || b.nShifts - a.nShifts; });
    if (ppl.length) {
      var pc = card('👮 ผลงานรายบุคคล', 'ออกใบสั่ง (หลัก) · ต่อผลัด');
      add(pc, Charts.hbar(ppl.slice(0, 15).map(function (p) { return { label: p.short || p.pid, values: { issued: p.issued } }; }), [{ key: 'issued', label: 'ออกใบสั่ง', color: CL.ticket }], { labelW: 88 }));
      add(pc, h('details', null, h('summary', { class: 'small', text: 'ตารางละเอียด' }),
        table(['ชื่อ', 'ผลัด', 'ออกใบสั่ง', 'ร่วม', 'ต่อผลัด', 'จับ(หลัก/ร่วม)', 'ว.42', 'ช่วย'], ppl.map(function (p) { return [p.short || p.pid, p.nShifts + ' (☀️' + p.nDay + '/🌙' + p.nNight + ')', p.issued, p.ticketJoint, p.ratePerShift, p.arrestPrimary + '/' + p.arrestJoint, p.escort, p.assist]; }))));
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
      api('history.list', { from: p[1], to: p[2] }, { fresh: !!fresh }).then(function (rows) {
        clear(out);
        if (!rows.length) { var e0 = card('ไม่มีรายการ'); add(e0, h('p', { class: 'muted', text: 'ยังไม่มีรายการที่ส่งในช่วงนี้' })); return add(out, e0); }
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
      var m = { void: '🗑 ยกเลิกแล้ว', active: '⏱ กำลังนำขบวน', pending: '⏳ รอตรวจ', approved: '✅ อนุมัติแล้ว', returned: '↩️ ส่งกลับแก้', ok: '✅ บันทึกแล้ว' };
      return (m[r.status] || r.status) + (r.at ? ' ' + hm(r.at) : '');
    }
    function row(r) {
      var title = r.kind === 'shift' ? (r.shift === 'N' ? '🌙' : '☀️') + ' ผลัด' + (r.shift === 'N' ? 'กลางคืน' : 'กลางวัน') + ' · รถ ' + r.car + ' · เขต ' + r.zone : r.title + (r.car ? ' · รถ ' + r.car : '');
      var sub = statusTxt(r) + (r.kind === 'shift' && r.totals && r.totals.ticket ? ' · ใบสั่ง ' + r.totals.ticket : '') + (r.reporter ? ' · โดย ' + r.reporter : '');
      var el = h('div', { class: 'list-item hist' + (r.status === 'void' || r.status === 'ยกเลิก' ? ' off' : '') },
        h('div', { class: 'hist-main' }, h('span', { class: 'ic', text: KIND_ICON[r.kind] || '•' }), h('div', { class: 'tx' }, h('b', { text: title }), h('small', { text: sub }))));
      var btns = h('div', { class: 'hist-btns' });
      if (r.canEdit) add(btns, h('button', { class: 'btn ghost sm', onclick: function () { edit(r); }, text: '✏️ แก้ไข' }));
      if (r.canVoid) add(btns, h('button', { class: 'btn ghost sm red-ghost', onclick: function () { cancel(r); }, text: '🗑 ยกเลิก' }));
      if (r.kind === 'arrest') add(btns, h('button', { class: 'btn ghost sm', onclick: function () { go('case', { id: r.id }); }, text: '📄 เปิดคดี' }));
      if (btns.children.length) add(el, btns);
      return el;
    }
    function edit(r) {
      if (r.kind === 'shift') {
        var q = { d: r.dutyDate, s: r.shift, car: r.car };
        if (r.status === 'ส่งเวร' || r.status === 'ไม่มีผล') return go('checkout', q);
        return modal('แก้ไขผลัดนี้', [h('p', { class: 'muted', text: 'เลือกสิ่งที่ต้องการแก้' }),
          h('button', { class: 'btn block', style: 'margin-bottom:8px', onclick: function () { closeModal(); go('checkin', q); }, text: '🟢 แก้ลูกเรือ/รายการตรวจ (เข้าเวร)' }),
          h('button', { class: 'btn green block', onclick: function () { closeModal(); go('checkout', q); }, text: '✅ ส่งเวร/แก้ผลการปฏิบัติ' })]);
      }
      if (r.kind === 'arrest') return go('arrest', { id: r.id });
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
        p.end ? h('label', { class: 'cap' }, rt, 'ไป-กลับ (นับ 2 ขบวน)') : null, h('label', { class: 'f', text: 'เหตุผล' }), reason], 'บันทึกการแก้ไข', function () {
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
      api('summary', { from: a, to: b }).then(function (s) {
        clear(out);
        var p = s.people[S.boot.me.pid] || { issued: 0, ticketJoint: 0, arrestPrimary: 0, arrestJoint: 0, escort: 0, assist: 0, mission: 0, warning: 0, checks: 0, nShifts: 0, nDay: 0, nNight: 0, ratePerShift: 0 };
        var c = card('ผลงาน ' + th(a) + ' – ' + th(b)), kp = h('div', { class: 'kpis' });
        [['🗓 ผลัด', p.nShifts], ['☀️ กลางวัน', p.nDay], ['🌙 กลางคืน', p.nNight], ['🧾 ออกใบสั่ง', p.issued], ['🤝 ใบสั่งร่วม', p.ticketJoint], ['📈 ใบ/ผลัด', p.ratePerShift],
          ['🚨 จับ (หลัก)', p.arrestPrimary], ['🚨 จับ (ร่วม)', p.arrestJoint], ['🚔 ว.42', p.escort], ['🤝 ช่วยเหลือ', p.assist], ['🎖️ ภารกิจ', p.mission], ['🗣️ ตักเตือน', p.warning]].forEach(function (x) {
          add(kp, h('div', { class: 'kpi' }, h('div', { class: 'n', text: x[1] }), h('div', { class: 't', text: x[0] })));
        });
        add(c, kp); add(out, c);
      }, function (e) { clear(out); add(out, errorBox(e.message)); });
    }), out);
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
      api('roster.day', { date: date.value }).then(function (d) {
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
        add(oc, h('p', { class: 'muted small', text: 'นำเข้าคำสั่งใหม่: ส่งไฟล์ .docx ให้บอทในแชท 1:1 (ผู้มีสิทธิ์นำเข้า)' }));
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
    add(c, h('p', { class: 'muted small', text: 'ตัวเลขหลัก · รายเขต · รายรถ · ประเภทความผิด · ประเภทคดี · รายบุคคล (เฉพาะผู้มีสิทธิ์) · วินัยการรายงาน' }),
      submitBtn('📄 สร้าง PDF สรุปผล', 'block', function () {
        if (!cur) throw new Error('เลือกช่วงวัน');
        toast('กำลังสร้าง PDF… ประมาณ 10–20 วินาที', 8000);
        return api('export.pdf', { from: cur[0], to: cur[1], zone: zone }).then(function (r) { show(r, 'PDF สรุปผล'); });
      }));
    var c1 = card('📗 Excel แบบเจ้าหน้าที่สถิติ', '1 ชีตต่อวัน + สรุป + รายบุคคล');
    add(c1, h('p', { class: 'muted small', text: 'หัวคอลัมน์เดิม: พ.ร.บ.ขนส่ง · พ.ร.บ.รถยนต์ · ตรวจสอบฯรถบรรทุก · ตรวจรถต้องสงสัย · ช่วยเหลือฯ · หมายจับ · อาญาทั่วไป · ว.42 · ภารกิจ + หมายเหตุอัตโนมัติ (ไม่เกิน 31 วัน)' }),
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
    var c4 = card('🧾 ข้อมูลดิบ (CSV)', 'ทุกรายการในช่วง — เปิดในเบราว์เซอร์นอกไลน์เพื่อดาวน์โหลด');
    add(c4, submitBtn('⬇️ ดาวน์โหลด CSV', 'gray block', function () {
      if (!cur) throw new Error('เลือกช่วงวัน');
      return api('export.events', { from: cur[0], to: cur[1] }).then(function (rows) {
        var head = ['id', 'statDate', 'dutyDate', 'shift', 'zone', 'car', 'type', 'sub', 'act', 'count', 'status', 'issuer', 'reporter', 'detail'];
        var csv = '﻿' + head.join(',') + '\n' + rows.map(function (r) { return head.map(function (k) { var v = String(r[k] == null ? '' : r[k]); if (/^[=+\-@]/.test(v)) v = "'" + v; return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(','); }).join('\n');
        downloadB64(btoa(unescape(encodeURIComponent(csv))), 'รายการ_' + cur[0] + '_' + cur[1] + '.csv', 'text/csv');
      });
    }));
    add($app, c, c1, c2, c3, c4);
  };
  /** การ์ดผลลัพธ์ไฟล์ที่เก็บใน Google Drive: เปิด / แชร์เข้าไลน์ / คัดลอกลิงก์ */
  function fileCard(r, label) {
    var c = card('✅ สร้างไฟล์แล้ว', label || '');
    add(c, h('p', { text: r.name, style: 'word-break:break-all;margin:0 0 6px' }), h('p', { class: 'muted small', text: r.restricted ? 'ไฟล์นี้มีข้อมูลผู้ต้องหา จึงไม่เปิดลิงก์สาธารณะ — เปิดด้วยบัญชี Google ของสถานี หรือบันทึกจากปุ่มด้านล่าง' : 'ไฟล์อยู่ในโฟลเดอร์ "LineBot ส่งออก" ใน Google Drive ของสถานี ผู้มีลิงก์เปิดดูได้' }));
    var row = h('div', { class: 'chips', style: 'margin-top:8px' });
    add(row, h('button', { class: 'btn sm', onclick: function () { openExternal(r.url); }, text: '🔗 เปิดไฟล์' }));
    if (!r.restricted) {
      add(row, h('button', { class: 'btn green sm', onclick: function () { postToChat('📎 ' + r.name + '\n' + r.url).then(function (x) { toast(x === 'copied' ? '📋 คัดลอกลิงก์แล้ว' : x === 'cancel' ? 'ยกเลิก' : '💬 ส่งแล้ว'); }); }, text: '💬 ส่งเข้าไลน์' }));
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
  function downloadB64(b64, name, type) {
    var bin = atob(b64), arr = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    var url = URL.createObjectURL(new Blob([arr], { type: type })), a = h('a', { href: url, download: name });
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 4000);
    if (window.liff && liff.isInClient && liff.isInClient()) toast('ถ้าไฟล์ไม่ดาวน์โหลด ให้เปิดหน้านี้ในเบราว์เซอร์ (เมนู ⋮ → เปิดในเบราว์เซอร์)', 6000);
  }

  // ======================= บุคลากรและสิทธิ์ =======================
  VIEWS.admin = function () {
    setTitle('👥 บุคลากรและสิทธิ์', '');
    loading();
    Promise.all([api('admin.people'), api('admin.meta')]).then(function (r) {
      var people = r[0], meta = r[1];
      clear($app);
      var q = h('input', { placeholder: '🔎 ค้นหาชื่อ/นามเรียกขาน', oninput: render }), roleF = h('select', { onchange: render }, h('option', { value: '', text: 'ทุกบทบาท' }), h('option', { value: 'admin', text: 'แอดมิน/แอดมินสำรอง' }));
      meta.roles.forEach(function (x) { add(roleF, h('option', { value: x.id, text: x.label })); });
      var stF = h('select', { onchange: render }, h('option', { value: 'active', text: 'ใช้งานอยู่' }), h('option', { value: 'unlinked', text: 'ยังไม่ผูก LINE' }), h('option', { value: 'inactive', text: 'ปิดบัญชีแล้ว' }), h('option', { value: '', text: 'ทั้งหมด' }));
      var tagF = h('input', { placeholder: '🏷 กรองแท็ก เช่น ใช้คอมเป็น', oninput: render });
      var list = h('div');
      add($app, h('div', { class: 'card' }, q, h('div', { class: 'row', style: 'margin-top:8px' }, h('div', { class: 'grow' }, roleF), h('div', { class: 'grow' }, stF)), h('div', { style: 'margin-top:8px' }, tagF)), list);
      if (meta.isSuper) add($app, h('p', { class: 'muted small', text: 'แต่งตั้งแอดมินสำรอง: แตะชื่อ → "แต่งตั้งเป็นแอดมินสำรอง" (มีได้ 1 คน · ทุกการแก้สิทธิ์/ตั้งค่าของแอดมินสำรองจะแจ้งท่าน)' }));
      function render() {
        clear(list);
        var s = q.value.trim().replace(/\s/g, ''), tf = tagF.value.trim();
        var rows = people.filter(function (p) {
          if (stF.value === 'active' && p.status === 'inactive') return false;
          if (stF.value === 'inactive' && p.status !== 'inactive') return false;
          if (stF.value === 'unlinked' && (p.linked || p.status === 'inactive')) return false;
          if (roleF.value === 'admin') { if (!p.superadmin && !p.backup) return false; } else if (roleF.value && p.effRole !== roleF.value) return false;
          return (!s || (p.first + p.last + (p.callsign || '')).replace(/\s/g, '').indexOf(s) >= 0) && (!tf || p.tags.some(function (t) { return t.indexOf(tf) >= 0; }));
        });
        add(list, h('div', { class: 'section-label', text: rows.length + ' นาย · ผูก LINE แล้ว ' + rows.filter(function (p) { return p.linked; }).length }));
        rows.forEach(function (p) {
          add(list, h('button', { class: 'card clickable', style: 'padding:10px 12px', onclick: function () { edit(p); } },
            h('div', { class: 'row' }, h('b', { class: 'grow', text: p.name }), p.status === 'inactive' ? h('span', { class: 'badge gray', text: 'ปิด' }) : null,
              h('span', { class: 'badge ' + (p.superadmin || p.backup ? 'red' : 'green'), text: p.roleLabel || p.effRole }), h('span', { class: 'badge ' + (p.linked ? 'green' : 'gray'), text: p.linked ? 'LINE ✓' : 'ยังไม่ผูก' })),
            h('div', { class: 'small muted', text: [p.position, p.callsign && 'นามเรียกขาน ' + p.callsign].filter(Boolean).join(' · ') }),
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
        if (can('tags.manage')) {
          tags = p.tags.slice(); var tb = h('div'), ti = h('input', { placeholder: 'เพิ่มแท็ก แล้วกด Enter' });
          var rt = function () { clear(tb); tags.forEach(function (t, i) { add(tb, h('span', { class: 'tag' }, t, h('button', { onclick: function () { tags.splice(i, 1); rt(); }, text: '×' }))); }); };
          ti.onkeydown = function (e) { if (e.key === 'Enter' && ti.value.trim()) { tags.push(ti.value.trim()); ti.value = ''; rt(); } };
          rt();
          var SUG = ['ใช้คอมเป็น', 'มีโน้ตบุ๊ก', 'ทำรายงานไลน์ได้', 'ทำบันทึกจับกุม', 'ทำข้อมูลโทรศัพท์', 'ถนัดสอบปากคำ', 'เก่งรวบรวมเอกสาร', 'ออกแบบภาพประชาสัมพันธ์'];
          var sug = h('div', { class: 'chips', style: 'margin-top:6px' }); SUG.forEach(function (x) { add(sug, h('button', { class: 'chip', onclick: function () { if (tags.indexOf(x) < 0) { tags.push(x); rt(); } }, text: '+ ' + x })); });
          body.push(h('div', { class: 'hr' }), h('label', { class: 'f', text: '🏷 แท็กทักษะ' }), tb, ti, sug);
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
        var canSave = canPerm || tags;
        modal(p.name, body, canSave ? 'บันทึก' : null, function () {
          var jobs = [];
          if (canPerm) jobs.push(api('admin.setAccess', { pid: p.pid, role: roleSel.value, grants: grants, revokes: revokes, scope: scope.value, expires: exp.value, note: note.value }));
          if (tags) jobs.push(api('admin.profile', { pid: p.pid, tags: tags }));
          return Promise.all(jobs).then(function () { toast('✅ บันทึกแล้ว'); VIEWS.admin(); });
        });
      }
    }, function (e) { fail(e, VIEWS.admin); });
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
    setTitle('📥 นำเข้า/อัปเดตกำลังพล', 'จากไฟล์ CSV');
    clear($app);
    var rows = null, file = h('input', { type: 'file', accept: '.csv,text/csv' }), info = h('div');
    var ow = h('input', { type: 'checkbox' }), deact = h('input', { type: 'checkbox' });
    add($app, h('div', { class: 'card' }, h('p', { class: 'small', text: 'หัวคอลัมน์: rank, first, last, nick, callsign, position, phone, birthYear, role, note (ระบบไม่รับเลขบัตร/เลขบัญชี) · role ใส่ได้ทั้งรหัสหรือภาษาไทย เช่น หัวหน้าสถานี' }),
      file, info, h('label', { class: 'cap' }, ow, 'ใช้เบอร์โทรจากไฟล์แทนเบอร์เดิม'), S.boot.perms.admin ? h('label', { class: 'cap' }, deact, 'ปิดบัญชีคนที่ไม่อยู่ในไฟล์ (ย้ายออก) — เฉพาะแอดมิน') : null));
    file.onchange = function () {
      var f = file.files && file.files[0]; if (!f) return;
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
    'people.status': '👤 เปลี่ยนสถานะบัญชี', 'people.import': '📥 นำเข้ากำลังพล', 'people.update': '👤 แก้ข้อมูลกำลังพล', 'export.xlsx': '⬇️ ส่งออก Excel', 'roster.import': '🗓 นำเข้าตารางเวร' };
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
