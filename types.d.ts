export type ParsedTransaction = {
  label: string;
  sign: "positive" | "negative";
  amount: number;
};

export interface Account {
  id: string;
  name: string;
}

export interface Transaction {
  id: string;
  label: string;
  amount: number;
  account: string;
}

export interface CreateTransactionParams {
  label: string;
  amount: number;
  accountId: string;
}

export interface AccountWithTransactions extends Account {
  transactions: Transaction[];
}
