const EXPORT_CSS = `
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    color: #0f172a; background: #fff; margin: 0; padding: 32px;
    line-height: 1.55; font-size: 15px;
  }
  h1 { font-size: 1.6rem; color: #1d4ed8; margin: 0 0 4px; }
  .meta { color: #64748b; font-size: 0.9rem; margin: 0 0 24px; }
  h2.day {
    font-size: 1rem; color: #1d4ed8; text-transform: capitalize;
    border-bottom: 2px solid #2563eb; padding-bottom: 4px;
    margin: 26px 0 12px;
  }
  section.entry {
    border: 1px solid #e2e8f0; border-radius: 10px;
    padding: 12px 14px; margin-bottom: 12px;
    page-break-inside: avoid;
  }
  .entry-date { font-weight: 700; color: #1d4ed8; font-size: 0.9rem; margin-bottom: 6px; }
  p.texte { margin: 4px 0 8px; white-space: pre-wrap; }
  .photos { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 8px; }
  figure { margin: 0; }
  .photos img {
    width: 100%; aspect-ratio: 1; object-fit: cover;
    border-radius: 8px; border: 1px solid #e2e8f0; display: block;
  }
  figcaption { font-size: 0.75rem; color: #64748b; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  @page { margin: 18mm; }
  @media print { body { padding: 0; } }
`;

function photoToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

async function buildReportInner(report, entries) {
  const sorted = sortEntries(entries);
  const parts = [];
  parts.push('<h1>' + esc(report.titre) + '</h1>');
  const meta = 'Rapport créé le ' + fmtDateTime(report.creeLe) +
    ' — ' + sorted.length + ' entrée' + (sorted.length > 1 ? 's' : '');
  parts.push('<p class="meta">' + esc(meta) + '</p>');
  let lastDay = null;
  for (const e of sorted) {
    const day = String(e.dateISO || '').slice(0, 10);
    if (day !== lastDay) {
      parts.push('<h2 class="day">' + esc(fmtDay(e.dateISO)) + '</h2>');
      lastDay = day;
    }
    parts.push('<section class="entry">');
    parts.push('<div class="entry-date">🕒 ' + esc(fmtDateTime(e.dateISO)) + '</div>');
    const text = String(e.texte || '').trim();
    if (text) {
      parts.push('<p class="texte">' + esc(text).replace(/\n/g, '<br>') + '</p>');
    }
    if (e.photos && e.photos.length) {
      parts.push('<div class="photos">');
      for (const p of e.photos) {
        const url = await photoToDataURL(p.blob);
        parts.push('<figure><img src="' + url + '" alt="' + esc(p.nom || 'photo') + '">' +
          '<figcaption>' + esc(p.nom || '') + '</figcaption></figure>');
      }
      parts.push('</div>');
    }
    parts.push('</section>');
  }
  return parts.join('\n');
}

async function buildReportHTML(report, entries) {
  const inner = await buildReportInner(report, entries);
  return '<!DOCTYPE html>\n<html lang="fr">\n<head>\n<meta charset="utf-8">\n' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
    '<title>' + esc(report.titre) + '</title>\n<style>' + EXPORT_CSS + '</style>\n</head>\n' +
    '<body>\n' + inner + '\n</body>\n</html>\n';
}

function downloadBlob(blob, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

async function exportReportAsFile(report, entries) {
  const html = await buildReportHTML(report, entries);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const name = 'rapport-' + slugify(report.titre) + '-' + nowISO().slice(0, 10) + '.html';
  downloadBlob(blob, name);
}

async function printReport(report, entries) {
  const inner = await buildReportInner(report, entries);
  const container = document.getElementById('print-report');
  container.innerHTML = '<style>' + EXPORT_CSS + '</style>' + inner;
  window.print();
}
