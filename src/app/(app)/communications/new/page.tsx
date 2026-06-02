import { redirect } from "next/navigation";
import { getActiveContext } from "@/lib/session";
import { listTemplates } from "@/lib/templates";
import { NewCommunicationForm } from "@/components/NewCommunicationForm";

export default async function NewCommunicationPage() {
  const { supabase, user, active } = await getActiveContext();
  if (!user) redirect("/login");
  if (!active) redirect("/");
  const networks =
    active.networks.length > 0 ? active.networks : ["LinkedIn"];
  const templates = await listTemplates(supabase, active.id);

  return <NewCommunicationForm networks={networks} templates={templates} />;
}
