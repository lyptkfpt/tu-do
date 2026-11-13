'use strict';
/* =====================================================================
   Tủ đồ của tôi — JavaScript thuần, lưu dữ liệu bằng IndexedDB.
   Không có thư viện, không gọi API, không gửi ảnh ra ngoài.
   ===================================================================== */

/* ---------- 1. Danh mục cố định ---------- */
const TYPES = [
  { id: 'ao', label: 'Áo' },
  { id: 'quan', label: 'Quần' },
  { id: 'chan-vay', label: 'Chân váy' },
  { id: 'vay-lien', label: 'Váy liền' },
  { id: 'ao-khoac', label: 'Áo khoác' },
  { id: 'giay', label: 'Giày' },
  { id: 'tui', label: 'Túi' },
  { id: 'phu-kien', label: 'Phụ kiện' },
];
const TYPE = Object.fromEntries(TYPES.map(t => [t.id, t]));

// neutral: màu trung tính; family: tông ấm / lạnh để xét độ hài hòa
const COLORS = [
  { id: 'den', label: 'Đen', hex: '#1a1a1a', neutral: true },
  { id: 'trang', label: 'Trắng', hex: '#ffffff', neutral: true },
  { id: 'kem', label: 'Kem / be', hex: '#e6d7bd', neutral: true },
  { id: 'xam', label: 'Xám', hex: '#9a9a9a', neutral: true },
  { id: 'nau', label: 'Nâu', hex: '#7a5236', neutral: true },
  { id: 'navy', label: 'Xanh navy', hex: '#1f2a4a', neutral: true },
  { id: 'denim', label: 'Xanh denim', hex: '#5b7aa3', neutral: true },
  { id: 'xanh-duong', label: 'Xanh dương', hex: '#2f6fd0', family: 'lạnh' },
  { id: 'xanh-la', label: 'Xanh lá', hex: '#3f7d4e', family: 'lạnh' },
  { id: 'tim', label: 'Tím', hex: '#6b4c9a', family: 'lạnh' },
  { id: 'do', label: 'Đỏ', hex: '#c62828', family: 'ấm' },
  { id: 'do-ruou', label: 'Đỏ rượu vang', hex: '#6e1423', family: 'ấm' },
  { id: 'hong', label: 'Hồng', hex: '#e89bb0', family: 'ấm' },
  { id: 'cam', label: 'Cam', hex: '#e07a2e', family: 'ấm' },
  { id: 'vang', label: 'Vàng', hex: '#e3b52b', family: 'ấm' },
  { id: 'hoa-tiet', label: 'Họa tiết / nhiều màu', hex: 'conic-gradient(#c62828, #e3b52b, #3f7d4e, #2f6fd0, #c62828)', pattern: true },
];
const COLOR = Object.fromEntries(COLORS.map(c => [c.id, c]));

const WARMTH = [
  { v: 1, label: 'Mỏng, thoáng' },
  { v: 2, label: 'Vừa' },
  { v: 3, label: 'Ấm' },
];
const FORMALITY = [
  { v: 1, label: 'Thoải mái' },
  { v: 2, label: 'Lịch sự' },
  { v: 3, label: 'Trang trọng' },
];

// allowed: các mức chấp nhận được; ideal: mức đẹp nhất
const OCCASIONS = {
  'di-lam':    { label: 'Đi làm',     allowed: [2, 3], ideal: 2 },
  'su-kien':   { label: 'Dự sự kiện', allowed: [2, 3], ideal: 3 },
  'cuoi-tuan': { label: 'Cuối tuần',  allowed: [1, 2], ideal: 1 },
  'du-lich':   { label: 'Du lịch',    allowed: [1, 2], ideal: 1 },
};
const WEATHERS = {
  'nong': { label: 'Nóng', allowed: [1, 2], ideal: 1 },
  'mat':  { label: 'Mát',  allowed: [1, 2, 3], ideal: 2 },
  'lanh': { label: 'Lạnh', allowed: [2, 3], ideal: 3 },
};

const CORE_TYPES = ['ao', 'quan', 'chan-vay', 'vay-lien'];
const BOTTOM_TYPES = ['quan', 'chan-vay'];

/* ---------- 2. IndexedDB ---------- */
const DB_NAME = 'tu-do-cua-toi';
const DB_VERSION = 1;
let dbPromise = null;

function openDB() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('items')) db.createObjectStore('items', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('outfits')) db.createObjectStore('outfits', { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

async function dbRequest(storeName, mode, makeRequest) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const request = makeRequest(tx.objectStore(storeName));
    tx.oncomplete = () => resolve(request.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Giao dịch bị hủy'));
  });
}
const dbGetAll = store => dbRequest(store, 'readonly', s => s.getAll());
const dbPut = (store, value) => dbRequest(store, 'readwrite', s => s.put(value));
const dbDelete = (store, id) => dbRequest(store, 'readwrite', s => s.delete(id));

/* ---------- 3. Trạng thái ứng dụng ---------- */
const state = {
  items: [],
  outfits: [],
  filter: 'all',
  anchorId: null,
  occasion: 'di-lam',
  weather: 'nong',
  results: [],
};
const imageUrls = new Map(); // id món -> đường dẫn ảnh tạm (object URL)

/* ---------- 4. Tiện ích ---------- */
const $ = sel => document.querySelector(sel);

function uid() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function esc(text) {
  return String(text ?? '').replace(/[&<>"']/g, ch => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
  ));
}

function imageUrl(item) {
  if (!item || !item.image) return '';
  if (!imageUrls.has(item.id)) imageUrls.set(item.id, URL.createObjectURL(item.image));
  return imageUrls.get(item.id);
}
function forgetImage(id) {
  if (imageUrls.has(id)) { URL.revokeObjectURL(imageUrls.get(id)); imageUrls.delete(id); }
}

const readyItems = () => state.items.filter(i => i.status === 'ready');
const findItem = id => state.items.find(i => i.id === id);
const warmthLabel = v => (WARMTH.find(w => w.v === v) || {}).label || '';
const formalityLabel = v => (FORMALITY.find(f => f.v === v) || {}).label || '';
const capitalize = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

