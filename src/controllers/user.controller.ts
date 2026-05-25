
import { Request, Response } from 'express';
import { db, auth } from '../config/firebase';

export const getAllUsers = async (req: Request, res: Response) => {
  try {
    const snapshot = await db.collection('users').orderBy('name').get();
    const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    (res as any).json(users);
  } catch (error) {
    console.error(error);
    (res as any).status(500).json({ error: 'Failed to fetch users' });
  }
};

export const getUserById = async (req: Request, res: Response) => {
  try {
    const doc = await db.collection('users').doc((req as any).params.id).get();
    if (!doc.exists) return (res as any).status(404).json({ error: 'User not found' });
    (res as any).json({ id: doc.id, ...doc.data() });
  } catch (error) {
    console.error(error);
    (res as any).status(500).json({ error: 'Failed to fetch user' });
  }
};

export const createUser = async (req: Request, res: Response) => {
  const { email, password, name, phone, role } = (req as any).body;

  if (!email || !password || !name) {
      return (res as any).status(400).json({ error: 'Email, password and name are required.' });
  }

  try {
    // 1. Create user in Firebase Authentication
    const userRecord = await auth.createUser({
        email,
        password,
        displayName: name,
        disabled: false
    });

    // 2. Create user record in Firestore
    const userData = {
        name,
        email,
        phone: phone || '',
        role: role || 'salesperson',
        isActive: true,
        createdAt: new Date().toISOString()
    };
    
    await db.collection('users').doc(userRecord.uid).set(userData);

    (res as any).status(201).json({ id: userRecord.uid, ...userData });
  } catch (error: any) {
    console.error("Error creating user:", error);
    (res as any).status(500).json({ error: error.message || 'Failed to create user' });
  }
};

export const updateUser = async (req: Request, res: Response) => {
  const { id } = (req as any).params;
  const { name, phone, role, isActive } = (req as any).body;
  
  try {
    const userRef = db.collection('users').doc(id);
    const doc = await userRef.get();
    
    if (!doc.exists) {
        return (res as any).status(404).json({ error: 'User not found' });
    }

    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (phone !== undefined) updates.phone = phone;
    if (role !== undefined) updates.role = role;
    if (isActive !== undefined) updates.isActive = isActive;

    await userRef.update(updates);
    
    // Also update Auth profile if critical fields changed
    if (name || isActive !== undefined) {
        const authUpdates: any = {};
        if (name) authUpdates.displayName = name;
        if (isActive !== undefined) authUpdates.disabled = !isActive;
        
        try {
            await auth.updateUser(id, authUpdates);
        } catch (authErr) {
            console.error(`Failed to update auth profile for user ${id}`, authErr);
            // Continue execution, as DB update succeeded
        }
    }

    const updatedDoc = await userRef.get();
    (res as any).json({ id: updatedDoc.id, ...updatedDoc.data() });
  } catch (error) {
    console.error(error);
    (res as any).status(500).json({ error: 'Failed to update user' });
  }
};

export const deleteUser = async (req: Request, res: Response) => {
  const { id } = (req as any).params;
  try {
    // 1. Delete from Auth
    try {
        await auth.deleteUser(id);
    } catch (e: any) {
        if (e.code === 'auth/user-not-found') {
            console.warn(`User ${id} not found in Auth, proceeding to delete from DB`);
        } else {
            throw e;
        }
    }

    // 2. Delete from Firestore
    await db.collection('users').doc(id).delete();
    
    (res as any).status(204).send();
  } catch (error: any) {
    console.error(error);
    (res as any).status(500).json({ error: error.message || 'Failed to delete user' });
  }
};
