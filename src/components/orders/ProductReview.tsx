// src/components/orders/ProductReview.tsx
// Rate / review one purchased cactus from a delivered order (create or update).
import { useState } from 'react';
import { useToast } from '../../context/ToastContext';

export interface MyReview {
  rating:    number;
  comment:   string | null;
  orderId:   number;
  createdAt: string;
  updatedAt: string;
}

const STAR_PATH = 'M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.518 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118L2.05 10.1c-.783-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.518-4.674z';
const LABELS    = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'];
const MAX_CHARS = 1000;

function Star({ filled, className }: { filled: boolean; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" aria-hidden="true">
      <path d={STAR_PATH} fill={filled ? '#fbbf24' : '#d1d5db'} />
    </svg>
  );
}

interface Props {
  orderId:  number;
  cactusId: number;
  name:     string;
  review:   MyReview | null;
  onSaved:  (review: MyReview) => void;
}

export function ProductReview({ orderId, cactusId, name, review, onSaved }: Props) {
  const { showToast } = useToast();
  const [editing, setEditing] = useState(false);
  const [rating,  setRating]  = useState(review?.rating ?? 0);
  const [hover,   setHover]   = useState(0);
  const [comment, setComment] = useState(review?.comment ?? '');
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState('');

  const startEditing = () => {
    setRating(review?.rating ?? 0);
    setComment(review?.comment ?? '');
    setError('');
    setEditing(true);
  };

  const submit = async () => {
    if (rating < 1) { setError('Please choose a star rating'); return; }
    setSaving(true); setError('');
    try {
      const res  = await fetch(`/api/auth/my-orders/${orderId}/reviews/${cactusId}`, {
        method:      'PUT',
        credentials: 'include',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify({ rating, comment: comment.trim() }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.review) throw new Error(body?.error ?? 'Could not save your review. Please try again.');
      onSaved(body.review);
      setEditing(false);
      showToast(review ? 'Your review has been updated' : 'Thanks for your review! ⭐');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your review');
    } finally { setSaving(false); }
  };

  // ── Saved review (read-only) ──────────────────────────────
  if (review && !editing) {
    return (
      <div className="mt-2 ml-[60px] flex flex-col gap-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-400">Your rating</span>
          <div className="flex items-center gap-0.5" title={`${review.rating} out of 5`}>
            {[1, 2, 3, 4, 5].map(n => <Star key={n} filled={n <= review.rating} className="w-3.5 h-3.5" />)}
          </div>
          <button onClick={startEditing} className="text-xs font-medium text-cactus-600 dark:text-cactus-400 hover:underline">
            Edit
          </button>
        </div>
        {review.comment && (
          <p className="text-xs text-gray-600 dark:text-gray-400 italic break-words">“{review.comment}”</p>
        )}
      </div>
    );
  }

  // ── Not rated yet ─────────────────────────────────────────
  if (!editing) {
    return (
      <div className="mt-2 ml-[60px]">
        <button onClick={startEditing}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950 hover:bg-amber-100 dark:hover:bg-amber-900 rounded-lg transition-colors">
          <Star filled className="w-3.5 h-3.5" /> Rate this cactus
        </button>
      </div>
    );
  }

  // ── Form ──────────────────────────────────────────────────
  const shown = hover || rating;
  return (
    <div className="mt-2 sm:ml-[60px] p-3 bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700 rounded-xl flex flex-col gap-2.5">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1" role="radiogroup" aria-label={`Rate ${name}`} onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map(n => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={rating === n}
              aria-label={`${n} star${n > 1 ? 's' : ''}`}
              onClick={() => { setRating(n); setError(''); }}
              onMouseEnter={() => setHover(n)}
              className="p-0.5 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-cactus-500"
            >
              <Star filled={n <= shown} className="w-6 h-6 transition-transform hover:scale-110" />
            </button>
          ))}
        </div>
        <span className="text-xs font-medium text-amber-600 dark:text-amber-400 min-w-[64px]">{LABELS[shown]}</span>
      </div>

      <div>
        <textarea
          value={comment}
          onChange={e => setComment(e.target.value)}
          maxLength={MAX_CHARS}
          rows={3}
          placeholder="Share how your cactus arrived and how it's doing (optional)"
          className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-cactus-500 resize-none"
        />
        <p className="text-[11px] text-gray-400 text-right">{comment.length}/{MAX_CHARS}</p>
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
        <button onClick={() => setEditing(false)} disabled={saving}
          className="px-4 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-800 transition-colors disabled:opacity-50">
          Cancel
        </button>
        <button onClick={submit} disabled={saving}
          className="px-5 py-2 text-sm font-semibold text-white bg-cactus-600 hover:bg-cactus-700 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
          {saving && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
          {review ? 'Update Review' : 'Submit Review'}
        </button>
      </div>
    </div>
  );
}
