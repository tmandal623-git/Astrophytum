// vite.config.ts
// ─────────────────────────────────────────────────────────────
// Proxies BOTH /api/* AND /images/* to your Node server.
// This is the root cause of the "Thumb 1, Thumb 2" problem:
// images are saved to Node's public/images/ folder but the
// browser was requesting them from Vite (port 5173) which
// has no knowledge of those files.
// ─────────────────────────────────────────────────────────────
 
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Any request to /api/* in dev is forwarded to your Node server
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        // Do NOT rewrite — keep /api prefix so Node routes match
      },
      // NOTE: /images proxy removed — cactus images are now served
      // from Vercel Blob CDN (absolute https:// URLs stored in DB).
      // Local dev fallback also uses /images/* paths served directly
      // by Node's express.static middleware, which the browser fetches
      // from localhost:3000 — no Vite proxy needed.
      // ✅ All image requests → Node :3000  (THIS was missing)
      '/images': {
        target:       'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
