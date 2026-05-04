import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import foodRoutes from './routes/food';
import userRoutes from './routes/user';

dotenv.config();

const app = express();

app.use(helmet());
const allowedOrigins = process.env.NODE_ENV === 'production'
  ? [process.env.FRONTEND_URL ?? '']
  : [/^http:\/\/localhost:\d+$/];   // allow any localhost port in dev

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  }),
);
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/auth', authRoutes);
app.use('/food', foodRoutes);
app.use('/user', userRoutes);

export default app;
