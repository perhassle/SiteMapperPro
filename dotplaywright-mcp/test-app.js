const { test, expect } = require('@playwright/test');

const BASE_URL = 'http://localhost:3000';

test.describe('SiteMapper Pro Application', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto(BASE_URL);
    });

    test('should load the application with correct title', async ({ page }) => {
        await expect(page).toHaveTitle('SiteMapper Pro - Professional Site Structure Extraction');
        
        const header = await page.locator('h1');
        await expect(header).toContainText('SiteMapper Pro');
    });

    test('should have all form elements', async ({ page }) => {
        const urlInput = await page.locator('#url');
        await expect(urlInput).toBeVisible();
        await expect(urlInput).toHaveAttribute('placeholder', 'https://example.com');
        
        const depthSlider = await page.locator('#depth');
        await expect(depthSlider).toBeVisible();
        await expect(depthSlider).toHaveAttribute('min', '1');
        await expect(depthSlider).toHaveAttribute('max', '5');
        
        const submitBtn = await page.locator('#submitBtn');
        await expect(submitBtn).toBeVisible();
        await expect(submitBtn).toContainText('Start Extraction');
    });

    test('should update depth value when slider moves', async ({ page }) => {
        const depthSlider = await page.locator('#depth');
        const depthValue = await page.locator('#depthValue');
        
        await expect(depthValue).toHaveText('2');
        
        await depthSlider.fill('4');
        await expect(depthValue).toHaveText('4');
        
        await depthSlider.fill('1');
        await expect(depthValue).toHaveText('1');
    });

    test('should validate URL format', async ({ page }) => {
        const urlInput = await page.locator('#url');
        const submitBtn = await page.locator('#submitBtn');
        
        await urlInput.fill('invalid-url');
        await submitBtn.click();
        
        const validationMessage = await urlInput.evaluate(el => el.validationMessage);
        expect(validationMessage).toBeTruthy();
    });

    test('should show progress section when extraction starts', async ({ page }) => {
        const urlInput = await page.locator('#url');
        const submitBtn = await page.locator('#submitBtn');
        const progressSection = await page.locator('#progressSection');
        
        await expect(progressSection).not.toBeVisible();
        
        await urlInput.fill('https://www.example.com');
        
        await page.evaluate(() => {
            window.io = () => ({
                emit: () => {},
                on: () => {}
            });
        });
        
        await submitBtn.click();
        
        await expect(progressSection).toBeVisible();
        await expect(submitBtn).toBeDisabled();
    });

    test('should display previous extractions section', async ({ page }) => {
        const jobsSection = await page.locator('.jobs-section');
        await expect(jobsSection).toBeVisible();
        
        const jobsHeader = await page.locator('.jobs-header h2');
        await expect(jobsHeader).toHaveText('Previous Extractions');
        
        const refreshBtn = await page.locator('.refresh-btn');
        await expect(refreshBtn).toBeVisible();
    });

    test('should have responsive design', async ({ page }) => {
        const viewports = [
            { width: 1920, height: 1080, name: 'Desktop' },
            { width: 768, height: 1024, name: 'Tablet' },
            { width: 375, height: 667, name: 'Mobile' }
        ];
        
        for (const viewport of viewports) {
            await page.setViewportSize({ width: viewport.width, height: viewport.height });
            
            const container = await page.locator('.container');
            await expect(container).toBeVisible();
            
            const mainCard = await page.locator('.main-card');
            await expect(mainCard).toBeVisible();
            
            console.log(`✅ Layout works on ${viewport.name} (${viewport.width}x${viewport.height})`);
        }
    });

    test('should have proper animations and hover effects', async ({ page }) => {
        const submitBtn = await page.locator('#submitBtn');
        
        const initialTransform = await submitBtn.evaluate(el => 
            window.getComputedStyle(el).transform
        );
        
        await submitBtn.hover();
        
        await page.waitForTimeout(300);
        
        const hoverTransform = await submitBtn.evaluate(el => 
            window.getComputedStyle(el).transform
        );
        
        expect(initialTransform).not.toBe(hoverTransform);
    });

    test('should handle API endpoints', async ({ page }) => {
        const response = await page.request.get(`${BASE_URL}/api/jobs`);
        expect(response.status()).toBe(200);
        
        const jobs = await response.json();
        expect(Array.isArray(jobs)).toBeTruthy();
    });
});

console.log('🧪 Running Playwright tests for SiteMapper Pro...');
console.log('📝 Make sure the server is running on http://localhost:3000');
console.log('');

test.describe.configure({ mode: 'serial' });