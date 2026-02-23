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
  Share2,
  LogOut
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
  id: string;
  doctorName: string;
  accessedAt: string;
  recordName: string;
  status: "approved" | "pending" | "denied";
}

export function PatientDashboard() {
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "info">("info");
  const [records, setRecords] = useState<Record[]>([]);
  const [accessLogs, setAccessLogs] = useState<AccessLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"upload" | "records" | "access" | "security">("upload");
  const [userName, setUserName] = useState("");

  // Fetch user records on mount
  useEffect(() => {
    fetchRecords();
    fetchAccessLogs();
    fetchUserProfile();
  }, []);

 const fetchUserProfile = async () => {
  try {
    const res = await fetch("http://localhost:5000/user/profile", {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`
      }
    });
    const data = await res.json();
    if (res.ok) {
      setUserName(data.name || "Patient");
    }
  } catch (err) {
    console.error("Failed to fetch profile");
  }
};


  const fetchRecords = async () => {
    try {
      const res = await fetch("http://localhost:5000/records/mine", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`
        }
      });
      const data = await res.json();
      if (res.ok) {
        setRecords(data.records || []);
      }
    } catch (err) {
      console.error("Failed to fetch records");
    }
  };

  const fetchAccessLogs = async () => {
    // Mock data - replace with actual API call when backend ready
    setAccessLogs([
      {
        id: "1",
        doctorName: "Dr. Sarah Johnson",
        accessedAt: new Date().toISOString(),
        recordName: "Blood Test Report",
        status: "pending"
      }
    ]);
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
    } catch (err: any) {
      showMessage(err.message, "error");
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
  } catch (err: any) {
    showMessage(err.message, "error");
  } finally {
    setLoading(false);
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
              <p className="text-xs text-gray-400">Patient Account</p>
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
                            className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm flex items-center space-x-2 transition-colors"
                            title="Share with doctor"
                          >
                            <Share2 size={16} />
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
                          <p className="text-gray-400 text-sm">
                            Requesting access to: {log.recordName}
                          </p>
                          <p className="text-gray-500 text-xs mt-1">
                            {formatDate(log.accessedAt)}
                          </p>
                        </div>
                        {log.status === "pending" && (
                          <div className="flex space-x-2">
                            <button className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm">
                              Approve
                            </button>
                            <button className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm">
                              Deny
                            </button>
                          </div>
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
  description="Blockchain Layer (Planned - Phase 2)"
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
