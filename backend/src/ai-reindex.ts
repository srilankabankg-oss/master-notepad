import { env } from './env.js';

const AI_SERVICE_URL = env.AI_SERVICE_URL || 'http://localhost:3002';

export function notifyReindex(entity: string, entityId: number): void {
  fetch(`${AI_SERVICE_URL}/api/ai/reindex/${entity}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ entity_id: entityId }),
  }).catch(() => {});
}