import { redirect } from "next/navigation";
import { chatGPTSignInPath, getOwnerBootstrapUser } from "@/app/chatgpt-auth";
import { getOwnerSessionUser, ownerCredentialCount } from "@/app/owner-auth";

export const dynamic = "force-dynamic";

function safeReturnTo(value: string | undefined): string {
  if (!value?.startsWith("/") || value.startsWith("//")) return "/owner";
  return value.startsWith("/owner") ? value : "/owner";
}

export default async function OwnerSignIn({ searchParams }: { searchParams: Promise<{ error?: string; return_to?: string }> }) {
  const query = await searchParams;
  const returnTo = safeReturnTo(query.return_to);
  if (await getOwnerSessionUser()) redirect(returnTo);

  const credentialsReady = (await ownerCredentialCount()) > 0;
  if (!credentialsReady && (await getOwnerBootstrapUser())) redirect("/owner");
  const previewSetup = !credentialsReady && process.env.VERCEL_ENV === "preview";

  return <main className="access-shell owner-shell">
    <header className="access-header"><a href="/" className="access-brand">PrePlan <span>360</span><small>Owner access</small></a><div className="access-account"><a href="/">Return to launch page</a></div></header>
    <section className="owner-claim owner-auth-card">
      <div className="access-kicker">{credentialsReady ? "SECURE OWNER SIGN IN" : "FIRST-TIME OWNER SETUP"}</div>
      <h1>{credentialsReady ? "Sign in to Owner Command." : "Create the first owner."}</h1>
      {credentialsReady ? <>
        <p>Use the permanent owner email and password created during first-time setup. Department credentials cannot open this area.</p>
        {query.error ? <div className="owner-auth-error" role="alert">The email or password was not accepted. Try again, or wait 15 minutes if the account is temporarily locked.</div> : null}
        <form method="post" action="/api/owner/login" className="owner-auth-form"><input type="hidden" name="return_to" value={returnTo}/><label>Owner email<input required type="email" name="email" autoComplete="username" inputMode="email"/></label><label>Password<input required type="password" name="password" autoComplete="current-password" minLength={12} maxLength={128}/></label><button className="access-primary" type="submit">Sign in to Owner Command <span>→</span></button></form>
        <p className="owner-auth-note">Five unsuccessful attempts temporarily lock password sign-in for 15 minutes.</p>
      </> : previewSetup ? <>
        <p>This protected Vercel preview is the only place where the first owner can be created. Choose your permanent password now; production setup will close automatically.</p>
        {query.error ? <div className="owner-auth-error" role="alert">Owner setup was not completed. Check every field and use matching passwords of at least 12 characters.</div> : null}
        <form method="post" action="/api/owner/setup" className="owner-auth-form"><label>Your name<input required name="display_name" autoComplete="name" maxLength={120}/></label><label>Owner email<input required type="email" name="email" autoComplete="username" inputMode="email" maxLength={254}/></label><label>New password<input required type="password" name="password" autoComplete="new-password" minLength={12} maxLength={128}/></label><label>Confirm password<input required type="password" name="password_confirmation" autoComplete="new-password" minLength={12} maxLength={128}/></label><button className="access-primary" type="submit">Create permanent owner <span>→</span></button></form>
      </> : <>
        <p>The first owner must be created from the protected Vercel preview before production owner sign-in can open. No public visitor can claim this account.</p>
        <a className="access-primary" href={chatGPTSignInPath("/owner")}>Verify owner identity <span>→</span></a>
      </>}
    </section>
  </main>;
}
