import { db, schema } from '../db/index.js';

export async function auditLog(params: {
  entityType: string;
  entityId: number;
  employeeId: number;
  action: 'create' | 'update' | 'delete';
  changes?: Record<string, unknown>;
}): Promise<void> {
  try {
    await db.insert(schema.auditLog).values({
      entityType: params.entityType,
      entityId: params.entityId,
      employeeId: params.employeeId,
      action: params.action,
      changes: params.changes || {},
    });
  } catch (err) {
    console.error('Audit log insertion failed:', err);
  }
}