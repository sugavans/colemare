/**
 * server.js — Express backend entry point
 * Runs on PORT 3001. All Anthropic API calls originate from here.
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import optimizeRouter from './routes/optimize.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3001;

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('\n❌  ANTHROPIC_API_KEY is not set.');
  console.error('   Copy .env.example to .env and add your API key.\n');
  process.exit(1);
}

const app = express();

// Support comma-separated origins: "http://localhost:3000,https://colemare.vercel.app"
const ALLOWED_ORIGINS = (process.env.CLIENT_ORIGIN || 'http://localhost:3000')
  .split(',').map(o => o.trim());

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));
app.use(express.json({ limit: '5mb' }));

// ── Serve generated output files for download ────────────────────────────────
const outputsDir = path.resolve(__dirname, '../outputs');
app.use('/download', express.static(outputsDir));

// ── API Routes ────────────────────────────────────────────────────────────────
app.use('/api', optimizeRouter);

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`\n✅  Resume Optimizer API running at http://localhost:${PORT}`);
  console.log(`   CORS origin: ${ALLOWED_ORIGIN}`);
  console.log(`   Open your browser at http://localhost:3000\n`);
});
