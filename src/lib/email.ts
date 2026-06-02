import { Resend } from "resend";

/** Une ligne du digest email. */
export interface DigestItem {
  communicationId: string;
  communicationName: string;
  dateLabel: string;
}

/** Échappe le HTML (le nom de com est saisi par l'utilisateur). */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Envoie le digest matinal des posts à publier d'un workspace (US-8.3) via Resend.
 * @param recipients un ou plusieurs destinataires (emails de notif du workspace).
 * @throws si Resend n'est pas configuré ou si l'envoi échoue.
 */
export async function sendDailyDigest(
  recipients: string[],
  workspaceName: string,
  items: DigestItem[],
  baseUrl: string,
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!apiKey || !from) {
    throw new Error("Resend non configuré (RESEND_API_KEY / RESEND_FROM).");
  }
  if (recipients.length === 0) return;

  const lines = items
    .map(
      (item) =>
        `<li>${escapeHtml(item.dateLabel)} — <a href="${baseUrl}/communications/${item.communicationId}">${escapeHtml(item.communicationName)}</a></li>`,
    )
    .join("");

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from,
    to: recipients,
    subject: `Content Factory · ${escapeHtml(workspaceName)} — ${items.length} post(s) à publier aujourd'hui`,
    html: `<p>Bonjour,</p><p>${items.length} post(s) à publier aujourd'hui pour <strong>${escapeHtml(workspaceName)}</strong> :</p><ul>${lines}</ul><p>— Content Factory</p>`,
  });
  if (error) {
    throw new Error(`Envoi email échoué : ${error.message}`);
  }
}
