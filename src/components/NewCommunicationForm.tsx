"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Template } from "@/lib/types";

function isErrorBody(data: unknown): data is { error: string } {
  return (
    typeof data === "object" &&
    data !== null &&
    "error" in data &&
    typeof (data as { error: unknown }).error === "string"
  );
}

function isIdBody(data: unknown): data is { id: string } {
  return (
    typeof data === "object" &&
    data !== null &&
    "id" in data &&
    typeof (data as { id: unknown }).id === "string"
  );
}

interface NewCommunicationFormProps {
  networks: string[];
  templates: Template[];
}

export function NewCommunicationForm({
  networks,
  templates,
}: NewCommunicationFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(event.currentTarget);
    const payload = {
      name: String(formData.get("name") ?? "").trim(),
      event_date: String(formData.get("event_date") ?? ""),
      event_location: String(formData.get("event_location") ?? "").trim(),
      event_link: String(formData.get("event_link") ?? "").trim(),
      intervenants_text: String(formData.get("intervenants_text") ?? "").trim(),
      networks: formData.getAll("networks").map((v) => String(v)),
      template_id: String(formData.get("template_id") ?? templates[0]?.id ?? ""),
    };

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data: unknown = await response.json();

      if (!response.ok) {
        throw new Error(
          isErrorBody(data) ? data.error : "Échec de la génération.",
        );
      }
      if (!isIdBody(data)) {
        throw new Error("Réponse serveur inattendue.");
      }
      router.push(`/communications/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue.");
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl p-8">
      <Link href="/" className="text-sm text-muted-foreground hover:underline">
        ← Accueil
      </Link>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Nouvelle communication</CardTitle>
          <CardDescription>
            Faits durs (jamais inventés par l&apos;IA) et matière libre. Génère
            les posts en chaîne selon le rétroplanning.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <fieldset className="flex flex-col gap-4" disabled={loading}>
              <div className="flex flex-col gap-2">
                <Label htmlFor="template_id">Template</Label>
                <select
                  id="template_id"
                  name="template_id"
                  defaultValue={templates[0]?.id ?? ""}
                  className="h-9 rounded-md border bg-transparent px-3 text-sm"
                >
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium">Plateformes cibles</span>
                <div className="flex flex-wrap gap-4">
                  {networks.map((network) => (
                    <label
                      key={network}
                      className="flex items-center gap-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        name="networks"
                        value={network}
                        defaultChecked
                        className="size-4"
                      />
                      {network}
                    </label>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Un set de posts est généré par plateforme cochée.
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="name">Nom de l&apos;événement *</Label>
                <Input
                  id="name"
                  name="name"
                  required
                  placeholder="Talk 4 — Design systems"
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="event_date">Date de l&apos;événement *</Label>
                <Input id="event_date" name="event_date" type="date" required />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="event_location">Lieu</Label>
                <Input
                  id="event_location"
                  name="event_location"
                  placeholder="La Commune, Lyon"
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="event_link">Lien d&apos;inscription</Label>
                <Input
                  id="event_link"
                  name="event_link"
                  type="url"
                  placeholder="https://..."
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="intervenants_text">
                  Intervenants (matière libre)
                </Label>
                <Textarea
                  id="intervenants_text"
                  name="intervenants_text"
                  rows={5}
                  placeholder="Un intervenant par ligne, avec ce que tu sais déjà (sujet, parcours...)"
                />
              </div>
            </fieldset>

            {error ? (
              <p className="text-sm text-red-600" role="alert">
                {error}
              </p>
            ) : null}

            <Button type="submit" disabled={loading}>
              {loading ? "Génération en cours…" : "Générer les posts"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
