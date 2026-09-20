import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, Lock, Mail } from "lucide-react";
import { ApiError } from "@/lib/api/client";
import { isValidEmail } from "@/lib/password-validation";
import { useAuth } from "@/features/auth/AuthContext";
import { AuthCard } from "@/features/auth/AuthCard";
import { AuthLayout } from "@/features/auth/AuthLayout";
import { GoogleButton } from "@/features/auth/GoogleButton";
import { OrDivider } from "@/features/auth/OrDivider";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { IconInput } from "@/components/ui/IconInput";
import { Label } from "@/components/ui/Label";
import { PasswordInput } from "@/components/ui/PasswordInput";

function mapLoginError(detail: string): string {
  const lower = detail.toLowerCase();
  if (lower.includes("invalid") || lower.includes("credential") || lower.includes("401")) {
    return "Email or password is incorrect. Check your credentials and try again.";
  }
  if (lower.includes("inactive") || lower.includes("disabled")) {
    return "This account is inactive. Contact support if you need help.";
  }
  if (lower.includes("too many") || lower.includes("rate")) {
    return "Too many attempts. Wait a moment and try again.";
  }
  return detail;
}

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/ask";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const emailError =
    emailTouched && email && !isValidEmail(email) ? "Enter a valid email address" : undefined;
  const passwordError =
    passwordTouched && password && password.length < 1 ? "Password is required" : undefined;

  const canSubmit = isValidEmail(email) && password.length > 0 && !loading;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setEmailTouched(true);
    setPasswordTouched(true);

    if (!isValidEmail(email)) {
      setError("Enter a valid email address");
      return;
    }
    if (!password) {
      setError("Enter your password");
      return;
    }

    setLoading(true);
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      const detail = err instanceof ApiError ? err.detail : "Login failed. Check your credentials.";
      setError(mapLoginError(typeof detail === "string" ? detail : "Login failed"));
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
          <h1 className="auth-card-title">Sign in</h1>
          <p className="auth-card-desc">Continue to your SchemaSay workspace.</p>

          <form
            onSubmit={(e) => void handleSubmit(e)}
            className="mt-[var(--space-6)] space-y-[var(--space-4)]"
            aria-busy={loading || undefined}
            noValidate
          >
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
              <div className="mb-1.5 flex items-center justify-between">
                <Label htmlFor="password" className="mb-0">
                  Password
                </Label>
              </div>
              <PasswordInput
                id="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onBlur={() => setPasswordTouched(true)}
                icon={<Lock className="h-4 w-4" />}
                error={passwordError}
                required
              />
            </div>

            {error ? (
              <Alert variant="danger">{error}</Alert>
            ) : null}

            <Button type="submit" size="lg" className="w-full" disabled={!canSubmit} loading={loading}>
              {loading ? (
                "Signing in…"
              ) : (
                <>
                  Sign in <ArrowRight className="h-4 w-4" aria-hidden />
                </>
              )}
            </Button>
          </form>

          <OrDivider />
          <GoogleButton label="Continue with Google" disabled={loading} />

          <p className="mt-[var(--space-5)] text-center text-sm text-text-secondary">
            No account?{" "}
            <Link to="/register" className="font-medium text-accent hover:text-accent-hover">
              Create one
            </Link>
          </p>
          <p className="mt-3 text-center text-xs text-text-muted">
            <Link to="/terms" className="hover:text-text-secondary">
              Terms
            </Link>
            {" · "}
            <Link to="/privacy" className="hover:text-text-secondary">
              Privacy
            </Link>
          </p>
        </div>
      </AuthCard>
    </AuthLayout>
  );
}
