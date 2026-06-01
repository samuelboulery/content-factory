import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-start justify-center gap-6 p-8">
      <h1 className="text-3xl font-semibold tracking-tight">
        Content Factory — TDS workspace
      </h1>
      <p className="text-muted-foreground">
        Atelier de création éditoriale assisté par IA pour The Design Society.
      </p>
      <Button asChild>
        <Link href="/communications/new">Nouvelle communication</Link>
      </Button>
    </main>
  );
}
