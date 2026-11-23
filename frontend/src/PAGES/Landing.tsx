import { Suspense, lazy } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
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

export function Landing() {
  return (
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-40 border-b border-line bg-canvas">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5 sm:px-6">
          <Wordmark />
          <nav className="flex items-center gap-1 text-sm">
            <Link to="/login" className="rounded-md px-3 py-2 font-medium text-muted hover:bg-raised hover:text-fg">
              Sign in
            </Link>
            <Link
              to="/signup"
              className="rounded-md bg-accent px-3.5 py-2 font-medium text-accent-fg shadow-button hover:bg-accent-hover"
            >
              Create account
            </Link>
          </nav>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-line">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-40 -top-40 h-[30rem] w-[30rem] rounded-full bg-accent/10 blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.35] [background-image:linear-gradient(theme(colors.line)_1px,transparent_1px),linear-gradient(90deg,theme(colors.line)_1px,transparent_1px)] [background-size:56px_56px] [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]"
          />

          <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:py-24">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-line bg-panel px-3 py-1 text-xs font-medium text-muted shadow-button">
                <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                Hyperledger Fabric · IPFS
              </span>

              <h1 className="mt-5 text-4xl font-semibold leading-[1.1] tracking-tight text-fg sm:text-5xl">
                Medical records the patient controls, on a ledger hospitals share.
              </h1>

              <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted">
                MediLedger encrypts each record, stores it on IPFS and anchors its fingerprint on a permissioned
                blockchain run jointly by the participating hospitals. A doctor sees a record only after the patient
                approves — and every approval, limit and download is signed and kept.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  to="/signup"
                  className="inline-flex h-11 items-center gap-2 rounded-lg bg-accent px-5 text-sm font-medium text-accent-fg shadow-button hover:bg-accent-hover"
                >
                  Create an account
                  <ArrowRight size={16} aria-hidden />
                </Link>
                <Link
                  to="/login"
                  className="inline-flex h-11 items-center rounded-lg border border-line-strong bg-panel px-5 text-sm font-medium text-fg shadow-button hover:border-faint hover:bg-raised"
                >
                  Sign in
                </Link>
              </div>

              <dl className="mt-10 grid max-w-md grid-cols-3 gap-6 border-t border-line pt-6">
                {[
                  ["AES-256", "GCM encrypted"],
                  ["2 orgs", "endorse each write"],
                  ["0", "plaintext on the server"],
                ].map(([value, label]) => (
                  <div key={label}>
                    <dt className="text-xl font-semibold tracking-tight text-fg">{value}</dt>
                    <dd className="mt-0.5 text-xs leading-snug text-faint">{label}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="relative -my-8 hidden h-[28rem] lg:block">
              <Suspense fallback={null}>
                <LedgerScene className="absolute inset-0" />
              </Suspense>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20" aria-labelledby="flow-heading">
          <Reveal className="max-w-2xl">
            <p className="text-xs font-medium uppercase tracking-widest text-accent">How a record moves</p>
            <h2 id="flow-heading" className="mt-3 text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
              Four steps, each one signed
            </h2>
          </Reveal>

          <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map(({ icon: Icon, title, body }, i) => (
              <li key={title}>
                <Reveal
                  delay={i * 90}
                  className="h-full rounded-xl border border-line bg-panel p-5 shadow-panel transition-shadow hover:shadow-lift"
                >
                <div className="flex items-center justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 text-accent">
                    <Icon size={18} aria-hidden />
                  </span>
                  <span className="font-mono text-xs text-faint">{String(i + 1).padStart(2, "0")}</span>
                </div>
                <h3 className="mt-4 font-semibold text-fg">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{body}</p>
                </Reveal>
              </li>
            ))}
          </ol>
        </section>

        {/* Inside the app */}
        <section className="border-y border-line bg-raised" aria-labelledby="app-heading">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
            <Reveal className="max-w-2xl">
              <p className="text-xs font-medium uppercase tracking-widest text-accent">Inside the app</p>
              <h2 id="app-heading" className="mt-3 text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
                What the patient decides, and what the chain remembers
              </h2>
            </Reveal>

            <div className="mt-10 grid items-start gap-6 lg:grid-cols-2 lg:gap-10">
              <Reveal>
                <ConsoleMock />
                <p className="mt-3 text-sm leading-relaxed text-muted">
                  Approving sets the terms: how long the access lasts and how many downloads it allows.
                </p>
              </Reveal>
              <Reveal delay={120}>
                <AuditMock />
                <p className="mt-3 text-sm leading-relaxed text-muted">
                  The same record's history, read straight from the ledger.
                </p>
              </Reveal>
            </div>
          </div>
        </section>

        {/* Guarantees */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20" aria-labelledby="ledger-heading">
          <Reveal className="max-w-2xl">
            <p className="text-xs font-medium uppercase tracking-widest text-accent">What the ledger guarantees</p>
            <h2 id="ledger-heading" className="mt-3 text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
              Trust that does not rest on trusting the server
            </h2>
          </Reveal>

          <ul className="mt-10 grid gap-x-10 gap-y-9 sm:grid-cols-2 lg:grid-cols-4">
            {guarantees.map(({ icon: Icon, title, body }, i) => (
              <li key={title}>
                <Reveal delay={i * 90}>
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 text-accent">
                    <Icon size={18} aria-hidden />
                  </span>
                  <h3 className="mt-4 font-semibold text-fg">{title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">{body}</p>
                </Reveal>
              </li>
            ))}
          </ul>
        </section>

        {/* Close */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
          <div className="relative overflow-hidden rounded-2xl border border-line bg-raised px-6 py-12 text-center shadow-lift sm:px-12">
            <div
              aria-hidden
              className="absolute inset-0 opacity-60 [background-image:linear-gradient(theme(colors.line)_1px,transparent_1px),linear-gradient(90deg,theme(colors.line)_1px,transparent_1px)] [background-size:40px_40px]"
            />
            <div
              aria-hidden
              className="absolute left-1/2 top-0 h-64 w-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/20 blur-3xl"
            />
            <div className="relative">
              <h2 className="text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
                See the consent trail for yourself
              </h2>
              <p className="mx-auto mt-3 max-w-xl leading-relaxed text-muted">
                Create an account as a patient, upload a record, and watch each request, grant and download land on
                the ledger — signed, timestamped and impossible to edit after the fact.
              </p>
              <Link
                to="/signup"
                className="mt-8 inline-flex h-11 items-center gap-2 rounded-lg bg-accent px-5 text-sm font-medium text-accent-fg shadow-button hover:bg-accent-hover"
              >
                Get started
                <ArrowRight size={16} aria-hidden />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line bg-canvas">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-xs text-faint sm:flex-row sm:items-center sm:justify-between sm:px-6">
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
      <div className="overflow-hidden rounded-xl border border-line bg-panel shadow-float">
        <div className="flex items-center gap-2 border-b border-line bg-canvas px-4 py-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-line-strong" />
          <span className="h-2.5 w-2.5 rounded-full bg-line-strong" />
          <span className="h-2.5 w-2.5 rounded-full bg-line-strong" />
          <span className="ml-2 font-mono text-[11px] text-faint">mediledger · access requests</span>
        </div>

        <div className="divide-y divide-line">
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
  pending: { label: "Pending", className: "border-warn/40 bg-warn/5 text-warn" },
  granted: { label: "Approved", className: "border-ok/40 bg-ok/5 text-ok" },
  expired: { label: "Expired", className: "border-line-strong text-muted" },
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
    <div className="flex items-start justify-between gap-4 px-4 py-3.5">
      <div className="min-w-0">
        <p className="text-sm font-medium text-fg">{name}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
          {hospital}
          {other && (
            <span className="rounded border border-accent/40 px-1.5 py-px text-[11px] text-accent">other hospital</span>
          )}
        </p>
        <p className="mt-1.5 text-xs text-faint">
          {purpose}
          {terms && <> · {terms}</>}
        </p>
      </div>
      <span
        className={`shrink-0 rounded border px-2 py-0.5 text-xs font-medium ${badge.className}`}
      >
        {badge.label}
      </span>
    </div>
  );
}

function AuditMock() {
  return (
    <figure className="overflow-hidden rounded-xl border border-line bg-panel shadow-lift">
      <figcaption className="flex items-center gap-2 border-b border-line bg-canvas px-4 py-2.5 text-xs font-medium text-muted">
        <History size={14} className="text-accent" aria-hidden />
        Ledger history · one record
      </figcaption>
      <ol className="divide-y divide-line">
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
      <p className="flex items-start gap-2 border-t border-line bg-canvas px-4 py-3 text-xs leading-relaxed text-muted">
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
    <li className="px-4 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className={`font-mono text-[11px] font-medium uppercase tracking-wide ${tone}`}>{action}</span>
        <span className="font-mono text-[11px] text-faint">{tx}…</span>
      </div>
      <p className="mt-1 text-sm text-fg">{who}</p>
      <p className="mt-0.5 font-mono text-[11px] text-faint">{signer}</p>
    </li>
  );
}
