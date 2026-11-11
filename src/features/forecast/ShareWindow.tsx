import {useEffect, useRef, useState} from 'react';
import {shareTextWithLink, type ShareCard} from '../../services/shareCard';
import {renderShareImage} from '../../ui/shareImage';

/** Share a plan in one tap: the condensed card (services/shareCard.ts, the app's own labelled numbers only) as text, with its PNG attached where the system share sheet takes files
 *  (navigator.canShare({files})); else the text and link; else the text and link are copied with a short toast. The PNG is drawn ahead of the tap so the share stays inside the tap's user activation. */
export function ShareWindow({card, className = '', label = 'Share'}: {card: ShareCard | null; className?: string; label?: string}) {
  const [toast, setToast] = useState(''), timer = useRef<number | undefined>(undefined), file = useRef<File | null>(null);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const key = card ? `${card.text}|${card.url}|${card.generated}` : '';
  useEffect(() => {
    file.current = null; if (!card) return;
    let off = false;
    renderShareImage(card).then((b) => { if (!off && b) file.current = new File([b], `swello-${card.spot.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`, {type: 'image/png'}); }).catch(() => {});
    return () => { off = true; };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!card) return null;
  const say = (m: string) => { setToast(m); window.clearTimeout(timer.current); timer.current = window.setTimeout(() => setToast(''), 3500); };
  const copy = async () => { try { await navigator.clipboard.writeText(shareTextWithLink(card)); say('Copied to paste in a message'); } catch { say('Could not share or copy'); } };
  const share = async () => {
    try {
      if (typeof navigator.share === 'function') {
        const f = file.current, withFile = f ? {files: [f], title: card.title, text: card.text, url: card.url} : null;
        if (withFile && typeof navigator.canShare === 'function' && navigator.canShare(withFile)) { await navigator.share(withFile); return; }
        await navigator.share({title: card.title, text: card.text, url: card.url}); return;
      }
      await copy();
    } catch (e) {
      if ((e as {name?: string})?.name === 'AbortError') return;   // the person closed the share sheet
      await copy();
    }
  };
  return <span className={`share-w ${className}`}>
    <button type="button" className="btn share-b" onClick={share} aria-label={`Share ${card.spot}: ${card.when}${card.noWindowText ? `, ${card.noWindowText.toLowerCase()}` : ''}`}>{label}</button>
    <span className="share-toast" role="status" aria-live="polite">{toast}</span>
  </span>;
}
