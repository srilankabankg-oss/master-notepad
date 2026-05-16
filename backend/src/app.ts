import express from 'express';
import cors from 'cors';
import { subcontractorsRouter } from './routes/subcontractors.js';
import { reviewsRouter } from './routes/reviews.js';
import { commentsRouter } from './routes/comments.js';
import { checklistsRouter } from './routes/checklists.js';
import { suggestionsRouter } from './routes/suggestions.js';
import { meetingsRouter } from './routes/meetings.js';
import { surveysRouter } from './routes/surveys.js';
import { employeesRouter } from './routes/employees.js';
import { errorHandler } from './middleware/error-handler.js';

export const app = express();

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/employees', employeesRouter);
app.use('/api/subcontractors', subcontractorsRouter);
app.use('/api/reviews', reviewsRouter);
app.use('/api/comments', commentsRouter);
app.use('/api/checklists', checklistsRouter);
app.use('/api/suggestions', suggestionsRouter);
app.use('/api/meetings', meetingsRouter);
app.use('/api/surveys', surveysRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Error handler (must be last)
app.use(errorHandler);
