import { cache } from "react";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { ACTIVE_WORKSPACE_COOKIE } from "@/lib/workspace";
import type { Workspace } from "@/lib/types";

export type SessionUser = { id: string; email: string | null };

export type SessionContext = {
  supabase: SupabaseClient;
  user: SessionUser | null;
  all: Workspace[];
  roleByWs: Map<string, string>;
};

/**
 * Contexte de session mémoïsé par requête (React `cache`) : une seule
 * résolution d'identité + une seule requête membres pour tout le rendu serveur
 * (layout + page), au lieu de 2-3 allers-retours réseau redondants.
 *
 * Identité via `getClaims()` : vérification **locale** du JWT (clés ES256
 * asymétriques, JWKS mis en cache 10 min), donc zéro aller-retour réseau vers le
 * serveur Auth — contrairement à `getUser()`. Le middleware reste le point de
 * validation/refresh de la session sur la requête.
 *
 * La requête jointe `workspace_members ⋈ workspaces` remplace `listWorkspaces`
 * (2 requêtes) + N `getWorkspaceRole` : le rôle voyage avec la ligne membre.
 */
export const getSessionContext = cache(async (): Promise<SessionContext> => {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  if (!claims?.sub) {
    return { supabase, user: null, all: [], roleByWs: new Map() };
  }
  const user: SessionUser = {
    id: claims.sub,
    email: (claims.email as string | undefined) ?? null,
  };

  const { data } = await supabase
    .from("workspace_members")
    .select("role, workspaces(*)")
    .eq("user_id", user.id);

  const all: Workspace[] = [];
  const roleByWs = new Map<string, string>();
  // L'embed many-to-one renvoie un objet `workspaces` (le typage générique le
  // suppose array faute de types DB générés) → cast via `unknown`.
  const rows = (data ?? []) as unknown as {
    role: string;
    workspaces: Workspace | null;
  }[];
  for (const row of rows) {
    if (row.workspaces) {
      all.push(row.workspaces);
      roleByWs.set(row.workspaces.id, row.role);
    }
  }
  all.sort((a, b) => a.created_at.localeCompare(b.created_at));
  return { supabase, user, all, roleByWs };
});

export type ActiveContext = SessionContext & {
  active: Workspace | null;
  role: string | null;
};

/** Contexte + workspace actif (cookie) + rôle de l'utilisateur dans ce workspace. */
export const getActiveContext = cache(async (): Promise<ActiveContext> => {
  const ctx = await getSessionContext();
  if (!ctx.user || ctx.all.length === 0) {
    return { ...ctx, active: null, role: null };
  }
  const cookieStore = await cookies();
  const activeId = cookieStore.get(ACTIVE_WORKSPACE_COOKIE)?.value;
  const active = ctx.all.find((w) => w.id === activeId) ?? ctx.all[0];
  const role = active ? (ctx.roleByWs.get(active.id) ?? null) : null;
  return { ...ctx, active, role };
});
