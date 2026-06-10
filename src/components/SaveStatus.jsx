import { Check, CloudOff, Loader2, Lock } from "lucide-react";

const STATES = {
  idle: null,
  saving: { icon: Loader2, text: "Saving…", cls: "text-dim", spin: true },
  saved: { icon: Check, text: "Saved", cls: "text-live" },
  pending: { icon: CloudOff, text: "Offline — will sync", cls: "text-gold" },
  error: { icon: CloudOff, text: "Save failed — retrying", cls: "text-bad" },
  locked: { icon: Lock, text: "Picks are locked", cls: "text-gold" },
};

export default function SaveStatus({ state }) {
  const s = STATES[state];
  if (!s) return null;
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs ${s.cls}`}>
      <Icon size={13} className={s.spin ? "animate-spin" : ""} />
      {s.text}
    </span>
  );
}
