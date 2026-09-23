import { env } from "cloudflare:workers";

type SheetReply = {
  ok?: boolean;
  syncedIds?: unknown;
  sheetRecords?: unknown;
  authoritativeSnapshot?: unknown;
  sheetRecordCount?: unknown;
};

const idPattern = /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i;

type SheetRecord = {
  id?: unknown;
  tanggalMasuk?: unknown;
  nomorSurat?: unknown;
  nomorAgenda?: unknown;
  perihal?: unknown;
  instansi?: unknown;
  jenisSurat?: unknown;
  tanggalKeluar?: unknown;
  disposisi?: unknown;
  catatan?: unknown;
  tujuanDisposisi?: unknown;
};

const clean = (value: unknown, max: number) => String(value ?? "").trim().slice(0, max);
const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

/** Append new site records, then mirror every populated sheet row into the site. */
export async function syncSheet(db: D1Database): Promise<boolean> {
  const url = env.SHEET_WEB_APP_URL;
  const secret = env.SHEET_SYNC_SECRET;
  if (!url || !secret) return false;

  const { results } = await db.prepare(`
    SELECT id, tanggal_masuk AS tanggalMasuk, nomor_surat AS nomorSurat,
      perihal, instansi, jenis_surat AS jenisSurat,
      tanggal_keluar AS tanggalKeluar, disposisi, catatan,
      tujuan_disposisi AS tujuanDisposisi
    FROM surat WHERE sheet_synced = 0 ORDER BY created_at LIMIT 100
  `).all();

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "text/plain; charset=utf-8" },
    body: JSON.stringify({ secret, records: results }),
    signal: AbortSignal.timeout(25000),
  });
  if (!response.ok) throw new Error(`Sheet returned ${response.status}`);
  const data = await response.json() as SheetReply;
  if (data.ok !== true || !Array.isArray(data.syncedIds) || !Array.isArray(data.sheetRecords)) {
    throw new Error("Invalid sheet response");
  }
  if (data.authoritativeSnapshot !== true || data.sheetRecordCount !== data.sheetRecords.length) {
    throw new Error("Incomplete sheet snapshot");
  }

  const pending = new Set(results.map(row => String(row.id)));
  const saved = data.syncedIds.filter((id): id is string => typeof id === "string" && pending.has(id));
  for (const id of saved) {
    await db.prepare("UPDATE surat SET sheet_synced = 1 WHERE id = ?").bind(id).run();
  }
  const current = await db.prepare(`
    SELECT id, tanggal_masuk AS tanggalMasuk, nomor_surat AS nomorSurat,
      nomor_agenda AS nomorAgenda, perihal, instansi, jenis_surat AS jenisSurat,
      tanggal_keluar AS tanggalKeluar, disposisi, catatan,
      tujuan_disposisi AS tujuanDisposisi, sheet_synced AS sheetSynced
    FROM surat
  `).all();
  const currentById = new Map(current.results.map(row => [String(row.id), row]));
  const sheetIds = new Set<string>();
  const statements: D1PreparedStatement[] = [];
  for (const item of data.sheetRecords) {
    if (!item || typeof item !== "object") continue;
    const entry = item as SheetRecord;
    const id = clean(entry.id, 64);
    const tanggalMasuk = clean(entry.tanggalMasuk, 10);
    const jenisSurat = clean(entry.jenisSurat, 10);
    const tanggalKeluar = clean(entry.tanggalKeluar, 10);
    if (!idPattern.test(id)) continue;
    sheetIds.add(id);

    const nomorSurat = clean(entry.nomorSurat, 150);
    const perihal = clean(entry.perihal, 500);
    const instansi = clean(entry.instansi, 250);
    const storedTanggalMasuk = validDate(tanggalMasuk) ? tanggalMasuk : "";
    const storedTanggalKeluar = validDate(tanggalKeluar) ? tanggalKeluar : "";
    const values = {
      tanggalMasuk: storedTanggalMasuk,
      nomorSurat,
      nomorAgenda: clean(entry.nomorAgenda, 150) || null,
      perihal,
      instansi,
      jenisSurat: ["Asli", "Tembusan"].includes(jenisSurat) ? jenisSurat : "",
      tanggalKeluar: storedTanggalKeluar || null,
      disposisi: clean(entry.disposisi, 500),
      catatan: clean(entry.catatan, 2000),
      tujuanDisposisi: clean(entry.tujuanDisposisi, 250),
    };
    const existing = currentById.get(id);
    if (existing && Object.entries(values).every(([key, value]) => existing[key] === value)) continue;
    statements.push(db.prepare(`
      INSERT INTO surat (id, tanggal_masuk, nomor_surat, nomor_agenda, perihal,
        instansi, jenis_surat, tanggal_keluar, disposisi, catatan,
        tujuan_disposisi, created_at, sheet_synced)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      ON CONFLICT(id) DO UPDATE SET
        tanggal_masuk = excluded.tanggal_masuk,
        nomor_surat = excluded.nomor_surat,
        nomor_agenda = excluded.nomor_agenda,
        perihal = excluded.perihal,
        instansi = excluded.instansi,
        jenis_surat = excluded.jenis_surat,
        tanggal_keluar = excluded.tanggal_keluar,
        disposisi = excluded.disposisi,
        catatan = excluded.catatan,
        tujuan_disposisi = excluded.tujuan_disposisi,
        sheet_synced = 1
    `).bind(id, values.tanggalMasuk, values.nomorSurat, values.nomorAgenda,
      values.perihal, values.instansi, values.jenisSurat, values.tanggalKeluar,
      values.disposisi, values.catatan, values.tujuanDisposisi, storedTanggalMasuk
        ? `${storedTanggalMasuk}T00:00:00.000Z`
        : "1970-01-01T00:00:00.000Z"));
  }
  for (let index = 0; index < statements.length; index += 100) {
    await db.batch(statements.slice(index, index + 100));
  }
  const deletions = current.results
    .filter(row => Number(row.sheetSynced) === 1)
    .map(row => String(row.id))
    .filter(id => !sheetIds.has(id))
    .map(id => db.prepare("DELETE FROM surat WHERE id = ?").bind(id));
  for (let index = 0; index < deletions.length; index += 100) {
    await db.batch(deletions.slice(index, index + 100));
  }
  return true;
}
