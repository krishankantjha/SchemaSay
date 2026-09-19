import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/features/auth/AuthContext";
import { SchemaSayLogo } from "@/components/brand/SchemaSayLogo";
import { AuthCard } from "@/features/auth/AuthCard";
import { AuthLayout } from "@/features/auth/AuthLayout";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";

type OAuthPayload = {
  accessToken?: string;
  refreshToken?: string;
  error?: string;
};

function parseOAuthHash(): OAuthPayload {
  const raw = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;
  const params = new URLSearchParams(raw);
  return {
    accessToken: params.get("access_token") ?? undefined,
    refreshToken: params.get("refresh_token") ?? undefined,
    error: params.get("error") ?? undefined,
  };
}

/**
 * OAuth tokens arrive in the URL hash, which we clear immediately after reading.
 * Module-level cache + start guard survive React Strict Mode's double effect invocation.
 */
let cachedOAuthPayload: OAuthPayload | null = null;
let oauthCallbackStarted = false;

function consumeOAuthPayload(): OAuthPayload {
  if (!cachedOAuthPayload) {
    cachedOAuthPayload = parseOAuthHash();
    window.history.replaceState({}, document.title, window.location.pathname);
  }
  return cachedOAuthPayload;
}

function mapOAuthError(error: string): string {
  const lower = error.toLowerCase();
  if (lower.includes("access_denied") || lower.includes("cancelled") || lower.includes("canceled")) {
    return "Google sign-in was cancelled. You can try again or use email.";
  }
  if (lower.includes("state") || lower.includes("expired") || lower.includes("invalid")) {
    return "This sign-in link expired. Start again from the login page.";
  }
  if (lower.includes("rate")) {
    return "Too many sign-in attempts. Wait a moment and try again.";
  }
  return error;
}

export function OAuthCallbackPage() {
  const { completeOAuthLogin } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(true);

  useEffect(() => {
    if (oauthCallbackStarted) {
      return;
    }
    oauthCallbackStarted = true;

    const { accessToken, refreshToken, error: oauthError } = consumeOAuthPayload();

    if (oauthError) {
      oauthCallbackStarted = false;
      setError(mapOAuthError(oauthError));
      setIsProcessing(false);
      return;
    }

    if (!accessToken || !refreshToken) {
      oauthCallbackStarted = false;
      setError("Google sign-in did not return a valid session. Try again from the login page.");
      setIsProcessing(false);
      return;
    }

    void completeOAuthLogin(accessToken, refreshToken)
      .then(() => navigate("/connections?welcome=1", { replace: true }))
      .catch(() => {
        oauthCallbackStarted = false;
        setError("Could not complete Google sign-in. Please try again.");
        setIsProcessing(false);
      });
  }, [completeOAuthLogin, navigate]);

  return (
    <AuthLayout
      visual={{
        eyebrow: "Signing you in",
        headline: "Connecting your Google account.",
        subtext: "One moment while we set up your SchemaSay workspace.",
      }}
    >
      <AuthCard>
        {error && !isProcessing ? (
          <div className="space-y-[var(--space-4)] py-[var(--space-2)]">
            <h1 className="auth-card-title">Sign-in didn’t finish</h1>
            <Alert variant="danger">{error}</Alert>
            <div className="flex flex-wrap gap-2">
              <Link to="/login" className="no-underline">
                <Button>Back to sign in</Button>
              </Link>
              <Link to="/register" className="no-underline">
                <Button variant="secondary">Create an account</Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center py-[var(--space-8)] text-center" role="status" aria-live="polite">
            <SchemaSayLogo size="sm" className="mb-[var(--space-4)]" />
            <Loader2 className="h-8 w-8 motion-safe:animate-spin text-accent" aria-hidden />
            <h1 className="auth-card-title mt-[var(--space-4)]">Completing Google sign-in</h1>
            <p className="auth-card-desc">Validating your session and loading the workspace…</p>
          </div>
        )}
      </AuthCard>
    </AuthLayout>
  );
}
