/**
 * Fallback de navigation (Suspense) pour toutes les routes du groupe (app).
 * Affiché instantanément au clic pendant le rendu serveur de la page cible →
 * la navigation ne « gèle » plus l'ancienne page.
 */
export default function Loading() {
  return (
    <main className="mx-auto max-w-3xl p-8" aria-busy="true">
      <div className="animate-pulse space-y-4">
        <div className="h-8 w-1/2 rounded-md bg-muted" />
        <div className="h-4 w-1/3 rounded bg-muted" />
        <div className="mt-6 space-y-3">
          <div className="h-24 rounded-lg bg-muted" />
          <div className="h-24 rounded-lg bg-muted" />
          <div className="h-24 rounded-lg bg-muted" />
        </div>
      </div>
    </main>
  );
}
