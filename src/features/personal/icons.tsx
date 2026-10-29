import type {SVGProps} from 'react';

/** Personal-section icons (stroke, 24 grid). Kept local so the shared Icon set stays untouched. */
const P = {
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20.5c1.2-3.6 4-5.5 7.5-5.5s6.3 1.9 7.5 5.5',
  pin: 'M12 21s6.5-5.6 6.5-11a6.5 6.5 0 1 0-13 0C5.5 15.4 12 21 12 21zM12 12.2a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4z',
  board: 'M12 2.5c3 3.2 4.2 7.2 4.2 11 0 3.4-1.6 6.4-4.2 8-2.6-1.6-4.2-4.6-4.2-8 0-3.8 1.2-7.8 4.2-11zM12 4.5v16',
  journal: 'M5 4.5h11.5a2 2 0 0 1 2 2v13H7a2 2 0 0 1-2-2zM5 17.5a2 2 0 0 1 2-2h11.5M9 8.5h6',
  bell: 'M6 16.5V11a6 6 0 1 1 12 0v5.5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0',
  account: 'M12 12.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM3.5 20c.8-3.3 3.8-5 8.5-5s7.7 1.7 8.5 5M3.5 4.5h3M17.5 4.5h3',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7.5V12l3 2',
  swell: 'M3 17c2.5 0 3-3 5.5-3s3 3 5.5 3 3-3 5.5-3M3 11c3.5 0 4-6 8.5-6 3 0 4 2.5 4 4.5',
  tide: 'M12 3.5v9M8.5 9l3.5 3.5L15.5 9M3 17c2.5 0 3-2 5.5-2s3 2 5.5 2 3-2 5.5-2M3 21c2.5 0 3-2 5.5-2s3 2 5.5 2 3-2 5.5-2',
  wind: 'M3 9h11a3 3 0 1 0-3-3M3 13h15a3 3 0 1 1-3 3M3 17h7',
  wave: 'M3 15c2.2 0 3-4.5 6-4.5s3.3 4.5 6 4.5c1.7 0 2.6-1.4 3.5-3M3 19.5h18',
  star: 'M12 4l2.4 5 5.4.6-4 3.7 1.1 5.3L12 16l-4.9 2.6 1.1-5.3-4-3.7 5.4-.6z',
  arrow: 'M5 12h14M13.5 6.5 19 12l-5.5 5.5',
  camera: 'M4 7.5h3l1.6-2h6.8l1.6 2h3V18H4zM12 15.5a3 3 0 1 0 0-6 3 3 0 0 0 0 .01',
  plus: 'M12 5v14M5 12h14',
  trash: 'M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12',
  edit: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
} as const;
export type PName = keyof typeof P;

export function PIcon({name, size = 18, ...rest}: {name: PName; size?: number} & SVGProps<SVGSVGElement>) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...rest}>
      <path d={P[name]} />
    </svg>
  );
}
