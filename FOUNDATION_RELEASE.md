# Demo-to-department release rule

Stickney, Fermilab, and future departments use the shared `app/d/[slug]` route. Department identity, saved foundation rules, permissions, and connected records are data; the application shell and foundation components are shared code.

The fictional owner demo remains a separate browser-safe workspace because it uses made-up, device-local records. A fix to one of its mapped areas cannot pass `npm run build` unless the corresponding shared department implementation is also reviewed and the propagation contract is updated.

For every demo fix:

1. Change the appropriate demo asset under `public/`.
2. Make the matching change in the shared department files listed in `foundation/propagation.json`.
3. Run `npm run foundation:sync`. It refuses a demo-only change.
4. Run `npm test` and `npm run build`.
5. Deploy once to `preplan-360`. Stickney, Fermilab, and future `/d/[slug]` departments receive the shared change automatically.
6. Verify `/demo?owner=1`, `/d/stickney`, `/d/fermilab`, and at least one truthful empty state before calling the release complete.

Do not add a department-specific copy of a page or component. A department adapter may read a legacy data source, but it must feed the shared foundation component.
