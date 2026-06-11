import { useEffect, useRef, useState } from "react";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useDoc } from "./hooks";

// Debounced whole-doc autosave for a per-user picks doc with a hard lock time.
// Hardenings (each one earned by a confirmed pre-launch review finding):
//  - keeps accepting remote snapshots while there are no unsaved local edits,
//    so a stale open tab can never clobber picks made on another device
//  - flushes the pending payload on unmount / tab-hide / pagehide
//  - save-state is generation-guarded so an older write can't report "Saved"
//    over a newer unsaved edit, and a stale failed write never retries over it
//  - skips the debounce in the last seconds before lock
//  - on permission-denied (lock hit server-side), abandons local edits and
//    re-applies the server copy so the read-only view shows the truth
export function useLockedAutosave({ path, lockAt, normalize, toDoc }) {
  const remote = useDoc(path);
  const [value, setValue] = useState(null);
  const [saveState, setSaveState] = useState("idle");
  const [locked, setLocked] = useState(Date.now() >= lockAt);

  const valueRef = useRef(null);
  const editSeq = useRef(0);
  const savedSeq = useRef(0);
  const gen = useRef(0);
  const pendingRef = useRef(null);
  const timer = useRef(null);

  const normalizeRef = useRef(normalize);
  normalizeRef.current = normalize;
  const toDocRef = useRef(toDoc);
  toDocRef.current = toDoc;
  const remoteDataRef = useRef(undefined);
  remoteDataRef.current = remote.data;

  const apply = (v) => {
    valueRef.current = v;
    setValue(v);
  };

  // Re-derive when the effective lock changes — an admin grace can push lockAt
  // into the future (open) or back to the past (close) for a single user.
  useEffect(() => {
    setLocked(Date.now() >= lockAt);
  }, [lockAt]);

  useEffect(() => {
    if (locked) return undefined;
    const t = setInterval(() => {
      if (Date.now() >= lockAt) setLocked(true);
    }, 1000);
    return () => clearInterval(t);
  }, [locked, lockAt]);

  // Hydrate, then keep mirroring the server while local state is clean.
  useEffect(() => {
    if (remote.loading || remote.error) return;
    const clean = editSeq.current <= savedSeq.current && pendingRef.current === null;
    if (valueRef.current !== null && !clean) return;
    const next = normalizeRef.current(remote.data);
    if (valueRef.current !== null && JSON.stringify(next) === JSON.stringify(valueRef.current))
      return;
    apply(next);
  }, [remote.loading, remote.data, remote.error]);

  function doSave(payload, myGen, mySeq) {
    // Offline: setDoc never rejects, it just stays pending — surface that.
    const slow = setTimeout(() => {
      if (myGen === gen.current) setSaveState("pending");
    }, 4000);
    setDoc(doc(db, path), { ...toDocRef.current(payload), updatedAt: serverTimestamp() })
      .then(() => {
        clearTimeout(slow);
        savedSeq.current = Math.max(savedSeq.current, mySeq);
        if (pendingRef.current === payload) pendingRef.current = null;
        if (myGen === gen.current) setSaveState("saved");
      })
      .catch((err) => {
        clearTimeout(slow);
        if (err?.code === "permission-denied") {
          savedSeq.current = editSeq.current;
          pendingRef.current = null;
          setLocked(true);
          setSaveState("locked");
          apply(normalizeRef.current(remoteDataRef.current));
        } else if (myGen === gen.current) {
          console.error(err);
          setSaveState("error");
          timer.current = setTimeout(() => doSave(payload, myGen, mySeq), 4000);
        }
      });
  }

  // Pages compute `next` themselves (they own validation), then hand it here.
  function update(next) {
    editSeq.current += 1;
    pendingRef.current = next;
    apply(next);
    const myGen = ++gen.current;
    const mySeq = editSeq.current;
    setSaveState("saving");
    clearTimeout(timer.current);
    const delay = lockAt - Date.now() < 5000 ? 0 : 800;
    timer.current = setTimeout(() => doSave(next, myGen, mySeq), delay);
  }

  // Best-effort flush when the page goes away mid-debounce.
  useEffect(() => {
    const flush = () => {
      if (!pendingRef.current || Date.now() >= lockAt) return;
      clearTimeout(timer.current);
      const payload = pendingRef.current;
      pendingRef.current = null;
      savedSeq.current = editSeq.current;
      setDoc(doc(db, path), { ...toDocRef.current(payload), updatedAt: serverTimestamp() }).catch(
        () => {}
      );
    };
    const onVis = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", flush);
      flush();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { value, update, saveState, locked, error: remote.error, loading: value === null && !remote.error };
}
