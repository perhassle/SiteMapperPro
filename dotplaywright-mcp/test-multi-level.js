const { chromium } = require('@playwright/test');

async function testMultiLevel() {
    console.log('🧪 Testing with multi-level website...\n');
    
    const browser = await chromium.launch({ 
        headless: false,
        slowMo: 300 
    });
    
    try {
        const page = await browser.newPage();
        
        console.log('1️⃣ Starting extraction for github.com...');
        await page.goto('http://localhost:3001');
        
        await page.fill('#url', 'https://github.com');
        await page.locator('#depth').fill('2');
        await page.click('#submitBtn');
        
        console.log('   Waiting for extraction (this may take a while)...');
        await page.waitForSelector('.success-animation.active', { timeout: 120000 });
        
        const successMsg = await page.textContent('#successMessage');
        console.log(`✅ Extraction completed: ${successMsg}\n`);
        
        console.log('2️⃣ Opening sitemap...');
        await page.click('#viewResultBtn');
        await page.waitForTimeout(3000);
        
        const pages = await browser.contexts()[0].pages();
        const sitemapPage = pages[pages.length - 1];
        
        console.log('3️⃣ Analyzing tree structure...');
        
        // Count all list items (nodes)
        const allNodes = await sitemapPage.locator('.tree li').all();
        console.log(`   Total nodes in tree: ${allNodes.length}`);
        
        // Count collapsed nodes
        const collapsedNodes = await sitemapPage.locator('li.collapsed').all();
        console.log(`   Collapsed nodes: ${collapsedNodes.length}`);
        
        // Count toggle buttons
        const toggleButtons = await sitemapPage.locator('.toggle').all();
        console.log(`   Expandable nodes: ${toggleButtons.length}`);
        
        if (toggleButtons.length > 0) {
            // Check all toggle states
            console.log('\n4️⃣ Checking initial toggle states:');
            for (let i = 0; i < Math.min(5, toggleButtons.length); i++) {
                const text = await toggleButtons[i].textContent();
                console.log(`   Toggle ${i + 1}: "${text}"`);
            }
            
            console.log('\n5️⃣ Testing expand functionality...');
            // Click first toggle to expand
            await toggleButtons[0].click();
            await sitemapPage.waitForTimeout(500);
            
            const expandedText = await toggleButtons[0].textContent();
            console.log(`   First toggle after click: "${expandedText}"`);
            
            // Check if ul is visible
            const firstUl = await sitemapPage.locator('li:first-child > ul').first();
            if (await firstUl.count() > 0) {
                const isVisible = await firstUl.isVisible();
                console.log(`   Children visible: ${isVisible}`);
                
                // Count children
                const children = await firstUl.locator('> li').all();
                console.log(`   Number of children: ${children.length}`);
            }
            
            // Collapse again
            await toggleButtons[0].click();
            await sitemapPage.waitForTimeout(500);
            const collapsedText = await toggleButtons[0].textContent();
            console.log(`   After re-collapse: "${collapsedText}"`);
        }
        
        console.log('\n✅ Test complete!');
        console.log('\n📊 Results:');
        console.log(`   • Found ${allNodes.length} total nodes`);
        console.log(`   • ${collapsedNodes.length} nodes are collapsed by default`);
        console.log(`   • ${toggleButtons.length} nodes have children`);
        console.log(`   • Default state: ${collapsedNodes.length === toggleButtons.length ? 'ALL COLLAPSED ✓' : 'NOT ALL COLLAPSED ✗'}`);
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    } finally {
        await browser.close();
    }
}

testMultiLevel();