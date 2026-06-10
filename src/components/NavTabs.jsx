import { BookOpen, GitBranch, ListOrdered, Trophy, Wrench } from "lucide-react";

const TABS = [
  { id: "picks", label: "Picks", icon: ListOrdered },
  { id: "bracket", label: "Bracket", icon: GitBranch },
  { id: "table", label: "Table", icon: Trophy },
  { id: "rules", label: "Rules", icon: BookOpen },
];

export default function NavTabs({ tab, onChange, showAdmin }) {
  const tabs = showAdmin ? [...TABS, { id: "admin", label: "Admin", icon: Wrench }] : TABS;
  return (
    <nav className="fixed bottom-0 inset-x-0 z-20 border-t border-line bg-panel/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto max-w-md grid auto-cols-fr grid-flow-col">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => onChange(id)}
            className={`flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-bold tracking-wide ${
              tab === id ? "text-gold" : "text-dim"
            }`}
          >
            <Icon size={20} strokeWidth={tab === id ? 2.5 : 2} />
            {label}
          </button>
        ))}
      </div>
    </nav>
  );
}
