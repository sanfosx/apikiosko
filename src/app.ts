import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mainRouter from './routes/index'; 
import './config/firebase'; // Initializes Firebase Admin

dotenv.config();

const app = express();
const port = process.env.PORT || 8080;

// Enable CORS for all origins to prevent browser blocking during dev/prod mismatches
app.use(cors({ origin: true, credentials: true }) as any);
app.use(express.json() as any);

// Debug logging middleware to trace 404 issues
app.use((req: Request, res: Response, next: NextFunction) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// Health check endpoint to verify server status
app.get('/health', (req: Request, res: Response) => {
    (res as any).status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ROUTING FIX:
// 1. Support requests that include '/api' (Standard local setup: http://localhost:3001/api/products)
app.use('/api', mainRouter);

// 2. Support requests where the '/api' prefix is stripped by Vercel's rewrite engine
//    (Common in serverless deployments where /api/products -> index.ts -> app receives /products)
app.use('/', mainRouter);

// 404 Handler for unhandled routes - Helps debugging by returning JSON instead of HTML
app.use((req: Request, res: Response) => {
    console.warn(`[404] Route not found: ${req.method} ${req.url}`);
    (res as any).status(404).json({ 
        error: 'Not Found', 
        path: req.path,
        message: 'The requested API endpoint does not exist.' 
    });
});

export default app;