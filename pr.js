/* สร้าง prompt ภาพประชาสัมพันธ์ + เครื่องมือเบลอรูปบนเครื่อง (รูปไม่ถูกส่งออกจากมือถือ) */
(function () {
  'use strict';
  var PAGE = 'ตำรวจทางหลวงชลบุรี ส.ทล.2 กก.3 บก.ทล.';
  var SLOGAN = 'ห่วงใยทุกชีวิต.. เป็นมิตรทุกเส้นทาง';
  var SIZES = [
    { id: 'land', label: 'แนวนอน 16:9', spec: 'แนวนอน สัดส่วน 16:9 (ถ้าทำไม่ได้ให้ใช้ 3:2 แนวนอน)', note: 'เหมาะกับโพสต์ Facebook รูปเดียว, ภาพปกข่าว, แสดงบนจอคอม/ทีวี' },
    { id: 'square', label: 'จัตุรัส 1:1', spec: 'จัตุรัส สัดส่วน 1:1', note: 'ใช้ได้ทุกแพลตฟอร์ม, อัลบั้มหลายรูป, ส่งในไลน์' },
    { id: 'portrait', label: 'แนวตั้ง 4:5', spec: 'แนวตั้ง สัดส่วน 4:5 (ถ้าทำไม่ได้ให้ใช้ 2:3 แนวตั้ง)', note: 'เต็มจอมือถือในฟีด Facebook/Instagram มากที่สุด' },
    { id: 'story', label: 'สตอรี่ 9:16', spec: 'แนวตั้งเต็มจอ สัดส่วน 9:16 (ถ้าทำไม่ได้ให้ใช้ 2:3 แนวตั้ง)', note: 'Story / Reels / TikTok' }
  ];
  // ประเภทภาพ: จับกุมทุกหมวด + ผลการปฏิบัติ/ช่วยเหลือ
  var TYPES = [
    { id: 'drug', group: 'จับกุม', icon: '💊', label: 'ยาเสพติด', head: 'รวบผู้ต้องหาพร้อมของกลางยาเสพติด', warn: 'ยาเสพติดทำลายชีวิตและครอบครัว พบเบาะแสแจ้งสายด่วน 1386 หรือ 191', mood: 'จริงจัง ชัดเจน สื่อถึงการปราบปรามยาเสพติด' },
    { id: 'warrant', group: 'จับกุม', icon: '📜', label: 'จับกุมตามหมายจับ', head: 'จับกุมผู้ต้องหาตามหมายจับ', warn: 'ผู้มีหมายจับควรเข้ามอบตัวต่อพนักงานสอบสวน ประชาชนพบเบาะแสแจ้ง 1193', mood: 'เด็ดขาด น่าเชื่อถือ' },
    { id: 'plate', group: 'จับกุม', icon: '🚗', label: 'รถสวมทะเบียน/เอกสารปลอม', head: 'จับกุมรถสวมทะเบียน ใช้เอกสารราชการปลอม', warn: 'ก่อนซื้อรถมือสอง ตรวจสอบเลขตัวถัง/เลขเครื่องกับเล่มทะเบียน และตรวจสอบกับกรมการขนส่งทางบก', mood: 'เตือนภัยผู้ซื้อรถ' },
    { id: 'gun', group: 'จับกุม', icon: '🔫', label: 'อาวุธปืน/วัตถุระเบิด', head: 'จับกุมผู้ครอบครองอาวุธปืนผิดกฎหมาย', warn: 'การพกพาอาวุธปืนโดยไม่ได้รับอนุญาตมีโทษจำคุก พบเห็นแจ้ง 191', mood: 'จริงจัง ปลอดภัยต่อสังคม' },
    { id: 'immig', group: 'จับกุม', icon: '🛂', label: 'ลักลอบเข้าเมือง/ขนแรงงาน', head: 'สกัดจับขบวนการลักลอบขนแรงงานต่างด้าว', warn: 'การช่วยเหลือ ซ่อนเร้น หรือขนคนต่างด้าวผิดกฎหมายมีโทษหนัก', mood: 'เข้มแข็ง ปกป้องความมั่นคง' },
    { id: 'mule', group: 'จับกุม', icon: '💳', label: 'บัญชีม้า/อาชญากรรมออนไลน์', head: 'จับกุมผู้ต้องหาคดีบัญชีม้า', warn: 'อย่าเปิด ขาย หรือให้เช่าบัญชีธนาคาร/ซิมการ์ด มีความผิดทางกฎหมาย ปรึกษา 1441', mood: 'เตือนภัยไซเบอร์ ทันสมัย' },
    { id: 'drunk', group: 'จับกุม', icon: '🍺', label: 'เมาแล้วขับ', head: 'ตรวจจับผู้ขับขี่ขณะเมาสุรา', warn: 'ดื่มไม่ขับ ง่วงไม่ขับ เพื่อความปลอดภัยของทุกคนบนท้องถนน', mood: 'รณรงค์ความปลอดภัย' },
    { id: 'overload', group: 'จับกุม', icon: '🚛', label: 'รถบรรทุกน้ำหนักเกิน/ผิดกฎหมาย', head: 'จับกุมรถบรรทุกน้ำหนักเกินกฎหมายกำหนด', warn: 'รถบรรทุกน้ำหนักเกินทำให้ถนนชำรุดและเกิดอุบัติเหตุ ร่วมกันรักษาทางหลวง', mood: 'ปกป้องทางหลวง' },
    { id: 'arrest', group: 'จับกุม', icon: '🚨', label: 'จับกุมคดีอื่น ๆ', head: 'ตำรวจทางหลวงจับกุมผู้กระทำผิด', warn: 'พบเห็นการกระทำผิดบนทางหลวง แจ้งสายด่วน 1193 ตลอด 24 ชั่วโมง', mood: 'จริงจัง น่าเชื่อถือ' },
    { id: 'clear', group: 'ผลการปฏิบัติ/ช่วยเหลือ', icon: '🚧', label: 'เร่งคืนพื้นผิวจราจร/เปิดการจราจร', head: 'เร่งคืนพื้นผิวจราจร เปิดการจราจรได้ตามปกติ', warn: 'ขับขี่ด้วยความระมัดระวัง ลดความเร็วเมื่อเข้าใกล้จุดเกิดเหตุ', mood: 'ทำงานรวดเร็ว ใส่ใจประชาชน' },
    { id: 'help', group: 'ผลการปฏิบัติ/ช่วยเหลือ', icon: '🤝', label: 'ช่วยเหลือประชาชน/รถเสีย', head: 'ตำรวจทางหลวงช่วยเหลือประชาชน', warn: 'รถเสียบนทางหลวง เปิดไฟฉุกเฉิน วางกรวย/ป้ายเตือน แล้วแจ้ง 1193', mood: 'อบอุ่น เป็นมิตร' },
    { id: 'accident', group: 'ผลการปฏิบัติ/ช่วยเหลือ', icon: '🚑', label: 'อุบัติเหตุ – ช่วยเหลือ/จัดการจราจร', head: 'ตำรวจทางหลวงเร่งช่วยเหลือผู้ประสบเหตุ', warn: 'ขับขี่ปลอดภัย คาดเข็มขัด สวมหมวกนิรภัย เกิดเหตุแจ้ง 1669 / 1193', mood: 'รวดเร็ว ช่วยชีวิต' },
    { id: 'escort', group: 'ผลการปฏิบัติ/ช่วยเหลือ', icon: '🚔', label: 'นำขบวน/อำนวยความสะดวกจราจร', head: 'อำนวยความสะดวกการจราจร ดูแลความปลอดภัย', warn: 'ปฏิบัติตามสัญญาณและคำแนะนำของเจ้าหน้าที่', mood: 'เป็นระเบียบ มืออาชีพ' },
    { id: 'volunteer', group: 'ผลการปฏิบัติ/ช่วยเหลือ', icon: '🎖️', label: 'จิตอาสา/กิจกรรม', head: 'ตำรวจทางหลวงร่วมกิจกรรมจิตอาสา', warn: '', mood: 'อบอุ่น สร้างสรรค์' }
  ];

  /** ลบข้อมูลที่ระบุตัวบุคคล/ทะเบียนรถออกจากข้อความก่อนใส่ในภาพประชาสัมพันธ์ */
  function sanitize(s) {
    s = String(s || '');
    s = s.replace(/\b[A-Z0-9]{10,17}\b/g, '[ปิดข้อมูล]');                                 // เลขตัวถัง/เครื่อง
    s = s.replace(/\d[\d\s-]{11,}\d/g, '[ปิดข้อมูล]');                                     // เลขบัตร/บัญชี
    s = s.replace(/0\d{1,2}[\s-]?\d{3}[\s-]?\d{3,4}/g, '[ปิดข้อมูล]');                   // เบอร์โทร
    s = s.replace(/(นางสาว|นาง|นาย|น\.ส\.|ด\.ช\.|ด\.ญ\.)\s*[^\s,()]+(\s+[^\s,()\d]+)?/g, 'ผู้ต้องหา');
    s = s.replace(/\b(MRS?|MS|MISS)\.?\s+[A-Za-z]+(\s+[A-Za-z]+)?/g, 'ผู้ต้องหา');
    s = s.replace(/(^|[\s(:,])(\d?[ก-ฮ]{1,2}[\s-]?\d{1,4}|\d{2}-\d{4})(?=$|[\s),.])/g, '$1(ปิดทะเบียน)'); // ป้ายทะเบียน
    return s.replace(/\s{2,}/g, ' ').trim();
  }
  function thDate(iso) {
    if (!iso) return '';
    var M = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
    var p = iso.slice(0, 10).split('-'); return (+p[2]) + ' ' + M[+p[1] - 1] + ' ' + (+p[0] + 543);
  }
  /** เดาประเภทภาพจากข้อมูลคดี */
  function guessType(c) {
    var t = (c.cat || '') + ' ' + (c.title || '') + ' ' + (c.charge || '') + ' ' + (c.evidence || []).map(function (x) { return x.item + ' ' + (x.detail || ''); }).join(' ');
    if (c.kind === 'หมายจับ') return /บัญชี|ม้า|ออนไลน์|คอมพิวเตอร์/.test(t) ? 'mule' : 'warrant';
    if (/ยาเสพติด|ยาบ้า|ไอซ์|เสพ/.test(t)) return 'drug';
    if (/ทะเบียน|เอกสาร.*ปลอม|สวม/.test(t)) return 'plate';
    if (/อาวุธ|ปืน|กระสุน|ระเบิด/.test(t)) return 'gun';
    if (/คนเข้าเมือง|ต่างด้าว|แรงงาน/.test(t)) return 'immig';
    if (/บัญชี|ม้า|ออนไลน์/.test(t)) return 'mule';
    if (/เมา|สุรา|แอลกอฮอล์/.test(t)) return 'drunk';
    if (/น้ำหนักเกิน|บรรทุก/.test(t)) return 'overload';
    return 'arrest';
  }
  function evidenceText(ev) {
    return (ev || []).map(function (x) { return sanitize(x.detail || x.item) + (x.qty ? ' ' + Number(x.qty).toLocaleString('th-TH') + ' ' + (x.unit || '') : ''); }).join(', ');
  }

  function buildPrompt(o) {
    var T = TYPES.filter(function (t) { return t.id === o.type; })[0] || TYPES[0];
    var Z = SIZES.filter(function (s) { return s.id === o.size; })[0] || SIZES[0];
    var isArrest = T.group === 'จับกุม';
    var info = [];
    if (o.date) info.push('📅 วันที่: ' + o.date);
    if (o.time) info.push('🕒 เวลา: ' + o.time);
    if (o.place) info.push('📍 สถานที่: ' + o.place);
    if (isArrest && o.charge) info.push('⚖️ ข้อหา: ' + o.charge);
    if (isArrest && o.count) info.push('👤 ผู้ต้องหา: ' + o.count + ' ราย');
    if (o.evidence) info.push((isArrest ? '📦 ของกลาง: ' : '✅ ผลการปฏิบัติ: ') + o.evidence);
    var L = [];
    L.push('สร้างภาพประชาสัมพันธ์ 1 ภาพ สำหรับโพสต์ในเพจ Facebook "' + PAGE + '"');
    L.push('ประเภทภาพ: ' + T.group + ' – ' + T.label);
    L.push('ขนาดภาพ: ' + Z.spec + ' — ' + Z.note);
    L.push('');
    L.push('【รูปแบบดีไซน์】');
    L.push('- โทนหลักสีกรมท่าเข้ม (navy) ไล่เฉด พื้นหลังมีลายเส้นถนนและแสงไฟไซเรนแดง-น้ำเงินจาง ๆ ดูเป็นทางการ น่าเชื่อถือ อารมณ์ภาพ: ' + T.mood);
    L.push('- มุมซ้ายบน: ตราสัญลักษณ์ตำรวจทางหลวง' + (o.hasLogo ? 'จากรูปโลโก้ที่แนบ (ใช้ตามต้นฉบับ ห้ามแก้รูปตรา)' : ' แบบเรียบง่าย') + ' คู่กับข้อความ "สถานีตำรวจทางหลวงชลบุรี" และ "ส.ทล.2 กก.3 บก.ทล." และคำขวัญ "' + SLOGAN + '"');
    L.push('- หัวข้อใหญ่ภาษาไทยตัวหนามาก สีเหลืองทอง/ขาว ขอบเงานูน 3 มิติ อ่านชัดบนจอมือถือ วางเด่นส่วนบนของภาพ');
    if (o.photos) L.push('- ใช้รูปถ่ายจริงที่แนบมา ' + o.photos + ' รูป จัดเป็นคอลลาจ 2–4 ช่อง กรอบมุมมน มีเส้นขอบสีทอง/ขาว ให้รูปเป็นส่วนสำคัญของภาพ');
    else L.push('- ไม่มีรูปถ่ายแนบ: ใช้ภาพกราฟิก/ไอคอนประกอบ (รถสายตรวจทางหลวง ถนน กรวยจราจร) ห้ามวาดใบหน้าบุคคลที่ดูเหมือนคนจริง');
    L.push('- กล่องข้อมูลพื้นขาวโปร่งแสงหรือกรมท่าเข้ม มีไอคอนหน้าข้อความแต่ละบรรทัด จัดเรียงอ่านง่าย');
    if (o.warn) L.push('- กล่องเด่นสีแดง/เหลือง หัวข้อ "เตือนภัยประชาชน" พร้อมข้อความเตือนด้านล่าง');
    L.push('- แถบล่างสุด: ไอคอนโทรศัพท์ "สายด่วน 1193 ตำรวจทางหลวง" · "1669 เจ็บป่วยฉุกเฉิน" · "191 เหตุด่วนเหตุร้าย" และไอคอน Facebook "' + PAGE + '"');
    L.push('');
    L.push('【ข้อความในภาพ — ใช้ตามนี้ทุกตัวอักษร สะกดภาษาไทยให้ถูกต้อง ห้ามแต่งข้อความเพิ่มเอง】');
    L.push('หัวข้อใหญ่: "' + o.head + '"');
    if (o.sub) L.push('หัวข้อรอง: "' + o.sub + '"');
    info.forEach(function (x) { L.push(x); });
    if (o.warn) L.push('เตือนภัยประชาชน: "' + o.warn + '"');
    L.push('');
    L.push('【ข้อห้ามสำคัญ (ข้อมูลส่วนบุคคลและกฎหมาย)】');
    if (o.photos) {
      L.push('- รูปที่แนบถูกเบลอหน้าผู้ต้องหาและป้ายทะเบียนรถไว้แล้ว: คงความเบลอไว้ตามเดิม ห้ามทำให้ชัด ห้ามวาดหรือเดาใบหน้า/ตัวอักษรใต้ส่วนที่เบลอขึ้นใหม่');
      L.push('- ใบหน้าเจ้าหน้าที่ตำรวจไม่ต้องเบลอ คงไว้ตามรูปต้นฉบับ ห้ามดัดแปลงใบหน้า เครื่องแบบ หรือยศ');
    }
    if (isArrest) L.push('- ห้ามใส่ชื่อ-นามสกุล เลขบัตรประชาชน ที่อยู่ หรือเบอร์โทรของผู้ต้องหาในภาพ และห้ามสร้างใบหน้าผู้ต้องหาขึ้นเอง');
    L.push('- ห้ามแสดงเลขทะเบียนรถที่อ่านออกได้ ห้ามแสดงเลขตัวถัง/เลขเครื่องยนต์');
    L.push('- ไม่ใส่ตราหน่วยงานอื่น โลโก้แบรนด์ หรือลายน้ำ และไม่ใส่ข้อความภาษาอังกฤษที่ไม่ได้กำหนด');
    L.push('');
    L.push('ถ้าข้อความภาษาไทยในภาพสะกดผิด ให้แก้เฉพาะตัวอักษรให้ตรงกับข้อความที่กำหนดด้านบน โดยคงดีไซน์เดิม');
    return L.join('\n');
  }

  // ---------- เครื่องมือเบลอ ----------
  /** โหลดรูปเป็น canvas (ด้านยาวไม่เกิน 2048px — ลบข้อมูลพิกัด/EXIF โดยอัตโนมัติเมื่อบันทึก) */
  function loadImage(file) {
    return new Promise(function (res, rej) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var k = Math.min(1, 2048 / Math.max(img.naturalWidth, img.naturalHeight));
        var c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); res(c);
      };
      img.onerror = function () { URL.revokeObjectURL(url); rej(new Error('เปิดรูปไม่ได้')); };
      img.src = url;
    });
  }
  /** เบลอแบบโมเสก + เบลอซ้ำ (ย้อนกลับไม่ได้) เฉพาะพื้นที่ที่เลือก */
  function applyBlur(src, regions) {
    var c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
    var g = c.getContext('2d'); g.drawImage(src, 0, 0);
    regions.forEach(function (r) {
      var x = Math.max(0, Math.round(r.x * c.width)), y = Math.max(0, Math.round(r.y * c.height));
      var w = Math.min(c.width - x, Math.round(r.w * c.width)), h = Math.min(c.height - y, Math.round(r.h * c.height));
      if (w < 2 || h < 2) return;
      var block = Math.max(8, Math.round(Math.max(w, h) / 7));
      var t = document.createElement('canvas'); t.width = Math.max(1, Math.ceil(w / block)); t.height = Math.max(1, Math.ceil(h / block));
      t.getContext('2d').drawImage(c, x, y, w, h, 0, 0, t.width, t.height);
      g.save();
      g.beginPath();
      if (r.shape === 'ellipse') g.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2); else g.rect(x, y, w, h);
      g.clip();
      g.imageSmoothingEnabled = false;
      g.drawImage(t, 0, 0, t.width, t.height, x, y, w, h);
      g.imageSmoothingEnabled = true;
      try { g.filter = 'blur(' + Math.max(4, Math.round(block / 2)) + 'px)'; g.drawImage(c, x, y, w, h, x, y, w, h); g.filter = 'none'; } catch (e) { }
      g.restore();
    });
    return c;
  }

  window.PR = { TYPES: TYPES, SIZES: SIZES, sanitize: sanitize, thDate: thDate, guessType: guessType, evidenceText: evidenceText, buildPrompt: buildPrompt, loadImage: loadImage, applyBlur: applyBlur };
})();
