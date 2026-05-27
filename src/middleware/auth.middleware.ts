import { Request, Response, NextFunction } from 'express';
import { auth } from '../config/firebase';
import { DecodedIdToken } from 'firebase-admin/auth';
import { logger } from '../utils/logger';

export type AuthRequest = Request & {
  user?: DecodedIdToken;
};

export const authMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authentication token required' });
  }

  const token = authHeader.split(' ')[1];

  try {
    // verifyIdToken(token, checkRevoked = true)
    const decodedToken = await auth.verifyIdToken(token, true);
    req.user = decodedToken;
    next();
  } catch (error: any) {
    logger.error({ err: error }, 'Token verification failed');
    if (error.code === 'auth/id-token-revoked') {
      return res.status(401).json({ message: 'Token has been revoked. Please reauthenticate.' });
    }
    if (error.code === 'auth/id-token-expired') {
        return res.status(401).json({ message: 'Token expired.' });
    }
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

// RBAC Middleware generator
export const requireRole = (allowedRoles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    // Note: Assuming custom claims are used, e.g., req.user.role
    // or you can check Firestore if role not in claims. 
    // Here we assume it's in claims as per PDF: "Usa los Custom Claims..."
    const userRole = req.user?.role as string;
    
    // For local dev/admin fallback, or if not strictly using claims yet
    // we would handle the role check:
    if (!userRole && !allowedRoles.includes('any')) {
      // If claims aren't set up yet on frontend, this might block everything.
      // We'll log it and return 403.
      logger.warn(`User ${req.user?.uid} attempted access without a role claim.`);
      return res.status(403).json({ message: 'Access denied: missing role claim' });
    }

    if (allowedRoles.includes('any') || allowedRoles.includes(userRole)) {
      next();
    } else {
      logger.warn(`User ${req.user?.uid} (Role: ${userRole}) denied access.`);
      return res.status(403).json({ message: 'Forbidden: insufficient permissions' });
    }
  };
};
