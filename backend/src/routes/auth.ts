import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { db, schema } from '../db/index.js';
import { eq } from 'drizzle-orm';
import { validateBody } from '../middleware/validation.js';
import { AppError } from '../middleware/error-handler.js';

export const authRouter = Router();

const SALT_ROUNDS = 10;

// POST /api/auth/register
authRouter.post('/register', validateBody(z.object({
  name: z.string().min(1).max(255),
  email: z.string().email().max(255),
  password: z.string().min(6).max(100),
  position: z.string().max(255).optional(),
})), async (req, res, next) => {
  try {
    const { name, email, password, position } = req.body;
    
    const existing = await db.select().from(schema.employees).where(eq(schema.employees.email, email)).limit(1);
    if (existing.length > 0) {
      throw new AppError(409, 'Email already exists');
    }
    
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const [employee] = await db.insert(schema.employees).values({
      name,
      email,
      passwordHash,
      position: position || null,
      role: 'employee',
    }).returning({
      id: schema.employees.id,
      name: schema.employees.name,
      email: schema.employees.email,
      position: schema.employees.position,
      role: schema.employees.role,
      createdAt: schema.employees.createdAt,
      updatedAt: schema.employees.updatedAt,
    });
    
    req.session.employeeId = employee.id;
    res.status(201).json(employee);
  } catch (e) { next(e); }
});

// POST /api/auth/login
authRouter.post('/login', validateBody(z.object({
  email: z.string().email(),
  password: z.string().min(1),
})), async (req, res, next) => {
  try {
    const { email, password } = req.body;
    
    const employees = await db.select().from(schema.employees).where(eq(schema.employees.email, email)).limit(1);
    if (employees.length === 0) {
      throw new AppError(401, 'Invalid email or password');
    }
    
    const employee = employees[0];
    if (!employee.passwordHash) {
      throw new AppError(401, 'Account not set up for login');
    }
    
    const valid = await bcrypt.compare(password, employee.passwordHash);
    if (!valid) {
      throw new AppError(401, 'Invalid email or password');
    }
    
    req.session.employeeId = employee.id;
    
    res.json({
      id: employee.id,
      name: employee.name,
      email: employee.email,
      position: employee.position,
      role: employee.role,
    });
  } catch (e) { next(e); }
});

// POST /api/auth/logout
authRouter.post('/logout', (req, res, next) => {
  req.session.destroy((err) => {
    if (err) return next(err);
    res.clearCookie('connect.sid');
    res.status(204).end();
  });
});

// GET /api/auth/me
authRouter.get('/me', async (req, res, next) => {
  try {
    if (!req.session?.employeeId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    const [employee] = await db.select({
      id: schema.employees.id,
      name: schema.employees.name,
      email: schema.employees.email,
      position: schema.employees.position,
      role: schema.employees.role,
    }).from(schema.employees).where(eq(schema.employees.id, req.session.employeeId)).limit(1);
    
    if (!employee) {
      res.status(401).json({ error: 'User not found' });
      return;
    }
    
    res.json(employee);
  } catch (e) { next(e); }
});