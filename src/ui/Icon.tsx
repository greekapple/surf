import type {SVGProps} from 'react';

export type IconName = 'forecast' | 'explore' | 'quiver' | 'scale' | 'settings' | 'close' | 'arrow' | 'chevron';

const paths: Record<IconName, string> = {
  // Wave crest over a baseline
  forecast: 'M3 15c2.2 0 3-4.5 6-4.5s3.3 4.5 6 4.5c1.7 0 2.6-1.4 3.5-3M3 19.5h18M14.5 5.5l2 2.5 3-4',
  // Folded chart
  explore: 'M3.5 6.5 9 4l6 2.5 5.5-2.5v13L15 19.5 9 17l-5.5 2.5zM9 4v13M15 6.5v13',
  // Board outline with stringer
  quiver: 'M12 2.5c3 3.2 4.2 7.2 4.2 11 0 3.4-1.6 6.4-4.2 8-2.6-1.6-4.2-4.6-4.2-8 0-3.8 1.2-7.8 4.2-11zM12 4v16.5',
  // Figure beside a wave face
  scale: 'M6 21V12.5M6 9.5a1.6 1.6 0 1 0 0-.01M4 21h16M11.5 21c0-6 3-11.5 8.5-14',
  settings: 'M4 7h9M17 7h3M4 17h3M11 17h9M15 5v4M9 15v4',
  close: 'M6 6l12 12M18 6 6 18',
  arrow: 'M12 20V4M6.5 9.5 12 4l5.5 5.5',
  chevron: 'M7 10l5 5 5-5',
};

export function Icon({name, size = 24, ...rest}: {name: IconName; size?: number} & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      <path d={paths[name]} />
    </svg>
  );
}

/** Arrow showing where a swell or wind travels, given the direction it comes FROM (meteorological degrees). */
export function DirectionArrow({fromDegrees, size = 20}: {fromDegrees: number; size?: number}) {
  return <Icon name="arrow" size={size} style={{transform: `rotate(${(fromDegrees + 180) % 360}deg)`}} />;
}
