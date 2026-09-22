import { env } from "cloudflare:workers";

type SheetReply = {
  ok?: boolean;
  syncedIds?: unknown;
  agendas?: unknown;
};

const idPattern = /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i;

/** Append unsynced site records and read agenda numbers back from the sheet. */
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
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`Sheet returned ${response.status}`);
  const data = await response.json() as SheetReply;
  if (data.ok !== true || !Array.isArray(data.syncedIds) || !Array.isArray(data.agendas)) {
    throw new Error("Invalid sheet response");
  }

  const pending = new Set(results.map(row => String(row.id)));
  const saved = data.syncedIds.filter((id): id is string => typeof id === "string" && pending.has(id));
  for (const id of saved) {
    await db.prepare("UPDATE surat SET sheet_synced = 1 WHERE id = ?").bind(id).run();
  }
  for (const item of data.agendas) {
    if (!item || typeof item !== "object") continue;
    const entry = item as { id?: unknown; agenda?: unknown };
    if (typeof entry.id !== "string" || !idPattern.test(entry.id)) continue;
    const agenda = String(entry.agenda ?? "").trim().slice(0, 150);
    await db.prepare("UPDATE surat SET nomor_agenda = ? WHERE id = ? AND sheet_synced = 1")
      .bind(agenda || null, entry.id).run();
  }
  return true;
}
