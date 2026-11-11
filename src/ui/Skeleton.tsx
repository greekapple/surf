/** Placeholder while data loads; shows after ~200 ms so fast loads never flash (RULES.md). */
export function Skeleton({label}: {label: string}) {
  return <div className="skel" role="status" aria-label={label}><i className="s-line" /><i className="s-hero" /><i className="s-row" /><i className="s-row" /><i className="s-row" /></div>;
}

/** A6: one value still loading (a row value, a board-fit line). Announced once by its label; no loading text (RULES.md). */
export function SkelInline({label, width}: {label: string; width?: string}) {
  return <span className="skel-inline" role="status" aria-label={label} style={width ? {['--skw' as string]: width} : undefined} />;
}
