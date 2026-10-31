import express from 'express';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import transactionRoutes from './routes/transactionRoutes.js';
import settingsRoutes from './routes/settingsRoutes.js';
import friendManagementRoutes from './routes/friendManagementRoutes.js';
import { appwriteConfigured, missingAppwriteConfig } from './config/appwrite.js';

const app = express();
const port = process.env.PORT || 5000;

app.use(express.json());
app.get('/api/health', (_req, res) => res.json({ status: 'ok', database: appwriteConfigured ? 'appwrite-tablesdb' : 'not-configured' }));
app.use('/api/transactions', transactionRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/friends-module', (req, res, next) => {
  if (!appwriteConfigured) return res.status(503).json({ message: `Appwrite is not configured. Add ${missingAppwriteConfig.join(', ')} to your environment.` });
  next();
}, friendManagementRoutes);
app.use('/api', (_req, res) => res.status(404).json({ message: 'API route not found.' }));
const clientBuildPath = resolve(dirname(fileURLToPath(import.meta.url)), '../dist');
app.use(express.static(clientBuildPath));
app.get('*', (_req, res) => res.sendFile(resolve(clientBuildPath, 'index.html')));
app.use((error, _req, res, _next) => {
  const code = Number(error.code || error.status || error.statusCode);
  const details = typeof error.message === 'string' ? error.message.trim() : '';
  const type = typeof error.type === 'string' ? ` (${error.type})` : '';
  let message;

  if (!error.code && error.status && code < 500) {
    message = details || 'The request could not be completed.';
  } else if (code === 401 || code === 403) {
    message = `Appwrite denied access. Check that the API key belongs to this project and has database read/write access.${details ? ` ${details}` : ''}`;
  } else if (code === 404) {
    message = `Appwrite could not find the configured database, table, or settings row. Check the IDs in .env and run npm run setup:appwrite.${details ? ` ${details}` : ''}`;
  } else if (code === 400) {
    message = `Appwrite rejected the request. Check the table column names and types.${details ? ` ${details}` : ''}`;
  } else if (code === 409) {
    message = details || 'This action conflicts with the current outstanding balance.';
  } else if (code) {
    message = `Appwrite request failed with HTTP ${code}${type}.${details ? ` ${details}` : ''}`;
  } else {
    message = `Could not reach Appwrite. Check APPWRITE_ENDPOINT and your network connection.${details ? ` ${details}` : ''}`;
  }

  console.error(`Database request failed${code ? ` (${code})` : ''}${type}: ${details || 'No error message provided.'}`);
  res.status(code === 401 || code === 403 ? 502 : code >= 400 && code < 500 ? code : 500).json({ message });
});

app.listen(port, () => console.log(`Expense API listening on http://localhost:${port} (${appwriteConfigured ? 'Appwrite TablesDB' : 'Appwrite not configured'})`));
