/**
 * server.js — Express backend entry point
 * Runs on PORT 3001. All Anthropic API calls originate from here.
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
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

// ── Rate limiting ────────────────────────────────────────────────────────────
// Scan is cheap (Haiku) — allow more. Optimize/match/cover-letter are expensive.
const scanLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,       // 1 hour
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again in an hour.' },
});

const pipelineLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,       // 1 hour
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again in an hour.' },
});

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
app.use('/api/scan',         scanLimiter);
app.use('/api/optimize',     pipelineLimiter);
app.use('/api/match-only',   pipelineLimiter);
app.use('/api/cover-letter', pipelineLimiter);
app.use('/api', optimizeRouter);

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`\n✅  Resume Optimizer API running at http://localhost:${PORT}`);
  console.log(`   CORS origins: ${ALLOWED_ORIGINS.join(', ')}`);
  console.log(`   Open your browser at http://localhost:3000\n`);
});
