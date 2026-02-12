import { test, expect } from "@playwright/test";

test.describe("Color Button", () => {
  test("should change color when clicked", async ({ page }) => {
    await page.goto("/");

    // Перевіряємо що сторінка завантажилась
    await expect(page.getByRole("heading", { name: "My First Vibe App" })).toBeVisible();

    // Знаходимо кнопку
    const button = page.getByTestId("color-button");
    const colorDisplay = page.getByTestId("color-display");

    // Початковий колір — синій (#3b82f6)
    await expect(colorDisplay).toContainText("#3b82f6");
    await expect(button).toHaveCSS("background-color", "rgb(59, 130, 246)");

    // Клікаємо — колір змінюється на червоний (#ef4444)
    await button.click();
    await expect(colorDisplay).toContainText("#ef4444");
    await expect(button).toHaveCSS("background-color", "rgb(239, 68, 68)");

    // Ще клік — зелений (#22c55e)
    await button.click();
    await expect(colorDisplay).toContainText("#22c55e");
    await expect(button).toHaveCSS("background-color", "rgb(34, 197, 94)");

    // Ще клік — фіолетовий (#a855f7)
    await button.click();
    await expect(colorDisplay).toContainText("#a855f7");

    // Ще клік — жовтий (#f59e0b)
    await button.click();
    await expect(colorDisplay).toContainText("#f59e0b");

    // Ще клік — повертаємось до синього (цикл!)
    await button.click();
    await expect(colorDisplay).toContainText("#3b82f6");
  });
});
