import nodemailer from 'nodemailer'
import { env } from '../env.js'

const transport = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'localhost',
  port: Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

export async function sendEmail(to: string, subject: string, html: string): Promise<{ sent: boolean; error?: string }> {
  try {
    await transport.sendMail({ from: process.env.SMTP_FROM || 'noreply@masternotepad.local', to, subject, html })
    return { sent: true }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown email error'
    console.error(`[email] Failed to send to ${to}: ${msg}`)
    return { sent: false, error: msg }
  }
}