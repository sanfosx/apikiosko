import { Router } from 'express';
import {
  getAllSales,
  getSaleById,
  createSale,
  cancelSale,
} from '../controllers/sale.controller';

const router = Router();

router.get('/', getAllSales);
router.get('/:id', getSaleById);
router.post('/', createSale);
router.patch('/:id/cancel', cancelSale);

export default router;
