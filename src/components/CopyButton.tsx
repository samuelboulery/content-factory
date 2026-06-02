"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface CopyButtonProps {
  value: string; // chemin relatif (ex: /intervenants/xxx) ou URL absolue
  children: React.ReactNode;
}

export function CopyButton({ value, children }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const text = value.startsWith("/")
      ? `${window.location.origin}${value}`
      : value;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={handleCopy}>
      {copied ? "Copié ✓" : children}
    </Button>
  );
}
