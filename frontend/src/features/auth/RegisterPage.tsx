import { useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, CheckCircle2, Lock, Mail, User } from "lucide-react";
import { ApiError } from "@/lib/api/client";
import {
  isValidEmail,
  mapRegisterError,
  PASSWORD_REGEX,
} from "@/lib/password-validation";
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
import { PasswordStrength } from "@/components/ui/PasswordStrength";

type FieldKey = "fullName" | "email" | "password" | "confirmPassword" | "terms";

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [touched, setTouched] = useState<Partial<Record<FieldKey, boolean>>>({});
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const passwordValid = PASSWORD_REGEX.test(password);
  const emailValid = isValidEmail(email);

  const fieldErrors = useMemo(() => {
    const errors: Partial<Record<FieldKey, string>> = {};
    if (touched.email && email && !emailValid) {
      errors.email = "Enter a valid email address";
    }
    if (touched.password && password && !passwordValid) {
      errors.password = "Password does not meet all requirements";
    }
    if (touched.confirmPassword && confirmPassword && confirmPassword !== password) {
      errors.confirmPassword = "Passwords don't match";
    }
    if (touched.terms && !acceptedTerms) {
      errors.terms = "You must accept the terms to continue";
    }
    return errors;
  }, [touched, email, emailValid, password, passwordValid, confirmPassword, acceptedTerms]);

  function touch(field: FieldKey) {
    setTouched((prev) => ({ ...prev, [field]: true }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError("");
    setTouched({
      fullName: true,
      email: true,
      password: true,
      confirmPassword: true,
      terms: true,
    });

    if (!emailValid) {
      setFormError("Enter a valid email address");
      return;
    }
    if (!passwordValid) {
      setFormError("Password does not meet all requirements");
      return;
    }
    if (confirmPassword !== password) {
      setFormError("Passwords don't match");
      return;
    }
    if (!acceptedTerms) {
      setFormError("Please accept the Terms and Privacy Policy");
      return;
    }

    setLoading(true);
    try {
      await register(email, password, fullName || undefined);
      setSuccess(true);
      setTimeout(() => navigate("/connections?welcome=1", { replace: true }), 900);
    } catch (err) {
      const detail = err instanceof ApiError ? err.detail : "Registration failed";
      setFormError(mapRegisterError(typeof detail === "string" ? detail : "Registration failed"));
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <AuthLayout
        visual={{
          eyebrow: "Get started",
          headline: "Your database, ready to answer.",
          subtext:
            "Connect your database, understand your schema, and start asking questions in plain English.",
        }}
      >
        <AuthCard>
          <div className="flex flex-col items-center py-[var(--space-6)] text-center animate-fade-up">
            <CheckCircle2 className="h-12 w-12 text-success" strokeWidth={1.75} aria-hidden />
            <h1 className="auth-card-title mt-[var(--space-4)]">Account created</h1>
            <p className="auth-card-desc">Redirecting to your workspace…</p>
          </div>
        </AuthCard>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      visual={{
        eyebrow: "Get started",
        headline: "Your database, ready to answer.",
        subtext:
          "Connect your database, understand your schema, and start asking questions in plain English.",
      }}
    >
      <AuthCard>
        <div className="animate-fade-up">
          <h1 className="auth-card-title">Create your workspace</h1>
          <p className="auth-card-desc">Free to start — no credit card required.</p>

          <form
            onSubmit={(e) => void handleSubmit(e)}
            className="mt-[var(--space-6)] space-y-[var(--space-4)]"
            aria-busy={loading || undefined}
            noValidate
          >
            <div>
              <Label htmlFor="fullName">Full name</Label>
              <IconInput
                id="fullName"
                autoComplete="name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                onBlur={() => touch("fullName")}
                placeholder="Your name"
                icon={<User className="h-4 w-4" />}
                autoFocus
              />
            </div>

            <div>
              <Label htmlFor="email">Email</Label>
              <IconInput
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() => touch("email")}
                placeholder="you@company.com"
                icon={<Mail className="h-4 w-4" />}
                error={fieldErrors.email}
                success={touched.email && emailValid}
                required
              />
            </div>

            <div>
              <Label htmlFor="password">Password</Label>
              <PasswordInput
                id="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => {
                  touch("password");
                  setPasswordFocused(false);
                }}
                icon={<Lock className="h-4 w-4" />}
                error={fieldErrors.password}
                success={touched.password && passwordValid}
                required
              />
              <PasswordStrength password={password} focused={passwordFocused} />
            </div>

            <div>
              <Label htmlFor="confirmPassword">Confirm password</Label>
              <PasswordInput
                id="confirmPassword"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onBlur={() => touch("confirmPassword")}
                icon={<Lock className="h-4 w-4" />}
                error={fieldErrors.confirmPassword}
                success={
                  touched.confirmPassword &&
                  confirmPassword.length > 0 &&
                  confirmPassword === password
                }
                required
              />
            </div>

            <div>
              <label className="flex cursor-pointer items-start gap-2.5 text-sm text-text-secondary">
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  onBlur={() => touch("terms")}
                  id="terms"
                  aria-describedby={fieldErrors.terms ? "terms-error" : undefined}
                  className="mt-0.5 h-4 w-4 rounded border-border-default accent-accent"
                />
                <span>
                  I agree to the Terms of Service and Privacy Policy
                </span>
              </label>
              {fieldErrors.terms ? (
                <p id="terms-error" className="mt-1.5 text-xs text-danger" role="alert">
                  {fieldErrors.terms}
                </p>
              ) : null}
            </div>

            {formError ? (
              <Alert variant="danger">{formError}</Alert>
            ) : null}

            <Button type="submit" size="lg" className="w-full" disabled={loading} loading={loading}>
              {loading ? "Creating account…" : (
                <>
                  Create your account <ArrowRight className="h-4 w-4" aria-hidden />
                </>
              )}
            </Button>
          </form>

          <OrDivider />
          <GoogleButton label="Sign up with Google" disabled={loading} />

          <p className="mt-[var(--space-5)] text-center text-sm text-text-secondary">
            Already have an account?{" "}
            <Link to="/login" className="font-medium text-accent hover:text-accent-hover">
              Sign in
            </Link>
          </p>
        </div>
      </AuthCard>
    </AuthLayout>
  );
}
