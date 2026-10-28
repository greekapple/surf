import {useEffect, useMemo, useRef, type KeyboardEvent, type PointerEvent} from 'react';
import type {HourSample} from './model';
import {dayLabel, fullTimeLabel, hourLabel} from './model';
import type {RatingCategory} from '../../ratings/types';

type Band = 'strong' | 'fair' | 'poor' | 'none';

function band(category: RatingCategory): Band {
  if (category === 'EPIC' || category === 'FIRING' || category === 'GOOD' || category === 'SOLID') return 'strong';
  if (category === 'NOT BAD' || category === 'SURFABLE') return 'fair';
  if (category === 'UNRATED') return 'none';
  return 'poor';
}

const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/**
 * One time selection shared by the whole app. Mouse and pen drag-scrub; touch keeps native
 * horizontal scrolling and selects on tap. Every position is a real record, never interpolated.
 */
export function TimeRail({
  series,
  selectedTime,
  onSelect,
  now,
  heightLabel,
}: {
  series: HourSample[];
  selectedTime: string | null;
  onSelect: (timestamp: string) => void;
  now: number;
  heightLabel: string;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const gesture = useRef<{x: number; scrub: boolean; moved: boolean} | null>(null);

  const index = Math.max(
    0,
    series.findIndex(s => s.timestamp === selectedTime),
  );
  const max = useMemo(() => Math.max(1, ...series.map(s => s.heightFt ?? 0)), [series]);
  const nowIndex = useMemo(() => {
    const hour = Math.floor(now / 3600000) * 3600000;
    return series.findIndex(s => Date.parse(s.timestamp) >= hour);
  }, [series, now]);

  useEffect(() => {
    const el = scroller.current?.querySelector<HTMLElement>(`[data-index="${index}"]`);
    el?.scrollIntoView({inline: 'center', block: 'nearest', behavior: prefersReducedMotion() ? 'auto' : 'smooth'});
  }, [index]);

  const indexAt = (clientX: number) => {
    const rect = track.current!.getBoundingClientRect();
    const width = rect.width / Math.max(1, series.length);
    return Math.min(series.length - 1, Math.max(0, Math.floor((clientX - rect.left) / width)));
  };

  const select = (i: number) => {
    const target = series[i];
    if (target && target.timestamp !== selectedTime) onSelect(target.timestamp);
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    const scrub = e.pointerType !== 'touch';
    gesture.current = {x: e.clientX, scrub, moved: false};
    if (scrub) {
      e.currentTarget.setPointerCapture(e.pointerId);
      select(indexAt(e.clientX));
    }
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g) return;
    if (Math.abs(e.clientX - g.x) > 8) g.moved = true;
    if (g.scrub) select(indexAt(e.clientX));
  };
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    gesture.current = null;
    if (g && !g.scrub && !g.moved) select(indexAt(e.clientX));
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step: Record<string, number> = {ArrowRight: 1, ArrowLeft: -1, PageDown: 24, PageUp: -24};
    if (e.key in step) {
      e.preventDefault();
      select(Math.min(series.length - 1, Math.max(0, index + step[e.key])));
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      select(e.key === 'Home' ? 0 : series.length - 1);
    }
  };

  if (!series.length) return null;
  const selected = series[index];

  return (
    <div className="rail">
      <div className="rail-readout" aria-hidden="true">
        <span className="rail-readout-time">{fullTimeLabel(selected.timestamp)}</span>
        <span className="rail-legend">
          <span className="rail-key" data-band="strong" /> Better
          <span className="rail-key" data-band="fair" /> Fair
          <span className="rail-key" data-band="poor" /> Poor
          <span className="rail-key" data-band="none" /> Unrated
          <span className="rail-legend-note">Bars: {heightLabel}</span>
        </span>
      </div>
      <div
        className="rail-scroller"
        ref={scroller}
        role="slider"
        tabIndex={0}
        aria-label="Forecast time"
        aria-valuemin={0}
        aria-valuemax={series.length - 1}
        aria-valuenow={index}
        aria-valuetext={`${fullTimeLabel(selected.timestamp)}, ${selected.rating.category.toLowerCase()}`}
        onKeyDown={onKeyDown}
      >
        <div
          className="rail-track"
          ref={track}
          style={{gridTemplateColumns: `repeat(${series.length}, var(--rail-col))`}}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => (gesture.current = null)}
        >
          {series.map((s, i) => {
            const newDay = i === 0 || s.date !== series[i - 1].date;
            const h = s.heightFt === null ? 0 : Math.max(4, (s.heightFt / max) * 100);
            return (
              <div
                key={s.timestamp}
                className="rail-col"
                data-index={i}
                data-selected={i === index || undefined}
                data-now={i === nowIndex || undefined}
                data-day-start={newDay || undefined}
              >
                {newDay && <span className="rail-day">{dayLabel(s.timestamp, now)}</span>}
                <span className="rail-bar" style={{height: `${h}%`}} data-missing={s.heightFt === null || undefined} />
                <span className="rail-band" data-band={band(s.rating.category)} />
                {s.hour % 6 === 0 && <span className="rail-hour">{hourLabel(s.timestamp)}</span>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
