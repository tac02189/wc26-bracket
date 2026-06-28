// Sends the two pool reminder emails, driven by the same Firebase data the app
// scores against. Runs on a GitHub Actions cron (see .github/workflows/reminders.yml,
// every ~15 min) and is idempotent: a per-reminder flag in config/reminders is
// claimed in a transaction BEFORE sending, so the repeating cron sends each
// reminder exactly once (at-most-once — a hard crash mid-send won't resend, but
// every failure is logged so the few can be followed up by hand).
//
//   1. "Bracket is open"  — fires when config/settings.phase === "bracket-open"
//      (the results bot sets that the moment the group stage is final and the real
//      Round of 32 is known). Goes to everyone with a real, verified email.
//   2. "2 hours to lock"  — fires inside the 2h window before BRACKET_LOCK_AT.
//      Goes ONLY to people whose bracket isn't complete yet.
//
// Recipients come from Firebase Auth (Google sign-ins carry a verified email).
// PIN accounts are synthetic pin{N}@wc26pool.app addresses with no inbox — they're
// filtered out by both emailVerified and the domain. A user can be muted by hand
// by setting users/{uid}.emailOptOut = true in Firestore.
//
// Env: FIREBASE_SERVICE_ACCOUNT (full JSON string), GMAIL_USER, GMAIL_APP_PASSWORD.

import { pathToFileURL } from "node:url";
import { cert, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import nodemailer from "nodemailer";

const APP_URL = "https://wc26-bracket.web.app";

// Mirror of BRACKET_LOCK_AT in src/data/schedule.js and bracketLock() in
// firestore.rules — keep all THREE in sync if the lock instant ever moves.
const BRACKET_LOCK_AT = Date.UTC(2026, 5, 28, 19, 0, 0);
const LOCK_LEAD_MS = 2 * 60 * 60 * 1000; // send the second reminder this far ahead
const LOCK_HUMAN = "2:00 PM CT (3:00 PM ET · 19:00 UTC)";

// All pickable knockout slots, per src/data/bracketStructure.js: R32 73–88,
// R16 89–96, QF 97–100, SF 101–102, Final 104. Third place (103) is never picked,
// so a bracket is "complete" when all 31 of these have a winner.
const BRACKET_SLOTS = (() => {
  const slots = [];
  for (let n = 73; n <= 102; n++) slots.push(`M${n}`); // R32 → SF, contiguous
  slots.push("M104"); // Final
  return slots;
})();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function need(name) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} missing`);
  return v;
}

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Real, reachable recipients only: a verified email that isn't a synthetic PIN
// address. listUsers paginates 1000 at a time.
async function listRealUsers(auth) {
  const out = [];
  let pageToken;
  do {
    const res = await auth.listUsers(1000, pageToken);
    for (const u of res.users) {
      if (!u.email || !u.emailVerified) continue;
      if (u.email.endsWith("@wc26pool.app")) continue;
      out.push({ uid: u.uid, email: u.email, name: (u.displayName || "").trim() });
    }
    pageToken = res.pageToken;
  } while (pageToken);
  return out;
}

async function fetchOptOuts(db) {
  const snap = await db.collection("users").get();
  const out = new Set();
  snap.forEach((d) => {
    if (d.data()?.emailOptOut === true) out.add(d.id);
  });
  return out;
}

// uids whose bracket has a winner in all 31 pickable slots. Admin SDK reads the
// whole collection freely — the "no collection queries before lock" invariant is
// a client/rules concern, not a server one.
async function fetchCompletedBracketUids(db) {
  const snap = await db.collection("bracketPicks").get();
  const done = new Set();
  snap.forEach((d) => {
    const w = d.data()?.winners || {};
    if (BRACKET_SLOTS.every((s) => w[s])) done.add(d.id);
  });
  return done;
}

// Flip a config/reminders flag false→true atomically. Returns true only for the
// run that won the claim, so concurrent/overlapping cron runs can't double-send.
async function claim(db, key) {
  const ref = db.doc("config/reminders");
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists && snap.data()?.[key]) return false;
    tx.set(ref, { [key]: true, [`${key}At`]: FieldValue.serverTimestamp() }, { merge: true });
    return true;
  });
}

// Full HTML document (not a bare div) so we can declare the email dark-native —
// without `color-scheme: dark` Gmail's phone dark mode deepens the greens into a
// muddy block. Contrast is built in too: a lighter panel2 card on the darker
// pitch background, a gold top bar + headline underline, and the app's condensed
// display font (Barlow Condensed, Arial Narrow fallback) for the brand/headline.
function htmlShell(headline, bodyHtml, ctaLabel) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>WC26 Pool</title>
<style>
  :root { color-scheme: dark; supported-color-schemes: dark; }
  @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&display=swap');
  body { margin:0 !important; padding:0 !important; background:#013d23; }
</style>
</head>
<body style="margin:0;padding:0;background:#013d23;">
  <div style="padding:24px 12px;background:#013d23;font-family:Arial,Helvetica,sans-serif;">
    <div style="max-width:480px;margin:0 auto;background:#0f5e38;border:1px solid #2a7d52;border-radius:14px;overflow:hidden;">
      <div style="height:4px;line-height:4px;font-size:4px;background:#ffdf00;">&nbsp;</div>
      <div style="padding:18px 24px;background:#0a512f;border-bottom:1px solid #1a6340;">
        <span style="font-family:'Barlow Condensed','Arial Narrow',Arial,sans-serif;font-size:26px;font-weight:700;letter-spacing:1.5px;color:#ffffff;">WC<span style="color:#ffdf00;">26</span> POOL</span>
      </div>
      <div style="padding:24px;color:#f3faf5;font-size:15px;line-height:1.6;">
        <h1 style="margin:0 0 8px;font-family:'Barlow Condensed','Arial Narrow',Arial,sans-serif;font-size:23px;font-weight:700;letter-spacing:.4px;color:#ffdf00;">${headline}</h1>
        <div style="width:40px;height:3px;border-radius:2px;background:#ffdf00;margin:0 0 16px;"></div>
        ${bodyHtml}
        <div style="margin:24px 0 4px;">
          <a href="${APP_URL}" style="display:inline-block;background:#ffdf00;color:#013d23;font-weight:700;text-decoration:none;padding:13px 24px;border-radius:10px;font-size:15px;">${ctaLabel}</a>
        </div>
      </div>
      <div style="padding:14px 24px;background:#0a512f;border-top:1px solid #1a6340;color:#a7cbb8;font-size:12px;">
        Reply “stop” to opt out of these reminders.
      </div>
    </div>
  </div>
</body>
</html>`;
}

