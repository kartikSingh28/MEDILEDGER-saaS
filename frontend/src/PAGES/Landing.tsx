import { Link } from "react-router-dom";
import { Wordmark } from "../components/ui";

const steps = [
  {
    title: "Upload",
    body: "The patient's file is encrypted with AES-256 and stored on IPFS. The server never keeps a plain copy.",
  },
  {
    title: "Anchor",
    body: "The file's SHA-256 hash and IPFS address are written to the ledger, signed with the patient's own certificate.",
  },
  {
    title: "Consent",
    body: "A doctor at any member hospital requests access. Only the patient can approve, deny or later revoke it.",
  },
  {
    title: "Verify and log",
    body: "Each download is checked against the ledger: consent must be granted and the file must match its on-chain hash.",
  },
];

const facts = [
  ["Each hospital is a Fabric organization", "with its own peer and certificate authority."],
  ["Every transaction needs every hospital's endorsement,", "so no single hospital can rewrite history."],
  ["Every user has their own certificate.", "The ledger reads who acted from the signature, not from the app."],
  ["Patients see the full history", "of who requested, was granted and downloaded each record."],
];

export function Landing() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <Wordmark />
          <nav className="flex items-center gap-2 text-sm">
            <Link to="/login" className="rounded-md px-3 py-2 text-muted hover:text-fg">
              Sign in
            </Link>
            <Link to="/signup" className="rounded-md bg-accent px-3 py-2 font-medium text-accent-fg hover:bg-accent-hover">
              Create account
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 sm:px-6">
        <section className="py-16 sm:py-24">
          <p className="font-mono text-xs uppercase tracking-widest text-accent">Hyperledger Fabric · IPFS</p>
          <h1 className="mt-4 max-w-3xl text-3xl font-semibold leading-tight text-fg sm:text-5xl sm:leading-tight">
            Medical records the patient controls, on a ledger hospitals share.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-muted">
            MediLedger encrypts each record, stores it on IPFS, and anchors its fingerprint on a blockchain run
            jointly by the participating hospitals. A doctor at any of them sees a record only after the patient
            approves, and every approval, revocation and download is signed and recorded on the ledger.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/signup" className="rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-accent-fg hover:bg-accent-hover">
              Create an account
            </Link>
            <Link to="/login" className="rounded-md border border-line-strong px-4 py-2.5 text-sm font-medium text-fg hover:border-faint">
              Sign in
            </Link>
          </div>
        </section>

        <section className="border-t border-line py-14" aria-labelledby="flow-heading">
          <h2 id="flow-heading" className="text-lg font-semibold text-fg">
            How a record moves
          </h2>
          <ol className="mt-8 grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step, i) => (
              <li key={step.title} className="bg-panel p-5">
                <span className="font-mono text-xs text-faint">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="mt-2 text-sm font-semibold text-fg">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="grid gap-10 border-t border-line py-14 lg:grid-cols-2" aria-labelledby="ledger-heading">
          <div>
            <h2 id="ledger-heading" className="text-lg font-semibold text-fg">
              What the ledger guarantees
            </h2>
            <ul className="mt-6 space-y-4">
              {facts.map(([lead, rest]) => (
                <li key={lead} className="border-l-2 border-accent/60 pl-4 text-sm leading-relaxed text-muted">
                  <span className="text-fg">{lead}</span> {rest}
                </li>
              ))}
            </ul>
          </div>

          <figure className="rounded-lg border border-line bg-panel">
            <figcaption className="border-b border-line px-4 py-2.5 text-xs text-faint">
              Example audit trail for one record
            </figcaption>
            <div className="space-y-4 p-4 font-mono text-xs leading-relaxed">
              <LedgerLine action="ACCESS_REQUESTED" who="Doctor · Metro Care Hospital" signer="mediledger-user-25 @ Org2MSP" tx="8c85a1d36d4f" />
              <LedgerLine action="ACCESS_GRANTED" who="Patient · City General Hospital" signer="mediledger-user-24 @ Org1MSP" tx="49f4e7affe12" />
              <LedgerLine action="RECORD_ACCESSED" who="Doctor · Metro Care Hospital" signer="mediledger-user-25 @ Org2MSP" tx="d0b3831fd7a9" />
            </div>
          </figure>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto max-w-5xl px-4 py-6 text-xs text-faint sm:px-6">
          MediLedger · prototype on Hyperledger Fabric 2.5, IPFS and PostgreSQL
        </div>
      </footer>
    </div>
  );
}

function LedgerLine({ action, who, signer, tx }: { action: string; who: string; signer: string; tx: string }) {
  return (
    <div>
      <p className="text-accent">{action}</p>
      <p className="text-fg">{who}</p>
      <p className="text-faint">
        signer <span className="text-muted">{signer}</span>
      </p>
      <p className="text-faint">
        tx <span className="text-muted">{tx}…</span>
      </p>
    </div>
  );
}
