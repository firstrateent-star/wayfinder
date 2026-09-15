import { FormEvent, useState } from "react";
import { Compass, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
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
          {status === "sent" ? (
            <div className="rounded-xl border border-emerald-300/15 bg-emerald-300/5 p-4 text-sm text-slate-300">
              Check <span className="font-medium text-slate-100">{email}</span> for your sign-in link.
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
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
              {error ? <p className="text-sm text-rose-300">{error}</p> : null}
              <Button type="submit" className="w-full" disabled={status === "sending"}>
                <Mail className="mr-2 h-4 w-4" />
                {status === "sending" ? "Sending…" : "Send sign-in link"}
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
