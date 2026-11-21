import { useCallback, useEffect, useState } from "react";
import { Inbox, TriangleAlert } from "lucide-react";
import { AppShell } from "../components/AppShell";
import {
  Button,
  EmptyState,
  Field,
  HospitalTag,
  Input,
  Notice,
  PageHeader,
  Panel,
  Select,
  StatusBadge,
  Table,
  Td,
  Th,
} from "../components/ui";
import { apiFetch, apiJson, downloadFile, errorMessage } from "../lib/api";
import type { AccessPurpose } from "../lib/format";
import { formatDate, formatRemaining, formatUsage, purposeLabels, requestablePurposes } from "../lib/format";
import { getSession } from "../lib/session";

interface DoctorRequest {
  id: number;
  recordId: number;
  status: "PENDING" | "APPROVED" | "DENIED" | "EXPIRED" | "EXHAUSTED" | "INVALIDATED";
  allowed: boolean;
  purpose: AccessPurpose;
  expiresAt: string | null;
  maxAccesses: number;
  accessCount: number;
  emergency: boolean;
  createdAt: string;
  record: {
    id: number;
    filename: string | null;
    patient?: { hospital?: { name: string } };
  };
}

type Message = { tone: "success" | "error"; text: string } | null;

export function DoctorDashboard() {
  const ownHospital = getSession()?.hospital ?? "";
  const [requests, setRequests] = useState<DoctorRequest[]>([]);
  const [recordId, setRecordId] = useState("");
  const [purpose, setPurpose] = useState<AccessPurpose>("TREATMENT");
  const [emergencyOpen, setEmergencyOpen] = useState(false);
  const [emergencyRecordId, setEmergencyRecordId] = useState("");
  const [emergencyReason, setEmergencyReason] = useState("");
  const [message, setMessage] = useState<Message>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const loadRequests = useCallback(async () => {
    try {
      const data = await apiJson<{ requests: DoctorRequest[] }>("/permissions/mine");
      setRequests(data.requests);
    } catch {
      // polled; a failed refresh keeps the last list (an expired session redirects)
    }
  }, []);

  useEffect(() => {
    loadRequests();
    const interval = setInterval(loadRequests, 5000);
    return () => clearInterval(interval);
  }, [loadRequests]);

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

  const requestAccess = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    run("request", async () => {
      await apiFetch("/permissions/request", {
        method: "POST",
        body: JSON.stringify({ recordId: Number(recordId), purpose }),
      });
      const asked = recordId;
      setRecordId("");
      await loadRequests();
      return `Request for record ${asked} sent for ${purposeLabels[purpose].toLowerCase()}. The patient has been asked to approve it.`;
    });
  };

  const takeEmergencyAccess = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    run("emergency", async () => {
      const data = await apiJson<{ message: string }>("/permissions/emergency", {
        method: "POST",
        body: JSON.stringify({ recordId: Number(emergencyRecordId), reason: emergencyReason }),
      });
      setEmergencyRecordId("");
      setEmergencyReason("");
      setEmergencyOpen(false);
      await loadRequests();
      return data.message;
    });
  };

  return (
    <AppShell
      nav={[{ key: "requests", label: "Access requests", icon: <Inbox size={16} aria-hidden /> }]}
      active="requests"
      onSelect={() => undefined}
    >
      <PageHeader
        title="Access requests"
        description="Ask a patient for access using the record ID they give you, stating why you need it. You can download a record only while the patient's consent is active on the ledger, within the limits they set."
      />

      {message && (
        <div className="mb-5">
          <Notice tone={message.tone}>{message.text}</Notice>
        </div>
      )}

      <Panel className="mb-6 p-5">
        <form onSubmit={requestAccess} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="sm:w-40">
            <Field id="record-id" label="Record ID">
              <Input
                id="record-id"
                type="number"
                min={1}
                inputMode="numeric"
                value={recordId}
                onChange={(e) => setRecordId(e.target.value)}
                required
              />
            </Field>
          </div>
          <div className="sm:w-56">
            <Field id="purpose" label="Purpose">
              <Select
                id="purpose"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value as AccessPurpose)}
              >
                {requestablePurposes.map((value) => (
                  <option key={value} value={value}>
                    {purposeLabels[value]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Button type="submit" variant="primary" disabled={busy === "request"}>
            {busy === "request" ? "Sending…" : "Request access"}
          </Button>
        </form>

        <div className="mt-4 border-t border-line pt-4">
          {!emergencyOpen ? (
            <button
              type="button"
              onClick={() => setEmergencyOpen(true)}
              className="inline-flex items-center gap-2 text-sm font-medium text-danger hover:underline"
            >
              <TriangleAlert size={15} aria-hidden />
              Emergency access
            </button>
          ) : (
            <form onSubmit={takeEmergencyAccess} className="space-y-3">
              <div className="flex items-start gap-2 text-sm text-danger">
                <TriangleAlert size={15} className="mt-0.5 shrink-0" aria-hidden />
                <p>
                  Break-glass access is granted without the patient for 60 minutes and at most 3 downloads. It is
                  recorded on the ledger as an emergency, with your reason, and the patient can revoke it at any time.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="sm:w-40">
                  <Field id="emergency-record-id" label="Record ID">
                    <Input
                      id="emergency-record-id"
                      type="number"
                      min={1}
                      inputMode="numeric"
                      value={emergencyRecordId}
                      onChange={(e) => setEmergencyRecordId(e.target.value)}
                      required
                    />
                  </Field>
                </div>
                <div className="flex-1">
                  <Field id="emergency-reason" label="Clinical reason" hint="At least 10 characters. Stored on the ledger.">
                    <Input
                      id="emergency-reason"
                      value={emergencyReason}
                      onChange={(e) => setEmergencyReason(e.target.value)}
                      minLength={10}
                      maxLength={500}
                      required
                    />
                  </Field>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setEmergencyOpen(false);
                      setEmergencyReason("");
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" variant="danger" disabled={busy === "emergency"}>
                    {busy === "emergency" ? "Taking…" : "Take access"}
                  </Button>
                </div>
              </div>
            </form>
          )}
        </div>
      </Panel>

      <Panel>
        {requests.length === 0 ? (
          <EmptyState title="No requests yet">Requests you send will appear here with the patient's decision.</EmptyState>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Record</Th>
                <Th>Purpose</Th>
                <Th>Patient's hospital</Th>
                <Th>Status</Th>
                <Th>Limits</Th>
                <Th className="text-right">
                  <span className="sr-only">Actions</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {requests.map((request) => {
                const filename = request.record.filename ?? `record-${request.recordId}`;
                const hospital = request.record.patient?.hospital?.name;
                const granted = request.status === "APPROVED";
                return (
                  <tr key={request.id}>
                    <Td>
                      <p className="font-medium text-fg">{filename}</p>
                      <p className="mt-0.5 font-mono text-xs text-faint">
                        ID {request.recordId} · asked {formatDate(request.createdAt)}
                      </p>
                    </Td>
                    <Td>
                      <span className="text-muted">{purposeLabels[request.purpose] ?? request.purpose}</span>
                      {request.emergency && (
                        <span className="ml-1.5 inline-flex items-center gap-1 rounded border border-danger/40 px-1.5 py-0.5 text-xs font-medium text-danger">
                          <TriangleAlert size={11} aria-hidden />
                          Break-glass
                        </span>
                      )}
                    </Td>
                    <Td>{hospital ? <HospitalTag name={hospital} ownHospital={ownHospital} /> : "—"}</Td>
                    <Td>
                      <StatusBadge status={request.status} />
                    </Td>
                    <Td className="whitespace-nowrap text-xs text-muted">
                      {granted ? (
                        <>
                          <p>{formatRemaining(request.expiresAt)}</p>
                          <p className="text-faint">{formatUsage(request.accessCount, request.maxAccesses)}</p>
                        </>
                      ) : (
                        "—"
                      )}
                    </Td>
                    <Td className="text-right">
                      {request.allowed && (
                        <Button
                          size="sm"
                          disabled={busy === `download-${request.id}`}
                          onClick={() =>
                            run(`download-${request.id}`, async () => {
                              await downloadFile(`/records/${request.recordId}`, filename);
                              await loadRequests();
                              return `${filename} downloaded. The download was checked and logged on the ledger.`;
                            })
                          }
                        >
                          Download
                        </Button>
                      )}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Panel>
    </AppShell>
  );
}
