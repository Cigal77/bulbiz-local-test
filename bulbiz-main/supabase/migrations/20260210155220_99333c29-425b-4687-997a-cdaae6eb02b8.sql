
-- =============================================
-- Phase 1: 5 tables + RLS + Seed data
-- =============================================

-- 1) problem_taxonomy
CREATE TABLE public.problem_taxonomy (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  parent_id uuid REFERENCES public.problem_taxonomy(id) ON DELETE CASCADE,
  label text NOT NULL,
  keywords text[] DEFAULT '{}',
  default_context jsonb DEFAULT '{}',
  sort_order integer DEFAULT 0,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.problem_taxonomy ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read global + own taxonomy"
  ON public.problem_taxonomy FOR SELECT
  USING (user_id IS NULL OR user_id = auth.uid());
CREATE POLICY "Users can insert own taxonomy"
  ON public.problem_taxonomy FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own taxonomy"
  ON public.problem_taxonomy FOR UPDATE
  USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own taxonomy"
  ON public.problem_taxonomy FOR DELETE
  USING (auth.uid() = user_id);

-- 2) problem_to_manoeuvre
CREATE TABLE public.problem_to_manoeuvre (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  problem_id uuid NOT NULL REFERENCES public.problem_taxonomy(id) ON DELETE CASCADE,
  label text NOT NULL,
  description text DEFAULT '',
  unit text DEFAULT 'u',
  default_qty numeric DEFAULT 1,
  unit_price numeric DEFAULT 0,
  vat_rate numeric DEFAULT 10,
  weight integer DEFAULT 100,
  type text DEFAULT 'standard',
  conditions_json jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.problem_to_manoeuvre ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read manoeuvres"
  ON public.problem_to_manoeuvre FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- 3) labour_templates
CREATE TABLE public.labour_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  context_tags text[] DEFAULT '{}',
  text_short text NOT NULL,
  text_standard text NOT NULL,
  text_reassuring text NOT NULL,
  duration_default_min integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.labour_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read labour templates"
  ON public.labour_templates FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- 4) catalog_material
