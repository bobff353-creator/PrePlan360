import { getDepartmentBySlug } from "@/db/access";
import { departmentSlugFromReturnTo, normalizeDepartmentSlug, safeMemberReturnTo } from "@/app/member-routing.mjs";

export const dynamic = "force-dynamic";

export default async function DepartmentAccessPage({ searchParams }: { searchParams: Promise<{ return_to?: string; department?: string; error?: string }> }) {
  const query = await searchParams;
  const returnTo = safeMemberReturnTo(query.return_to);
  const requestedSlug = normalizeDepartmentSlug(query.department) || departmentSlugFromReturnTo(returnTo);
  const requestedDepartment = requestedSlug ? await getDepartmentBySlug(requestedSlug) : null;
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
        <h1>{requestedDepartment ? `Sign in to ${requestedDepartment.app_title || requestedDepartment.name}.` : "Department sign in."}</h1>
        <p>
          Use the email address and password from your department invitation.
          {requestedDepartment ? ` This sign-in opens ${requestedDepartment.name}, and your assigned role controls which records you can view or change.` : " Your assigned role controls which records you can view or change."}
        </p>
        {query.error ? <div className="owner-auth-error" role="alert">{query.error === "locked" ? "Too many attempts. Try again in 15 minutes." : "The email or password was not accepted."}</div> : null}
        <form method="post" action="/api/member/login" className="owner-auth-form"><input type="hidden" name="return_to" value={returnTo}/><input type="hidden" name="department_slug" value={requestedDepartment?.slug || ""}/><label>Email<input required type="email" name="email" autoComplete="email"/></label><label>Password<input required type="password" name="password" autoComplete="current-password" minLength={12} maxLength={128}/></label><button className="access-primary" type="submit">{requestedDepartment ? `Open ${requestedDepartment.app_title || requestedDepartment.name}` : "Open department workspace"} <span aria-hidden="true">&#8594;</span></button></form>
        <p className="owner-auth-note">No invitation yet? Ask the platform owner to invite your exact email address.</p>
      </section>
    </main>
  );
}
