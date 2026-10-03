import { useState, useEffect } from "react";
import { 
  Upload, 
  Download, 
  FileText, 
  Shield, 
  Activity, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  Lock,
  Eye,
  History,
  LogOut,
  X,
  Link2,
  UserCheck,
  UserX,
  ShieldOff,
  Send,
  Hash,
  Building2
} from "lucide-react";
interface Record {
  id: number;
  filename: string;
  cid: string;
  hash: string;
  createdAt: string;
  size?: number;
  status?: string;
}


interface AccessLog {
  id: number;
  doctorName: string;
  doctorHospital: string;
  accessedAt: string;
  recordName: string;
  status: "approved" | "pending" | "denied";
}

interface PermissionResponse {
  id: number;
  status: "APPROVED" | "PENDING" | "DENIED";
  createdAt: string;
  doctor?: { name: string; hospital?: { name: string } };
  record?: { filename: string };
}

type AuditAction =
  | "RECORD_REGISTERED"
  | "ACCESS_REQUESTED"
  | "ACCESS_GRANTED"
  | "ACCESS_DENIED"
  | "ACCESS_REVOKED"
  | "RECORD_ACCESSED";

interface AuditEntry {
  action: AuditAction;
  actorId: string;
  actorRole: string;
  actorName: string | null;
  actorHospital: string;
  doctorName: string | null;
  doctorHospital: string | null;
  targetId: string;
  actorMsp: string;
  actorIdentity: string;
  timestamp: string;
  txId: string;
}

// actorIdentity looks like "x509::/OU=client/.../CN=mediledger-user-12::/C=US/.../CN=ca.org1.example.com";
// the first CN is the signer's enrollment ID
const signerName = (identity: string) => identity.match(/CN=([^/:]+)/)?.[1] ?? "unknown";

const errorMessage = (err: unknown) =>
  err instanceof Error ? err.message : "Something went wrong";

export function PatientDashboard() {
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "info">("info");
  const [records, setRecords] = useState<Record[]>([]);
  const [accessLogs, setAccessLogs] = useState<AccessLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"upload" | "records" | "access" | "security">("upload");
  const [userName] = useState(localStorage.getItem("name") || "");
  const [hospitalName] = useState(localStorage.getItem("hospital") || "");
  const [auditRecord, setAuditRecord] = useState<Record | null>(null);
  const [auditTrail, setAuditTrail] = useState<AuditEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState("");
  const showMessage = (
  text: string,
  type: "success" | "error" | "info"
) => {
  setMessage(text);
  setMessageType(type);

  setTimeout(() => {
    setMessage("");
  }, 3000);
};

  // Fetch user records on mount
 // Fetch records once on mount
useEffect(() => {
  fetchRecords();
}, []);

// Auto refresh access logs when Access tab is open
useEffect(() => {
  if (activeTab === "access") {
    fetchAccessLogs();

    const interval = setInterval(() => {
      fetchAccessLogs();
    }, 3000);

    return () => clearInterval(interval);
  }
}, [activeTab]);

const fetchRecords = async () => {
  try {
    const res = await fetch("http://localhost:5000/records/mine", {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`
      }
    });

    const data = await res.json();

    if (res.ok) {
      console.log("Records from backend:", data);
      setRecords(data);   
    }
  } catch {
    console.error("Failed to fetch records");
  }
};

const fetchAccessLogs = async () => {
  try {
    const res = await fetch("http://localhost:5000/permissions/for-patient", {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`
      }
    });

    const data = await res.json();

    if (res.ok) {
      setAccessLogs(
        data.requests.map((req: PermissionResponse) => ({
          id: req.id,
          doctorName: req.doctor?.name || "Doctor",
          doctorHospital: req.doctor?.hospital?.name || "",
          accessedAt: req.createdAt,
          recordName: req.record?.filename,
          status: req.status.toLowerCase() as AccessLog["status"]
        }))
      );
    }
  } catch {
    console.error("Failed to fetch access logs");
  }
};

  const handleUpload = async () => {
    if (!file) {
      showMessage("Please select a file", "error");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    setLoading(true);

    try {
      const res = await fetch("http://localhost:5000/records/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`
        },
        body: formData
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Upload failed");
      }

      showMessage("File encrypted and uploaded to IPFS successfully ", "success");
      setFile(null);
      fetchRecords(); // Refresh records list
    } catch (err) {
      showMessage(errorMessage(err), "error");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (recordId: number, filename: string) => {
  setLoading(true);
  showMessage("Verifying integrity and decrypting...", "info");

  try {
    const res = await fetch(`http://localhost:5000/records/${recordId}`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`
      }
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Download failed");
    }

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    showMessage("File decrypted and downloaded ✅", "success");
  } catch (err) {
    showMessage(errorMessage(err), "error");
  } finally {
    setLoading(false);
  }
};
const handleApprove = async (id: number) => {
  try {
    const res = await fetch(
      `http://localhost:5000/permissions/approve/${id}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`
        }
      }
    );

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || data.error || "Failed to approve request");
    }

    showMessage("Access approved and recorded on the blockchain", "success");
    fetchAccessLogs();
  } catch (err) {
    showMessage(errorMessage(err), "error");
  }
};
// Denying an approved request revokes it (backend + ledger handle both)
const handleDeny = async (id: number, revoking = false) => {
  try {
    const res = await fetch(
      `http://localhost:5000/permissions/deny/${id}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`
        }
      }
    );

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || data.error || "Failed to deny request");
    }

    showMessage(revoking ? "Access revoked" : "Access denied", "success");
    fetchAccessLogs();
  } catch (err) {
    showMessage(errorMessage(err), "error");
  }
};

