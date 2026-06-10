import { useEffect, useState } from "react";
import { collection, doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";

// Live document subscription. data: undefined while loading, null if missing.
export function useDoc(path) {
  const [state, setState] = useState({ data: undefined, loading: true, error: null });
  useEffect(() => {
    if (!path) return undefined;
    setState({ data: undefined, loading: true, error: null });
    return onSnapshot(
      doc(db, path),
      (snap) => {
        // A not-exists snapshot served from cache just means we're offline with
        // no local copy — keep "loading" rather than reporting a missing doc,
        // so callers never hydrate an empty editable state from it.
        if (!snap.exists() && snap.metadata.fromCache) return;
        setState({ data: snap.exists() ? snap.data() : null, loading: false, error: null });
      },
      (error) => setState({ data: null, loading: false, error })
    );
  }, [path]);
  return state;
}

// Live collection subscription. docs: array of {id, ...data}.
// `enabled` lets callers hold off until security rules would allow the query
// (e.g. reading everyone's picks only after lock).
export function useCollection(path, enabled = true) {
  const [state, setState] = useState({ docs: [], loading: true, error: null });
  useEffect(() => {
    if (!path || !enabled) return undefined;
    setState({ docs: [], loading: true, error: null });
    return onSnapshot(
      collection(db, path),
      (snap) =>
        setState({
          docs: snap.docs.map((d) => ({ id: d.id, ...d.data() })),
          loading: false,
          error: null,
        }),
      (error) => setState({ docs: [], loading: false, error })
    );
  }, [path, enabled]);
  return state;
}
