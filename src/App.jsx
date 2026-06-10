import { useState } from "react";
import { LogOut, Trophy } from "lucide-react";
import { AuthProvider, signOutUser, useAuth } from "./context/AuthContext";
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
  const [tab, setTab] = useState("picks");
  const { data: settings } = useDoc(user ? "config/settings" : null);

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
        <div className="flex items-center gap-2">
          {user.photoURL && (
            <img
              src={user.photoURL}
              alt={user.displayName ?? ""}
              referrerPolicy="no-referrer"
              className="h-7 w-7 rounded-full ring-1 ring-line"
            />
          )}
          <button
            onClick={signOutUser}
            className="-m-1 p-2.5 text-dim hover:text-ink"
            aria-label="Sign out"
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>

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
