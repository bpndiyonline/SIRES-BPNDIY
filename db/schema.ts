import { sqliteTable, text } from "drizzle-orm/sqlite-core";
export const surat = sqliteTable("surat", {
  id: text("id").primaryKey(),
  tanggalMasuk: text("tanggal_masuk").notNull(),
  nomorSurat: text("nomor_surat").notNull(),
  nomorAgenda: text("nomor_agenda"),
  perihal: text("perihal").notNull(),
  instansi: text("instansi").notNull(),
  jenisSurat: text("jenis_surat").notNull(),
  tanggalKeluar: text("tanggal_keluar"),
  disposisi: text("disposisi").notNull().default(""),
  catatan: text("catatan").notNull().default(""),
  tujuanDisposisi: text("tujuan_disposisi").notNull().default(""),
  createdAt: text("created_at").notNull(),
});
