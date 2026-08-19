export function ParkPlaceholder(): React.JSX.Element {
  return (
    <section className="feature-card" aria-labelledby="park-heading">
      <p className="eyebrow">Production mode · Park closed</p>
      <h2 id="park-heading">Park View foundation</h2>
      <p>
        Dawn checks are ready. The deterministic park simulation arrives in a
        later phase; this route proves the shell can start, recover, and keep a
        stable operational home.
      </p>
      <dl className="status-grid" aria-label="Park shell status">
        <div><dt>Mode</dt><dd>Production</dd></div>
        <div><dt>Route</dt><dd><code>park</code></dd></div>
        <div><dt>Network</dt><dd>Not required for core play</dd></div>
      </dl>
    </section>
  );
}
