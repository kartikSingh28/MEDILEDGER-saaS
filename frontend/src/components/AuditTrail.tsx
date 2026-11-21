import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { apiJson, errorMessage } from "../lib/api";
import { formatDate } from "../lib/format";
import { EmptyState, Notice, Spinner } from "./ui";

type AuditAction =
  | "RECORD_REGISTERED"
  | "ACCESS_REQUESTED"
  | "ACCESS_GRANTED"
  | "ACCESS_DENIED"
  | "ACCESS_REVOKED"
  | "RECORD_ACCESSED"
  | "EMERGENCY_ACCESS"
  | "ACCESS_BLOCKED"
  | "CONSENT_EXPIRED"
  | "CONSENT_EXHAUSTED"
  | "CONSENT_INVALIDATED";

interface AuditEntry {
  action: AuditAction;
  actorId: string;
  actorRole: string;
  actorName: string | null;
  actorHospital: string;
  actorMsp: string;
  actorIdentity: string;
  doctorName: string | null;
  doctorHospital: string | null;
  targetId: string;
  purpose: string;
  detail: string;
  timestamp: string;
  txId: string;
}

const actionLabels: Record<AuditAction, { label: string; tone: string }> = {
  RECORD_REGISTERED: { label: "Anchored", tone: "text-accent" },
  ACCESS_REQUESTED: { label: "Requested", tone: "text-warn" },
  ACCESS_GRANTED: { label: "Granted", tone: "text-ok" },
  ACCESS_DENIED: { label: "Denied", tone: "text-danger" },
  ACCESS_REVOKED: { label: "Revoked", tone: "text-danger" },
  RECORD_ACCESSED: { label: "Downloaded", tone: "text-fg" },
  EMERGENCY_ACCESS: { label: "Break-glass", tone: "text-danger" },
  ACCESS_BLOCKED: { label: "Blocked", tone: "text-warn" },
  CONSENT_EXPIRED: { label: "Expired", tone: "text-muted" },
  CONSENT_EXHAUSTED: { label: "Used up", tone: "text-muted" },
  CONSENT_INVALIDATED: { label: "Invalidated", tone: "text-danger" },
};

const purposeLabels: Record<string, string> = {
  TREATMENT: "treatment",
  DIAGNOSIS: "diagnosis",
  EMERGENCY: "emergency care",
  INSURANCE: "an insurance claim",
  RESEARCH: "research",
};

function describe(entry: AuditEntry): string {
  const doctor = `${entry.doctorName ?? `Doctor #${entry.targetId}`} (${entry.doctorHospital})`;
  const forPurpose = entry.purpose ? ` for ${purposeLabels[entry.purpose] ?? entry.purpose.toLowerCase()}` : "";

  switch (entry.action) {
    case "RECORD_REGISTERED":
      return "You uploaded the record; its hash was written to the ledger";
    case "ACCESS_REQUESTED":
      return `${doctor} requested access${forPurpose}`;
    case "ACCESS_GRANTED":
      return `You granted access to ${doctor}${forPurpose}`;
    case "ACCESS_DENIED":
      return `You denied ${doctor}`;
    case "ACCESS_REVOKED":
      return `You revoked access for ${doctor}`;
    case "RECORD_ACCESSED":
      return entry.actorRole === "PATIENT"
        ? "You downloaded the record"
        : `${entry.actorName ?? `User #${entry.actorId}`} (${entry.actorHospital}) downloaded the record${forPurpose}`;
    case "EMERGENCY_ACCESS":
      return `${doctor} took emergency access without waiting for your consent`;
    case "ACCESS_BLOCKED":
      return `The ledger blocked an access attempt by ${doctor}`;
    case "CONSENT_EXPIRED":
      return `Access for ${doctor} ended: the grant had expired`;
    case "CONSENT_EXHAUSTED":
      return `Access for ${doctor} ended: the download limit was reached`;
    case "CONSENT_INVALIDATED":
      return `Access for ${doctor} was invalidated: the stored file no longer matches the hash consent was given over`;
  }
}

// actorIdentity is "x509::/OU=client/.../CN=mediledger-user-12::/C=US/.../CN=ca.org1.example.com";
// the first CN is the signer's enrollment ID
const signerOf = (identity: string) => identity.match(/CN=([^/:]+)/)?.[1] ?? "unknown";

export function AuditTrail({ record, onClose }: { record: { id: number; filename: string }; onClose: () => void }) {
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [error, setError] = useState("");
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    apiJson<{ trail: AuditEntry[] }>(`/records/${record.id}/audit`)
      .then((data) => setEntries([...data.trail].reverse()))
      .catch((err) => setError(errorMessage(err)));
  }, [record.id]);

  // The parent re-renders while polling and passes a new onClose each time;
  // keep the latest in a ref so focus is set once, not on every render
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="audit-title"
        className="flex h-full w-full max-w-xl flex-col border-l border-line bg-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2 id="audit-title" className="text-base font-semibold text-fg">
              Ledger history
            </h2>
            <p className="mt-0.5 truncate text-sm text-muted">{record.filename}</p>
          </div>
          <button
            ref={closeRef}
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1.5 text-muted hover:bg-raised hover:text-fg"
          >
            <X size={18} aria-hidden />
          </button>
        </div>

        <p className="border-b border-line px-5 py-2.5 text-xs text-faint">
          Read from the Hyperledger Fabric ledger. Entries are signed by the person who acted and cannot be edited.
        </p>

        <div className="flex-1 overflow-y-auto">
          {error && (
            <div className="p-5">
              <Notice tone="error">{error}</Notice>
            </div>
          )}
          {!error && !entries && (
            <div className="p-5">
              <Spinner label="Reading ledger" />
            </div>
          )}
          {entries && entries.length === 0 && <EmptyState title="No ledger entries yet" />}
          {entries && entries.length > 0 && (
            <ol>
              {entries.map((entry) => {
                const action = actionLabels[entry.action] ?? { label: entry.action, tone: "text-muted" };
                return (
                  <li key={`${entry.txId}-${entry.action}`} className="border-b border-line px-5 py-4">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className={`font-mono text-xs uppercase tracking-wide ${action.tone}`}>{action.label}</span>
                      <time className="font-mono text-xs text-faint" dateTime={entry.timestamp}>
                        {formatDate(entry.timestamp)}
                      </time>
                    </div>
                    <p className="mt-1.5 text-sm text-fg">{describe(entry)}</p>
                    {entry.detail && <p className="mt-1 text-sm text-muted">{entry.detail}</p>}
                    <dl className="mt-2 grid grid-cols-[4.5rem_1fr] gap-x-2 gap-y-0.5 font-mono text-xs">
                      <dt className="text-faint">signer</dt>
                      <dd className="truncate text-muted" title={entry.actorIdentity}>
                        {signerOf(entry.actorIdentity)} @ {entry.actorMsp}
                      </dd>
                      <dt className="text-faint">tx</dt>
                      <dd className="truncate text-muted" title={entry.txId}>
                        {entry.txId}
                      </dd>
                    </dl>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}
