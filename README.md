# Moneta — Expense tracker

React + Vite frontend and Express API organized with MVC-style server folders. Transaction records use Appwrite Databases.

## Start locally

1. Create an Appwrite project, database, and collection for transactions.
2. Add these **string** attributes to the collection: `type`, `category`, `note`, `date`, and `paymentMethod`. Add `amount` as a **float** attribute. Give the collection document permissions appropriate for your app; the server API key is used for server-side requests.
3. Copy `.env.example` to `.env` and fill in the Appwrite endpoint, project ID, server API key, database ID, and collection ID.
4. Run `npm install`, then `npm run dev`.

The API key must stay on the server. Do not add it to a `VITE_` environment variable or client code. If Appwrite settings are missing, the UI continues in local browser storage mode.

## MVC structure

- `server/models/transactionModel.js` — Appwrite database operations and document mapping
- `server/controllers/transactionController.js` — validation and HTTP response handling
- `server/routes/transactionRoutes.js` — transaction API routes
- `server/config/appwrite.js` — Appwrite client configuration
- `server/index.js` — Express app setup

The dashboard date, selected month, demo transaction dates, and new transaction date are calculated from the current local date.
