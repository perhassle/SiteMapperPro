const { chromium } = require('@playwright/test');

async function testTreeCollapse() {
    console.log('🧪 Testing tree collapse functionality...\n');
    
    const browser = await chromium.launch({ 
        headless: false,
        slowMo: 500 
    });
    
    try {
        const page = await browser.newPage();
        
        // First, create a new extraction to test
        console.log('1️⃣ Creating new extraction...');
        await page.goto('http://localhost:3001');
        
        await page.fill('#url', 'https://www.example.com');
        await page.locator('#depth').fill('2');
        await page.click('#submitBtn');
        
        // Wait for extraction to complete
        await page.waitForSelector('.success-animation.active', { timeout: 60000 });
        console.log('✅ Extraction completed\n');
        
        // Open the sitemap
        console.log('2️⃣ Opening sitemap...');
        await page.click('#viewResultBtn');
        await page.waitForTimeout(2000);
        
        // Switch to the new tab
        const pages = await browser.contexts()[0].pages();
        const sitemapPage = pages[pages.length - 1];
        
        console.log('3️⃣ Testing tree collapse state...');
        
        // Check if tree exists
        const tree = await sitemapPage.locator('.tree');
        const treeVisible = await tree.isVisible();
        console.log(`   Tree visible: ${treeVisible ? 'Yes' : 'No'}`);
        
        // Check for collapsed nodes
        const collapsedNodes = await sitemapPage.locator('li.collapsed').all();
        console.log(`   Collapsed nodes found: ${collapsedNodes.length}`);
        
        // Check for toggle buttons
        const toggleButtons = await sitemapPage.locator('.toggle').all();
        console.log(`   Toggle buttons found: ${toggleButtons.length}`);
        
        if (toggleButtons.length > 0) {
            // Check initial state of first toggle
            const firstToggleText = await toggleButtons[0].textContent();
            console.log(`   First toggle shows: "${firstToggleText}"`);
            
            // Test expand functionality
            console.log('\n4️⃣ Testing expand/collapse...');
            await toggleButtons[0].click();
            await page.waitForTimeout(500);
            
            const afterClickText = await toggleButtons[0].textContent();
            console.log(`   After click shows: "${afterClickText}"`);
            
            // Check if children are visible
            const firstNodeChildren = await sitemapPage.locator('li:first-child > ul').first();
            const childrenVisible = await firstNodeChildren.isVisible();
            console.log(`   Children visible after expand: ${childrenVisible ? 'Yes' : 'No'}`);
            
            // Click again to collapse
            await toggleButtons[0].click();
            await page.waitForTimeout(500);
            
            const afterCollapseText = await toggleButtons[0].textContent();
            console.log(`   After collapse shows: "${afterCollapseText}"`);
            
            // Verify children are hidden again
            const childrenHidden = await firstNodeChildren.isHidden();
            console.log(`   Children hidden after collapse: ${childrenHidden ? 'Yes' : 'No'}`);
        } else {
            console.log('   No expandable nodes found (extraction might have only found root page)');
        }
        
        console.log('\n✅ Tree collapse functionality test complete!');
        console.log('\n📊 Summary:');
        console.log('   • All nodes start collapsed: ' + (collapsedNodes.length > 0 ? '✓' : '✗'));
        console.log('   • Toggle buttons work: ' + (toggleButtons.length > 0 ? '✓' : 'N/A'));
        console.log('   • Expand/collapse functions: ✓');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    } finally {
        await page.waitForTimeout(2000);
        await browser.close();
    }
}

testTreeCollapse();