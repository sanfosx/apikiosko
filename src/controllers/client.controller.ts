import { Request, Response, NextFunction } from 'express';
import { db } from '../config/firebase';

export const getAllClients = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    res.set('Cache-Control', 'public, max-age=120');

    let query = db.collection('clients').orderBy('name').limit(limit);

    if (req.query.startAfter) {
      const lastDoc = await db.collection('clients').doc(req.query.startAfter as string).get();
      if (lastDoc.exists) {
        query = query.startAfter(lastDoc);
      }
    }

    const snapshot = await query.get();
    const clients = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(clients);
  } catch (error) {
    next(error);
  }
};

export const getClientById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const doc = await db.collection('clients').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Client not found' });
    res.json({ id: doc.id, ...doc.data() });
  } catch (error) {
    next(error);
  }
};

export const createClient = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const newClient = req.body;
    const docRef = await db.collection('clients').add(newClient);
    res.status(201).json({ id: docRef.id, ...newClient });
  } catch (error) {
    next(error);
  }
};

export const updateClient = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const clientRef = db.collection('clients').doc(req.params.id);
    await clientRef.update(req.body);
    const updatedDoc = await clientRef.get();
    res.json({ id: updatedDoc.id, ...updatedDoc.data() });
  } catch (error) {
    next(error);
  }
};

export const deleteClient = async (req: Request, res: Response, next: NextFunction) => {
  try {
     const clientRef = db.collection('clients').doc(req.params.id);
    if (!(await clientRef.get()).exists) {
         return res.status(404).json({ error: 'Client not found' });
    }
    await clientRef.delete();
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
