import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AuthLayout } from "../components/AuthLayout";
import { Button, Field, Input, Notice } from "../components/ui";
import { apiJson, errorMessage } from "../lib/api";
import { homeFor, saveSession, type Role } from "../lib/session";

interface SigninResponse {
  token: string;
  user: { name: string; role: Role; hospital?: { name: string } };
}

export function Login() {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const data = await apiJson<SigninResponse>("/auth/signin", {
        method: "POST",
        body: JSON.stringify({ email, password }),
        auth: false,
      });

      // Admin accounts exist (created from the command line) but have no web dashboard
      if (data.user.role === "ADMIN") {
        throw new Error("Admin accounts don't have a web dashboard yet.");
      }

      saveSession({
        token: data.token,
        role: data.user.role,
        name: data.user.name,
        hospital: data.user.hospital?.name ?? "",
      });
      navigate(homeFor(data.user.role));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Sign in"
      subtitle="Access your records and consent requests."
      footer={
        <>
          No account?{" "}
          <Link to="/signup" className="text-accent hover:text-accent-hover">
            Create one
          </Link>
        </>
      }
    >
      <form onSubmit={handleLogin} className="space-y-4">
        {params.get("expired") && <Notice tone="info">Your session expired. Please sign in again.</Notice>}
        {params.get("registered") && <Notice tone="success">Account created. Sign in to continue.</Notice>}
        {error && <Notice tone="error">{error}</Notice>}

        <Field id="email" label="Email">
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </Field>

        <Field id="password" label="Password">
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </Field>

        <Button type="submit" variant="primary" disabled={loading} className="w-full">
          {loading ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </AuthLayout>
  );
}
