const { createApp } = require('./_server.cjs');

let cachedAppPromise = null;

function getApp() {
  if (!cachedAppPromise) {
    cachedAppPromise = createApp().catch((err) => {
      cachedAppPromise = null;
      throw err;
    });
  }
  return cachedAppPromise;
}

module.exports = async function handler(req, res) {
  try {
    const app = await getApp();
    return app(req, res);
  } catch (err) {
    console.error('[VERCEL SERVERLESS BOOT ERROR]', (err && err.message) || err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        error: (err && err.message) || 'Application failed to initialize in serverless runtime.'
      }));
    }
  }
};
