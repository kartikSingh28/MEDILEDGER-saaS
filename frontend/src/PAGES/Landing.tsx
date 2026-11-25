import { Suspense, lazy } from "react";
import { Link } from "react-router-dom";
import {
  ChevronRight,
  Building2,
  CheckCircle2,
  FileLock2,
  Fingerprint,
  History,
  Link2,
  ShieldCheck,
  Timer,
} from "lucide-react";
import { Reveal } from "../components/Reveal";
import { Wordmark } from "../components/ui";

// three.js is ~120 kB gzipped and only the hero uses it, so it ships as its
// own chunk loaded after first paint rather than in the main bundle.
const LedgerScene = lazy(() =>
  import("../components/LedgerScene").then((m) => ({ default: m.LedgerScene }))
);

const steps = [
  {
    icon: FileLock2,
    title: "Upload",
    body: "The file is sealed with AES-256-GCM and stored on IPFS. The server never keeps a readable copy.",
  },
  {
    icon: Link2,
    title: "Anchor",
    body: "Its SHA-256 hash and IPFS address go on the ledger, signed with the patient's own certificate.",
  },
  {
    icon: ShieldCheck,
    title: "Consent",
    body: "A doctor at any member hospital asks, stating why. Only the patient can approve, limit or revoke.",
  },
  {
    icon: History,
    title: "Verify",
    body: "Every download is re-checked on chain: consent live, not expired, not used up, file still matching.",
  },
];

const guarantees = [
  {
    icon: Fingerprint,
    title: "Every user signs for themselves",
    body: "Each person holds an X.509 certificate issued by their own hospital's CA. The ledger reads who acted from the signature — the server cannot consent on anyone's behalf.",
  },
  {
    icon: Building2,
    title: "No single hospital owns the truth",
    body: "Each hospital runs its own Fabric organisation, peer and certificate authority. A transaction needs endorsement from all of them, so none can quietly rewrite history.",
  },
  {
    icon: Timer,
    title: "Consent that runs out",
    body: "A grant carries an expiry and a download limit. When either is reached the contract closes the access itself, and records why on the trail.",
  },
  {
    icon: ShieldCheck,
    title: "Tampering ends access",
    body: "Consent is bound to the hash of the exact file it was given over. If the stored bytes stop matching, the contract invalidates the grant on the spot.",
  },
];

const navLinks = [
  ["#flow", "How it works"],
  ["#inside", "Inside the app"],
  ["#ledger", "Security"],
];

