import {useEffect, useRef, useState} from 'react';
import type {SharePlan} from '../../services/sharePlan';

/** Share a plan: the system share sheet where there is one (navigator.share), else the link is copied with a short toast. Text and link come from services/sharePlan.ts (the app's own labelled numbers only). */
export function ShareWindow({plan, className = ''}: {plan: SharePlan | null; className?: string}) {
  const [toast, setToast] = useState(''), timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  if (!plan) return null;
  const say = (m: string) => { setToast(m); window.clearTimeout(timer.current); timer.current = window.setTimeout(() => setToast(''), 3500); };
  const share = async () => {
    try {
      if (typeof navigator.share === 'function') { await navigator.share({title: plan.title, text: plan.text, url: plan.url}); return; }
      await navigator.clipboard.writeText(plan.url); say('Link copied');
    } catch (e) {
      if ((e as {name?: string})?.name === 'AbortError') return;   // the person closed the share sheet
      try { await navigator.clipboard.writeText(plan.url); say('Link copied'); } catch { say('Could not share or copy the link'); }
    }
  };
  return <span className={`share-w ${className}`}>
    <button type="button" className="btn share-b" onClick={share} aria-label={`Share this plan: ${plan.text}`}>Share</button>
    <span className="share-toast" role="status" aria-live="polite">{toast}</span>
  </span>;
}
