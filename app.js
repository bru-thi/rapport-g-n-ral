const state = {
  reports: [],
  counts: {},
  currentReport: null,
  entries: [],
  editingText: new Set(),
  editingDate: new Set(),
  editingTitle: false,
  photoUrls: new Map()
};

function parseRoute() {
  const hash = location.hash || '#/';
  const m = hash.match(/^#\/rapport\/([^/]+)$/);
  if (m) return { name: 'report', id: decodeURIComponent(m[1]) };
  return { name: 'home' };
}

function revokePhotoUrls() {
  for (const url of state.photoUrls.values()) URL.revokeObjectURL(url);
  state.photoUrls.clear();
}

function photoUrl(entryId, photo) {
  const key = entryId + ':' + photo.id;
  if (!state.photoUrls.has(key)) {
    state.photoUrls.set(key, URL.createObjectURL(photo.blob));
  }
  return state.photoUrls.get(key);
}

async function render() {
  revokePhotoUrls();
  const app = document.getElementById('app');
  const route = parseRoute();
  if (route.name === 'report') {
    const report = await dbGet('reports', route.id);
    if (!report) {
      location.hash = '#/';
      return;
    }
    state.currentReport = report;
    state.entries = await dbByIndex('entries', 'by_rapport', report.id);
    state.editingTitle = false;
    app.innerHTML = reportHTML(report, state.entries);
  } else {
    state.currentReport = null;
    state.reports = (await dbAll('reports')).sort((a, b) =>
      String(b.modifieLe || '').localeCompare(String(a.modifieLe || '')));
    const allEntries = await dbAll('entries');
    state.counts = {};
    for (const e of allEntries) {
      state.counts[e.rapportId] = (state.counts[e.rapportId] || 0) + 1;
    }
    app.innerHTML = homeHTML();
  }
  window.scrollTo(0, 0);
}

function homeHTML() {
  const items = state.reports.map(r => {
    const n = state.counts[r.id] || 0;
    return '<li class="report-item">' +
      '<a class="report-link" href="#/rapport/' + encodeURIComponent(r.id) + '">' +
      '<span class="report-title">' + esc(r.titre) + '</span>' +
      '<span class="report-meta">' + n + ' entrée' + (n > 1 ? 's' : '') +
      ' · créé le ' + esc(fmtDateTime(r.creeLe)) + '</span>' +
      '</a>' +
      '<button class="danger small" data-action="delete-report" data-id="' + esc(r.id) + '" title="Supprimer le rapport">🗑</button>' +
      '</li>';
  }).join('');

  const list = state.reports.length
    ? '<ul class="reports">' + items + '</ul>'
    : '<p class="empty-note">Aucun rapport pour le moment.<br>Créez votre premier rapport ci-dessus. 📒</p>';

  return '<header class="topbar"><h1>📒 Rapports chronologiques</h1></header>' +
    '<main>' +
    '<form class="new-report" data-form="new-report">' +
    '<input name="titre" placeholder="Titre du nouveau rapport…" required maxlength="120">' +
    '<button class="primary" type="submit">＋ Créer</button>' +
    '</form>' +
    list +
    '<section class="backup">' +
    '<span>💾 Sauvegarde des données :</span>' +
    '<button class="small" data-action="backup">Exporter en JSON</button>' +
    '<label class="btn small">Restaurer depuis un JSON<input type="file" id="restore-input" accept="application/json,.json" hidden></label>' +
    '</section>' +
    '</main>';
}

function entryHTML(e) {
  const id = esc(e.id);
  const editingText = state.editingText.has(e.id);
  const editingDate = state.editingDate.has(e.id);

  let dateBlock;
  if (editingDate) {
    dateBlock = '<form class="date-form" data-form="save-date" data-id="' + id + '">' +
      '<input type="datetime-local" name="date" value="' + esc(toInputValue(e.dateISO)) + '" required>' +
      '<div class="row"><button class="primary small" type="submit">Enregistrer la date</button>' +
      '<button class="small" type="button" data-action="toggle-date" data-id="' + id + '">Annuler</button></div>' +
      '</form>';
  } else {
    dateBlock = '<span class="entry-date">🕒 ' + esc(fmtDateTime(e.dateISO)) + '</span>';
  }

  let textBlock;
  if (editingText) {
    textBlock = '<form class="text-form" data-form="save-text" data-id="' + id + '">' +
      '<textarea name="texte" rows="4" placeholder="Décrivez ce qui s\'est passé…">' + esc(e.texte) + '</textarea>' +
      '<div class="row"><button class="primary small" type="submit">Enregistrer</button>' +
      '<button class="small" type="button" data-action="toggle-text" data-id="' + id + '">Annuler</button></div>' +
      '</form>';
  } else {
    const t = String(e.texte || '').trim();
    textBlock = t
      ? '<div class="entry-text">' + esc(e.texte).replace(/\n/g, '<br>') + '</div>'
      : '<div class="entry-text empty">Aucun texte — touchez « Modifier le texte » pour décrire l\'étape.</div>';
  }

  const photos = (e.photos || []).map(p =>
    '<div class="photo">' +
    '<img src="' + photoUrl(e.id, p) + '" alt="' + esc(p.nom || 'photo') + '">' +
    '<button class="remove" data-action="remove-photo" data-id="' + id + '" data-photo="' + esc(p.id) + '" title="Retirer la photo">✕</button>' +
    '</div>'
  ).join('');

  return '<article class="entry card" id="entry-' + id + '">' +
    '<div class="entry-head">' + dateBlock +
    '<div class="entry-actions">' +
    (editingDate ? '' : '<button class="small" data-action="toggle-date" data-id="' + id + '">🕒 Modifier la date</button>') +
    (editingText ? '' : '<button class="small" data-action="toggle-text" data-id="' + id + '">✏️ Modifier le texte</button>') +
    '<button class="danger small" data-action="delete-entry" data-id="' + id + '">🗑</button>' +
    '</div></div>' +
    textBlock +
    (photos ? '<div class="photos">' + photos + '</div>' : '') +
    '<label class="btn small add-photo">📷 Ajouter une photo' +
    '<input type="file" data-photos data-id="' + id + '" accept="image/*" capture="environment" multiple hidden>' +
    '</label>' +
    '</article>';
}

function reportHTML(report, entries) {
  const sorted = sortEntries(entries);

  let titleBlock;
  if (state.editingTitle) {
    titleBlock = '<form class="title-form" data-form="save-title">' +
      '<input name="titre" value="' + esc(report.titre) + '" required maxlength="120">' +
      '<button type="submit">OK</button></form>';
  } else {
    titleBlock = '<h1 data-action="edit-title" title="Toucher pour renommer">' + esc(report.titre) + ' ✏️</h1>';
  }

  let stats = '';
  if (sorted.length) {
    stats = sorted.length + ' entrée' + (sorted.length > 1 ? 's' : '') +
      ' · du ' + fmtDateTime(sorted[0].dateISO) + ' au ' + fmtDateTime(sorted[sorted.length - 1].dateISO);
  } else {
    stats = 'Aucune entrée — ajoutez la première ci-dessous, elle sera horodatée automatiquement.';
  }

  let body;
  if (sorted.length) {
    let lastDay = null;
    const blocks = [];
    for (const e of sorted) {
      const day = String(e.dateISO || '').slice(0, 10);
      if (day !== lastDay) {
        blocks.push('<h2 class="day-header">' + esc(fmtDay(e.dateISO)) + '</h2>');
        lastDay = day;
      }
      blocks.push(entryHTML(e));
    }
    body = blocks.join('');
  } else {
    body = '<p class="empty-note">Le rapport est vide pour l\'instant.</p>';
  }

  return '<header class="topbar">' +
    '<a class="back" href="#/">←</a>' + titleBlock +
    '<div class="actions">' +
    '<button data-action="export-html" title="Télécharger un fichier HTML autonome">⬇ HTML</button>' +
    '<button data-action="print-pdf" title="Imprimer ou enregistrer en PDF">🖨 PDF</button>' +
    '<button data-action="delete-report" title="Supprimer ce rapport et ses entrées">🗑</button>' +
    '</div></header>' +
    '<main class="report-main">' +
    '<p class="stats">🗓️ ' + esc(stats) + '</p>' +
    '<button class="primary add-entry" data-action="add-entry">＋ Ajouter une entrée (horodatée maintenant)</button>' +
    body +
    '<button class="primary add-entry" data-action="add-entry">＋ Ajouter une entrée (horodatée maintenant)</button>' +
    '</main>';
}

async function compressImage(file) {
  try {
    const bitmap = await createImageBitmap(file);
    const max = 1600;
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.85));
    return blob || file;
  } catch (err) {
    return file;
  }
}

