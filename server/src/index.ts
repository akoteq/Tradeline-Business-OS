import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import { connectDB } from './lib/db';
import bapxRouter from './routes/bapx';
import tradelineRouter from './routes/tradeline';
import leadsRouter from './routes/leads';
import smeRouter from './routes/sme';
import partnershipsRouter from './routes/partnerships';
import grantLoansRouter from './routes/grantLoans';
import kpiRouter from './routes/kpi';
import tasksRouter from './routes/tasks';
import activityLogRouter from './routes/activityLog';
import bdoRouter from './routes/bdo';
import consolidatedRouter from './routes/consolidated';
import dashboardRouter from './routes/dashboard';
import authRouter from './routes/auth';

const app = express();
const PORT = process.env.PORT || 4000;

const allowedOrigins = (process.env.CLIENT_URL || 'https://afrca-osss-client-w9vb.vercel.app')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

console.log('Allowed CORS origins:', allowedOrigins);

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      console.warn(`CORS: origin ${origin} not in allowed list:`, allowedOrigins);
      callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['Content-Range', 'X-Content-Range'],
    maxAge: 600,
  })
);

app.use(morgan('dev'));
app.use(express.json());

app.use('/api/auth', authRouter);
app.use('/api/bapx', bapxRouter);
app.use('/api/tradeline', tradelineRouter);
app.use('/api/leads', leadsRouter);
app.use('/api/sme', smeRouter);
app.use('/api/partnerships', partnershipsRouter);
app.use('/api/grant-loans', grantLoansRouter);
app.use('/api/kpi', kpiRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/activity-log', activityLogRouter);
app.use('/api/bdo', bdoRouter);
app.use('/api/consolidated', consolidatedRouter);
app.use('/api/dashboard', dashboardRouter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to connect to MongoDB:', err);
    process.exit(1);
  });

export default app;
