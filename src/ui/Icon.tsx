import type {SVGProps} from 'react';

const PATHS = {
  home: 'M4 11.5 12 5l8 6.5V20H14.5v-5h-5v5H4z',
  forecast: 'M3 15c2.2 0 3-4.5 6-4.5s3.3 4.5 6 4.5c1.7 0 2.6-1.4 3.5-3M3 19.5h18',
  explore: 'M3.5 6.5 9 4l6 2.5 5.5-2.5v13L15 19.5 9 17l-5.5 2.5zM9 4v13M15 6.5v13',
  quiver: 'M12 2.5c3 3.2 4.2 7.2 4.2 11 0 3.4-1.6 6.4-4.2 8-2.6-1.6-4.2-4.6-4.2-8 0-3.8 1.2-7.8 4.2-11zM12 4v16.5',
  scale: 'M6 21V12.5M6 9.5a1.6 1.6 0 1 0 0-.01M4 21h16M11.5 21c0-6 3-11.5 8.5-14',
  personal: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20.5c1.2-3.6 4-5.5 7.5-5.5s6.3 1.9 7.5 5.5',
  chevron: 'M7 10l5 5 5-5',
  close: 'M6 6l12 12M18 6 6 18',
  arrow: 'M12 20V4M6.5 9.5 12 4l5.5 5.5',
  star: 'M12 4l2.4 5 5.4.6-4 3.7 1.1 5.3L12 16l-4.9 2.6 1.1-5.3-4-3.7 5.4-.6z',
  camera: 'M4 7.5h3l1.6-2h6.8l1.6 2h3V18H4zM12 15.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  plus: 'M12 5v14M5 12h14',
  trash: 'M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12',
  edit: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
  play: 'M8 5v14l11-7z',
  menu: 'M4 7h16M4 12h16M4 17h16',
  search: 'M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM15.5 15.5 20 20',
  sun: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4',
  moon: 'M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z',
  layers: 'M12 4 3 8.5l9 4.5 9-4.5zM3 12.5l9 4.5 9-4.5M3 16.5l9 4.5 9-4.5',
  pause: 'M8 5v14M16 5v14',
  minus: 'M5 12h14',
  wind: 'M3 9h11a3 3 0 1 0-3-3M3 13h15a3 3 0 1 1-3 3M3 17h7',
  waves: 'M3 9c2 0 2.5-2 4.5-2S10 9 12 9s2.5-2 4.5-2S19 9 21 9M3 14c2 0 2.5-2 4.5-2s2.5 2 4.5 2 2.5-2 4.5-2 2.5 2 4.5 2M3 19c2 0 2.5-2 4.5-2s2.5 2 4.5 2 2.5-2 4.5-2 2.5 2 4.5 2',
  tide: 'M12 3v10M8.5 9.5 12 13l3.5-3.5M3 18c2 0 2.5-2 4.5-2s2.5 2 4.5 2 2.5-2 4.5-2 2.5 2 4.5 2',
  locate: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3',
  thermo: 'M10 14.5V5a2 2 0 1 1 4 0v9.5a4 4 0 1 1-4 0z',
} as const;
export type IconName = keyof typeof PATHS;

export function Icon({name, size = 20, ...rest}: {name: IconName; size?: number} & SVGProps<SVGSVGElement>) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...rest}>
      <path d={PATHS[name]} />
    </svg>
  );
}

/** Points where a swell or wind travels, given the direction it comes FROM. */
export function DirArrow({from, size = 16, color}: {from: number; size?: number; color?: string}) {
  return <Icon name="arrow" size={size} style={{transform: `rotate(${(from + 180) % 360}deg)`, color}} />;
}
