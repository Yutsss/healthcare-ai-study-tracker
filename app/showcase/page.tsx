import { PublicShell } from '@/components/public/public-shell';
import { ShowcaseView } from '@/components/showcase/showcase-view';
import { getPublicShowcase } from '@/lib/showcase';
import { isSupabaseConfigured } from '@/lib/supabase/env';

export const dynamic = 'force-dynamic';

function PublicShowcaseState({ title, description }: { title: string; description: string }) {
  return (
    <section aria-labelledby="showcase-state-title" className="mx-auto max-w-xl rounded-2xl border bg-card p-8 text-center shadow-sm">
      <h1 id="showcase-state-title" className="text-2xl font-bold tracking-tight">{title}</h1>
      <p className="mt-3 text-muted-foreground">{description}</p>
    </section>
  );
}

export default async function ShowcasePage() {
  if (!isSupabaseConfigured()) {
    return (
      <PublicShell mode="showcase">
        <PublicShowcaseState title="Showcase unavailable" description="This public showcase is not available yet." />
      </PublicShell>
    );
  }

  try {
    const showcase = await getPublicShowcase();
    if (!showcase) {
      return (
        <PublicShell mode="showcase">
          <PublicShowcaseState title="No showcase published" description="No public showcase has been published yet." />
        </PublicShell>
      );
    }

    return <PublicShell mode="showcase"><ShowcaseView showcase={showcase} /></PublicShell>;
  } catch {
    return (
      <PublicShell mode="showcase">
        <PublicShowcaseState title="Showcase temporarily unavailable" description="Please try again later." />
      </PublicShell>
    );
  }
}
