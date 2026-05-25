
import { Router } from 'express';
import productRouter from './product.routes';
import clientRouter from './client.routes';
import categoryRouter from './category.routes';
import saleRouter from './sale.routes';
import userRouter from './user.routes';
import chatRouter from './chat.routes';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.use('/products', authMiddleware, productRouter);
router.use('/clients', authMiddleware, clientRouter);
router.use('/categories', authMiddleware, categoryRouter);
router.use('/sales', authMiddleware, saleRouter);
router.use('/users', authMiddleware, userRouter);
router.use('/chat', authMiddleware, chatRouter);

export default router;
