import { FormEvent, useMemo, useState } from "react";
import { Compass, KeyRound, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/features/auth/AuthProvider";
import { supabase } from "@/lib/supabase";

function friendlyAuthError(message: string | null) {
  if (!message) return null;

  const normalized = message.toLowerCase();

  if (normalized.includes("rate limit")) {
    return "Too many sign-in emails were requested. You can use password sign-in instead, or wait before requesting another email.";
  }

  if (normalized.includes("invalid login credentials")) {
    return "That email and password did not match.";
  }

  if (
    normalized.includes("expired") ||
    normalized.includes("invalid") ||
    normalized.includes("otp") ||
    normalized.includes("token")
  ) {
    return "That sign-in link is no longer valid. Magic links are one-time use, so request a fresh link and open only the newest email.";
  }

  return message;
}

type Status = "idle" | "signing" | "sending" | "sent";

export function LoginPage() {
  const { error: callbackError } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  const visibleError = useMemo(
    () => friendlyAuthError(error ?? callbackError),
    [error, callbackError]
  );

  async function signInWithPassword(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setStatus("signing");

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (authError) {
      setError(authError.message);
      setStatus("idle");
      return;
    }

    setStatus("idle");
  }

  async function sendMagicLink() {
    setError(null);
    setStatus("sending");

    const { error: authError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/helm`
      }
    });

    if (authError) {
      setError(authError.message);
      setStatus("idle");
      return;
    }

    setStatus("sent");
  }

  const busy = status === "signing" || status === "sending";

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-background p-6 text-foreground">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_25%_15%,rgba(110,231,183,0.10),transparent_34%),radial-gradient(circle_at_80%_70%,rgba(148,163,184,0.08),transparent_35%)]" />
      <Card className="relative w-full max-w-md border-white/10 bg-slate-950/65">
        <CardHeader className="gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-300/20 bg-emerald-300/10">
            <Compass className="h-5 w-5 text-emerald-300" />
          </div>
          <div>
            <CardTitle className="text-2xl">Wayfinder</CardTitle>
            <CardDescription className="mt-2">
              A calm instrument for recorded reality, direction, evidence, and movement.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {visibleError ? (
            <div className="mb-4 rounded-xl border border-rose-300/15 bg-rose-300/5 p-4 text-sm leading-6 text-rose-200">
              {visibleError}
            </div>
          ) : null}

          {status === "sent" ? (
            <div className="rounded-xl border border-emerald-300/15 bg-emerald-300/5 p-4 text-sm text-slate-300">
              Check <span className="font-medium text-slate-100">{email}</span> for your sign-in link. Use only the newest email; each link works once.
            </div>
          ) : (
            <form onSubmit={signInWithPassword} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium text-slate-300">
                  Email
                </label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="you@example.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium text-slate-300">
                  Password
                </label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="Password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>

              <Button type="submit" className="w-full" disabled={busy || !email || !password}>
                <KeyRound className="mr-2 h-4 w-4" />
                {status === "signing" ? "Signing in…" : "Sign in with password"}
              </Button>

              <div className="flex items-center gap-3 py-1 text-xs text-slate-600">
                <div className="h-px flex-1 bg-white/10" />
                or
                <div className="h-px flex-1 bg-white/10" />
              </div>

              <Button
                type="button"
                variant="secondary"
                className="w-full"
                disabled={busy || !email}
                onClick={() => void sendMagicLink()}
              >
                <Mail className="mr-2 h-4 w-4" />
                {status === "sending" ? "Sending…" : "Email me a sign-in link"}
              </Button>
            </form>
          )}

          <p className="mt-5 text-xs leading-5 text-slate-500">
            Signing in establishes your private Wayfinder owner scope. The web app only uses approved RPCs; it does not write canonical tables directly.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
