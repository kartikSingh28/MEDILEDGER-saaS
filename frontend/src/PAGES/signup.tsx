import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthLayout } from "../components/AuthLayout";
import { Button, Field, Input, Notice, Select } from "../components/ui";
import { apiJson, errorMessage } from "../lib/api";

interface Hospital {
  id: number;
  name: string;
}

const roles = [
  { value: "PATIENT", label: "Patient", hint: "Upload records and decide who sees them" },
  { value: "DOCTOR", label: "Doctor", hint: "Request access to patients' records" },
] as const;

export function Signup() {
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"PATIENT" | "DOCTOR">("PATIENT");
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [hospitalId, setHospitalId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Each hospital is its own blockchain organization; it issues the user's identity
  useEffect(() => {
    apiJson<{ hospitals: Hospital[] }>("/hospitals", { auth: false })
      .then((data) => setHospitals(data.hospitals))
      .catch((err) => setError(errorMessage(err)));
  }, []);

  const handleSignup = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await apiJson("/auth/signup", {
        method: "POST",
        body: JSON.stringify({ name, email, password, role, hospitalId: Number(hospitalId) }),
        auth: false,
      });
      navigate("/login?registered=1");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Create an account"
      subtitle="Your hospital issues your blockchain identity when you sign up."
      footer={
        <>
          Already registered?{" "}
          <Link to="/login" className="text-accent hover:text-accent-hover">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSignup} className="space-y-4">
        {error && <Notice tone="error">{error}</Notice>}

        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-fg">I am a</legend>
          <div className="grid grid-cols-2 gap-2">
            {roles.map((r) => (
              <label
                key={r.value}
                className={`cursor-pointer rounded-md border p-3 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent/70 ${
                  role === r.value ? "border-accent bg-accent/10" : "border-line-strong hover:border-faint"
                }`}
              >
                <input
                  type="radio"
                  name="role"
                  value={r.value}
                  checked={role === r.value}
                  onChange={() => setRole(r.value)}
                  className="sr-only"
                />
                <span className="block text-sm font-medium text-fg">{r.label}</span>
                <span className="mt-0.5 block text-xs leading-snug text-muted">{r.hint}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <Field id="hospital" label="Hospital">
          <Select id="hospital" value={hospitalId} onChange={(e) => setHospitalId(e.target.value)} required>
            <option value="" disabled>
              Select your hospital
            </option>
            {hospitals.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field id="name" label="Full name">
          <Input id="name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
        </Field>

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

        <Field id="password" label="Password" hint="At least 6 characters">
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
        </Field>

        <Button type="submit" variant="primary" disabled={loading} className="w-full">
          {loading ? "Creating account…" : "Create account"}
        </Button>
      </form>
    </AuthLayout>
  );
}
