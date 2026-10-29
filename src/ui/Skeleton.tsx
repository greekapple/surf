/** Placeholder while data loads; shows after ~200 ms so fast loads never flash (RULES.md). */
export function Skeleton({label}: {label: string}) {
  return <div className="skel" role="status" aria-label={label}><i className="s-line" /><i className="s-hero" /><i className="s-row" /><i className="s-row" /><i className="s-row" /></div>;
}
