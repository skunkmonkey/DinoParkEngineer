export function ShellLab(): React.JSX.Element {
  return (
    <section className="feature-card" aria-labelledby="lab-heading">
      <p className="eyebrow">Shell diagnostics</p>
      <h2 id="lab-heading">Optional feature is isolated</h2>
      <p>
        This optional route loaded successfully. Add
        <code> ?featureFailure=1</code> to exercise its scoped recovery surface.
      </p>
    </section>
  );
}
