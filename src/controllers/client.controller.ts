import { Request, Response } from 'express';
import { db } from '../config/firebase';

export const getAllClients = async (req: Request, res: Response) => {
  try {
    const snapshot = await db.collection('clients').orderBy('name').get();
    const clients = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(clients);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch clients' });
  }
};

export const getClientById = async (req: Request, res: Response) => {
  try {
    const doc = await db.collection('clients').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Client not found' });
    res.json({ id: doc.id, ...doc.data() });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch client' });
  }
};

export const createClient = async (req: Request, res: Response) => {
  try {
    const newClient = req.body;
    const docRef = await db.collection('clients').add(newClient);
    res.status(201).json({ id: docRef.id, ...newClient });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create client' });
  }
};

export const updateClient = async (req: Request, res: Response) => {
  try {
    const clientRef = db.collection('clients').doc(req.params.id);
    await clientRef.update(req.body);
    const updatedDoc = await clientRef.get();
    res.json({ id: updatedDoc.id, ...updatedDoc.data() });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update client' });
  }
};

export const deleteClient = async (req: Request, res: Response) => {
  try {
     const clientRef = db.collection('clients').doc(req.params.id);
    if (!(await clientRef.get()).exists) {
         return res.status(404).json({ error: 'Client not found' });
    }
    await clientRef.delete();
    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete client' });
  }
};