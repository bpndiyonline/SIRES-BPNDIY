// Bind this project to the supplied "Register Surat Masuk" spreadsheet.
// Set SIRES_SYNC_SECRET in Project Settings > Script Properties before deploying.
const SPREADSHEET_ID = '1kN0NXJRtR6doRk-WzobA508CAUP4KUwcYn93MsaIyQA';
const SHEET_NAME = 'Sheet1';
const HEADERS = [
  'No.', 'Tanggal Masuk', 'Nomor Surat', 'Nomor Agenda E-Office',
  'Perihal', 'Instansi', 'Jenis Surat', 'Tanggal Keluar',
  'Disposisi', 'Catatan / Arahan', 'Tujuan Disposisi'
];

function doPost(e) {
  try {
    const request = JSON.parse(e.postData.contents);
    const configuredSecret = PropertiesService.getScriptProperties().getProperty('SIRES_SYNC_SECRET');
    if (!configuredSecret || request.secret !== configuredSecret) throw new Error('Unauthorized');
    if (!Array.isArray(request.records) || request.records.length > 100) throw new Error('Invalid records');

    const lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
      if (!sheet) throw new Error('Sheet1 not found');
      const currentHeaders = sheet.getRange(1, 1, 1, HEADERS.length).getDisplayValues()[0];
      if (HEADERS.some((header, index) => currentHeaders[index] !== header)) {
        throw new Error('Sheet headers have changed; no rows were added');
      }
      const idHeader = sheet.getRange(1, 12).getDisplayValue();
      if (idHeader && idHeader !== 'SiReS ID') throw new Error('Column L is already in use');
      if (!idHeader) sheet.getRange(1, 12).setValue('SiReS ID');

      const existingIds = new Set();
      const lastBefore = sheet.getLastRow();
      if (lastBefore > 1) {
        sheet.getRange(2, 12, lastBefore - 1, 1).getDisplayValues()
          .forEach(row => { if (row[0]) existingIds.add(row[0]); });
      }
      const syncedIds = [];
      request.records.forEach(record => {
        if (!record || !/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(String(record.id || ''))) return;
        if (!existingIds.has(record.id)) {
          const number = sheet.getLastRow();
          sheet.appendRow([
            number, text(record.tanggalMasuk), text(record.nomorSurat), '',
            text(record.perihal), text(record.instansi), text(record.jenisSurat),
            text(record.tanggalKeluar), text(record.disposisi), text(record.catatan),
            text(record.tujuanDisposisi), record.id
          ]);
          existingIds.add(record.id);
        }
        syncedIds.push(record.id);
      });

      const sheetRecords = [];
      const lastAfter = sheet.getLastRow();
      if (lastAfter > 1) {
        const range = sheet.getRange(2, 1, lastAfter - 1, 12);
        const values = range.getValues();
        const ids = range.getColumn() === 1
          ? sheet.getRange(2, 12, lastAfter - 1, 1).getDisplayValues()
          : [];
        let idsChanged = false;
        values.forEach((row, index) => {
          // Every populated register row gets an ID, even if a required website field is incomplete.
          if (!row.slice(0, 11).some(value => String(value || '').trim())) return;
          let id = String(ids[index][0] || '').trim();
          if (!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(id)) {
            id = Utilities.getUuid();
            ids[index][0] = id;
            idsChanged = true;
          }
          const tanggalMasuk = dateText(row[1]);
          const tanggalKeluar = dateText(row[7]);
          sheetRecords.push({
            id,
            tanggalMasuk,
            nomorSurat: text(row[2]),
            nomorAgenda: text(row[3]),
            perihal: text(row[4]),
            instansi: text(row[5]),
            jenisSurat: text(row[6]),
            tanggalKeluar,
            disposisi: text(row[8]),
            catatan: text(row[9]),
            tujuanDisposisi: text(row[10])
          });
        });
        if (idsChanged) sheet.getRange(2, 12, lastAfter - 1, 1).setValues(ids);
      }
      return json({ ok: true, syncedIds, sheetRecords });
    } finally {
      lock.releaseLock();
    }
  } catch (error) {
    return json({ ok: false, error: String(error.message || error) });
  }
}

function text(value) {
  const result = String(value == null ? '' : value);
  // Keep user-entered text from becoming a spreadsheet formula.
  return /^[=+\-@]/.test(result) ? "'" + result : result;
}

function dateText(value) {
  if (!value) return '';
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value)) {
    return Utilities.formatDate(value, 'Asia/Jakarta', 'yyyy-MM-dd');
  }
  const raw = String(value).trim();
  let match = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (match) return match[1] + '-' + match[2].padStart(2, '0') + '-' + match[3].padStart(2, '0');
  match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) return match[3] + '-' + match[2].padStart(2, '0') + '-' + match[1].padStart(2, '0');
  return '';
}

function json(value) {
  return ContentService.createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}
