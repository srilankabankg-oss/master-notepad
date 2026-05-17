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
    // Sections with empty data show "Нет ..." message instead of heading
    await expect(page.getByText('Нет протоколов')).toBeVisible()
    await expect(page.getByText('Нет комментариев')).toBeVisible()
    await expect(page.getByText('Опросов')).toBeVisible()
    await expect(page.getByText('Нарушений')).toBeVisible()
  })

  test('adding a review updates the rating', async ({ page }) => {
    await page.goto('http://localhost:5173/subcontractors/2')
    await page.waitForSelector('.detail-card')
    const initialRating = await page.locator('.rating-value').textContent()

    // Use a rating different from current average to ensure change
    const newRatingValue = initialRating && parseFloat(initialRating) >= 5 ? '3' : '8'

    await page.getByRole('button', { name: 'Добавить отзыв' }).click()
    await page.getByLabel('Сотрудник').selectOption('1')
    await page.locator('input[type="range"]').fill(newRatingValue)
    await page.getByLabel('Текст').fill('Тестовый отзыв для проверки рейтинга')
    await page.getByRole('button', { name: 'Сохранить' }).click()

    await page.goto('http://localhost:5173/subcontractors/2')
    await page.waitForSelector('.detail-card')
    const updatedRating = await page.locator('.rating-value').textContent()
    expect(updatedRating).not.toBe(initialRating)
  })
})
