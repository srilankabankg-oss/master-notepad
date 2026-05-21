import { test, expect } from '@playwright/test';

test.describe('Authentication E2E', () => {
  const testEmail = `e2e-${Date.now()}@test.com`;
  const testPassword = 'e2etest123';

  test('unauthenticated user is redirected to /login', async ({ page }) => {
    await page.goto('http://localhost:5173/subcontractors');
    await page.waitForURL('**/login');
    expect(page.url()).toContain('/login');
  });

  test('register and auto-login loads app', async ({ page }) => {
    await page.goto('http://localhost:5173/register');
    await page.fill('input[type="text"]', 'E2E Test User');
    await page.fill('input[type="email"]', testEmail);
    await page.fill('input[type="password"]', testPassword);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/subcontractors');
    expect(page.url()).toContain('/subcontractors');
  });

  test('logout redirects to /login', async ({ page }) => {
    await page.goto('http://localhost:5173/login');
    await page.fill('input[type="email"]', testEmail);
    await page.fill('input[type="password"]', testPassword);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/subcontractors');
    const logoutBtn = page.locator('text=Выйти');
    if (await logoutBtn.isVisible()) {
      await logoutBtn.click();
      await page.waitForURL('**/login');
    }
    expect(page.url()).toContain('/login');
  });
});