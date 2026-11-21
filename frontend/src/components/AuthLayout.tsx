import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Wordmark } from "./ui";

export function AuthLayout({ title, subtitle, children, footer }: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <Link to="/" aria-label="MediLedger home">
        <Wordmark />
      </Link>
      <div className="mt-8 w-full max-w-sm rounded-lg border border-line bg-panel p-6 sm:p-8">
        <h1 className="text-lg font-semibold text-fg">{title}</h1>
        <p className="mt-1 text-sm text-muted">{subtitle}</p>
        <div className="mt-6">{children}</div>
      </div>
      <p className="mt-6 text-sm text-muted">{footer}</p>
    </div>
  );
}
