import { Database } from "bun:sqlite";
import { v7 } from "uuid";
import type {
  Account,
  AccountWithTransactions,
  CreateTransactionParams,
  Transaction,
} from "../types";

const db = new Database(process.env.DB_PATH, {
  strict: true,
});

// Prepare statements for better performance
const insertAccountStmt = db.prepare(
  "INSERT INTO Accounts (id, name) VALUES (?, ?)"
);
const insertTransactionStmt = db.prepare(
  "INSERT INTO Transactions (id, label, amount, account) VALUES (?, ?, ?, ?)"
);
const selectAllAccountsStmt = db.prepare(
  "SELECT id, name FROM Accounts ORDER BY name"
);
const selectAllUsersStmt = db.prepare("SELECT * FROM Users");
const selectTransactionsByAccountStmt = db.prepare(
  "SELECT id, label, amount, account FROM Transactions WHERE account = ? ORDER BY created_at"
);
const selectAccountByIdStmt = db.prepare(
  "SELECT id, name FROM Accounts WHERE id = ?"
);

/**
 * Creates a new account with the given name
 * @param name - The name of the account
 * @returns The created account object
 * @throws Error if account creation fails
 */
function createAccount(name: string): Account {
  if (!name || name.trim().length === 0) {
    throw new Error("Account name cannot be empty");
  }

  const id = v7();

  try {
    insertAccountStmt.run(id, name.trim());
    return { id, name: name.trim() };
  } catch (error) {
    throw new Error(`Failed to create account: ${error}`);
  }
}

/**
 * Creates a new transaction for a specific account
 * @param params - Transaction parameters (label, amount, accountId)
 * @returns The created transaction object
 * @throws Error if transaction creation fails or account doesn't exist
 */
function createTransaction(params: CreateTransactionParams): Transaction {
  const { label, amount, accountId } = params;

  if (!label || label.trim().length === 0) {
    throw new Error("Transaction label cannot be empty");
  }

  if (typeof amount !== "number" || isNaN(amount)) {
    throw new Error("Transaction amount must be a valid number");
  }

  if (!accountId || accountId.trim().length === 0) {
    throw new Error("Account ID cannot be empty");
  }

  // Verify account exists
  const account = selectAccountByIdStmt.get(accountId) as Account | undefined;
  if (!account) {
    throw new Error(`Account with ID ${accountId} does not exist`);
  }

  const id = v7();

  try {
    insertTransactionStmt.run(id, label.trim(), amount, accountId);
    return {
      id,
      label: label.trim(),
      amount,
      account: accountId,
    };
  } catch (error) {
    throw new Error(`Failed to create transaction: ${error}`);
  }
}

/**
 * Retrieves all accounts from the database
 * @returns Array of all accounts
 */
function getAllAccounts(): Account[] {
  try {
    return selectAllAccountsStmt.all() as Account[];
  } catch (error) {
    throw new Error(`Failed to retrieve accounts: ${error}`);
  }
}

/**
 * Retrieves all transactions for a specific account
 * @param accountId - The ID of the account
 * @returns Array of transactions for the specified account
 * @throws Error if account doesn't exist
 */
function getTransactionInAccount(accountId: string): Transaction[] {
  if (!accountId || accountId.trim().length === 0) {
    throw new Error("Account ID cannot be empty");
  }

  // Verify account exists
  const account = selectAccountByIdStmt.get(accountId) as Account | undefined;
  if (!account) {
    throw new Error(`Account with ID ${accountId} does not exist`);
  }

  try {
    return selectTransactionsByAccountStmt.all(accountId) as Transaction[];
  } catch (error) {
    throw new Error(`Failed to retrieve transactions: ${error}`);
  }
}

/**
 * Retrieves an account with all its transactions
 * @param accountId - The ID of the account
 * @returns Account object with transactions array
 * @throws Error if account doesn't exist
 */
function getAccountWithTransactions(
  accountId: string
): AccountWithTransactions {
  if (!accountId || accountId.trim().length === 0) {
    throw new Error("Account ID cannot be empty");
  }

  const account = selectAccountByIdStmt.get(accountId) as Account | undefined;
  if (!account) {
    throw new Error(`Account with ID ${accountId} does not exist`);
  }

  const transactions = selectTransactionsByAccountStmt.all(
    accountId
  ) as Transaction[];

  return {
    ...account,
    transactions,
  };
}

/**
 * Calculates the balance for a specific account
 * @param accountId - The ID of the account
 * @returns The current balance of the account
 * @throws Error if account doesn't exist
 */
function getAccountBalance(accountId: string): number {
  const transactions = getTransactionInAccount(accountId);
  return transactions.reduce(
    (balance, transaction) => balance + transaction.amount,
    0
  );
}

/**
 * Gets all accounts with their balances
 * @returns Array of accounts with calculated balances
 */
function getAllAccountsWithBalances(): (Account & { balance: number })[] {
  const accounts = getAllAccounts();

  return accounts.map((account) => ({
    ...account,
    balance: getAccountBalance(account.id),
  }));
}

/**
 * Gets all users
 * @returns Array of accounts with calculated balances
 */
function getAllUsers() {
  const users = selectAllUsersStmt.all() as { id: string }[];

  return users;
}

// Export all functions
export {
  getAllUsers,
  createAccount,
  createTransaction,
  getAllAccounts,
  getTransactionInAccount,
  getAccountWithTransactions,
  getAccountBalance,
  getAllAccountsWithBalances,
};
