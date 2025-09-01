# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a web-based site structure extraction tool that crawls websites to build hierarchical site maps. It uses Playwright for browser automation, Express.js/Socket.io for the backend, and provides a real-time progress tracking UI.

## Architecture

### Core Components

1. **URL Structure Extractor** (`url-structure-extractor.js`)
   - Main extraction engine that crawls websites using Playwright
   - Checks for sitemap.xml first, then falls back to crawling
   - Builds hierarchical URL structure based on paths (not discovery location)
   - Implements loop detection (max 5 visits per URL) and URL normalization
   - Adds icons for different file types (PDF, DOC, images, etc.)

2. **Express Server** (`server.js`)
   - Provides REST API endpoints and WebSocket communication
   - Manages extraction jobs and serves the UI
   - Handles backward compatibility for old extraction formats (structure.json vs index.json)
   - ExtractorService class extends URLStructureExtractor with progress tracking

3. **Frontend UI** (`public/index.html`)
   - Real-time extraction progress with logarithmic progression
   - Job history dashboard with delete functionality
   - Depth slider (1-30 levels) for controlling crawl depth
   - Stop button to cancel and clean up extractions

### Data Structure

Extractions are saved in timestamped folders under `/extractions/[timestamp]/`:

- `structure.json` - Hierarchical URL structure with metadata
- `url-structure.html` - Visual HTML tree representation

The structure.json contains:

- `baseUrl` - Starting URL
- `totalUrls` - Total unique URLs found  
- `structure` - Nested object representing URL hierarchy
- `timestamp` - Extraction date/time

## Common Commands

```bash
# Start the server
npm start

# Development mode with auto-restart
npm run dev

# Run tests
npm test

# Run specific test
node dotplaywright-mcp/test-app.js
node dotplaywright-mcp/test-live.js
node dotplaywright-mcp/test-complete.js

# Kill server if port is in use
lsof -ti:3001 | xargs kill -9
```

## Development Notes

### WebSocket Events

- `start-extraction` - Begin extraction with URL and depth
- `stop-extraction` - Cancel extraction and cleanup files
- `progress` - Real-time progress updates
- `complete` - Extraction finished successfully
- `error` - Extraction failed

### API Endpoints

- `GET /api/jobs` - List all extractions (handles both old and new formats)
- `DELETE /api/jobs/:id` - Delete an extraction folder
- `POST /api/extract` - Start extraction (returns jobId)

### Progress Calculation

Uses logarithmic progression to provide smooth UX:

```javascript
const progress = Math.min(5 + (Math.log(completed + 1) / Math.log(total + 1)) * 90, 95);
```

### Testing

All Playwright tests are in the `dotplaywright-mcp/` folder to keep the root clean. Tests verify:

- UI functionality (depth slider, stop button)
- Tree collapse/expand behavior
- Multi-level extraction
- Real-time progress updates

### Important Behaviors

- Tree nodes are collapsed by default in the HTML output
- URLs are normalized to prevent duplicates (removes trailing slashes, fragments)
- Server looks for both `index.json` (SiteMapExtractor) and `structure.json` (URLStructureExtractor) for backward compatibility
- The `totalPages` field in API responses maps to `totalUrls` in structure.json
- Browser instance is stored in `this.browser` for proper cleanup on stop
