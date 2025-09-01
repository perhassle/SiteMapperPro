const { chromium } = require('@playwright/test');
const fs = require('fs').promises;
const path = require('path');

class URLStructureExtractor {
    constructor(baseUrl, maxDepth = 3) {
        this.baseUrl = new URL(baseUrl);
        this.maxDepth = maxDepth;
        this.visitedUrls = new Set();
        this.urlStructure = {};
        this.loopCounter = new Map(); // Track loops
        this.timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        this.outputDir = path.join(process.cwd(), 'extractions', this.timestamp);
        this.totalEstimated = 0;
        this.processedCount = 0;
        this.browser = null; // Store browser reference for cleanup
    }
    
    updateProgress(message, percentage) {
        // This will be overridden by ExtractorService
        console.log(`Progress: ${percentage}% - ${message}`);
    }
    
    calculateProgress(current, total, startPercent = 10, endPercent = 90) {
        // Logarithmic progression - slow at start, faster at end
        const ratio = current / total;
        const logProgress = Math.log(1 + ratio * 9) / Math.log(10); // log base 10 of (1 to 10)
        return Math.floor(startPercent + (endPercent - startPercent) * logProgress);
    }
    
    normalizeUrl(url) {
        try {
            const urlObj = new URL(url);
            // Remove trailing slash, fragment, and query params for structure
            let normalized = urlObj.origin + urlObj.pathname.replace(/\/$/, '');
            normalized = normalized.split('#')[0].split('?')[0];
            return normalized.toLowerCase();
        } catch {
            return url;
        }
    }

