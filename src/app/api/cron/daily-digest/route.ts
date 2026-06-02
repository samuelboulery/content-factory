import { NextResponse, type NextRequest } from "next/server";
import { createHash, timingSafeEqual } from "crypto";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { collectDailyDigests } from "@/lib/daily-digest";
import { sendDailyDigest, type DigestItem } from "@/lib/email";

export const dynamic = "force-dynamic";

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Erreur inattendue";
}

/** Comparaison à temps constant (hash → longueur fixe, pas de fuite par timing). */
function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

/**
 * Cron quotidien (Vercel Cron) : envoie à chaque owner le digest des posts à
 * publier le jour même (US-8.3). Protégé par CRON_SECRET (Bearer).
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || !auth || !safeEqual(auth, `Bearer ${secret}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date().toISOString().slice(0, 10); // yyyy-MM-dd (UTC)
  const baseUrl = new URL(request.url).origin;

  try {
    const digests = await collectDailyDigests(today);
    let sent = 0;
    for (const digest of digests) {
      const items: DigestItem[] = digest.posts.map((post) => ({
        communicationId: post.communicationId,
        communicationName: post.communicationName,
        dateLabel: format(parseISO(post.scheduledDate), "d MMMM yyyy", {
          locale: fr,
        }),
      }));
      await sendDailyDigest(
        digest.recipients,
        digest.workspaceName,
        items,
        baseUrl,
      );
      sent += 1;
    }
    return NextResponse.json({
      ok: true,
      date: today,
      workspaces: digests.length,
      sent,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: getErrorMessage(error) },
      { status: 500 },
    );
  }
}
