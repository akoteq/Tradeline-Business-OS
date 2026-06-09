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

app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:3000' }));
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
