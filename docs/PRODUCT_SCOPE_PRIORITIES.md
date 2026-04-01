# Cadrage produit

## Objectif

Réduire la dispersion du produit pour concentrer l'effort de développement, de test et de support sur le coeur métier réellement différenciant.

## Noyau prioritaire

Le noyau produit à préserver et prioriser dans la roadmap est :

- gestion des CV et parsing
- analyse, amélioration et adaptation de CV
- matching profil / mission
- gestion des missions
- pipeline de soumission candidat
- gestion minimale des clients et des firmes nécessaires au matching

Ces domaines doivent rester les premiers servis pour :

- les arbitrages fonctionnels
- les tests automatisés
- les migrations de schéma
- les améliorations de performance
- la documentation utilisateur

## Capacités de support à maintenir

Ces modules restent importants, mais comme capacités de support du noyau produit :

- authentification, 2FA et sécurité de session
- OCR et extraction documentaire
- templates de documents
- export PDF / DOCX
- observabilité, santé, métriques et APM
- backup et restauration

Leur objectif n'est pas d'élargir le périmètre métier, mais de rendre le noyau plus fiable et exploitable.

## Périmètre secondaire

Ces domaines apportent de la valeur, mais doivent être traités comme extensions et non comme centre du produit :

- radar marché
- collecte de tendances
- référentiels ROME avancés
- deals
- commentaires génériques
- partage public
- audit GDPR et consentement avancé
- intégrations mail élargies

Règle de décision :

- aucune nouvelle feature secondaire ne doit bloquer une évolution du noyau prioritaire
- tout travail sur un module secondaire doit avoir un propriétaire explicite et un budget de maintenance identifié
- les dépendances croisées entre noyau et modules secondaires doivent être minimisées

## Critères d'arbitrage

Avant d'ajouter une nouvelle fonctionnalité, la question à trancher est :

1. améliore-t-elle directement le cycle CV -> analyse -> matching -> soumission ?
2. réduit-elle un risque opérationnel ou réglementaire sur ce cycle ?
3. évite-t-elle une charge de support significative ?

Si la réponse est non à ces trois questions, la fonctionnalité doit être classée en secondaire ou reportée.

## Conséquences techniques

Les prochains refactors doivent suivre ce cadrage :

- isoler les modules secondaires derrière des services ou routes dédiés
- éviter d'étendre les schémas de validation centraux pour des besoins périphériques
- privilégier des pages et composants dédiés plutôt que d'alourdir les écrans coeur métier
- maintenir une couverture de tests plus forte sur le noyau prioritaire que sur les extensions

## Ordre recommandé

1. stabiliser en continu le noyau CV / matching / missions
2. finir la réduction des gros composants et fichiers de configuration restants
3. renforcer encore les flux sensibles auth, backup, exports et GDPR
4. seulement ensuite reprendre les modules secondaires avec objectifs business explicites