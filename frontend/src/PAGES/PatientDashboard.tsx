import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Copy, FileText, Inbox, TriangleAlert } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { AuditTrail } from "../components/AuditTrail";
import {
  Button,
  EmptyState,
  Field,
  HospitalTag,
  Notice,
  PageHeader,
  Panel,
  Select,
  Spinner,
  StatusBadge,
  Table,
  Td,
  Th,
} from "../components/ui";
import { apiFetch, apiJson, downloadFile, errorMessage } from "../lib/api";
import type { AccessPurpose } from "../lib/format";
import { formatDate, formatRemaining, formatSize, formatUsage, purposeLabels } from "../lib/format";
import { getSession } from "../lib/session";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // matches the backend's multer limit

// Terms the patient can put on a grant. The ledger enforces whichever is chosen.
const DURATION_CHOICES = [
  { value: 1, label: "1 day" },
  { value: 7, label: "7 days" },
  { value: 30, label: "30 days" },
  { value: 90, label: "90 days" },
  { value: 0, label: "No expiry" },
];

const LIMIT_CHOICES = [
  { value: 1, label: "1 download" },
  { value: 3, label: "3 downloads" },
  { value: 10, label: "10 downloads" },
  { value: 0, label: "Unlimited" },
];

interface MedicalRecord {
  id: number;
  filename: string | null;
  createdAt: string;
}

interface AccessRequest {
  id: number;
  recordId: number;
  status: "PENDING" | "APPROVED" | "DENIED" | "EXPIRED" | "EXHAUSTED" | "INVALIDATED";
  purpose: AccessPurpose;
  expiresAt: string | null;
  maxAccesses: number;
  accessCount: number;
  emergency: boolean;
  reason: string | null;
  createdAt: string;
  doctor: { id: number; name: string; hospital: { name: string } };
  record: { id: number; filename: string | null };
}

type Section = "records" | "requests";
type Message = { tone: "success" | "error"; text: string } | null;

