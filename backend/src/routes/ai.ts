import { Router } from 'express';
import { env } from '../env.js';

export const aiRouter = Router();

const AI_SERVICE_URL = env.AI_SERVICE_URL || 'http://localhost:3002';

aiRouter.post('/ask', async (req, res) => {
  try {
    const response = await fetch(`${AI_SERVICE_URL}/api/ai/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch {
    res.status(503).json({ error: 'AI service unavailable' });
  }
});

aiRouter.get('/health', async (_req, res) => {
  try {
    const response = await fetch(`${AI_SERVICE_URL}/api/ai/health`);
    const data = await response.json();
    res.status(response.status).json(data);
  } catch {
    res.status(503).json({ status: 'unavailable' });
  }
});