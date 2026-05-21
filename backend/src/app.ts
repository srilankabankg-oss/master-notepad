import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { env } from './env.js';
import session from 'express-session';
import createPgStore from 'connect-pg-simple';
import { pool } from './db/index.js';
import { subcontractorsRouter } from './routes/subcontractors.js';
import { reviewsRouter } from './routes/reviews.js';
import { commentsRouter } from './routes/comments.js';
import { checklistsRouter } from './routes/checklists.js';
import { suggestionsRouter } from './routes/suggestions.js';
import { meetingsRouter } from './routes/meetings.js';
import { surveysRouter } from './routes/surveys.js';
import { employeesRouter } from './routes/employees.js';
import { eventsRouter } from './routes/events.js';
import { tenderRouter } from './routes/tender.js';
import { aiRouter } from './routes/ai.js';
import { authRouter } from './routes/auth.js';
import { auditLogRouter } from './routes/audit.js';
import { errorHandler } from './middleware/error-handler.js';

export const app = express();

// Security
app.use(helmet());
app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
  }),
);

// Session (PostgreSQL store)
const PgSessionStore = createPgStore(session);
app.use(
  session({
    store: new PgSessionStore({
      pool,
      tableName: 'session',
      createTableIfMissing: true,
    }),
    secret: env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  }),
);

// Rate limiting: 100 requests per 15 minutes per IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', limiter);

app.use(express.json({ limit: '1mb' }));

// Routes
app.use('/api/auth', authRouter);
app.use('/api/employees', employeesRouter);
app.use('/api/subcontractors', subcontractorsRouter);
app.use('/api/reviews', reviewsRouter);
app.use('/api/comments', commentsRouter);
app.use('/api/checklists', checklistsRouter);
app.use('/api/suggestions', suggestionsRouter);
app.use('/api/meetings', meetingsRouter);
app.use('/api/surveys', surveysRouter);
app.use('/api/tender', tenderRouter);
app.use('/api/events', eventsRouter);
app.use('/api/ai', aiRouter);
app.use('/api/audit-log', auditLogRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Error handler (must be last)
app.use(errorHandler);
