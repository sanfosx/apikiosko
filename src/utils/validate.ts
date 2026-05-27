import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodError } from 'zod';
import { logger } from './logger';

export const validateRequest = (schema: AnyZodObject) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        logger.warn({ err: error, body: req.body }, 'Input validation failed');
        return res.status(400).json({
          message: 'Invalid request data',
          errors: error.errors.map(e => ({
              path: e.path.join('.'),
              message: e.message
          }))
        });
      }
      next(error);
    }
  };
};
