import { AuthRequest } from '../middleware/auth.middleware';
import { Response } from 'express';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const generateContent = async (req: AuthRequest, res: Response) => {
    try {
        const { contents, config } = req.body;
        
        if (!process.env.GEMINI_API_KEY) {
             return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server.' });
        }

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents,
            config
        });

        res.json(response);
    } catch (error: any) {
        console.error('Error generating content in proxy:', error);
        res.status(500).json({ error: error.message });
    }
};
