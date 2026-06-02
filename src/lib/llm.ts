import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { EventStep } from './types';

/** Faits durs de l'événement (jamais inventés par l'IA). */
export type EventFacts = {
  eventName: string;
  eventDate: string; // ISO date (yyyy-MM-dd)
  eventLocation?: string;
  eventLink?: string;
};

/** Un post tel que renvoyé par le LLM (offset relatif à la date de l'event). */
export type GeneratedPost = {
  scheduled_offset_days: number;
  content: string;
  so_what: string;
};

const DEEPSEEK_ENDPOINT = 'https://api.deepseek.com/v1/chat/completions';
const DEEPSEEK_MODEL = 'deepseek-chat';

function buildPrompt(
  facts: EventFacts,
  intervenants: string,
  charter: string,
  context: string,
  steps: EventStep[],
): string {
  const dateLong = format(parseISO(facts.eventDate), 'd MMMM yyyy', { locale: fr });
  const lieu = facts.eventLocation?.trim() ? facts.eventLocation.trim() : '[NON FOURNI]';
  const lien = facts.eventLink?.trim() ? facts.eventLink.trim() : '[NON FOURNI]';
  const matiere = intervenants?.trim() ? intervenants.trim() : '[NON FOURNI]';
  const contexteBlock = context.trim()
    ? `\n<contexte_general>\n${context.trim()}\n</contexte_general>\n`
    : '';
  const count = steps.length;
  const missionSteps = steps
    .map(
      (step, i) =>
        `- Post ${i + 1} (J${step.offset_days}) — Intention : ${step.intention} Info attendue : ${step.info_required ?? '—'}.`,
    )
    .join('\n');
  const outputItems = steps
    .map(() => `    { "content": "...", "so_what": "..." }`)
    .join(',\n');

  return `Tu es un rédacteur senior pour l'association The Design Society.

<charte>
${charter}
</charte>
${contexteBlock}
<faits_durs>
Nom : ${facts.eventName}
Date : ${dateLong}
Lieu : ${lieu}
Lien d'inscription : ${lien}
</faits_durs>

<matiere_intervenants>
${matiere}
</matiere_intervenants>

<regle_anti_hallucination_contextuelle>
Tu n'inventes JAMAIS un fait pratique (lieu, horaire, lien, prix, nom d'intervenant non fourni).
Mais tu distingues deux types de manque :

1. MANQUE NORMAL à ce stade → tu changes l'angle, tu n'écris PAS "[À COMPLÉTER]".
   Exemple : pas d'intervenants connus au post J-30 → écris un vrai SAVE THE DATE / teasing qui crée l'attente, sans prétendre connaître le programme. C'est volontaire, pas un trou.

2. MANQUE ANORMAL à ce stade → tu écris littéralement "[À COMPLÉTER : x]" au lieu d'inventer.
   Exemple : pas de lieu fourni au post J-5 (détails pratiques) → "[À COMPLÉTER : lieu]".

Le niveau d'info attendu de chaque post est indiqué dans sa fiche d'intention ci-dessous.
</regle_anti_hallucination_contextuelle>

<mission>
Génère ${count} posts LinkedIn en chaîne chronologique pour annoncer cet événement, en respectant strictement la charte.

Les ${count} posts forment UNE campagne cohérente, pas des variations du même post. Chaque post connaît les précédents et prolonge le récit. Voici l'intention narrative et le niveau d'info attendu de chacun, dans l'ordre :

${missionSteps}

Chaque post doit faire entre 600 et 1200 caractères.

Pour CHAQUE post, applique le filtre "so what" : quel bénéfice concret le lecteur en retire ? Si flou, réécris. Formule ce bénéfice en une phrase dans le champ "so_what".
</mission>

<output_format>
Réponds en JSON valide UNIQUEMENT, sans préambule, sans markdown, sans backticks.
Le tableau "posts" doit contenir EXACTEMENT ${count} entrées, dans l'ordre des intentions ci-dessus :

{
  "posts": [
${outputItems}
  ]
}
</output_format>`;
}

/**
 * Appelle DeepSeek et retourne 4 posts validés.
 * @throws Error avec un message clair en cas d'échec réseau / HTTP / JSON.
 */
export async function generatePosts(
  facts: EventFacts,
  intervenants: string,
  charter: string,
  context: string,
  steps: EventStep[],
): Promise<GeneratedPost[]> {
  const prompt = buildPrompt(facts, intervenants, charter, context, steps);
  const raw = await callDeepSeek(prompt);
  const parsed = parsePostsJson(raw, steps.length);
  // Les offsets viennent du template (déterministe), pas de la réponse du LLM.
  return parsed.map((post, index) => ({
    scheduled_offset_days: steps[index].offset_days,
    content: post.content,
    so_what: post.so_what,
  }));
}

