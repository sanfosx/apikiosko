import { Request, Response } from 'express';
import { db } from '../config/firebase';

export const getAllCategories = async (req: Request, res: Response) => {
  try {
    const snapshot = await db.collection('categories').orderBy('name').get();
    const categories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(categories);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
};

export const getCategoryById = async (req: Request, res: Response) => {
  try {
    const doc = await db.collection('categories').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Category not found' });
    res.json({ id: doc.id, ...doc.data() });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch category' });
  }
};

export const createCategory = async (req: Request, res: Response) => {
  try {
    const newCategory = req.body;
    const docRef = await db.collection('categories').add(newCategory);
    res.status(201).json({ id: docRef.id, ...newCategory });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create category' });
  }
};

export const updateCategory = async (req: Request, res: Response) => {
  try {
    const categoryRef = db.collection('categories').doc(req.params.id);
    await categoryRef.update(req.body);
    const updatedDoc = await categoryRef.get();
    res.json({ id: updatedDoc.id, ...updatedDoc.data() });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update category' });
  }
};

export const deleteCategory = async (req: Request, res: Response) => {
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
    console.error(error);
    res.status(500).json({ error: 'Failed to delete category' });
  }
};