export function buildBracketOpen({ name }) {
  const hi = name ? `Hi ${name},` : "Hi there,";
  const hiHtml = name ? `Hi ${escapeHtml(name)},` : "Hi there,";
  const text = [
    hi,
    "",
    "The group stage is done and the real Round of 32 is set — your knockout bracket is now open.",
    "",
    "Pick winners round by round, all the way to the champion. The further a pick survives, the more points it banks.",
    "",
    `Fill it here: ${APP_URL}`,
    "",
    `Heads up: brackets lock Sunday, June 28 at ${LOCK_HUMAN}, right before the first Round-of-32 match. Picks are final after that.`,
    "",
    "— WC26 Pool",
    "",
    '(Getting these by mistake? Just reply "stop" and I\'ll take you off the list.)',
  ].join("\n");
  const html = htmlShell(
    "Your bracket is open",
    `<p style="margin:0 0 12px;">${hiHtml}</p>
     <p style="margin:0 0 12px;">The group stage is done and the real <strong>Round of 32</strong> is set — your knockout bracket is now open.</p>
     <p style="margin:0 0 12px;">Pick winners round by round, all the way to the champion. The further a pick survives, the more points it banks.</p>
     <p style="margin:0;color:#a7cbb8;">Brackets lock <strong style="color:#f3faf5;">Sunday, June 28 at ${LOCK_HUMAN}</strong>, right before the first Round-of-32 match. Picks are final after that.</p>`,
    "Open your bracket"
  );
  return { subject: "Your WC26 bracket is open", text, html };
}

