# Moneta — Expense tracker

React + Vite frontend and Express API organized with MVC-style server folders. Transactions and app preferences are read from and written to Appwrite TablesDB.

## Add the Transactions table to your existing Appwrite TablesDB database

1. Copy `.env.example` to `.env` and enter your Appwrite endpoint, project ID, server API key, and the ID of the TablesDB database you already created.
2. Set the table ID if you want a name other than `transactions`.
3. Run `npm install`, then `npm run setup:appwrite`.

The setup script only creates the `transactions` and `settings` tables inside the database identified by `APPWRITE_DATABASE_ID`; it does not create a database. It defines transaction columns, stores categories/payment methods/budget/currency in a settings row, and adds a date index. The script is safe to rerun and leaves existing tables and settings in place. The server also creates the Settings table and its initial row on the first settings request if they are missing.

Run `npm run dev` to start the app. Keep the Appwrite API key in the server `.env`; never expose it in frontend code.

## MVC structure

- `server/models/transactionModel.js` and `server/models/settingsModel.js` — Appwrite TablesDB row operations
- `server/controllers/transactionController.js` and `server/controllers/settingsController.js` — validation and HTTP response handling
- `server/routes/transactionRoutes.js` and `server/routes/settingsRoutes.js` — API routes
- `server/config/appwrite.js` — Appwrite client configuration
- `server/scripts/setup-appwrite-database.js` — table setup for an existing database
- `server/index.js` — Express app setup

Categories, payment methods, daily guide, and currency are managed in Settings and stored in TablesDB. Dashboard totals and transaction lists come from the database; the dashboard and transaction dates use the current local date.
