import { createApp } from '../server';

let cachedAppPromise: Promise<any> | null = null;

function getApp() {
  if (!cachedAppPromise) {
    cachedAppPromise = createApp().catch((err) => {
      cachedAppPromise = null;
      throw err;
    });
  }
  return cachedAppPromise;
}

export default async function handler(req: any, res: any) {
  try {
    const app = await getApp();
    return app(req, res);
  } catch (err: any) {
    console.error('[VERCEL SERVERLESS BOOT ERROR]', err?.message || err);
    if (!res.headersSent) {
      res.status(500).json({
        error: err?.message || 'Application failed to initialize in serverless runtime.'
      });
    }
  }
}
