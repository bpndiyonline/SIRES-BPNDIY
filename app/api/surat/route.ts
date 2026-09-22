import { env } from "cloudflare:workers";
type Input = { tanggalMasuk?:string;nomorSurat?:string;perihal?:string;instansi?:string;jenisSurat?:string;tanggalKeluar?:string;disposisi?:string;catatan?:string;tujuanDisposisi?:string };
const validDate=(v:string)=>/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v));
export async function GET(){
 try { const db=env.DB; if(!db)throw Error("DB unavailable");const {results}=await db.prepare(`SELECT id, tanggal_masuk AS tanggalMasuk, nomor_surat AS nomorSurat, nomor_agenda AS nomorAgenda, perihal, instansi, jenis_surat AS jenisSurat, tanggal_keluar AS tanggalKeluar, disposisi, catatan, tujuan_disposisi AS tujuanDisposisi, created_at AS createdAt FROM surat ORDER BY created_at DESC`).all();return Response.json(results); }
 catch(e){console.error(e);return Response.json({error:"Data tidak tersedia"},{status:503})}
}
export async function POST(req:Request){
 let data:Input;try{data=await req.json()}catch{return Response.json({error:"Format tidak valid"},{status:400})}
 const trim=(v:unknown,n:number)=>typeof v==="string"?v.trim().slice(0,n):"";
 const tanggalMasuk=trim(data.tanggalMasuk,10),nomorSurat=trim(data.nomorSurat,150),perihal=trim(data.perihal,500),instansi=trim(data.instansi,250),jenisSurat=trim(data.jenisSurat,10),tanggalKeluar=trim(data.tanggalKeluar,10),disposisi=trim(data.disposisi,500),catatan=trim(data.catatan,2000),tujuanDisposisi=trim(data.tujuanDisposisi,250);
 if(!validDate(tanggalMasuk)||!nomorSurat||!perihal||!instansi||!["Asli","Tembusan"].includes(jenisSurat)||(tanggalKeluar&&!validDate(tanggalKeluar)))return Response.json({error:"Data wajib belum lengkap"},{status:400});
 try{const db=env.DB;if(!db)throw Error("DB unavailable");const id=crypto.randomUUID();await db.prepare(`INSERT INTO surat (id,tanggal_masuk,nomor_surat,perihal,instansi,jenis_surat,tanggal_keluar,disposisi,catatan,tujuan_disposisi,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`).bind(id,tanggalMasuk,nomorSurat,perihal,instansi,jenisSurat,tanggalKeluar||null,disposisi,catatan,tujuanDisposisi,new Date().toISOString()).run();return Response.json({id},{status:201})}catch(e){console.error(e);return Response.json({error:"Gagal menyimpan surat"},{status:503})}
}
