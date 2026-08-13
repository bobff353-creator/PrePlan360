export const dynamic = "force-dynamic";

export default function DepartmentAccessPage() {
  return (
    <main className="access-shell">
      <header className="access-header">
        <a href="/" className="access-brand">
          PrePlan <span>360</span>
          <small>Department access</small>
        </a>
        <div className="access-account">
          <a href="/">Return to launch page</a>
        </div>
      </header>
      <section className="owner-claim owner-auth-card">
        <div className="access-kicker">DEPARTMENT ACCESS</div>
        <h1>Department sign-in is not activated yet.</h1>
        <p>
          The platform owner must finish secure onboarding, create the department,
          and issue its first administrator invitation before department access
          can open on this Vercel release.
        </p>
        <p className="owner-auth-note">
          The view-only fictional demo remains available without signing in. No
          department data is shared or exposed from this page.
        </p>
        <a className="access-primary" href="/demo">
          Open view-only demo <span aria-hidden="true">&#8594;</span>
        </a>
      </section>
    </main>
  );
}
