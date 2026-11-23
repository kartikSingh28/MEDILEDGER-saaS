import { forwardRef } from "react";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import { AlertCircle, CheckCircle2, Info } from "lucide-react";

/* =========================
   Buttons
========================= */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-accent text-accent-fg shadow-button hover:bg-accent-hover active:bg-accent-hover",
  secondary: "border border-line-strong bg-panel text-fg shadow-button hover:border-faint hover:bg-raised",
  ghost: "text-muted hover:bg-raised hover:text-fg",
  danger: "border border-danger/40 bg-panel text-danger shadow-button hover:bg-danger/5",
};

export function Button({
  variant = "secondary",
  size = "md",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: "sm" | "md" }) {
  const sizing = size === "sm" ? "h-8 px-3 text-sm" : "h-10 px-4 text-sm";
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${sizing} ${buttonVariants[variant]} ${className}`}
      {...props}
    />
  );
}

/* =========================
   Form fields
========================= */

// A tinted fill plus a ring on focus, so a field reads as a field on a white
// card rather than as an outlined rectangle.
const fieldClass =
  "h-10 w-full rounded-lg border border-line-strong bg-canvas px-3 text-sm text-fg transition-colors placeholder:text-faint hover:border-faint focus:border-accent focus:bg-panel focus:outline-none focus:ring-4 focus:ring-accent/10";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className = "", ...props }, ref) {
    return <input ref={ref} className={`${fieldClass} ${className}`} {...props} />;
  }
);

export function Select({ className = "", ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`${fieldClass} ${className}`} {...props} />;
}

export function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-fg">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-faint">{hint}</p>}
    </div>
  );
}

/* =========================
   Feedback
========================= */

const noticeTones = {
  success: { className: "border-ok/30 bg-ok/5 text-ok", Icon: CheckCircle2 },
  error: { className: "border-danger/30 bg-danger/5 text-danger", Icon: AlertCircle },
  info: { className: "border-line-strong bg-raised text-muted", Icon: Info },
};

export function Notice({ tone, children }: { tone: keyof typeof noticeTones; children: ReactNode }) {
  const { className, Icon } = noticeTones[tone];
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`flex items-start gap-2.5 rounded-lg border px-3.5 py-2.5 text-sm leading-relaxed ${className}`}
    >
      <Icon size={16} className="mt-0.5 shrink-0" aria-hidden />
      <span>{children}</span>
    </div>
  );
}

export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-muted">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-line-strong border-t-accent" aria-hidden />
      {label}
    </span>
  );
}

/* =========================
   Status + labels
========================= */

const statusStyles: Record<string, string> = {
  PENDING: "border-warn/30 bg-warn/5 text-warn",
  APPROVED: "border-ok/30 bg-ok/5 text-ok",
  DENIED: "border-danger/30 bg-danger/5 text-danger",
  // Set by the consent contract, not by the patient
  EXPIRED: "border-line-strong bg-raised text-muted",
  EXHAUSTED: "border-line-strong bg-raised text-muted",
  INVALIDATED: "border-danger/30 bg-danger/5 text-danger",
};

const statusLabels: Record<string, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  DENIED: "Denied",
  EXPIRED: "Expired",
  EXHAUSTED: "Used up",
  INVALIDATED: "Invalidated",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium ${
        statusStyles[status] ?? "border-line-strong bg-raised text-muted"
      }`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {statusLabels[status] ?? status}
    </span>
  );
}

// A hospital name, flagged when it differs from the viewer's own hospital
export function HospitalTag({ name, ownHospital }: { name: string; ownHospital?: string }) {
  const other = Boolean(ownHospital) && name !== ownHospital;
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5 text-xs text-muted">
      {name}
      {other && <span className="rounded border border-accent/40 px-1.5 py-px text-[11px] text-accent">other hospital</span>}
    </span>
  );
}

/* =========================
   Layout pieces
========================= */

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold text-fg">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-lg border border-line bg-panel shadow-panel ${className}`}>{children}</div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="px-6 py-12 text-center">
      <p className="text-sm font-medium text-fg">{title}</p>
      {children && <div className="mt-1 text-sm text-muted">{children}</div>}
    </div>
  );
}

// Table wrapper that scrolls sideways on narrow screens instead of breaking the page.
// `[&_tbody_tr:last-child_td]:border-0` drops the rule under the final row so it
// does not double up with the panel's own border.
export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm [&_tbody_tr:hover]:bg-canvas/70 [&_tbody_tr:last-child_td]:border-0">
        {children}
      </table>
    </div>
  );
}

export function Th({ children, className = "" }: { children?: ReactNode; className?: string }) {
  return (
    <th
      scope="col"
      className={`border-b border-line bg-canvas px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-faint first:rounded-tl-lg last:rounded-tr-lg ${className}`}
    >
      {children}
    </th>
  );
}

export function Td({ children, className = "" }: { children?: ReactNode; className?: string }) {
  return <td className={`border-b border-line px-4 py-3.5 align-middle ${className}`}>{children}</td>;
}

// A record tile with a pulse through it: the health side of the product on the
// block the ledger stores it as. One flat shape, so it stays sharp at favicon
// size, and coloured from the accent token so it follows the theme.
export function Logo({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden>
      <rect width="32" height="32" rx="7.5" className="fill-accent" />
      <path
        d="M5 17.5h5.2l2.4-6.6 3.3 11.2 2.4-7.1 1.8 2.5H27"
        className="stroke-accent-fg"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="inline-flex items-center gap-2 font-semibold tracking-tight text-fg">
      <Logo />
      MediLedger
    </span>
  );
}
