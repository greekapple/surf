/** Honest in-progress state for destinations not yet rebuilt on this branch. */
export function Pending({title, checkpoint}: {title: string; checkpoint: number}) {
  return (
    <section className="pending" aria-labelledby="pending-title">
      <h1 id="pending-title">{title}</h1>
      <p>
        Being rebuilt on this branch (Phase 9C checkpoint {checkpoint}). The previous version remains on the{' '}
        <code>surf-history</code> branch.
      </p>
    </section>
  );
}
