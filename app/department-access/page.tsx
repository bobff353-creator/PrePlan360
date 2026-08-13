export const dynamic = "force-dynamic";

export default async function DepartmentAccessPage({ searchParams }: { searchParams: Promise<{ return_to?: string; error?: string }> }) {
  const query = await searchParams;
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
        <h1>Department sign in.</h1>
        <p>
          Use the email address and password from your department invitation.
          Your assigned role controls which records you can view or change.
        </p>
        {query.error ? <div className="owner-auth-error" role="alert">{query.error === "locked" ? "Too many attempts. Try again in 15 minutes." : "The email or password was not accepted."}</div> : null}
        <form method="post" action="/api/member/login" className="owner-auth-form"><input type="hidden" name="return_to" value={query.return_to || "/portal"}/><label>Email<input required type="email" name="email" autoComplete="email"/></label><label>Password<input required type="password" name="password" autoComplete="current-password" minLength={12} maxLength={128}/></label><button className="access-primary" type="submit">Open department workspace <span aria-hidden="true">&#8594;</span></button></form>
        <p className="owner-auth-note">No invitation yet? Ask the platform owner to invite your exact email address.</p>
      </section>
    </main>
  );
}
