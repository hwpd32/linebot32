/* readers.js — อ่านไฟล์ PTM (.xls แบบ BIFF8) และ KTB (.xlsx แม้นามสกุลเป็น .xls)
 * อ่านเองทั้งหมด ไม่พึ่งไลบรารีภายนอก (ยกเว้น JSZip สำหรับ .xlsx)
 * ไม่เก็บชื่อ/เลขบัตรของผู้ชำระ
 */
(function (root) {
  'use strict';
  let JSZipLib = root.JSZip, DOMP = root.DOMParser;
  if (typeof require !== 'undefined' && (!JSZipLib || !DOMP)) {
    try { JSZipLib = JSZipLib || require('jszip'); DOMP = DOMP || require('@xmldom/xmldom').DOMParser; } catch (e) { }
  }
  class FileProblem extends Error {
    constructor(code, msg, detail) { super(msg); this.code = code; this.detail = detail || ''; }
  }
  const td = (b) => new TextDecoder('utf-8').decode(b);

  // ======================= CFB (OLE2) =======================
  function readCFB(u8) {
    const SIG = [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1];
    for (let i = 0; i < 8; i++) if (u8[i] !== SIG[i]) throw new FileProblem('NOT_OLE', 'ไม่ใช่ไฟล์ Excel แบบเก่า');
    const dv0 = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    const ssz = 1 << dv0.getUint16(30, true);
    const mssz = 1 << dv0.getUint16(32, true);
    // เติมให้ครบเซกเตอร์ (ไฟล์จาก PTM มักขาดท้าย)
    const padLen = Math.ceil((u8.length - 512) / ssz) * ssz + 512;
    let buf = u8;
    if (padLen !== u8.length) { buf = new Uint8Array(padLen); buf.set(u8); }
    const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    const nsect = (buf.length - 512) / ssz;
    const nFat = dv.getUint32(44, true), dirStart = dv.getUint32(48, true);
    const miniCut = dv.getUint32(56, true), miniFatStart = dv.getUint32(60, true), nMiniFat = dv.getUint32(64, true);
    let difatStart = dv.getUint32(68, true); const nDifat = dv.getUint32(72, true);
    const secOff = s => 512 + s * ssz;
    const fatSecs = [];
    for (let i = 0; i < 109 && fatSecs.length < nFat; i++) fatSecs.push(dv.getUint32(76 + i * 4, true));
    let guard = 0;
    while (fatSecs.length < nFat && difatStart < nsect && guard++ < 1000) {
      for (let i = 0; i < ssz / 4 - 1 && fatSecs.length < nFat; i++) fatSecs.push(dv.getUint32(secOff(difatStart) + i * 4, true));
      difatStart = dv.getUint32(secOff(difatStart) + ssz - 4, true);
    }
    const fat = [];
    for (const s of fatSecs) {
      if (s >= nsect) throw new FileProblem('CORRUPT', 'ไฟล์เสีย (ตาราง FAT ผิด)');
      for (let i = 0; i < ssz / 4; i++) fat.push(dv.getUint32(secOff(s) + i * 4, true));
    }
    function chain(start, limit) {
      const out = []; let s = start; const seen = new Set();
      while (s !== 0xFFFFFFFE && s !== 0xFFFFFFFF) {
        if (s >= nsect || s >= fat.length || seen.has(s)) throw new FileProblem('CORRUPT', 'ไฟล์เสียหรือดาวน์โหลดไม่ครบ');
        seen.add(s); out.push(s); s = fat[s];
        if (out.length > (limit || 1e6)) break;
      }
      return out;
    }
    function readChain(start, size) {
      const secs = chain(start); const out = new Uint8Array(secs.length * ssz);
      secs.forEach((s, i) => out.set(buf.subarray(secOff(s), secOff(s) + ssz), i * ssz));
      return size !== undefined ? out.subarray(0, size) : out;
    }
    const dirBytes = readChain(dirStart);
    const entries = [];
    for (let o = 0; o + 128 <= dirBytes.length; o += 128) {
      const dv2 = new DataView(dirBytes.buffer, dirBytes.byteOffset + o, 128);
      const nlen = dv2.getUint16(64, true); const type = dv2.getUint8(66);
      if (type === 0) continue;
      let name = ''; for (let i = 0; i < Math.max(0, nlen / 2 - 1); i++) name += String.fromCharCode(dv2.getUint16(i * 2, true));
      entries.push({ name, type, start: dv2.getUint32(116, true), size: dv2.getUint32(120, true) });
    }
    const rootE = entries.find(e => e.type === 5);
    function getStream(name) {
      const e = entries.find(x => x.type === 2 && x.name.toLowerCase() === name.toLowerCase());
      if (!e) return null;
      if (e.size < miniCut && rootE) {
        const ministream = readChain(rootE.start, rootE.size);
        const mf = readChain(miniFatStart); const mfat = [];
        for (let i = 0; i < nMiniFat * ssz / 4; i++) mfat.push(new DataView(mf.buffer, mf.byteOffset).getUint32(i * 4, true));
        const out = new Uint8Array(e.size); let s = e.start, pos = 0, g = 0;
        while (pos < e.size && s !== 0xFFFFFFFE && g++ < 1e6) { out.set(ministream.subarray(s * mssz, s * mssz + Math.min(mssz, e.size - pos)), pos); pos += mssz; s = mfat[s]; }
        return out;
      }
      return readChain(e.start, e.size);
    }
    return { entries, getStream };
  }

  // ======================= BIFF8 =======================
  function readBIFF(wb) {
    const dv = new DataView(wb.buffer, wb.byteOffset, wb.byteLength);
    const recs = []; let p = 0;
    while (p + 4 <= wb.length) {
      const id = dv.getUint16(p, true), len = dv.getUint16(p + 2, true);
      if (p + 4 + len > wb.length) throw new FileProblem('CORRUPT', 'ไฟล์ดาวน์โหลดไม่ครบ (ข้อมูลขาดตอนท้าย)');
      recs.push({ id, off: p + 4, len }); p += 4 + len;
      if (id === 0x0A && recs.filter(r => r.id === 0x0A).length >= 2) break;
    }
    // SST
    let sst = [];
    const si = recs.findIndex(r => r.id === 0xFC);
    if (si >= 0) {
      const parts = [wb.subarray(recs[si].off, recs[si].off + recs[si].len)];
      for (let j = si + 1; j < recs.length && recs[j].id === 0x3C; j++) parts.push(wb.subarray(recs[j].off, recs[j].off + recs[j].len));
      sst = readSST(parts);
    }
    // sheet cells: records after the 2nd BOF
    const bofs = recs.map((r, i) => r.id === 0x809 ? i : -1).filter(i => i >= 0);
    if (bofs.length < 2) throw new FileProblem('CORRUPT', 'ไฟล์ไม่มีข้อมูลชีต');
    const grid = new Map(); let sawEOF = false;
    const setc = (r, c, v) => { if (!grid.has(r)) grid.set(r, new Map()); grid.get(r).set(c, v); };
    const rk = (x) => { let v; if (x & 2) v = (x >> 2); else { const b = new DataView(new ArrayBuffer(8)); b.setUint32(4, x & 0xFFFFFFFC, true); b.setUint32(0, 0, true); v = b.getFloat64(0, true); } return (x & 1) ? v / 100 : v; };
    for (let j = bofs[1] + 1; j < recs.length; j++) {
      const r = recs[j]; const o = r.off;
      if (r.id === 0x0A) { sawEOF = true; break; }
      if (r.id === 0xFD) { const row = dv.getUint16(o, true), col = dv.getUint16(o + 2, true), idx = dv.getUint32(o + 6, true); if (idx >= sst.length) throw new FileProblem('CORRUPT', 'ไฟล์เสีย (ข้อความอ้างอิงผิด)'); setc(row, col, sst[idx]); }
      else if (r.id === 0x203) { setc(dv.getUint16(o, true), dv.getUint16(o + 2, true), dv.getFloat64(o + 6, true)); }
      else if (r.id === 0x27E) { setc(dv.getUint16(o, true), dv.getUint16(o + 2, true), rk(dv.getUint32(o + 6, true))); }
      else if (r.id === 0xBD) { const row = dv.getUint16(o, true), c1 = dv.getUint16(o + 2, true); const n = (r.len - 6) / 6; for (let k = 0; k < n; k++) setc(row, c1 + k, rk(dv.getUint32(o + 4 + k * 6 + 2, true))); }
      else if (r.id === 0x204) { const row = dv.getUint16(o, true), col = dv.getUint16(o + 2, true); const cch = dv.getUint16(o + 6, true), fl = wb[o + 8]; let s = ''; if (fl & 1) { for (let k = 0; k < cch; k++) s += String.fromCharCode(dv.getUint16(o + 9 + k * 2, true)); } else { for (let k = 0; k < cch; k++) s += String.fromCharCode(wb[o + 9 + k]); } setc(row, col, s); }
      else if (r.id === 0x06) { const row = dv.getUint16(o, true), col = dv.getUint16(o + 2, true); if (dv.getUint16(o + 12, true) !== 0xFFFF) setc(row, col, dv.getFloat64(o + 6, true)); }
    }
    if (!sawEOF) throw new FileProblem('CORRUPT', 'ไฟล์ดาวน์โหลดไม่ครบ (ไม่พบจุดสิ้นสุดชีต)');
    return grid;
  }
  function readSST(parts) {
    const out = []; let bi = 0, p = 8;
    const d0 = new DataView(parts[0].buffer, parts[0].byteOffset, parts[0].byteLength);
    const uniq = d0.getUint32(4, true);
    const u8 = () => parts[bi];
    const dvp = () => new DataView(parts[bi].buffer, parts[bi].byteOffset, parts[bi].byteLength);
    function ensure() { if (p >= u8().length) { bi++; p = 0; if (bi >= parts.length) throw new FileProblem('CORRUPT', 'ไฟล์เสีย (ตารางข้อความไม่ครบ)'); } }
    while (out.length < uniq) {
      ensure();
      const d = dvp(); const cch = d.getUint16(p, true); const fl = u8()[p + 2]; p += 3;
      let rt = 0, ext = 0;
      if (fl & 8) { rt = dvp().getUint16(p, true); p += 2; }
      if (fl & 4) { ext = dvp().getUint32(p, true); p += 4; }
      let s = '', left = cch, hi = fl & 1;
      while (left > 0) {
        if (p >= u8().length) { bi++; p = 0; if (bi >= parts.length) throw new FileProblem('CORRUPT', 'ไฟล์เสีย (ข้อความขาด)'); hi = u8()[0] & 1; p = 1; }
        const avail = Math.floor((u8().length - p) / (hi ? 2 : 1)); const n = Math.min(left, avail);
        const dd = dvp();
        if (hi) { for (let k = 0; k < n; k++) s += String.fromCharCode(dd.getUint16(p + k * 2, true)); p += n * 2; }
        else { for (let k = 0; k < n; k++) s += String.fromCharCode(u8()[p + k]); p += n; }
        left -= n;
        if (n === 0 && left > 0) { bi++; p = 0; if (bi >= parts.length) throw new FileProblem('CORRUPT', 'ไฟล์เสีย'); hi = u8()[0] & 1; p = 1; }
      }
      let skip = rt * 4 + ext;
      while (skip > 0) { const a = Math.min(skip, u8().length - p); p += a; skip -= a; if (skip > 0) { bi++; p = 0; if (bi >= parts.length) break; } }
      out.push(s);
    }
    return out;
  }

  // ======================= PTM =======================
  const CH_ROWS = ['STATION', 'CROSS STATION', 'KTB', 'FASTPAY', 'BANKINGAGENT', 'DEPARTMENT OF LAND TRANSPORT', 'อื่นๆ'];
  function chanGroup(ch) {
    const c = (ch || '').trim().toUpperCase();
    if (c.startsWith('KTB')) return 'KTB';
    if (c.startsWith('BANKINGAGENT')) return 'BA';
    if (c === 'FASTPAY') return 'FASTPAY';
    if (c === 'CROSS STATION') return 'CROSS';
    if (c === 'STATION') return 'STATION';
    if (c.startsWith('DEPARTMENT OF LAND')) return 'DLT';
    return 'OTHER';
  }
  const GROUP_OF_ROW = { 'STATION': 'STATION', 'CROSS STATION': 'CROSS', 'KTB': 'KTB', 'FASTPAY': 'FASTPAY', 'BANKINGAGENT': 'BA', 'DEPARTMENT OF LAND TRANSPORT': 'DLT', 'อื่นๆ': 'OTHER' };
  const numOf = (v) => { if (typeof v === 'number') return v; const s = String(v || '').replace(/,/g, '').trim(); if (s === '') return 0; const n = Number(s); if (isNaN(n)) throw new FileProblem('FORMAT', 'รูปแบบตัวเลขในไฟล์ PTM ไม่ถูกต้อง: ' + v); return n; };
  const r2 = (x) => Math.round(x * 100) / 100;
  function sniff(u8) {
    let i = 0; while (i < u8.length && (u8[i] === 0xEF || u8[i] === 0xBB || u8[i] === 0xBF || u8[i] <= 0x20)) i++;
    return u8[i];
  }
  function jsonMessage(u8) {
    try { const j = JSON.parse(td(u8)); const h = j.header || {}; return (h.statusDescription || JSON.stringify(j)).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); }
    catch (e) { return td(u8).slice(0, 200); }
  }
  function parsePTM(u8, fileName) {
    const first = sniff(u8);
    if (first === 0x7B) throw new FileProblem('PTM_ERROR', 'ไฟล์นี้ไม่ใช่รายงาน แต่เป็นข้อความแจ้งเตือนจาก PTM: "' + jsonMessage(u8) + '" กรุณาออกจากระบบ PTM แล้วเข้าใหม่ จากนั้นดาวน์โหลดอีกครั้ง');
    if (first === 0x3C) throw new FileProblem('PTM_ERROR', 'ไฟล์นี้เป็นหน้าเว็บ ไม่ใช่รายงาน Excel กรุณาดาวน์โหลดใหม่');
    const cfb = readCFB(u8);
    const wbs = cfb.getStream('Workbook') || cfb.getStream('Book');
    if (!wbs) throw new FileProblem('CORRUPT', 'ไฟล์ PTM เสียหรือดาวน์โหลดไม่ครบ กรุณาดาวน์โหลดใหม่');
    const g = readBIFF(wbs);
    const cell = (r, c) => { const row = g.get(r); if (!row) return ''; const v = row.get(c); return v === undefined ? '' : v; };
    const s = (r, c) => String(cell(r, c)).trim();
    const h0 = s(0, 0), h1 = s(1, 0), h13 = s(1, 3);
    const md = /วันที่\s*:\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(h0);
    if (!md || !/รายงานการรับชำระค่าปรับประจำวัน/.test(h1)) throw new FileProblem('FORMAT', 'ไม่ใช่ "รายงานการรับชำระค่าปรับประจำวัน (ตามประเภทพรบ.)" จาก PTM หรือรูปแบบรายงานเปลี่ยน — กรุณาแจ้งผู้ดูแลระบบ');
    const date = iso(Number(md[3]) - 543, Number(md[2]), Number(md[1]));
    const mu = /รหัสหน่วยงาน\s*:\s*(\d+)/.exec(h13); const unit = mu ? mu[1] : null;
    const station = (/หน่วยงาน\s*:\s*(.*?)\s*รหัสหน่วยงาน/.exec(h13) || [])[1] || '';
    const maxRow = Math.max(...g.keys());
    // คอลัมน์เจ้าหน้าที่ผู้ออกใบสั่ง (รหัสหมวก + ชื่อ) หาจากหัวตาราง — ไม่อ่านคอลัมน์ของผู้มาชำระเงินเด็ดขาด
    const officerCols = (r) => {
      const o = { badge: -1, officer: -1 };
      for (let c = 0; c < 20; c++) {
        const t = s(r, c).replace(/\s+/g, ' ');
        if (/ผู้มาชำระ|ผู้ชำระ|ประชาชน/.test(t)) continue;
        if (t === 'รหัสหมวก') o.badge = c;
        else if (/^ชื่อ\s*-?\s*สกุล\s*เจ้าหน้าที่/.test(t)) o.officer = c;
      }
      return o;
    };
    const sections = []; let cur = null; let state = 'none';
    for (let r = 2; r <= maxRow; r++) {
      const a = s(r, 0);
      const rowEmpty = [...Array(11).keys()].every(c => s(r, c) === '');
      if (rowEmpty) continue;
      const onlyA = a !== '' && [...Array(10).keys()].every(c => s(r, c + 1) === '');
      if (a.startsWith('พ.ร.บ') && onlyA) {
        if (cur && state !== 'done') throw new FileProblem('CORRUPT', `ส่วน "${cur.act}" ไม่ครบ (ไม่พบยอดรวม) — ไฟล์อาจดาวน์โหลดไม่ครบ`);
        cur = { act: a, items: [], summary: null, channels: {} }; sections.push(cur); state = 'header'; continue;
      }
      if (!cur) continue;
      if (a === 'วันที่ชำระเงิน') { state = 'items'; cur.oc = officerCols(r); continue; }
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(a) && state === 'items') {
        const ch = s(r, 6), oc = cur.oc || {};
        cur.items.push({ act: cur.act, paydate: a, issued: s(r, 1), ticket: s(r, 2), law: s(r, 3), offense: s(r, 4), amount: numOf(cell(r, 5)), channel: ch, group: chanGroup(ch), docDate: date,
          badge: oc.badge >= 0 ? s(r, oc.badge) : '', officer: oc.officer >= 0 ? s(r, oc.officer) : '' });
        continue;
      }
      if (a === 'รายการรวม') { cur.summary = { count: numOf(cell(r, 3)), amount: numOf(cell(r, 8)) }; state = 'channels'; }
      const chName = s(r, 2);
      if ((state === 'channels') && CH_ROWS.includes(chName) && s(r, 4) === 'รายการ') {
        cur.channels[chName] = { count: numOf(cell(r, 3)), amount: numOf(cell(r, 8)) };
        if (Object.keys(cur.channels).length === CH_ROWS.length) state = 'done';
        continue;
      }
      if (a === 'รายการรวม') continue;
      if (state === 'items' && a !== '') throw new FileProblem('FORMAT', `พบข้อมูลที่ไม่รู้จักในไฟล์ PTM แถว ${r + 1}: "${a}" — รูปแบบรายงานอาจเปลี่ยน กรุณาแจ้งผู้ดูแลระบบ`);
    }
    if (cur && state !== 'done') throw new FileProblem('CORRUPT', `ส่วน "${cur.act}" ไม่ครบ — ไฟล์อาจดาวน์โหลดไม่ครบ กรุณาดาวน์โหลดใหม่`);
    // ตรวจยอด
    for (const sec of sections) {
      const n = sec.items.length, amt = r2(sec.items.reduce((x, i) => x + i.amount, 0));
      if (n !== sec.summary.count || Math.abs(amt - sec.summary.amount) > 0.001)
        throw new FileProblem('CORRUPT', `ยอดรายการของ ${sec.act} (${n} รายการ ${amt}) ไม่ตรงกับยอดรวมในไฟล์ (${sec.summary.count} รายการ ${sec.summary.amount}) — ไฟล์อาจไม่ครบ`);
      const chSum = r2(Object.values(sec.channels).reduce((x, c) => x + c.amount, 0));
      if (Math.abs(chSum - sec.summary.amount) > 0.001) throw new FileProblem('CORRUPT', `ยอดแยกช่องทางของ ${sec.act} ไม่เท่ายอดรวม`);
      for (const [row, grp] of Object.entries(GROUP_OF_ROW)) {
        const want = sec.channels[row] ? sec.channels[row].amount : 0;
        const got = r2(sec.items.filter(i => i.group === grp).reduce((x, i) => x + i.amount, 0));
        if (Math.abs(want - got) > 0.001) throw new FileProblem('CORRUPT', `ยอดช่องทาง ${row} ของ ${sec.act} ไม่ตรงกับรายการ (${got} ≠ ${want})`);
      }
    }
    const items = sections.flatMap(x => x.items);
    return { kind: 'PTM', fileName, date, unit, station, sections, items, total: r2(items.reduce((x, i) => x + i.amount, 0)) };
  }
  function iso(y, m, d) { return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`; }

  // ======================= KTB =======================
  async function readXlsxGrid(u8) {
    const zip = await JSZipLib.loadAsync(u8);
    const wbx = new DOMP().parseFromString(await zip.file('xl/workbook.xml').async('string'), 'application/xml');
    const rels = new DOMP().parseFromString(await zip.file('xl/_rels/workbook.xml.rels').async('string'), 'application/xml');
    const sheet = wbx.getElementsByTagName('sheet')[0];
    const rid = sheet.getAttribute('r:id') || sheet.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
    let target = null; const rl = rels.getElementsByTagName('Relationship');
    for (let i = 0; i < rl.length; i++) if (rl[i].getAttribute('Id') === rid) target = rl[i].getAttribute('Target');
    target = target.startsWith('/') ? target.slice(1) : 'xl/' + target;
    const sst = [];
    const sf = zip.file('xl/sharedStrings.xml');
    if (sf) {
      const d = new DOMP().parseFromString(await sf.async('string'), 'application/xml');
      const sis = d.getElementsByTagName('si');
      for (let i = 0; i < sis.length; i++) { const ts = sis[i].getElementsByTagName('t'); let s = ''; for (let j = 0; j < ts.length; j++) s += ts[j].textContent; sst.push(s); }
    }
    const d = new DOMP().parseFromString(await zip.file(target).async('string'), 'application/xml');
    const cs = d.getElementsByTagName('c'); const grid = new Map();
    for (let i = 0; i < cs.length; i++) {
      const c = cs[i]; const a = c.getAttribute('r'); const m = /^([A-Z]+)(\d+)$/.exec(a); if (!m) continue;
      let col = 0; for (const ch of m[1]) col = col * 26 + ch.charCodeAt(0) - 64;
      const row = +m[2]; const t = c.getAttribute('t'); let v = '';
      const vEl = c.getElementsByTagName('v')[0];
      if (t === 's') v = sst[+vEl.textContent]; else if (t === 'inlineStr') { const ts = c.getElementsByTagName('t'); for (let j = 0; j < ts.length; j++) v += ts[j].textContent; } else if (vEl) v = vEl.textContent;
      if (!grid.has(row)) grid.set(row, new Map()); grid.get(row).set(col, v);
    }
    return grid;
  }
  async function parseKTB(u8, fileName) {
    const first = sniff(u8);
    if (first === 0x7B || first === 0x3C) throw new FileProblem('KTB_ERROR', 'ไฟล์ KTB ไม่ใช่รายงาน Excel (อาจเป็นหน้าแจ้งเตือน) กรุณาดาวน์โหลดใหม่');
    if (!(u8[0] === 0x50 && u8[1] === 0x4B)) throw new FileProblem('FORMAT', 'รูปแบบไฟล์ KTB ไม่ใช่แบบที่รู้จัก (ต้องเป็นไฟล์จาก KTB Corporate Online) — กรุณาแจ้งผู้ดูแลระบบ');
    const g = await readXlsxGrid(u8);
    const s = (r, c) => { const row = g.get(r); return row && row.get(c) !== undefined ? String(row.get(c)).trim() : ''; };
    if (s(6, 1) !== 'Account No.' || s(11, 1) !== 'Date' || s(11, 6) !== 'Amount')
      throw new FileProblem('FORMAT', 'หัวตารางไฟล์ KTB ไม่ตรงกับที่รู้จัก — รูปแบบไฟล์อาจเปลี่ยน กรุณาแจ้งผู้ดูแลระบบ');
    const account = s(6, 2);
    const lines = []; let totalCr = null, totalDr = null; const dates = new Set();
    const maxRow = Math.max(...g.keys());
    for (let r = 12; r <= maxRow; r++) {
      const a = s(r, 1);
      if (a.startsWith('Total Cr')) { totalCr = numOf(a.split('=')[1]); totalDr = numOf((s(r, 4).split('=')[1] || '0')); continue; }
      const m = /^(\d{2})-(\d{2})-(\d{4})\s+(\d{2}:\d{2}:\d{2})$/.exec(a);
      if (!m) { if (a) throw new FileProblem('FORMAT', `ไฟล์ KTB มีแถวที่ไม่รู้จัก (แถว ${r}): ${a}`); continue; }
      const date = iso(+m[3], +m[2], +m[1]); dates.add(date);
      const teller = s(r, 2), code = s(r, 3), desc = s(r, 4), cheque = s(r, 5), amt = numOf(s(r, 6));
      let type, agent = null;
      const ag = /^\s*([A-Za-z]{1,6})\s*-\s*Auto Transfer/i.exec(desc);   // "PO - Auto Transfer" = ไปรษณีย์, "FS - Auto Transfer" = FSMART (ตัวแทนธนาคาร)
      if (amt < 0) type = 'OUT';
      else if (ag) { type = 'BA'; agent = ag[1].toUpperCase(); }
      else if (/Auto Transfer/i.test(desc)) type = 'KTB';                    // "92386 - Auto Transfer" = ช่องทาง KTB ของวันเดียวกัน
      else if (/Payment gateway/i.test(desc)) type = 'FASTPAY';
      else if (/Bulk Transfer/i.test(desc)) type = 'CROSS';
      else if (code === 'ATDDC' || /^CDM|^CD[A-Z]/.test(code)) type = 'DEPOSIT';
      else type = 'UNKNOWN';
      lines.push({ time: m[4], date, teller, code, desc, amount: amt, type, agent, row: r });
    }
    if (dates.size > 1) throw new FileProblem('FORMAT', 'ไฟล์ KTB มีรายการหลายวันในไฟล์เดียว — กรุณาดาวน์โหลดแยกวันละไฟล์');
    const cr = r2(lines.filter(l => l.amount > 0).reduce((x, l) => x + l.amount, 0));
    const dr = r2(lines.filter(l => l.amount < 0).reduce((x, l) => x + l.amount, 0));
    if (totalCr !== null && (Math.abs(cr - totalCr) > 0.001 || Math.abs(dr - totalDr) > 0.001))
      throw new FileProblem('CORRUPT', `ยอดรวมในไฟล์ KTB ไม่ตรงกับรายการ (เครดิต ${cr} ≠ ${totalCr}) — ไฟล์อาจไม่ครบ`);
    const date = dates.size ? [...dates][0] : null;
    return { kind: 'KTB', fileName, account, date, lines, totalCr: cr, totalDr: dr, empty: lines.length === 0 };
  }
  // เดาชนิดไฟล์จากเนื้อหา
  async function identify(u8, fileName) {
    const first = sniff(u8);
    if (u8[0] === 0x50 && u8[1] === 0x4B) {
      const k = await parseKTB(u8, fileName);
      return k;
    }
    return parsePTM(u8, fileName);
  }
  const api = { readCFB, readBIFF, parsePTM, parseKTB, identify, FileProblem, chanGroup, iso };
  root.Readers = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

/* ptmdaily.js — อ่านรายงานรายวันจาก PTM (.xls) ในเบราว์เซอร์ แล้วคัดเฉพาะช่องที่ระบบใช้ (v1.22)
 *  - สรุปการใช้ใบสั่ง (TicketUsedDaily) · สรุปการยกเลิกใบสั่ง (TicketCancelDaily) · สรุปการว่ากล่าว/ตักเตือน (TicketWarnDaily)
 *  - รายงานการรับชำระค่าปรับประจำวัน (ตามประเภท พ.ร.บ.) → ใช้ parsePTM เดิม
 * ไม่อ่าน/ไม่ส่ง เลขประจำตัว 13 หลัก ชื่อผู้ครอบครองรถ หรือชื่อ/เลขบัตรผู้มาชำระเงิน (เลือกคอลัมน์จากหัวตาราง)
 * ต้องโหลดหลัง readers.js (window.Readers)
 */
(function (root) {
  'use strict';
  var R = root.Readers;
  var KIND_LABEL = { used: 'สรุปการใช้ใบสั่ง', cancel: 'สรุปการยกเลิกใบสั่ง', warn: 'สรุปการว่ากล่าว/ตักเตือน', act: 'รับชำระค่าปรับ (แยก พ.ร.บ.)' };
  var DMY = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
  function beIso(s) { var m = DMY.exec(String(s || '').trim()); if (!m) return ''; var y = +m[3]; if (y > 2400) y -= 543; return R.iso(y, +m[2], +m[1]); }
  function clean(s, n) { return String(s == null ? '' : s).replace(/\d{13}/g, '').replace(/\s+/g, ' ').trim().slice(0, n || 160); }
  // ช่องที่ห้ามอ่าน (ข้อมูลประชาชน)
  var BAN = /13\s*หลัก|เลขบัตร|ผู้ครอบครอง|ผู้กระทำ|ผู้มาชำระ|ผู้ชำระ|ประชาชน/;
  var COLS = {
    used: { rd: /^วันที่ออกใบสั่ง/, id: /^วันที่เกิดเหตุ/, ty: /^ประเภทใบสั่ง/, t: /^เลขที่ใบสั่ง/, off: /^ความผิด/, b: /^รหัส\s*หมวก/, o: /เจ้าหน้าที่ออกใบสั่ง/ },
    cancel: { d: /^วันที่ยกเลิก/, rd: /^วันที่ออกใบสั่ง/, id: /^วันที่เกิดเหตุ/, t: /^เลขที่ใบสั่ง/, off: /^ความผิด/, why: /^เหตุผล/, b: /^รหัส\s*หมวก/, o: /เจ้าหน้าที่ออกใบสั่ง/, ap: /เจ้าหน้าที่ยกเลิก/ },
    warn: { d: /^วันที่ตักเตือน/, tm: /^เวลา/, rd: /^วันที่ออกใบสั่ง/, id: /^วันที่เกิดเหตุ/, t: /^เลขที่ใบสั่ง/, off: /^ความผิด/, b: /^รหัส\s*หมวก/, o: /เจ้าหน้าที่ออกใบสั่ง/, ap: /ผู้อนุญาต/, st: /^สถานะ/ }
  };
  var TYPE_ROW = { 'ประเภทใบสั่งกล้องออโต้': '01', 'ประเภทใบสั่งกล้อง': '02', 'ประเภทใบสั่งเล่ม': '03', 'ประเภทใบสั่งอิเล็กทรอนิกส์': '04', 'ประเภทใบสั่งคดีจราจร': '05' };

  function grid(u8) {
    if (u8[0] === 0x7B || u8[0] === 0x3C) throw new R.FileProblem('PTM_ERROR', 'ไฟล์นี้ไม่ใช่รายงาน Excel (อาจหมดเวลาเข้าระบบ PTM) กรุณาดาวน์โหลดใหม่');
    var cfb = R.readCFB(u8), wbs = cfb.getStream('Workbook') || cfb.getStream('Book');
    if (!wbs) throw new R.FileProblem('CORRUPT', 'ไฟล์ PTM เสียหรือดาวน์โหลดไม่ครบ');
    return R.readBIFF(wbs);
  }

  /** อ่านไฟล์ 1 ไฟล์ → { kind, label, date, rows, total, byType? } */
  function parseDaily(u8, fileName) {
    var g = grid(u8);
    var s = function (r, c) { var row = g.get(r); if (!row) return ''; var v = row.get(c); return v === undefined || v === null ? '' : String(v).trim(); };
    var head = []; for (var r0 = 0; r0 < 8; r0++) head.push(s(r0, 0));
    var top = head.join(' | ');
    if (/รายงานการรับชำระค่าปรับประจำวัน/.test(s(1, 0))) {
      var p = R.parsePTM(u8, fileName);
      return { kind: 'act', label: KIND_LABEL.act, date: p.date, total: p.items.length, amount: p.total, rows: p.items.map(function (i) {
        return { t: String(i.ticket || '').trim(), pd: beIso(i.paydate) || p.date, id: beIso(i.issued), act: String(i.act || ''), law: String(i.law || ''), off: String(i.offense || ''),
          amt: Math.round((+i.amount || 0) * 100) / 100, ch: String(i.channel || ''), g: String(i.group || ''), b: String(i.badge || '').trim(), o: clean(i.officer, 80) };
      }) };
    }
    var kind = /สรุปจำนวนใบสั่ง/.test(top) ? 'used' : /ยกเลิกใบสั่ง/.test(top) ? 'cancel' : /ว่ากล่าว|ตักเตือน/.test(top) ? 'warn' : '';
    if (!kind) throw new R.FileProblem('FORMAT', 'ไม่รู้จักรายงานนี้ — ใช้ได้เฉพาะ สรุปการใช้ใบสั่ง / สรุปการยกเลิกใบสั่ง / สรุปการว่ากล่าวตักเตือน / รับชำระค่าปรับประจำวัน (ตามประเภท พ.ร.บ.)');
    var md = null; for (var i = 0; i < head.length && !md; i++) md = /(\d{1,2}\/\d{1,2}\/\d{4})/.exec(head[i]);
    var date = md ? beIso(md[1]) : '';
    if (!date) throw new R.FileProblem('FORMAT', 'ไม่พบวันที่ของรายงานในหัวไฟล์');
    var maxRow = Math.max.apply(null, Array.from(g.keys()));
    var hr = -1; for (var r1 = 0; r1 < 12; r1++) if (/^วันที่/.test(s(r1, 0)) && s(r1, 1)) { hr = r1; break; }
    if (hr < 0) throw new R.FileProblem('FORMAT', 'ไม่พบหัวตาราง — รูปแบบรายงานอาจเปลี่ยน');
    var map = {}, spec = COLS[kind];
    for (var c = 0; c < 30; c++) {
      var h = s(hr, c).replace(/\s+/g, ' '); if (!h || BAN.test(h)) continue;
      Object.keys(spec).forEach(function (k) { if (map[k] == null && spec[k].test(h)) map[k] = c; });
    }
    ['t', 'off'].concat(kind === 'used' ? ['ty'] : []).forEach(function (k) { if (map[k] == null) throw new R.FileProblem('FORMAT', 'หัวตารางไม่ครบ (' + k + ') — รูปแบบรายงานอาจเปลี่ยน'); });
    var get = function (r, k) { return map[k] == null ? '' : s(r, map[k]); };
    var rows = [], total = null, byType = {};
    for (var r = hr + 1; r <= maxRow; r++) {
      var a = s(r, 0);
      if (DMY.test(a)) {
        var o = { t: get(r, 't'), off: clean(get(r, 'off')), b: get(r, 'b'), o: clean(get(r, 'o'), 80), rd: beIso(get(r, 'rd')), id: beIso(get(r, 'id')) };
        if (kind === 'used') o.ty = get(r, 'ty');
        if (kind === 'cancel') { o.why = clean(get(r, 'why'), 120); o.ap = clean(get(r, 'ap'), 80); }
        if (kind === 'warn') { o.tm = get(r, 'tm').slice(0, 8); o.ap = clean(get(r, 'ap'), 80); o.st = clean(get(r, 'st'), 40); }
        rows.push(o); continue;
      }
      if (a === 'รายการรวม') total = +s(r, 2).replace(/,/g, '') || 0;
      var tk = TYPE_ROW[a.replace(/[​\s]+$/g, '')]; if (tk) byType[tk] = +s(r, 2).replace(/,/g, '') || 0;
    }
    if (total != null && total !== rows.length) throw new R.FileProblem('CORRUPT', 'จำนวนรายการ (' + rows.length + ') ไม่ตรงกับยอดรวมในไฟล์ (' + total + ') — ไฟล์อาจไม่ครบ');
    return { kind: kind, label: KIND_LABEL[kind], date: date, total: rows.length, byType: byType, rows: rows };
  }
  var api = { parseDaily: parseDaily, KIND_LABEL: KIND_LABEL, beIso: beIso };
  root.PtmDaily = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
