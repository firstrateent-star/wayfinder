import { Compass, LogOut, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";

export function HelmPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_50%_-12%,rgba(110,231,183,0.09),transparent_34%),radial-gradient(circle_at_82%_70%,rgba(148,163,184,0.035),transparent_28%)]" />

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
          <div className="w-full max-w-2xl text-center">
            <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-[28px] border border-emerald-300/15 bg-emerald-300/[0.06] shadow-[0_0_60px_rgba(110,231,183,0.06)]">
              <Compass className="h-9 w-9 text-emerald-300/90" />
            </div>

            <p className="mb-3 text-xs font-medium uppercase tracking-[0.22em] text-emerald-300/60">Where am I?</p>
            <h2 className="text-3xl font-semibold tracking-tight text-slate-100 sm:text-5xl">
              Still learning the shape of your world.
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-slate-400">
              Wayfinder has a working foundation, but it does not need to fill the screen before it has something genuinely useful to say.
            </p>

            <div className="mx-auto mt-10 max-w-lg rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5 text-left">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-200">
                <Sparkles className="h-4 w-4 text-emerald-300/80" />
                For now
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                No forms. No setup checklist. No pressure to feed the system. We are building the layer that decides what is actually worth surfacing to you.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
