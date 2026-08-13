import { chatGPTSignOutPath, requireOwnerUser } from "@/app/chatgpt-auth";
import { ownerCredentialExists } from "@/app/owner-auth";
import { isOwner, listDepartments, listPendingRequests, ownerCount, upsertIdentity } from "@/db/access";

export const dynamic = "force-dynamic";

export default async function OwnerConsole({ searchParams }: { searchParams: Promise<{ password_error?: string }> }) {
  const query = await searchParams;
  const user = await requireOwnerUser("/owner");
  await upsertIdentity(user);
  const owners = await ownerCount();
  const authorized = await isOwner(user.userId);

  if (!owners) return <main className="access-shell owner-shell">
    <header className="access-header"><a href="/" className="access-brand">PrePlan <span>360</span><small>Owner control</small></a><div className="access-account"><span>{user.email}</span><a href={chatGPTSignOutPath("/")}>Sign out</a></div></header>
    <section className="owner-claim"><div className="access-kicker">ONE-TIME OWNER SETUP</div><h1>Claim the platform-owner account.</h1><p>This private setup binds owner authority to your verified identity and permanently locks first-visitor setup. Complete this before allowing department users onto the launch page.</p><div className="claim-identity"><span>Verified identity</span><b>{user.displayName}</b><small>{user.email}</small></div><form method="post" action="/api/owner/bootstrap"><label className="claim-check"><input required type="checkbox" name="confirm" value="yes"/> I am the authorized PrePlan 360 platform owner.</label><button className="access-primary" type="submit">Claim owner access <span>→</span></button></form></section>
  </main>;

  if (!authorized) return <main className="access-shell"><section className="owner-claim"><div className="access-kicker">ACCESS DENIED</div><h1>Owner access is assigned to another account.</h1><p>Your sign-in is valid, but it has no platform-owner role. Use Department Sign In or contact the platform owner.</p><a className="access-primary" href="/portal">Go to department sign in</a></section></main>;

  if (!(await ownerCredentialExists(user.userId))) return <main className="access-shell owner-shell">
    <header className="access-header"><a href="/" className="access-brand">PrePlan <span>360</span><small>Owner security</small></a><div className="access-account"><span>{user.email}</span><a href={chatGPTSignOutPath("/")}>Sign out</a></div></header>
    <section className="owner-claim owner-auth-card"><div className="access-kicker">FINAL OWNER SETUP</div><h1>Create your permanent password.</h1><p>Your owner identity is verified. This password will replace first-time identity setup for Owner Command and will never be stored in readable form.</p><div className="claim-identity"><span>Permanent owner account</span><b>{user.displayName}</b><small>{user.email}</small></div>{query.password_error ? <div className="owner-auth-error" role="alert">{query.password_error === "match" ? "The two passwords did not match." : "Use a password between 12 and 128 characters."}</div> : null}<form method="post" action="/api/owner/password" className="owner-auth-form"><label>New password<input required type="password" name="password" autoComplete="new-password" minLength={12} maxLength={128}/></label><label>Confirm password<input required type="password" name="password_confirmation" autoComplete="new-password" minLength={12} maxLength={128}/></label><button className="access-primary" type="submit">Create password and open Owner Command <span>→</span></button></form><p className="owner-auth-note">Use at least 12 characters. A long, unique passphrase is recommended.</p></section>
  </main>;

  const [departments, requests] = await Promise.all([listDepartments(), listPendingRequests()]);
  return <main className="access-shell owner-shell">
    <header className="access-header"><a href="/" className="access-brand">PrePlan <span>360</span><small>Owner control</small></a><div className="access-account"><span>Platform owner · {user.displayName}</span><form method="post" action="/api/owner/logout"><button className="owner-signout" type="submit">Sign out</button></form></div></header>
    <section className="access-page owner-page">
      <div className="owner-title"><div><div className="access-kicker">OWNER COMMAND</div><h1>Department builds</h1><p>Grow the platform, approve department administrators, and enter visible, audited support sessions.</p></div><div className="owner-title-actions"><span className="owner-secure"><i/> Owner verified</span><a className="access-secondary" href="/owner/integrations">CAD & email setup</a><a className="access-secondary" href="/owner/demo">Open development build</a></div></div>
      <div className="owner-metrics"><article><small>Departments</small><b>{departments.length}</b></article><article><small>Pending access</small><b>{requests.length}</b></article><article><small>Support model</small><b>Audited</b></article></div>
      <div className="owner-columns">
        <section><div className="owner-section-head"><div><span>DEPARTMENTS</span><h2>Managed builds</h2></div></div><form className="owner-create" method="post" action="/api/owner/departments"><input required name="name" placeholder="New department name"/><input name="slug" placeholder="Web shortcut (optional)"/><button className="access-primary" type="submit">+ Add department</button></form><div className="owner-list">{departments.length ? departments.map((department) => <article key={department.id}><div><span className={`owner-state ${department.status}`}>{department.status}</span><h3>{department.name}</h3><p>/d/{department.slug} · {department.station_count} stations · {department.vehicle_count} vehicles</p><a className="owner-app-link" href={`/d/${department.slug}`}>View branded app</a></div><form method="post" action="/api/owner/support"><input type="hidden" name="department_id" value={department.id}/><input required name="reason" aria-label={`Support reason for ${department.name}`} placeholder="Reason for support access"/><button className="access-primary" type="submit">Enter support</button></form></article>) : <div className="access-empty compact"><p>No departments yet. Create the first department build above.</p></div>}</div></section>
        <section><div className="owner-section-head"><div><span>ACCESS QUEUE</span><h2>First-time logins</h2></div></div><div className="request-list">{requests.length ? requests.map((accessRequest) => <article key={accessRequest.id}><div><b>{accessRequest.display_name}</b><small>{accessRequest.email}</small></div><p><strong>{accessRequest.department_name}</strong><br/>{accessRequest.requested_role.replaceAll("_", " ")} · {accessRequest.note || "No note"}</p><form method="post" action="/api/owner/access-requests"><input type="hidden" name="request_id" value={accessRequest.id}/><select required name="department_id" defaultValue=""><option value="" disabled>Select department</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select><button className="access-primary" name="action" value="approve" type="submit">Approve</button><button className="access-secondary" name="action" value="deny" type="submit">Deny</button></form></article>) : <div className="access-empty compact"><p>No department access requests are waiting.</p></div>}</div></section>
      </div>
    </section>
  </main>;
}
