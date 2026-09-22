import { env } from "cloudflare:workers";
import { syncSheet } from "@/lib/sheet-sync";

type Input = {
  tanggalMasuk?: string;
  nomorSurat?: string;
  perihal?: string;
  instansi?: string;
  jenisSurat?: string;
  tanggalKeluar?: string;
  disposisi?: string;
  catatan?: string;
  tujuanDisposisi?: string;
};

const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
const trim = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";

export async function GET() {
  try {
    const db = env.DB;
    if (!db) throw new Error("DB unavailable");
    try { await syncSheet(db); }
    catch (error) { console.error("Sheet sync failed", error); }
    const { results } = await db.prepare(`
      SELECT id, tanggal_masuk AS tanggalMasuk, nomor_surat AS nomorSurat,
        nomor_agenda AS nomorAgenda, perihal, instansi, jenis_surat AS jenisSurat,
        tanggal_keluar AS tanggalKeluar, disposisi, catatan,
        tujuan_disposisi AS tujuanDisposisi, created_at AS createdAt
      FROM surat ORDER BY created_at DESC
    `).all();
    return Response.json(results);
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Data tidak tersedia" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  let input: Input;
  try { input = await request.json(); }
  catch { return Response.json({ error: "Format tidak valid" }, { status: 400 }); }

  const record = {
    tanggalMasuk: trim(input.tanggalMasuk, 10),
    nomorSurat: trim(input.nomorSurat, 150),
    perihal: trim(input.perihal, 500),
    instansi: trim(input.instansi, 250),
    jenisSurat: trim(input.jenisSurat, 10),
    tanggalKeluar: trim(input.tanggalKeluar, 10),
    disposisi: trim(input.disposisi, 500),
    catatan: trim(input.catatan, 2000),
    tujuanDisposisi: trim(input.tujuanDisposisi, 250),
  };
  if (!validDate(record.tanggalMasuk) || !record.nomorSurat || !record.perihal ||
      !record.instansi || !["Asli", "Tembusan"].includes(record.jenisSurat) ||
      (record.tanggalKeluar && !validDate(record.tanggalKeluar))) {
    return Response.json({ error: "Data wajib belum lengkap" }, { status: 400 });
  }

  try {
    const db = env.DB;
    if (!db) throw new Error("DB unavailable");
    const id = crypto.randomUUID();
    await db.prepare(`
      INSERT INTO surat (id, tanggal_masuk, nomor_surat, perihal, instansi,
        jenis_surat, tanggal_keluar, disposisi, catatan, tujuan_disposisi,
        created_at, sheet_synced)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    `).bind(id, record.tanggalMasuk, record.nomorSurat, record.perihal,
      record.instansi, record.jenisSurat, record.tanggalKeluar || null,
      record.disposisi, record.catatan, record.tujuanDisposisi,
      new Date().toISOString()).run();

    try { await syncSheet(db); }
    catch (error) { console.error("Sheet sync failed", error); }
    const status = await db.prepare("SELECT sheet_synced FROM surat WHERE id = ?").bind(id).first<{sheet_synced: number}>();
    return Response.json({
      id,
      sheetConfigured: Boolean(env.SHEET_WEB_APP_URL && env.SHEET_SYNC_SECRET),
      sheetSynced: status?.sheet_synced === 1,
    }, { status: 201 });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Gagal menyimpan surat" }, { status: 503 });
  }
}
