import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import { db, schema } from '../db/index.js';
import { eq } from 'drizzle-orm';

describe('Auth API', () => {
  const testEmail = `test-auth-${Date.now()}@example.com`;
  const testPassword = 'testpassword123';

  afterAll(async () => {
    await db.delete(schema.employees).where(eq(schema.employees.email, testEmail));
  });

  it('POST /api/auth/register - success (201, session set)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Test User', email: testEmail, password: testPassword });
    
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.name).toBe('Test User');
    expect(res.body).not.toHaveProperty('passwordHash');
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('POST /api/auth/register - duplicate email (409)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Dup', email: testEmail, password: testPassword });
    expect(res.status).toBe(409);
  });

  it('POST /api/auth/register - missing name (400)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'bad@test.com', password: testPassword });
    expect(res.status).toBe(400);
  });

  it('POST /api/auth/register - invalid email (400)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Bad', email: 'not-email', password: testPassword });
    expect(res.status).toBe(400);
  });

  it('POST /api/auth/login - success (200, session set)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: testEmail, password: testPassword });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id');
    expect(res.body.email).toBe(testEmail);
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('POST /api/auth/login - wrong password (401)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: testEmail, password: 'wrongwrong' });
    expect(res.status).toBe(401);
  });

  it('POST /api/auth/login - nonexistent email (401)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@test.com', password: testPassword });
    expect(res.status).toBe(401);
  });

  it('GET /api/auth/me - authenticated (200)', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: testEmail, password: testPassword });
    const cookie = loginRes.headers['set-cookie'][0];
    
    const res = await request(app)
      .get('/api/auth/me')
      .set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe(testEmail);
  });

  it('GET /api/auth/me - no session (401)', async () => {
    const res = await request(app)
      .get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('POST /api/auth/logout - success (204)', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: testEmail, password: testPassword });
    const cookie = loginRes.headers['set-cookie'][0];
    
    const res = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', cookie);
    expect(res.status).toBe(204);
  });

  it('GET /api/auth/me - after logout (401)', async () => {
    const res = await request(app)
      .get('/api/auth/me');
    expect(res.status).toBe(401);
  });
});