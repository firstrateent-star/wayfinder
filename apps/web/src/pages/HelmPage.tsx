import { Compass, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";

export function HelmPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_50%_-10%,rgba(110,231,183,0.08),transparent_34%),radial-gradient(circle_at_85%_65%,rgba(148,163,184,0.04),transparent_30%)]" />

      <div className="relative mx-auto flex min-h-screen max-w-5xl flex-col px-5 py-6 sm:px-8 sm:py-8">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-300/20 bg-emerald-300/10">
              <Compass className="h-5 w-5 text-emerald-300" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-slate-500">Wayfinder</p>
              <h1 className="text-xl font-semibold tracking-tight text-slate-100">Helm</h1>
            </div>
          </div>

          <Button variant="ghost" onClick={() => void supabase.auth.signOut()}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </Button>
        </header>

        <section className="flex flex-1 items-center justify-center py-16">
          <div className="max-w-xl text-center">
            <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-[28px] border border-emerald-300/15 bg-emerald-300/[0.06]">
              <Compass className="h-9 w-9 text-emerald-300/90" />
            </div>

            <h2 className="text-3xl font-semibold tracking-tight text-slate-100 sm:text-4xl">
              Wayfinder is listening before it speaks.
            </h2>
            <p className="mx-auto mt-5 max-w-lg text-base leading-7 text-slate-400">
              The foundation is running underneath. For now, the player interface stays quiet while we decide what is actually worth showing and asking.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
