CREATE TABLE `surat` (
	`id` text PRIMARY KEY NOT NULL,
	`tanggal_masuk` text NOT NULL,
	`nomor_surat` text NOT NULL,
	`nomor_agenda` text,
	`perihal` text NOT NULL,
	`instansi` text NOT NULL,
	`jenis_surat` text NOT NULL,
	`tanggal_keluar` text,
	`disposisi` text DEFAULT '' NOT NULL,
	`catatan` text DEFAULT '' NOT NULL,
	`tujuan_disposisi` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL
);
