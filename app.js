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
    if (!ttl) apiInvalidate(); // คำขอเขียน → ข้อมูลที่จำไว้อาจเก่า
    var p = apiRaw(action, data).then(function (v) { if (ttl) apiCache[k] = { at: Date.now(), v: v }; delete inflight[k]; return v; }, function (e) { delete inflight[k]; throw e; });
    if (ttl) inflight[k] = p;
    return p;
  }
  function apiRaw(action, data) {
    var ctl = window.AbortController ? new AbortController() : null;
    var req = fetch(CFG.API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: action, data: data || {}, idToken: S.idToken, viewAs: S.viewAs || undefined }), signal: ctl ? ctl.signal : undefined });
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
  var TOP = { home: 'home', report: 'report', now: 'results', summary: 'results', me: 'results', score: 'results', more: 'more' };
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
    var items = [['now', 'ตอนนี้', 'view.now'], ['summary', 'สรุปผล', 'view.now'], ['me', 'ผลของฉัน', null], ['score', 'คะแนน', null]].filter(function (x) { return !x[2] || can(x[2]); });
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
      var cached = S.uid && !S.viewAs ? bootCacheGet(S.uid) : null;
      if (cached) { applyBoot(cached); open(); refreshBootQuiet(); return; }
      return boot().then(open);
    }).catch(function (e) { window.__booted = true; fail(e, function () { location.reload(); }); });
  }
  // จำ bootstrap ไว้ในเครื่อง (ต่อบัญชี LINE) → เปิดครั้งถัดไปหน้าขึ้นทันที แล้วค่อยอัปเดตเบื้องหลัง
  var BOOT_KEY = 'boot:' + (CFG.LIFF_ID || ''), BOOT_MAX_AGE = 12 * 3600000;
  function bootCacheGet(uid) { try { var j = JSON.parse(localStorage.getItem(BOOT_KEY) || 'null'); return j && j.uid === uid && Date.now() - j.at < BOOT_MAX_AGE && j.b && j.b.registered ? j.b : null; } catch (e) { return null; } }
  function bootCachePut(uid, b) { try { if (b && b.registered) localStorage.setItem(BOOT_KEY, JSON.stringify({ uid: uid, at: Date.now(), b: b })); else localStorage.removeItem(BOOT_KEY); } catch (e) { } }
  function applyBoot(b) { S.boot = b; S._bootAt = Date.now(); setTitle('รายงานผล ' + (b.station || '').split(' ')[0], b.me ? b.me.name + ' · ' + (b.perms.roleLabel || '') : ''); }
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
    // ขบวนที่กำลังนำ
    var myCars = mine.map(function (m) { return String(m.car); });
    (S.boot.activeEscorts || []).filter(function (e) { return myCars.indexOf(String(e.car)) >= 0; }).forEach(function (e) {
      add($app, h('button', { class: 'alert amber', onclick: function () { go('escort'); } }, h('b', { text: '🚔 กำลังนำขบวน ' + e.car + ' — แตะเพื่อจบขบวน' }), h('small', { text: e.sub + (e.payload.name ? ' · ' + e.payload.name : '') + ' · เริ่ม ' + hm(e.payload.start) + ' น.' })));
    });
    // งานรอดำเนินการของผู้ตรวจ/ผู้ดูแล
    var pend = S.boot.pending || {};
    if (can('case.approve') && pend.arrest) add($app, h('button', { class: 'alert red', onclick: function () { go('cases'); } }, h('b', { text: '📥 คดีจับกุมรอตรวจ ' + pend.arrest + ' คดี' }), h('small', { text: 'แตะเพื่อตรวจและอนุมัติ (คดีที่ท่านอยู่ในชุดจับกุมอนุมัติเองไม่ได้)' })));
    if (can('people.manage') && pend.reg) add($app, h('button', { class: 'alert red', onclick: function () { go('registrations'); } }, h('b', { text: '📝 คำขอลงทะเบียน ' + pend.reg + ' รายการ' }), h('small', { text: 'ตรวจว่าชื่อ LINE ตรงตัวก่อนอนุมัติ' })));
    // ภาพรวมสถานี (ทุกคนเห็น) — โหลดตามหลัง ไม่หน่วงปุ่มเข้าเวร/ส่งเวร
    add($app, homeDash());
    // ทางลัด
    var list = h('div', { class: 'list' });
    if (can('report.own')) add(list, rowLink('🚨', 'รายงานจับกุม', 'แบบ CCOC — ส่งให้ผู้ตรวจอนุมัติ', function () { go('arrest'); }));
    if (can('view.now')) add(list, rowLink('📍', 'ตอนนี้', 'รถแต่ละคันอยู่สถานะไหน ใครยังไม่รายงาน', function () { go('now'); }));
    add(list, rowLink('📝', 'รายการที่ส่งแล้ว', 'ดู · แก้ไข · ยกเลิก (เข้าเวร ส่งเวร ว.42 ช่วยเหลือ คดี)', function () { go('history'); }));
    add(list, rowLink('👤', 'ผลของฉัน', 'ผลงานรายวงรอบ', function () { go('me'); }));
    add(list, rowLink('🏅', 'คะแนนผลการปฏิบัติ', 'เกณฑ์ที่ผู้บังคับบัญชาเน้นย้ำ · คะแนนและอันดับของท่าน', function () { go('score'); }));
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
    group('รายงาน', [rowLink('📝', 'รายการที่ส่งแล้ว', 'ดู · แก้ไข · ยกเลิก', function () { go('history'); }),
      rowLink('🏅', 'คะแนนผลการปฏิบัติ', 'เกณฑ์ · คะแนนและอันดับ', function () { go('score'); }),
      can('score.manage') ? rowLink('⚙️', 'ตั้งเกณฑ์คะแนน', 'ช่วงคะแนน · เกณฑ์มาตรฐาน · ประกาศเข้ากลุ่ม', function () { go('scoreAdmin'); }) : null]);
    group('งานคดี', [
      rowLink('📁', 'คดีจับกุม', can('case.approve') ? 'ตรวจ/อนุมัติ/แก้ไข' : 'ติดตามคดี', function () { go('cases'); }, can('case.approve') && pend.arrest ? String(pend.arrest) : ''),
      can('view.suspect') ? rowLink('🔎', 'ค้นหาผู้ต้องหา', 'ชื่อ / เลขบัตร / เบอร์ — ทุกการค้นหาถูกบันทึก', function () { go('suspects'); }) : null,
      can('pr.make') ? rowLink('🖼', 'สร้างภาพประชาสัมพันธ์', 'prompt + เบลอรูป', function () { go('pr'); }) : null]);
    group('ตารางเวรและรายงาน', [
      rowLink('📊', 'ภาพรายงานผู้บังคับบัญชา', 'Dashboard รายวัน/วงรอบ/เดือน · ส่งภาพ + ข้อความเข้าไลน์', function () { go('dash'); }),
      can('view.now') ? rowLink('🗓', 'ตารางเวร', 'ใครเข้าผลัดไหน · สลับเวร', function () { go('roster'); }) : null,
      can('export') ? rowLink('⬇️', 'ส่งออก', 'Excel สถิติ · ข้อความ บก.ทล.', function () { go('export'); }) : null]);
    var pm = can('people.manage'), ad = S.boot.perms.admin;
    group('บุคลากร', [
      pm || can('perm.manage') || can('view.eval') ? rowLink('👥', 'บุคลากรและสิทธิ์', 'บทบาท · แท็กทักษะ · ผูก LINE', function () { go('admin'); }) : null,
      pm ? rowLink('📝', 'คำขอลงทะเบียน', '', function () { go('registrations'); }, pend.reg ? String(pend.reg) : '') : null,
      pm ? rowLink('📥', 'นำเข้า/อัปเดตกำลังพล', 'จากไฟล์ CSV', function () { go('peopleImport'); }) : null,
      pm || can('perm.manage') ? rowLink('🧾', 'ประวัติการใช้งาน', 'การแก้ไข · การเปิดดูข้อมูลผู้ต้องหา', function () { go('audit'); }) : null]);
    if (ad) group('งานระบบ (เฉพาะแอดมิน)', [
      rowLink('👁', 'จำลองมุมมองตามสิทธิ์', 'ดูแอปในมุมของแต่ละบทบาทหรือรายคน', function () { go('viewAs'); }),
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
    var act = active.filter(function (e) { return can('report.editOthers') || myCars.indexOf(String(e.car)) >= 0 || (e.crew || []).indexOf(S.boot.me.pid) >= 0; });
    if (act.length) {
      var c = card('⏱ ขบวนที่กำลังนำ');
      act.forEach(function (e) {
        var rt = h('input', { type: 'checkbox' }), ho = h('input', { placeholder: 'ส่งต่อให้ (เช่น ส.ทล.3)' }), res = h('input', { placeholder: 'ผล/หมายเหตุ เช่น ถึงปลายทางปลอดภัย (ไม่บังคับ)' });
        add(c, h('div', { class: 'list-item', style: 'display:block' }, h('b', { text: '🚔 ' + e.car + ' · ' + e.sub + (e.payload.name ? ' · ' + e.payload.name : '') }),
          h('div', { class: 'muted small', text: 'เริ่ม ' + (e.payload.start ? th(e.payload.start.slice(0, 10)) + ' ' + hm(e.payload.start) + ' น.' : '') + (myCars.indexOf(String(e.car)) < 0 ? ' · กดจบแทนลูกเรือได้ (ผู้ดูแล)' : '') }), h('label', { class: 'cap' }, rt, 'ไป-กลับ (นับ 2 ขบวน)'), ho, res,
          h('div', { style: 'margin-top:8px' }, submitBtn('🏁 จบขบวน', 'amber block', function () {
            return api('escort.end', { eventId: e.id, roundTrip: rt.checked, handoverTo: ho.value, result: res.value }).then(function (r) { S.boot.activeEscorts = S.boot.activeEscorts.filter(function (x) { return x.id !== e.id; }); done('จบขบวนแล้ว', r.message, { next: 'escort' }); });
          }))));
      });
      add($app, c);
    }
    var cur = null, kind = (S.boot.escortTypes || [])[0] || 'ขบวนทั่วไป';
    var name = h('input', { placeholder: 'เช่น นำส่งอวัยวะ / มศว. / รถอ่อนนุช' }), origin = h('input', { placeholder: 'ต้นทาง เช่น รพ.ชลบุรี' }), dest = h('input', { placeholder: 'ปลายทาง เช่น รพ.ศิริราช' }), from = h('input', { placeholder: 'รับช่วงจาก (ถ้ามี) เช่น ส.ทล.1 / 81' });
    var kinds = h('div', { class: 'chips' });
    function rk() { clear(kinds); S.boot.escortTypes.forEach(function (k) { add(kinds, h('button', { class: 'chip' + (k === kind ? ' on' : ''), onclick: function () { kind = k; if (!name.value || S.boot.escortTypes.indexOf(name.value) >= 0) name.value = k; rk(); }, text: k === 'ขบวนเสด็จ' ? 'ขบวนเสด็จ (ถปภ.)' : k })); }); }
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
    api('now').then(function (n) {
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
            mayEnd ? h('button', { class: 'btn amber sm', onclick: function () { go('escort'); }, text: '🏁 จบขบวน' }) : null));
        });
        add(ec, h('p', { class: 'muted small', text: 'ลูกเรือ และหัวหน้าสถานี/จ่ากอง/เจ้าหน้าที่รายงาน/แอดมิน กดจบได้ · ถ้าไม่มีใครกด ระบบปิดเองเมื่อพ้นผลัด 2 ชม.' }));
        add($app, ec);
      }
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
  /** ตารางรายคัน (จัดกลุ่มตามเขต) — compact = หน้าแรก (คอลัมน์หลัก), เต็ม = หน้าสรุปผล (ผลัด ฐานความผิด ลูกเรือ ต่อผลัด) */
  function boardTable(cars, opts) {
    opts = opts || {}; cars = activeCars(cars);
    if (!cars.length) return h('p', { class: 'muted small', text: 'ยังไม่มีข้อมูลรายรถในช่วงนี้' });
    var cols = opts.compact
      ? [['รถ', 'car'], ['อาญา', 'arrest', 1], ['จราจร', 'ticket', 1], ['ว.42', 'escort', 1], ['ช่วยเหลือ', 'assist', 1], ['คะแนน', 'score', 1]]
      : [['รถ', 'car'], ['ผลัด', 'shifts'], ['อาญา', 'arrest', 1], ['ฐานความผิด', 'crimes'], ['จราจร', 'ticket', 1], ['ว.42', 'escort', 1], ['ช่วยเหลือ', 'assist', 1], ['คะแนน', 'score', 1], ['ต่อผลัด', 'perShift', 1], ['ลูกเรือ', 'crew']];
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
      h('p', { class: 'small muted', style: 'margin:6px 0 0', text: '▲▼ เทียบช่วงยาวเท่ากันก่อนหน้า (เลือกวงรอบ/เดือนเต็มจะเทียบวงรอบ/เดือนก่อน) · เลือกได้ครั้งละไม่เกิน 6 เดือน' }));
  }
  /** แนวโน้มช่วงยาว (> 62 วัน) รวมเป็นรายสัปดาห์ */
  function weekly(days) {
    if (days.length <= 62) return days;
    var out = [];
    for (var i = 0; i < days.length; i += 7) { var w = { d: days[i].d }; days.slice(i, i + 7).forEach(function (x) { ['ticket', 'arrest', 'escort', 'assist'].forEach(function (k) { w[k] = (w[k] || 0) + (x[k] || 0); }); }); out.push(w); }
    return out;
  }
  /** ภาพรวมสถานีบนหน้าแรก (ทุกคนเห็น) */
  function homeDash() {
    var kind = S.homeKind || 'cycle', chips = h('div', { class: 'chips' }), panel = h('div'), body = h('div'), seqH = 0;
    function rc() {
      clear(chips); HOME_KIND.forEach(function (x) { add(chips, h('button', { class: 'chip' + (kind === x[0] ? ' on' : ''), onclick: function () { kind = S.homeKind = x[0]; rc(); if (kind !== 'custom' || S.homeRange) load(); else { clear(body); } }, text: x[1] })); });
      clear(panel); if (kind === 'custom') add(panel, homeRangePanel(S.homeRange, function (a, b) { S.homeRange = [a, b]; load(); }));
    }
    function load(fresh) {
      var my = ++seqH; clear(body); add(body, skeleton(2));
      var q = { kind: kind, fresh: !!fresh }; if (kind === 'custom') { q.from = S.homeRange[0]; q.to = S.homeRange[1]; }
      api('home', q).then(function (d) { if (my === seqH && body.isConnected) render(d); }, function (e) { if (my === seqH) { clear(body); add(body, errorBox(e.message)); } });
    }
    function rangeText(a, b) { return a === b ? th(a) : th(a) + ' – ' + th(b); }
    function render(d) {
      clear(body);
      var t = d.total, p = d.prevTotal, CL = Charts.COLORS, custom = d.kind === 'custom';
      add(body, h('div', { class: 'small muted', style: 'margin:2px 4px 8px' }, rangeText(d.from, d.to) + ' · ▲▼ เทียบ ' + rangeText(d.prev.from, d.prev.to) + ' · อัปเดต ' + hm(d.at) + ' น. ',
        h('button', { class: 'linkbtn', onclick: function () { load(true); }, text: '↻ รีเฟรช' })));
      // 1) ตัวเลขหลัก
      function tile(ic, label, v, pv, sub, color, cls) { return h('div', { class: 'kpi hk' + (cls ? ' ' + cls : ''), style: 'border-top:3px solid ' + color }, h('div', { class: 't', text: ic + ' ' + label }), h('div', { class: 'n' }, fmtN(v), dlt(v, pv)), sub ? h('div', { class: 'd muted', text: sub }) : null); }
      var kp = h('div', { class: 'kpis' });
      add(kp, tile('🚨', 'จับกุมอาญา', t.arrest, p.arrest, 'หมายจับ ' + t.arrestWarrant + ' หมาย' + (t.arrestWarrant ? ' (' + (t.warrantPersons || 0) + ' ราย)' : '') + ' · ซึ่งหน้า ' + t.arrestFlag + ' ราย · รถหนัก ' + (t.overweight || 0) + ' ราย' + (t.arrestPending ? ' · รอตรวจ ' + t.arrestPending : ''), CL.arrest || DK.navy),
        tile('🧾', 'คดีจราจร', t.ticket, p.ticket, 'ขส ' + t.T + ' · รย ' + t.C + (t.R ? ' · จร ' + t.R : ''), CL.ticket || DK.blue),
        tile('🚔', 'นำขบวน ว.42', t.escort, p.escort, '', CL.escort || DK.amber), tile('🤝', 'ช่วยเหลือ', t.assist, p.assist, '', CL.assist || DK.teal),
        tile('🛡️', 'ถปภ.', t.escortRoyal || 0, p.escortRoyal || 0, 'ถวายความปลอดภัย (ขบวน)', '#b45309', 'nz'),
        tile('📦', 'ของกลาง', t.evidence.length, null, t.evidence.slice(0, 3).map(function (x) { return x.item + ' ' + fmtN(x.qty) + ' ' + x.unit; }).join(' · ') || 'ไม่มี', DK.teal));
      var k = card('📊 ผลการปฏิบัติ' + (custom ? ' ' + rangeText(d.from, d.to) : d.kind === 'day' ? 'วันนี้' : d.kind === 'month' ? 'เดือนนี้' : 'วงรอบนี้')); add(k, kp);
      var crimes = Object.keys(t.byCrime || {}).filter(function (x) { return t.byCrime[x]; }).sort(function (a, b) { return t.byCrime[b] - t.byCrime[a]; });
      if (crimes.length) add(k, h('div', { class: 'small', style: 'margin-top:8px' }, h('b', { text: 'ฐานความผิด: ' }), crimes.map(function (x) { return (DASH_CAT[x] || x) + ' ' + t.byCrime[x]; }).join(' · ')));
      if (d.discipline.scheduled) add(k, h('div', { class: 'small muted', style: 'margin-top:6px', text: '📋 ส่งเวรแล้ว ' + d.discipline.reported + '/' + d.discipline.scheduled + ' ผลัด (' + Math.round(d.discipline.reported * 100 / d.discipline.scheduled) + '%)' }));
      add(body, markZeros(k));
      // 2) ตอนนี้ + งานค้าง
      var n = d.now, nc = card('📍 ตอนนี้ · ' + SHIFT[n.shift].icon + ' ผลัด' + SHIFT[n.shift].label + ' ' + th(n.dutyDate), can('view.now') ? h('button', { class: 'linkbtn', onclick: function () { go('now'); }, text: 'ดูรายคัน ›' }) : null);
      var st = h('div', { class: 'nowst' });
      [['🟢', 'ออกปฏิบัติ', n.on.length + n.escorts.filter(function (e) { return n.on.indexOf(e.car) < 0; }).length, 'green'], ['✅', 'ส่งเวรแล้ว', n.done.length, 'blue'], ['⏳', 'รอเข้าเวร', n.waiting.length, 'gray'], ['🔴', 'ยังไม่เข้าเวร', n.missing.length, 'red'], ['🚔', 'กำลังนำขบวน', n.escorts.length, 'amber']].forEach(function (x) {
        add(st, h('div', { class: 'ns ' + x[3] }, h('b', { text: x[2] }), h('span', { text: x[0] + ' ' + x[1] })));
      });
      add(nc, st);
      if (n.missing.length) add(nc, h('div', { class: 'small', style: 'margin-top:8px' }, h('b', { style: 'color:var(--red)', text: '🔴 ยังไม่เข้าเวร: ' }), n.missing.join(', ')));
      n.escorts.forEach(function (e) { add(nc, h('div', { class: 'small', style: 'margin-top:4px', text: '🚔 รถ ' + e.car + ' · ' + e.name + (e.start ? ' · เริ่ม ' + hm(e.start) + ' น.' : '') })); });
      if (n.overdue.length) add(nc, h('div', { class: 'small', style: 'margin-top:6px' }, h('b', { style: 'color:var(--amber)', text: '⚠️ เลยกำหนดส่งเวร: ' }), n.overdue.map(function (m) { return th(m.date) + (m.shift === 'N' ? '🌙' : '☀️') + m.car; }).join(' · ')));
      add(body, nc);
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
    return h('div', { class: 'home-dash' }, h('div', { class: 'section-label', text: 'ภาพรวมสถานี' }), chips, panel, h('div', { style: 'height:8px' }), body);
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
        h('details', { style: 'margin-top:10px' }, h('summary', { class: 'small', text: '📋 ตารางละเอียดรายรถ (ผลัด · ฐานความผิด · ลูกเรือ · ต่อผลัด)' }), boardTable(s.board.cars),
          h('p', { class: 'small muted', style: 'margin:6px 0 0', text: 'คดีจับร่วมนับให้ทุกคันที่ร่วม · (ตัวเลข) หลังชื่อ = จำนวนผลัดที่ขึ้นรถคันนั้น · ต่อผลัด = คะแนน ÷ ผลัด' })),
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
    Object.keys(x.cat || {}).forEach(function (k) { if (x.cat[k] !== x.flag) items.push(['🚨 ซึ่งหน้า ' + k, x.cat[k], 'ราย']); });
    L.items.forEach(function (i) { if (x[i[0]]) items.push([i[1], x[i[0]], i[2]]); });
    if (x.missed) items.push(['🔴 ไม่ส่งเวรตามกำหนด', x.missed, 'ผลัด']);
    if (emph.length) add(c, h('div', { class: 'emph' }, h('b', { text: '⭐ เน้นย้ำช่วงนี้' }), emph.map(function (k) { return h('div', { text: (cmap[k] ? cmap[k].label : k) + ' — ' + fmtPts(x.code[k]) + ' คะแนน/ใบ' }); })));
    var tbl = h('div', { class: 'crit' });
    items.forEach(function (i) { add(tbl, h('div', { class: 'ci' }, h('span', { text: i[0] }), h('b', { class: i[1] < 0 ? 'neg' : '', text: fmtPts(i[1]) + ' / ' + i[2] }))); });
    add(c, tbl, h('p', { class: 'muted small', text: 'ใบสั่ง: ลูกเรือทุกคนในรถได้คะแนนเท่ากัน · จับกุม: หมายจับคิดต่อหมาย (1 ราย 3 หมาย = 3 หมาย) ซึ่งหน้าคิดต่อราย · คดีร่วมหลายคัน: รถผู้จับหลักได้ ' + fmtPts(x.primaryPct != null ? x.primaryPct : 60) + '% รถที่ร่วมแบ่งส่วนที่เหลือ (รวม 100%) ระบุรถหลักไม่ได้หารเท่ากัน · ทุกคนในรถได้เท่าส่วนของรถ' }));
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
        add(ac, cg, field('คดีร่วมหลายคัน: รถผู้จับหลักได้ (%)', joint, 'รถที่ร่วมแบ่งส่วนที่เหลือเท่ากัน รวม 100% · ระบุรถหลักไม่ได้หารเท่ากัน · ทุกคนในรถได้เท่าส่วนของรถ'));
        add($app, ac);
        // บริการ/ภารกิจ/วินัย
        var itIn = {}, sc = card('🤝 งานบริการ ภารกิจ และวินัย');
        var ig = h('div', { class: 'grid2' });
        L.items.forEach(function (i) { itIn[i[0]] = num(x[i[0]]); add(ig, field(i[1] + ' (ต่อ' + i[2] + ')', itIn[i[0]])); });
        var missed = num(Math.abs(x.missed));
        add(ig, field('🔴 ไม่ส่งเวร หัก (ต่อผลัด)', missed, 'หักลูกเรือทุกคนในรถ'));
        add(sc, ig); add($app, sc);
        var note = h('textarea', { placeholder: 'ข้อความเน้นย้ำถึงเจ้าหน้าที่ (แสดงในประกาศ)' }); note.value = w ? w.note || '' : (copyFrom && copyFrom.note) || '';
        var reason = h('input', { placeholder: 'เหตุผลการแก้ไข (บันทึกในประวัติ)' });
        var ncard = card('📝 หมายเหตุ'); add(ncard, note); if (w) add(ncard, field('เหตุผลการแก้ไข', reason)); add($app, ncard);
        add($app, bar(h('button', { class: 'btn gray', onclick: function () { VIEWS.scoreAdmin(); }, text: 'ยกเลิก' }), submitBtn('บันทึกเกณฑ์', 'green grow', function () {
          var cat = {}; L.cats.forEach(function (k) { if (catIn[k].value !== '') cat[k] = catIn[k].value; });
          var wts = { act: { T: actIn.T.value, C: actIn.C.value, R: actIn.R.value }, code: x.code, warrant: war.value, flag: flag.value, cat: cat, primaryPct: joint.value, missed: missed.value };
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
  var SCORE_PARTS = [['arrest', 'อาญา', DK.navy], ['ticket', 'จราจร', DK.blue], ['service', 'ว.42/ช่วยเหลือ', DK.amber], ['mission', 'ภารกิจ/จิตอาสา', DK.teal]];
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
  function weightNote(cr) { var L = weightItems(cr); return L.length ? L.join(' · ') + ' · ทุกคนในรถได้เท่าส่วนของรถ' : ''; }
  function weightItems(cr) {
    if (!cr || !cr.weights) return [];
    // คะแนนที่เป็น 0 ไม่แสดง (ผู้ใช้กำหนด 10 ต.ค. 69) · ตรวจรถไม่คิดคะแนน
    var w = cr.weights, a = w.act || {}, f = fmtN, L = [];
    var cats = Object.keys(w.cat || {}).filter(function (k) { return +w.cat[k] && +w.cat[k] !== +w.flag; }).map(function (k) { return (DASH_CAT[k] || k) + ' ' + f(w.cat[k]); });
    if (+w.flag || cats.length) L.push('ซึ่งหน้า' + (+w.flag ? ' ' + f(w.flag) + '/ราย' : '') + (cats.length ? ' (' + cats.join(' · ') + ')' : ''));
    if (+w.warrant) L.push('หมายจับ ' + f(w.warrant) + '/หมาย');
    var acts = [['ขส', a.T], ['รย', a.C], ['จร', a.R]].filter(function (x) { return +x[1]; }), nc = Object.keys(w.code || {}).filter(function (k) { return +w.code[k]; }).length;
    var tk = acts.length === 3 && +a.T === +a.C && +a.C === +a.R ? 'ใบสั่ง ' + f(a.T) + '/ราย' : acts.length ? 'ใบสั่ง ' + acts.map(function (x) { return x[0] + ' ' + f(x[1]); }).join(' · ') + ' /ราย' : '';
    if (tk || nc) L.push((tk || 'ใบสั่ง') + (nc ? ' (ข้อหาเน้นย้ำ ' + nc + ' รายการ)' : ''));
    [['ว.42', w.escort, 'ขบวน'], ['ช่วยเหลือ', w.assist, 'ครั้ง'], ['ตักเตือน', w.warning, 'ราย'], ['ภารกิจ/จิตอาสา', w.mission, 'ครั้ง']].forEach(function (x) { if (+x[1]) L.push(x[0] + ' ' + f(x[1]) + '/' + x[2]); });
    if (+w.missed) L.push('ไม่ส่งเวรหัก ' + f(Math.abs(w.missed)) + '/ผลัด');
    if (!L.length) L.push('-');
    var pp = w.primaryPct == null ? 60 : +w.primaryPct;
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
  /** ภาพที่ 4: สัดส่วนภารกิจทั้งสถานี + แท่ง 100% รายรถ (เรียงตามคะแนน) */
  function dashMix(d) {
    var b = d.board, rows = mixRows(b.mix, true), v = mixView(rows, 13);
    var cars = byScore(b.cars).filter(function (c) { return c.mix && Object.keys(c.mix).length; });
    var rh = Math.max(50, Math.min(64, Math.floor(700 / Math.max(cars.length, 1)))), lh = 40;
    var Lh = 440 + v.list.length * lh + 24, Rh = 132 + cars.length * rh + 96, ch = Math.max(Lh, Rh, 800), H = Math.max(1080, 222 + ch + 40);
    var st = ab('dsh', 0, 0, 1920, H); st.setAttribute('data-h', H);
    add(st, header(d));
    var tt = ab('d-title', 46, 140, 1500, null, 'font-size:52px'); tt.textContent = 'สัดส่วนภารกิจ ' + dashTitle(d.from, d.to, false, d._kind).replace(/^ผลการปฏิบัติงาน/, ''); add(st, tt);
    var pn = ab('d-note', 0, 166, 0, null, 'right:48px;left:auto;font-size:26px'); pn.textContent = 'คิดตามคะแนนเกณฑ์ของสถานี'; add(st, pn);
    // ทั้งสถานี
    var L = ab('d-card', 46, 222, 640, ch); add(st, L);
    var t1 = ab('d-h2', 30, 22, null, null, 'font-size:36px'); t1.textContent = 'ทั้งสถานี'; add(L, t1);
    var dn = ab('d-donut', 150, 86, 340, 340); add(dn, donut(340, 56, v.parts), h('div', { class: 'd-center' }, h('b', { style: 'font-size:72px', text: fmtN(Math.round(rows.total)) }), h('span', { text: 'คะแนน' }))); add(L, dn);
    add(L, mixLegend(v.list, 34, 446, 572, lh, 24, 1, true));
    // รายรถ
    var R = ab('d-card', 706, 222, 1168, ch); add(st, R);
    var t2 = ab('d-h2', 30, 22, null, null, 'font-size:36px'); t2.textContent = 'แยกรายรถ (เรียงตามคะแนน)'; add(R, t2);
    var used = MIX_CATS.filter(function (c) { return cars.some(function (x) { return x.mix[c[0]] && x.mix[c[0]].p > 0; }); });
    var lg = ab('mx-key', 30, 78, 1110, 40); used.forEach(function (c) { add(lg, h('span', null, h('i', { style: 'background:' + c[4] }), c[2])); }); add(R, lg);
    var bx = 250, bw = 740;
    cars.forEach(function (c, i) {
      var y = 132 + i * rh, rr = mixRows(c.mix), x = bx;
      if (i % 2 === 0) add(R, ab('sb-band', 16, y, 1136, rh));
      var lab = ab('sb-lab', 30, y, 210, rh); add(lab, h('i', { text: String(i + 1) }), h('b', { class: 'cno', style: 'font-size:26px', text: c.car }), h('small', { text: c.zone ? 'เขต ' + c.zone : '' })); add(R, lab);
      rr.forEach(function (r) {
        if (!(r.pct > 0)) return;
        var ww = r.pct / 100 * bw, seg = ab('mx-seg', x, y + 8, Math.max(1, ww - 2), rh - 16, 'background:' + r.color + ';color:' + (darkColor(r.color) ? '#fff' : DK.navy));
        if (ww >= 64) seg.textContent = (ww >= 150 ? r.short + ' ' : '') + pctText(r.pct);
        add(R, seg); x += ww;
      });
      var sc = ab('mx-sc', bx + bw + 16, y, 140, rh); add(sc, h('b', { text: fmt1(c.score) }), h('span', { text: ' คะแนน' })); add(R, sc);
    });
    if (!cars.length) { var e = ab('d-note', 30, 140, 1000, null); e.textContent = 'ยังไม่มีผลงานรายรถในช่วงนี้'; add(R, e); }
    var ft = ab('d-note', 30, ch - 74, 1110, null, 'font-size:20px;white-space:normal'); ft.textContent = 'แถบ = สัดส่วนคะแนนของรถคันนั้นแยกตามภารกิจ (ยาวเท่ากันทุกคัน) · คดีร่วมหลายคัน: รถผู้จับหลักได้ ' + fmtN(primaryPctOf(b)) + '% รถร่วมแบ่งส่วนที่เหลือ · ตรวจยึดที่ไม่มีผู้ต้องหาคิดเท่าจับกุมซึ่งหน้า 1 ราย · หักคะแนนไม่ส่งเวรไม่รวมในสัดส่วน'; add(R, ft);
    return markZeros(st);
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
    add(c, h('p', { class: 'small muted', style: 'margin:8px 0 0', text: 'คิดสัดส่วนจากคะแนนตามเกณฑ์ของสถานี (งานยาก/สำคัญมีน้ำหนักมากกว่า) · ตัวเลขข้างชื่อ = จำนวนจริง · ตรวจยึดที่ไม่มีผู้ต้องหาคิดเท่าจับกุมซึ่งหน้า 1 ราย' }));
    return c;
  }
  /** ภาพตารางรายรถ 1920×1080 (สูงขึ้นอัตโนมัติถ้ารถมาก) */
  function dashCars(d) {
    var b = d.board, cars = b.cars.filter(function (c) { return c.shifts || c.arrest || c.ticket || c.escort || c.assist || c.checks || c.score; });
    var headH = 66, totH = 60, rh = Math.max(44, Math.min(60, Math.floor((760 - headH - totH) / Math.max(cars.length, 1)))), tblH = headH + cars.length * rh + totH, H = Math.max(1080, 222 + tblH + 100);
    var st = ab('dsh', 0, 0, 1920, H); st.setAttribute('data-h', H);
    add(st, header(d));
    var tt = ab('d-title', 46, 140, 1500, null, 'font-size:52px'); tt.textContent = 'ผลการปฏิบัติแยกรายรถ ' + dashTitle(d.from, d.to, false, d._kind).replace(/^ผลการปฏิบัติงาน/, ''); add(st, tt);
    var pn = ab('d-note', 0, 166, 0, null, 'right:48px;left:auto;font-size:26px'); pn.textContent = '▲▼ เทียบ' + prevLabel(b.prev); add(st, pn);
    var big = Math.round(Math.min(30, rh * 0.5)), sm = rh >= 52 ? 17 : 15;
    var T = ab('d-card ct', 46, 222, 1828, tblH); add(st, T);
    function num(v, pv, extra) { var x = h('div', { class: 'nv' }, h('b', { style: 'font-size:' + big + 'px', text: fmtN(v) }), pv == null ? null : delta(v, pv)); return extra ? [x, h('small', { style: 'font-size:' + sm + 'px', text: extra })] : [x]; }
    var maxOf = {}; ['arrest', 'ticket', 'escort', 'assist', 'score', 'perShift'].forEach(function (k) { maxOf[k] = Math.max.apply(null, cars.map(function (c) { return +c[k] || 0; }).concat([1])); });
    function heat(k, v) { return v > 0 ? 'background:rgba(37,99,235,' + (0.05 + 0.2 * v / maxOf[k]).toFixed(3) + ')' : ''; }
    var COLS = [
      ['เขต', 84], ['รถ', 110, function (c) { return [h('b', { style: 'font-size:' + (big - 1) + 'px', text: c.car })]; }],
      ['ผลัดที่ออก', 120, function (c) { return num(c.shifts, null, 'วัน ' + c.D + ' · คืน ' + c.N); }],
      ['ลูกเรือ', 300, function (c) { var top = c.crew.length ? c.crew[0].n : 0; return [h('div', { class: 't', style: 'font-size:' + (sm + 2) + 'px;max-height:' + (rh - 6) + 'px', text: c.crew.map(function (m) { return m.name + (m.n < top ? '(' + m.n + ')' : ''); }).join(' · ') || '-' })]; }, 'l'],
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
    // รวมทั้งสถานี (ยอดสถานีตามรายงาน ไม่นับคดีร่วมซ้ำ)
    var t = d.total, sc = cars.reduce(function (s, c) { return s + (+c.score || 0); }, 0), shs = cars.reduce(function (s, c) { return s + c.shifts; }, 0);
    var tr = ab('ct-row ct-tot', 0, headH + cars.length * rh, 1828, totH), TOT = [[h('b', { text: 'รวมทั้งสถานี' })], null, [h('b', { text: fmtN(shs) })], [h('small', { text: cars.length + ' คัน' })],
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
  /** ภาพรายการคดีอาญา/ตรวจยึด (สูงตามจำนวนคดี) — ไม่มีข้อมูลผู้ต้องหา */
  function dashCases(d) {
    var cs = d.board.cases, rh = 70, top = 296, headH = 56, H = Math.max(1080, top + headH + cs.length * rh + 90);
    var st = ab('dsh', 0, 0, 1920, H); st.setAttribute('data-h', H);
    add(st, header(d));
    var tt = ab('d-title', 46, 140, 1828, null, 'font-size:52px'); tt.textContent = 'รายละเอียดคดีอาญาและของกลาง ' + dashTitle(d.from, d.to, false, d._kind).replace(/^ผลการปฏิบัติงาน/, ''); add(st, tt);
    var nW = cs.filter(function (c) { return c.kind === 'หมายจับ'; }).length, nF = cs.filter(function (c) { return c.kind === 'ซึ่งหน้า'; }).length, nS = cs.length - nW - nF;
    var sumL = ab('d-note', 46, 226, 1828, null, 'font-size:27px;color:#334155');
    sumL.textContent = 'รวม ' + cs.length + ' คดี · หมายจับ ' + nW + ' · ซึ่งหน้า ' + nF + (nS ? ' · ตรวจยึด ' + nS : '') + '   |   ยอดจับกุมนับในสถิติ ' + fmtN(d.total.arrest) + (d.total.arrestWarrant ? ' (ซึ่งหน้า ' + fmtN(d.total.arrestFlag) + ' ราย · หมายจับ ' + fmtN(d.total.arrestWarrant) + ' หมาย ' + fmtN(d.total.warrantPersons || 0) + ' ราย)' : ' ราย') + (d.evidence.length ? '   |   ของกลาง: ' + d.evidence.map(function (x) { return x.item + ' ' + fmtN(x.qty) + ' ' + x.unit; }).join(', ') : '');
    add(st, sumL);
    var COLS = [['#', 56], ['วัน เวลา', 168], ['รถ', 206], ['ประเภท', 130], ['ฐานความผิด', 300], ['เรื่อง / ข้อหา', 580], ['ผู้ต้องหา', 112], ['ของกลาง', 276]];
    var T = ab('d-card ct', 46, top, 1828, headH + cs.length * rh); add(st, T);
    var hr = ab('ct-row ct-head', 0, 0, 1828, headH); COLS.forEach(function (k) { add(hr, h('div', { class: 'ct-c', style: 'width:' + k[1] + 'px', text: k[0] })); }); add(T, hr);
    var PILL = { 'หมายจับ': 'background:#0f2744;color:#fff', 'ซึ่งหน้า': 'background:#f59e0b;color:#0f2744', 'ตรวจยึด': 'background:#0d9488;color:#fff' };
    cs.forEach(function (c, i) {
      var row = ab('ct-row', 0, headH + i * rh, 1828, rh, i % 2 ? 'background:#f8fafc' : ''), sameT = !c.offense || c.title.indexOf(c.offense.replace(/…$/, '')) >= 0;
      var cells = [
        [h('b', { style: 'font-size:22px', text: String(i + 1) })],
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
    var p = inGroup && liff.isInClient && liff.isInClient() ? liff.sendMessages(msgs).then(function () { return 'sent'; }, function () { return null; }) : Promise.resolve(null);
    return p.then(function (r) {
      if (r) return r;
      if (window.liff && liff.isApiAvailable && liff.isApiAvailable('shareTargetPicker')) return liff.shareTargetPicker(msgs).then(function (x) { return x ? 'shared' : 'cancel'; }, function () { return copyText(fallbackText).then(function () { return 'copied'; }); });
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
      h('p', { class: 'muted small', style: 'margin:6px 0 0', text: 'ส่งครั้งเดียวได้ครบ: ภาพหลัก + ตารางรายรถ (ผลัด ลูกเรือ อาญา จราจร ว.42 ช่วยเหลือ คะแนน เทียบรอบก่อน) + สัดส่วนภารกิจรายรถ + รายการคดีอาญา + ข้อความรายงาน' })), out);
    function range() { return data.from + (data.to !== data.from ? '_' + data.to : ''); }
    /** ภาพที่ส่ง: ภาพหลัก → ตารางรายรถ → สัดส่วนภารกิจรายรถ → รายการคดี (ถ้ามีคดี) */
    function pages() {
      var a = [{ key: 'main', name: 'Dashboard ' + range() + (layout === 'full' ? ' ละเอียด' : '') + '.png', node: layout === 'full' ? dashFull(data) : dashCompact(data) }];
      if (data.board) {
        a.push({ key: 'cars', name: 'รายรถ ' + range() + '.png', node: dashCars(data) });
        if (data.board.mix && Object.keys(data.board.mix).length) a.push({ key: 'mix', name: 'สัดส่วนภารกิจ ' + range() + '.png', node: dashMix(data) });
        if (data.board.cases.length) a.push({ key: 'cases', name: 'คดีอาญา ' + range() + '.png', node: dashCases(data) });
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
        if (ps.length > 1) add(out, h('div', { class: 'section-label', style: 'margin:4px 2px 6px', text: 'ภาพที่ ' + (i + 1) + ' · ' + (pg.key === 'main' ? 'ภาพหลัก' : pg.key === 'cars' ? 'ตารางรายรถ' : pg.key === 'mix' ? 'สัดส่วนภารกิจรายรถ' : 'รายการคดีอาญา (' + data.board.cases.length + ' คดี)') }));
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
            h('div', { class: 'small muted', text: [p.position, p.callsign && 'นามเรียกขาน ' + p.callsign, p.scoreGroupEff && p.scoreGroupEff !== 'สายตรวจ' && 'หมวดคะแนน: ' + p.scoreGroupEff].filter(Boolean).join(' · ') }),
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
          var jobs = [];
          if (canPerm) jobs.push(api('admin.setAccess', { pid: p.pid, role: roleSel.value, grants: grants, revokes: revokes, scope: scope.value, expires: exp.value, note: note.value }));
          if (tags) jobs.push(api('admin.profile', { pid: p.pid, tags: tags }));
          if (sgSel && sgSel.value !== (p.scoreGroup || '')) jobs.push(api('admin.profile', { pid: p.pid, scoreGroup: sgSel.value }));
          return Promise.all(jobs).then(function () { toast('✅ บันทึกแล้ว'); VIEWS.admin(); });
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
