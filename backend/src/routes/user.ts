import { Router, Response } from 'express';
import { pool } from '../db';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /user/me — current user profile
router.get('/me', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await pool.query(
      'SELECT id, email, daily_calorie_goal, created_at FROM users WHERE id = $1',
      [req.userId],
    );
    if (result.rowCount === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json(result.rows[0]);
  } catch {
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

// PUT /user/goal — update daily calorie goal
router.put('/goal', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const { daily_calorie_goal } = req.body as { daily_calorie_goal?: number };

  const goal = Number(daily_calorie_goal);
  if (!goal || goal < 100 || goal > 99999) {
    res.status(400).json({ error: 'daily_calorie_goal must be between 100 and 99999' });
    return;
  }

  try {
    const result = await pool.query(
      `UPDATE users
       SET daily_calorie_goal = $1
       WHERE id = $2
       RETURNING id, email, daily_calorie_goal`,
      [Math.round(goal), req.userId],
    );
    res.json(result.rows[0]);
  } catch {
    res.status(500).json({ error: 'Failed to update calorie goal' });
  }
});

export default router;