export function PatientDashboard() {
  const ownHospital = getSession()?.hospital ?? "";
  const [section, setSection] = useState<Section>("records");
  const [records, setRecords] = useState<MedicalRecord[] | null>(null);
  const [recordsFailed, setRecordsFailed] = useState(false);
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [message, setMessage] = useState<Message>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [auditRecord, setAuditRecord] = useState<{ id: number; filename: string } | null>(null);
  // The request whose grant terms are being chosen, if any
  const [approving, setApproving] = useState<number | null>(null);
  const [durationDays, setDurationDays] = useState(30);
  const [maxAccesses, setMaxAccesses] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);

  const loadRecords = useCallback(async () => {
    try {
      setRecords(await apiJson<MedicalRecord[]>("/records/mine"));
      setRecordsFailed(false);
    } catch (err) {
      setRecordsFailed(true);
      setMessage({ tone: "error", text: errorMessage(err) });
    }
  }, []);

  const loadRequests = useCallback(async () => {
    try {
      const data = await apiJson<{ requests: AccessRequest[] }>("/permissions/for-patient");
      setRequests(data.requests);
    } catch {
      // polled; a failed refresh keeps the last list (an expired session redirects)
    }
  }, []);

  useEffect(() => {
    loadRecords();
    loadRequests();
    const interval = setInterval(loadRequests, 5000);
    return () => clearInterval(interval);
  }, [loadRecords, loadRequests]);

  // Run an action with one shared busy flag and a result message
  const run = async (key: string, action: () => Promise<string>) => {
    setBusy(key);
    setMessage(null);
    try {
      setMessage({ tone: "success", text: await action() });
    } catch (err) {
      setMessage({ tone: "error", text: errorMessage(err) });
    } finally {
      setBusy(null);
    }
  };

  const upload = (file: File) => {
    if (file.size > MAX_UPLOAD_BYTES) {
      setMessage({ tone: "error", text: `${file.name} is ${formatSize(file.size)}. The limit is 10 MB.` });
      return;
    }
    run("upload", async () => {
      const body = new FormData();
      body.append("file", file);
      await apiFetch("/records/upload", { method: "POST", body });
      await loadRecords();
      return `${file.name} was encrypted, stored on IPFS and anchored on the ledger.`;
    });
  };

  const startApproving = (request: AccessRequest) => {
    setApproving(request.id);
    setDurationDays(30);
    setMaxAccesses(0);
    setMessage(null);
  };

  const confirmApproval = (request: AccessRequest) =>
    run(`approve-${request.id}`, async () => {
      await apiFetch(`/permissions/approve/${request.id}`, {
        method: "POST",
        body: JSON.stringify({ durationDays, maxAccesses }),
      });
      setApproving(null);
      await loadRequests();

      const terms = [
        durationDays > 0 ? `for ${durationDays} day${durationDays === 1 ? "" : "s"}` : "with no expiry",
        maxAccesses > 0 ? `and ${maxAccesses} download${maxAccesses === 1 ? "" : "s"}` : "",
      ]
        .filter(Boolean)
        .join(" ");
      return `Access granted to ${request.doctor.name} ${terms}. The terms are enforced by the ledger.`;
    });

  const deny = (request: AccessRequest) =>
    run(`deny-${request.id}`, async () => {
      await apiFetch(`/permissions/deny/${request.id}`, { method: "POST" });
      setApproving(null);
      await loadRequests();
      return request.status === "APPROVED"
        ? `Access revoked for ${request.doctor.name}.`
        : `Request from ${request.doctor.name} denied.`;
    });

  const pending = requests.filter((r) => r.status === "PENDING").length;
  const approvedCount = (recordId: number) =>
    requests.filter((r) => r.recordId === recordId && r.status === "APPROVED").length;

  return (
    <AppShell
      nav={[
        { key: "records", label: "Records", icon: <FileText size={16} aria-hidden /> },
        { key: "requests", label: "Access requests", icon: <Inbox size={16} aria-hidden />, count: pending },
      ]}
      active={section}
      onSelect={(key) => {
        setSection(key);
        setMessage(null);
      }}
    >
      {message && (
        <div className="mb-5">
          <Notice tone={message.tone}>{message.text}</Notice>
        </div>
      )}

      {section === "records" && (
        <>
          <PageHeader
            title="Records"
            description="Files are encrypted before storage and each one's hash is kept on the ledger. To share a record, give its ID to your doctor so they can request access."
            actions={
              <>
                <input
                  ref={fileInput}
                  type="file"
                  className="hidden"
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (file) upload(file);
                  }}
                />
                <Button variant="primary" onClick={() => fileInput.current?.click()} disabled={busy === "upload"}>
                  {busy === "upload" ? "Uploading…" : "Upload record"}
                </Button>
              </>
            }
          />

          <Panel>
            {records === null && recordsFailed ? (
              <EmptyState title="Couldn't load your records">
                <Button size="sm" className="mt-3" onClick={loadRecords}>
                  Try again
                </Button>
              </EmptyState>
            ) : records === null ? (
              <div className="p-5">
                <Spinner />
              </div>
            ) : records.length === 0 ? (
              <EmptyState title="No records yet">PDF, image or Word files up to 10 MB.</EmptyState>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>File</Th>
                    <Th>Uploaded</Th>
                    <Th>Shared with</Th>
                    <Th className="text-right">
                      <span className="sr-only">Actions</span>
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((record) => {
                    const filename = record.filename ?? `record-${record.id}`;
                    const shared = approvedCount(record.id);
                    return (
                      <tr key={record.id}>
                        <Td>
                          <p className="font-medium text-fg">{filename}</p>
                          <p className="mt-0.5 flex items-center gap-1.5 font-mono text-xs text-faint">
                            ID {record.id}
                            <CopyButton value={String(record.id)} label={`Copy record ID ${record.id}`} />
                          </p>
                        </Td>
                        <Td className="whitespace-nowrap text-muted">{formatDate(record.createdAt)}</Td>
                        <Td className="text-muted">
                          {shared === 0 ? "Only you" : `${shared} doctor${shared === 1 ? "" : "s"}`}
                        </Td>
                        <Td className="whitespace-nowrap text-right">
                          <div className="inline-flex gap-2">
                            <Button size="sm" variant="ghost" onClick={() => setAuditRecord({ id: record.id, filename })}>
                              History
                            </Button>
                            <Button
                              size="sm"
                              disabled={busy === `download-${record.id}`}
                              onClick={() =>
                                run(`download-${record.id}`, async () => {
                                  await downloadFile(`/records/${record.id}`, filename);
                                  return `${filename} verified against the ledger and decrypted.`;
                                })
                              }
                            >
                              Download
                            </Button>
                          </div>
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            )}
          </Panel>
        </>
      )}

      {section === "requests" && (
        <>
          <PageHeader
            title="Access requests"
            description="Doctors at any member hospital can ask to see a record, stating why. When you approve you also set how long the access lasts and how many times it can be used — the ledger enforces both and ends the grant on its own when either runs out."
          />

          <Panel>
            {requests.length === 0 ? (
              <EmptyState title="No requests yet">When a doctor requests one of your records it will appear here.</EmptyState>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Doctor</Th>
                    <Th>Record</Th>
                    <Th>Purpose</Th>
                    <Th>Status</Th>
                    <Th>Limits</Th>
                    <Th className="text-right">
                      <span className="sr-only">Actions</span>
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((request) => (
                    <tr key={request.id}>
                      <Td>
                        <p className="font-medium text-fg">{request.doctor.name}</p>
                        <HospitalTag name={request.doctor.hospital.name} ownHospital={ownHospital} />
                      </Td>
                      <Td className="text-muted">
                        {request.record.filename ?? `record-${request.recordId}`}
                        <span className="ml-1.5 font-mono text-xs text-faint">#{request.recordId}</span>
                      </Td>
                      <Td>
                        <p className="text-muted">{purposeLabels[request.purpose] ?? request.purpose}</p>
                        {request.emergency && (
                          <p className="mt-1 flex items-start gap-1 text-xs text-danger">
                            <TriangleAlert size={12} className="mt-0.5 shrink-0" aria-hidden />
                            <span>Break-glass: {request.reason}</span>
                          </p>
                        )}
                        <p className="mt-0.5 text-xs text-faint">{formatDate(request.createdAt)}</p>
                      </Td>
                      <Td>
                        <StatusBadge status={request.status} />
                      </Td>
                      <Td className="whitespace-nowrap text-xs text-muted">
                        {request.status === "APPROVED" ? (
                          <>
                            <p>{formatRemaining(request.expiresAt)}</p>
                            <p className="text-faint">{formatUsage(request.accessCount, request.maxAccesses)}</p>
                          </>
                        ) : (
                          "—"
                        )}
                      </Td>
                      <Td className="text-right">
                        {approving === request.id ? (
                          <div className="flex flex-wrap items-end justify-end gap-2">
                            <div className="w-32 text-left">
                              <Field id={`duration-${request.id}`} label="Lasts">
                                <Select
                                  id={`duration-${request.id}`}
                                  value={durationDays}
                                  onChange={(e) => setDurationDays(Number(e.target.value))}
                                >
                                  {DURATION_CHOICES.map((choice) => (
                                    <option key={choice.value} value={choice.value}>
                                      {choice.label}
                                    </option>
                                  ))}
                                </Select>
                              </Field>
                            </div>
                            <div className="w-36 text-left">
                              <Field id={`limit-${request.id}`} label="Downloads">
                                <Select
                                  id={`limit-${request.id}`}
                                  value={maxAccesses}
                                  onChange={(e) => setMaxAccesses(Number(e.target.value))}
                                >
                                  {LIMIT_CHOICES.map((choice) => (
                                    <option key={choice.value} value={choice.value}>
                                      {choice.label}
                                    </option>
                                  ))}
                                </Select>
                              </Field>
                            </div>
                            <Button size="sm" variant="ghost" onClick={() => setApproving(null)}>
                              Cancel
                            </Button>
                            <Button
                              size="sm"
                              variant="primary"
                              disabled={busy !== null}
                              onClick={() => confirmApproval(request)}
                            >
                              Grant
                            </Button>
                          </div>
                        ) : (
                          <div className="inline-flex gap-2">
                            {request.status === "PENDING" && (
                              <>
                                <Button size="sm" variant="danger" disabled={busy !== null} onClick={() => deny(request)}>
                                  Deny
                                </Button>
                                <Button
                                  size="sm"
                                  variant="primary"
                                  disabled={busy !== null}
                                  onClick={() => startApproving(request)}
                                >
                                  Approve…
                                </Button>
                              </>
                            )}
                            {request.status === "APPROVED" && (
                              <Button size="sm" variant="danger" disabled={busy !== null} onClick={() => deny(request)}>
                                Revoke
                              </Button>
                            )}
                          </div>
                        )}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Panel>
        </>
      )}

      {auditRecord && <AuditTrail record={auditRecord} onClose={() => setAuditRecord(null)} />}
    </AppShell>
  );
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable (insecure context); the ID is still visible
    }
  };

  return (
    <button onClick={copy} aria-label={label} title={copied ? "Copied" : "Copy"} className="rounded p-0.5 hover:text-fg">
      {copied ? <Check size={12} className="text-ok" aria-hidden /> : <Copy size={12} aria-hidden />}
    </button>
  );
}
