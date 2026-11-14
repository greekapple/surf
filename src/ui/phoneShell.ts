import {useEffect, useState} from 'react';

/** Phone shell: the floating tab bar hides while the page scrolls down and returns on scroll up or at the end of the page.
 *  It never hides on the Map (the map has its own controls), while a text field has focus or the on-screen keyboard is up, or while focus is inside the bar.
 *  State goes on <html data-tabbar="shown|hidden"> so the floating Share can sit above the bar or drop to the corner. CSS does the moving (and honours reduced motion). */
const STEP = 6, TOP = 48, END = 8;
const typing = () => { const a = document.activeElement as HTMLElement | null; return !!a && (/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) || a.isContentEditable); };
const keyboardUp = () => typing() || (!!window.visualViewport && window.visualViewport.height < window.innerHeight * 0.75);

export function useTabBarAutoHide(area: string) {
  useEffect(() => {
    const root = document.documentElement, set = (hidden: boolean) => { root.dataset.tabbar = hidden ? 'hidden' : 'shown'; };
    set(false);
    if (area === 'explore') return () => { delete root.dataset.tabbar; };
    let last = window.scrollY, raf = 0;
    const update = () => {
      raf = 0;
      const y = Math.max(0, window.scrollY), dy = y - last;
      const atEnd = window.innerHeight + y >= document.documentElement.scrollHeight - END;
      const inBar = !!document.activeElement?.closest('.tabbar');
      if (keyboardUp() || inBar || atEnd || y < TOP) set(false);
      else if (dy > STEP) set(true);
      else if (dy < -STEP) set(false);
      if (Math.abs(dy) > STEP) last = y;
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    const onFocus = () => { if (keyboardUp()) set(false); };
    addEventListener('scroll', onScroll, {passive: true});
    addEventListener('focusin', onFocus);
    window.visualViewport?.addEventListener('resize', onScroll);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      removeEventListener('scroll', onScroll); removeEventListener('focusin', onFocus);
      window.visualViewport?.removeEventListener('resize', onScroll);
      delete root.dataset.tabbar;
    };
  }, [area]);
}

/** The page title moves up into the top bar once the page's own h1 has scrolled under it (phones; Personal, Quiver and the Forecast sub-pages).
 *  Returns the title to show in the bar, or '' while the heading is still on screen. */
export function useCollapsedTitle(enabled: boolean, key: string): string {
  const [title, setTitle] = useState('');
  useEffect(() => {
    setTitle('');
    if (!enabled || !window.matchMedia('(max-width: 860px)').matches) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const h = document.querySelector('main h1'), bar = document.querySelector('.topnav')?.getBoundingClientRect().bottom ?? 64;
      const gone = !!h && h.getBoundingClientRect().bottom < bar + 4;
      setTitle(gone ? (h!.textContent ?? '').trim() : '');
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    addEventListener('scroll', onScroll, {passive: true});
    return () => { if (raf) cancelAnimationFrame(raf); removeEventListener('scroll', onScroll); };
  }, [enabled, key]);
  return title;
}
