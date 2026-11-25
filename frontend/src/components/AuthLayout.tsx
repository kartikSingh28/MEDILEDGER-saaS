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

// Split layout: a calm white form column with generous space, and a soft grey
// brand panel beside it on large screens.
export function AuthLayout({ title, subtitle, children, footer }: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-panel xl:grid xl:grid-cols-[1fr_1fr]">
      <div className="flex min-h-screen flex-col px-6 py-6 sm:px-10">
        <Link to="/" aria-label="MediLedger home" className="inline-flex w-fit">
          <Wordmark />
        </Link>

        <div className="flex flex-1 items-center justify-center py-12">
          <div className="w-full max-w-sm">
            <h1 className="headline text-[2.5rem]">{title}</h1>
            <p className="mt-3 text-[17px] leading-relaxed text-muted">{subtitle}</p>

            <div className="mt-10">{children}</div>

            <p className="mt-8 text-[15px] text-muted">{footer}</p>
          </div>
        </div>

        <p className="text-xs text-faint">Prototype on Hyperledger Fabric, IPFS and PostgreSQL.</p>
      </div>

      {/* Brand panel — decorative, so it is hidden rather than stacked on small screens */}
      <aside className="hidden p-4 xl:block">
        <div className="flex h-full flex-col justify-center rounded-4xl bg-canvas px-12 py-16 2xl:px-16">
          <p className="text-[15px] font-semibold text-accent">MediLedger</p>
          <h2 className="headline mt-3 max-w-md text-[2.75rem] 2xl:text-5xl">
            Your records.
            <br />
            <span className="text-muted">Your consent.</span>
          </h2>
          <p className="mt-5 max-w-md text-[17px] leading-relaxed text-muted">
            Hospitals share one permissioned ledger. Patients decide who reads what, and for how long.
          </p>

          <ul className="mt-12 grid max-w-md gap-3">
            {points.map(({ icon: Icon, title: pointTitle, body }) => (
              <li key={pointTitle} className="flex gap-4 rounded-2xl bg-panel p-5 shadow-panel">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
                  <Icon size={18} aria-hidden />
                </span>
                <div>
                  <p className="text-[15px] font-semibold text-fg">{pointTitle}</p>
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
