import cron from "node-cron";
import { fetchMembers } from "./api";

function formatDate(d: Date): string {
  return `${d.getMonth() + 1}-${d.getDate()}`;
}

export function startReminderCron(
  sendMessage: (chatId: number, text: string) => Promise<void>,
  getSubscribers: () => number[],
) {
  const tz = process.env.CRON_TZ || "Asia/Tehran";

  // Daily at 08:00 — birthdays and death anniversaries
  cron.schedule(
    "0 8 * * *",
    async () => {
      const today = new Date();
      const todayKey = formatDate(today);

      try {
        const members = await fetchMembers();
        const messages: string[] = [];

        for (const m of members) {
          const birth = new Date(m.birthday);
          if (formatDate(birth) === todayKey) {
            messages.push(`🎂 تولد ${m.name} ${m.lastName}`);
          }
          if (m.deathday) {
            const death = new Date(m.deathday);
            if (formatDate(death) === todayKey) {
              messages.push(`🕯️ یادبود ${m.name} ${m.lastName}`);
            }
          }
        }

        if (messages.length === 0) return;

        const text = messages.join("\n");
        for (const chatId of getSubscribers()) {
          await sendMessage(chatId, text).catch(() => {});
        }
      } catch (err) {
        console.error("Cron reminder error:", err);
      }
    },
    { timezone: tz },
  );
}
