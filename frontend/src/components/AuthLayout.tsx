import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { FileLock2, ScrollText, ShieldCheck } from "lucide-react";
import { Wordmark } from "./ui";

const points = [
  {
    icon: ShieldCheck,
    title: "Your consent, cryptographically bound",
    body: "A grant is tied to the exact file it was given over. Change the file and the ledger ends the access by itself.",
  },
  {
    icon: FileLock2,
    title: "Encrypted before it ever leaves",
    body: "Records are sealed with AES-256-GCM and stored on IPFS. The server never holds a readable copy.",
  },
  {
    icon: ScrollText,
    title: "Every action signed and kept",
    body: "Requests, approvals, revocations and downloads are written to a ledger the hospitals run together.",
  },
];

// Split layout: the form sits at a comfortable reading width on the page, with a
// brand panel alongside it on large screens. A single centred card on an empty
// page reads as an unstyled form; this gives the page a subject.
export function AuthLayout({ title, subtitle, children, footer }: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-panel xl:grid xl:grid-cols-[1.1fr_1fr]">
      <div className="flex min-h-screen flex-col px-6 py-8 sm:px-10">
        <Link to="/" aria-label="MediLedger home" className="inline-flex w-fit">
          <Wordmark />
        </Link>

        <div className="flex flex-1 items-center justify-center py-12">
          <div className="w-full max-w-sm">
            <h1 className="text-2xl font-semibold tracking-tight text-fg">{title}</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted">{subtitle}</p>

            <div className="mt-8">{children}</div>

            <p className="mt-8 text-sm text-muted">{footer}</p>
          </div>
        </div>

        <p className="text-xs text-faint">
          Prototype on Hyperledger Fabric, IPFS and PostgreSQL.
        </p>
      </div>

      {/* Brand panel — decorative, so it is hidden rather than stacked on small screens */}
      <aside className="relative hidden overflow-hidden border-l border-line bg-raised xl:flex xl:flex-col xl:justify-center">
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.6] [background-image:linear-gradient(theme(colors.line)_1px,transparent_1px),linear-gradient(90deg,theme(colors.line)_1px,transparent_1px)] [background-size:40px_40px]"
        />
        <div
          aria-hidden
          className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-accent/20 blur-3xl"
        />
        <div
          aria-hidden
          className="absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-accent/10 blur-3xl"
        />

        <div className="relative px-10 py-16 2xl:px-14">
          <h2 className="max-w-sm text-[1.75rem] font-semibold leading-tight tracking-tight text-fg 2xl:max-w-md 2xl:text-3xl">
            Medical records the patient controls.
          </h2>
          <p className="mt-4 max-w-sm leading-relaxed text-muted 2xl:max-w-md">
            Hospitals share one permissioned ledger. Patients decide who reads what, and for how long.
          </p>

          <ul className="mt-10 space-y-7">
            {points.map(({ icon: Icon, title: pointTitle, body }) => (
              <li key={pointTitle} className="flex gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent">
                  <Icon size={18} aria-hidden />
                </span>
                <div>
                  <p className="font-medium text-fg">{pointTitle}</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
