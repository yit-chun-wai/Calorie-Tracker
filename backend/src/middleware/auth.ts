import { Request, Response, NextFunction } from 'express';
import { getDefaultUserId } from '../default-user';

export interface AuthRequest extends Request {
  userId?: number;
}

export async function authenticate(req: AuthRequest, _res: Response, next: NextFunction): Promise<void> {
  req.userId = await getDefaultUserId();
  next();
}
