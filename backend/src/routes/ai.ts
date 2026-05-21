import { Router } from 'express';
import { env } from '../env.js';
import { requireAuth } from '../middleware/auth.js';

export const aiRouter = Router();

const AI_SERVICE_URL = env.AI_SERVICE_URL || 'http://localhost:3002';

aiRouter.post('/reindex/:entity', requireAuth, async (req, res) => {
  try {
    const { entity } = req.params;
    const response = await fetch(`${AI_SERVICE_URL}/api/ai/reindex/${entity}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entity_id: req.body.entityId }),
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch {
    res.status(503).json({ error: 'AI service unavailable' });
  }
});

aiRouter.post('/reindex', requireAuth, async (_req, res) => {
  try {
    const response = await fetch(`${AI_SERVICE_URL}/api/ai/reindex`, { method: 'POST' });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch {
    res.status(503).json({ error: 'AI service unavailable' });
  }
});

aiRouter.post('/ask', requireAuth, async (req, res) => {
  try {
    const body = { ...req.body };
    const session = req.session as { employeeId?: number } | undefined;
    if (session?.employeeId) {
      body.employeeId = session.employeeId;
    }
    const response = await fetch(`${AI_SERVICE_URL}/api/ai/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
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
