import {
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../firebase";

// Leagues are named slices of the one global pool. Everyone makes a single set
// of picks; a league only changes who you're ranked against. Membership lives
// on the user doc as `leagues: { [code]: name }` (name denormalized for display);
// `leagues/{code}` is the admin-owned source of truth. The doc id IS the code,
// so joining is a direct getDoc — no collection query, no open listing.

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I/O/0/1 ambiguity

function suffix(n = 4) {
  let s = "";
  for (let i = 0; i < n; i++) s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return s;
}

function slug(name) {
  return (name || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8) || "LEAGUE";
}

export function joinLink(code) {
  return `https://wc26-bracket.web.app/?join=${code}`;
}

// Admin-only (enforced in firestore.rules). Returns the new code.
export async function createLeague(name, ownerUid) {
  const clean = name.trim();
  let code = `${slug(clean)}-${suffix()}`;
  for (let i = 0; i < 5 && (await getDoc(doc(db, "leagues", code))).exists(); i++) {
    code = `${slug(clean)}-${suffix()}`;
  }
  await setDoc(doc(db, "leagues", code), {
    name: clean,
    ownerUid,
    createdAt: serverTimestamp(),
  });
  return code;
}

export async function getLeague(code) {
  const snap = await getDoc(doc(db, "leagues", code.trim().toUpperCase()));
  return snap.exists() ? { code: snap.id, ...snap.data() } : null;
}

export async function listLeagues() {
  const snap = await getDocs(collection(db, "leagues"));
  return snap.docs.map((d) => ({ code: d.id, ...d.data() }));
}

// Members write only their own user doc; merge:true keeps other joined leagues.
export async function joinLeague(uid, code, name) {
  await setDoc(doc(db, "users", uid), { leagues: { [code]: name } }, { merge: true });
}

export async function leaveLeague(uid, code) {
  await updateDoc(doc(db, "users", uid), { [`leagues.${code}`]: deleteField() });
}