export function Landing() {
  return (
    <div className="min-h-screen bg-panel">
      <header className="glass sticky top-0 z-40 border-b border-line/60">
        <div className="mx-auto flex h-12 max-w-[1024px] items-center justify-between px-4 sm:px-6">
          <Link to="/" aria-label="MediLedger home" className="inline-flex">
            <Wordmark />
          </Link>
          <nav className="flex items-center gap-1 text-[13px]" aria-label="Main">
            {navLinks.map(([href, label]) => (
              <a key={href} href={href} className="hidden rounded-full px-3 py-1.5 text-fg/80 transition-colors hover:text-fg md:inline-block">
                {label}
              </a>
            ))}
            <Link to="/login" className="rounded-full px-3 py-1.5 text-fg/80 transition-colors hover:text-fg">
              Sign in
            </Link>
            <Link
              to="/signup"
              className="ml-1 rounded-full bg-accent px-3.5 py-1.5 font-medium text-accent-fg transition-colors hover:bg-accent-hover"
            >
              Create account
            </Link>
          </nav>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="overflow-hidden bg-panel">
          <div className="mx-auto max-w-[1024px] px-4 pt-16 text-center sm:px-6 sm:pt-24">
            <p className="text-[17px] font-semibold text-accent sm:text-xl">Hyperledger Fabric · IPFS</p>

            <h1 className="headline mx-auto mt-3 max-w-4xl text-[2.75rem] sm:text-6xl lg:text-[5rem]">
              Medical records the patient controls.
            </h1>
            <p className="headline mx-auto mt-2 max-w-4xl text-[1.75rem] !text-muted sm:text-4xl lg:text-5xl">
              On a ledger hospitals share.
            </p>

            <p className="mx-auto mt-7 max-w-2xl text-[17px] leading-relaxed text-muted sm:text-xl sm:leading-relaxed">
              MediLedger encrypts each record, stores it on IPFS and anchors its fingerprint on a permissioned
              blockchain run jointly by the participating hospitals. A doctor sees a record only after the patient
              approves — and every approval, limit and download is signed and kept.
            </p>

            <div className="mt-9 flex flex-wrap items-center justify-center gap-x-8 gap-y-4">
              <Link
                to="/signup"
                className="inline-flex h-12 items-center rounded-full bg-accent px-7 text-[17px] font-medium text-accent-fg transition-[background-color,transform] duration-200 hover:bg-accent-hover active:scale-[0.98]"
              >
                Create an account
              </Link>
              <Link to="/login" className="group inline-flex items-center gap-0.5 text-[17px] text-accent hover:underline">
                Sign in
                <ChevronRight size={18} className="transition-transform group-hover:translate-x-0.5" aria-hidden />
              </Link>
            </div>
          </div>

          <div className="relative mx-auto hidden h-[28rem] max-w-4xl md:block lg:h-[36rem]">
            <Suspense fallback={null}>
              <LedgerScene className="absolute inset-0" />
            </Suspense>
          </div>

          <dl className="mx-auto grid max-w-3xl grid-cols-3 gap-4 px-4 pb-20 pt-12 text-center sm:px-6 md:pt-0">
            {[
              ["AES-256", "GCM encrypted"],
              ["2 orgs", "endorse each write"],
              ["0", "plaintext on the server"],
            ].map(([value, label]) => (
              <div key={label}>
                <dt className="headline whitespace-nowrap text-[1.75rem] sm:text-5xl">{value}</dt>
                <dd className="mt-2 text-sm text-muted sm:text-[15px]">{label}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* How it works */}
        <section id="flow" className="scroll-mt-12 bg-canvas" aria-labelledby="flow-heading">
          <div className="mx-auto max-w-[1024px] px-4 py-24 sm:px-6 lg:py-32">
            <Reveal className="mx-auto max-w-3xl text-center">
              <p className="text-[17px] font-semibold text-accent">How a record moves</p>
              <h2 id="flow-heading" className="headline mt-3 text-4xl sm:text-5xl lg:text-[3.5rem]">
                Four steps. Each one signed.
              </h2>
            </Reveal>

            <ol className="mt-16 grid gap-5 sm:grid-cols-2">
              {steps.map(({ icon: Icon, title, body }, i) => (
                <li key={title}>
                  <Reveal
                    delay={i * 90}
                    className="flex h-full flex-col rounded-4xl bg-panel p-8 shadow-panel transition-[transform,box-shadow] duration-500 ease-apple hover:-translate-y-1 hover:shadow-lift sm:p-10"
                  >
                    <div className="flex items-center justify-between">
                      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 text-accent">
                        <Icon size={22} aria-hidden />
                      </span>
                      <span className="headline text-5xl !text-line">{String(i + 1).padStart(2, "0")}</span>
                    </div>
                    <h3 className="mt-8 text-2xl font-semibold text-fg">{title}</h3>
                    <p className="mt-2 text-[17px] leading-relaxed text-muted">{body}</p>
                  </Reveal>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Inside the app */}
        <section id="inside" className="scroll-mt-12 bg-panel" aria-labelledby="app-heading">
          <div className="mx-auto max-w-[1024px] px-4 py-24 sm:px-6 lg:py-32">
            <Reveal className="mx-auto max-w-3xl text-center">
              <p className="text-[17px] font-semibold text-accent">Inside the app</p>
              <h2 id="app-heading" className="headline mt-3 text-4xl sm:text-5xl lg:text-[3.5rem]">
                What the patient decides. What the chain remembers.
              </h2>
            </Reveal>

            <div className="mt-16 grid items-stretch gap-5 lg:grid-cols-2">
              <Reveal className="flex h-full flex-col rounded-4xl bg-canvas p-6 sm:p-10">
                <h3 className="text-2xl font-semibold text-fg">Consent, on your terms.</h3>
                <p className="mt-2 text-[17px] leading-relaxed text-muted">
                  Approving sets the terms: how long the access lasts and how many downloads it allows.
                </p>
                <div className="mt-8">
                  <ConsoleMock />
                </div>
              </Reveal>
              <Reveal delay={120} className="flex h-full flex-col rounded-4xl bg-canvas p-6 sm:p-10">
                <h3 className="text-2xl font-semibold text-fg">A history no one can edit.</h3>
                <p className="mt-2 text-[17px] leading-relaxed text-muted">
                  The same record's history, read straight from the ledger.
                </p>
                <div className="mt-8">
                  <AuditMock />
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* Guarantees */}
        <section id="ledger" className="scroll-mt-12 bg-canvas" aria-labelledby="ledger-heading">
          <div className="mx-auto max-w-[1024px] px-4 py-24 sm:px-6 lg:py-32">
            <Reveal className="mx-auto max-w-3xl text-center">
              <p className="text-[17px] font-semibold text-accent">What the ledger guarantees</p>
              <h2 id="ledger-heading" className="headline mt-3 text-4xl sm:text-5xl lg:text-[3.5rem]">
                Trust that doesn't rest on trusting the server.
              </h2>
            </Reveal>

            <ul className="mt-16 grid gap-5 sm:grid-cols-2">
              {guarantees.map(({ icon: Icon, title, body }, i) => (
                <li key={title}>
                  <Reveal delay={i * 90} className="h-full rounded-4xl bg-panel p-8 shadow-panel sm:p-10">
                    <Icon size={32} strokeWidth={1.6} className="text-accent" aria-hidden />
                    <h3 className="mt-6 text-2xl font-semibold leading-snug text-fg">{title}</h3>
                    <p className="mt-3 text-[17px] leading-relaxed text-muted">{body}</p>
                  </Reveal>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Close */}
        <section className="bg-panel">
          <Reveal className="mx-auto max-w-3xl px-4 py-28 text-center sm:px-6 lg:py-36">
            <h2 className="headline text-4xl sm:text-5xl lg:text-[3.5rem]">See the consent trail for yourself.</h2>
            <p className="mx-auto mt-6 max-w-2xl text-[17px] leading-relaxed text-muted sm:text-xl sm:leading-relaxed">
              Create an account as a patient, upload a record, and watch each request, grant and download land on
              the ledger — signed, timestamped and impossible to edit after the fact.
            </p>
            <Link
              to="/signup"
              className="mt-10 inline-flex h-12 items-center rounded-full bg-accent px-7 text-[17px] font-medium text-accent-fg transition-[background-color,transform] duration-200 hover:bg-accent-hover active:scale-[0.98]"
            >
              Get started
            </Link>
          </Reveal>
        </section>
      </main>

      <footer className="bg-canvas">
        <div className="mx-auto flex max-w-[1024px] flex-col gap-3 border-t border-line px-4 py-6 text-xs text-faint sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <Wordmark />
          <p>Prototype on Hyperledger Fabric 2.5, IPFS and PostgreSQL.</p>
        </div>
      </footer>
    </div>
  );
}

/* A still of the patient's consent screen, built from the same tokens as the
   real one. It shows the terms a grant carries, which is the product's point. */
function ConsoleMock() {
  return (
    <div className="relative">
      <div className="overflow-hidden rounded-2xl bg-panel shadow-lift">
        <div className="flex items-center gap-2 border-b border-line/70 px-4 py-3">
          <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
          <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
          <span className="h-3 w-3 rounded-full bg-[#28c840]" />
          <span className="ml-2 font-mono text-[11px] text-faint">mediledger · access requests</span>
        </div>

        <div className="divide-y divide-line/70">
          <MockRow
            name="Dr. A. Mehta"
            hospital="Metro Care Hospital"
            other
            purpose="Treatment"
            status="pending"
          />
          <MockRow
            name="Dr. S. Rao"
            hospital="City General Hospital"
            purpose="Diagnosis"
            status="granted"
            terms="29 days left · 1 of 3 used"
          />
          <MockRow
            name="Dr. K. Iyer"
            hospital="Metro Care Hospital"
            other
            purpose="Insurance claim"
            status="expired"
          />
        </div>
      </div>
    </div>
  );
}

const mockStatus = {
  pending: { label: "Pending", className: "bg-warn/10 text-warn" },
  granted: { label: "Approved", className: "bg-ok/10 text-ok" },
  expired: { label: "Expired", className: "bg-raised text-muted" },
};

function MockRow({
  name,
  hospital,
  other,
  purpose,
  status,
  terms,
}: {
  name: string;
  hospital: string;
  other?: boolean;
  purpose: string;
  status: keyof typeof mockStatus;
  terms?: string;
}) {
  const badge = mockStatus[status];
  return (
    <div className="flex items-start justify-between gap-4 px-5 py-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-fg">{name}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
          {hospital}
          {other && (
            <span className="rounded-full bg-accent/10 px-2 py-px text-[11px] font-medium text-accent">other hospital</span>
          )}
        </p>
        <p className="mt-1.5 text-xs text-faint">
          {purpose}
          {terms && <> · {terms}</>}
        </p>
      </div>
      <span
        className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.className}`}
      >
        {badge.label}
      </span>
    </div>
  );
}

function AuditMock() {
  return (
    <figure className="overflow-hidden rounded-2xl bg-panel shadow-lift">
      <figcaption className="flex items-center gap-2 border-b border-line/70 px-5 py-3 text-xs font-medium text-muted">
        <History size={14} className="text-accent" aria-hidden />
        Ledger history · one record
      </figcaption>
      <ol className="divide-y divide-line/70">
        <LedgerLine
          action="ACCESS_REQUESTED"
          tone="text-warn"
          who="Dr. A. Mehta · Metro Care"
          signer="mediledger-user-25 @ Org2MSP"
          tx="8c85a1d36d4f"
        />
        <LedgerLine
          action="ACCESS_GRANTED"
          tone="text-ok"
          who="Patient · City General"
          signer="mediledger-user-24 @ Org1MSP"
          tx="49f4e7affe12"
        />
        <LedgerLine
          action="RECORD_ACCESSED"
          tone="text-fg"
          who="Dr. A. Mehta · Metro Care"
          signer="mediledger-user-25 @ Org2MSP"
          tx="d0b3831fd7a9"
        />
        <LedgerLine
          action="CONSENT_EXPIRED"
          tone="text-muted"
          who="Closed by the contract"
          signer="—"
          tx="1a7c0b94e5d2"
        />
      </ol>
      <p className="flex items-start gap-2 border-t border-line/70 px-5 py-3.5 text-xs leading-relaxed text-muted">
        <CheckCircle2 size={14} className="mt-px shrink-0 text-ok" aria-hidden />
        Each entry is signed by the person who acted and cannot be edited afterwards.
      </p>
    </figure>
  );
}

function LedgerLine({
  action,
  tone,
  who,
  signer,
  tx,
}: {
  action: string;
  tone: string;
  who: string;
  signer: string;
  tx: string;
}) {
  return (
    <li className="px-5 py-3.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className={`font-mono text-[11px] font-medium uppercase tracking-wide ${tone}`}>{action}</span>
        <span className="font-mono text-[11px] text-faint">{tx}…</span>
      </div>
      <p className="mt-1 text-sm text-fg">{who}</p>
      <p className="mt-0.5 font-mono text-[11px] text-faint">{signer}</p>
    </li>
  );
}
