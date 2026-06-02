"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/SubmitButton";
import { saveTemplateStepsAction } from "@/lib/template-actions";
import type { EventStep } from "@/lib/types";

type EditableStep = {
  offset_days: string;
  intention: string;
  info_required: string;
};

interface TemplateStepsEditorProps {
  templateId: string;
  initialSteps: EventStep[];
}

function toEditable(steps: EventStep[]): EditableStep[] {
  const editable = steps.map((s) => ({
    offset_days: String(s.offset_days),
    intention: s.intention,
    info_required: s.info_required ?? "",
  }));
  return editable.length > 0
    ? editable
    : [{ offset_days: "0", intention: "", info_required: "" }];
}

/** Éditeur d'étapes d'un template : ajout/suppression de lignes (US-3.4). */
export function TemplateStepsEditor({
  templateId,
  initialSteps,
}: TemplateStepsEditorProps) {
  const [steps, setSteps] = useState<EditableStep[]>(toEditable(initialSteps));

  function update(index: number, field: keyof EditableStep, value: string) {
    setSteps((prev) =>
      prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)),
    );
  }
  function addStep() {
    setSteps((prev) => [
      ...prev,
      { offset_days: "0", intention: "", info_required: "" },
    ]);
  }
  function removeStep(index: number) {
    setSteps((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <form action={saveTemplateStepsAction} className="mt-3 flex flex-col gap-3">
      <input type="hidden" name="template_id" value={templateId} />
      {steps.map((step, i) => (
        <div key={i} className="flex flex-col gap-2 rounded-lg border p-3">
          <div className="flex items-center gap-2">
            <Label htmlFor={`offset-${templateId}-${i}`} className="text-xs">
              Jour (offset)
            </Label>
            <Input
              id={`offset-${templateId}-${i}`}
              name="offset_days"
              type="number"
              value={step.offset_days}
              onChange={(e) => update(i, "offset_days", e.target.value)}
              required
              className="w-24"
            />
            <Input
              name="info_required"
              value={step.info_required}
              onChange={(e) => update(i, "info_required", e.target.value)}
              placeholder="Info attendue (ex : date + lieu)"
              className="flex-1 text-sm"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => removeStep(i)}
              disabled={steps.length <= 1}
            >
              ✕
            </Button>
          </div>
          <Textarea
            name="intention"
            value={step.intention}
            onChange={(e) => update(i, "intention", e.target.value)}
            rows={2}
            required
            placeholder="Intention narrative du post"
            className="text-sm"
          />
        </div>
      ))}
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={addStep}>
          + Ajouter une étape
        </Button>
        <SubmitButton pendingLabel="Enregistrement…">
          Enregistrer les étapes
        </SubmitButton>
      </div>
    </form>
  );
}
