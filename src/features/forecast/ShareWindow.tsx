import {useEffect, useRef, useState} from 'react';
import {shareTextWithLink, type ShareCard} from '../../services/shareCard';
import {renderShareImage} from '../../ui/shareImage';
import {Icon} from '../../ui/Icon';

/** Share a plan in one tap: the condensed card (services/shareCard.ts, the app's own labelled numbers only) as text, with its PNG attached where the system share sheet takes files
 *  (navigator.canShare({files})); else the text and link; else the text and link are copied with a short toast. The PNG is drawn ahead of the tap so the share stays inside the tap's user activation. */
/** True while the page's own header Share (`.sp-share`) is on screen below the sticky header; the phone's floating Share steps aside then, so there is never a pair. */
function useHeaderShareVisible(on: boolean) {
  const [seen, setSeen] = useState(true);
  useEffect(() => {
    if (!on) return;
    const target = document.querySelector('.sp-share .share-b');
    if (!target || typeof IntersectionObserver === 'undefined') { setSeen(false); return; }
    const hdr = document.querySelector('.hdr')?.getBoundingClientRect().height ?? 64;
    const io = new IntersectionObserver(([e]) => setSeen(e.isIntersecting), {rootMargin: `-${Math.round(hdr)}px 0px -64px 0px`});
    io.observe(target);
    return () => io.disconnect();
  }, [on]);
  return seen;
}

/** `fab`: the phone's floating Share (a round button above the tab bar). It is this same component, so the text, link, card image and fallbacks are exactly the header's. */
export function ShareWindow({card, className = '', label = 'Share', fab = false}: {card: ShareCard | null; className?: string; label?: string; fab?: boolean}) {
  const headerSeen = useHeaderShareVisible(fab);
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
  const name = `Share ${card.spot}: ${card.when}${card.noWindowText ? `, ${card.noWindowText.toLowerCase()}` : ''}`;
  if (fab) return <span className="share-w share-fab-w" data-away={headerSeen}>
    <button type="button" className="share-fab" onClick={share} aria-label={name} tabIndex={headerSeen ? -1 : 0}><Icon name="share" size={24} /></button>
    <span className="share-toast" role="status" aria-live="polite">{toast}</span>
  </span>;
  return <span className={`share-w ${className}`}>
    <button type="button" className="btn share-b" onClick={share} aria-label={name}>{label}</button>
    <span className="share-toast" role="status" aria-live="polite">{toast}</span>
  </span>;
}
