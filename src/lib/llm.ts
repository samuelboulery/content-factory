import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { EventStep, PostReview } from './types';

/** Faits durs de l'événement (jamais inventés par l'IA). */
export type EventFacts = {
  eventName: string;
  eventDate: string; // ISO date (yyyy-MM-dd)
  eventLocation?: string;
  eventLink?: string;
};

/** Un post prêt à insérer (offset relatif à la date de l'event). Interne. */
type GeneratedPost = {
  scheduled_offset_days: number;
  content: string;
  so_what: string;
};

const DEEPSEEK_ENDPOINT = 'https://api.deepseek.com/v1/chat/completions';
const DEEPSEEK_MODEL = 'deepseek-chat';

/** Normalise les faits durs + le bloc contexte (partagé génération / régénération). */
function formatFactsBlock(
  facts: EventFacts,
  context: string,
): { dateLong: string; lieu: string; lien: string; contexteBlock: string } {
  return {
    dateLong: format(parseISO(facts.eventDate), 'd MMMM yyyy', { locale: fr }),
    lieu: facts.eventLocation?.trim() ? facts.eventLocation.trim() : '[NON FOURNI]',
    lien: facts.eventLink?.trim() ? facts.eventLink.trim() : '[NON FOURNI]',
    contexteBlock: context.trim()
      ? `\n<contexte_general>\n${context.trim()}\n</contexte_general>\n`
      : '',
  };
}

function buildPrompt(
  facts: EventFacts,
  intervenants: string,
  charter: string,
  context: string,
  steps: EventStep[],
  network: string,
): string {
  const { dateLong, lieu, lien, contexteBlock } = formatFactsBlock(facts, context);
  const matiere = intervenants?.trim() ? intervenants.trim() : '[NON FOURNI]';
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
Génère ${count} posts ${network} en chaîne chronologique pour annoncer cet événement, en respectant strictement la charte.

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
  network: string,
): Promise<GeneratedPost[]> {
  const prompt = buildPrompt(facts, intervenants, charter, context, steps, network);
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
async function callDeepSeek(prompt: string, temperature = 0.7): Promise<string> {
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
        temperature,
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
  const { dateLong, lieu, lien, contexteBlock } = formatFactsBlock(facts, context);

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

// ── Relecteur IA de conformité (US-5.5, flag seul : ne réécrit jamais) ────────

function buildReviewPrompt(
  charter: string,
  facts: EventFacts,
  contents: string[],
): string {
  const { dateLong, lieu, lien } = formatFactsBlock(facts, '');
  const postsBlock = contents
    .map((content, i) => `[${i + 1}]\n${content}`)
    .join('\n\n---\n\n');

  return `Tu es un relecteur éditorial senior pour l'association The Design Society.
Tu vérifies la conformité de posts à la charte ci-dessous. Tu ne réécris RIEN : tu signales seulement les écarts.

<charte>
${charter}
</charte>

<faits_durs>
Nom : ${facts.eventName}
Date : ${dateLong}
Lieu : ${lieu}
Lien d'inscription : ${lien}
</faits_durs>

<criteres>
Pour CHAQUE post, évalue sa conformité à la charte :
- Ton TDS : « on » collectif (pas « nous »), sobriété, aucun superlatif creux ni jargon marketing.
- Bénéfice lecteur clair (filtre « so what »).
- Cohérence avec la ligne éditoriale et la charte.
- Aucun fait pratique inventé (lieu / horaire / lien / intervenant non fourni dans les faits durs). Les mentions « [À COMPLÉTER : x] » sont normales (manque assumé), pas un écart.
Un post est "conforme": true s'il ne présente aucun écart notable. Sinon liste les écarts dans "remarks" (phrases courtes, actionnables).
</criteres>

<posts>
${postsBlock}
</posts>

<output_format>
Réponds en JSON valide UNIQUEMENT, sans préambule ni backticks. Le tableau "reviews" doit contenir EXACTEMENT ${contents.length} entrées, dans l'ordre des posts :
{ "reviews": [ { "conforme": true, "remarks": [] } ] }
</output_format>`;
}

function parseReviewsJson(raw: string, expectedCount: number): PostReview[] {
  let cleaned = raw.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('Aucun objet JSON trouvé dans la réponse du relecteur.');
  }
  cleaned = cleaned.slice(start, end + 1);

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error('JSON invalide renvoyé par le relecteur.');
  }
  if (typeof parsed !== 'object' || parsed === null || !('reviews' in parsed)) {
    throw new Error('Champ "reviews" manquant dans la réponse du relecteur.');
  }
  const reviews = (parsed as { reviews: unknown }).reviews;
  if (!Array.isArray(reviews) || reviews.length !== expectedCount) {
    const got = Array.isArray(reviews) ? reviews.length : 'aucun';
    throw new Error(`Le relecteur doit renvoyer exactement ${expectedCount} verdicts (reçu : ${got}).`);
  }
  return reviews.map(validateReview);
}

function validateReview(review: unknown): PostReview {
  const obj =
    typeof review === 'object' && review !== null
      ? (review as Record<string, unknown>)
      : {};
  const remarks = Array.isArray(obj.remarks)
    ? obj.remarks.filter((r): r is string => typeof r === 'string')
    : [];
  return { conforme: obj.conforme === true, remarks };
}

/**
 * Relit une campagne (N posts) vs charte. Un seul appel, verdict par post.
 * Température basse pour un jugement stable. Flag seul : ne modifie pas les posts.
 */
