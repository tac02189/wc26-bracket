import { useState } from "react";
import { LogOut, Pencil, Trophy } from "lucide-react";
import { AuthProvider, signOutUser, updateDisplayName, useAuth } from "./context/AuthContext";
import { useDoc } from "./lib/hooks";
import NavTabs from "./components/NavTabs";
import JoinBanner from "./components/JoinBanner";
import SignIn from "./pages/SignIn";
import Picks from "./pages/Picks";
import Bracket from "./pages/Bracket";
import Leaderboard from "./pages/Leaderboard";
import Rules from "./pages/Rules";
import Admin from "./pages/Admin";

const PAGES = { picks: Picks, bracket: Bracket, table: Leaderboard, rules: Rules, admin: Admin };

function Shell() {
  const { user } = useAuth();
  const [tab, setTab] = useState("table");
  const { data: settings } = useDoc(user ? "config/settings" : null);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [savingName, setSavingName] = useState(false);

  async function saveName() {
    const nm = nameDraft.trim();
    if (!nm) return;
    setSavingName(true);
    try {
      await updateDisplayName(nm);
      setEditingName(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSavingName(false);
    }
  }

  if (user === undefined) {
    return (
      <div className="min-h-dvh grid place-items-center">
        <Trophy size={40} className="animate-pulse text-gold" strokeWidth={1.5} />
      </div>
    );
  }
  if (!user) return <SignIn />;

  const Page = PAGES[tab] ?? Picks;
  // Cosmetic gate only — firestore.rules isAdmin() (same email) is the real one.
  const isAdmin =
    user.email === "tac02189@gmail.com" ||
    (!!settings?.adminUid && settings.adminUid === user.uid);

  return (
    <div className="mx-auto min-h-dvh max-w-md px-3 pb-24 pt-[env(safe-area-inset-top)]">
      <header className="flex items-center justify-between py-3">
        <span className="font-display font-bold text-2xl tracking-wide">
          WC<span className="text-gold">26</span> POOL
        </span>
        <div className="flex min-w-0 items-center gap-2">
          <button
            onClick={() => {
              setNameDraft(user.displayName ?? "");
              setEditingName((v) => !v);
            }}
            className="flex min-w-0 items-center gap-1.5 text-dim hover:text-ink"
            aria-label="Change your name"
          >
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt=""
                referrerPolicy="no-referrer"
                className="h-7 w-7 shrink-0 rounded-full ring-1 ring-line"
              />
            ) : (
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-panel2 font-display font-bold text-dim">
                {(user.displayName ?? "?")[0]}
              </span>
            )}
            <span className="max-w-[5.5rem] truncate text-sm">{user.displayName ?? "Set name"}</span>
            <Pencil size={13} className="shrink-0" />
          </button>
          <button
            onClick={signOutUser}
            className="-m-1 shrink-0 p-2.5 text-dim hover:text-ink"
            aria-label="Sign out"
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {editingName && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-gold/40 bg-panel px-3 py-2">
          <input
            autoFocus
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && saveName()}
            placeholder="Your name"
            maxLength={40}
            className="min-w-0 flex-1 rounded-lg border border-line bg-panel2 px-3 py-2 text-sm text-ink placeholder:text-dim/60"
          />
          <button
            onClick={saveName}
            disabled={savingName || !nameDraft.trim()}
            className="shrink-0 rounded-lg bg-gold px-3 py-2 text-sm font-bold text-pitch disabled:opacity-50"
          >
            {savingName ? "…" : "Save"}
          </button>
          <button onClick={() => setEditingName(false)} className="shrink-0 px-1 text-sm text-dim">
            Cancel
          </button>
        </div>
      )}

      <JoinBanner uid={user.uid} onJoined={() => setTab("table")} />

      {settings?.notice && (
        <div className="mb-3 rounded-lg border border-gold/40 bg-gold/10 px-3 py-2 text-sm">
          {settings.notice}
        </div>
      )}

      <main>
        <Page />
      </main>

      <NavTabs tab={tab} onChange={setTab} showAdmin={isAdmin} />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  );
}
