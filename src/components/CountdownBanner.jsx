import { useEffect, useState } from "react";
import { Lock, Timer } from "lucide-react";

function parts(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return {
    d: Math.floor(s / 86400),
    h: Math.floor((s % 86400) / 3600),
    m: Math.floor((s % 3600) / 60),
    s: s % 60,
  };
}

export default function CountdownBanner({ lockAt, label = "Picks lock in" }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const remaining = lockAt - now;
  if (remaining <= 0) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-line bg-panel2 px-3 py-2 text-sm text-dim">
        <Lock size={15} className="text-gold" />
        Picks are locked — the tournament is underway.
      </div>
    );
  }

  const { d, h, m, s } = parts(remaining);
  return (
    <div className="flex items-center gap-2 rounded-lg border border-gold/30 bg-gold/10 px-3 py-2 text-sm">
      <Timer size={15} className="text-gold shrink-0" />
      <span className="text-dim">{label}</span>
      <span className="nums font-display font-bold text-lg text-gold tracking-wide">
        {d > 0 && `${d}d `}
        {String(h).padStart(2, "0")}:{String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
      </span>
    </div>
  );
}
