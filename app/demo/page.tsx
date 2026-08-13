export default function DemoPage() {
  return (
    <main className="demo-shell">
      <header className="demo-header">
        <a className="demo-back" href="/" aria-label="Back to demo launch page"><span aria-hidden="true">←</span> Overview</a>
        <div className="demo-title"><strong>PrePlan <span>360</span></strong><small>Latest view-only build</small></div>
        <div className="demo-mode"><i /> Fictional data · editing locked</div>
      </header>
      <iframe
        className="fireflow-frame"
        src="/fireflow-360-demo.html?view=readonly&v=20260813-launch-view-only"
        title="PrePlan 360 latest view-only demo"
      />
    </main>
  );
}
