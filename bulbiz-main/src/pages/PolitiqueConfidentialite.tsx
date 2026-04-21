import LegalPageLayout from "@/components/LegalPageLayout";

const PolitiqueConfidentialite = () => (
  <LegalPageLayout title="Politique de confidentialité – Bulbiz">
    <h2>1. Introduction</h2>
    <p>
      La présente politique de confidentialité explique comment <strong>LA RUCHE (BULBIZ)</strong> ("nous") collecte,
      utilise, conserve et protège vos données personnelles lorsque vous utilisez le site <strong>bulbiz.io</strong> et
      l'application <strong>app.bulbiz.io</strong>, ainsi que les services associés.
    </p>
    <p>En utilisant Bulbiz, vous acceptez les pratiques décrites dans cette politique.</p>

    <h2>2. Responsable de traitement</h2>
    <p>
      <strong>LA RUCHE (BULBIZ)</strong>
      <br />
      2 Rue du Bocage, 69008 Lyon, France
      <br />
      Contact : <a href="mailto:alexandre.p@bulbiz.fr">alexandre.p@bulbiz.fr</a> – <strong>07 61 39 71 63</strong>
    </p>

    <h2>3. Données personnelles traitées</h2>

    <h3>3.1 Données de compte</h3>
    <ul>
      <li>nom, prénom ;</li>
      <li>adresse email ;</li>
      <li>photo de profil (si fournie via un fournisseur d'authentification) ;</li>
      <li>informations nécessaires à la sécurité et à l'authentification.</li>
    </ul>

    <h3>3.2 Données professionnelles</h3>
    <ul>
      <li>informations relatives à votre activité (nom de l'entreprise, SIRET, adresse, etc.) ;</li>
      <li>
        données de gestion enregistrées dans Bulbiz : dossiers, notes, rendez-vous/planning, documents commerciaux
        (devis, factures), pièces jointes et tout autre contenu saisi par l'Utilisateur.
      </li>
    </ul>

    <h3>3.3 Données relatives aux clients/prospects de l'Utilisateur</h3>
    <p>
      Vous pouvez saisir, importer et gérer dans Bulbiz des données relatives à vos propres clients/prospects. Dans ce
      cadre, vous demeurez généralement <strong>responsable de traitement</strong> et Bulbiz agit en{" "}
      <strong>sous-traitant</strong> (voir section 6).
    </p>

    <h3>3.4 Intégrations tierces (optionnelles)</h3>
    <p>
      Si vous activez des intégrations, Bulbiz peut traiter des données techniques nécessaires à leur fonctionnement :
    </p>
    <ul>
      <li>
        <strong>Google / Gmail</strong> : jetons d'accès permettant l'envoi d'emails depuis votre compte. Bulbiz ne
        demande que les autorisations nécessaires à l'envoi et <strong>ne lit pas vos emails</strong>.
      </li>
      <li>
        <strong>Google Calendar</strong> : jetons d'accès permettant la création ou synchronisation d'événements.
      </li>
    </ul>

    <h2>4. Finalités du traitement</h2>
    <p>Vos données sont traitées pour :</p>
    <ul>
      <li>créer et gérer votre Compte ;</li>
      <li>fournir les Services (gestion de dossiers, documents, planning, etc.) ;</li>
      <li>permettre l'utilisation des intégrations optionnelles que vous activez ;</li>
      <li>assurer le support et la relation utilisateur ;</li>
      <li>améliorer et sécuriser les Services ;</li>
      <li>gérer la facturation et la comptabilité lorsque applicable ;</li>
      <li>vous informer des évolutions importantes.</li>
    </ul>

    <h2>5. Bases légales</h2>
    <p>Selon les cas, nous nous fondons sur :</p>
    <ul>
      <li>
        <strong>l'exécution du contrat</strong> : fournir les Services ;
      </li>
      <li>
        <strong>votre consentement</strong> : activer des intégrations optionnelles (ex. Google) ;
      </li>
      <li>
        <strong>notre intérêt légitime</strong> : sécurité, prévention de la fraude, amélioration des Services ;
      </li>
      <li>
        <strong>nos obligations légales</strong> : obligations comptables et fiscales.
      </li>
    </ul>

    <h2>6. Rôles RGPD : responsable / sous-traitant</h2>
    <ul>
      <li>
        Pour les données liées à votre Compte, à la gestion de la relation utilisateur, à la sécurité et à
        l'administration des Services, LA RUCHE agit en <strong>responsable de traitement</strong>.
      </li>
      <li>
        Pour les données que vous importez et gérez concernant vos propres clients/prospects, LA RUCHE agit en{" "}
        <strong>sous-traitant</strong> et l'Utilisateur agit en <strong>responsable de traitement</strong>. Dans ce
        cadre, LA RUCHE traite ces données uniquement sur instruction de l'Utilisateur et conformément à l'
        <a href="/dpa">accord de sous-traitance (DPA)</a>.
      </li>
    </ul>

    <h2>7. Destinataires des données</h2>
    <p>Vos données peuvent être accessibles :</p>
    <ul>
      <li>aux personnes habilitées au sein de LA RUCHE (support, maintenance, sécurité) ;</li>
      <li>
        à nos prestataires intervenant pour le fonctionnement du Service :
        <ul>
          <li>
            <strong>IONOS SARL</strong> (hébergement) ;
          </li>
          <li>
            <strong>Supabase / Lovable</strong> (infrastructure applicative, hébergement en Europe) ;
          </li>
          <li>
            <strong>Resend</strong> (envoi d'emails transactionnels) ;
          </li>
          <li>
            <strong>Google</strong> (uniquement si vous activez les intégrations Gmail et/ou Google Calendar).
          </li>
        </ul>
      </li>
      <li>aux autorités administratives ou judiciaires compétentes si la loi l'exige.</li>
    </ul>
    <p>
      <strong>Nous ne vendons pas vos données personnelles.</strong>
    </p>

    <h3>7.1 Données issues des intégrations Google (Gmail et Google Calendar)</h3>
    <p>
      Lorsque vous activez les intégrations Google (Gmail et/ou Google Calendar), Bulbiz accède à certaines données de
      votre compte Google conformément aux autorisations que vous accordez explicitement. Les règles suivantes
      s'appliquent à ces données :
    </p>
    <ul>
      <li>
        <strong>Utilisation limitée</strong> : les données issues de votre compte Google (jetons d'accès, métadonnées
        nécessaires à l'envoi d'emails ou à la synchronisation d'événements) sont utilisées exclusivement pour faire
        fonctionner les fonctionnalités que vous avez activées.
      </li>
      <li>
        <strong>Absence de transfert à des tiers</strong> : nous ne transférons, ne partageons ni ne divulguons vos
        données Google à des tiers, sauf dans les cas suivants, strictement nécessaires au fonctionnement du Service :
        <ul>
          <li>
            prestataires techniques assurant l'hébergement ou l'infrastructure de Bulbiz (listés ci-dessus), liés par
            des obligations de confidentialité ;
          </li>
          <li>obligations légales imposées par une autorité compétente.</li>
        </ul>
      </li>
      <li>
        <strong>Pas de publicité</strong> : vos données Google ne sont jamais utilisées à des fins publicitaires, ni
        pour personnaliser des publicités.
      </li>
      <li>
        <strong>Pas de lecture de vos emails</strong> : Bulbiz ne lit pas le contenu de vos emails. Les autorisations
        Gmail sont limitées à l'envoi d'emails depuis votre compte, à votre demande explicite.
      </li>
      <li>
        <strong>Révocation</strong> : vous pouvez révoquer l'accès de Bulbiz à votre compte Google à tout moment depuis
        les paramètres de sécurité de votre compte Google ou depuis votre compte Bulbiz. Les jetons d'accès sont
        supprimés dès déconnexion de l'intégration.
      </li>
    </ul>
    <p>
      L'utilisation des données obtenues via les API Google est également soumise à la{" "}
      <a
        href="https://developers.google.com/terms/api-services-user-data-policy"
        target="_blank"
        rel="noopener noreferrer"
      >
        Politique d'utilisation des données des services API Google
      </a>
      , y compris aux exigences d'utilisation limitée (<em>Limited Use</em>).
    </p>

    <h2>8. Transferts hors Union européenne</h2>
    <p>
      Certains prestataires peuvent impliquer des transferts de données hors Union européenne. Lorsque de tels
      transferts existent, nous mettons en place des garanties appropriées, telles que les{" "}
      <strong>clauses contractuelles types</strong> adoptées par la Commission européenne.
    </p>

    <h2>9. Durées de conservation</h2>
    <ul>
      <li>
        <strong>Données de Compte</strong> : conservées pendant la durée d'utilisation des Services, puis archivées de
        manière limitée jusqu'à <strong>3 ans</strong> après suppression ;
      </li>
      <li>
        <strong>Documents commerciaux</strong> : conservés pendant la durée nécessaire et, lorsque applicable, archivés
        conformément aux obligations légales (jusqu'à <strong>10 ans</strong> pour certains documents comptables) ;
      </li>
      <li>
        <strong>Tokens d'intégration (Google, etc.)</strong> : supprimés dès déconnexion de l'intégration ou suppression
        du Compte ;
      </li>
      <li>
        <strong>Journaux techniques et de sécurité</strong> : conservés pour une durée limitée, proportionnée à la
        finalité de sécurité.
      </li>
    </ul>

    <h2>10. Vos droits</h2>
    <p>Conformément au RGPD, vous disposez des droits suivants :</p>
    <ul>
      <li>droit d'accès, de rectification, d'effacement ;</li>
      <li>droit à la limitation du traitement ;</li>
      <li>droit d'opposition ;</li>
      <li>droit à la portabilité ;</li>
      <li>droit de retirer votre consentement à tout moment.</li>
    </ul>
    <p>
      Pour exercer vos droits : <a href="mailto:alexandre.p@bulbiz.fr">alexandre.p@bulbiz.fr</a>.<br />
      Vous pouvez également déposer une réclamation auprès de la <strong>CNIL</strong>.
    </p>
    <p>
      <strong>Important</strong> : pour les données relatives aux clients/prospects que vous gérez dans Bulbiz, ces
      personnes doivent en priorité exercer leurs droits auprès de vous (responsable de traitement). LA RUCHE peut vous
      assister techniquement si nécessaire.
    </p>

    <h2>11. Sécurité</h2>
    <p>
      Nous mettons en œuvre des mesures techniques et organisationnelles appropriées : chiffrement des échanges (HTTPS),
      contrôle d'accès, séparation logique des comptes, restrictions d'accès, sauvegardes, et protection des jetons
      d'intégration (stockage sécurisé, non exposition côté client).
    </p>

    <h2>12. Cookies</h2>
    <p>
      Bulbiz utilise uniquement des cookies <strong>essentiels</strong> au fonctionnement des Services. Pour plus
      d'informations, consultez la <a href="/cookies">Politique cookies</a>.
    </p>

    <h2>13. Modifications de la politique</h2>
    <p>
      Nous pouvons mettre à jour cette politique. En cas de modification substantielle, nous pourrons vous en informer
      par email ou via une notification dans l'application.
    </p>

    <h2>14. Contact</h2>
    <p>
      Pour toute question : <a href="mailto:alexandre.p@bulbiz.fr">alexandre.p@bulbiz.fr</a>.
    </p>
  </LegalPageLayout>
);

export default PolitiqueConfidentialite;
