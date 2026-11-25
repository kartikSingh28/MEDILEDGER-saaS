import { forwardRef } from "react";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import { AlertCircle, CheckCircle2, Info } from "lucide-react";

/* =========================
   Buttons
========================= */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-accent text-accent-fg hover:bg-accent-hover active:scale-[0.98]",
  secondary: "bg-raised text-fg hover:bg-line/70 active:scale-[0.98]",
  ghost: "text-accent hover:bg-accent/10",
  danger: "bg-danger/10 text-danger hover:bg-danger/15 active:scale-[0.98]",
};

export function Button({
  variant = "secondary",
  size = "md",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: "sm" | "md" }) {
  const sizing = size === "sm" ? "h-8 px-3.5 text-[13px]" : "h-11 px-5 text-[15px]";
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-full font-medium transition-[background-color,transform] duration-200 ease-apple disabled:cursor-not-allowed disabled:opacity-50 ${sizing} ${buttonVariants[variant]} ${className}`}
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
  "h-12 w-full rounded-xl border border-line bg-panel px-4 text-[15px] text-fg transition-[border-color,box-shadow] duration-200 placeholder:text-faint hover:border-line-strong focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/15";

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
      <label htmlFor={id} className="block text-[13px] font-medium text-muted">
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
  success: { className: "border-transparent bg-ok/10 text-ok", Icon: CheckCircle2 },
  error: { className: "border-transparent bg-danger/10 text-danger", Icon: AlertCircle },
  info: { className: "border-transparent bg-raised text-muted", Icon: Info },
};

export function Notice({ tone, children }: { tone: keyof typeof noticeTones; children: ReactNode }) {
  const { className, Icon } = noticeTones[tone];
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm leading-relaxed ${className}`}
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
  PENDING: "border-transparent bg-warn/10 text-warn",
  APPROVED: "border-transparent bg-ok/10 text-ok",
  DENIED: "border-transparent bg-danger/10 text-danger",
  // Set by the consent contract, not by the patient
  EXPIRED: "border-transparent bg-raised text-muted",
  EXHAUSTED: "border-transparent bg-raised text-muted",
  INVALIDATED: "border-transparent bg-danger/10 text-danger",
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
      {other && <span className="rounded-full bg-accent/10 px-2 py-px text-[11px] font-medium text-accent">other hospital</span>}
    </span>
  );
}

/* =========================
   Layout pieces
========================= */

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="text-[2rem] font-semibold leading-tight tracking-display text-fg">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl bg-panel shadow-panel ${className}`}>{children}</div>
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
      <table className="w-full min-w-[640px] text-left text-sm [&_tbody_tr]:transition-colors [&_tbody_tr:hover]:bg-canvas [&_tbody_tr:last-child_td]:border-0">
        {children}
      </table>
    </div>
  );
}

export function Th({ children, className = "" }: { children?: ReactNode; className?: string }) {
  return (
    <th
      scope="col"
      className={`border-b border-line px-5 py-3 text-xs font-medium text-faint ${className}`}
    >
      {children}
    </th>
  );
}

export function Td({ children, className = "" }: { children?: ReactNode; className?: string }) {
  return <td className={`border-b border-line/70 px-5 py-4 align-middle ${className}`}>{children}</td>;
}

// A record tile with a pulse through it: the health side of the product on the
// block the ledger stores it as. One flat shape, so it stays sharp at favicon
// size, and coloured from the accent token so it follows the theme.
export function Logo({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden>
      <rect width="32" height="32" rx="8" className="fill-accent" />
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
    <span className="inline-flex items-center gap-2 text-[17px] font-semibold tracking-tight text-fg">
      <Logo />
      MediLedger
    </span>
  );
}