CREATE TABLE public.catalog_material (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_path text NOT NULL,
  label text NOT NULL,
  type text NOT NULL DEFAULT 'PETITE_FOURNITURE',
  unit text DEFAULT 'u',
  default_qty numeric DEFAULT 1,
  unit_price numeric DEFAULT 0,
  vat_rate numeric DEFAULT 20,
  tags text[] DEFAULT '{}',
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.catalog_material ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read global + own materials"
  ON public.catalog_material FOR SELECT
  USING (user_id IS NULL OR user_id = auth.uid());
CREATE POLICY "Users can insert own materials"
  ON public.catalog_material FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own materials"
  ON public.catalog_material FOR UPDATE
  USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own materials"
  ON public.catalog_material FOR DELETE
  USING (auth.uid() = user_id);

-- 5) material_correspondence
CREATE TABLE public.material_correspondence (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_material_id uuid NOT NULL REFERENCES public.catalog_material(id) ON DELETE CASCADE,
  target_material_id uuid NOT NULL REFERENCES public.catalog_material(id) ON DELETE CASCADE,
  weight integer DEFAULT 100,
  conditions_json jsonb DEFAULT '{}',
  default_qty numeric DEFAULT 1,
  group_label text DEFAULT 'Divers',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.material_correspondence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read correspondences"
  ON public.material_correspondence FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- =============================================
-- SEED: Labour Templates
-- =============================================
INSERT INTO public.labour_templates (context_tags, text_short, text_standard, text_reassuring, duration_default_min) VALUES
(
  '{depannage}',
  'Déplacement, diagnostic et réparation sur site. Remise en service et tests.',
  E'Déplacement et diagnostic sur site.\nDémontage / contrôle de l''élément concerné.\nRemise en état ou remplacement des pièces défectueuses.\nRaccordements, remise en service et tests d''étanchéité / bon fonctionnement.\nNettoyage et remise en ordre de la zone d''intervention.',
  E'Déplacement et diagnostic complet sur site par un technicien qualifié.\nDémontage soigneux et contrôle approfondi de l''élément concerné.\nRemise en état ou remplacement des pièces défectueuses (pièces de qualité professionnelle).\nRaccordements aux normes, remise en service progressive.\nTests d''étanchéité, contrôle de pression et vérification du bon fonctionnement.\nNettoyage minutieux et remise en ordre de la zone d''intervention.\nCompte-rendu d''intervention et conseils de prévention.',
  60
),
(
  '{remplacement}',
  'Dépose de l''ancien équipement, pose du neuf, raccordements et tests.',
  E'Dépose de l''équipement existant.\nPréparation des raccordements (alimentation / évacuation) et mise en place du nouvel équipement.\nRaccordements, réglages, remise en service.\nTests (fuites, pression, évacuation) et nettoyage du chantier.',
  E'Dépose soigneuse de l''équipement existant avec protection des surfaces.\nVérification et préparation des raccordements (alimentation eau chaude/froide, évacuation).\nMise en place du nouvel équipement selon les règles de l''art.\nRaccordements conformes aux normes en vigueur, réglages fins.\nRemise en service progressive avec contrôles à chaque étape.\nTests complets : étanchéité, pression, débit, évacuation.\nNettoyage du chantier, enlèvement des anciens équipements.\nExplications d''utilisation et conseils d''entretien au client.',
  120
),
(
  '{recherche_fuite}',
  'Déplacement, recherche de fuite et sécurisation. Tests de contrôle.',
  E'Déplacement et diagnostic.\nRecherche de fuite (visuel + tests selon accessibilité).\nLocalisation, sécurisation et première remise en état si possible.\nTests de contrôle et préconisations si travaux complémentaires nécessaires.',
  E'Déplacement et diagnostic approfondi par un technicien spécialisé.\nRecherche de fuite méthodique : inspection visuelle, tests de pression, détection selon accessibilité.\nLocalisation précise de la fuite et sécurisation immédiate de la zone.\nPremière remise en état si techniquement possible sur place.\nTests de contrôle complets (pression, étanchéité) après intervention.\nRapport détaillé avec préconisations si travaux complémentaires nécessaires.\nConseils de surveillance et prévention.',
  90
),
(
  '{debouchage}',
  'Diagnostic d''obstruction, débouchage mécanique/hydrodynamique, contrôle final.',
  E'Diagnostic d''obstruction et contrôle de l''écoulement.\nDébouchage mécanique/hydrodynamique selon la situation.\nContrôle final d''écoulement + conseils d''usage.',
  E'Diagnostic complet de l''obstruction : nature, localisation et cause probable.\nDébouchage professionnel par méthode adaptée (furet mécanique, hydrocurage haute pression).\nContrôle de l''intégrité des canalisations après intervention.\nTest final d''écoulement sur tous les points concernés.\nConseils d''usage et recommandations pour éviter les récidives.\nGarantie sur l''intervention réalisée.',
  60
),
(
  '{installation}',
  'Installation complète du nouvel équipement, raccordements et mise en service.',
  E'Préparation de l''emplacement et vérification des arrivées/évacuations.\nInstallation du nouvel équipement.\nRaccordements alimentation et évacuation.\nMise en service, réglages et tests complets.\nNettoyage du chantier.',
  E'Étude préalable de l''emplacement et vérification de la conformité des arrivées et évacuations.\nInstallation soigneuse du nouvel équipement selon les règles de l''art et les normes en vigueur.\nRaccordements alimentation eau chaude/froide et évacuation, avec matériaux de qualité professionnelle.\nMise en service progressive, réglages fins et tests complets (étanchéité, pression, débit).\nNettoyage du chantier et enlèvement de tous les emballages.\nExplications détaillées d''utilisation et conseils d''entretien.',
  150
),
(
  '{renovation}',
  'Dépose existant, adaptation des réseaux, pose du neuf, tests et finitions.',
  E'Dépose et évacuation des équipements existants.\nAdaptation ou création des réseaux d''alimentation et d''évacuation.\nPose des nouveaux équipements.\nRaccordements, mise en service et tests.\nFinitions et nettoyage.',
  E'Dépose soigneuse et évacuation des équipements existants avec protection des surfaces.\nÉtat des lieux des réseaux existants et adaptation nécessaire.\nCréation ou modification des points d''alimentation et d''évacuation selon les normes.\nPose des nouveaux équipements selon les règles de l''art.\nRaccordements complets, mise en service et tests approfondis.\nFinitions soignées (joints, raccords visibles, rosaces).\nNettoyage complet du chantier.\nCompte-rendu et conseils d''entretien.',
  240
),
(
  '{urgence}',
  'Intervention en urgence : sécurisation, diagnostic rapide, réparation provisoire ou définitive.',
  E'Déplacement en urgence et sécurisation immédiate.\nDiagnostic rapide de la situation.\nRéparation provisoire ou définitive selon la situation.\nTests de contrôle et remise en service.\nNettoyage de la zone.',
  E'Déplacement prioritaire en urgence avec intervention rapide.\nSécurisation immédiate : coupure d''eau si nécessaire, protection des biens.\nDiagnostic rapide et précis de la situation.\nRéparation provisoire sécurisée ou définitive selon les possibilités techniques.\nTests de contrôle complets avant remise en service.\nNettoyage et remise en état de la zone d''intervention.\nCompte-rendu détaillé et devis complémentaire si travaux définitifs nécessaires.',
  45
);

-- =============================================
-- SEED: Problem Taxonomy (10 categories + sub-problems)
-- =============================================

-- Category 1: Fuites
WITH cat AS (INSERT INTO public.problem_taxonomy (label, keywords, sort_order) VALUES ('Fuites', '{fuite,eau,goutte,suintement,infiltration}', 1) RETURNING id)
INSERT INTO public.problem_taxonomy (parent_id, label, keywords, default_context, sort_order) VALUES
(( SELECT id FROM cat), 'Fuite visible (goutte à goutte, suintement)', '{goutte,suintement,visible}', '{"type":"recherche_fuite"}', 1),
(( SELECT id FROM cat), 'Fuite encastrée / invisible', '{encastree,invisible,mur,dalle}', '{"type":"recherche_fuite"}', 2),
(( SELECT id FROM cat), 'Fuite sous évier / lavabo / vasque', '{evier,lavabo,vasque,sous}', '{"type":"recherche_fuite"}', 3),
(( SELECT id FROM cat), 'Fuite WC (réservoir, cuvette, arrivée)', '{wc,toilette,reservoir,cuvette}', '{"type":"recherche_fuite"}', 4),
(( SELECT id FROM cat), 'Fuite douche / baignoire / siphon', '{douche,baignoire,siphon}', '{"type":"recherche_fuite"}', 5),
(( SELECT id FROM cat), 'Fuite chauffe-eau / ballon', '{chauffe-eau,ballon,cumulus}', '{"type":"recherche_fuite"}', 6),
(( SELECT id FROM cat), 'Fuite radiateur / chauffage', '{radiateur,chauffage}', '{"type":"recherche_fuite"}', 7),
(( SELECT id FROM cat), 'Fuite vanne / robinet d''arrêt', '{vanne,robinet,arret}', '{"type":"recherche_fuite"}', 8),
(( SELECT id FROM cat), 'Fuite raccord (PER / multicouche / cuivre)', '{raccord,per,multicouche,cuivre}', '{"type":"recherche_fuite"}', 9),
(( SELECT id FROM cat), 'Fuite colonne / alimentation générale', '{colonne,alimentation,generale}', '{"type":"recherche_fuite"}', 10),
(( SELECT id FROM cat), 'Infiltration / humidité / plafond', '{infiltration,humidite,plafond}', '{"type":"recherche_fuite"}', 11),
(( SELECT id FROM cat), 'Autre / à préciser', '{autre}', '{}', 99);

-- Category 2: WC
WITH cat AS (INSERT INTO public.problem_taxonomy (label, keywords, sort_order) VALUES ('WC', '{wc,toilette,toilettes,chasse}', 2) RETURNING id)
INSERT INTO public.problem_taxonomy (parent_id, label, keywords, default_context, sort_order) VALUES
((SELECT id FROM cat), 'WC bouché', '{bouche,obstrue,debouchage}', '{"type":"debouchage"}', 1),
((SELECT id FROM cat), 'WC qui fuit', '{fuite,fuit,eau}', '{"type":"recherche_fuite"}', 2),
((SELECT id FROM cat), 'Chasse d''eau HS / faible / continue', '{chasse,faible,continue,hs}', '{"type":"depannage"}', 3),
((SELECT id FROM cat), 'Mécanisme / flotteur à remplacer', '{mecanisme,flotteur,remplacer}', '{"type":"remplacement"}', 4),
((SELECT id FROM cat), 'Cuvette fissurée / instable', '{cuvette,fissuree,instable}', '{"type":"remplacement"}', 5),
((SELECT id FROM cat), 'WC suspendu (bâti-support / plaque / fixation)', '{suspendu,bati,support,plaque}', '{"type":"remplacement"}', 6),
((SELECT id FROM cat), 'Remplacement WC complet', '{remplacement,complet}', '{"type":"remplacement"}', 7),
((SELECT id FROM cat), 'Odeurs WC / remontées', '{odeur,odeurs,remontees}', '{"type":"depannage"}', 8),
((SELECT id FROM cat), 'Autre / à préciser', '{autre}', '{}', 99);

-- Category 3: Évier / Lavabo / Vasque
WITH cat AS (INSERT INTO public.problem_taxonomy (label, keywords, sort_order) VALUES ('Évier / Lavabo / Vasque', '{evier,lavabo,vasque}', 3) RETURNING id)
INSERT INTO public.problem_taxonomy (parent_id, label, keywords, default_context, sort_order) VALUES
((SELECT id FROM cat), 'Bouchon / évacuation lente', '{bouchon,evacuation,lente,bouche}', '{"type":"debouchage"}', 1),
((SELECT id FROM cat), 'Fuite siphon / bonde', '{fuite,siphon,bonde}', '{"type":"depannage"}', 2),
((SELECT id FROM cat), 'Mitigeur / robinet qui fuit', '{mitigeur,robinet,fuite}', '{"type":"depannage"}', 3),
((SELECT id FROM cat), 'Robinet cassé / dur / débit faible', '{robinet,casse,dur,debit}', '{"type":"remplacement"}', 4),
((SELECT id FROM cat), 'Remplacement évier / lavabo', '{remplacement,evier,lavabo}', '{"type":"remplacement"}', 5),
((SELECT id FROM cat), 'Autre / à préciser', '{autre}', '{}', 99);

-- Category 4: Douche / Baignoire
WITH cat AS (INSERT INTO public.problem_taxonomy (label, keywords, sort_order) VALUES ('Douche / Baignoire', '{douche,baignoire}', 4) RETURNING id)
INSERT INTO public.problem_taxonomy (parent_id, label, keywords, default_context, sort_order) VALUES
((SELECT id FROM cat), 'Évacuation bouchée / lente', '{evacuation,bouchee,lente}', '{"type":"debouchage"}', 1),
((SELECT id FROM cat), 'Fuite siphon / bonde', '{fuite,siphon,bonde}', '{"type":"depannage"}', 2),
((SELECT id FROM cat), 'Fuite mitigeur / colonne', '{fuite,mitigeur,colonne}', '{"type":"depannage"}', 3),
((SELECT id FROM cat), 'Problème de pression / température instable', '{pression,temperature,instable}', '{"type":"depannage"}', 4),
((SELECT id FROM cat), 'Remplacement mitigeur / colonne / flexible / pommeau', '{remplacement,mitigeur,colonne,flexible,pommeau}', '{"type":"remplacement"}', 5),
((SELECT id FROM cat), 'Joint silicone / étanchéité périphérique', '{joint,silicone,etancheite}', '{"type":"depannage"}', 6),
((SELECT id FROM cat), 'Autre / à préciser', '{autre}', '{}', 99);

-- Category 5: Robinets / Pression / Débit / Bruits
WITH cat AS (INSERT INTO public.problem_taxonomy (label, keywords, sort_order) VALUES ('Robinets / Pression / Débit / Bruits', '{robinet,pression,debit,bruit}', 5) RETURNING id)
INSERT INTO public.problem_taxonomy (parent_id, label, keywords, default_context, sort_order) VALUES
((SELECT id FROM cat), 'Baisse de pression générale', '{pression,baisse,generale}', '{"type":"depannage"}', 1),
((SELECT id FROM cat), 'Pression trop forte', '{pression,forte}', '{"type":"depannage"}', 2),
((SELECT id FROM cat), 'Coup de bélier / bruits tuyaux', '{belier,bruit,tuyaux}', '{"type":"depannage"}', 3),
((SELECT id FROM cat), 'Débit faible sur un point d''eau', '{debit,faible}', '{"type":"depannage"}', 4),
((SELECT id FROM cat), 'Filtre / mousseur bouché', '{filtre,mousseur,bouche}', '{"type":"depannage"}', 5),
((SELECT id FROM cat), 'Réducteur de pression HS', '{reducteur,pression,hs}', '{"type":"remplacement"}', 6),
((SELECT id FROM cat), 'Autre / à préciser', '{autre}', '{}', 99);

-- Category 6: Chauffe-eau / Eau chaude sanitaire
WITH cat AS (INSERT INTO public.problem_taxonomy (label, keywords, sort_order) VALUES ('Chauffe-eau / ECS', '{chauffe-eau,ballon,cumulus,eau chaude,ecs}', 6) RETURNING id)
INSERT INTO public.problem_taxonomy (parent_id, label, keywords, default_context, sort_order) VALUES
((SELECT id FROM cat), 'Plus d''eau chaude', '{plus,eau,chaude}', '{"type":"depannage"}', 1),
((SELECT id FROM cat), 'Eau tiède', '{tiede,eau}', '{"type":"depannage"}', 2),
((SELECT id FROM cat), 'Disjonction / panne électrique', '{disjonction,panne,electrique}', '{"type":"depannage"}', 3),
((SELECT id FROM cat), 'Groupe de sécurité fuit / goutte', '{groupe,securite,fuit,goutte}', '{"type":"depannage"}', 4),
((SELECT id FROM cat), 'Entartrage / bruit ballon', '{entartrage,bruit,tartre}', '{"type":"depannage"}', 5),
((SELECT id FROM cat), 'Fuite ballon', '{fuite,ballon}', '{"type":"recherche_fuite"}', 6),
((SELECT id FROM cat), 'Remplacement ballon (élec / thermo)', '{remplacement,ballon,electrique,thermodynamique}', '{"type":"remplacement"}', 7),
((SELECT id FROM cat), 'Thermostat / résistance / anode', '{thermostat,resistance,anode}', '{"type":"remplacement"}', 8),
((SELECT id FROM cat), 'Autre / à préciser', '{autre}', '{}', 99);

-- Category 7: Chauffage
WITH cat AS (INSERT INTO public.problem_taxonomy (label, keywords, sort_order) VALUES ('Chauffage', '{chauffage,radiateur,chaudiere}', 7) RETURNING id)
INSERT INTO public.problem_taxonomy (parent_id, label, keywords, default_context, sort_order) VALUES
((SELECT id FROM cat), 'Radiateur ne chauffe pas', '{radiateur,chauffe,pas}', '{"type":"depannage"}', 1),
((SELECT id FROM cat), 'Purge / air dans circuit', '{purge,air,circuit}', '{"type":"depannage"}', 2),
((SELECT id FROM cat), 'Fuite radiateur', '{fuite,radiateur}', '{"type":"depannage"}', 3),
((SELECT id FROM cat), 'Pression chaudière instable', '{pression,chaudiere,instable}', '{"type":"depannage"}', 4),
((SELECT id FROM cat), 'Remplacement robinet thermostatique', '{robinet,thermostatique,remplacement}', '{"type":"remplacement"}', 5),
((SELECT id FROM cat), 'Autre / à préciser', '{autre}', '{}', 99);

-- Category 8: Canalisations / Réseaux
WITH cat AS (INSERT INTO public.problem_taxonomy (label, keywords, sort_order) VALUES ('Canalisations / Réseaux', '{canalisation,reseau,tuyau,tuyaux}', 8) RETURNING id)
INSERT INTO public.problem_taxonomy (parent_id, label, keywords, default_context, sort_order) VALUES
((SELECT id FROM cat), 'Remplacement section de tuyau', '{remplacement,tuyau,section}', '{"type":"remplacement"}', 1),
((SELECT id FROM cat), 'Création arrivée d''eau', '{creation,arrivee,eau}', '{"type":"installation"}', 2),
((SELECT id FROM cat), 'Création évacuation', '{creation,evacuation}', '{"type":"installation"}', 3),
((SELECT id FROM cat), 'Réseau encastré / rénovation', '{encastre,renovation,reseau}', '{"type":"renovation"}', 4),
((SELECT id FROM cat), 'Gel / tuyau éclaté', '{gel,eclate,tuyau}', '{"type":"urgence"}', 5),
((SELECT id FROM cat), 'Autre / à préciser', '{autre}', '{}', 99);

-- Category 9: Égouts / Odeurs / Remontées
WITH cat AS (INSERT INTO public.problem_taxonomy (label, keywords, sort_order) VALUES ('Égouts / Odeurs / Remontées', '{egout,odeur,remontee,eaux usees}', 9) RETURNING id)
INSERT INTO public.problem_taxonomy (parent_id, label, keywords, default_context, sort_order) VALUES
((SELECT id FROM cat), 'Odeurs siphon / évier / douche', '{odeur,siphon,evier,douche}', '{"type":"depannage"}', 1),
((SELECT id FROM cat), 'Remontées d''eaux usées', '{remontees,eaux,usees}', '{"type":"urgence"}', 2),
((SELECT id FROM cat), 'Colonne bouchée', '{colonne,bouchee}', '{"type":"debouchage"}', 3),
((SELECT id FROM cat), 'Ventilation / mise à l''air', '{ventilation,mise,air}', '{"type":"depannage"}', 4),
((SELECT id FROM cat), 'Autre / à préciser', '{autre}', '{}', 99);

-- Category 10: Extérieur / Divers
WITH cat AS (INSERT INTO public.problem_taxonomy (label, keywords, sort_order) VALUES ('Extérieur / Divers', '{exterieur,robinet,jardin,divers}', 10) RETURNING id)
INSERT INTO public.problem_taxonomy (parent_id, label, keywords, default_context, sort_order) VALUES
((SELECT id FROM cat), 'Robinet extérieur (fuite / gel)', '{robinet,exterieur,fuite,gel}', '{"type":"depannage"}', 1),
((SELECT id FROM cat), 'Arrosage / réseau extérieur', '{arrosage,reseau,exterieur}', '{"type":"installation"}', 2),
((SELECT id FROM cat), 'Local technique / garage', '{local,technique,garage}', '{"type":"depannage"}', 3),
((SELECT id FROM cat), 'Autre / à préciser', '{autre}', '{}', 99);
