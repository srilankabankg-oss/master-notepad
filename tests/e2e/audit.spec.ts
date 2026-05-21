import { test, expect } from '@playwright/test';

test.describe('Audit Log E2E', () => {
  const testEmail = `e2e-audit-${Date.now()}@test.com`;
  const testPassword = 'e2etest123';

  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173/register');
    const nameInput = page.locator('input[type="text"]').first();
    if (await nameInput.isVisible()) {
      await nameInput.fill('Audit Test');
      await page.fill('input[type="email"]', testEmail);
      await page.fill('input[type="password"]', testPassword);
      await page.click('button[type="submit"]');
      await page.waitForURL('**/subcontractors');
    }
  });

  test('audit log page loads', async ({ page }) => {
    await page.goto('http://localhost:5173/audit-log');
    await page.waitForLoadState('networkidle');
    expect(page.url()).toContain('/audit-log');
  });

  test('chat page loads', async ({ page }) => {
    await page.goto('http://localhost:5173/chat');
    await page.waitForLoadState('networkidle');
    expect(page.url()).toContain('/chat');
  });
});