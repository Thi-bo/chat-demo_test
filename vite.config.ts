import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Charger .env explicitement pour que VITE_PROXY_TARGET soit disponible au démarrage
  const env = loadEnv(mode, process.cwd(), '');
  const proxyTarget = env.VITE_PROXY_TARGET || process.env.VITE_PROXY_TARGET || 'http://127.0.0.1:8000';
  const isRemoteProxy = proxyTarget.startsWith('https://');

  function proxyOptions(_path: string) {
    const opts: Record<string, unknown> = {
      target: proxyTarget,
      changeOrigin: true,
    };
    if (proxyTarget.startsWith('https://')) {
      opts.secure = true;
    }
    if (isRemoteProxy) {
      opts.configure = (proxy: { on: (ev: string, fn: (res: { headers: Record<string, string | string[] | undefined> }) => void) => void }) => {
        proxy.on('proxyRes', (proxyRes) => {
          const setCookie = proxyRes.headers['set-cookie'];
          if (setCookie) {
            const list = Array.isArray(setCookie) ? setCookie : [setCookie];
            proxyRes.headers['set-cookie'] = list.map((c: string) =>
              c
                .replace(/;\s*Domain=[^;]+/gi, '')
                .replace(/;\s*Secure/gi, '')
            );
          }
        });
      };
    }
    return opts;
  }

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/api': proxyOptions('/api'),
        '/broadcasting': proxyOptions('/broadcasting'),
        '/sanctum': proxyOptions('/sanctum'),
      },
    },
  };
});
