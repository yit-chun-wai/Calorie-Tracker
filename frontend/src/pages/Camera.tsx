import { ChangeEvent, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FoodItem, analyseFood, logFood } from '../api/client';
import { isAxiosError } from 'axios';

type Tab = 'upload' | 'camera';

const EMPTY_ITEM = (): FoodItem => ({ food_name: '', calories: 0, serving_description: '' });

export function Camera() {
  const navigate = useNavigate();
  const uploadRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState<Tab>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [analysing, setAnalysing] = useState(false);
  const [items, setItems] = useState<FoodItem[]>([]);
  const [hasResult, setHasResult] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<FoodItem>(EMPTY_ITEM());
  const [logging, setLogging] = useState(false);
  const [logged, setLogged] = useState(false);
  const [error, setError] = useState('');

  const totalCalories = items.reduce((sum, item) => sum + item.calories, 0);

  const handleFile = (f: File) => {
    setFile(f);
    setItems([]);
    setHasResult(false);
    setEditingIndex(null);
    setLogged(false);
    setError('');
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(f);
  };

  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f && f.type.startsWith('image/')) handleFile(f);
  };

  const handleRetake = () => {
    setFile(null);
    setPreview(null);
    setItems([]);
    setHasResult(false);
    setEditingIndex(null);
    setLogged(false);
    setError('');
    if (uploadRef.current) uploadRef.current.value = '';
    if (cameraRef.current) cameraRef.current.value = '';
  };

  const handleAnalyse = async () => {
    if (!file) return;
    setAnalysing(true);
    setError('');
    try {
      const { data } = await analyseFood(file);
      setItems(data.items);
      setHasResult(true);
    } catch (err) {
      if (isAxiosError(err)) {
        setError(err.response?.data?.error ?? 'Analysis failed. Please try a clearer photo.');
      } else {
        setError('Analysis failed. Please try again.');
      }
    } finally {
      setAnalysing(false);
    }
  };

  // ── Editing ────────────────────────────────
  const startEdit = (index: number) => {
    setEditingIndex(index);
    setEditForm({ ...items[index] });
  };

  const saveEdit = () => {
    if (editingIndex === null) return;
    setItems((prev) => prev.map((item, i) => (i === editingIndex ? { ...editForm, calories: Math.round(Number(editForm.calories)) } : item)));
    setEditingIndex(null);
  };

  const cancelEdit = () => setEditingIndex(null);

  const deleteItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
    if (editingIndex === index) setEditingIndex(null);
  };

  const addItem = () => {
    const newIndex = items.length;
    setItems((prev) => [...prev, EMPTY_ITEM()]);
    setEditingIndex(newIndex);
    setEditForm(EMPTY_ITEM());
  };

  // ── Logging ────────────────────────────────
  const handleLog = async () => {
    if (items.length === 0) return;
    setLogging(true);
    try {
      await Promise.all(
        items.map((item) => logFood(item.food_name, item.calories, item.serving_description)),
      );
      setLogged(true);
      setTimeout(() => navigate('/'), 1400);
    } catch {
      setError('Failed to log entries. Please try again.');
    } finally {
      setLogging(false);
    }
  };

  return (
    <>
      <h2 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '1.25rem' }}>Add Food</h2>

      <div className="card">
        {/* Tabs */}
        <div className="tabs">
          <button className={`tab${tab === 'upload' ? ' active' : ''}`} onClick={() => { setTab('upload'); handleRetake(); }}>
            📁 Upload Photo
          </button>
          <button className={`tab${tab === 'camera' ? ' active' : ''}`} onClick={() => { setTab('camera'); handleRetake(); }}>
            📷 Take Photo
          </button>
        </div>

        {/* Image selection */}
        {!preview ? (
          tab === 'upload' ? (
            <div className="upload-area" onClick={() => uploadRef.current?.click()} onDrop={handleDrop} onDragOver={(e) => e.preventDefault()}>
              <div style={{ fontSize: '2.5rem' }}>🖼️</div>
              <p>Click to upload or drag & drop an image</p>
              <p style={{ fontSize: '.8rem', marginTop: '.25rem' }}>JPEG, PNG, WebP up to 4 MB</p>
              <input ref={uploadRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={onFileChange} />
            </div>
          ) : (
            <div className="upload-area" onClick={() => cameraRef.current?.click()}>
              <div style={{ fontSize: '2.5rem' }}>📷</div>
              <p>Tap to open camera</p>
              <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={onFileChange} />
            </div>
          )
        ) : (
          <div className="preview-wrapper">
            <img src={preview} alt="Food preview" />
            <button className="btn btn-outline btn-sm preview-retake" onClick={handleRetake}>✕ Retake</button>
          </div>
        )}

        {/* Error */}
        {error && <div className="alert alert-error" style={{ marginTop: '1rem' }}>{error}</div>}

        {/* Analyse button */}
        {preview && !hasResult && !logged && (
          <button className="btn btn-primary btn-full" style={{ marginTop: '1rem' }} onClick={handleAnalyse} disabled={analysing}>
            {analysing ? <><span className="spinner" /> Analysing with AI…</> : '🔍 Analyse Food'}
          </button>
        )}

        {/* Results */}
        {hasResult && !logged && (
          <div style={{ marginTop: '1rem' }}>
            <div style={{ fontSize: '.85rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '.5rem', textTransform: 'uppercase', letterSpacing: '.05em' }}>
              Detected items — edit if needed
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
              {items.map((item, i) => (
                <div key={i}>
                  {editingIndex === i ? (
                    /* Edit form */
                    <div style={{ background: 'var(--surface-2)', border: '1.5px solid var(--primary)', borderRadius: 'var(--radius-sm)', padding: '.85rem' }}>
                      <div className="field" style={{ marginBottom: '.6rem' }}>
                        <label>Food name</label>
                        <input className="input" value={editForm.food_name} onChange={(e) => setEditForm((f) => ({ ...f, food_name: e.target.value }))} placeholder="e.g. Fried rice" autoFocus />
                      </div>
                      <div style={{ display: 'flex', gap: '.6rem' }}>
                        <div className="field" style={{ flex: 1 }}>
                          <label>Calories (kcal)</label>
                          <input className="input" type="number" value={editForm.calories} onChange={(e) => setEditForm((f) => ({ ...f, calories: Number(e.target.value) }))} min={0} />
                        </div>
                        <div className="field" style={{ flex: 2 }}>
                          <label>Serving</label>
                          <input className="input" value={editForm.serving_description} onChange={(e) => setEditForm((f) => ({ ...f, serving_description: e.target.value }))} placeholder="e.g. 1 cup" />
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '.5rem', marginTop: '.75rem' }}>
                        <button className="btn btn-primary btn-sm" onClick={saveEdit}>Save</button>
                        <button className="btn btn-outline btn-sm" onClick={cancelEdit}>Cancel</button>
                        <button className="btn btn-danger btn-sm" style={{ marginLeft: 'auto' }} onClick={() => deleteItem(i)}>Delete</button>
                      </div>
                    </div>
                  ) : (
                    /* Display row */
                    <div className="food-item">
                      <div className="food-item-info">
                        <div className="food-item-name">{item.food_name || <span style={{ color: 'var(--text-muted)' }}>Unnamed item</span>}</div>
                        {item.serving_description && <div className="food-item-meta">{item.serving_description}</div>}
                      </div>
                      <div className="food-item-cal">{item.calories} kcal</div>
                      <button className="btn btn-ghost btn-sm" onClick={() => startEdit(i)} title="Edit" style={{ padding: '.3rem .5rem' }}>✏️</button>
                      <button className="btn btn-danger btn-sm btn-icon" onClick={() => deleteItem(i)} title="Remove" style={{ padding: '.3rem .5rem' }}>×</button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Add item */}
            <button className="btn btn-outline btn-sm" style={{ marginTop: '.6rem', width: '100%' }} onClick={addItem}>
              + Add item manually
            </button>

            {/* Total */}
            {items.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '.75rem', padding: '.75rem 1rem', background: 'var(--primary-light)', border: '1.5px solid var(--primary-ring)', borderRadius: 'var(--radius-sm)', fontWeight: 700 }}>
                <span>Total</span>
                <span style={{ color: 'var(--primary-dark)', fontSize: '1.1rem' }}>{totalCalories} kcal</span>
              </div>
            )}

            {/* Actions */}
            <div className="action-row">
              <button className="btn btn-outline" onClick={handleRetake}>Try again</button>
              <button className="btn btn-primary" onClick={handleLog} disabled={logging || items.length === 0 || editingIndex !== null}>
                {logging ? <><span className="spinner" /> Logging…</> : `✓ Log ${items.length} item${items.length !== 1 ? 's' : ''}`}
              </button>
            </div>
            {editingIndex !== null && (
              <p style={{ textAlign: 'center', fontSize: '.8rem', color: 'var(--text-muted)', marginTop: '.5rem' }}>
                Save or cancel the current edit before logging.
              </p>
            )}
          </div>
        )}

        {/* Success */}
        {logged && (
          <div className="alert alert-success" style={{ marginTop: '1rem', textAlign: 'center' }}>
            ✓ Logged! Redirecting to dashboard…
          </div>
        )}
      </div>

      <p style={{ textAlign: 'center', marginTop: '1rem', fontSize: '.9rem', color: 'var(--text-muted)' }}>
        AI identifies every food item individually. Edit anything before logging.
      </p>
    </>
  );
}
