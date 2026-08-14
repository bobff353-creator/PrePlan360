const demoUrl = "/fireflow-360-demo.html?view=readonly&v=20260814-apparatus-roster-maps";

export default function Home() {
  return (
    <main className="launch-shell">
      <header className="launch-nav">
        <a className="launch-brand" href="#top" aria-label="PrePlan 360 home">
          <span className="launch-flame" aria-hidden="true">◆</span>
          <span><strong>PrePlan <span>360</span></strong><small>Preplanning & response</small></span>
        </a>
        <div className="launch-nav-actions">
          <span className="launch-status"><i /> Fictional demo data</span>
          <a className="launch-login" href="/portal">Department sign in</a>
          <a className="launch-login owner" href="/owner">Owner sign in</a>
          <a className="launch-button small" href="/demo">Launch full screen <span aria-hidden="true">↗</span></a>
        </div>
      </header>

      <section className="launch-hero" id="top">
        <div className="launch-copy">
          <p className="launch-eyebrow">VIEW-ONLY PRODUCT DEMO</p>
          <h1>Know the building before the call.</h1>
          <p className="launch-lead">Explore the latest PrePlan 360 build across preplans, hydrants, response intelligence, live operations, staffing, scheduling, apparatus, and incident command.</p>
          <div className="launch-actions">
            <a className="launch-button" href="/demo">Launch view-only demo <span aria-hidden="true">→</span></a>
            <a className="launch-button secondary" href="/portal">Department login <span aria-hidden="true">→</span></a>
            <a className="launch-link" href="#preview">Preview below <span aria-hidden="true">↓</span></a>
          </div>
          <div className="launch-trust">
            <span><b>Latest build</b><small>Connected workflows in one tour</small></span>
            <span><b>View only</b><small>Editing and operational actions locked</small></span>
            <span><b>Fictional</b><small>No real departments or records</small></span>
          </div>
        </div>
        <aside className="launch-brief" aria-label="Demo highlights">
          <div className="brief-top"><span>DEMO BRIEF</span><i>READY</i></div>
          <h2>Built for the full preplan-to-response lifecycle.</h2>
          <ul>
            <li><span>01</span><div><b>Prepare</b><small>Roster, scheduling, duties, fleet, inspections</small></div></li>
            <li><span>02</span><div><b>Respond</b><small>CAD context, address fallback, preplan intelligence</small></div></li>
            <li><span>03</span><div><b>Command</b><small>Assignments, PAR, benchmarks, water supply</small></div></li>
          </ul>
          <p>Navigate every module. Controls that would change data are visibly locked.</p>
        </aside>
      </section>

      <section className="launch-preview-section" id="preview">
        <div className="preview-heading">
          <div><p className="launch-eyebrow">LIVE PRODUCT VIEW</p><h2>The newest build, ready to explore.</h2></div>
          <a className="launch-button small" href="/demo">Open full screen <span aria-hidden="true">↗</span></a>
        </div>
        <div className="launch-browser">
          <div className="browser-bar"><span className="browser-dots"><i /><i /><i /></span><span className="browser-address">preplan360 / view-only-demo</span><span className="browser-lock">VIEW ONLY</span></div>
          <iframe className="launch-demo-frame" src={demoUrl} title="PrePlan 360 view-only fictional demo" />
        </div>
      </section>

      <section className="launch-modules" aria-label="Included demo modules">
        {[
          ["Operations", "Live board, command center, Respond and active incident"],
          ["People", "Roster, staffing, shift building and selected-admin approval"],
          ["Prevention", "Preplans, inspections, hydrants and fire-flow records"],
          ["Resources", "Apparatus, logistics, duties, payroll and box cards"],
        ].map(([title, copy], index) => (
          <article key={title}><span>0{index + 1}</span><h3>{title}</h3><p>{copy}</p></article>
        ))}
      </section>

      <footer className="launch-footer">
        <div className="launch-brand compact"><span className="launch-flame" aria-hidden="true">◆</span><span><strong>PrePlan <span>360</span></strong><small>View-only fictional demo</small></span></div>
        <p>All departments, people, properties, addresses, incidents, and operational records shown are fictional. Not connected to live CAD.</p>
      </footer>
    </main>
  );
}
