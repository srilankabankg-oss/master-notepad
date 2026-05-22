import { Telegraf } from 'telegraf'

let bot: Telegraf | null = null

function getBot(): Telegraf {
  if (!bot) {
    const token = process.env.TELEGRAM_BOT_TOKEN
    if (!token) {
      console.warn('[telegram] TELEGRAM_BOT_TOKEN not set — bot disabled')
      bot = null as unknown as Telegraf
    } else {
      bot = new Telegraf(token)
      bot.launch().then(() => console.log('[telegram] Bot started'))
      process.once('SIGINT', () => bot?.stop('SIGINT'))
      process.once('SIGTERM', () => bot?.stop('SIGTERM'))
    }
  }
  return bot!
}

export async function sendTelegram(chatId: string, message: string): Promise<{ sent: boolean; error?: string }> {
  try {
    const b = getBot()
    if (!b) return { sent: false, error: 'Bot not configured' }
    await b.telegram.sendMessage(chatId, message, { parse_mode: 'HTML' })
    return { sent: true }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown telegram error'
    console.error(`[telegram] Failed to send to ${chatId}: ${msg}`)
    return { sent: false, error: msg }
  }
}

export async function notifyTelegram(chatId: string, title: string, body: string): Promise<{ sent: boolean; error?: string }> {
  return sendTelegram(chatId, `<b>${title}</b>\n\n${body}`)
}