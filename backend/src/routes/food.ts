import { Router, Response } from 'express';
import multer from 'multer';
import OpenAI from 'openai';
import { pool } from '../db';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

// OpenRouter client — drop-in OpenAI-compatible API
const openrouter = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    'HTTP-Referer': process.env.FRONTEND_URL ?? 'http://localhost:5173',
    'X-Title': 'CalorieAI',
  },
});

// Verify this ID matches exactly what you see on openrouter.ai/models
const MODEL = 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free';

const SYSTEM_PROMPT =
  'From the picture, identify each food item you see. ' +
  'Use the background/setting as a hint to infer the cuisine or origin of the food. ' +
  'Then estimate the calories per item assuming a standard adult single serving. ' +
  'Present the results as each food item with its estimated calories, followed by a total. ' +
  'Return ONLY a raw JSON object — no markdown fences, no explanation, no extra text — with exactly this structure: ' +
  '{"items": [{"food_name": "<item name>", "calories": <integer>, "serving_description": "<e.g. 1 cup, 1 slice, 1 plate>"}, ...], "total_calories": <sum of all calories as integer>}.';

// POST /food/analyse — send image to OpenRouter vision model, returns food + calories
router.post(
  '/analyse',
  authenticate,
  upload.single('image'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    if (!req.file) {
      res.status(400).json({ error: 'Image file is required' });
      return;
    }

    const base64 = req.file.buffer.toString('base64');
    const dataUrl = `data:${req.file.mimetype};base64,${base64}`;

    try {
      const response = await openrouter.chat.completions.create({
        model: MODEL,
        max_tokens: 1024,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: dataUrl } },
              { type: 'text', text: 'Identify every food and drink item in this image and return the JSON.' },
            ],
          },
        ],
      });

      let text = response.choices[0]?.message?.content?.trim() ?? '';
      console.log('Model raw response:', text);

      // Strip <think>...</think> blocks that reasoning models emit before the answer
      text = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
      text = text.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '').trim();

      // Strip markdown code fences (```json ... ```)
      text = text.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim();

      const jsonMatch = text.match(/\{[\s\S]*\}/);

      // If no JSON found, retry with a simpler prompt to force a best guess
      if (!jsonMatch) {
        console.warn('No JSON in first response, retrying with simplified prompt');
        const retry = await openrouter.chat.completions.create({
          model: MODEL,
          max_tokens: 512,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'image_url', image_url: { url: dataUrl } },
                {
                  type: 'text',
                  text:
                    'Look at this image and make your absolute best guess at what food or drink items are present, even if you are not certain. ' +
                    'Return ONLY this JSON with no other text: ' +
                    '{"items":[{"food_name":"<best guess name>","calories":<integer>,"serving_description":"<e.g. 1 serving>"}],"total_calories":<integer>}',
                },
              ],
            },
          ],
        });
        let retryText = retry.choices[0]?.message?.content?.trim() ?? '';
        retryText = retryText.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim();
        const retryMatch = retryText.match(/\{[\s\S]*\}/);
        if (!retryMatch) {
          res.json({ items: [{ food_name: 'Food item', calories: 200, serving_description: '1 serving — edit me' }], total_calories: 200 });
          return;
        }
        text = retryMatch[0];
      }

      // At this point text holds either the original or retry match
      const finalMatch = text.match(/\{[\s\S]*\}/) ?? [text];

      // Strip control characters that some models emit inside JSON strings
      const sanitized = finalMatch[0].replace(/[\x00-\x1F\x7F]/g, (c) =>
        c === '\n' || c === '\r' || c === '\t' ? ' ' : '',
      );

      let data: { items?: Array<{ food_name: string; calories: number | string; serving_description: string }>; total_calories?: number | string };
      try {
        data = JSON.parse(sanitized);
      } catch {
        console.warn('JSON.parse failed, returning best-guess fallback');
        res.json({ items: [{ food_name: 'Food item', calories: 200, serving_description: '1 serving — edit me' }], total_calories: 200 });
        return;
      }

      const items = (data.items ?? []).map((item) => ({
        food_name: String(item.food_name),
        calories: Math.round(Number(item.calories)),
        serving_description: String(item.serving_description),
      }));

      const total_calories = items.reduce((sum, item) => sum + item.calories, 0);

      res.json({ items, total_calories });
    } catch (err) {
      console.error('OpenRouter API error:', err);
      res.status(500).json({ error: 'Food analysis failed. Please try again.' });
    }
  },
);

// POST /food/log — save a food entry
router.post('/log', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const { food_name, calories, serving_description } = req.body as {
    food_name?: string;
    calories?: number;
    serving_description?: string;
  };

  if (!food_name || calories == null) {
    res.status(400).json({ error: 'food_name and calories are required' });
    return;
  }

  try {
    const result = await pool.query(
      `INSERT INTO food_logs (user_id, food_name, calories, serving_description)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [req.userId, food_name, Math.round(Number(calories)), serving_description ?? null],
    );
    res.status(201).json(result.rows[0]);
  } catch {
    res.status(500).json({ error: 'Failed to log food entry' });
  }
});

// GET /food/log — today's entries for the current user
router.get('/log', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await pool.query(
      `SELECT * FROM food_logs
       WHERE user_id = $1
         AND DATE(logged_at AT TIME ZONE 'UTC') = DATE(NOW() AT TIME ZONE 'UTC')
       ORDER BY logged_at DESC`,
      [req.userId],
    );
    res.json(result.rows);
  } catch {
    res.status(500).json({ error: 'Failed to fetch food logs' });
  }
});

// DELETE /food/log/:id — delete a specific entry (must belong to current user)
router.delete('/log/:id', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: 'Invalid log id' });
    return;
  }
  try {
    const result = await pool.query(
      'DELETE FROM food_logs WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.userId],
    );
    if (result.rowCount === 0) {
      res.status(404).json({ error: 'Log entry not found' });
      return;
    }
    res.json({ deleted: true });
  } catch {
    res.status(500).json({ error: 'Failed to delete log entry' });
  }
});

export default router;
