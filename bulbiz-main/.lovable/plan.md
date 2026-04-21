

## Résumé IA & liste matériel : chargement instantané + IA en arrière-plan

### Constat

Aujourd'hui le bloc « RÉSUMÉ DE LA DEMANDE » et la « liste de matériel » peuvent moudre **30 s à 2 min** (parfois sans jamais finir) parce que :

1. **Transcriptions audio en série** : chaque note vocale est transcrite l'une après l'autre via `gemini-2.5-pro` (le modèle le plus lent). 5 notes vocales = ~1 min avant même de commencer la synthèse.
2. **Modèle trop lourd** : la synthèse finale tourne aussi sur `gemini-2.5-pro`, alors qu'un modèle Flash suffit largement.
3. **Téléchargements bloquants** : 20 images + 20 audios + 4 PDFs téléchargés en base64 avant le moindre appel IA.
4. **Cache invalidé en permanence** : la `queryKey` React Query inclut `mediaCount/historiqueCount/quotesCount` qui changent à chaque ouverture de fiche → l'IA est relancée alors que le cache serveur (`ai_summary_cache`) est encore valide.
5. **Pas de timeout côté client** : si la fonction dépasse la limite Lovable Cloud (150 s), le spinner tourne à l'infini sans erreur visible.
6. **Aucun affichage immédiat** : tant qu'aucune donnée IA n'est revenue, le bloc affiche juste « Analyse en cours… » alors qu'on a déjà `generateStructuredSummary(dossier)` (résumé basique calculé localement) prêt à l'emploi.

### Corrections

**Backend `supabase/functions/summarize-dossier/index.ts`**
- **Paralléliser les transcriptions audio** : remplacer la boucle `for` séquentielle (l.217–263) par un `Promise.all` (gain : 5×–10× sur les dossiers riches en vocal).
- **Basculer la synthèse sur `google/gemini-2.5-flash`** au lieu de `gemini-2.5-pro` (l.631 et l.233) — qualité quasi équivalente sur cette tâche, latence divisée par 3–4. Le `pro` était overkill pour un résumé court.
- **Limiter les médias téléchargés** à 8 images + 6 audios + 2 PDFs (au lieu de 20/20/4). Trier par date desc et garder les plus récents — au-delà l'IA sature de toute façon.
- **Court-circuiter quand le contexte est vide** : si pas d'audio, pas d'image, pas de note, pas de devis et pas de description riche → renvoyer directement le résumé basique sans appeler l'IA (réponse en <500 ms).
- **Ajouter un `AbortController` avec timeout 50 s** sur les appels au gateway IA pour éviter que la fonction reste bloquée 150 s.

**Frontend `src/components/dossier/SummaryBlock.tsx`**
- **Stabiliser la `queryKey`** : ne plus inclure `mediaCount/historiqueCount/quotesCount`. Ne garder que `[dossier.id, dossier.updated_at]`. Le serveur a déjà son propre fingerprint robuste — pas besoin de re-fetcher juste parce qu'une photo a été ouverte.
- **Augmenter `staleTime` à 30 min** (au lieu de 5 min).
- **Afficher le résumé basique immédiatement** : tant que `aiSummary` n'est pas revenu, afficher `fallback` (`generateStructuredSummary`) avec un petit badge « ✨ Enrichissement en cours… » discret en haut à droite, au lieu d'un gros spinner qui cache tout.
- **Timeout client de 60 s** sur `supabase.functions.invoke` (via `AbortSignal.timeout`) → si dépassé : on garde le résumé basique + toast « L'enrichissement IA prend trop de temps, ressayez plus tard » au lieu de moudre sans fin.
- **Bouton « Régénérer »** : afficher un compte à rebours visuel pendant la régénération + permettre l'annulation.

### Comportement attendu

| Scénario | Avant | Après |
|---|---|---|
| Ouverture fiche dossier (cache chaud) | Spinner 2–5 s puis affichage | **Affichage instantané** depuis le cache serveur |
| Ouverture fiche dossier (1ʳᵉ fois, peu de médias) | Spinner 15–30 s | Résumé basique en <300 ms + version IA enrichie en 3–8 s |
| Dossier avec 5 notes vocales + 10 photos | Moulinage 60–120 s, parfois timeout silencieux | Résumé basique immédiat, IA enrichie en 15–25 s, timeout propre à 60 s |
| Régénération forcée | Pas de feedback, on ne sait pas si ça marche | Loader actif sur le bouton + toast à la fin |
| Edge function plante / dépasse 150 s | Spinner infini, l'utilisateur croit que c'est cassé | Toast d'erreur clair + résumé basique conservé |

### QA

1. Ouvrir un dossier déjà visité → le résumé s'affiche **instantanément** (< 500 ms).
2. Ouvrir un dossier neuf avec juste une description → résumé basique en < 300 ms, version IA en 3–6 s.
3. Ouvrir un dossier avec 3+ notes vocales → résumé basique immédiat, IA enrichie en 10–20 s (vs 60+ s avant).
4. Cliquer « Régénérer » → loader visible sur le bouton, nouveau résumé en 10–20 s.
5. Couper le réseau et cliquer Régénérer → toast d'erreur sous 60 s, résumé précédent conservé.
6. Ré-ouvrir une fiche déjà chargée 10 min plus tard → toujours instantané (cache 30 min).

