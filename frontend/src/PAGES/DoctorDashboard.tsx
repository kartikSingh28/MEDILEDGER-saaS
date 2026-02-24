import { useEffect, useState } from "react";
import { FileText, Shield, Download, Activity } from "lucide-react";

interface Request {
  id: number;
  recordId: number;
  patientId: number;
  status: string;
  allowed: boolean;
  record: {
    id: number;
    filename: string;
  };
}

export function DoctorDashboard() {
  const [requests, setRequests] = useState<Request[]>([]);
  const [recordId, setRecordId] = useState("");
  const [message, setMessage] = useState("");
  const token = localStorage.getItem("token");

  useEffect(() => {
    fetchRequests();

    const interval = setInterval(() => {
      fetchRequests();
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const fetchRequests = async () => {
    const res = await fetch("http://localhost:5000/permissions/mine", {
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await res.json();
    if (res.ok) setRequests(data.requests);
  };

  const requestAccess = async () => {
    if (!recordId) return;

    const res = await fetch("http://localhost:5000/permissions/request", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ recordId: Number(recordId) }),
    });

    const data = await res.json();
    if (res.ok) {
      setMessage("Access request sent successfully");
      setRecordId("");
      fetchRequests();
    } else {
      setMessage(data.message || "Error");
    }
  };

  const downloadRecord = async (id: number, filename: string) => {
    const res = await fetch(`http://localhost:5000/records/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      alert("Access not approved yet");
      return;
    }

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 p-10">
      <div className="max-w-6xl mx-auto">

        <div className="flex items-center space-x-3 mb-8">
          <Shield className="text-blue-400" size={32} />
          <h1 className="text-3xl font-bold text-white">Doctor Dashboard</h1>
        </div>

        {/* Request Access Card */}
        <div className="bg-gray-800/40 border border-gray-700 rounded-xl p-6 mb-8">
          <h2 className="text-xl text-white mb-4 flex items-center">
            <Activity className="mr-2 text-yellow-400" /> Request Record Access
          </h2>

          <div className="flex space-x-4">
            <input
              type="number"
              placeholder="Enter Record ID"
              value={recordId}
              onChange={(e) => setRecordId(e.target.value)}
              className="flex-1 px-4 py-2 rounded-lg bg-gray-700 text-white border border-gray-600 focus:outline-none"
            />
            <button
              onClick={requestAccess}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg"
            >
              Request
            </button>
          </div>

          {message && (
            <p className="text-green-400 mt-3 text-sm">{message}</p>
          )}
        </div>

        {/* Requests List */}
        <div>
          <h2 className="text-xl text-white mb-4 flex items-center">
            <FileText className="mr-2 text-blue-400" /> My Requests
          </h2>

          {requests.length === 0 ? (
            <p className="text-gray-400">No requests yet.</p>
          ) : (
            <div className="space-y-4">
              {requests.map((req) => (
                <div
                  key={req.id}
                  className="bg-gray-800/40 border border-gray-700 rounded-xl p-6"
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-white font-medium">
                        {req.record?.filename}
                      </p>
                      <p className="text-gray-400 text-sm">
                        Status: {req.status}
                      </p>
                    </div>

                    {req.allowed && (
                      <button
                        onClick={() =>
                          downloadRecord(req.record.id, req.record.filename)
                        }
                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center"
                      >
                        <Download size={16} className="mr-2" />
                        Download
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}