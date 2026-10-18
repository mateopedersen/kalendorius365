import {expect} from '@playwright/test';
export async function openHeaderSearch(page){
 const input=page.locator('#site-search');
 // Wait for the shared script to add the mobile opener before inspecting layout.
 await expect(page.locator('.site-header')).toHaveClass(/search-ready/);
 if(!await input.isVisible())await page.locator('.header-search-toggle').click();
 await expect(input).toBeVisible();return input;
}
