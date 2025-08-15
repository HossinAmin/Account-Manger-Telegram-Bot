import { Telegraf, Context } from "telegraf";

// Types
interface FinancialEntry {
  description: string;
  amount: number;
  date: string;
}

interface Receipt {
  name: string;
  entries: FinancialEntry[];
}

interface UserSession {
  currentReceipt?: string;
}

// Bot configuration
const BOT_TOKEN: string =
  process.env.BOT_TOKEN || "7615929839:AAFh4xeN8LqkKZMOtF0GYMLrk_guKXv7qoU";

// Initialize bot
const bot = new Telegraf(BOT_TOKEN);

// In-memory storage
const receipts: Map<string, Receipt> = new Map();
const userSessions: Map<number, UserSession> = new Map();

// Get or create user session
function getUserSession(userId: number): UserSession {
  if (!userSessions.has(userId)) {
    userSessions.set(userId, {});
  }
  return userSessions.get(userId)!;
}

// Get or create receipt
function getReceipt(receiptName: string): Receipt {
  if (!receipts.has(receiptName)) {
    receipts.set(receiptName, {
      name: receiptName,
      entries: [],
    });
  }
  return receipts.get(receiptName)!;
}

// List all available receipts
function listReceipts(): string[] {
  return Array.from(receipts.keys());
}

// Parse financial entries from text
function parseFinancialEntries(text: string): FinancialEntry[] {
  const lines = text.split("\n").filter((line) => line.trim());
  const entries: FinancialEntry[] = [];
  const currentDate = new Date().toISOString().split("T")[0];

  for (const line of lines) {
    const match = line.match(/(.+?)\s*([+-]\d+)/);
    if (match) {
      const description = match[1].trim();
      const amount = parseInt(match[2]);
      entries.push({
        description,
        amount,
        date: currentDate,
      });
    }
  }

  return entries;
}

// Add entries to receipt
function addEntriesToReceipt(
  receiptName: string,
  entries: FinancialEntry[]
): void {
  const receipt = getReceipt(receiptName);
  receipt.entries.push(...entries);
}

// Calculate receipt total
function calculateReceiptTotal(receiptName: string): number {
  const receipt = receipts.get(receiptName);
  if (!receipt) return 0;

  return receipt.entries.reduce((total, entry) => total + entry.amount, 0);
}

// Format response message
function formatResponse(receiptName: string): string {
  const receipt = receipts.get(receiptName);
  if (!receipt) return `Receipt "${receiptName}" not found.`;

  const total = calculateReceiptTotal(receiptName);

  let response = `**Receipt: ${receiptName}**\n\n`;
  response += "```\n";

  // Show all entries
  for (const entry of receipt.entries) {
    response += `- ${entry.description} ${entry.amount >= 0 ? "+" : ""}${
      entry.amount
    } [${entry.date}]\n`;
  }

  response += `\nTotal: ${total >= 0 ? "+" : ""}${total}\n`;
  response += "```";

  return response;
}

// Handle /new command to create new receipt
bot.command("new", async (ctx: Context) => {
  const args =
    ctx.message && "text" in ctx.message
      ? ctx.message.text.split(" ").slice(1)
      : [];

  if (args.length === 0) {
    await ctx.reply(
      "Please provide a receipt name. Usage: /new <receipt_name>"
    );
    return;
  }

  const receiptName = args.join("_");
  const userId = ctx.from?.id;

  if (!userId) return;

  // Create receipt and set as current
  getReceipt(receiptName);
  const session = getUserSession(userId);
  session.currentReceipt = receiptName;

  await ctx.reply(
    `✅ Created new receipt: "${receiptName}"\nYou can now add entries to this receipt.`
  );
});

// Handle /switch command to switch between receipts
bot.command("switch", async (ctx: Context) => {
  const args =
    ctx.message && "text" in ctx.message
      ? ctx.message.text.split(" ").slice(1)
      : [];

  if (args.length === 0) {
    const receiptNames = listReceipts();
    if (receiptNames.length === 0) {
      await ctx.reply("No receipts found. Create one with /new <receipt_name>");
      return;
    }

    await ctx.reply(
      `Available receipts:\n${receiptNames
        .map((r) => `• ${r}`)
        .join("\n")}\n\nUsage: /switch <receipt_name>`
    );
    return;
  }

  const receiptName = args.join("_");
  const userId = ctx.from?.id;

  if (!userId) return;

  if (!receipts.has(receiptName)) {
    await ctx.reply(
      `❌ Receipt "${receiptName}" not found. Use /list to see available receipts.`
    );
    return;
  }

  const session = getUserSession(userId);
  session.currentReceipt = receiptName;

  await ctx.reply(`📋 Switched to receipt: "${receiptName}"`);
});

