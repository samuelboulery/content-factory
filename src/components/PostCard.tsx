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
import type { ComplianceResult } from "@/lib/compliance";

interface PostCardProps {
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
  content,
  dateLabel,
  soWhat,
  compliance,
}: PostCardProps) {
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">(
    "idle",
  );

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
      <CardFooter>
        <Button variant="outline" size="sm" onClick={handleCopy}>
          {copyStatus === "copied"
            ? "Copié ✓"
            : copyStatus === "error"
              ? "Échec copie"
              : "Copier"}
        </Button>
      </CardFooter>
    </Card>
  );
}
