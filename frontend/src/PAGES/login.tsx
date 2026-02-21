import { useState } from "react";
import { useNavigate } from "react-router-dom";

export function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const res = await fetch("http://localhost:5000/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Login failed");
      }

      // Save token
      localStorage.setItem("token", data.token);

      // Redirect
      navigate("/dashboard");

    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="h-screen flex items-center justify-center bg-gray-900">
      <form
        onSubmit={handleLogin}
        className="bg-gray-800 p-8 rounded-xl w-96 space-y-4"
      >
        <h2 className="text-white text-2xl font-bold text-center">
          Login
        </h2>

        {error && (
          <p className="text-red-500 text-sm text-center">{error}</p>
        )}

        <input
          type="email"
          placeholder="Email"
          className="w-full p-2 rounded bg-gray-700 text-white"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          type="password"
          placeholder="Password"
          className="w-full p-2 rounded bg-gray-700 text-white"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button
          type="submit"
          className="w-full bg-blue-600 py-2 rounded text-white hover:bg-blue-700"
        >
          Login
        </button>
      </form>
    </div>
  );
}