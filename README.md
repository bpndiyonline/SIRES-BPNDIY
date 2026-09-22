# SiReS — Surat Masuk BPN DIY

Website pencatatan surat masuk Kantor Wilayah BPN D.I. Yogyakarta.

## Alur saat ini

Petugas mencatat surat melalui formulir. Data tersimpan di database situs dan tampil pada daftar surat bersama pengguna situs lain. Nomor Agenda E-Office dikunci dalam formulir petugas. Tombol **Ekspor CSV** menghasilkan seluruh data dengan sepuluh kolom dalam urutan yang diminta, untuk dibuka di Google Sheets atau aplikasi spreadsheet lain.

## Integrasi Google Sheets

Sheet target: `Register Surat Masuk` → `Sheet1`. Website tetap menyimpan data utama di D1. Entri baru ditambahkan ke sheet pada baris baru; kolom A–K yang sudah ada tidak diubah. Kolom L menyimpan `SiReS ID` untuk mencegah duplikasi dan mencocokkan Nomor Agenda E-Office saat petugas back office mengisinya. Data situs yang tercatat sebelum koneksi diaktifkan tidak dikirim otomatis ke sheet.

Skrip untuk sheet ada di `integrations/google-apps-script/Code.gs`. Buat proyek Apps Script yang terikat pada spreadsheet, tempel skrip, lalu tambahkan Script Property `SIRES_SYNC_SECRET` dengan nilai acak yang panjang. Deploy sebagai Web App yang berjalan sebagai pemilik, dengan akses yang memungkinkan server SiReS mengirim permintaan. Simpan URL `/exec` sebagai `SHEET_WEB_APP_URL` dan nilai rahasia yang sama sebagai `SHEET_SYNC_SECRET` di pengaturan runtime Sites (keduanya tidak diletakkan di kode klien). Deploy ulang versi Situs setelah konfigurasi runtime berubah.

Skrip memeriksa header A–K sebelum menulis, menolak jika L1 sudah digunakan untuk keperluan lain, dan hanya menambahkan baris untuk ID baru. Ketika situs dimuat, situs membaca kolom agenda dari sheet dan memperbarui nomor yang cocok di database. Jika sheet sementara tidak dapat dijangkau, entri baru tetap tersimpan di situs dan dicoba lagi saat situs dimuat berikutnya.

## Pengembangan

`pnpm install`, `pnpm db:generate`, lalu `pnpm dev`. Binding database bernama `DB`; migrasi dalam `drizzle/` diterapkan oleh alur publikasi Sites.
