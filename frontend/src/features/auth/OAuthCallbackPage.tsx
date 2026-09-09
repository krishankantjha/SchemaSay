import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/features/auth/AuthContext";
import { AuthCard } from "@/features/auth/AuthCard";
import { AuthLayout } from "@/features/auth/AuthLayout";
import { Button } from "@/components/ui/Button";

function parseOAuthHash(): { accessToken?: string; refreshToken?: string; error?: string } {
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

export function OAuthCallbackPage() {
  const { completeOAuthLogin } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const { accessToken, refreshToken, error: oauthError } = parseOAuthHash();

    // Clear tokens from the URL immediately
    window.history.replaceState({}, document.title, window.location.pathname);

    if (oauthError) {
      setError(oauthError);
      return;
    }

    if (!accessToken || !refreshToken) {
      setError("Google sign-in did not return a valid session.");
      return;
    }

    void completeOAuthLogin(accessToken, refreshToken)
      .then(() => navigate("/connections?welcome=1", { replace: true }))
      .catch(() => setError("Could not complete Google sign-in. Please try again."));
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
        {error ? (
          <div className="py-4 text-center">
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
            <Link to="/login" className="mt-4 inline-block">
              <Button variant="secondary">Back to sign in</Button>
            </Link>
          </div>
        ) : (
          <div className="flex flex-col items-center py-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-accent" aria-hidden />
            <p className="mt-4 text-sm text-text-secondary">Completing Google sign-in…</p>
          </div>
        )}
      </AuthCard>
    </AuthLayout>
  );
}