async function touchReport(id) {
  const report = await dbGet('reports', id);
  if (report) {
    report.modifieLe = nowISO();
    await dbPut('reports', report);
  }
}

async function onClick(ev) {
  const el = ev.target.closest('[data-action]');
  if (!el) return;
  const action = el.dataset.action;
  const id = el.dataset.id;

  if (action === 'edit-title') {
    state.editingTitle = true;
    render();
  } else if (action === 'add-entry') {
    const now = nowISO();
    const entry = {
      id: uid(),
      rapportId: state.currentReport.id,
      dateISO: now,
      texte: '',
      photos: [],
      creeLe: now,
      modifieLe: now
    };
    await dbPut('entries', entry);
    await touchReport(entry.rapportId);
    state.editingText.add(entry.id);
    await render();
    const node = document.getElementById('entry-' + entry.id);
    if (node) {
      node.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const ta = node.querySelector('textarea');
      if (ta) ta.focus();
    }
  } else if (action === 'delete-entry') {
    if (!confirm('Supprimer cette entrée (texte et photos) ?')) return;
    await dbDelete('entries', id);
    await touchReport(state.currentReport.id);
    state.editingText.delete(id);
    state.editingDate.delete(id);
    render();
  } else if (action === 'toggle-text') {
    if (state.editingText.has(id)) state.editingText.delete(id);
    else state.editingText.add(id);
    render();
  } else if (action === 'toggle-date') {
    if (state.editingDate.has(id)) state.editingDate.delete(id);
    else state.editingDate.add(id);
    render();
  } else if (action === 'remove-photo') {
    const entry = await dbGet('entries', id);
    if (!entry) return;
    entry.photos = (entry.photos || []).filter(p => p.id !== el.dataset.photo);
    entry.modifieLe = nowISO();
    await dbPut('entries', entry);
    await touchReport(entry.rapportId);
    render();
  } else if (action === 'export-html') {
    exportReportAsFile(state.currentReport, state.entries);
  } else if (action === 'print-pdf') {
    printReport(state.currentReport, state.entries);
  } else if (action === 'delete-report') {
    const reportId = state.currentReport ? state.currentReport.id : id;
    if (!confirm('Supprimer définitivement ce rapport et toutes ses entrées ?')) return;
    const entries = await dbByIndex('entries', 'by_rapport', reportId);
    for (const e of entries) await dbDelete('entries', e.id);
    await dbDelete('reports', reportId);
    location.hash = '#/';
    render();
  } else if (action === 'backup') {
    exportBackup();
  }
}

