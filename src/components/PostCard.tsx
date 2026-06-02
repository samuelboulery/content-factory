"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
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
  rollbackPostAction,
  updatePostDateAction,
  updatePostStateAction,
} from "@/lib/post-actions";
import type { ComplianceResult } from "@/lib/compliance";
import type { PostReview, PostRevision, PostStatus } from "@/lib/types";

interface PostCardProps {
  postId: string;
  content: string;
  dateLabel: string;
  scheduledDate: string; // yyyy-MM-dd, pour l'édition de date
  soWhat: string | null;
  compliance: ComplianceResult;
  status: PostStatus;
  edited: boolean;
  diverged: boolean;
  previousVersions: PostRevision[];
  aiReview: PostReview | null;
  canWrite: boolean;
  network: string;
}

// Couleur du badge conformité selon le score (Tailwind, pas d'inline style).
function complianceClasses(score: number): string {
  if (score >= 80) return "bg-green-600 text-white";
  if (score >= 50) return "bg-orange-500 text-white";
  return "bg-red-600 text-white";
}

function statusLabel(status: PostStatus, edited: boolean): string {
  if (status === "published") {
    return edited ? "Publié (édité)" : "Publié tel quel";
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
  scheduledDate,
  soWhat,
  compliance,
  status,
  edited,
  diverged,
  previousVersions,
  aiReview,
  canWrite,
  network,
}: PostCardProps) {
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">(
    "idle",
  );
  const [mode, setMode] = useState<"none" | "edit" | "regen" | "date">("none");

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

  const published = status === "published";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-muted-foreground">
          {dateLabel} · {network}
        </CardTitle>
        <CardAction>
          <Badge className={complianceClasses(compliance.score)}>
            Conformité {compliance.score}%
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-3">
        {diverged ? (
          <p className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800">
            ⚠️ Un fait dur a été modifié depuis la publication de ce post —
            vérifie qu&apos;il est toujours exact.
          </p>
        ) : null}
        <Badge
          variant="secondary"
          className={published ? "bg-green-600 text-white" : undefined}
        >
          {statusLabel(status, edited)}
        </Badge>
        <p className="leading-relaxed whitespace-pre-wrap">{content}</p>
        {soWhat ? (
          <p className="text-sm text-muted-foreground italic">
            So what : {soWhat}
          </p>
        ) : null}
        {compliance.violations.length > 0 ? (
          <ul className="list-inside list-disc text-xs text-red-600">
            {compliance.violations.map((violation, idx) => (
              <li key={`${violation}-${idx}`}>{violation}</li>
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
        {aiReview ? (
          <div className="space-y-1">
            <Badge
              variant="secondary"
              className={
                aiReview.conforme
                  ? "bg-emerald-600 text-white"
                  : "bg-amber-500 text-white"
              }
            >
              {aiReview.conforme ? "Relu IA ✓ conforme" : "Relu IA ⚠ à vérifier"}
            </Badge>
            {aiReview.remarks.length > 0 ? (
              <ul className="list-inside list-disc text-xs text-amber-700">
                {aiReview.remarks.map((remark, idx) => (
                  <li key={`${remark}-${idx}`}>{remark}</li>
                ))}
              </ul>
            ) : null}
          </div>
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
          {canWrite ? (
            <>
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
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMode(mode === "date" ? "none" : "date")}
              >
                Date
              </Button>
            </>
          ) : null}
        </div>

        {canWrite ? (
          <div className="flex flex-wrap gap-2">
            {published ? (
              <StateButton postId={postId} state="unpublish">
                Remettre à publier
              </StateButton>
            ) : (
              <StateButton postId={postId} state="publish">
                Marquer publié
              </StateButton>
            )}
          </div>
        ) : null}

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

        {mode === "date" ? (
          <form action={updatePostDateAction} className="flex items-end gap-2">
            <input type="hidden" name="post_id" value={postId} />
            <Input
              type="date"
              name="scheduled_date"
              defaultValue={scheduledDate}
              required
              className="w-auto text-sm"
            />
            <SubmitButton pendingLabel="Enregistrement…">
              Changer la date
            </SubmitButton>
          </form>
        ) : null}

        {previousVersions.length > 0 ? (
          <details className="rounded-md border p-2">
            <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
              Historique des régénérations ({previousVersions.length})
            </summary>
            <ul className="mt-2 flex flex-col gap-2">
              {previousVersions.map((version, idx) => (
                <li
                  key={`${version.regenerated_at}-${idx}`}
                  className="rounded-md border p-2 text-xs"
                >
                  <div className="text-muted-foreground">
                    {format(parseISO(version.regenerated_at), "d MMMM yyyy à HH:mm", {
                      locale: fr,
                    })}
                    {version.note ? ` · « ${version.note} »` : ""}
                  </div>
                  <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-muted-foreground">
                    {version.content}
                  </p>
                  {canWrite ? (
                    <form action={rollbackPostAction} className="mt-2">
                      <input type="hidden" name="post_id" value={postId} />
                      <input type="hidden" name="version_index" value={idx} />
                      <SubmitButton pendingLabel="Restauration…">
                        Restaurer cette version
                      </SubmitButton>
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </CardFooter>
    </Card>
  );
}
