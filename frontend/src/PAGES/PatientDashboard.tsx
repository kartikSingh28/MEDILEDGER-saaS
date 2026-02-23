export function PatientDashboard() {
  const name = localStorage.getItem("role");

  return (
    <div className="min-h-screen bg-gray-900 text-white p-10">
      <h1 className="text-3xl font-bold mb-8">
        Patient Dashboard
      </h1>

      <div className="space-y-4">
        <button className="bg-blue-600 px-6 py-3 rounded-lg hover:bg-blue-700">
          Upload Medical Record
        </button>

        <button className="bg-green-600 px-6 py-3 rounded-lg hover:bg-green-700">
          View My Records
        </button>
      </div>
    </div>
  );
}