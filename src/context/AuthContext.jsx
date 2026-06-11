import { createContext, useContext, useEffect, useState } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db, googleProvider } from "../firebase";

const AuthCtx = createContext({ user: undefined });

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = auth state still loading

  useEffect(
    () =>
      onAuthStateChanged(auth, async (u) => {
        setUser(u);
        if (!u) return;
        try {
          const ref = doc(db, "users", u.uid);
          const snap = await getDoc(ref);
          const existing = snap.exists() ? snap.data() : null;
          await setDoc(
            ref,
            {
              displayName: u.displayName ?? existing?.displayName ?? "Anonymous",
              photoURL: u.photoURL ?? existing?.photoURL ?? null,
              lastSeenAt: serverTimestamp(),
              ...(existing ? {} : { joinedAt: serverTimestamp() }),
            },
            { merge: true }
          );
        } catch (err) {
          console.error("profile upsert failed", err);
        }
      }),
    []
  );

  return <AuthCtx.Provider value={{ user }}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);

export async function signInWithGoogle() {
  await signInWithPopup(auth, googleProvider);
}

// PIN sign-in for people without an email. Each PIN is a pre-created account
// (synthetic email + padded password) made by scripts/pin-setup. The derivation
// here MUST match that script. The person only ever sees a name + 4-digit PIN.
export const pinEmail = (pin) => `pin${String(pin).trim()}@wc26pool.app`;
export const pinPassword = (pin) => `${String(pin).trim()}wc26pin`;

export async function signInWithPin(pin, name) {
  const cred = await signInWithEmailAndPassword(auth, pinEmail(pin), pinPassword(pin));
  const nm = (name || "").trim();
  if (nm && nm !== cred.user.displayName) {
    await updateProfile(cred.user, { displayName: nm });
    await setDoc(doc(db, "users", cred.user.uid), { displayName: nm }, { merge: true });
  }
}

export async function updateDisplayName(name) {
  const nm = (name || "").trim();
  if (!nm || !auth.currentUser) return;
  await updateProfile(auth.currentUser, { displayName: nm });
  await setDoc(doc(db, "users", auth.currentUser.uid), { displayName: nm }, { merge: true });
}

export async function signOutUser() {
  await signOut(auth);
}
