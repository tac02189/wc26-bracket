import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";

// Firebase web config values are public identifiers, safe to commit.
const app = initializeApp({
  apiKey: "AIzaSyCdCvwMv1QECG9IYdimI2g6WeT56adlCuE",
  authDomain: "wc26-bracket.firebaseapp.com",
  projectId: "wc26-bracket",
  storageBucket: "wc26-bracket.firebasestorage.app",
  messagingSenderId: "983345033899",
  appId: "1:983345033899:web:a63131643413204c8afdee",
});

export default app;
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
// Durable local cache: queued writes survive tab eviction on phones and replay
// on reconnect; multi-tab manager so a second open tab doesn't break cache init.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});
