import { test, expect } from '@playwright/test'

test.describe('Tender Summary & Weighted Rating E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173')
  })

  test('weighted rating is displayed on subcontractor list page', async ({ page }) => {
    await page.goto('http://localhost:5173/subcontractors')
    await page.waitForSelector('.rating-badge')
    const badgeText = await page.locator('.rating-badge').first().textContent()
    expect(badgeText).not.toBe('-')
    expect(parseFloat(badgeText || '0')).toBeGreaterThanOrEqual(0)
  })

  test('tender summary page loads and shows all sections', async ({ page }) => {
    await page.goto('http://localhost:5173/tender/1')
    await page.waitForSelector('.detail-card')
    await expect(page.getByRole('heading', { name: 'Тендерная справка' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Отзывы' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'События' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Протоколы совещаний' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Комментарии' })).toBeVisible()
    await expect(page.getByText('Опросов')).toBeVisible()
    await expect(page.getByText('Нарушений')).toBeVisible()
  })

  test('adding a review updates the rating', async ({ page }) => {
    await page.goto('http://localhost:5173/subcontractors/2')
    await page.waitForSelector('.detail-card')
    const initialRating = await page.locator('.rating-value').textContent()

    await page.getByRole('button', { name: 'Добавить отзыв' }).click()
    await page.getByLabel('Сотрудник').selectOption('1')
    await page.locator('input[type="range"]').fill('8')
    await page.getByLabel('Текст').fill('Тестовый отзыв для проверки рейтинга')
    await page.getByRole('button', { name: 'Сохранить' }).click()

    await page.goto('http://localhost:5173/subcontractors/2')
    await page.waitForSelector('.detail-card')
    const newRating = await page.locator('.rating-value').textContent()
    expect(newRating).not.toBe(initialRating)
    expect(parseFloat(newRating)).toBe(8.0)
  })
})
