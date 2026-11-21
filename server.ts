import express from 'express';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getDistPath(): string {
  const candidates = [
    path.join(process.cwd(), 'dist'),
    path.join(__dirname, 'dist'),
    path.join('/app/applet/dist'),
    path.resolve('dist'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, 'index.html'))) {
      return candidate;
    }
  }
  return path.join(process.cwd(), 'dist');
}

process.on('uncaughtException', (err) => {
  console.error('[Process] Uncaught exception:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[Process] Unhandled rejection:', reason);
});

function listenSafe(app: express.Express, port: number, label: string): Promise<http.Server | null> {
  return new Promise((resolve) => {
    const server = http.createServer(app);
    server.on('error', (err: any) => {
      console.warn(`[Server] ${label} on port ${port} could not bind (${err?.code || err?.message}). Proceeding.`);
      resolve(null);
    });
    server.listen(port, '0.0.0.0', () => {
      console.log(`[Server] ${label} successfully listening on http://0.0.0.0:${port}`);
      resolve(server);
    });
  });
}

async function startServer() {
  const app = express();
  
  // Fast health check endpoints for Cloud Run, Kubernetes, and Nginx probes
  app.all(['/api/health', '/health', '/_health', '/ping'], (_req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.use('/api/survey', express.json({ limit: '8mb' }));

  const isAllowedAppsScriptUrl = (urlStr: unknown): urlStr is string => {
    if (typeof urlStr !== 'string') return false;
    const trimmed = urlStr.trim();
    return (
      trimmed.startsWith('https://script.google.com/macros/s/') ||
      trimmed.startsWith('https://script.googleusercontent.com/')
    );
  };

  app.post('/api/survey/test', async (req, res) => {
    try {
      const { appsScriptUrl } = req.body || {};
      if (!isAllowedAppsScriptUrl(appsScriptUrl)) {
        return res.status(400).json({
          ok: false,
          error: 'URL Google Apps Script không hợp lệ (phải bắt đầu bằng https://script.google.com/macros/s/).'
        });
      }

      const targetUrl = appsScriptUrl.trim();
      const response = await fetch(targetUrl, {
        method: 'POST',
        redirect: 'follow',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'ping' }),
      });

      const rawText = await response.text();
      if (!response.ok) {
        return res.status(502).json({
          ok: false,
          error: `Google Apps Script trả về mã lỗi HTTP ${response.status}. Vui lòng kiểm tra lại cấu hình triển khai (Bất kỳ ai).`
        });
      }

      try {
        const parsed = JSON.parse(rawText);
        return res.status(200).json({ ok: parsed.ok !== false, ...parsed });
      } catch {
        const isHtmlLogin = rawText.toLowerCase().includes('accounts.google.com') || rawText.toLowerCase().includes('<html');
        return res.status(isHtmlLogin ? 403 : 200).json({
          ok: !isHtmlLogin,
          error: isHtmlLogin
            ? 'Apps Script yêu cầu đăng nhập Google. Vui lòng chọn quyền truy cập "Bất kỳ ai (Anyone)" khi triển khai Web App.'
            : undefined,
          raw: rawText.slice(0, 300),
        });
      }
    } catch (err: any) {
      return res.status(500).json({
        ok: false,
        error: err?.message || 'Không thể kết nối tới Google Apps Script.',
      });
    }
  });

  app.post('/api/survey/submit', async (req, res) => {
    try {
      const { appsScriptUrl, payload } = req.body || {};
      if (!isAllowedAppsScriptUrl(appsScriptUrl)) {
        return res.status(400).json({
          ok: false,
          error: 'Chưa cấu hình hoặc URL Google Apps Script không hợp lệ.'
        });
      }

      if (!payload || !payload.customerName) {
        return res.status(400).json({
          ok: false,
          error: 'Thiếu thông tin khách hàng cần khảo sát.'
        });
      }

      const targetUrl = appsScriptUrl.trim();
      const response = await fetch(targetUrl, {
        method: 'POST',
        redirect: 'follow',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
      });

      const rawText = await response.text();
      if (!response.ok) {
        return res.status(502).json({
          ok: false,
          error: `Google Apps Script phản hồi lỗi (${response.status}).`
        });
      }

      try {
        const parsed = JSON.parse(rawText);
        if (parsed && parsed.ok === false) {
          return res.status(400).json({
            ok: false,
            error: parsed.error || 'Apps Script xử lý thất bại.'
          });
        }
        return res.status(200).json({ ok: true, ...parsed });
      } catch {
        const isHtmlLogin = rawText.toLowerCase().includes('accounts.google.com') || rawText.toLowerCase().includes('servicelogin');
        if (isHtmlLogin) {
          return res.status(403).json({
            ok: false,
            error: 'Apps Script yêu cầu đăng nhập. Vui lòng Deploy lại Web App với quyền "Who has access: Anyone".'
          });
        }
        return res.status(502).json({
          ok: false,
          error: 'Phản hồi từ Google Apps Script không đúng định dạng JSON. Vui lòng cập nhật mã Apps Script theo mẫu.'
        });
      }
    } catch (err: any) {
      return res.status(500).json({
        ok: false,
        error: err?.message || 'Lỗi kết nối máy chủ khi gửi khảo sát.'
      });
    }
  });

  app.head('/', (_req, res) => {
    res.status(200).end();
  });

  // Development mode uses Vite middleware for instantaneous startup (<500ms)
  const isDev = process.env.npm_lifecycle_event === 'dev' ||
    (process.env.NODE_ENV !== 'production' && process.env.npm_lifecycle_event !== 'start');

  if (isDev) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production mode (serving pre-built dist assets)
    let distPath = getDistPath();
    let indexPath = path.join(distPath, 'index.html');

    // If dist/index.html does not exist on startup, trigger background build without blocking server port binding
    if (!fs.existsSync(indexPath)) {
      console.log('dist/index.html not found on startup. Spawning background build...');
      import('child_process').then(({ spawn }) => {
        const buildProcess = spawn('npm', ['run', 'build'], { stdio: 'inherit', shell: true });
        buildProcess.on('exit', (code) => {
          console.log(`Background build finished with code ${code}`);
        });
      }).catch((err) => {
        console.error('Failed to trigger background build:', err);
      });
    }

    app.use((req, res, next) => {
      const activeDist = getDistPath();
      express.static(activeDist, { maxAge: '1h', index: false })(req, res, next);
    });

    app.get('*', (_req, res) => {
      const activeDist = getDistPath();
      const activeIndex = path.join(activeDist, 'index.html');
      if (fs.existsSync(activeIndex)) {
        res.sendFile(activeIndex);
      } else {
        // Auto-refreshing loading screen while build completes
        res.status(200).send(`<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="refresh" content="2">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sale Update - Đang Khởi Động</title>
  <style>
    body { margin: 0; font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #064e48; color: #fff; text-align: center; }
    .card { background: rgba(255,255,255,0.08); padding: 2rem; border-radius: 1.25rem; border: 1px solid rgba(255,255,255,0.15); box-shadow: 0 10px 25px rgba(0,0,0,0.2); max-width: 90%; width: 380px; }
    .spinner { width: 44px; height: 44px; border: 4px solid rgba(255,255,255,0.2); border-top-color: #34d399; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 1.25rem; }
    @keyframes spin { to { transform: rotate(360deg); } }
    h1 { margin: 0 0 0.5rem; font-size: 1.25rem; font-weight: 700; letter-spacing: -0.02em; }
    p { margin: 0; font-size: 0.875rem; color: #a7f3d0; }
  </style>
</head>
<body>
  <div class="card">
    <div class="spinner"></div>
    <h1>Sale Update Đang Khởi Động...</h1>
    <p>Trang sẽ tự động kết nối lại trong giây lát.</p>
  </div>
</body>
</html>`);
      }
    });
  }

  // Bind to port 3000 (primary target for Nginx reverse proxy)
  const appPort = process.env.DEFAULT_APP_PORT ? parseInt(process.env.DEFAULT_APP_PORT, 10) : 3000;
  await listenSafe(app, appPort, 'Primary App Server');

  // Also bind to process.env.PORT if specified and different (e.g. raw Cloud Run container without Nginx)
  const envPort = process.env.PORT ? parseInt(process.env.PORT, 10) : null;
  if (envPort && envPort !== appPort) {
    await listenSafe(app, envPort, 'Direct Cloud Run Port');
  }
}

startServer().catch((err) => {
  console.error('Server startup error:', err);
  process.exit(1);
});



