import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

export const api = axios.create({ baseURL: BASE_URL });

export interface User {
  id: number;
  email: string;
  daily_calorie_goal: number;
}

export interface FoodLog {
  id: number;
  user_id: number;
  food_name: string;
  calories: number;
  serving_description: string | null;
  logged_at: string;
}

export interface FoodItem {
  food_name: string;
  calories: number;
  serving_description: string;
}

export interface AnalysisResult {
  items: FoodItem[];
  total_calories: number;
}

// User
export const getMe = () => api.get<User>('/user/me');

// Food
export const analyseFood = (file: File) => {
  const form = new FormData();
  form.append('image', file);
  return api.post<AnalysisResult>('/food/analyse', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

export const logFood = (food_name: string, calories: number, serving_description?: string) =>
  api.post<FoodLog>('/food/log', { food_name, calories, serving_description });

export const getTodayLogs = () => api.get<FoodLog[]>('/food/log');

export const deleteLog = (id: number) => api.delete(`/food/log/${id}`);

export const updateGoal = (daily_calorie_goal: number) =>
  api.put<User>('/user/goal', { daily_calorie_goal });
