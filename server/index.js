import express from 'express';
import cors from 'cors';
import transactionRoutes from './routes/transactionRoutes.js';
import { appwriteConfigured, missingAppwriteConfig } from './config/appwrite.js';

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.get('/api/health', (_req, res) => res.json({ status: 'ok', database: appwriteConfigured ? 'appwrite' : 'local fallback', missingConfig: missingAppwriteConfig }));
app.use('/api/transactions', transactionRoutes);
app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(error.code === 401 || error.code === 403 ? 502 : 500).json({ message: 'The transaction request could not be completed. Check Appwrite configuration, collection attributes, and permissions.' });
});

app.listen(port, () => console.log(`Expense API listening on http://localhost:${port} (${appwriteConfigured ? 'Appwrite' : 'local fallback'})`));
