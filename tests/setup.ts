// Disable rate limiting on the backend for test runs
// The backend reads process.env.DISABLE_RATE_LIMIT, so this must be set
// before the backend starts. This file runs in the vitest process,
// we set an env marker that the backend startup script can read.
process.env.DISABLE_RATE_LIMIT = 'true'
