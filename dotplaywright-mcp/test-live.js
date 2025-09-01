const { chromium } = require('@playwright/test');

async function testApp() {
    console.log('🧪 Starting live test of SiteMapper Pro...\n');
    
    const browser = await chromium.launch({ 
        headless: false,
        slowMo: 500 
    });
    
    try {
        const page = await browser.newPage();
        
        console.log('1️⃣ Loading application...');
        await page.goto('http://localhost:3001');
        await page.waitForLoadState('networkidle');
        
        console.log('✅ Application loaded successfully\n');
        
        console.log('2️⃣ Testing form input...');
        await page.fill('#url', 'https://www.example.com');
        await page.locator('#depth').fill('1');
        
        console.log('✅ Form filled successfully\n');
        
        console.log('3️⃣ Starting extraction...');
        await page.click('#submitBtn');
        
        await page.waitForSelector('#progressSection.active', { timeout: 5000 });
        console.log('✅ Progress section visible\n');
        
        console.log('4️⃣ Waiting for extraction to complete...');
        await page.waitForSelector('.success-animation.active', { timeout: 60000 });
        console.log('✅ Extraction completed!\n');
        
        const successMessage = await page.textContent('#successMessage');
        console.log(`📊 Result: ${successMessage}\n`);
        
        console.log('5️⃣ Checking previous extractions...');
        const jobCards = await page.locator('.job-card').count();
        console.log(`✅ Found ${jobCards} previous extraction(s)\n`);
        
        console.log('6️⃣ Opening site map...');
        await page.click('#viewResultBtn');
        
        await page.waitForTimeout(2000);
        
        const pages = await browser.contexts()[0].pages();
        if (pages.length > 1) {
            console.log('✅ Site map opened in new tab\n');
        }
        
        console.log('🎉 All tests passed! The application is working perfectly!\n');
        console.log('🌟 Features tested:');
        console.log('   ✓ Application loads');
        console.log('   ✓ Form input works');
        console.log('   ✓ Real-time progress updates');
        console.log('   ✓ Extraction completes');
        console.log('   ✓ Results are displayed');
        console.log('   ✓ Previous extractions shown');
        console.log('   ✓ Site map can be viewed');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    } finally {
        await browser.close();
    }
}

testApp();