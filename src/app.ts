import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import mainRouter from './routes/index'; 
import './config/firebase'; // Initializes Firebase Admin
import { logger } from './utils/logger';

dotenv.config();

const app = express();
const port = process.env.PORT || 8080;

app.use(helmet() as any);
app.use(compression() as any);

const allowedOrigins = [
  '*',
  'https://apikiosko.vercel.app',
  'https://online-all-24-05-2026.vercel.app',
  'https://kioskapp-nu.vercel.app/'
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:3001'
];

app.use(cors({ 
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }, 
  credentials: true 
}) as any);
app.use(express.json() as any);

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // Limita a 100 peticiones por IP por ventana
  message: 'Demasiadas peticiones desde esta IP, por favor intente de nuevo más tarde.'
});

// Debug logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
    logger.info({ method: req.method, url: req.url }, 'Incoming request');
    next();
});

// Health check endpoint to verify server status
app.get('/health', (req: Request, res: Response) => {
    (res as any).status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Root endpoint to verify server status
app.get('/', (req: Request, res: Response) => {
    (res as any).status(200).json({ status: 'OnlineAll API Server Running', timestamp: new Date().toISOString() });
});

// ROUTING FIX:
// 1. Support requests that include '/api' (Standard local setup: http://localhost:3001/api/products)
app.use('/api', apiLimiter as any, mainRouter);

// 2. Support requests where the '/api' prefix is stripped by Vercel's rewrite engine
//    (Common in serverless deployments where /api/products -> index.ts -> app receives /products)
app.use('/', apiLimiter as any, mainRouter);

// 404 Handler for unhandled routes - Helps debugging by returning JSON instead of HTML
app.use((req: Request, res: Response) => {
    logger.warn({ method: req.method, url: req.url }, 'Route not found');
    (res as any).status(404).json({ 
        error: 'Not Found', 
        path: req.path,
        message: 'The requested API endpoint does not exist.' 
    });
});

// Centralized error handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    logger.error({ 
      message: err.message, 
      stack: err.stack, 
      path: req.path 
    });
    
    (res as any).status(err.status || 500).json({
        success: false,
        message: process.env.NODE_ENV === 'production' ? 'Error interno del servidor' : err.message
    });
});

export default app;
