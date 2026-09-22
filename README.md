# SiReS — Surat Masuk BPN DIY

Website pencatatan surat masuk Kantor Wilayah BPN D.I. Yogyakarta.

## Alur saat ini

Petugas mencatat surat melalui formulir. Data tersimpan di database situs dan tampil pada daftar surat bersama pengguna situs lain. Nomor Agenda E-Office dikunci dalam formulir petugas. Tombol **Ekspor CSV** menghasilkan seluruh data dengan sepuluh kolom dalam urutan yang diminta, untuk dibuka di Google Sheets atau aplikasi spreadsheet lain.

## Integrasi Google Sheets berikutnya

Sinkronisasi langsung dua arah belum diaktifkan karena spreadsheet dan aksesnya belum tersedia. Saat integrasi dibuat, gunakan ID surat sebagai pengenal tetap agar pengisian **Nomor Agenda E-Office** oleh back office memperbarui baris yang benar. Batasi hak tulis kolom agenda ke petugas back office dan hindari menyimpan kredensial Google di kode klien. Kolom lain dapat dicocokkan dengan header CSV.

## Pengembangan

`pnpm install`, `pnpm db:generate`, lalu `pnpm dev`. Binding database bernama `DB`; migrasi dalam `drizzle/` diterapkan oleh alur publikasi Sites.