export function buildLockSoon({ name }) {
  const hi = name ? `Hi ${name},` : "Hi there,";
  const hiHtml = name ? `Hi ${escapeHtml(name)},` : "Hi there,";
  const text = [
    hi,
    "",
    `Last call — your bracket isn't finished yet, and picks lock today at ${LOCK_HUMAN}, just a couple hours away.`,
    "",
    `Finish it here: ${APP_URL}`,
    "",
    "Once it locks your picks are final, and any match you leave blank scores zero. Don't leave points on the table.",
    "",
    "— WC26 Pool",
    "",
    '(Reply "stop" to opt out of these reminders.)',
  ].join("\n");
  const html = htmlShell(
    "Last call to lock your bracket",
    `<p style="margin:0 0 12px;">${hiHtml}</p>
     <p style="margin:0 0 12px;">Your bracket <strong>isn't finished yet</strong>, and picks lock today at <strong style="color:#ffdf00;">${LOCK_HUMAN}</strong> — just a couple hours away.</p>
     <p style="margin:0;color:#a7cbb8;">Once it locks your picks are final, and any match you leave blank scores zero. Don't leave points on the table.</p>`,
    "Finish your bracket"
  );
  return { subject: "Last call — lock your WC26 bracket today", text, html };
}

// Mirrors r32Ready in src/pages/Bracket.jsx: the tab only opens once every R32
// match has BOTH teams. football-data fills the third-place slots late, so
// config/settings.phase can read "bracket-open" while the bracket is still gated
// for users — don't announce it until it's genuinely fillable.
async function r32Ready(db) {
  const m = (await db.doc("results/knockout").get()).data()?.matches || {};
  for (let n = 73; n <= 88; n++) {
    const x = m[`M${n}`];
    if (!x || !x.home || !x.away) return false;
  }
  return true;
}

async function sendAll(transport, from, recipients, build) {
  let sent = 0;
  const failures = [];
  for (const r of recipients) {
    const { subject, text, html } = build(r);
    try {
      await transport.sendMail({ from, to: r.email, subject, text, html });
      sent++;
    } catch (err) {
      failures.push(`${r.email}: ${err?.message || err}`);
    }
    await sleep(200); // be gentle on Gmail's SMTP
  }
  return { sent, failures };
}

async function main() {
  const svc = JSON.parse(need("FIREBASE_SERVICE_ACCOUNT").replace(/^﻿/, "").trim());
  initializeApp({ credential: cert(svc) });
  const db = getFirestore();
  const auth = getAuth();

  const phase = (await db.doc("config/settings").get()).data()?.phase ?? null;
  const now = Date.now();
  const wantBracketOpen = phase === "bracket-open";
  const wantLockSoon = now >= BRACKET_LOCK_AT - LOCK_LEAD_MS && now < BRACKET_LOCK_AT;

  if (!wantBracketOpen && !wantLockSoon) {
    console.log(`nothing to send (phase=${phase}, now=${new Date(now).toISOString()})`);
    return;
  }

  const from = `"WC26 Pool" <${need("GMAIL_USER")}>`;
  const transport = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user: need("GMAIL_USER"), pass: need("GMAIL_APP_PASSWORD") },
  });

  // Fetch the audience once and reuse across both reminders.
  let everyone = null;
  let optOut = null;
  async function audience() {
    if (!everyone) [everyone, optOut] = await Promise.all([listRealUsers(auth), fetchOptOuts(db)]);
    return everyone.filter((u) => !optOut.has(u.uid));
  }

  const failures = [];

  if (wantBracketOpen) {
    if (!(await r32Ready(db))) {
      console.log("phase=bracket-open but the R32 draw isn't complete yet — holding the 'bracket is open' email");
    } else if (await claim(db, "bracketOpenSent")) {
      const recipients = await audience();
      const { sent, failures: f } = await sendAll(transport, from, recipients, buildBracketOpen);
      console.log(`bracket-open: sent ${sent}/${recipients.length}`);
      failures.push(...f);
    }
  }

  if (wantLockSoon && (await claim(db, "lockSoonSent"))) {
    const [recipients, completed] = await Promise.all([audience(), fetchCompletedBracketUids(db)]);
    const unfinished = recipients.filter((u) => !completed.has(u.uid));
    const { sent, failures: f } = await sendAll(transport, from, unfinished, buildLockSoon);
    console.log(`lock-soon: sent ${sent}/${unfinished.length} (skipped ${completed.size} completed brackets)`);
    failures.push(...f);
  }

  if (failures.length) {
    console.error(`some emails failed (flag already claimed — follow up by hand):\n${failures.join("\n")}`);
    process.exit(1);
  }
}

// Only run when invoked directly (node scripts/reminders.mjs) — importing this
// module for its builders (tests) must not kick off a live send.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
