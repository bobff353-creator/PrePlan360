import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  departmentSlugFromReturnTo,
  memberLandingPath,
  safeMemberReturnTo,
} from "../app/member-routing.mjs";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("a one-department Fermilab account cannot be returned to a stale Stickney page", () => {
  assert.equal(memberLandingPath({
    returnTo: "/d/stickney?module=live-ops",
    membershipSlugs: ["fermilab"],
  }), "/d/fermilab");
});

test("an explicit Fermilab sign-in wins for a member assigned to multiple departments", () => {
  assert.equal(memberLandingPath({
    returnTo: "/d/stickney?module=live-ops",
    requestedDepartment: "fermilab",
    membershipSlugs: ["stickney", "fermilab"],
  }), "/d/fermilab");
});

test("authorized deep links are preserved and generic multi-department login uses the chooser", () => {
  assert.equal(memberLandingPath({
    returnTo: "/d/fermilab?module=scheduling",
    membershipSlugs: ["fermilab", "stickney"],
  }), "/d/fermilab?module=scheduling");
  assert.equal(memberLandingPath({ returnTo: "/portal", membershipSlugs: ["fermilab", "stickney"] }), "/portal");
  assert.equal(departmentSlugFromReturnTo("/d/fermilab"), "fermilab");
  assert.equal(safeMemberReturnTo("https://evil.example/d/fermilab"), "/portal");
});

test("member login switches out of an owner session and owner UI gives a tenant-specific link", async () => {
  const [route, accessPage, ownerPage] = await Promise.all([
    read("app/api/member/login/route.ts"),
    read("app/department-access/page.tsx"),
    read("app/owner/page.tsx"),
  ]);
  assert.match(route, /listMemberships/);
  assert.match(route, /memberLandingPath/);
  assert.match(route, /revokeCurrentOwnerSession/);
  assert.match(route, /clearOwnerSessionCookies/);
  assert.match(accessPage, /name="department_slug"/);
  assert.match(ownerPage, /department-access\?department=/);
});
