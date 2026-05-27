import { Request, Response, NextFunction } from 'express';
import { db } from '../config/firebase';

export const getAllCategories = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    res.set('Cache-Control', 'public, max-age=300');

    let query = db.collection('categories').orderBy('name').limit(limit);

    if (req.query.startAfter) {
      const lastDoc = await db.collection('categories').doc(req.query.startAfter as string).get();
      if (lastDoc.exists) {
        query = query.startAfter(lastDoc);
      }
    }

    const snapshot = await query.get();
    const categories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(categories);
  } catch (error) {
    next(error);
  }
};

export const getCategoryById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.set('Cache-Control', 'public, max-age=120');
    const doc = await db.collection('categories').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Category not found' });
    res.json({ id: doc.id, ...doc.data() });
  } catch (error) {
    next(error);
  }
};

export const createCategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const newCategory = req.body;
    const docRef = await db.collection('categories').add(newCategory);
    res.status(201).json({ id: docRef.id, ...newCategory });
  } catch (error) {
    next(error);
  }
};

export const updateCategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const categoryRef = db.collection('categories').doc(req.params.id);
    await categoryRef.update(req.body);
    const updatedDoc = await categoryRef.get();
    res.json({ id: updatedDoc.id, ...updatedDoc.data() });
  } catch (error) {
    next(error);
  }
};

export const deleteCategory = async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  try {
    const productsSnapshot = await db.collection('products').where('categoryId', '==', id).limit(1).get();
    if (!productsSnapshot.empty) {
        return res.status(400).json({ error: 'Cannot delete category with associated products.' });
    }
    
    const categoryRef = db.collection('categories').doc(id);
    if (!(await categoryRef.get()).exists) {
         return res.status(404).json({ error: 'Category not found' });
    }
    
    await categoryRef.delete();
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
