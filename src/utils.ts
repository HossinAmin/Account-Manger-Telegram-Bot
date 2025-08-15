import type { ParsedTransaction, Transaction } from "../types";

export function parseMessage(text: string): ParsedTransaction | null {
  text = text.trim();

  // Comprehensive pattern that handles both orders
  const pattern = /^\s*(?:([+-]?)(\d+)\s+(.+)|(.+?)\s+([+-])(\d+))\s*$/;

  const match = text.match(pattern);
  if (!match) return null;

  if (match[1] !== undefined || match[2] !== undefined) {
    // Amount-first pattern matched
    const signChar = match[1] || "+";
    const amount = parseInt(match[2]);
    const label = match[3].trim();
    const sign = signChar === "-" ? "negative" : "positive";

    return { label, sign, amount };
  } else {
    // Label-first pattern matched
    const label = match[4].trim();
    const signChar = match[5];
    const amount = parseInt(match[6]);
    const sign = signChar === "+" ? "positive" : "negative";

    return { label, sign, amount };
  }
}

export function parseTransactions(transactions: Transaction[]) {
  const total = transactions.reduce(
    (sum, transaction) => sum + transaction.amount,
    0
  );

  const text = transactions
    .map((transaction) => {
      const emoji = transaction.amount >= 0 ? "💰" : "💸";
      const sign = transaction.amount >= 0 ? "+" : "-";
      const formattedAmount = Math.abs(transaction.amount).toLocaleString();
      return `${emoji} ${sign}${formattedAmount}  "${transaction.label}"`;
    })
    .join("\n");

  const totalEmoji = total >= 0 ? "📈" : "📉";
  const totalSign = total >= 0 ? "+" : "-";
  const formattedTotal = Math.abs(total).toLocaleString();

  const finalText =
    text + `\n\n${totalEmoji} Total: ${totalSign}${formattedTotal}`;

  return finalText;
}
