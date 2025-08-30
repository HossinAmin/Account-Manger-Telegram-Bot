import { Telegraf } from "telegraf";
import { message } from "telegraf/filters";
import { isUserWhiteListed, parseMessage, parseTransactions } from "./utils";
import {
  createAccount,
  createTransaction,
  getAllAccounts,
  getTransactionInAccount,
} from "./store";

const BOT_TOKEN = process.env.BOT_TOKEN;

if (!BOT_TOKEN) {
  throw new Error("Missing BOT_TOKEN environment variable");
}

const bot = new Telegraf(BOT_TOKEN);

let selectedAccountId: string | null = null;
let awaitingAccountCreation = false;

bot.start((ctx) => {
  if (isUserWhiteListed(ctx.from.id.toString()))
    ctx.reply("🏦 Welcome to account manger:", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "Create Account", callback_data: "create_account" }],
          [{ text: "List Accounts", callback_data: "list_accounts" }],
        ],
      },
    });
  else ctx.reply("❌ Your user is not whitelisted to use this bot.");
});

bot.telegram.setMyCommands([
  {
    command: "start",
    description: "start bot and gives you list of commands",
  },
]);

bot.use((ctx, next) => {
  if (isUserWhiteListed(ctx.from?.id.toString() ?? "")) next();
  else ctx.reply("❌ Your user is not whitelisted to use this bot.");
});

bot.action("list_accounts", (ctx) => {
  ctx.answerCbQuery();
  const accounts = getAllAccounts();
  ctx.reply("Select one of your accounts:", {
    reply_markup: {
      inline_keyboard: accounts.map((account) => {
        return [
          {
            text: account.name,
            callback_data: `select_account:${account.id}`,
          },
        ];
      }),
    },
  });
});

bot.action(/^select_account:(.+)$/, (ctx) => {
  ctx.answerCbQuery();

  // Extract account ID from callback_data
  const accountId = ctx.match[1];
  selectedAccountId = accountId;

  // Find the selected account details (optional)
  const accounts = getAllAccounts();
  const selectedAccount = accounts.find((account) => account.id === accountId);

  if (selectedAccount) {
    ctx.reply(`✅ Account "${selectedAccount.name}" selected successfully!`);
  } else {
    ctx.reply("❌ Account not found.");
  }
});

bot.action("create_account", (ctx) => {
  ctx.answerCbQuery();
  ctx.reply("What would you like to name the account?");
  awaitingAccountCreation = true;
});

bot.on(message("text"), (ctx) => {
  if (awaitingAccountCreation) {
    try {
      createAccount(ctx.message.text);
      ctx.reply(`✅ Account "${ctx.message.text}" created successfully.`);
    } catch (error) {
      ctx.reply("❌ Failed to create account!");
    }
    awaitingAccountCreation = false;
    return;
  }

  if (!selectedAccountId) {
    ctx.reply("No account selected");
    return;
  }

  const transaction = parseMessage(ctx.message.text);
  if (transaction) {
    createTransaction({
      label: transaction.label,
      amount: transaction.amount * (transaction.sign === "negative" ? -1 : 1),
      accountId: selectedAccountId,
    });

    const transactions = getTransactionInAccount(selectedAccountId);

    ctx.reply(parseTransactions(transactions));
  } else {
    ctx.reply(
      `❌ Invalid transaction format. Expected: "3000 for rent", "+200 groceries", "phone bill -150", or "-50 coffee"`
    );
  }
});

const startBot = async () => {
  try {
    console.log("🏦 Starting Account Management Bot...");

    await bot.launch();

    console.log("✅ Bot is running!");
  } catch (error) {
    console.error("❌ Failed to start bot:", error);
    process.exit(1);
  }
};

startBot();
