import {
  switchWorkspace,
  createWorkspaceAction,
} from "@/lib/workspace-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { Workspace } from "@/lib/types";

interface WorkspaceSwitcherProps {
  workspaces: Workspace[];
  activeId: string;
}

export function WorkspaceSwitcher({
  workspaces,
  activeId,
}: WorkspaceSwitcherProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        Workspaces
      </div>
      <ul className="flex flex-col gap-1">
        {workspaces.map((workspace) => (
          <li key={workspace.id}>
            <form action={switchWorkspace}>
              <input type="hidden" name="workspace_id" value={workspace.id} />
              <button
                type="submit"
                className={cn(
                  "w-full truncate rounded-md px-3 py-2 text-left text-sm hover:bg-muted",
                  workspace.id === activeId && "bg-muted font-medium",
                )}
              >
                {workspace.name}
              </button>
            </form>
          </li>
        ))}
      </ul>
      <form action={createWorkspaceAction} className="flex gap-2">
        <Input
          name="name"
          required
          placeholder="Nouveau workspace"
          className="h-8 text-sm"
        />
        <Button type="submit" size="sm" variant="outline">
          +
        </Button>
      </form>
    </div>
  );
}
