
import { Request, Response } from 'express';
import { db } from '../config/firebase';
import { FieldValue } from 'firebase-admin/firestore';
import { AuthRequest } from '../middleware/auth.middleware';

export const getAllProducts = async (req: Request, res: Response) => {
  try {
    const snapshot = await db.collection('products').orderBy('name').get();
    const products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(products);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
};

export const getProductById = async (req: Request, res: Response) => {
  try {
    const doc = await db.collection('products').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Product not found' });
    res.json({ id: doc.id, ...doc.data() });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
};

export const createProduct = async (req: AuthRequest, res: Response) => {
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
    console.error("Create Product Error:", error);
    res.status(500).json({ error: error.message || 'Failed to create product' });
  }
};

export const updateProduct = async (req: AuthRequest, res: Response) => {
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
    console.error("Update Product Error:", error);
    res.status(500).json({ error: error.message || 'Failed to update product' });
  }
};

export const deleteProduct = async (req: Request, res: Response) => {
  try {
    const productRef = db.collection('products').doc(req.params.id);
    if (!(await productRef.get()).exists) {
         return res.status(404).json({ error: 'Product not found' });
    }
    await productRef.delete();
    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete product' });
  }
};
