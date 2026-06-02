"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

interface SubmitButtonProps {
  children: React.ReactNode;
  pendingLabel: string;
}

/** Bouton de soumission qui affiche un état "en cours" pendant la server action. */
export function SubmitButton({ children, pendingLabel }: SubmitButtonProps) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? pendingLabel : children}
    </Button>
  );
}
