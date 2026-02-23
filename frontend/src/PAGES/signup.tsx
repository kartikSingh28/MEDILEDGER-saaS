import { useState } from "react";
import { useNavigate } from "react-router-dom";

export function Signup() {
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("PATIENT");
  const [error, setError] = useState("");

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const res = await fetch("http://localhost:5000/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name,
          email,
          password,
          role
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Signup failed");
      }
      navigate("/login");

    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="h-screen flex items-center justify-center bg-gray-900">
      <form
        onSubmit={handleSignup}
        className="bg-gray-800 p-8 rounded-xl w-96 space-y-4"
      >
        <h2 className="text-white text-2xl font-bold text-center">
          Signup
        </h2>

        {error && (
          <p className="text-red-500 text-sm text-center">{error}</p>
        )}

        <input
          type="text"
          placeholder="Name"
          className="w-full p-2 rounded bg-gray-700 text-white"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

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

        <select
          className="w-full p-2 rounded bg-gray-700 text-white"
          value={role}
          onChange={(e) => setRole(e.target.value)}
        >
          <option value="PATIENT">Patient</option>
          <option value="DOCTOR">Doctor</option>
        </select>

        <button
          type="submit"
          className="w-full bg-green-600 py-2 rounded text-white hover:bg-green-700"
        >
          Create Account
        </button>
      </form>
    </div>
  );
}