async function onSubmit(ev) {
  const form = ev.target.closest('[data-form]');
  if (!form) return;
  ev.preventDefault();
  const kind = form.dataset.form;
  const id = form.dataset.id;

  if (kind === 'new-report') {
    const titre = form.titre.value.trim();
    if (!titre) return;
    const now = nowISO();
    const report = { id: uid(), titre, creeLe: now, modifieLe: now };
    await dbPut('reports', report);
    location.hash = '#/rapport/' + encodeURIComponent(report.id);
    render();
  } else if (kind === 'save-title') {
    const titre = form.titre.value.trim();
    if (titre && state.currentReport) {
      state.currentReport.titre = titre;
      state.currentReport.modifieLe = nowISO();
      await dbPut('reports', state.currentReport);
    }
    state.editingTitle = false;
    render();
  } else if (kind === 'save-text') {
    const entry = await dbGet('entries', id);
    if (entry) {
      entry.texte = form.texte.value;
      entry.modifieLe = nowISO();
      await dbPut('entries', entry);
      await touchReport(entry.rapportId);
    }
    state.editingText.delete(id);
    render();
  } else if (kind === 'save-date') {
    const entry = await dbGet('entries', id);
    const value = form.date.value;
    if (entry && value) {
      entry.dateISO = value.length === 16 ? value + ':00' : value;
      entry.modifieLe = nowISO();
      await dbPut('entries', entry);
      await touchReport(entry.rapportId);
    }
    state.editingDate.delete(id);
    render();
  }
}

