import { useEffect, useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FoodLog, getTodayLogs, deleteLog, updateGoal } from '../api/client';
import { isAxiosError } from 'axios';

function CalorieRing({ consumed, goal }: { consumed: number; goal: number }) {
  const SIZE = 160;
  const STROKE = 14;
  const R = (SIZE - STROKE) / 2;
  const CIRC = 2 * Math.PI * R;
  const pct = Math.min(consumed / goal, 1);
  const dash = pct * CIRC;
  const over = consumed > goal;

  return (
    <div className="ring-wrapper">
      <svg width={SIZE} height={SIZE} style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          fill="none"
          stroke="var(--border)"
          strokeWidth={STROKE}
        />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          fill="none"
          stroke={over ? '#f59e0b' : 'var(--primary)'}
          strokeWidth={STROKE}
          strokeDasharray={`${dash} ${CIRC}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray .5s ease' }}
        />
      </svg>
      <div className="ring-label" style={{ marginTop: '-2rem' }}>
        <div className="calories-num">{consumed.toLocaleString()}</div>
        <div className="calories-sub">
          of <span className="calories-goal">{goal.toLocaleString()} kcal</span>
        </div>
        <div className="calories-sub" style={{ marginTop: '.2rem' }}>
          {consumed >= goal
            ? over
              ? `${(consumed - goal).toLocaleString()} over goal`
              : 'Goal reached!'
            : `${(goal - consumed).toLocaleString()} kcal remaining`}
        </div>
      </div>
    </div>
  );
}

export function Dashboard() {
  const { user, updateUser } = useAuth();
  const [logs, setLogs] = useState<FoodLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [goalInput, setGoalInput] = useState(String(user?.daily_calorie_goal ?? 2000));
  const [goalSaving, setGoalSaving] = useState(false);
  const [goalMsg, setGoalMsg] = useState('');
  const [toast, setToast] = useState('');

  const totalCalories = logs.reduce((s, l) => s + l.calories, 0);

  useEffect(() => {
    getTodayLogs()
      .then((r) => setLogs(r.data))
      .finally(() => setLogsLoading(false));
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteLog(id);
      setLogs((prev) => prev.filter((l) => l.id !== id));
      showToast('Entry removed');
    } catch {
      showToast('Failed to delete entry');
    }
  };

  const handleGoal = async (e: FormEvent) => {
    e.preventDefault();
    const val = parseInt(goalInput, 10);
    if (!val || val < 100) {
      setGoalMsg('Enter a value of at least 100');
      return;
    }
    setGoalSaving(true);
    setGoalMsg('');
    try {
      const { data } = await updateGoal(val);
      updateUser(data);
      setGoalMsg('Goal updated!');
      setTimeout(() => setGoalMsg(''), 2500);
    } catch (err) {
      if (isAxiosError(err)) {
        setGoalMsg(err.response?.data?.error ?? 'Failed to update goal');
      }
    } finally {
      setGoalSaving(false);
    }
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <>
      {/* Progress */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="dashboard-header">
          <h2>Today's Progress</h2>
          <span style={{ fontSize: '.85rem', color: 'var(--text-muted)' }}>
            {new Date().toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}
          </span>
        </div>
        <CalorieRing
          consumed={totalCalories}
          goal={user?.daily_calorie_goal ?? 2000}
        />
      </div>

      {/* Today's log */}
      <div className="card">
        <div className="dashboard-header">
          <h2>Today's Food Log</h2>
          <Link to="/camera" className="btn btn-primary btn-sm">
            + Add Food
          </Link>
        </div>

        {logsLoading ? (
          <div style={{ textAlign: 'center', padding: '1.5rem' }}>
            <span className="spinner spinner-dark" />
          </div>
        ) : logs.length === 0 ? (
          <div className="empty-state">
            <div style={{ fontSize: '2rem' }}>🍽️</div>
            <p>No food logged today yet.<br />Take a photo to get started!</p>
            <Link to="/camera" className="btn btn-primary btn-sm" style={{ marginTop: '1rem', display: 'inline-flex' }}>
              Log your first meal
            </Link>
          </div>
        ) : (
          <div className="food-list">
            {logs.map((log) => (
              <div key={log.id} className="food-item">
                <div className="food-item-info">
                  <div className="food-item-name">{log.food_name}</div>
                  <div className="food-item-meta">
                    {log.serving_description && <span>{log.serving_description} · </span>}
                    {formatTime(log.logged_at)}
                  </div>
                </div>
                <div className="food-item-cal">{log.calories} kcal</div>
                <button
                  className="btn btn-danger btn-icon btn-sm"
                  onClick={() => handleDelete(log.id)}
                  title="Remove entry"
                  style={{ fontSize: '1rem', padding: '.4rem .6rem' }}
                >
                  ×
                </button>
              </div>
            ))}
            <div
              style={{
                textAlign: 'right',
                fontWeight: 700,
                fontSize: '.95rem',
                color: 'var(--text-muted)',
                marginTop: '.5rem',
              }}
            >
              Total: {totalCalories.toLocaleString()} kcal
            </div>
          </div>
        )}
      </div>

      {/* Daily goal */}
      <div className="card">
        <h2 style={{ fontSize: '1.05rem', marginBottom: '1rem' }}>Daily Calorie Goal</h2>
        {goalMsg && (
          <div className={`alert ${goalMsg.includes('!') ? 'alert-success' : 'alert-error'}`}>
            {goalMsg}
          </div>
        )}
        <form onSubmit={handleGoal} className="goal-form">
          <div className="field">
            <label htmlFor="goal">Target calories (kcal)</label>
            <input
              id="goal"
              type="number"
              className="input"
              value={goalInput}
              onChange={(e) => setGoalInput(e.target.value)}
              min={100}
              max={99999}
              required
            />
          </div>
          <button type="submit" className="btn btn-outline" disabled={goalSaving}>
            {goalSaving ? <><span className="spinner spinner-dark" /> Saving…</> : 'Save goal'}
          </button>
        </form>
      </div>

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
