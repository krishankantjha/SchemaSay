import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, Loader2, Lock, Mail } from "lucide-react";
import { ApiError } from "@/lib/api/client";
import { isValidEmail } from "@/lib/password-validation";
import { useAuth } from "@/features/auth/AuthContext";
import { AuthCard } from "@/features/auth/AuthCard";
import { AuthLayout } from "@/features/auth/AuthLayout";
import { GoogleButton } from "@/features/auth/GoogleButton";
import { OrDivider } from "@/features/auth/OrDivider";
import { Button } from "@/components/ui/Button";
import { IconInput } from "@/components/ui/IconInput";
import { Label } from "@/components/ui/Label";
import { PasswordInput } from "@/components/ui/PasswordInput";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/ask";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const emailError =
    emailTouched && email && !isValidEmail(email) ? "Enter a valid email address" : undefined;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setEmailTouched(true);

    if (!isValidEmail(email)) {
      setError("Enter a valid email address");
      return;
    }

    setLoading(true);
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Login failed. Check your credentials.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      visual={{
        eyebrow: "Welcome back",
        headline: "Ask your data anything.",
        subtext:
          "Plain English in, schema-aware SQL out — with explanations you can verify.",
      }}
    >
      <AuthCard>
        <div className="animate-fade-up">
          <h1 className="text-xl font-semibold text-text-primary sm:text-2xl">Sign in</h1>
          <p className="mt-1.5 text-sm leading-relaxed text-text-secondary">
            Continue to your SchemaSay workspace.
          </p>

          <form onSubmit={(e) => void handleSubmit(e)} className="mt-6 space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <IconInput
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() => setEmailTouched(true)}
                placeholder="you@company.com"
                icon={<Mail className="h-4 w-4" />}
                error={emailError}
                success={emailTouched && isValidEmail(email)}
                autoFocus
                required
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <PasswordInput
                id="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                icon={<Lock className="h-4 w-4" />}
                required
              />
            </div>

            {error ? (
              <p className="text-sm text-danger" role="alert">
                {error}
              </p>
            ) : null}

            <Button type="submit" size="lg" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Signing in…
                </>
              ) : (
                <>
                  Sign in <ArrowRight className="h-4 w-4" aria-hidden />
                </>
              )}
            </Button>
          </form>

          <OrDivider />
          <GoogleButton label="Continue with Google" />

          <p className="mt-5 text-center text-sm text-text-secondary">
            No account?{" "}
            <Link to="/register" className="font-medium text-accent hover:text-accent-hover">
              Create one
            </Link>
          </p>
        </div>
      </AuthCard>
    </AuthLayout>
  );
}