async function onChange(ev) {
  const input = ev.target;
  if (input.hasAttribute('data-photos')) {
    const id = input.dataset.id;
    const entry = await dbGet('entries', id);
    if (!entry || !input.files || !input.files.length) return;
    entry.photos = entry.photos || [];
    for (const file of input.files) {
      const blob = await compressImage(file);
      entry.photos.push({
        id: uid(),
        nom: file.name || 'photo.jpg',
        type: blob.type || file.type || 'image/jpeg',
        blob
      });
    }
    entry.modifieLe = nowISO();
    await dbPut('entries', entry);
    await touchReport(entry.rapportId);
    input.value = '';
    render();
  } else if (input.id === 'restore-input') {
    if (input.files && input.files[0]) {
      try {
        await importBackup(input.files[0]);
      } catch (err) {
        alert('Impossible de restaurer ce fichier : ' + err.message);
      }
    }
    input.value = '';
  }
}

function dataURLToBlob(dataURL) {
  const comma = dataURL.indexOf(',');
  const head = dataURL.slice(0, comma);
  const data = dataURL.slice(comma + 1);
  const mime = (head.match(/data:([^;]+)/) || [null, 'image/jpeg'])[1];
  const bin = atob(data);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

async function exportBackup() {
  const reports = await dbAll('reports');
  const entries = await dbAll('entries');
  const entriesOut = [];
  for (const e of entries) {
    const photos = [];
    for (const p of e.photos || []) {
      photos.push({
        id: p.id,
        nom: p.nom,
        type: p.type || 'image/jpeg',
        data: await photoToDataURL(p.blob)
      });
    }
    entriesOut.push({
      id: e.id, rapportId: e.rapportId, dateISO: e.dateISO,
      texte: e.texte, creeLe: e.creeLe, modifieLe: e.modifieLe, photos
    });
  }
  const data = {
    app: 'rapports-chronologiques',
    version: 1,
    exportLe: nowISO(),
    reports,
    entries: entriesOut
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
  downloadBlob(blob, 'sauvegarde-rapports-' + nowISO().slice(0, 10) + '.json');
}

async function importBackup(file) {
  const text = await file.text();
  const data = JSON.parse(text);
  if (!data || !Array.isArray(data.reports) || !Array.isArray(data.entries)) {
    throw new Error('format non reconnu');
  }
  if (!confirm('Remplacer toutes les données actuelles par cette sauvegarde ?')) return;
  await dbClear('entries');
  await dbClear('reports');
  for (const r of data.reports) {
    await dbPut('reports', r);
  }
  for (const e of data.entries) {
    const entry = {
      id: e.id, rapportId: e.rapportId, dateISO: e.dateISO,
      texte: e.texte || '', creeLe: e.creeLe, modifieLe: e.modifieLe,
      photos: (e.photos || []).map(p => ({
        id: p.id || uid(),
        nom: p.nom || 'photo.jpg',
        type: p.type || 'image/jpeg',
        blob: p.data ? dataURLToBlob(p.data) : p.blob
      }))
    };
    await dbPut('entries', entry);
  }
  await render();
  alert('Sauvegarde restaurée : ' + data.reports.length + ' rapport(s), ' + data.entries.length + ' entrée(s).');
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    });
  }
}

document.getElementById('app').addEventListener('click', onClick);
document.getElementById('app').addEventListener('submit', onSubmit);
document.getElementById('app').addEventListener('change', onChange);
window.addEventListener('hashchange', render);
window.addEventListener('DOMContentLoaded', () => {
  registerServiceWorker();
  render();
});
