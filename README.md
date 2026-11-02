# Moneta — Expense tracker

React + Vite frontend and Express API organized with MVC-style server folders. Transactions and app preferences are read from and written to Appwrite TablesDB.

## Add the Transactions table to your existing Appwrite TablesDB database

1. Copy `.env.example` to `.env` and enter your Appwrite endpoint, project ID, server API key, and the ID of the TablesDB database you already created.
2. Set the table ID if you want a name other than `transactions`.
3. Run `npm install`, then `npm run setup:appwrite`.

The setup script only creates tables inside the database identified by `APPWRITE_DATABASE_ID`; it does not create a database. It checks existing tables before creating `transactions`, `settings`, `friends`, `shared_bills`, `bill_splits`, `friend_loans`, `friend_settlements`, and `friend_transfers`. Existing tables with incompatible columns produce an error so you can correct the schema without losing data. The script is safe to rerun and leaves existing rows in place. Optional table IDs can be set in `.env` using the `APPWRITE_*_TABLE_ID` entries in `.env.example`.

Run `npm run dev` for local development. Keep the Appwrite API key in server-only environment variables; never expose it in frontend code.

For a single-service deployment, configure the build command as `npm install && npm run build` and the start command as `npm start`. The start script also creates `dist/index.html` if the build phase did not, then Express serves the React app and API from the same origin. Set the Appwrite environment variables in the hosting provider. Do not publish `.env`.

## MVC structure

- `server/models/transactionModel.js` and `server/models/settingsModel.js` — Appwrite TablesDB row operations
- `server/controllers/transactionController.js` and `server/controllers/settingsController.js` — validation and HTTP response handling
- `server/routes/transactionRoutes.js` and `server/routes/settingsRoutes.js` — API routes
- `server/config/appwrite.js` — Appwrite client configuration
- `server/scripts/setup-appwrite-database.js` — table setup for an existing database
- `server/index.js` — Express app setup

Categories, payment methods, daily guide, and currency are managed in Settings and stored in TablesDB. Friend bills, loans, gifts, and settlements are stored separately; bill shares and repayments use integer paise, and settlements update balances transactionally without creating income or expense rows. Linked bill and gift transactions cannot be independently deleted from the transaction list. Run `npm test` for the money-splitting and repayment domain tests.
