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
import {
  editPostAction,
  regeneratePostAction,
  updatePostStateAction,
} from "@/lib/post-actions";
import type { ComplianceResult } from "@/lib/compliance";
import type { PostStatus, PostVerdict } from "@/lib/types";

interface PostCardProps {
  postId: string;
  content: string;
  dateLabel: string;
  soWhat: string | null;
  compliance: ComplianceResult;
  status: PostStatus;
  verdict: PostVerdict | null;
}

// Couleur du badge conformité selon le score (Tailwind, pas d'inline style).
function complianceClasses(score: number): string {
  if (score >= 80) return "bg-green-600 text-white";
  if (score >= 50) return "bg-orange-500 text-white";
  return "bg-red-600 text-white";
}

function statusLabel(status: PostStatus, verdict: PostVerdict | null): string {
  if (status === "published") {
    return verdict === "edited" ? "Publié (édité)" : "Publié tel quel";
  }
  return "À publier";
}

// Bouton d'action de statut (form + server action).
function StateButton({
  postId,
  state,
  children,
}: {
  postId: string;
  state: string;
  children: React.ReactNode;
}) {
  return (
    <form action={updatePostStateAction}>
      <input type="hidden" name="post_id" value={postId} />
      <input type="hidden" name="state" value={state} />
      <Button type="submit" variant="outline" size="sm">
        {children}
      </Button>
    </form>
  );
}

export function PostCard({
  postId,
  content,
  dateLabel,
  soWhat,
  compliance,
  status,
  verdict,
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

  const settled = status === "published";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-muted-foreground">{dateLabel}</CardTitle>
        <CardAction>
          <Badge className={complianceClasses(compliance.score)}>
            Conformité {compliance.score}%
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-3">
        <Badge
          variant="secondary"
          className={
            status === "published" ? "bg-green-600 text-white" : undefined
          }
        >
          {statusLabel(status, verdict)}
        </Badge>
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

        <div className="flex flex-wrap gap-2">
          {settled ? (
            <StateButton postId={postId} state="reset">
              Remettre à publier
            </StateButton>
          ) : (
            <>
              <StateButton postId={postId} state="as_is">
                Publié tel quel
              </StateButton>
              <StateButton postId={postId} state="edited">
                Publié (édité)
              </StateButton>
            </>
          )}
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
