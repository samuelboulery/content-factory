import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveActiveWorkspace } from "@/lib/workspace";
import { listTemplates } from "@/lib/templates";
import { NewCommunicationForm } from "@/components/NewCommunicationForm";

export default async function NewCommunicationPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { active } = await resolveActiveWorkspace(supabase, user.id);
  if (!active) redirect("/");
  const networks =
    active.networks.length > 0 ? active.networks : ["LinkedIn"];
  const templates = await listTemplates(supabase, active.id);

  return <NewCommunicationForm networks={networks} templates={templates} />;
}
