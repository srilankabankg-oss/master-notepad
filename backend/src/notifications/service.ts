import { sendEmail } from './email.js'
import { sendTelegram } from './telegram.js'

export type Recipient = { email?: string; telegramChatId?: string }

export async function sendWithRetry(
  send: () => Promise<{ sent: boolean; error?: string }>,
  maxRetries = 3,
): Promise<boolean> {
  for (let i = 0; i < maxRetries; i++) {
    const result = await send()
    if (result.sent) return true
    if (i < maxRetries - 1) await new Promise(r => setTimeout(r, (i + 1) * 3000))
  }
  return false
}

async function notifyChannels(recipient: Recipient, subject: string, htmlBody: string, textBody: string) {
  const results: { email?: boolean; telegram?: boolean } = {}
  if (recipient.email) results.email = (await sendEmail(recipient.email, subject, htmlBody)).sent
  if (recipient.telegramChatId) {
    const tr = await sendTelegram(recipient.telegramChatId, `<b>${subject}</b>\n\n${textBody}`)
    results.telegram = tr.sent
  }
  return results
}

export async function inviteToMeeting(recipient: Recipient, meetingTitle: string, meetingDate: Date, rsvpUrl: string) {
  const subject = `Приглашение: ${meetingTitle}`
  const html = `<h2>Приглашение на совещание</h2><p>Вы приглашены на совещание «${meetingTitle}»</p><p>Дата: ${meetingDate.toLocaleString('ru-RU')}</p><p><a href="${rsvpUrl}">Подтвердить участие</a></p>`
  const text = `Приглашение на совещание «${meetingTitle}»\nДата: ${meetingDate.toLocaleString('ru-RU')}\nПодтвердить: ${rsvpUrl}`
  return notifyChannels(recipient, subject, html, text)
}

export async function distributeProtocol(recipient: Recipient, meetingTitle: string, content: string) {
  const subject = `Протокол: ${meetingTitle}`
  const html = `<h2>Протокол совещания: ${meetingTitle}</h2><pre style="white-space:pre-wrap">${content}</pre>`
  return notifyChannels(recipient, subject, html, content)
}

export async function notifyTaskRequestRejected(recipient: Recipient, taskTitle: string, reason: string) {
  const subject = `Запрос отклонён: ${taskTitle}`
  const html = `<h2>Запрос задачи отклонён</h2><p>Задача «${taskTitle}» отклонена.</p><p>Причина: ${reason}</p>`
  const text = `Запрос задачи «${taskTitle}» отклонён.\nПричина: ${reason}`
  return notifyChannels(recipient, subject, html, text)
}