/** Appel brut DeepSeek (mode JSON) → retourne le contenu texte du message. */
async function callDeepSeek(prompt: string): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error('DEEPSEEK_API_KEY manquante côté serveur (.env.local).');
  }

  let response: Response;
  try {
    response = await fetch(DEEPSEEK_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.7,
      }),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Appel DeepSeek échoué (réseau) : ${message}`);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`DeepSeek a répondu ${response.status} : ${body.slice(0, 500)}`);
  }

  const data: unknown = await response.json();
  return extractMessageContent(data);
}

/** Extrait le `message.content` de la réponse (forme OpenAI-compatible). */
function extractMessageContent(data: unknown): string {
  if (typeof data === 'object' && data !== null && 'choices' in data) {
    const choices = (data as { choices: unknown }).choices;
    if (Array.isArray(choices)) {
      const first = choices[0] as { message?: { content?: unknown } } | undefined;
      const content = first?.message?.content;
      if (typeof content === 'string') return content;
    }
  }
  throw new Error('Réponse DeepSeek inattendue (message.content introuvable).');
}

/**
 * Parsing défensif : le modèle peut renvoyer des backticks markdown malgré la consigne.
 * On strip les fences, on isole l'objet JSON, on valide la forme.
 */
function parsePostsJson(
  raw: string,
  expectedCount: number,
): { content: string; so_what: string }[] {
  let cleaned = raw.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('Aucun objet JSON trouvé dans la réponse du LLM.');
  }
  cleaned = cleaned.slice(start, end + 1);

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error('JSON invalide renvoyé par le LLM.');
  }

  if (typeof parsed !== 'object' || parsed === null || !('posts' in parsed)) {
    throw new Error('Champ "posts" manquant dans la réponse du LLM.');
  }

  const posts = (parsed as { posts: unknown }).posts;
  if (!Array.isArray(posts) || posts.length !== expectedCount) {
    const got = Array.isArray(posts) ? posts.length : 'aucun';
    throw new Error(`Le LLM doit renvoyer exactement ${expectedCount} posts (reçu : ${got}).`);
  }

  return posts.map((post, index) => validatePost(post, index));
}

function validatePost(
  post: unknown,
  index: number,
): { content: string; so_what: string } {
  if (typeof post !== 'object' || post === null) {
    throw new Error(`Post ${index + 1} : format invalide.`);
  }
  const obj = post as Record<string, unknown>;
  const content = obj.content;
  const soWhat = obj.so_what;

  if (typeof content !== 'string' || content.trim() === '') {
    throw new Error(`Post ${index + 1} : content manquant.`);
  }

  return {
    content,
    so_what: typeof soWhat === 'string' ? soWhat : '',
  };
}

/** Un post de la campagne, fourni en contexte lors d'une régénération. */
export type CampaignPost = {
  dateLabel: string;
  content: string;
  status: 'publié' | 'à publier';
  isTarget: boolean;
};

function buildRegenPrompt(args: {
  charter: string;
  context: string;
  facts: EventFacts;
  campaign: CampaignPost[];
  note: string;
}): string {
  const { charter, context, facts, campaign, note } = args;
  const dateLong = format(parseISO(facts.eventDate), 'd MMMM yyyy', { locale: fr });
  const lieu = facts.eventLocation?.trim() ? facts.eventLocation.trim() : '[NON FOURNI]';
  const lien = facts.eventLink?.trim() ? facts.eventLink.trim() : '[NON FOURNI]';
  const contexteBlock = context.trim()
    ? `\n<contexte_general>\n${context.trim()}\n</contexte_general>\n`
    : '';

  const campagne = campaign
    .map((p, i) => {
      const marque = p.isTarget ? ' ⟵ POST À RÉÉCRIRE' : '';
      return `Post ${i + 1} — ${p.dateLabel} — [${p.status}]${marque}\n${p.content}`;
    })
    .join('\n\n---\n\n');

  return `Tu es un rédacteur senior pour l'association The Design Society.

<charte>
${charter}
</charte>
${contexteBlock}
<faits_durs>
Nom : ${facts.eventName}
Date : ${dateLong}
Lieu : ${lieu}
Lien d'inscription : ${lien}
</faits_durs>

<campagne>
${campagne}
</campagne>

<consigne_utilisateur>
${note.trim() ? note.trim() : '(aucune note — améliore simplement le post à réécrire)'}
</consigne_utilisateur>

<regles>
Réécris UNIQUEMENT le post marqué « POST À RÉÉCRIRE ».
Les posts marqués [publié] sont déjà sortis : ne les contredis pas, ne te répète pas, reste dans la continuité de ton et de faits annoncés.
Applique la consigne utilisateur. Respecte strictement la charte. Entre 600 et 1200 caractères.
Anti-hallucination : n'invente aucun fait pratique. Manque normal au stade → change d'angle. Manque anormal → "[À COMPLÉTER : x]".
Applique le filtre "so what" (bénéfice concret pour le lecteur, en une phrase).
</regles>

<output_format>
Réponds en JSON valide UNIQUEMENT, sans préambule ni backticks :
{ "content": "...", "so_what": "..." }
</output_format>`;
}

/** Régénère un seul post en tenant compte de toute la campagne + d'une note. */
export async function regeneratePost(args: {
  charter: string;
  context: string;
  facts: EventFacts;
  campaign: CampaignPost[];
  note: string;
}): Promise<{ content: string; so_what: string }> {
  const prompt = buildRegenPrompt(args);
  const raw = await callDeepSeek(prompt);
  return parseSinglePost(raw);
}

function parseSinglePost(raw: string): { content: string; so_what: string } {
  let cleaned = raw.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('Aucun objet JSON trouvé dans la réponse du LLM.');
  }
  cleaned = cleaned.slice(start, end + 1);

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error('JSON invalide renvoyé par le LLM.');
  }
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('Réponse LLM invalide (objet attendu).');
  }
  const obj = parsed as Record<string, unknown>;
  if (typeof obj.content !== 'string' || obj.content.trim() === '') {
    throw new Error('content manquant dans la réponse du LLM.');
  }
  return {
    content: obj.content,
    so_what: typeof obj.so_what === 'string' ? obj.so_what : '',
  };
}