function swatchStyle(colorId) {
  const c = COLOR[colorId];
  if (!c) return '';
  return `background:${c.hex}`;
}

function formatDate(ts) {
  return new Date(ts).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function nameFromFile(fileName) {
  const base = fileName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!base || /^(img|dsc|pxl|image|photo|screenshot|anh)?[\s\d]*$/i.test(base)) return '';
  return capitalize(base).slice(0, 60);
}

/* ---------- 5. Xử lý ảnh: thu nhỏ để tiết kiệm bộ nhớ ---------- */
const MAX_SIDE = 1200;

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Không đọc được ảnh')); };
    img.src = url;
  });
}

async function shrinkImage(file) {
  const img = await loadImage(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d').drawImage(img, 0, 0, w, h);
  const blob = await new Promise(res => canvas.toBlob(res, 'image/webp', 0.86));
  return blob || file;
}

/* ---------- 6. Tải ảnh lên ---------- */
async function handleFiles(fileList) {
  const files = [...fileList];
  if (!files.length) return;
  const status = $('#upload-status');
  status.hidden = false;
  status.className = 'notice';
  status.textContent = `Đang xử lý ${files.length} ảnh…`;

  const errors = [];
  let added = 0;
  for (const file of files) {
    const looksLikeImage = file.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|avif|bmp|heic|heif)$/i.test(file.name);
    if (!looksLikeImage) { errors.push(`${file.name}: không phải tệp ảnh.`); continue; }
    try {
      const image = await shrinkImage(file);
      const item = {
        id: uid(),
        name: nameFromFile(file.name),
        type: '',
        color: '',
        warmth: 2,
        formality: 2,
        image,
        status: 'draft', // món nháp: chưa dùng để phối cho tới khi điền đủ thông tin
        createdAt: Date.now() + added,
      };
      await dbPut('items', item);
      state.items.push(item);
      added++;
    } catch (err) {
      const heic = /\.(heic|heif)$/i.test(file.name);
      errors.push(`${file.name}: Chrome không mở được ảnh này${heic ? ' (định dạng HEIC — hãy đổi sang JPG)' : ''}.`);
    }
  }

  let html = added
    ? `Đã thêm <b>${added}</b> ảnh. Hãy đặt tên và chọn loại, màu cho từng món bên dưới rồi bấm “Lưu”.`
    : 'Chưa thêm được ảnh nào.';
  if (errors.length) {
    status.classList.add('warn');
    html += `<ul>${errors.map(e => `<li>${esc(e)}</li>`).join('')}</ul>`;
  }
  status.innerHTML = html;
  renderAll();
  if (added) $('#drafts').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ---------- 7. Biểu mẫu thông tin món ---------- */
function itemFormFields(item) {
  const typeOptions = TYPES.map(t =>
    `<option value="${t.id}" ${item.type === t.id ? 'selected' : ''}>${t.label}</option>`).join('');
  const colorOptions = COLORS.map(c =>
    `<option value="${c.id}" ${item.color === c.id ? 'selected' : ''}>${c.label}</option>`).join('');
  const radios = (name, list, current) => list.map(o => `
      <label><input type="radio" name="${name}" value="${o.v}" ${current === o.v ? 'checked' : ''}><span>${o.label}</span></label>`).join('');
  return `
    <label class="field"><span>Tên món</span>
      <input type="text" name="name" maxlength="60" value="${esc(item.name)}" placeholder="VD: Sơ mi lụa trắng">
    </label>
    <div class="form-row">
      <label class="field"><span>Loại món</span>
        <select name="type"><option value="">— Chọn loại —</option>${typeOptions}</select>
      </label>
      <label class="field"><span>Màu chính <i class="swatch" data-swatch style="${swatchStyle(item.color)}"></i></span>
        <select name="color"><option value="">— Chọn màu —</option>${colorOptions}</select>
      </label>
    </div>
    <fieldset><legend>Độ ấm</legend><div class="seg">${radios('warmth', WARMTH, item.warmth)}</div></fieldset>
    <fieldset><legend>Độ trang trọng</legend><div class="seg">${radios('formality', FORMALITY, item.formality)}</div></fieldset>
    <p class="form-error" data-error></p>`;
}

// Đọc giá trị từ biểu mẫu; trả về null nếu thiếu thông tin
function readItemForm(form) {
  const name = form.elements.name.value.trim();
  const type = form.elements.type.value;
  const color = form.elements.color.value;
  const warmth = Number(form.querySelector('input[name="warmth"]:checked')?.value || 2);
  const formality = Number(form.querySelector('input[name="formality"]:checked')?.value || 2);
  const missing = [];
  if (!name) missing.push('tên món');
  if (!type) missing.push('loại món');
  if (!color) missing.push('màu chính');
  const errorBox = form.querySelector('[data-error]');
  if (missing.length) {
    errorBox.textContent = `Còn thiếu: ${missing.join(', ')}.`;
    return null;
  }
  errorBox.textContent = '';
  return { name, type, color, warmth, formality };
}

async function saveItemFromForm(item, form) {
  const values = readItemForm(form);
  if (!values) return false;
  Object.assign(item, values, { status: 'ready', updatedAt: Date.now() });
  await dbPut('items', item);
  return true;
}

// Cập nhật chấm màu khi đổi màu trong biểu mẫu
document.addEventListener('change', e => {
  if (e.target.matches('select[name="color"]')) {
    const sw = e.target.closest('form').querySelector('[data-swatch]');
    if (sw) sw.setAttribute('style', swatchStyle(e.target.value));
  }
});

/* ---------- 8. Hiển thị mục Tủ đồ ---------- */
function renderDrafts() {
  const drafts = state.items.filter(i => i.status === 'draft').sort((a, b) => a.createdAt - b.createdAt);
  $('#drafts').hidden = drafts.length === 0;
  $('#save-all-drafts').textContent = `Lưu tất cả (${drafts.length})`;
  // Chỉ thêm/bớt từng món để không làm mất phần bạn đang điền dở ở món khác
  const list = $('#draft-list');
  const ids = new Set(drafts.map(d => d.id));
  list.querySelectorAll('form.draft').forEach(f => { if (!ids.has(f.dataset.id)) f.remove(); });
  for (const item of drafts) {
    if (list.querySelector(`form.draft[data-id="${item.id}"]`)) continue;
    list.insertAdjacentHTML('beforeend', draftHTML(item));
  }
}

function draftHTML(item) {
  return `
    <form class="draft" data-id="${item.id}">
      <div class="card-img"><img src="${imageUrl(item)}" alt="Ảnh món mới"></div>
      <div class="item-form">
        ${itemFormFields(item)}
        <div class="form-actions">
          <button type="submit" class="btn btn-primary btn-small">Lưu món</button>
          <button type="button" class="btn btn-danger btn-small" data-action="delete" data-id="${item.id}">Xóa ảnh</button>
        </div>
      </div>
    </form>`;
}

function renderFilter() {
  const ready = readyItems();
  const chips = [{ id: 'all', label: 'Tất cả', n: ready.length },
    ...TYPES.map(t => ({ id: t.id, label: t.label, n: ready.filter(i => i.type === t.id).length }))];
  $('#type-filter').innerHTML = chips.map(c =>
    `<button type="button" class="chip ${state.filter === c.id ? 'active' : ''}" data-filter="${c.id}" aria-pressed="${state.filter === c.id}">${c.label}<span>${c.n}</span></button>`).join('');
}

function itemCard(item) {
  const c = COLOR[item.color];
  return `
    <article class="card" data-id="${item.id}">
      <div class="card-img"><img src="${imageUrl(item)}" alt="${esc(item.name)}" loading="lazy"></div>
      <div class="card-body">
        <div class="card-type">${TYPE[item.type]?.label || ''}</div>
        <div class="card-name">${esc(item.name)}</div>
        <div class="card-meta"><i class="swatch" style="${swatchStyle(item.color)}"></i>${c ? c.label : ''} · ${warmthLabel(item.warmth)} · ${formalityLabel(item.formality)}</div>
        <div class="card-actions">
          <button type="button" class="btn btn-small" data-action="edit" data-id="${item.id}">Sửa</button>
          <button type="button" class="btn btn-small" data-action="anchor" data-id="${item.id}">Phối quanh món này</button>
          <button type="button" class="btn btn-small btn-danger" data-action="delete" data-id="${item.id}">Xóa</button>
        </div>
      </div>
    </article>`;
}

function renderWardrobe() {
  renderDrafts();
  renderFilter();
  const ready = readyItems().sort((a, b) => b.createdAt - a.createdAt);
  const shown = state.filter === 'all' ? ready : ready.filter(i => i.type === state.filter);
  $('#wardrobe-grid').innerHTML = shown.map(itemCard).join('');
  const empty = $('#wardrobe-empty');
  empty.hidden = shown.length > 0;
  if (!ready.length) {
    empty.textContent = state.items.length
      ? 'Điền thông tin và lưu các món mới ở trên để chúng xuất hiện trong tủ đồ.'
      : 'Tủ đồ đang trống. Bấm “+ Thêm ảnh” để bắt đầu.';
  } else {
    empty.textContent = `Chưa có món nào thuộc loại “${TYPE[state.filter]?.label}”.`;
  }
  $('#count-wardrobe').textContent = ready.length ? `(${ready.length})` : '';
}

/* ---------- 9. Sửa / xóa món ---------- */
function openEditDialog(item) {
  const body = $('#item-dialog-body');
  body.innerHTML = `
    <form id="edit-form" class="dialog-edit">
      <div class="card-img"><img src="${imageUrl(item)}" alt="${esc(item.name)}"></div>
      <div class="item-form">
        <p class="eyebrow">Sửa món</p>
        ${itemFormFields(item)}
        <div class="dialog-actions">
          <button type="button" class="btn btn-danger" data-action="delete" data-id="${item.id}">Xóa món</button>
          <button type="button" class="btn" data-close>Hủy</button>
          <button type="submit" class="btn btn-primary">Lưu thay đổi</button>
        </div>
      </div>
    </form>`;
  const dialog = $('#item-dialog');
  body.querySelector('#edit-form').addEventListener('submit', async e => {
    e.preventDefault();
    if (await saveItemFromForm(item, e.target)) {
      dialog.close();
      renderAll();
    }
  });
  dialog.showModal();
}

function confirmBox(message, okLabel = 'Xóa') {
  const dialog = $('#confirm-dialog');
  $('#confirm-text').textContent = message;
  $('#confirm-ok').textContent = okLabel;
  dialog.returnValue = '';
  dialog.showModal();
  return new Promise(resolve => {
    dialog.addEventListener('close', () => resolve(dialog.returnValue === 'ok'), { once: true });
  });
}

async function deleteItem(id) {
  const item = findItem(id);
  if (!item) return;
  const usedIn = state.outfits.filter(o => o.itemIds.includes(id)).length;
  const label = item.name ? `“${item.name}”` : 'món này';
  let msg = `Xóa ${label} khỏi tủ đồ?`;
  if (usedIn) msg += ` Món này có trong ${usedIn} bộ đã lưu; các bộ đó sẽ hiện là thiếu món.`;
  if (!(await confirmBox(msg))) return;
  await dbDelete('items', id);
  state.items = state.items.filter(i => i.id !== id);
  forgetImage(id);
  if (state.anchorId === id) state.anchorId = null;
  if ($('#item-dialog').open) $('#item-dialog').close();
  renderAll();
}

/* ---------- 10. Thuật toán phối đồ ---------- */
const fitsOccasion = (item, occ) => OCCASIONS[occ].allowed.includes(item.formality);

function fitsWeather(item, weather, relaxed) {
  if (item.type === 'tui') return true; // túi không phụ thuộc thời tiết
  const allowed = relaxed ? [1, 2, 3] : WEATHERS[weather].allowed;
  return allowed.includes(item.warmth);
}

function itemScore(item, occ, weather) {
  let s = 0;
  const o = OCCASIONS[occ], w = WEATHERS[weather];
  s += item.formality === o.ideal ? 2 : o.allowed.includes(item.formality) ? 1 : 0;
  if (item.type !== 'tui') s += item.warmth === w.ideal ? 2 : w.allowed.includes(item.warmth) ? 1 : 0;
  return s;
}

// Đánh giá độ hài hòa màu sắc của một nhóm món
function colorHarmony(items) {
  const colors = items.map(i => COLOR[i.color]).filter(Boolean);
  const patterned = colors.filter(c => c.pattern).length;
  const accents = [...new Set(colors.filter(c => !c.neutral && !c.pattern).map(c => c.id))];
  const neutrals = [...new Set(colors.filter(c => c.neutral).map(c => c.label.toLowerCase()))];

  if (patterned > 1) return { score: -5, text: 'có hai món họa tiết dễ bị rối mắt' };
  if (accents.length > 2) return { score: -5, text: 'quá nhiều màu nổi cùng lúc' };
  if (accents.length === 2) {
    const [a, b] = accents.map(id => COLOR[id]);
    if (patterned) return { score: -4, text: 'họa tiết đi cùng hai màu nổi khá rối' };
    if (a.family === b.family) return { score: 1, text: `${a.label.toLowerCase()} và ${b.label.toLowerCase()} cùng tông ${a.family} nên vẫn hài hòa` };
    return { score: -3, text: `${a.label.toLowerCase()} và ${b.label.toLowerCase()} khác tông, dễ chỏi nhau` };
  }
  if (accents.length === 1) {
    const a = COLOR[accents[0]];
    if (patterned) return { score: 0, text: `món họa tiết đi cùng điểm ${a.label.toLowerCase()}, nên giữ phụ kiện đơn giản` };
    const allSame = colors.every(c => c.id === a.id);
    if (allSame) return { score: 2, text: `phối đồng màu ${a.label.toLowerCase()} từ đầu đến chân, rất có chủ ý` };
    return { score: 3, text: `${a.label.toLowerCase()} làm điểm nhấn trên nền ${neutrals.slice(0, 2).join(' và ') || 'trung tính'}` };
  }
  if (patterned) return { score: 2, text: 'món họa tiết là tâm điểm, các món còn lại trung tính nên không bị rối' };
  if (neutrals.length === 1) return { score: 2, text: `phối đồng màu ${neutrals[0]} gọn gàng, tinh tế` };
  return { score: 2, text: `bảng màu trung tính (${neutrals.slice(0, 3).join(', ')}) thanh lịch, dễ mặc` };
}

const HARMONY_LIMIT = -3; // điểm màu thấp hơn hoặc bằng mức này thì loại

function generateOutfits({ occasion, weather, anchorId }) {
  const ready = readyItems();
  const occ = OCCASIONS[occasion], wea = WEATHERS[weather];
  const anchor = anchorId ? ready.find(i => i.id === anchorId) : null;
  const notes = [];
  const byType = type => ready.filter(i => i.type === type);
  const rank = (list) => [...list].sort((a, b) => itemScore(b, occasion, weather) - itemScore(a, occasion, weather));

  if (!ready.length) {
    return { looks: [], notes, problem: 'Tủ đồ chưa có món nào đã điền đủ thông tin. Hãy thêm ảnh ở mục Tủ đồ, chọn loại và màu cho từng món rồi lưu lại.' };
  }

  // Áo khoác phù hợp
  const outerAllowed = weather === 'lanh' ? [2, 3] : [1, 2, 3];
  const outerFits = rank(byType('ao-khoac').filter(i => fitsOccasion(i, occasion) && outerAllowed.includes(i.warmth)));
  const hasOuter = (anchor && anchor.type === 'ao-khoac') || outerFits.length > 0;
  // Trời lạnh nhưng có áo khoác thì món bên trong có thể mỏng hơn
  const relaxed = weather === 'lanh' && hasOuter;

  const isAnchor = i => anchor && i.id === anchor.id;
  const coreOK = i => isAnchor(i) || (fitsOccasion(i, occasion) && fitsWeather(i, weather, relaxed));
  const dresses = byType('vay-lien').filter(coreOK);
  const tops = byType('ao').filter(coreOK);
  const bottoms = ready.filter(i => BOTTOM_TYPES.includes(i.type)).filter(coreOK);

  // Phần chính của bộ: váy liền, hoặc áo + quần/chân váy
  let bases = [];
  if (anchor && anchor.type === 'vay-lien') bases = [[anchor]];
  else if (anchor && anchor.type === 'ao') bases = bottoms.map(b => [anchor, b]);
  else if (anchor && BOTTOM_TYPES.includes(anchor.type)) bases = tops.map(t => [t, anchor]);
  else {
    bases = dresses.map(d => [d]);
    for (const t of tops) for (const b of bottoms) bases.push([t, b]);
  }

  if (!bases.length) {
    return { looks: [], notes, problem: explainNoBase({ ready, anchor, occ, wea, dresses, tops, bottoms }) };
  }

  // Lựa chọn giày
  let shoeOptions;
  if (anchor && anchor.type === 'giay') shoeOptions = [anchor];
  else {
    const shoes = rank(byType('giay').filter(i => fitsOccasion(i, occasion) && fitsWeather(i, weather, false)));
    shoeOptions = shoes.length ? shoes.slice(0, 3) : [null];
    if (!shoes.length) notes.push(byType('giay').length
      ? `Tủ đồ có giày nhưng chưa đôi nào hợp ${occ.label.toLowerCase()} khi trời ${wea.label.toLowerCase()}, nên các bộ chưa có giày.`
      : 'Tủ đồ chưa có giày, nên các bộ chưa kèm giày.');
  }

  // Lựa chọn áo khoác
  let outerOptions;
  if (anchor && anchor.type === 'ao-khoac') outerOptions = [anchor];
  else if (weather === 'nong') outerOptions = [null];
  else if (weather === 'lanh') {
    outerOptions = outerFits.length ? outerFits.slice(0, 2) : [null];
    if (!outerFits.length) notes.push(byType('ao-khoac').length
      ? `Trời lạnh nhưng chưa có áo khoác nào hợp ${occ.label.toLowerCase()} — các bộ dưới đây chỉ dùng món đủ ấm.`
      : 'Trời lạnh nhưng tủ đồ chưa có áo khoác — các bộ dưới đây chỉ dùng món đủ ấm.');
  } else {
    outerOptions = [...outerFits.slice(0, 2), null]; // trời mát: áo khoác là tùy chọn
  }

  // Tạo tất cả ứng viên và chấm điểm
  const candidates = [];
  let rejectedForColor = 0;
  for (const core of bases) {
    const coreScore = core.reduce((s, i) => s + itemScore(i, occasion, weather), 0) / core.length;
    for (const shoe of shoeOptions) {
      for (const outer of outerOptions) {
        const worn = [...core, outer, shoe].filter(Boolean);
        const harmony = colorHarmony(worn);
        if (harmony.score <= HARMONY_LIMIT && !(anchor && worn.length <= 2)) { rejectedForColor++; continue; }
        let score = coreScore * 2 + harmony.score;
        if (shoe) score += 1 + itemScore(shoe, occasion, weather) * 0.5;
        if (outer) score += weather === 'lanh' ? 2 : 0.5;
        candidates.push({ core, shoe, outer, harmony, score, key: worn.map(i => i.id).sort().join('|') });
      }
    }
  }

  if (!candidates.length) {
    return { looks: [], notes, problem: `Có ${bases.length} cách ghép áo/quần/váy hợp dịp và thời tiết, nhưng màu sắc của chúng chỏi nhau nên mình không gợi ý. Thêm một món màu trung tính (đen, trắng, kem, xám, navy, denim) sẽ dễ phối hơn.` };
  }

  // Chọn tối đa 3 bộ, ưu tiên các bộ khác nhau nhiều nhất
  const chosen = [];
  const seen = new Set();
  while (chosen.length < 3) {
    let best = null, bestScore = -Infinity;
    for (const c of candidates) {
      if (seen.has(c.key)) continue;
      let s = c.score;
      for (const x of chosen) {
        s -= 4 * c.core.filter(i => x.core.includes(i)).length;
        if (c.shoe && c.shoe === x.shoe) s -= 1;
        if (c.outer && c.outer === x.outer) s -= 1;
      }
      if (s > bestScore) { bestScore = s; best = c; }
    }
    if (!best) break;
    seen.add(best.key);
    chosen.push(best);
  }

  // Thêm túi và phụ kiện nếu hợp
  const bags = rank(byType('tui').filter(i => fitsOccasion(i, occasion)));
  const accs = rank(byType('phu-kien').filter(i => fitsOccasion(i, occasion) && fitsWeather(i, weather, false)));
  const used = new Map();
  const pickExtra = (look, list) => {
    let best = null, bestS = -Infinity;
    const base = [...look.core, look.outer, look.shoe].filter(Boolean);
    for (const it of list) {
      const h = colorHarmony([...base, it]);
      if (h.score < look.harmony.score - 1 || h.score <= HARMONY_LIMIT) continue; // không làm bộ kém hài hòa đi
      const s = itemScore(it, occasion, weather) + h.score - 2 * (used.get(it.id) || 0);
      if (s > bestS) { bestS = s; best = it; }
    }
    if (best) used.set(best.id, (used.get(best.id) || 0) + 1);
    return best;
  };

  const looks = chosen.map(c => {
    const look = { ...c, bag: null, acc: null };
    look.bag = anchor && anchor.type === 'tui' ? anchor : pickExtra(look, bags);
    look.acc = anchor && anchor.type === 'phu-kien' ? anchor : pickExtra(look, accs);
    look.items = [...look.core, look.outer, look.shoe, look.bag, look.acc].filter(Boolean);
    look.explanation = explainLook(look, { occasion, weather, anchor });
    look.warning = anchorWarning(anchor, occasion, weather);
    return look;
  });

  // Ghi chú khi ít hơn 3 bộ hoặc các bộ dùng chung món chính
  if (looks.length < 3) {
    let msg = `Chỉ tạo được ${looks.length} bộ phù hợp với ${occ.label.toLowerCase()} · trời ${wea.label.toLowerCase()}`;
    msg += anchor ? ` khi phối quanh “${anchor.name}”.` : '.';
    msg += ' ' + suggestMore({ anchor, dresses, tops, bottoms });
    notes.unshift(msg);
  }
  const distinctCores = new Set(looks.map(l => l.core.map(i => i.id).join('|'))).size;
  if (looks.length > 1 && distinctCores < looks.length) {
    notes.push(`Chỉ có ${distinctCores} cách ghép phần chính (áo + quần/chân váy hoặc váy liền) phù hợp, nên một số bộ chỉ khác nhau ở giày hoặc áo khoác.`);
  }
  if (rejectedForColor && looks.length < 3) {
    notes.push('Một số kết hợp đã bị loại vì màu sắc chỏi nhau.');
  }
  return { looks, notes, problem: null };
}

function explainNoBase({ ready, anchor, occ, wea, dresses, tops, bottoms }) {
  const count = types => ready.filter(i => types.includes(i.type)).length;
  const nTop = count(['ao']), nBottom = count(BOTTOM_TYPES), nDress = count(['vay-lien']);
  const ctx = `${occ.label.toLowerCase()} · trời ${wea.label.toLowerCase()}`;
  if (anchor && anchor.type === 'ao') {
    return nBottom
      ? `Có ${nBottom} quần/chân váy trong tủ nhưng chưa món nào hợp với ${ctx} để đi cùng “${anchor.name}”.`
      : `Để phối quanh “${anchor.name}”, tủ đồ cần ít nhất một quần hoặc chân váy. Hiện chưa có món nào.`;
  }
  if (anchor && BOTTOM_TYPES.includes(anchor.type)) {
    return nTop
      ? `Có ${nTop} áo trong tủ nhưng chưa chiếc nào hợp với ${ctx} để đi cùng “${anchor.name}”.`
      : `Để phối quanh “${anchor.name}”, tủ đồ cần ít nhất một chiếc áo. Hiện chưa có áo nào.`;
  }
  if (!nDress && (!nTop || !nBottom)) {
    const need = !nTop && !nBottom ? 'áo và quần/chân váy' : !nTop ? 'áo' : 'quần hoặc chân váy';
    return `Chưa đủ món để tạo một bộ. Mỗi bộ cần một váy liền, hoặc một áo cùng một quần/chân váy. Tủ đồ hiện có ${nTop} áo, ${nBottom} quần/chân váy, ${nDress} váy liền — hãy thêm ${need} hoặc một váy liền.`;
  }
  return `Có ${nTop} áo, ${nBottom} quần/chân váy và ${nDress} váy liền, nhưng chưa ghép được bộ nào hợp ${ctx}: hợp dịp và thời tiết hiện có ${tops.length} áo, ${bottoms.length} quần/chân váy, ${dresses.length} váy liền. Thử chọn dịp hoặc thời tiết khác, hoặc kiểm tra lại độ ấm / độ trang trọng của từng món.`;
}

function suggestMore({ anchor, dresses, tops, bottoms }) {
  if (anchor && anchor.type === 'vay-lien') return 'Váy liền chỉ tạo được một phần chính; thêm giày hoặc áo khoác sẽ có nhiều biến thể hơn.';
  if (anchor && anchor.type === 'ao') return `Hiện có ${bottoms.length} quần/chân váy hợp — thêm quần hoặc chân váy để có thêm lựa chọn.`;
  if (anchor && BOTTOM_TYPES.includes(anchor.type)) return `Hiện có ${tops.length} áo hợp — thêm áo để có thêm lựa chọn.`;
  return `Hợp dịp và thời tiết hiện có ${tops.length} áo, ${bottoms.length} quần/chân váy, ${dresses.length} váy liền — thêm món ở nhóm ít nhất để có thêm lựa chọn.`;
}

function anchorWarning(anchor, occasion, weather) {
  if (!anchor) return '';
  const problems = [];
  if (!fitsOccasion(anchor, occasion)) problems.push(`độ trang trọng (${formalityLabel(anchor.formality).toLowerCase()}) không hẳn hợp ${OCCASIONS[occasion].label.toLowerCase()}`);
  if (anchor.type !== 'tui' && !WEATHERS[weather].allowed.includes(anchor.warmth)) {
    if (!(anchor.type !== 'ao-khoac' && weather === 'lanh' && CORE_TYPES.includes(anchor.type))) {
      problems.push(`độ ấm (${warmthLabel(anchor.warmth).toLowerCase()}) chưa hợp trời ${WEATHERS[weather].label.toLowerCase()}`);
    }
  }
  if (anchor.type === 'ao-khoac' && weather === 'nong') problems.push('trời nóng thường không cần áo khoác');
  return problems.length ? `Lưu ý: “${anchor.name}” có ${problems.join('; ')}.` : '';
}

function explainLook(look, { occasion, weather, anchor }) {
  const occ = OCCASIONS[occasion];
  const parts = [];
  const levels = [...new Set(look.core.map(i => i.formality))];
  const levelText = levels.map(v => formalityLabel(v).toLowerCase()).join(' và ');
  const occText = {
    'di-lam': `Các món ở mức ${levelText}, vừa vặn cho ngày đi làm`,
    'su-kien': `Mức ${levelText} đủ chỉn chu để dự sự kiện`,
    'cuoi-tuan': `Tinh thần ${levelText}, thoải mái cho cuối tuần`,
    'du-lich': `Mức ${levelText}, dễ vận động khi đi du lịch`,
  }[occasion];
  parts.push(occText + '.');

  if (weather === 'nong') parts.push('Chất liệu mỏng, thoáng hợp trời nóng.');
  else if (weather === 'mat') parts.push(look.outer
    ? `Độ dày vừa phải cho trời mát, thêm ${look.outer.name} để khoác khi trở gió.`
    : 'Độ dày vừa phải, dễ chịu khi trời mát.');
  else parts.push(look.outer ? `${look.outer.name} giữ ấm cho trời lạnh.` : 'Các món đều đủ ấm cho trời lạnh.');

  parts.push(capitalize(look.harmony.text) + '.');

  const extras = [];
  if (look.shoe) extras.push(look.shoe.name);
  if (look.bag) extras.push(look.bag.name);
  if (look.acc) extras.push(look.acc.name);
  if (extras.length) parts.push(`Hoàn thiện với ${extras.join(', ')}.`);
  if (anchor) parts.unshift(`Xây quanh món bạn chọn: ${anchor.name}.`);
  return parts.join(' ');
}

/* ---------- 11. Hiển thị mục Phối đồ ---------- */
function renderMixControls() {
  const radios = (name, obj, current) => Object.entries(obj).map(([id, o]) =>
    `<label><input type="radio" name="${name}" value="${id}" ${current === id ? 'checked' : ''}><span>${o.label}</span></label>`).join('');
  $('#occasion-options').innerHTML = radios('occasion', OCCASIONS, state.occasion);
  $('#weather-options').innerHTML = radios('weather', WEATHERS, state.weather);
}

function renderAnchorPicker() {
  const ready = readyItems().sort((a, b) => TYPES.findIndex(t => t.id === a.type) - TYPES.findIndex(t => t.id === b.type));
  if (state.anchorId && !ready.some(i => i.id === state.anchorId)) state.anchorId = null;
  const anchor = state.anchorId ? findItem(state.anchorId) : null;
  $('#anchor-current').innerHTML = anchor
    ? `Đang phối quanh: <b>${esc(anchor.name)}</b> (${TYPE[anchor.type].label}) · <button type="button" class="btn-link" data-anchor="">Bỏ chọn</button>`
    : (ready.length ? 'Chọn một món nếu bạn muốn mặc nó hôm nay.' : 'Tủ đồ chưa có món nào.');
  $('#anchor-picker').innerHTML = (ready.length ? `
    <button type="button" class="anchor-opt" data-anchor="" aria-pressed="${!anchor}">
      <div class="thumb">Không chọn</div><small>Tự do</small>
    </button>` : '') + ready.map(i => `
    <button type="button" class="anchor-opt" data-anchor="${i.id}" aria-pressed="${state.anchorId === i.id}" title="${esc(i.name)}">
      <div class="thumb"><img src="${imageUrl(i)}" alt=""></div>
      <small>${esc(i.name)}</small>
    </button>`).join('');
}

function pieceHTML(item, role) {
  if (!item) return `<div class="piece missing"><figure><div class="card-img">Món đã bị xóa</div><figcaption><b>${role || ''}</b></figcaption></figure></div>`;
  return `<div class="piece"><figure>
      <div class="card-img"><img src="${imageUrl(item)}" alt="${esc(item.name)}"></div>
      <figcaption><b>${TYPE[item.type]?.label || ''}</b>${esc(item.name)}</figcaption>
    </figure></div>`;
}

function renderResults(result) {
  const msg = $('#mix-message');
  const box = $('#mix-results');
  const parts = [];
  if (!result.keepMessage) {
  if (result.problem) parts.push(`<div class="notice warn">${esc(result.problem)}</div>`);
  if (result.notes.length) parts.push(`<div class="notice">${result.notes.map(n => `<p style="margin:0 0 4px">${esc(n)}</p>`).join('')}</div>`);
  msg.innerHTML = parts.join('');
  }
  state.results = result.looks;
  box.innerHTML = result.looks.map((look, idx) => `
    <article class="look" data-index="${idx}">
      <div class="look-pieces">${look.items.map(i => pieceHTML(i)).join('')}</div>
      <div class="look-text">
        <div class="look-number">Bộ ${String(idx + 1).padStart(2, '0')}</div>
        <h3>${OCCASIONS[state.occasion].label} · ${WEATHERS[state.weather].label}</h3>
        <p>${esc(look.explanation)}</p>
        ${look.warning ? `<p class="warn-text">${esc(look.warning)}</p>` : ''}
        <button type="button" class="btn btn-primary" data-action="save-look" data-index="${idx}" ${look.savedId ? 'disabled' : ''}>${look.savedId ? 'Đã lưu ✓' : 'Lưu bộ này'}</button>
      </div>
    </article>`).join('');
}

/* ---------- 12. Lưu bộ ---------- */
let pendingLook = null;

function openSaveDialog(look) {
  pendingLook = look;
  const form = $('#save-form');
  const sameDay = state.outfits.length + 1;
  form.elements.name.value = `${OCCASIONS[state.occasion].label} · ${WEATHERS[state.weather].label} #${sameDay}`;
  $('#save-dialog').showModal();
  form.elements.name.select();
}

async function saveLook(name) {
  const look = pendingLook;
  if (!look) return;
  const outfit = {
    id: uid(),
    name,
    itemIds: look.items.map(i => i.id),
    occasion: state.occasion,
    weather: state.weather,
    anchorId: state.anchorId,
    explanation: look.explanation,
    createdAt: Date.now(),
  };
  await dbPut('outfits', outfit);
  state.outfits.push(outfit);
  look.savedId = outfit.id;
  pendingLook = null;
  renderResults({ looks: state.results, notes: [], problem: null, keepMessage: true });
  renderSaved();
}

/* ---------- 13. Hiển thị mục Bộ đã lưu ---------- */
function renderSaved() {
  const list = [...state.outfits].sort((a, b) => b.createdAt - a.createdAt);
  $('#count-saved').textContent = list.length ? `(${list.length})` : '';
  $('#saved-empty').hidden = list.length > 0;
  $('#saved-empty').textContent = 'Chưa có bộ nào. Vào mục Phối đồ và bấm “Lưu bộ này” ở bộ bạn thích.';
  $('#saved-grid').innerHTML = list.map(o => {
    const imgs = o.itemIds.map(findItem).filter(Boolean).slice(0, 4);
    const missing = o.itemIds.length - o.itemIds.map(findItem).filter(Boolean).length;
    return `
      <button type="button" class="saved-card" data-outfit="${o.id}">
        <div class="collage n${imgs.length}">${imgs.map(i => `<img src="${imageUrl(i)}" alt="">`).join('') || '<div class="gap"></div>'}</div>
        <h3>${esc(o.name)}</h3>
        <p>${OCCASIONS[o.occasion]?.label || ''} · ${WEATHERS[o.weather]?.label || ''} · ${o.itemIds.length} món · ${formatDate(o.createdAt)}${missing ? ` · thiếu ${missing} món` : ''}</p>
      </button>`;
  }).join('');
}

function openOutfit(id) {
  const o = state.outfits.find(x => x.id === id);
  if (!o) return;
  const body = $('#outfit-dialog-body');
  body.innerHTML = `
    <p class="eyebrow">Bộ đã lưu · ${OCCASIONS[o.occasion]?.label} · ${WEATHERS[o.weather]?.label}</p>
    <h3>${esc(o.name)}</h3>
    <div class="look-pieces">${o.itemIds.map(iid => pieceHTML(findItem(iid))).join('')}</div>
    <p style="margin-top:16px">${esc(o.explanation || '')}</p>
    <form id="rename-form" class="rename-row">
      <label class="field"><span>Đổi tên</span><input type="text" name="name" maxlength="60" value="${esc(o.name)}" required></label>
      <button type="submit" class="btn">Lưu tên</button>
    </form>
    <div class="dialog-actions">
      <button type="button" class="btn btn-danger" id="delete-outfit">Xóa bộ</button>
      <button type="button" class="btn btn-primary" data-close>Đóng</button>
    </div>`;
  const dialog = $('#outfit-dialog');
  body.querySelector('#rename-form').addEventListener('submit', async e => {
    e.preventDefault();
    const name = e.target.elements.name.value.trim();
    if (!name) return;
    o.name = name;
    await dbPut('outfits', o);
    body.querySelector('h3').textContent = name;
    renderSaved();
  });
  body.querySelector('#delete-outfit').addEventListener('click', async () => {
    dialog.close();
    if (!(await confirmBox(`Xóa bộ “${o.name}”? Các món trong tủ đồ vẫn được giữ nguyên.`))) return;
    await dbDelete('outfits', o.id);
    state.outfits = state.outfits.filter(x => x.id !== o.id);
    state.results.forEach(l => { if (l.savedId === o.id) l.savedId = null; });
    renderAll();
  });
  dialog.showModal();
}

/* ---------- 14. Điều hướng giữa các mục ---------- */
const ROUTES = { '#tu-do': 'wardrobe', '#phoi-do': 'mix', '#bo-da-luu': 'saved' };

function showView() {
  const view = ROUTES[location.hash] || 'wardrobe';
  for (const v of ['wardrobe', 'mix', 'saved']) $(`#view-${v}`).hidden = v !== view;
  document.querySelectorAll('.tab').forEach(t => {
    const on = t.dataset.view === view;
    t.classList.toggle('active', on);
    if (on) t.setAttribute('aria-current', 'page'); else t.removeAttribute('aria-current');
  });
  if (view === 'mix') renderAnchorPicker();
  window.scrollTo(0, 0);
}

function renderAll() {
  renderWardrobe();
  renderAnchorPicker();
  renderSaved();
  if (state.results.length) renderResults({ looks: state.results.filter(l => l.items.every(i => findItem(i.id))), notes: [], problem: null, keepMessage: true });
}

/* ---------- 15. Gắn sự kiện ---------- */
function bindEvents() {
  window.addEventListener('hashchange', showView);

  $('#file-input').addEventListener('change', e => {
    handleFiles(e.target.files).finally(() => { e.target.value = ''; });
  });

  // Lưu từng món nháp
  $('#draft-list').addEventListener('submit', async e => {
    e.preventDefault();
    const item = findItem(e.target.dataset.id);
    if (item && await saveItemFromForm(item, e.target)) renderAll();
  });

  // Lưu tất cả món nháp đã điền đủ
  $('#save-all-drafts').addEventListener('click', async () => {
    const forms = [...document.querySelectorAll('#draft-list form.draft')];
    let saved = 0;
    for (const form of forms) {
      const item = findItem(form.dataset.id);
      if (item && await saveItemFromForm(item, form)) saved++;
    }
    const left = forms.length - saved;
    if (saved) renderAll();
    const status = $('#upload-status');
    status.hidden = false;
    status.className = left ? 'notice warn' : 'notice';
    status.textContent = left
      ? `Đã lưu ${saved} món. Còn ${left} món thiếu thông tin — xem dòng chữ đỏ dưới từng món.`
      : `Đã lưu ${saved} món vào tủ đồ.`;
    if (left) {
      // Giữ lại thông báo lỗi trên những món chưa lưu sau khi vẽ lại
      document.querySelectorAll('#draft-list form.draft').forEach(f => readItemForm(f));
    }
  });

  // Bộ lọc loại món
  $('#type-filter').addEventListener('click', e => {
    const chip = e.target.closest('[data-filter]');
    if (!chip) return;
    state.filter = chip.dataset.filter;
    renderWardrobe();
  });

  // Nút trong thẻ món (sửa / xóa / phối quanh)
  document.addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (btn) {
      const { action, id } = btn.dataset;
      if (action === 'edit') openEditDialog(findItem(id));
      if (action === 'delete') deleteItem(id);
      if (action === 'anchor') {
        state.anchorId = id;
        location.hash = '#phoi-do';
        showView();
      }
      if (action === 'save-look') openSaveDialog(state.results[Number(btn.dataset.index)]);
      return;
    }
    const closer = e.target.closest('[data-close]');
    if (closer) closer.closest('dialog').close();
  });

  // Chọn món để phối quanh
  document.addEventListener('click', e => {
    const opt = e.target.closest('[data-anchor]');
    if (!opt) return;
    state.anchorId = opt.dataset.anchor || null;
    renderAnchorPicker();
  });

  // Gợi ý trang phục
  $('#mix-form').addEventListener('change', e => {
    if (e.target.name === 'occasion') state.occasion = e.target.value;
    if (e.target.name === 'weather') state.weather = e.target.value;
  });
  $('#mix-form').addEventListener('submit', e => {
    e.preventDefault();
    const result = generateOutfits({ occasion: state.occasion, weather: state.weather, anchorId: state.anchorId });
    renderResults(result);
    const target = result.looks.length ? $('#mix-results') : $('#mix-message');
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  // Hộp thoại lưu bộ
  $('#save-form').addEventListener('submit', async e => {
    const name = e.target.elements.name.value.trim();
    if (!name) { e.preventDefault(); return; }
    await saveLook(name);
  });

  // Mở bộ đã lưu
  $('#saved-grid').addEventListener('click', e => {
    const card = e.target.closest('[data-outfit]');
    if (card) openOutfit(card.dataset.outfit);
  });
}

/* ---------- 16. Khởi động ---------- */
async function init() {
  if (!('indexedDB' in window)) {
    document.querySelector('main').innerHTML = '<div class="notice warn">Trình duyệt này không hỗ trợ IndexedDB nên không thể lưu tủ đồ. Hãy mở bằng Google Chrome.</div>';
    return;
  }
  try {
    [state.items, state.outfits] = await Promise.all([dbGetAll('items'), dbGetAll('outfits')]);
  } catch (err) {
    document.querySelector('main').insertAdjacentHTML('afterbegin',
      `<div class="notice warn">Không mở được kho dữ liệu của trình duyệt (${esc(err && err.message)}). Nếu đang ở chế độ ẩn danh, hãy mở cửa sổ Chrome bình thường.</div>`);
  }
  // Xin Chrome giữ dữ liệu lâu dài (không bắt buộc)
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

  renderMixControls();
  bindEvents();
  renderAll();
  showView();
}

init();