const openAudit = async (record: Record) => {
  setAuditRecord(record);
  setAuditTrail([]);
  setAuditError("");
  setAuditLoading(true);

  try {
    const res = await fetch(`http://localhost:5000/records/${record.id}/audit`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`
      }
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || data.error || "Failed to load audit trail");
    }

    // Newest first
    setAuditTrail([...data.trail].reverse());
  } catch (err) {
    setAuditError(errorMessage(err));
  } finally {
    setAuditLoading(false);
  }
};


  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };
  const handleLogout = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("role");
  localStorage.removeItem("name");
  localStorage.removeItem("hospital");
  window.location.href = "/login";
};

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900">
      {/* Header */}
      <header className="bg-gray-800/50 backdrop-blur-md border-b border-gray-700 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <Shield className="text-blue-400" size={32} />
            <div>
              <h1 className="text-2xl font-bold text-white">MediLedger</h1>
              <p className="text-xs text-gray-400">Blockchain Patient Portal</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="text-right">
              <p className="text-sm text-white font-medium">{userName}</p>
              <p className="text-xs text-gray-400">
                {hospitalName ? `Patient · ${hospitalName}` : "Patient Account"}
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
              title="Logout"
            >
              <LogOut className="text-gray-400" size={20} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <StatCard
            icon={<FileText size={24} />}
            label="Total Records"
            value={records.length.toString()}
            color="blue"
          />
          <StatCard
            icon={<Lock size={24} />}
            label="Encrypted Files"
            value={records.length.toString()}
            color="green"
          />
          <StatCard
            icon={<Activity size={24} />}
            label="Access Requests"
            value={accessLogs.filter(log => log.status === "pending").length.toString()}
            color="yellow"
          />
          <StatCard
            icon={<CheckCircle size={24} />}
            label="Verified"
            value="100%"
            color="purple"
          />
        </div>

        {/* Message Alert */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg flex items-center space-x-3 ${
            messageType === "success" ? "bg-green-500/20 border border-green-500/50" :
            messageType === "error" ? "bg-red-500/20 border border-red-500/50" :
            "bg-blue-500/20 border border-blue-500/50"
          }`}>
            {messageType === "success" ? <CheckCircle className="text-green-400" size={20} /> :
             messageType === "error" ? <AlertCircle className="text-red-400" size={20} /> :
             <Activity className="text-blue-400" size={20} />}
            <p className="text-white">{message}</p>
          </div>
        )}

        {/* Tabs */}
        <div className="bg-gray-800/50 backdrop-blur-md rounded-t-xl border border-gray-700 border-b-0">
          <div className="flex space-x-1 p-2">
            <TabButton
              icon={<Upload size={18} />}
              label="Upload Record"
              active={activeTab === "upload"}
              onClick={() => setActiveTab("upload")}
            />
            <TabButton
              icon={<FileText size={18} />}
              label="My Records"
              active={activeTab === "records"}
              onClick={() => setActiveTab("records")}
              badge={records.length}
            />
            <TabButton
              icon={<Eye size={18} />}
              label="Access Logs"
              active={activeTab === "access"}
              onClick={() => setActiveTab("access")}
              badge={accessLogs.filter(log => log.status === "pending").length}
            />
            <TabButton
              icon={<Shield size={18} />}
              label="Security"
              active={activeTab === "security"}
              onClick={() => setActiveTab("security")}
            />
          </div>
        </div>

        {/* Tab Content */}
        <div className="bg-gray-800/30 backdrop-blur-md rounded-b-xl border border-gray-700 border-t-0 p-8">
          {activeTab === "upload" && (
            <div className="max-w-2xl mx-auto">
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-500/20 rounded-full mb-4">
                  <Upload className="text-blue-400" size={32} />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Upload Medical Record</h2>
                <p className="text-gray-400">
                  Your file will be encrypted with AES-256 and stored on IPFS
                </p>
              </div>

              <div className="space-y-6">
                <div className="border-2 border-dashed border-gray-600 rounded-xl p-8 text-center hover:border-blue-500 transition-colors">
                  <input
                    type="file"
                    id="file-upload"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    className="hidden"
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  />
                  <label htmlFor="file-upload" className="cursor-pointer">
                    <FileText className="mx-auto text-gray-500 mb-4" size={48} />
                    {file ? (
                      <div>
                        <p className="text-white font-medium">{file.name}</p>
                        <p className="text-gray-400 text-sm mt-1">
                          {(file.size / 1024).toFixed(2)} KB
                        </p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-white mb-1">Click to select file</p>
                        <p className="text-gray-500 text-sm">
                          PDF, JPG, PNG, DOC (Max 10MB)
                        </p>
                      </div>
                    )}
                  </label>
                </div>

                <button
                  onClick={handleUpload}
                  disabled={!file || loading}
                  className="w-full bg-blue-600 text-white px-6 py-4 rounded-xl font-medium hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-all transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center space-x-2"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      <span>Encrypting & Uploading...</span>
                    </>
                  ) : (
                    <>
                      <Lock size={20} />
                      <span>Encrypt & Upload to IPFS</span>
                    </>
                  )}
                </button>

                <div className="bg-gray-700/30 rounded-lg p-4 space-y-2">
                  <p className="text-gray-300 text-sm font-medium flex items-center">
                    <Shield className="mr-2 text-green-400" size={16} />
                    Security Features Active:
                  </p>
                  <ul className="text-gray-400 text-sm space-y-1 ml-6">
                    <li>✓ AES-256-CBC Encryption</li>
                    <li>✓ SHA-256 Integrity Hash</li>
                    <li>✓ IPFS Decentralized Storage</li>
                    <li>✓ Blockchain Audit Trail</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {activeTab === "records" && (
            <div>
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-white mb-2">My Medical Records</h2>
                <p className="text-gray-400">
                  All records are encrypted and stored on IPFS with blockchain verification
                </p>
              </div>

              {records.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="mx-auto text-gray-600 mb-4" size={64} />
                  <p className="text-gray-400">No records uploaded yet</p>
                  <button
                    onClick={() => setActiveTab("upload")}
                    className="mt-4 text-blue-400 hover:text-blue-300"
                  >
                    Upload your first record →
                  </button>
                </div>
              ) : (
                <div className="grid gap-4">
                  {records.map((record) => (
                    <div
                      key={record.id}
                      className="bg-gray-700/30 rounded-lg p-6 border border-gray-600 hover:border-blue-500 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-4 flex-1">
                          <div className="bg-blue-500/20 p-3 rounded-lg">
                            <FileText className="text-blue-400" size={24} />
                          </div>
                          <div className="flex-1">
                            <h3 className="text-white font-medium mb-1">{record.filename}</h3>
                            <p className="text-xs text-gray-500 mb-1">
                            Record ID: {record.id}
                            </p>
                            <div className="space-y-1">
                              <p className="text-gray-400 text-sm flex items-center">
                                <Clock size={14} className="mr-1" />
                                {formatDate(record.createdAt)}
                              </p>
                              <p className="text-gray-400 text-sm font-mono">
                                CID: {record.cid.substring(0, 20)}...
                              </p>
                              <div className="flex items-center space-x-2 mt-2">
                                <span className="bg-green-500/20 text-green-400 text-xs px-2 py-1 rounded flex items-center">
                                  <CheckCircle size={12} className="mr-1" />
                                  Encrypted
                                </span>
                                <span className="bg-purple-500/20 text-purple-400 text-xs px-2 py-1 rounded flex items-center">
                                  <Shield size={12} className="mr-1" />
                                  Verified
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleDownload(record.id, record.filename)}
                            disabled={loading}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm flex items-center space-x-2 transition-colors disabled:bg-gray-600"
                          >
                            <Download size={16} />
                            <span>Download</span>
                          </button>
                          <button
                            onClick={() => openAudit(record)}
                            className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm flex items-center space-x-2 transition-colors"
                            title="Blockchain audit trail"
                          >
                            <History size={16} />
                            <span>History</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "access" && (
            <div>
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-white mb-2">Access Requests</h2>
                <p className="text-gray-400">
                  Manage who can view your medical records
                </p>
              </div>

              {accessLogs.length === 0 ? (
                <div className="text-center py-12">
                  <Eye className="mx-auto text-gray-600 mb-4" size={64} />
                  <p className="text-gray-400">No access requests yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {accessLogs.map((log) => (
                    <div
                      key={log.id}
                      className="bg-gray-700/30 rounded-lg p-6 border border-gray-600"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-white font-medium mb-1">{log.doctorName}</h3>
                          {log.doctorHospital && (
                            <p className="text-blue-300 text-xs mb-1 flex items-center">
                              <Building2 size={12} className="mr-1" />
                              {log.doctorHospital}
                              {hospitalName && log.doctorHospital !== hospitalName && (
                                <span className="ml-2 bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded">
                                  Other hospital
                                </span>
                              )}
                            </p>
                          )}
                          <p className="text-gray-400 text-sm">
                            {log.status === "pending" ? "Requesting access to" : "Access to"}: {log.recordName}
                          </p>
                          <p className="text-gray-500 text-xs mt-1">
                            {formatDate(log.accessedAt)}
                          </p>
                        </div>
                        {log.status === "pending" && (
                          <div className="flex space-x-2">
                            <button
                                onClick={() => handleApprove(log.id)}
                                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm"
                               >
                                Approve
                            </button>
                            <button
                             onClick={() => handleDeny(log.id)}
                             className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm">
                              Deny
                            </button>
                          </div>
                        )}
                        {log.status === "approved" && (
                          <div className="flex items-center space-x-3">
                            <span className="bg-green-500/20 text-green-400 text-xs px-3 py-1 rounded-full">
                              Approved
                            </span>
                            <button
                              onClick={() => handleDeny(log.id, true)}
                              className="bg-gray-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm"
                            >
                              Revoke
                            </button>
                          </div>
                        )}
                        {log.status === "denied" && (
                          <span className="bg-red-500/20 text-red-400 text-xs px-3 py-1 rounded-full">
                            Denied
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "security" && (
            <div className="max-w-3xl mx-auto">
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-white mb-2">Security Overview</h2>
                <p className="text-gray-400">
                  Your data protection and encryption status
                </p>
              </div>

              <div className="space-y-6">
                <SecurityFeature
                  title="End-to-End Encryption"
                  description="All files encrypted with AES-256-CBC before upload"
                  status="active"
                  icon={<Lock />}
                />
                <SecurityFeature
                  title="Blockchain Verification"
                  description="Consent and every download recorded on Hyperledger Fabric; file hashes checked against the ledger"
                  status="active"
                  icon={<Shield />}
                />

                <SecurityFeature
                  title="Decentralized Storage"
                  description="Files stored on IPFS - no single point of failure"
                  status="active"
                  icon={<Activity />}
                />
                <SecurityFeature
                  title="Integrity Checking"
                  description="SHA-256 hash verification on every download"
                  status="active"
                  icon={<CheckCircle />}
                />

                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-6 mt-8">
                  <h3 className="text-white font-medium mb-3 flex items-center">
                    <Shield className="mr-2 text-blue-400" size={20} />
                    Compliance Status
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-gray-400 text-sm">HIPAA Compliant</p>
                      <p className="text-green-400 text-lg font-bold">✓ Active</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-sm">GDPR Compliant</p>
                      <p className="text-green-400 text-lg font-bold">✓ Active</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {auditRecord && (
        <AuditTrailModal
          record={auditRecord}
          entries={auditTrail}
          loading={auditLoading}
          error={auditError}
          onClose={() => setAuditRecord(null)}
          formatDate={formatDate}
        />
      )}
    </div>
  );
}

// Helper Components
function StatCard({ icon, label, value, color }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: "blue" | "green" | "yellow" | "purple";
}) {
  const colorClasses = {
    blue: "from-blue-500/20 to-blue-600/20 border-blue-500/50",
    green: "from-green-500/20 to-green-600/20 border-green-500/50",
    yellow: "from-yellow-500/20 to-yellow-600/20 border-yellow-500/50",
    purple: "from-purple-500/20 to-purple-600/20 border-purple-500/50"
  };

  const textColor = {
    blue: "text-blue-400",
    green: "text-green-400",
    yellow: "text-yellow-400",
    purple: "text-purple-400"
  };

  return (
    <div className={`bg-gradient-to-br ${colorClasses[color]} backdrop-blur-md border rounded-xl p-6`}>
      <div className="flex items-center justify-between mb-3">
        <div className={textColor[color]}>{icon}</div>
        <div className="text-3xl font-bold text-white">{value}</div>
      </div>
      <p className="text-gray-300 text-sm">{label}</p>
    </div>
  );
}


function TabButton({ icon, label, active, onClick, badge }: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
  badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center space-x-2 px-6 py-3 rounded-lg transition-all relative ${
        active
          ? "bg-blue-600 text-white"
          : "text-gray-400 hover:text-white hover:bg-gray-700/50"
      }`}
    >
      {icon}
      <span className="font-medium">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
          {badge}
        </span>
      )}
    </button>
  );
}

function SecurityFeature({ title, description, status, icon }: {
  title: string;
  description: string;
  status: "active" | "inactive";
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-gray-700/30 rounded-lg p-6 border border-gray-600">
      <div className="flex items-start space-x-4">
        <div className={`p-3 rounded-lg ${
          status === "active" ? "bg-green-500/20 text-green-400" : "bg-gray-600/50 text-gray-500"
        }`}>
          {icon}
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-white font-medium">{title}</h3>
            <span className={`text-xs px-3 py-1 rounded-full ${
              status === "active"
                ? "bg-green-500/20 text-green-400"
                : "bg-gray-600/50 text-gray-400"
            }`}>
              {status === "active" ? "Active" : "Inactive"}
            </span>
          </div>
          <p className="text-gray-400 text-sm">{description}</p>
        </div>
      </div>
    </div>
  );
}

const auditStyles: { [K in AuditAction]: { icon: React.ReactNode; color: string } } = {
  RECORD_REGISTERED: { icon: <Upload size={16} />, color: "bg-blue-500/20 text-blue-400" },
  ACCESS_REQUESTED: { icon: <Send size={16} />, color: "bg-yellow-500/20 text-yellow-400" },
  ACCESS_GRANTED: { icon: <UserCheck size={16} />, color: "bg-green-500/20 text-green-400" },
  ACCESS_DENIED: { icon: <UserX size={16} />, color: "bg-red-500/20 text-red-400" },
  ACCESS_REVOKED: { icon: <ShieldOff size={16} />, color: "bg-red-500/20 text-red-400" },
  RECORD_ACCESSED: { icon: <Download size={16} />, color: "bg-purple-500/20 text-purple-400" }
};

function describeAudit(entry: AuditEntry): string {
  const doctor = `${entry.doctorName || `Doctor #${entry.targetId}`} (${entry.doctorHospital})`;
  const actor = `${entry.actorName || `User #${entry.actorId}`} (${entry.actorHospital})`;

  switch (entry.action) {
    case "RECORD_REGISTERED":
      return "Record uploaded and its hash anchored on the ledger";
    case "ACCESS_REQUESTED":
      return `${doctor} requested access`;
    case "ACCESS_GRANTED":
      return `You approved access for ${doctor}`;
    case "ACCESS_DENIED":
      return `You denied access to ${doctor}`;
    case "ACCESS_REVOKED":
      return `You revoked access for ${doctor}`;
    case "RECORD_ACCESSED":
      return entry.actorRole === "PATIENT"
        ? "You downloaded the record"
        : `${actor} downloaded the record`;
  }
}

function AuditTrailModal({ record, entries, loading, error, onClose, formatDate }: {
  record: Record;
  entries: AuditEntry[];
  loading: boolean;
  error: string;
  onClose: () => void;
  formatDate: (date: string) => string;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-800 border border-gray-700 rounded-xl w-full max-w-2xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="audit-title"
      >
        <div className="flex items-start justify-between p-6 border-b border-gray-700">
          <div>
            <h2 id="audit-title" className="text-xl font-bold text-white flex items-center">
              <History className="mr-2 text-blue-400" size={22} />
              Audit Trail
            </h2>
            <p className="text-gray-400 text-sm mt-1">{record.filename}</p>
            <p className="text-gray-500 text-xs mt-2 flex items-center">
              <Link2 size={12} className="mr-1" />
              Read from the Hyperledger Fabric ledger. Entries cannot be edited or deleted.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
            title="Close"
          >
            <X className="text-gray-400" size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-12 text-gray-400 space-x-3">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-400"></div>
              <span>Reading ledger...</span>
            </div>
          )}

          {!loading && error && (
            <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 flex items-center space-x-3">
              <AlertCircle className="text-red-400" size={20} />
              <p className="text-white text-sm">{error}</p>
            </div>
          )}

          {!loading && !error && entries.length === 0 && (
            <p className="text-gray-400 text-center py-12">
              No ledger entries for this record yet
            </p>
          )}

          {!loading && !error && entries.length > 0 && (
            <ol className="relative border-l border-gray-700 ml-4 space-y-6">
              {entries.map((entry) => (
                <li key={`${entry.txId}-${entry.action}`} className="ml-6">
                  <span
                    className={`absolute -left-4 flex items-center justify-center w-8 h-8 rounded-full ring-4 ring-gray-800 ${auditStyles[entry.action].color}`}
                  >
                    {auditStyles[entry.action].icon}
                  </span>
                  <p className="text-white text-sm font-medium">{describeAudit(entry)}</p>
                  <p className="text-gray-400 text-xs mt-1 flex items-center">
                    <Clock size={12} className="mr-1" />
                    {formatDate(entry.timestamp)}
                  </p>
                  <p
                    className="text-gray-500 text-xs mt-1 font-mono flex items-center"
                    title={entry.txId}
                  >
                    <Hash size={12} className="mr-1" />
                    tx {entry.txId.substring(0, 16)}...
                  </p>
                  <p
                    className="text-gray-500 text-xs mt-1 font-mono flex items-center"
                    title={entry.actorIdentity}
                  >
                    <Lock size={12} className="mr-1" />
                    Signed by {signerName(entry.actorIdentity)} · {entry.actorHospital} ({entry.actorMsp})
                  </p>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}
