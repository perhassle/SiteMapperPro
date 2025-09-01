# SiteMapper Pro

A professional web-based site structure extraction tool that crawls websites to build hierarchical site maps with real-time progress tracking.

## Features

- 🔍 **Smart Crawling**: Checks sitemap.xml first, then falls back to intelligent page crawling
- 📊 **Hierarchical Structure**: Builds URL structure based on actual paths, not discovery location  
- ⚡ **Real-time Progress**: WebSocket-based live progress updates with smooth logarithmic progression
- 🎯 **Depth Control**: Configurable crawl depth from 1 to 30 levels
- 🛑 **Cancellable**: Stop extraction at any time with proper cleanup
- 📁 **File Type Detection**: Automatic icons for PDFs, documents, images, and more
- 🔄 **Loop Detection**: Prevents infinite loops with max 5 visits per URL
- 📝 **Export Formats**: JSON structure data and visual HTML tree representation
- 🗂️ **Job History**: View and manage previous extractions with delete functionality

## Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd dotplaywright-mcp
```

2. Install dependencies:

```bash
npm install
```

## Usage

### Starting the Server

```bash
# Production mode
npm start

# Development mode with auto-restart
npm run dev
```

The server will start on `http://localhost:3001`

### Using the Web Interface

1. Open `http://localhost:3001` in your browser
2. Enter a website URL to extract
3. Set the desired crawl depth (1-30 levels)
4. Click "Start Extraction" 
5. Watch real-time progress updates
6. View or download the results when complete

### API Usage

#### Start an extraction:

```bash
curl -X POST http://localhost:3001/api/extract \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com", "depth": 3}'
```

#### List all extractions:

```bash
curl http://localhost:3001/api/jobs
```

#### Delete an extraction:

```bash
curl -X DELETE http://localhost:3001/api/jobs/{jobId}
```

## Output Structure

Extractions are saved in `/extractions/{timestamp}/` with:

- `structure.json` - Complete URL hierarchy with metadata
- `url-structure.html` - Interactive visual tree representation

Example structure.json:

```json
{
  "baseUrl": "https://example.com",
  "timestamp": "2025-09-01T13:20:27.311Z",
  "totalUrls": 24,
  "structure": {
    "/": {
      "url": "https://example.com",
      "title": "Homepage",
      "icon": "🏠",
      "children": {
        "about": {
          "url": "https://example.com/about",
          "title": "About Us",
          "icon": "📁",
          "children": {}
        }
      }
    }
  }
}
```

## Testing

Run the test suite:

```bash
# Run all tests
npm test

# Run specific tests
node dotplaywright-mcp/test-app.js        # Test main application
node dotplaywright-mcp/test-live.js       # Test live extraction
node dotplaywright-mcp/test-complete.js   # Test full workflow
node dotplaywright-mcp/test-multi-level.js # Test deep crawling
```

## Configuration

### Environment Variables

- `PORT` - Server port (default: 3001)

### Crawl Settings

Configure in the extraction request:

- `url` - Target website URL (required)
- `depth` - Maximum crawl depth, 1-30 (default: 2)

## Technologies Used

- **Backend**: Node.js, Express.js, Socket.io
- **Web Scraping**: Playwright
- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Real-time**: WebSockets for live progress updates

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│                 │     │                  │     │                  │
│   Web UI        │────▶│  Express Server  │────▶│  URL Extractor   │
│   (Browser)     │◀────│  (Socket.io)     │◀────│  (Playwright)    │
│                 │     │                  │     │                  │
└─────────────────┘     └──────────────────┘     └──────────────────┘
        ▲                       │                         │
        │                       ▼                         ▼
        │               ┌──────────────┐         ┌──────────────┐
        └───────────────│  Extractions │         │   Sitemap    │
                        │  Storage      │         │   Checker    │
                        └──────────────┘         └──────────────┘
```

## Troubleshooting

### Port already in use

If you get an error that port 3001 is already in use:

```bash
# Find and kill the process
lsof -ti:3001 | xargs kill -9

# Then restart the server
npm start
```

### Extraction stuck or slow

- Check if the target website is accessible
- Try reducing the crawl depth
- Some sites may have rate limiting or bot protection

### Old extractions not showing

The system supports both old (structure.json) and new (index.json) format extractions automatically.

## License

ISC

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## Support

For issues, questions, or suggestions, please open an issue in the GitHub repository.