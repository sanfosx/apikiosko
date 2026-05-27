
import { Request, Response, NextFunction } from 'express';
import { db } from '../config/firebase';
import { FieldValue } from 'firebase-admin/firestore';
import { AuthRequest } from '../middleware/auth.middleware';

export const getAllProducts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    
    // Configurar Cache-Control
    res.set('Cache-Control', 'public, max-age=300');

    let query = db.collection('products').orderBy('name').limit(limit);

    if (req.query.startAfter) {
      const lastDoc = await db.collection('products').doc(req.query.startAfter as string).get();
      if (lastDoc.exists) {
        query = query.startAfter(lastDoc);
      }
    }

    const snapshot = await query.get();
    const products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(products);
  } catch (error) {
    next(error);
  }
};

export const getProductById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const doc = await db.collection('products').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Product not found' });
    res.set('Cache-Control', 'public, max-age=60');
    res.json({ id: doc.id, ...doc.data() });
  } catch (error) {
    next(error);
  }
};

export const createProduct = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { 
    barcode, name, price, costPrice, stock, categoryId,
    promotionPrice, promotionEndDate, promotionDescription,
    type, comboItems
  } = req.body;
  const userId = req.user?.uid;

  try {
    const newProduct: any = {
      barcode,
      name,
      price,
      costPrice: costPrice || 0,
      stock: stock || 0,
      categoryId,
      type: type || 'single',
      stockHistory: [{
          date: new Date().toISOString(),
          type: 'initial',
          quantityChange: stock || 0,
          newStock: stock || 0,
          reason: 'Product created',
          userId: userId || 'unknown',
          costPrice: costPrice || 0,
          price: price || 0
      }]
    };

    if (promotionPrice !== undefined) newProduct.promotionPrice = promotionPrice;
    if (promotionEndDate) newProduct.promotionEndDate = promotionEndDate;
    if (promotionDescription) newProduct.promotionDescription = promotionDescription;
    if (comboItems) newProduct.comboItems = comboItems;

    // Filter out undefined fields to prevent Firestore errors
    Object.keys(newProduct).forEach(key => {
        if (newProduct[key] === undefined) {
            delete newProduct[key];
        }
    });

    const docRef = await db.collection('products').add(newProduct);
    res.status(201).json({ id: docRef.id, ...newProduct });
  } catch (error: any) {
    next(error);
  }
};

export const updateProduct = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { id } = req.params;
  const { 
    barcode, name, price, costPrice, stock, categoryId, reason, actionType,
    promotionPrice, promotionEndDate, promotionDescription,
    type, comboItems
  } = req.body;

  const userId = req.user?.uid;

  try {
    const productRef = db.collection('products').doc(id);
    const doc = await productRef.get();
    if (!doc.exists) return res.status(404).json({ error: 'Product not found' });

    const existingProduct = doc.data()!;

    const updates: any = { 
        barcode, name, price, stock, categoryId,
        type: type || 'single',
    };
    
    if (costPrice !== undefined) updates.costPrice = costPrice;
    if (promotionPrice !== undefined) updates.promotionPrice = promotionPrice;
    if (promotionEndDate !== undefined) updates.promotionEndDate = promotionEndDate;
    if (promotionDescription !== undefined) updates.promotionDescription = promotionDescription;
    if (comboItems !== undefined) updates.comboItems = comboItems;

    // Filter out undefined fields to prevent Firestore errors
    Object.keys(updates).forEach(key => {
        if (updates[key] === undefined) {
            delete updates[key];
        }
    });

    await productRef.update(updates);
    
    if (existingProduct.stock !== stock) {
        const historyType = actionType === 'add' ? 'add' : 'adjustment';
        const newStockHistoryEntry = {
            date: new Date().toISOString(),
            type: historyType,
            quantityChange: stock - existingProduct.stock,
            newStock: stock,
            reason: reason || 'Manual update',
            userId: userId || 'unknown',
            costPrice: costPrice !== undefined ? costPrice : (existingProduct.costPrice || 0),
            price: price !== undefined ? price : (existingProduct.price || 0)
        };
        await productRef.update({
            stockHistory: FieldValue.arrayUnion(newStockHistoryEntry)
        });
    }
    
    const updatedDoc = await productRef.get();
    res.json({ id: updatedDoc.id, ...updatedDoc.data() });
  } catch (error: any) {
    next(error);
  }
};

export const deleteProduct = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const productRef = db.collection('products').doc(req.params.id);
    if (!(await productRef.get()).exists) {
         return res.status(404).json({ error: 'Product not found' });
    }
    await productRef.delete();
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
