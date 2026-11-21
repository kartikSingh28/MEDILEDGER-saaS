import { forwardRef } from "react";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";

/* =========================
   Buttons
========================= */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-accent text-accent-fg hover:bg-accent-hover",
  secondary: "border border-line-strong bg-raised text-fg hover:border-faint",
  ghost: "text-muted hover:bg-raised hover:text-fg",
  danger: "border border-danger/40 text-danger hover:bg-danger/10",
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

const fieldClass =
  "h-10 w-full rounded-md border border-line-strong bg-canvas px-3 text-sm text-fg placeholder:text-faint focus:border-accent focus:outline-none";

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
  success: "border-ok/40 bg-ok/10 text-ok",
  error: "border-danger/40 bg-danger/10 text-danger",
  info: "border-line-strong bg-raised text-muted",
};

export function Notice({ tone, children }: { tone: keyof typeof noticeTones; children: ReactNode }) {
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`rounded-md border px-3 py-2 text-sm ${noticeTones[tone]}`}>
      {children}
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
  PENDING: "border-warn/40 text-warn",
  APPROVED: "border-ok/40 text-ok",
  DENIED: "border-danger/40 text-danger",
  // Set by the consent contract, not by the patient
  EXPIRED: "border-line-strong text-muted",
  EXHAUSTED: "border-line-strong text-muted",
  INVALIDATED: "border-danger/40 text-danger",
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
    <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${statusStyles[status] ?? "border-line-strong text-muted"}`}>
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
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-xl font-semibold text-fg">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-lg border border-line bg-panel ${className}`}>{children}</div>;
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="px-6 py-12 text-center">
      <p className="text-sm font-medium text-fg">{title}</p>
      {children && <div className="mt-1 text-sm text-muted">{children}</div>}
    </div>
  );
}

// Table wrapper that scrolls sideways on narrow screens instead of breaking the page
export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">{children}</table>
    </div>
  );
}

export function Th({ children, className = "" }: { children?: ReactNode; className?: string }) {
  return (
    <th scope="col" className={`border-b border-line px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-faint ${className}`}>
      {children}
    </th>
  );
}

export function Td({ children, className = "" }: { children?: ReactNode; className?: string }) {
  return <td className={`border-b border-line px-4 py-3 align-middle ${className}`}>{children}</td>;
}

export function Wordmark() {
  return (
    <span className="inline-flex items-center gap-2 font-semibold text-fg">
      <span className="flex h-6 w-6 flex-col justify-center gap-[3px] rounded bg-panel px-[5px]" aria-hidden>
        <span className="h-[3px] rounded-sm bg-accent" />
        <span className="h-[3px] rounded-sm bg-accent/70" />
        <span className="h-[3px] rounded-sm bg-accent/40" />
      </span>
      MediLedger
    </span>
  );
}
