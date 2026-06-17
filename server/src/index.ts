import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

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

const app = express();
const PORT = process.env.PORT || 4000;

const allowedOrigins = (process.env.CLIENT_URL || 'https://afrca-osss-client-w9vb.vercel.app' )
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

// Log allowed origins on startup
console.log('Allowed CORS origins:', allowedOrigins);

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      
      // Check if origin is in allowed list
      if (allowedOrigins.includes(origin)) {
        console.log(`CORS: Allowing origin ${origin}`);
        return callback(null, true);
      }
      
      // Log rejected origin for debugging
      console.warn(`CORS: origin ${origin} not in allowed list:`, allowedOrigins);
      callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['Content-Range', 'X-Content-Range'],
    maxAge: 600, // 10 minutes
  })
);

app.use(morgan('dev'));
app.use(express.json());

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

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

export default app;
