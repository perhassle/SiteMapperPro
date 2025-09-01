const express = require('express');
const { Server } = require('socket.io');
const http = require('http');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');
const { SiteMapExtractor } = require('./site-map-extractor');
const { URLStructureExtractor } = require('./url-structure-extractor');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use('/extractions', express.static('extractions'));

const extractionJobs = new Map();

class ExtractorService extends URLStructureExtractor {
    constructor(baseUrl, maxDepth, jobId, socket) {
        super(baseUrl, maxDepth);
        this.jobId = jobId;
        this.socket = socket;
        this.browser = null;
        this.progress = {
            total: 0,
            completed: 0,
            current: '',
            status: 'initializing'
        };
    }

    updateProgress(message, percentage = null) {
        if (percentage !== null) {
            this.progress.percentage = Math.min(Math.max(percentage, 0), 100);
        } else if (this.progress.total > 0) {
            this.progress.percentage = Math.round((this.progress.completed / this.progress.total) * 100);
        }
        
        this.progress.current = message;
        
        this.socket.emit('progress', {
            jobId: this.jobId,
            percentage: this.progress.percentage,
            current: this.progress.current,
            status: this.progress.status
        });
    }

    async crawlPage(context, url, depth) {
        // Don't override, let parent handle progress
        return super.crawlPage(context, url, depth);
    }

    async extract() {
        this.updateProgress('Starting extraction...', false);
        this.progress.status = 'running';
        
        try {
            await super.extract();
            this.progress.status = 'completed';
            this.updateProgress('Extraction completed!', false);
            
            return {
                jobId: this.jobId,
                status: 'completed',
                outputDir: this.outputDir,
                totalPages: this.visitedUrls.size,
                timestamp: this.timestamp
            };
        } catch (error) {
            this.progress.status = 'failed';
            this.updateProgress(`Error: ${error.message}`, false);
            throw error;
        }
    }
}

app.delete('/api/jobs/:id', async (req, res) => {
    try {
        const jobId = req.params.id;
        const jobPath = path.join(__dirname, 'extractions', jobId);
        
        // Check if directory exists
        try {
            await fs.access(jobPath);
        } catch {
            return res.status(404).json({ error: 'Job not found' });
        }
        
        // Remove directory and all contents
        await fs.rm(jobPath, { recursive: true, force: true });
        
        res.json({ success: true, message: 'Job deleted successfully' });
    } catch (error) {
        console.error('Error deleting job:', error);
        res.status(500).json({ error: 'Failed to delete job' });
    }
});

app.get('/api/jobs', async (req, res) => {
    try {
        const extractionsDir = path.join(__dirname, 'extractions');
        const dirs = await fs.readdir(extractionsDir);
        
        const jobs = await Promise.all(dirs.map(async (dir) => {
            // Try both new format (index.json) and old format (structure.json)
            const indexPath = path.join(extractionsDir, dir, 'index.json');
            const structurePath = path.join(extractionsDir, dir, 'structure.json');
            const urlStructurePath = path.join(extractionsDir, dir, 'url-structure.html');
            const oldSitemapPath = path.join(extractionsDir, dir, 'sitemap.html');
            
            try {
                let indexData;
                let jsonPath;
                
                // Try index.json first (new format)
                try {
                    indexData = await fs.readFile(indexPath, 'utf8');
                    jsonPath = `/extractions/${dir}/index.json`;
                } catch {
                    // Fall back to structure.json (old format)
                    indexData = await fs.readFile(structurePath, 'utf8');
                    jsonPath = `/extractions/${dir}/structure.json`;
                }
                
                const index = JSON.parse(indexData);
                
                // Determine which HTML file exists
                let sitemapUrl;
                try {
                    await fs.access(urlStructurePath);
                    sitemapUrl = `/extractions/${dir}/url-structure.html`;
                } catch {
                    sitemapUrl = `/extractions/${dir}/sitemap.html`;
                }
                
                return {
                    id: dir,
                    timestamp: dir,
                    baseUrl: index.baseUrl,
                    totalPages: index.totalPages || index.totalUrls || index.urls?.length || 0,
                    extractionDate: index.timestamp,
                    sitemapUrl: sitemapUrl,
                    indexUrl: jsonPath
                };
            } catch {
                return null;
            }
        }));
        
        const validJobs = jobs.filter(job => job !== null)
            .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
        
        res.json(validJobs);
    } catch (error) {
        console.error('Error fetching jobs:', error);
        res.json([]);
    }
});

app.post('/api/extract', async (req, res) => {
    const { url, depth = 2 } = req.body;
    
    if (!url) {
        return res.status(400).json({ error: 'URL is required' });
    }
    
    const jobId = uuidv4();
    
    res.json({ 
        jobId, 
        status: 'started',
        message: 'Extraction started. Connect via WebSocket for progress updates.'
    });
});

io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    
    socket.on('start-extraction', async (data) => {
        const { url, depth = 2, jobId } = data;
        
        if (!url) {
            socket.emit('error', { message: 'URL is required' });
            return;
        }
        
        try {
            const extractor = new ExtractorService(url, depth, jobId, socket);
            extractionJobs.set(jobId, extractor);
            
            const result = await extractor.extract();
            
            socket.emit('complete', {
                jobId,
                ...result,
                sitemapUrl: `/extractions/${result.timestamp}/url-structure.html`,
                indexUrl: `/extractions/${result.timestamp}/index.json`
            });
            
            extractionJobs.delete(jobId);
        } catch (error) {
            console.error('Extraction error:', error);
            socket.emit('error', {
                jobId,
                message: error.message
            });
            extractionJobs.delete(jobId);
        }
    });
    
    socket.on('stop-extraction', async (data) => {
        const { jobId } = data;
        
        if (extractionJobs.has(jobId)) {
            const extractor = extractionJobs.get(jobId);
            
            try {
                // Stop the extraction
                if (extractor.browser) {
                    await extractor.browser.close();
                }
                
                // Delete the extraction folder
                const extractionPath = path.join(__dirname, 'extractions', extractor.timestamp);
                await fs.rm(extractionPath, { recursive: true, force: true });
                console.log(`Deleted extraction folder: ${extractionPath}`);
                
                // Remove from jobs map
                extractionJobs.delete(jobId);
                
                // Notify client
                socket.emit('stopped', { jobId });
                console.log(`Extraction ${jobId} stopped and cleaned up`);
            } catch (error) {
                console.error('Error stopping extraction:', error);
                socket.emit('error', {
                    jobId,
                    message: 'Failed to stop extraction cleanly'
                });
            }
        }
    });
    
    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📊 Open in browser to use the site map extractor service`);
});