
import { Request, Response } from 'express';
import { db } from '../config/firebase';
import { FieldValue } from 'firebase-admin/firestore';
import { AuthRequest } from '../middleware/auth.middleware';

export const getAllSales = async (req: Request, res: Response) => {
  try {
    const snapshot = await db.collection('sales').orderBy('date', 'desc').get();
    const sales = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(sales);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch sales' });
  }
};

export const getSaleById = async (req: Request, res: Response) => {
  try {
    const doc = await db.collection('sales').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Sale not found' });
    res.json({ id: doc.id, ...doc.data() });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch sale' });
  }
};

export const createSale = async (req: AuthRequest, res: Response) => {
  const { items, clientId, clientName, paymentMethod, discount } = req.body;
  const sellerId = req.user?.uid; // From Auth Middleware

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Sale must contain at least one item' });
  }
  
  try {
    const subtotal = items.reduce((acc: number, item: any) => acc + item.price * item.quantity, 0);
    const discountAmount = discount || 0;
    const total = Math.max(0, subtotal - discountAmount);

    const saleRef = db.collection('sales').doc();
    
    await db.runTransaction(async (transaction) => {
      // 1. READ PHASE: Collect all references and read them in parallel
      // We need to resolve combos into their constituent products
      const productsToDeduct = new Map<string, { quantity: number, name: string }>();

      // First pass: Resolve items to single products
      for (const item of items) {
          const productRef = db.collection('products').doc(item.productId);
          const productDoc = await transaction.get(productRef); // We need to read to know the type
          
          if (!productDoc.exists) {
              throw new Error(`Product "${item.name}" (ID: ${item.productId}) not found.`);
          }
          
          const productData = productDoc.data() as any;
          
          if (productData.type === 'combo' && productData.comboItems) {
              for (const comboItem of productData.comboItems) {
                  const current = productsToDeduct.get(comboItem.productId) || { quantity: 0, name: comboItem.name };
                  productsToDeduct.set(comboItem.productId, { 
                      quantity: current.quantity + (comboItem.quantity * item.quantity),
                      name: comboItem.name
                  });
              }
              // Also deduct the combo product itself
              const currentSelf = productsToDeduct.get(item.productId) || { quantity: 0, name: item.name };
              productsToDeduct.set(item.productId, {
                  quantity: currentSelf.quantity + item.quantity,
                  name: item.name
              });
          } else {
              const current = productsToDeduct.get(item.productId) || { quantity: 0, name: item.name };
              productsToDeduct.set(item.productId, { 
                  quantity: current.quantity + item.quantity,
                  name: item.name
              });
          }
      }

      // Second pass: Check stock and prepare updates for all resolved single products
      const updates: { ref: any; newStock: number; quantitySold: number; name: string; costPrice: number; price: number }[] = [];
      
      for (const [productId, { quantity, name }] of productsToDeduct.entries()) {
          const productRef = db.collection('products').doc(productId);
          const productDoc = await transaction.get(productRef);
          
          if (!productDoc.exists) {
               throw new Error(`Component product "${name}" (ID: ${productId}) not found.`);
          }
          
          const data = productDoc.data() as any;
          if (data.stock < quantity) {
              throw new Error(`Insufficient stock for product: ${data.name}. Available: ${data.stock}, Required: ${quantity}`);
          }
          
          updates.push({
              ref: productRef,
              newStock: data.stock - quantity,
              quantitySold: quantity,
              name: data.name,
              costPrice: data.costPrice,
              price: data.price
          });
      }
      
      // 2. WRITE PHASE: Perform all updates and creates
      updates.forEach(({ ref, newStock, quantitySold, costPrice, price }) => {
        const newStockHistoryEntry = {
          date: new Date().toISOString(),
          type: 'sale',
          quantityChange: -quantitySold,
          newStock: newStock,
          reason: `Sale #${saleRef.id.slice(0, 8)}...`,
          userId: sellerId || 'unknown', // Track stock change by user
          costPrice: costPrice || 0,
          price: price || 0
        };
        
        transaction.update(ref, {
          stock: newStock,
          stockHistory: FieldValue.arrayUnion(newStockHistoryEntry)
        });
      });

      transaction.set(saleRef, {
        subtotal,
        discount: discountAmount,
        total,
        paymentMethod,
        clientId: clientId || null,
        clientName: clientName || null,
        sellerId: sellerId || null, // Track seller
        status: 'completed',
        date: new Date().toISOString(),
        items,
      });
    });

    const createdSaleDoc = await saleRef.get();
    res.status(201).json({ id: createdSaleDoc.id, ...createdSaleDoc.data() });
  } catch (error: any) {
    console.error("Transaction Error:", error);
    res.status(500).json({ error: error.message || 'Failed to create sale' });
  }
};

export const cancelSale = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.user?.uid;

  try {
    const saleRef = db.collection('sales').doc(id);
    
    const result = await db.runTransaction(async (transaction) => {
      // 1. READ PHASE
      const saleDoc = await transaction.get(saleRef);
      if (!saleDoc.exists) throw new Error('Sale not found');
      
      const saleToCancel = saleDoc.data()!;
      if (saleToCancel.status === 'cancelled') throw new Error('Sale is already cancelled');

      const items = saleToCancel.items || [];
      const productRefs = items.map((item: any) => db.collection('products').doc(item.productId));
      
      // Read all associated products
      const productSnapshots = await transaction.getAll(...productRefs);
      
      const productRestorations: { ref: any; newStock: number; quantityReturned: number; costPrice: number; price: number }[] = [];

      productSnapshots.forEach((doc, index) => {
        if (doc.exists) {
            const data = doc.data() as any;
            const item = items[index];
            productRestorations.push({
                ref: doc.ref,
                newStock: data.stock + item.quantity,
                quantityReturned: item.quantity,
                costPrice: data.costPrice,
                price: data.price
            });
        }
      });

      // 2. WRITE PHASE
      transaction.update(saleRef, { status: 'cancelled' });

      // Add cancellation to activity logs
      const logRef = db.collection('activity_logs').doc();
      transaction.set(logRef, {
          date: new Date().toISOString(),
          userId: userId || 'unknown',
          actionType: 'sale_cancellation',
          description: `Sale #${id.slice(0, 8)}... was cancelled.`,
          details: { saleId: id }
      });

      productRestorations.forEach(({ ref, newStock, quantityReturned, costPrice, price }) => {
        const newStockHistoryEntry = {
          date: new Date().toISOString(),
          type: 'cancellation',
          quantityChange: quantityReturned,
          newStock: newStock,
          reason: `Cancellation for Sale #${id.slice(0, 8)}...`,
          userId: userId || 'unknown', // Track cancellation by user
          costPrice: costPrice || 0,
          price: price || 0
        };

        transaction.update(ref, {
            stock: newStock,
            stockHistory: FieldValue.arrayUnion(newStockHistoryEntry)
        });
      });
      
      return { id: saleDoc.id, ...saleToCancel, status: 'cancelled' };
    });
    
    res.json(result);
  } catch (error: any) {
    console.error("Cancellation Error:", error);
    res.status(500).json({ error: error.message || 'Failed to cancel sale' });
  }
};
