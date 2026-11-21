export function formatDate(value: string) {
  return new Date(value).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export type AccessPurpose = "TREATMENT" | "DIAGNOSIS" | "EMERGENCY" | "INSURANCE" | "RESEARCH";

export const purposeLabels: Record<AccessPurpose, string> = {
  TREATMENT: "Treatment",
  DIAGNOSIS: "Diagnosis",
  EMERGENCY: "Emergency care",
  INSURANCE: "Insurance claim",
  RESEARCH: "Research",
};

// Purposes a doctor can pick when requesting. Emergency is not one of them:
// it is taken through break-glass, which has its own caps and audit action.
export const requestablePurposes: AccessPurpose[] = [
  "TREATMENT",
  "DIAGNOSIS",
  "INSURANCE",
  "RESEARCH",
];

// "in 29 days" / "in 4 hours" / "expired", for a grant's remaining life
export function formatRemaining(expiresAt: string | null): string {
  if (!expiresAt) return "No expiry";

  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return "Expired";

  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `${minutes} min left`;

  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} hour${hours === 1 ? "" : "s"} left`;

  return `${Math.round(hours / 24)} days left`;
}

// "3 of 5 used" / "2 downloads" when the grant is unlimited
export function formatUsage(accessCount: number, maxAccesses: number): string {
  if (maxAccesses > 0) return `${accessCount} of ${maxAccesses} used`;
  return accessCount === 1 ? "1 download" : `${accessCount} downloads`;
}
