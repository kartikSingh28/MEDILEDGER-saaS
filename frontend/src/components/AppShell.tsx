import type { ReactNode } from "react";
import { LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { clearSession, getSession } from "../lib/session";
import { Wordmark } from "./ui";

export interface NavItem<K extends string> {
  key: K;
  label: string;
  icon: ReactNode;
  count?: number;
}

const roleLabels = { PATIENT: "Patient", DOCTOR: "Doctor", ADMIN: "Admin" };

// Sidebar on desktop, top bar with scrollable tabs on small screens
export function AppShell<K extends string>({
  nav,
  active,
  onSelect,
  children,
}: {
  nav: NavItem<K>[];
  active: K;
  onSelect: (key: K) => void;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const session = getSession();

  const signOut = () => {
    clearSession();
    navigate("/login");
  };

  const navButtons = nav.map((item) => {
    const selected = item.key === active;
    return (
      <button
        key={item.key}
        onClick={() => onSelect(item.key)}
        aria-current={selected ? "page" : undefined}
        className={`flex shrink-0 items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors md:w-full ${
          selected ? "bg-accent/10 font-medium text-accent" : "text-muted hover:bg-raised hover:text-fg"
        }`}
      >
        <span className={selected ? "text-accent" : ""}>{item.icon}</span>
        <span>{item.label}</span>
        {item.count ? (
          <span className="ml-auto rounded bg-accent/15 px-1.5 text-xs font-medium text-accent">{item.count}</span>
        ) : null}
      </button>
    );
  });

  return (
    <div className="min-h-screen md:flex">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-line bg-panel md:flex">
        <div className="px-5 py-5">
          <Wordmark />
        </div>
        <nav className="flex-1 space-y-0.5 px-3" aria-label="Main">
          {navButtons}
        </nav>
        {session && (
          <div className="border-t border-line px-5 py-4">
            <p className="truncate text-sm font-medium text-fg">{session.name}</p>
            <p className="truncate text-xs text-muted">
              {roleLabels[session.role]} · {session.hospital}
            </p>
            <button onClick={signOut} className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted hover:text-fg">
              <LogOut size={14} aria-hidden /> Sign out
            </button>
          </div>
        )}
      </aside>

      <header className="border-b border-line bg-panel md:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <Wordmark />
          <button onClick={signOut} className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-fg">
            <LogOut size={14} aria-hidden /> Sign out
          </button>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-2" aria-label="Main">
          {navButtons}
        </nav>
      </header>

      <main className="min-w-0 flex-1 px-4 py-6 sm:px-8 sm:py-8">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
    </div>
  );
}
