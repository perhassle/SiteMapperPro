const { chromium } = require('@playwright/test');
const fs = require('fs').promises;
const path = require('path');

class SiteMapExtractor {
    constructor(baseUrl, maxDepth = 3) {  // Default depth increased
        this.baseUrl = new URL(baseUrl);
        this.maxDepth = maxDepth;
        this.visitedUrls = new Set();
        this.visitedPaths = new Set();
        this.siteMap = new Map();
        this.urlIndex = new Map();
        this.timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        this.outputDir = path.join(process.cwd(), 'extractions', this.timestamp);
    }
    
    normalizeUrl(url) {
        try {
            const urlObj = new URL(url);
            let normalized = urlObj.origin + urlObj.pathname.replace(/\/$/, '');
            normalized = normalized.split('#')[0];
            return normalized.toLowerCase();
        } catch {
            return url;
        }
    }

    async extract() {
        console.log(`🌳 Extracting site map for ${this.baseUrl.href}`);
        console.log(`📊 Max depth: ${this.maxDepth}`);
        
        await fs.mkdir(this.outputDir, { recursive: true });
        
        const browser = await chromium.launch({ 
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        try {
            const context = await browser.newContext({
                viewport: { width: 1920, height: 1080 },
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            });
            
            await this.crawlPage(context, this.baseUrl.href, 0, null);
            
            const treeHtml = this.generateTreeHTML();
            const outputFile = path.join(this.outputDir, 'sitemap.html');
            await fs.writeFile(outputFile, treeHtml, 'utf8');
            
            const indexFile = path.join(this.outputDir, 'index.json');
            const index = {
                baseUrl: this.baseUrl.href,
                timestamp: new Date().toISOString(),
                totalPages: this.visitedUrls.size,
                pages: Array.from(this.visitedUrls).map(url => {
                    const data = this.siteMap.get(url);
                    return {
                        url: url,
                        normalized: this.normalizeUrl(url),
                        title: data?.title || 'Unknown',
                        path: data?.path || '/',
                        depth: data?.depth || 0
                    };
                }).sort((a, b) => a.depth - b.depth || a.path.localeCompare(b.path))
            };
            await fs.writeFile(indexFile, JSON.stringify(index, null, 2), 'utf8');
            
            console.log(`\n✅ Site map extraction completed!`);
            console.log(`📊 Total unique pages found: ${this.visitedUrls.size}`);
            console.log(`📁 Site map saved to: ${outputFile}`);
            console.log(`📋 Index saved to: ${indexFile}`);
            
        } finally {
            await browser.close();
        }
    }

    async crawlPage(context, url, depth, parentUrl) {
        if (depth > this.maxDepth) return;
        
        const normalizedUrl = this.normalizeUrl(url);
        if (this.visitedPaths.has(normalizedUrl)) return;
        
        try {
            const urlObj = new URL(url);
            
            if (urlObj.hostname !== this.baseUrl.hostname) return;
            
            this.visitedPaths.add(normalizedUrl);
            this.visitedUrls.add(url);
            
            console.log(`${'  '.repeat(depth)}📄 Scanning: ${urlObj.pathname || '/'}`);
            
            const page = await context.newPage();
            await page.goto(url, { 
                waitUntil: 'domcontentloaded',
                timeout: 30000  // Increased timeout for deeper crawls
            });
            
            const pageData = await page.evaluate(() => {
                const title = document.title || 'Untitled';
                const path = window.location.pathname;
                
                const links = [];
                const uniqueLinks = new Set();
                
                // Get ALL links on the page for comprehensive crawling
                const selectors = [
                    'a[href]'  // Get all links with href attribute
                ];
                
                document.querySelectorAll(selectors.join(', ')).forEach(link => {
                    const href = link.href;
                    if (href && 
                        !href.startsWith('javascript:') && 
                        !href.startsWith('#') &&
                        !href.startsWith('mailto:') &&
                        !href.startsWith('tel:') &&
                        !href.includes('facebook.com') &&
                        !href.includes('twitter.com') &&
                        !href.includes('linkedin.com') &&
                        !href.includes('instagram.com') &&
                        !href.includes('youtube.com') &&
                        !uniqueLinks.has(href)) {
                        uniqueLinks.add(href);
                        links.push({
                            href: href,
                            text: link.textContent.trim() || 'No text'
                        });
                    }
                });
                
                return {
                    title: title,
                    url: window.location.href,
                    path: path,
                    links: links
                };
            });
            
            if (!this.siteMap.has(url)) {
                this.siteMap.set(url, {
                    title: pageData.title,
                    path: pageData.path,
                    depth: depth,
                    parent: parentUrl,
                    children: []
                });
            }
            
            if (parentUrl && this.siteMap.has(parentUrl)) {
                const parent = this.siteMap.get(parentUrl);
                if (!parent.children.includes(url)) {
                    parent.children.push(url);
                }
            }
            
            const internalLinks = pageData.links
                .filter(link => {
                    try {
                        const linkUrl = new URL(link.href);
                        return linkUrl.hostname === this.baseUrl.hostname;
                    } catch {
                        return false;
                    }
                })
                .map(link => link.href)
                .filter(href => {
                    const normalized = this.normalizeUrl(href);
                    return !this.visitedPaths.has(normalized);
                });
            
            // Deduplicate and prioritize structural links
            const uniqueInternalLinks = [...new Set(internalLinks.map(url => this.normalizeUrl(url)))]
                .map(normalized => internalLinks.find(url => this.normalizeUrl(url) === normalized))
                .filter(link => link);
            
            // Sort links to prioritize main navigation paths
            const prioritizedLinks = uniqueInternalLinks.sort((a, b) => {
                const aPath = new URL(a).pathname;
                const bPath = new URL(b).pathname;
                const aDepth = aPath.split('/').filter(s => s).length;
                const bDepth = bPath.split('/').filter(s => s).length;
                return aDepth - bDepth;
            });
            
            // Process more links when depth allows
            const maxLinksPerLevel = Math.max(50 - (depth * 10), 10); // More links at shallow depths
            const linksToProcess = prioritizedLinks.slice(0, maxLinksPerLevel);
            
            console.log(`${'  '.repeat(depth)}🔍 Found ${prioritizedLinks.length} unique links, processing ${linksToProcess.length}`);
            
            // Process links sequentially to avoid overwhelming the server
            for (const link of linksToProcess) {
                await this.crawlPage(context, link, depth + 1, url);
            }
            
            await page.close();
            
        } catch (error) {
            console.error(`${'  '.repeat(depth)}❌ Error: ${error.message.split('\n')[0]}`);
        }
    }

    generateTreeHTML() {
        const rootPages = Array.from(this.siteMap.entries())
            .filter(([url, data]) => data.depth === 0)
            .map(([url]) => url);
        
        let html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Site Map - ${this.baseUrl.hostname}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
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
        h1 {
            color: #333;
            border-bottom: 3px solid #667eea;
            padding-bottom: 10px;
            margin-bottom: 20px;
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
        .stats {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 20px;
            display: flex;
            gap: 30px;
        }
        .stat {
            display: flex;
            flex-direction: column;
        }
        .stat-label {
            font-size: 12px;
            color: #666;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        .stat-value {
            font-size: 24px;
            font-weight: bold;
            color: #667eea;
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
        .tree li::before {
            content: '';
            position: absolute;
            left: -15px;
            top: 15px;
            width: 10px;
            border-top: 1px solid #ccc;
        }
        .tree li::after {
            content: '';
            position: absolute;
            left: -15px;
            top: 0;
            height: 100%;
            border-left: 1px solid #ccc;
        }
        .tree li:last-child::after {
            height: 15px;
        }
        .tree > ul > li::before,
        .tree > ul > li::after {
            display: none;
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
        .node-title {
            font-weight: 500;
            display: block;
        }
        .node-path {
            font-size: 11px;
            opacity: 0.7;
            display: block;
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
        .collapsed > ul {
            display: none;
        }
        .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #eee;
            text-align: center;
            color: #666;
            font-size: 14px;
        }
    </style>
</head>
<body>
    <a href="/" class="back-btn">← Back to Dashboard</a>
    <div class="container">
        <h1>🗺️ Site Map - ${this.baseUrl.hostname}</h1>
        
        <div class="stats">
            <div class="stat">
                <span class="stat-label">Total Pages</span>
                <span class="stat-value">${this.visitedUrls.size}</span>
            </div>
            <div class="stat">
                <span class="stat-label">Base URL</span>
                <span class="stat-value" style="font-size: 16px;">${this.baseUrl.href}</span>
            </div>
            <div class="stat">
                <span class="stat-label">Max Depth</span>
                <span class="stat-value">${this.maxDepth}</span>
            </div>
        </div>
        
        <div class="tree">
            <ul>
                ${rootPages.map(url => this.renderTreeNode(url, 0)).join('')}
            </ul>
        </div>
        
        <div class="footer">
            Generated on ${new Date().toISOString()} | 
            Click on any page to visit | 
            Click [+]/[-] to expand/collapse
        </div>
    </div>
    
    <script>
        document.addEventListener('DOMContentLoaded', function() {
            // Collapse all nodes on page load
            const allLists = document.querySelectorAll('.tree li > ul');
            allLists.forEach(ul => {
                ul.style.display = 'none';
                const parentLi = ul.parentElement;
                parentLi.classList.add('collapsed');
            });
            
            // Set all toggles to [+] initially
            const toggles = document.querySelectorAll('.toggle');
            toggles.forEach(toggle => {
                toggle.textContent = '[+]';
                
                toggle.addEventListener('click', function(e) {
                    e.preventDefault();
                    const li = this.parentElement;
                    const ul = li.querySelector(':scope > ul');
                    
                    if (li.classList.contains('collapsed')) {
                        li.classList.remove('collapsed');
                        this.textContent = '[-]';
                        if (ul) ul.style.display = 'block';
                    } else {
                        li.classList.add('collapsed');
                        this.textContent = '[+]';
                        if (ul) ul.style.display = 'none';
                    }
                });
            });
        });
    </script>
</body>
</html>`;
        
        return html;
    }

    renderTreeNode(url, depth = 0) {
        const data = this.siteMap.get(url);
        if (!data) return '';
        
        const hasChildren = data.children.length > 0;
        const urlObj = new URL(url);
        const displayPath = urlObj.pathname === '/' ? '/' : urlObj.pathname;
        
        // Collapse all nodes by default
        const isCollapsed = true;
        let html = `<li${hasChildren ? ' class="collapsed"' : ''}>`;
        
        if (hasChildren) {
            html += `<span class="toggle">[+]</span>`;
        }
        
        html += `<a href="${url}" target="_blank" class="node">
            <span class="node-title">${this.escapeHtml(data.title)}</span>
            <span class="node-path">${this.escapeHtml(displayPath)}</span>
        </a>`;
        
        if (hasChildren) {
            html += '<ul>';
            data.children.forEach(childUrl => {
                html += this.renderTreeNode(childUrl, depth + 1);
            });
            html += '</ul>';
        }
        
        html += '</li>';
        
        return html;
    }

    escapeHtml(text) {
        const div = { innerHTML: '' };
        div.innerHTML = text;
        return div.innerHTML
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
}

module.exports = { SiteMapExtractor };