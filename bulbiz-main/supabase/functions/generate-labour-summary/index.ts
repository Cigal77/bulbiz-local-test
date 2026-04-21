
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { context_tags, toggles, problem_label } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const toggleDescriptions: string[] = [];
    if (toggles?.includeTravel) toggleDescriptions.push("Inclure le déplacement");
    if (toggles?.includeDiagnosis) toggleDescriptions.push("Inclure le diagnostic");
    if (toggles?.includeTests) toggleDescriptions.push("Inclure les tests et remise en service");
    if (toggles?.difficultAccess) toggleDescriptions.push("Accès difficile");
    if (toggles?.emergency) toggleDescriptions.push("Intervention en urgence");

    const contextStr = (context_tags || []).join(", ");
    const toggleStr = toggleDescriptions.length > 0 ? toggleDescriptions.join(", ") : "Aucune option spécifique";
    const problemStr = problem_label ? `Problème : ${problem_label}` : "";

    const systemPrompt = `Tu es un assistant pour artisans plombiers. Tu génères des résumés de main d'œuvre pour des devis professionnels.

Voici les templates de base à adapter :

DÉPANNAGE : Déplacement et diagnostic sur site. Démontage / contrôle de l'élément concerné. Remise en état ou remplacement des pièces défectueuses. Raccordements, remise en service et tests d'étanchéité / bon fonctionnement. Nettoyage et remise en ordre de la zone d'intervention.

REMPLACEMENT : Dépose de l'équipement existant. Préparation des raccordements (alimentation / évacuation) et mise en place du nouvel équipement. Raccordements, réglages, remise en service. Tests (fuites, pression, évacuation) et nettoyage du chantier.

RECHERCHE DE FUITE : Déplacement et diagnostic. Recherche de fuite (visuel + tests selon accessibilité). Localisation, sécurisation et première remise en état si possible. Tests de contrôle et préconisations si travaux complémentaires nécessaires.

DÉBOUCHAGE : Diagnostic d'obstruction et contrôle de l'écoulement. Débouchage mécanique/hydrodynamique selon la situation. Contrôle final d'écoulement + conseils d'usage.

Règles :
- Adapte le résumé au contexte donné (type d'intervention, options, problème)
- Si "urgence" : mentionne l'intervention rapide et la sécurisation
- Si "accès difficile" : mentionne les contraintes d'accès
- Si "déplacement" : commence par le déplacement
- Si "diagnostic" : mentionne le diagnostic
- Si "tests" : mentionne les tests et la remise en service
- Utilise un ton professionnel et rassurant
- Ne mets PAS de prix ni de durée dans le résumé

Tu dois retourner un JSON avec exactement 3 champs :
- "short": résumé court (1-2 phrases)
- "standard": résumé standard pro (4-6 lignes séparées par \\n)
- "reassuring": résumé ultra rassurant avec tests / sécurité / conformité (6-8 lignes séparées par \\n)`;

    const userPrompt = `Génère 3 variantes de résumé main d'œuvre pour ce contexte :
- Type(s) d'intervention : ${contextStr || "général"}
- Options : ${toggleStr}
${problemStr}

Retourne UNIQUEMENT le JSON avec les 3 champs "short", "standard", "reassuring". Pas de markdown, pas de backticks.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Trop de requêtes, réessayez dans quelques secondes." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Crédits IA insuffisants." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    // Parse JSON from response (handle potential markdown wrapping)
    let parsed;
    try {
      const jsonStr = content.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      parsed = JSON.parse(jsonStr);
    } catch {
      console.error("Failed to parse AI response:", content);
      parsed = {
        short: "Déplacement, diagnostic et intervention sur site. Remise en service et tests.",
        standard: "Déplacement et diagnostic sur site.\nIntervention selon la situation constatée.\nRemise en état ou remplacement des éléments défectueux.\nTests et remise en service.\nNettoyage de la zone d'intervention.",
        reassuring: "Déplacement et diagnostic complet sur site par un technicien qualifié.\nIntervention professionnelle adaptée à la situation.\nRemise en état avec pièces de qualité professionnelle.\nTests complets d'étanchéité et de bon fonctionnement.\nNettoyage minutieux de la zone d'intervention.\nCompte-rendu et conseils de prévention.",
      };
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-labour-summary error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
