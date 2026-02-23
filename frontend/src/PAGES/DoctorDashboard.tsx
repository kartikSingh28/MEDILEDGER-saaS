export function DoctorDashboard() {
  return (
    <div className="min-h-screen bg-gray-900 text-white p-10">
      <h1 className="text-3xl font-bold mb-8">
        Doctor Dashboard
      </h1>

      <div className="space-y-4">
        <button className="bg-purple-600 px-6 py-3 rounded-lg hover:bg-purple-700">
          View Shared Records
        </button>

        <button className="bg-yellow-600 px-6 py-3 rounded-lg hover:bg-yellow-700">
          Request Access
        </button>
      </div>
    </div>
  );
}