export async function reviewCampaign(
  charter: string,
  facts: EventFacts,
  contents: string[],
): Promise<PostReview[]> {
  if (contents.length === 0) return [];
  const prompt = buildReviewPrompt(charter, facts, contents);
  const raw = await callDeepSeek(prompt, 0.2);
  return parseReviewsJson(raw, contents.length);
}

/** Relit un seul post (régénération) vs charte. */
export async function reviewSinglePost(
  charter: string,
  facts: EventFacts,
  content: string,
): Promise<PostReview> {
  const [review] = await reviewCampaign(charter, facts, [content]);
  return review;
}

// ── Questions suggérées aux intervenants (US-6.3) ────────────────────────────

function buildQuestionsPrompt(
  charter: string,
  context: string,
  facts: EventFacts,
  intervenantsMatter: string,
): string {
  const { dateLong, lieu, contexteBlock } = formatFactsBlock(facts, context);
  const matiere = intervenantsMatter.trim() || '[aucune matière pour l’instant]';

  return `Tu prépares la communication d'un événement pour l'association The Design Society.
Propose des questions courtes et concrètes à poser aux intervenants pour récolter la matière utile à la communication (leur angle, le bénéfice concret pour le public, une anecdote, ce qu'ils veulent transmettre).

<charte>
${charter}
</charte>
${contexteBlock}
<faits_durs>
Nom : ${facts.eventName}
Date : ${dateLong}
Lieu : ${lieu}
</faits_durs>

<matiere_actuelle>
${matiere}
</matiere_actuelle>

<consignes>
Propose 4 à 6 questions, dans le ton de la charte (sobre, « on » collectif).
Évite les questions déjà couvertes par la matière actuelle. Questions ouvertes, faciles à répondre.
</consignes>

<output_format>
Réponds en JSON valide UNIQUEMENT, sans préambule ni backticks :
{ "questions": ["...", "..."] }
</output_format>`;
}

// ── Boucle d'apprentissage charte (corpus de diffs IA → humain) ──────────────

/** Une correction : brouillon IA vs version finalement publiée par l'humain. */
export type CharterDiff = { ai: string; human: string };

/**
 * Analyse les corrections humaines pour repérer des patterns et proposer un
 * addendum à la charte. Un seul appel LLM.
 */
export async function analyzeCharterLearnings(
  charter: string,
  diffs: CharterDiff[],
): Promise<{ observations: string[]; addendum: string }> {
  const corpus = diffs
    .map(
      (d, i) =>
        `[${i + 1}]\nBROUILLON IA :\n${d.ai}\n\nPUBLIÉ (corrigé) :\n${d.human}`,
    )
    .join('\n\n---\n\n');

  const prompt = `Tu es analyste éditorial pour l'association The Design Society.
Voici la charte actuelle, puis des paires « brouillon IA → version publiée » : l'humain a corrigé chaque brouillon avant publication.
Identifie les PATTERNS récurrents de ses corrections (ton, longueur, formulations ajoutées/retirées, tics évités) et propose un addendum concis à AJOUTER à la charte, dans son style, pour que l'IA produise directement ce que l'humain attend.

<charte>
${charter}
</charte>

<corrections>
${corpus}
</corrections>

<consignes>
Ne déduis que ce qui est RÉCURRENT (au moins 2 occurrences). N'invente pas de règle non observée.
"observations" = liste courte de patterns observés. "addendum" = bloc à ajouter à la charte (quelques lignes max, ton de la charte).
</consignes>

<output_format>
Réponds en JSON valide UNIQUEMENT, sans préambule ni backticks :
{ "observations": ["..."], "addendum": "..." }
</output_format>`;

  const raw = await callDeepSeek(prompt, 0.4);
  let cleaned = raw.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('Aucun objet JSON trouvé (apprentissage).');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    throw new Error('JSON invalide renvoyé par le LLM (apprentissage).');
  }
  const obj =
    typeof parsed === 'object' && parsed !== null
      ? (parsed as Record<string, unknown>)
      : {};
  const observations = Array.isArray(obj.observations)
    ? obj.observations.filter((o): o is string => typeof o === 'string')
    : [];
  const addendum = typeof obj.addendum === 'string' ? obj.addendum.trim() : '';
  return { observations, addendum };
}

/** Génère des questions à poser aux intervenants selon le contexte (US-6.3). */
export async function suggestIntervenantQuestions(
  charter: string,
  context: string,
  facts: EventFacts,
  intervenantsMatter: string,
): Promise<string[]> {
  const prompt = buildQuestionsPrompt(charter, context, facts, intervenantsMatter);
  const raw = await callDeepSeek(prompt, 0.5);

  let cleaned = raw.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('Aucun objet JSON trouvé dans la réponse (questions).');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    throw new Error('JSON invalide renvoyé par le LLM (questions).');
  }
  if (typeof parsed !== 'object' || parsed === null || !('questions' in parsed)) {
    throw new Error('Champ "questions" manquant dans la réponse du LLM.');
  }
  const questions = (parsed as { questions: unknown }).questions;
  if (!Array.isArray(questions)) {
    throw new Error('Le LLM doit renvoyer un tableau "questions".');
  }
  // Garde au plus 6 questions non vides.
  return questions
    .filter((q): q is string => typeof q === 'string' && q.trim() !== '')
    .map((q) => q.trim())
    .slice(0, 6);
}
