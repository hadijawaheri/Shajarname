import "dotenv/config";
import { Telegraf } from "telegraf";
import { parseMemberPhrase } from "./nlp";
import { createMember, fetchMembers, fetchStats, getRelationship, fetchMarriages, addChildToMarriage } from "./api";
import { startReminderCron } from "./cron";

const token = process.env.BOT_TOKEN;
const allowedChatIds = new Set(
  (process.env.BOT_ALLOWED_CHAT_IDS || "")
    .split(",")
    .map((value) => Number(value.trim()))
    .filter(Number.isSafeInteger),
);
if (!token || allowedChatIds.size === 0) {
  console.error("BOT_TOKEN and BOT_ALLOWED_CHAT_IDS are required. Copy .env.example to .env");
  process.exit(1);
}

const bot = new Telegraf(token);
const subscribers = new Set<number>();

bot.use(async (ctx, next) => {
  if (!ctx.chat || !allowedChatIds.has(ctx.chat.id)) {
    if (ctx.chat) await ctx.reply("این ربات خصوصی است و شما اجازه دسترسی ندارید.");
    return;
  }
  await next();
});

bot.start((ctx) => {
  subscribers.add(ctx.chat.id);
  ctx.reply(
    "سلام! ربات شجره‌نامه خاندان نجف\n" +
      "دستورات:\n" +
      "/stats — آمار خانواده\n" +
      "/relation — پرسش نسبت\n" +
      'ثبت عضو: "شیرین دختر محسن نجف"',
  );
});

bot.command("stats", async (ctx) => {
  try {
    const stats = await fetchStats();
    ctx.reply(
      `📊 آمار خاندان نجف\n` +
        `کل اعضا: ${stats.total}\n` +
        `درگذشته: ${stats.deceased}\n` +
        `مرد/زن: ${stats.males}/${stats.females}`,
    );
  } catch {
    ctx.reply("خطا در دریافت آمار.");
  }
});

bot.command("relation", async (ctx) => {
  const args = ctx.message.text.split(" ").slice(1);
  if (args.length < 2) {
    ctx.reply("استفاده: /relation نام۱ نام۲");
    return;
  }
  try {
    const members = await fetchMembers();
    const a = members.find((m) => m.name.includes(args[0]));
    const b = members.find((m) => m.name.includes(args[1]));
    if (!a || !b) {
      ctx.reply("عضو یافت نشد.");
      return;
    }
    const rel = await getRelationship(a._id, b._id, "fa");
    ctx.reply(`نسبت: ${rel}`);
  } catch {
    ctx.reply("خطا در محاسبه نسبت.");
  }
});

bot.on("text", async (ctx) => {
  const parsed = parseMemberPhrase(ctx.message.text);
  if (!parsed) return;

  try {
    const members = await fetchMembers();
    const parent = members.find((m) => m.name.includes(parsed.parentName));
    if (!parent) {
      ctx.reply(`والد «${parsed.parentName}» یافت نشد. ابتدا والد را ثبت کنید.`);
      return;
    }

    const marriages = await fetchMarriages();
    const parentMarriage = marriages.find(
      (m) => m.spouseA === parent._id || m.spouseB === parent._id,
    );

    const created = await createMember({
      name: parsed.name,
      lastName: parsed.name,
      gender: parsed.gender,
      birthday: new Date().toISOString().split("T")[0],
      language: parsed.lang,
      isOnCanvas: true,
      parentMarriageId: parentMarriage?._id,
    });

    if (parentMarriage) {
      await addChildToMarriage(parentMarriage._id, created._id);
    }

    ctx.reply(`✅ «${parsed.name}» ثبت شد و روی شجره‌نامه قرار گرفت.`);
  } catch (err) {
    ctx.reply(`خطا: ${err instanceof Error ? err.message : "نامشخص"}`);
  }
});

startReminderCron(
  async (chatId, text) => {
    await bot.telegram.sendMessage(chatId, text);
  },
  () => [...subscribers],
);

bot.launch().then(() => console.log("Telegram bot started"));
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
