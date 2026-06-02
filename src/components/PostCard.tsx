"use client";

import { useState } from "react";
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/SubmitButton";
import { editPostAction, regeneratePostAction } from "@/lib/post-actions";
import type { ComplianceResult } from "@/lib/compliance";

interface PostCardProps {
  postId: string;
  content: string;
  dateLabel: string;
  soWhat: string | null;
  compliance: ComplianceResult;
}

// Couleur du badge selon le score de conformité (Tailwind, pas d'inline style).
function badgeClasses(score: number): string {
  if (score >= 80) return "bg-green-600 text-white";
  if (score >= 50) return "bg-orange-500 text-white";
  return "bg-red-600 text-white";
}

export function PostCard({
  postId,
  content,
  dateLabel,
  soWhat,
  compliance,
}: PostCardProps) {
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">(
    "idle",
  );
  const [mode, setMode] = useState<"none" | "edit" | "regen">("none");

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(content);
      setCopyStatus("copied");
      setTimeout(() => setCopyStatus("idle"), 2000);
    } catch {
      setCopyStatus("error");
      setTimeout(() => setCopyStatus("idle"), 2000);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-muted-foreground">{dateLabel}</CardTitle>
        <CardAction>
          <Badge className={badgeClasses(compliance.score)}>
            Conformité {compliance.score}%
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="leading-relaxed whitespace-pre-wrap">{content}</p>
        {soWhat ? (
          <p className="text-sm text-muted-foreground italic">
            So what : {soWhat}
          </p>
        ) : null}
        {compliance.violations.length > 0 ? (
          <ul className="list-inside list-disc text-xs text-red-600">
            {compliance.violations.map((violation) => (
              <li key={violation}>{violation}</li>
            ))}
          </ul>
        ) : null}
        {compliance.infos.length > 0 ? (
          <ul className="list-inside list-disc text-xs text-muted-foreground">
            {compliance.infos.map((info) => (
              <li key={info}>{info}</li>
            ))}
          </ul>
        ) : null}
      </CardContent>
      <CardFooter className="flex-col items-stretch gap-3">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={handleCopy}>
            {copyStatus === "copied"
              ? "Copié ✓"
              : copyStatus === "error"
                ? "Échec copie"
                : "Copier"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMode(mode === "edit" ? "none" : "edit")}
          >
            Éditer
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMode(mode === "regen" ? "none" : "regen")}
          >
            Régénérer
          </Button>
        </div>

        {mode === "edit" ? (
          <form action={editPostAction} className="flex flex-col gap-2">
            <input type="hidden" name="post_id" value={postId} />
            <Textarea
              name="content"
              defaultValue={content}
              rows={10}
              required
              className="text-sm"
            />
            <SubmitButton pendingLabel="Enregistrement…">
              Enregistrer
            </SubmitButton>
          </form>
        ) : null}

        {mode === "regen" ? (
          <form action={regeneratePostAction} className="flex flex-col gap-2">
            <input type="hidden" name="post_id" value={postId} />
            <Input
              name="note"
              placeholder="Note optionnelle (ex : plus court, plus d'humour)"
              className="text-sm"
            />
            <SubmitButton pendingLabel="Régénération… (~30s)">
              Régénérer ce post
            </SubmitButton>
          </form>
        ) : null}
      </CardFooter>
    </Card>
  );
}