// Handle /list command to list all receipts
bot.command("list", async (ctx: Context) => {
  const receiptNames = listReceipts();

  if (receiptNames.length === 0) {
    await ctx.reply("No receipts found. Create one with /new <receipt_name>");
    return;
  }

  const userId = ctx.from?.id;
  const currentReceipt = userId
    ? getUserSession(userId).currentReceipt
    : undefined;

  let response = "📋 **Available Receipts:**\n\n";
  for (const receiptName of receiptNames) {
    const indicator = receiptName === currentReceipt ? "👉 " : "   ";
    const total = calculateReceiptTotal(receiptName);
    response += `${indicator}${receiptName} (${
      total >= 0 ? "+" : ""
    }${total})\n`;
  }

  response += `\nCurrent: ${
    currentReceipt || "None"
  }\nUse /switch <receipt_name> to switch`;

  await ctx.reply(response, { parse_mode: "Markdown" });
});

// Handle /delete command to delete a receipt
bot.command("delete", async (ctx: Context) => {
  const args =
    ctx.message && "text" in ctx.message
      ? ctx.message.text.split(" ").slice(1)
      : [];

  if (args.length === 0) {
    await ctx.reply(
      "Please provide a receipt name. Usage: /delete <receipt_name>"
    );
    return;
  }

  const receiptName = args.join("_");

  if (!receipts.has(receiptName)) {
    await ctx.reply(`❌ Receipt "${receiptName}" not found.`);
    return;
  }

  receipts.delete(receiptName);

  // Clear from user session if it was current
  const userId = ctx.from?.id;
  if (userId) {
    const session = getUserSession(userId);
    if (session.currentReceipt === receiptName) {
      session.currentReceipt = undefined;
    }
  }

  await ctx.reply(`🗑️ Deleted receipt: "${receiptName}"`);
});

// Handle /current command to show current receipt
bot.command("current", async (ctx: Context) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  const session = getUserSession(userId);
  const currentReceipt = session.currentReceipt;

  if (!currentReceipt) {
    await ctx.reply(
      "No current receipt selected. Use /new <receipt_name> or /switch <receipt_name>"
    );
    return;
  }

  const receipt = receipts.get(currentReceipt);
  if (!receipt || receipt.entries.length === 0) {
    await ctx.reply(`📋 Current receipt: "${currentReceipt}"\nNo entries yet.`);
    return;
  }

  const response = formatResponse(currentReceipt);
  await ctx.reply(response, { parse_mode: "Markdown" });
});

// Handle /clear command to clear current receipt
bot.command("clear", async (ctx: Context) => {
  const userId = ctx.from?.id;

  console.log(userId);

  if (!userId) return;

  const session = getUserSession(userId);
  const currentReceipt = session.currentReceipt;

  if (!currentReceipt) {
    await ctx.reply("No current receipt selected.");
    return;
  }

  const receipt = receipts.get(currentReceipt);
  if (receipt) {
    receipt.entries = [];
    await ctx.reply(`🗑️ Cleared all entries from receipt: "${currentReceipt}"`);
  }
});

// Handle text messages (financial entries)
bot.on("text", async (ctx: Context) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  const text = ctx.message && "text" in ctx.message ? ctx.message.text : "";

  // Skip if it's a command
  if (text.startsWith("/")) return;

  const session = getUserSession(userId);
  const currentReceipt = session.currentReceipt;

  if (!currentReceipt) {
    await ctx.reply(
      "No receipt selected. Use /new <receipt_name> to create a new receipt or /switch <receipt_name> to switch to an existing one."
    );
    return;
  }

  try {
    // Parse financial entries
    const entries = parseFinancialEntries(text);

    if (entries.length === 0) {
      await ctx.reply(
        "No valid financial entries found. Please use format like:\npay bills -3000\ncollected rent +4000"
      );
      return;
    }

    // Add entries to current receipt
    addEntriesToReceipt(currentReceipt, entries);

    // Format and send response
    const response = formatResponse(currentReceipt);
    await ctx.reply(response, { parse_mode: "Markdown" });
  } catch (error) {
    console.error("Error processing message:", error);
    await ctx.reply("Sorry, there was an error processing your request.");
  }
});

// Handle /start command
bot.start(async (ctx: Context) => {
  await ctx.reply(
    "Welcome to the Finance Tracker Bot! 💰\n\n" +
      "**Commands:**\n" +
      "/new <n> - Create new receipt\n" +
      "/switch <n> - Switch to existing receipt\n" +
      "/list - List all receipts with totals\n" +
      "/current - Show current receipt\n" +
      "/delete <n> - Delete a receipt\n" +
      "/clear - Clear current receipt entries\n\n" +
      "**Usage:**\n" +
      "1. Create a receipt: /new groceries\n" +
      "2. Add entries:\n" +
      "   milk -25\n" +
      "   bread -15\n" +
      "3. Switch receipts: /switch utilities\n\n" +
      "All data is stored in memory only!",
    { parse_mode: "Markdown" }
  );
});

// Start the bot
async function startBot(): Promise<void> {
  try {
    console.log("Starting Telegram Finance Bot (Memory Only)...");

    bot.launch();
    console.log("Bot is running! 🚀");
    console.log(
      "Note: All data is stored in memory and will be lost when the bot restarts."
    );

    // Graceful shutdown
    process.once("SIGINT", () => bot.stop("SIGINT"));
    process.once("SIGTERM", () => bot.stop("SIGTERM"));
  } catch (error) {
    console.error("Failed to start bot:", error);
    process.exit(1);
  }
}

startBot();
