import { sendEmail } from './email.js'

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

export async function inviteToMeeting(email: string, meetingTitle: string, meetingDate: Date, rsvpUrl: string) {
  const html = `<h2>Приглашение на совещание</h2><p>Вы приглашены на совещание «${meetingTitle}»</p><p>Дата: ${meetingDate.toLocaleString('ru-RU')}</p><p><a href="${rsvpUrl}">Подтвердить участие</a></p>`
  return sendEmail(email, `Приглашение: ${meetingTitle}`, html)
}

export async function distributeProtocol(email: string, meetingTitle: string, content: string) {
  const html = `<h2>Протокол совещания: ${meetingTitle}</h2><pre style="white-space:pre-wrap">${content}</pre>`
  return sendEmail(email, `Протокол: ${meetingTitle}`, html)
}

export async function notifyTaskRequestRejected(email: string, taskTitle: string, reason: string) {
  const html = `<h2>Запрос задачи отклонён</h2><p>Задача «${taskTitle}» отклонена.</p><p>Причина: ${reason}</p>`
  return sendEmail(email, `Запрос отклонён: ${taskTitle}`, html)
}