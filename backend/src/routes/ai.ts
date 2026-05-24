import { Router } from 'express';
import { env } from '../env.js';
import { requireAuth } from '../middleware/auth.js';

export const aiRouter = Router();

const AI_SERVICE_URL = env.AI_SERVICE_URL || 'http://localhost:3002';

async function proxyToAI(method: string, path: string, body?: object): Promise<{ status: number; data: any }> {
  const url = `${AI_SERVICE_URL}${path}`;
  const options: RequestInit = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) options.body = JSON.stringify(body);

  try {
    const response = await fetch(url, options);
    const text = await response.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = { error: text || 'Empty response' }; }
    return { status: response.status, data };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return { status: 503, data: { error: `AI service unreachable: ${msg}`, ai_service_url: AI_SERVICE_URL } };
  }
}

aiRouter.post('/reindex/:entity', requireAuth, async (req, res) => {
  const { status, data } = await proxyToAI('POST', `/api/ai/reindex/${req.params.entity}`, { entity_id: req.body.entityId });
  res.status(status).json(data);
});

aiRouter.post('/reindex', requireAuth, async (_req, res) => {
  const { status, data } = await proxyToAI('POST', '/api/ai/reindex');
  res.status(status).json(data);
});

aiRouter.post('/ask', requireAuth, async (req, res) => {
  const body = { ...req.body };
  const session = req.session as { employeeId?: number } | undefined;
  if (session?.employeeId) body.employeeId = session.employeeId;
  const { status, data } = await proxyToAI('POST', '/api/ai/ask', body);
  res.status(status).json(data);
});

aiRouter.get('/health', async (_req, res) => {
  const { status, data } = await proxyToAI('GET', '/api/ai/health');
  res.status(status).json(data);
});