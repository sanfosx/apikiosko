import { Router } from 'express';
import { generateContent } from '../controllers/chat.controller';

const router = Router();

router.post('/generate', generateContent);

export default router;
