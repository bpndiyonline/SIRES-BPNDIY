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

      const agendas = [];
      const lastAfter = sheet.getLastRow();
      if (lastAfter > 1) {
        sheet.getRange(2, 4, lastAfter - 1, 9).getDisplayValues().forEach(row => {
          const id = row[8]; // Column L; column D is index 0 in this range.
          if (id) agendas.push({ id, agenda: row[0] });
        });
      }
      return json({ ok: true, syncedIds, agendas });
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

function json(value) {
  return ContentService.createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}
