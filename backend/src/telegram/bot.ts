import { Bot, GrammyError, HttpError } from "grammy";
import { logger } from "../logging";
import { runMission } from "../agent/mother-agent";
import type { MissionResult } from "../types";

let activeBotInstance: Bot | null = null;
let activeBotToken: string | null = null;

export type TelegramBotStatus = {
  running: boolean;
  botUsername: string | null;
  token: string | null;
};

let botUsername: string | null = null;

export function getTelegramBotStatus(): TelegramBotStatus {
  return {
    running: activeBotInstance !== null,
    botUsername,
    token: activeBotToken ? `${activeBotToken.slice(0, 8)}...` : null,
  };
}

export async function startTelegramBot(token: string): Promise<{ ok: boolean; username?: string; error?: string }> {
  if (activeBotInstance) {
    await stopTelegramBot();
  }

  const bot = new Bot(token);

  try {
    const me = await bot.api.getMe();
    botUsername = me.username ?? me.first_name;
    logger.info({ username: botUsername }, "Telegram bot authenticated");
  } catch (err) {
    const msg = err instanceof GrammyError ? err.message : "Invalid token";
    logger.error({ err }, "Telegram bot auth failed");
    return { ok: false, error: msg };
  }

  bot.command("start", async (ctx) => {
    await ctx.reply(
      `Halo! Aku *${botUsername}* — agent bot dari Recursive Agent.\n\n` +
      "Kirim pesan apapun sebagai misi, dan aku akan produce squad agent untuk mengerjakannya.\n\n" +
      "Contoh:\n" +
      '`Buatkan landing page untuk startup AI`\n' +
      '`Riset tren web development 2026`\n\n' +
      "Gunakan /status untuk cek status.",
      { parse_mode: "Markdown" }
    );
  });

  bot.command("status", async (ctx) => {
    await ctx.reply(
      `Bot: @${botUsername}\nStatus: Online\nBackend: Connected`,
      { parse_mode: "Markdown" }
    );
  });

  bot.on("message:text", async (ctx) => {
    const text = ctx.message.text.trim();
    if (!text || text.startsWith("/")) return;

    const chatId = ctx.chat.id;
    const username = ctx.from?.username ?? ctx.from?.first_name ?? "user";

    logger.info({ chatId, username, prompt: text.slice(0, 100) }, "Telegram mission received");

    await ctx.reply("Misi diterima. Sedang memproduce agent squad...", { parse_mode: "Markdown" });

    try {
      const result: MissionResult = await runMission({ prompt: text });

      const specialists = result.specialists ?? [result.profile];
      const skillCount = specialists.reduce((n, s) => n + s.skills.length, 0);

      const lines = [
        `*Misi selesai!*`,
        "",
        `Status: ${result.status}`,
        `Squad: ${specialists.length} specialist`,
        `Skills: ${skillCount} total`,
        "",
        "*Agents:*",
        ...specialists.map((s, i) => `${i + 1}. *${s.name}* — ${s.role}\n   ${s.purpose}`),
      ];

      if (result.motherBrief) {
        lines.push("", "*Central Agent Brief:*", result.motherBrief.slice(0, 800));
      }

      const msg = lines.join("\n");
      const chunks = splitMessage(msg, 4000);
      for (const chunk of chunks) {
        await ctx.reply(chunk, { parse_mode: "Markdown" });
      }
    } catch (err) {
      logger.error({ err, chatId }, "Telegram mission failed");
      const errMsg = err instanceof Error ? err.message : "Unknown error";
      await ctx.reply(`Mission gagal: ${errMsg}`);
    }
  });

  bot.catch((err) => {
    const e = err.error;
    if (e instanceof GrammyError) {
      logger.error({ err: e }, "Telegram API error");
    } else if (e instanceof HttpError) {
      logger.error({ err: e }, "Telegram HTTP error");
    } else {
      logger.error({ err: e }, "Telegram unknown error");
    }
  });

  bot.start({
    onStart: () => logger.info({ username: botUsername }, "Telegram bot polling started"),
  });

  activeBotInstance = bot;
  activeBotToken = token;

  return { ok: true, username: botUsername ?? undefined };
}

export async function stopTelegramBot(): Promise<void> {
  if (activeBotInstance) {
    await activeBotInstance.stop();
    activeBotInstance = null;
    activeBotToken = null;
    botUsername = null;
    logger.info("Telegram bot stopped");
  }
}

function splitMessage(text: string, maxLen: number): string[] {
  if (text.length <= maxLen) return [text];
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      chunks.push(remaining);
      break;
    }
    let splitAt = remaining.lastIndexOf("\n", maxLen);
    if (splitAt < maxLen / 2) splitAt = maxLen;
    chunks.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt).trimStart();
  }
  return chunks;
}