    async extract() {
        console.log(`🌳 Starting URL structure extraction for ${this.baseUrl.href}`);
        console.log(`📊 Max depth: ${this.maxDepth}`);
        
        this.updateProgress('Initializing extraction...', 2);
        await fs.mkdir(this.outputDir, { recursive: true });
        
        this.browser = await chromium.launch({ 
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        try {
            const context = await this.browser.newContext({
                viewport: { width: 1920, height: 1080 },
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            });
            
            // Step 1: Check for sitemap.xml
            console.log('\n🔍 Checking for sitemap.xml...');
            this.updateProgress('Checking for sitemap...', 8);
            const sitemapUrls = await this.checkSitemap(context);
            
            if (sitemapUrls.length > 0) {
                console.log(`✅ Found sitemap with ${sitemapUrls.length} URLs`);
                this.totalEstimated = sitemapUrls.length;
                this.updateProgress(`Processing ${sitemapUrls.length} URLs from sitemap...`, 12);
                
                // Process sitemap URLs with smooth progression
                for (let i = 0; i < sitemapUrls.length; i++) {
                    await this.addUrlToStructure(sitemapUrls[i]);
                    this.processedCount++;
                    const progress = this.calculateProgress(i + 1, sitemapUrls.length, 10, 85);
                    this.updateProgress(`Processing URL ${i + 1} of ${sitemapUrls.length}...`, progress);
                }
            } else {
                console.log('❌ No sitemap found, crawling site...');
                this.updateProgress('No sitemap found, starting crawl...', 12);
                this.totalEstimated = 50; // Estimate for crawling
                // Fallback to crawling
                await this.crawlPage(context, this.baseUrl.href, 0);
            }
            
            // Generate output files
            this.updateProgress('Generating reports...', 88);
            const treeHtml = this.generateTreeHTML();
            const outputFile = path.join(this.outputDir, 'url-structure.html');
            await fs.writeFile(outputFile, treeHtml, 'utf8');
            
            const structureJson = path.join(this.outputDir, 'structure.json');
            await fs.writeFile(structureJson, JSON.stringify({
                baseUrl: this.baseUrl.href,
                timestamp: new Date().toISOString(),
                totalUrls: this.visitedUrls.size,
                structure: this.urlStructure
            }, null, 2), 'utf8');
            
            // Smooth finish from 88 to 100
            this.updateProgress('Finalizing structure...', 92);
            await new Promise(resolve => setTimeout(resolve, 200));
            this.updateProgress('Saving files...', 96);
            await new Promise(resolve => setTimeout(resolve, 200));
            this.updateProgress('Extraction completed!', 100);
            console.log(`\n✅ URL structure extraction completed!`);
            console.log(`📊 Total unique URLs: ${this.visitedUrls.size}`);
            console.log(`📁 Structure saved to: ${outputFile}`);
            
        } finally {
            if (this.browser) {
                await this.browser.close();
            }
        }
    }

    async checkSitemap(context) {
        const sitemapUrls = [];
        const possiblePaths = [
            '/sitemap.xml',
            '/sitemap_index.xml',
            '/sitemap.xml.gz',
            '/robots.txt'
        ];
        
        for (const sitemapPath of possiblePaths) {
            try {
                const sitemapUrl = new URL(sitemapPath, this.baseUrl).href;
                const page = await context.newPage();
                
                const response = await page.goto(sitemapUrl, { 
                    waitUntil: 'domcontentloaded',
                    timeout: 10000 
                });
                
                if (response && response.ok()) {
                    const contentType = response.headers()['content-type'] || '';
                    
                    if (sitemapPath === '/robots.txt') {
                        // Check robots.txt for sitemap location
                        const content = await page.content();
                        const sitemapMatch = content.match(/Sitemap:\s*(.+)/i);
                        if (sitemapMatch) {
                            console.log(`   Found sitemap in robots.txt: ${sitemapMatch[1]}`);
                            await page.close();
                            return await this.fetchSitemapUrls(context, sitemapMatch[1].trim());
                        }
                    } else if (contentType.includes('xml')) {
                        // Parse XML sitemap
                        const urls = await page.evaluate(() => {
                            const urlElements = document.querySelectorAll('url loc');
                            return Array.from(urlElements).map(el => el.textContent);
                        });
                        
                        if (urls.length > 0) {
                            await page.close();
                            return urls;
                        }
                    }
                }
                
                await page.close();
            } catch (error) {
                // Silently continue to next path
            }
        }
        
        return sitemapUrls;
    }

    async fetchSitemapUrls(context, sitemapUrl) {
        try {
            const page = await context.newPage();
            await page.goto(sitemapUrl, { 
                waitUntil: 'domcontentloaded',
                timeout: 10000 
            });
            
            const urls = await page.evaluate(() => {
                const urlElements = document.querySelectorAll('url loc');
                return Array.from(urlElements).map(el => el.textContent);
            });
            
            await page.close();
            return urls;
        } catch {
            return [];
        }
    }

    async crawlPage(context, url, depth) {
        if (depth > this.maxDepth) return;
        
        const normalizedUrl = this.normalizeUrl(url);
        
        // Loop detection
        const loopCount = this.loopCounter.get(normalizedUrl) || 0;
        if (loopCount >= 5) {
            console.log(`${'  '.repeat(depth)}⚠️ Loop detected for ${normalizedUrl}, skipping...`);
            return;
        }
        this.loopCounter.set(normalizedUrl, loopCount + 1);
        
        if (this.visitedUrls.has(normalizedUrl)) return;
        
        try {
            const urlObj = new URL(url);
            if (urlObj.hostname !== this.baseUrl.hostname) return;
            
            this.visitedUrls.add(normalizedUrl);
            await this.addUrlToStructure(url);
            
            this.processedCount++;
            // Use logarithmic progression for crawling too
            const progress = this.calculateProgress(this.processedCount, this.totalEstimated, 15, 85);
            this.updateProgress(`Scanning: ${urlObj.pathname || '/'}`, progress);
            console.log(`${'  '.repeat(depth)}📄 Scanning: ${urlObj.pathname || '/'}`);
            
            const page = await context.newPage();
            await page.goto(url, { 
                waitUntil: 'domcontentloaded',
                timeout: 20000 
            });
            
            // Get all links
            const links = await page.evaluate(() => {
                const anchors = document.querySelectorAll('a[href]');
                return Array.from(anchors).map(a => a.href).filter(href => 
                    href && !href.startsWith('javascript:') && !href.startsWith('#')
                );
            });
            
            await page.close();
            
            // Process unique links
            const uniqueLinks = [...new Set(links)]
                .filter(link => {
                    try {
                        const linkUrl = new URL(link);
                        return linkUrl.hostname === this.baseUrl.hostname;
                    } catch {
                        return false;
                    }
                })
                .filter(link => !this.visitedUrls.has(this.normalizeUrl(link)));
            
            // Process links
            for (const link of uniqueLinks.slice(0, 30)) {
                await this.crawlPage(context, link, depth + 1);
            }
            
        } catch (error) {
            console.error(`${'  '.repeat(depth)}❌ Error: ${error.message.split('\n')[0]}`);
        }
    }

    getFileIcon(url) {
        const extension = url.split('.').pop().toLowerCase();
        const icons = {
            'pdf': '📄',
            'doc': '📝',
            'docx': '📝',
            'xls': '📊',
            'xlsx': '📊',
            'ppt': '📈',
            'pptx': '📈',
            'txt': '📃',
            'csv': '📉',
            'zip': '🗜️',
            'rar': '🗜️',
            'jpg': '🏷️',
            'jpeg': '🏷️',
            'png': '🏷️',
            'gif': '🏷️',
            'mp4': '🎥',
            'mp3': '🎵',
            'html': '🌐',
            'css': '🎨',
            'js': '⚙️',
            'json': '📦'
        };
        
        // Check if it's a file with extension
        if (extension && extension.length <= 4 && !url.endsWith('/')) {
            return icons[extension] || '📄';
        }
        return '📁'; // Folder icon by default
    }
    
    addUrlToStructure(url) {
        try {
            const urlObj = new URL(url);
            const pathParts = urlObj.pathname.split('/').filter(p => p);
            
            // Build hierarchical structure based on URL path
            let current = this.urlStructure;
            
            // Root level
            if (!current['/']) {
                current['/'] = {
                    url: this.baseUrl.origin,
                    title: this.baseUrl.hostname,
                    icon: '🏠',
                    children: {}
                };
            }
            
            // Add path parts hierarchically
            current = current['/'].children;
            let accumulatedPath = '';
            
            for (let i = 0; i < pathParts.length; i++) {
                const part = pathParts[i];
                accumulatedPath += '/' + part;
                const fullUrl = this.baseUrl.origin + accumulatedPath;
                
                if (!current[part]) {
                    current[part] = {
                        url: fullUrl,
                        title: part.replace(/[-_]/g, ' '),
                        icon: this.getFileIcon(fullUrl),
                        children: {}
                    };
                }
                current = current[part].children;
            }
        } catch (error) {
            console.error('Error adding URL to structure:', error);
        }
    }

    generateTreeHTML() {
        let html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>URL Structure - ${this.baseUrl.hostname}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            margin: 0;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            padding: 30px;
        }
        .back-btn {
            position: fixed;
            top: 20px;
            left: 20px;
            background: white;
            color: #667eea;
            border: 2px solid #667eea;
            padding: 10px 20px;
            border-radius: 8px;
            text-decoration: none;
            font-weight: 600;
            transition: all 0.3s ease;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            z-index: 1000;
        }
        .back-btn:hover {
            background: #667eea;
            color: white;
            transform: translateX(-5px);
        }
        h1 {
            color: #333;
            border-bottom: 3px solid #667eea;
            padding-bottom: 10px;
            margin-bottom: 20px;
        }
        .info {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 20px;
        }
        .tree {
            background: #fafafa;
            border-radius: 8px;
            padding: 20px;
            overflow-x: auto;
        }
        .tree ul {
            list-style: none;
            padding-left: 20px;
            margin: 5px 0;
        }
        .tree > ul {
            padding-left: 0;
        }
        .tree li {
            position: relative;
            padding: 5px 0;
        }
        .node {
            display: inline-block;
            padding: 6px 12px;
            background: white;
            border: 1px solid #ddd;
            border-radius: 6px;
            transition: all 0.3s ease;
            text-decoration: none;
            color: #333;
            margin: 2px 0;
        }
        .node:hover {
            background: #667eea;
            color: white;
            border-color: #667eea;
            transform: translateX(5px);
            box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
        }
        .toggle {
            cursor: pointer;
            user-select: none;
            display: inline-block;
            width: 20px;
            text-align: center;
            margin-right: 5px;
            color: #667eea;
            font-weight: bold;
        }
        .path-indicator {
            color: #999;
            font-size: 12px;
            margin-left: 10px;
        }
    </style>
</head>
<body>
    <a href="/" class="back-btn">← Back to Dashboard</a>
    <div class="container">
        <h1>📂 URL Structure - ${this.baseUrl.hostname}</h1>
        
        <div class="info">
            <strong>Base URL:</strong> ${this.baseUrl.href}<br>
            <strong>Total URLs:</strong> ${this.visitedUrls.size}<br>
            <strong>Extraction Method:</strong> ${this.visitedUrls.size > 0 ? 'URL Structure Analysis' : 'No URLs found'}
        </div>
        
        <div class="tree">
            <ul>
                ${this.renderStructure(this.urlStructure)}
            </ul>
        </div>
    </div>
    
    <script>
        document.addEventListener('DOMContentLoaded', function() {
            // Collapse all nodes on load
            const allLists = document.querySelectorAll('.tree li > ul');
            allLists.forEach(ul => {
                ul.style.display = 'none';
                const toggle = ul.previousElementSibling?.querySelector('.toggle');
                if (toggle) toggle.textContent = '[+]';
            });
            
            // Toggle functionality
            const toggles = document.querySelectorAll('.toggle');
            toggles.forEach(toggle => {
                toggle.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    const li = this.closest('li');
                    const ul = li.querySelector(':scope > ul');
                    
                    if (ul) {
                        if (ul.style.display === 'none') {
                            ul.style.display = 'block';
                            this.textContent = '[-]';
                        } else {
                            ul.style.display = 'none';
                            this.textContent = '[+]';
                        }
                    }
                });
            });
        });
    </script>
</body>
</html>`;
        
        return html;
    }

    renderStructure(structure, level = 0) {
        let html = '';
        
        for (const [key, data] of Object.entries(structure)) {
            const hasChildren = Object.keys(data.children).length > 0;
            
            html += '<li>';
            
            if (hasChildren) {
                html += '<span class="toggle">[-]</span>';
            }
            
            const icon = data.icon || this.getFileIcon(data.url);
            html += `<a href="${data.url}" target="_blank" class="node">`;
            html += `${icon} ${key === '/' ? 'Home' : data.title}`;
            html += `<span class="path-indicator">${key === '/' ? '/' : key}</span>`;
            html += '</a>';
            
            if (hasChildren) {
                html += '<ul>';
                html += this.renderStructure(data.children, level + 1);
                html += '</ul>';
            }
            
            html += '</li>';
        }
        
        return html;
    }
}

module.exports = { URLStructureExtractor };