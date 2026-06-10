import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
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
          await setDoc(
            ref,
            {
              displayName: u.displayName ?? "Anonymous",
              photoURL: u.photoURL ?? null,
              lastSeenAt: serverTimestamp(),
              ...(snap.exists() ? {} : { joinedAt: serverTimestamp() }),
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

export async function signOutUser() {
  await signOut(auth);
}
