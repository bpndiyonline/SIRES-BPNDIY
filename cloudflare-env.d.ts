declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    SHEET_WEB_APP_URL?: string;
    SHEET_SYNC_SECRET?: string;
  }
}
