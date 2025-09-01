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


<img width="1957" height="1255" alt="image" src="https://github.com/user-attachments/assets/2625cf3b-8899-455a-88ea-e528cbe265f8" />


## Installation

### Option 1: Local Installation

1. Clone the repository:

```bash
git clone https://github.com/perhassle/SiteMapperPro.git
cd SiteMapperPro
```

2. Install dependencies:

```bash
npm install
```

### Option 2: Docker Installation

1. Clone the repository:

```bash
git clone https://github.com/perhassle/SiteMapperPro.git
cd SiteMapperPro
```

2. Generate SSL certificate (for HTTPS):

```bash
./generate-ssl-cert.sh
```

3. Build and run with Docker Compose:

```bash
docker-compose up -d
```

Or build and run manually:

```bash
# Build the image
docker build -t sitemapper-pro .

# Run the container
docker run -d \
  --name sitemapper-pro \
  -p 3001:3001 \
  -v $(pwd)/extractions:/app/extractions \
  sitemapper-pro
```

## Usage

### Starting the Server

#### Local:

```bash
# Production mode
npm start

# Development mode with auto-restart
npm run dev
```

#### Docker:

```bash
# Start services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

The server will start on `http://localhost:3001` (or `http://sitemapperpro.local.se` if configured)

### Setting up Local Domain (sitemapperpro.local.se)

#### Automatic Setup (Mac/Linux):

```bash
sudo ./setup-local-domain.sh
```

#### Manual Setup:

##### On macOS:

1. Open Terminal
2. Edit the hosts file:
   ```bash
   sudo nano /etc/hosts
   ```
3. Add this line:
   ```
   127.0.0.1       sitemapperpro.local.se
   ```
4. Save the file (Ctrl+O, Enter, Ctrl+X)
5. Flush DNS cache:
   ```bash
   sudo dscacheutil -flushcache
   ```

##### On Windows:

1. Open Notepad as Administrator
   - Right-click on Notepad
   - Select "Run as administrator"
2. Open the hosts file:
   - File → Open
   - Navigate to: `C:\Windows\System32\drivers\etc\`
   - Change file type from "Text Documents" to "All Files"
   - Select the `hosts` file
3. Add this line at the end:
   ```
   127.0.0.1       sitemapperpro.local.se
   ```
4. Save the file (Ctrl+S)
5. Flush DNS cache (open Command Prompt as Administrator):
   ```cmd
   ipconfig /flushdns
   ```

##### On Linux:

1. Edit the hosts file:
   ```bash
   sudo nano /etc/hosts
   ```
2. Add this line:
   ```
   127.0.0.1       sitemapperpro.local.se
   ```
3. Save the file (Ctrl+O, Enter, Ctrl+X)
4. Flush DNS cache:
   ```bash
   # For systemd
   sudo systemd-resolve --flush-caches
   
   # Or restart network service
   sudo service network-manager restart
   ```

After setting up the domain, access the application at: 
- **HTTP**: `http://sitemapperpro.local.se`
- **HTTPS**: `https://sitemapperpro.local.se` (requires SSL certificate)

### SSL/HTTPS Configuration

#### Generate Self-Signed Certificate (for local development):

```bash
./generate-ssl-cert.sh
```

This creates a self-signed certificate valid for 365 days. Your browser will show a security warning - this is normal for self-signed certificates. Click "Advanced" and "Proceed to sitemapperpro.local.se" to continue.

#### For Production (with Let's Encrypt):

For production deployments with a real domain, you can use Certbot or another ACME client to get free SSL certificates from Let's Encrypt.

### Using the Web Interface

1. Open `https://sitemapperpro.local.se` (or `http://localhost:3001`) in your browser
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
- **Containerization**: Docker & Docker Compose

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

## Docker Configuration

### Environment Variables

The Docker setup supports the following environment variables:

- `PORT` - Server port (default: 3001)
- `NODE_ENV` - Environment mode (default: production)

### Docker Commands

```bash
# Build the image
docker-compose build

# Start in detached mode
docker-compose up -d

# Stop and remove containers
docker-compose down

# View logs
docker-compose logs -f sitemapper

# Access container shell
docker exec -it sitemapper-pro sh

# Remove all data and rebuild
docker-compose down -v
docker-compose build --no-cache
docker-compose up -d
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

### Docker Issues

If the Docker container fails to start:

```bash
# Check container logs
docker-compose logs sitemapper

# Rebuild the image
docker-compose build --no-cache

# Check container status
docker ps -a
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
