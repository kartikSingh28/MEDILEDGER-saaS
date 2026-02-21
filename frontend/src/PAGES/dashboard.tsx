import { useNavigate } from "react-router-dom";

export function Dashboard() {
  const navigate = useNavigate();

  return (
    <div className="h-screen flex flex-col items-center justify-center gap-6 bg-gray-900">
      <button
        onClick={() => navigate("/login")}
        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
      >
        Login
      </button>

      <button
        onClick={() => navigate("/signup")}
        className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
      >
        Signup
      </button>
    </div>
  );
}