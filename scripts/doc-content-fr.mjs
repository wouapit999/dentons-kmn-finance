/*
 * Dentons KMN ERP
 * Copyright (c) 2026 Bouquet Innovation SA. All rights reserved.
 * Proprietary and confidential. Unauthorised copying, distribution, modification,
 * or use of this file, via any medium, is strictly prohibited.
 */
// Contenu francais des deux PDF (memes marqueurs que la version anglaise) :
//   #/##/###  titres  |  - puces  |  1. numerote  |  **gras**
//   > encadre  |  @RESULT  ligne Reussi/Echoue  |  [PAGEBREAK]

export const UAT_MD = `
# 1. Introduction

Ce cahier de recette (UAT - User Acceptance Testing) permet au personnel de Dentons KMN de confirmer que chaque module de l'ERP Dentons KMN fonctionne comme prevu, avant et pendant l'utilisation reelle. Chaque test indique le role qui doit l'executer, les etapes a suivre et le resultat attendu. Marquez chaque test **Reussi**, **Echoue** ou **Bloque**, et notez toute difference sur la ligne Notes.

**URL de l'application :** https://dentons-kmn-finance-three.vercel.app

## Comment utiliser ce cahier
- Progressez de haut en bas. Certains tests s'appuient sur des donnees creees par des tests precedents (par exemple, il faut creer un client avant de pouvoir ouvrir un dossier).
- Utilisez le role indique pour chaque test. Si vous ne l'avez pas, demandez a l'administrateur informatique de vous l'attribuer, ou faites appel a un collegue qui l'a.
- Pour chaque test, cochez une case et renseignez les champs Testeur / Date.
- Si un test echoue, decrivez ce qui s'est reellement passe sur la ligne Notes et consignez-le dans le Journal des anomalies a la fin (Section 20).
- Apres un deploiement, actualisez toujours la page avec Ctrl+Maj+R (ou Ctrl+F5) pour tester la derniere version.

## Environnement et comptes de test
> Les comptes ci-dessous existent pour les tests. Changez tous les mots de passe avant l'usage reel. Le mot de passe temporaire remis au personnel migre (Welcome@DKMN2026) doit etre change.

- Administrateur informatique - admin@dentonskmn.local - mot de passe : ChangeMe123!
- Directeur financier (CFO) - cfo@dentonskmn.local - mot de passe : ChangeMe123!
- D'autres comptes ont ete migres depuis les anciens sites et utilisent leurs propres adresses.

## Legende des resultats
- **Reussi** - l'application s'est comportee exactement comme decrit dans le Resultat attendu.
- **Echoue** - le resultat differe ; decrivez-le dans Notes et ouvrez une anomalie.
- **Bloque** - le test n'a pas pu etre execute (donnee manquante, acces manquant, dependance en echec).

[PAGEBREAK]
# 2. Acces, securite et sessions

### UAT-SEC-01 - Se connecter avec des identifiants valides
**Role :** Tout utilisateur. **Priorite :** Haute.
**Etapes :**
1. Ouvrir l'URL de l'application.
2. Saisir votre e-mail et votre mot de passe.
3. Cliquer sur Se connecter.
**Resultat attendu :** Vous arrivez sur le Tableau de bord et voyez, dans le menu de gauche, uniquement les rubriques autorisees par votre role.
@RESULT

### UAT-SEC-02 - Se connecter avec un mauvais mot de passe
**Role :** Tout utilisateur.
**Etapes :**
1. Saisir un e-mail valide et un mot de passe incorrect. 2. Cliquer sur Se connecter.
**Resultat attendu :** Une erreur claire s'affiche et vous n'etes pas connecte. Des echecs repetes verrouillent temporairement le compte.
@RESULT

### UAT-SEC-03 - Changer votre propre mot de passe
**Role :** Tout utilisateur.
**Etapes :**
1. Ouvrir Securite. 2. Utiliser Changer le mot de passe. 3. Saisir le mot de passe actuel et un nouveau d'au moins 12 caracteres avec majuscule, minuscule, chiffre et symbole.
**Resultat attendu :** Le mot de passe est accepte. Un mot de passe faible, deja utilise ou compromis est refuse avec un motif.
@RESULT

### UAT-SEC-04 - Activer l'authentification a deux facteurs (2FA)
**Role :** Tout utilisateur.
**Etapes :**
1. Securite -> activer 2FA. 2. Scanner la cle dans une application d'authentification (Google Authenticator, Microsoft Authenticator, etc.). 3. Saisir le code a 6 chiffres pour confirmer.
**Resultat attendu :** La 2FA est activee. A la connexion suivante, un code est demande apres le mot de passe.
@RESULT

### UAT-SEC-05 - Consulter et fermer les sessions actives
**Role :** Tout utilisateur.
**Etapes :**
1. Securite -> voir les sessions actives / l'historique de connexion. 2. Fermer une session autre que la session courante.
**Resultat attendu :** La liste des sessions et l'historique s'affichent ; fermer une session la revoque.
@RESULT

[PAGEBREAK]
# 3. Utilisateurs, roles et administration

### UAT-ADM-01 - Creer un nouvel utilisateur
**Role :** Administrateur informatique. **Priorite :** Haute.
**Etapes :**
1. Ouvrir Utilisateurs. 2. Cliquer + Nouvel utilisateur. 3. Saisir nom, e-mail et attribuer un ou plusieurs roles. 4. Enregistrer.
**Resultat attendu :** L'utilisateur est cree et apparait dans la liste. L'action est consignee dans le journal d'audit.
@RESULT

### UAT-ADM-02 - Ajouter et retirer un role a un utilisateur
**Role :** Administrateur informatique.
**Etapes :**
1. Utilisateurs -> ouvrir un utilisateur -> Modifier les roles. 2. Ajouter un role, enregistrer. 3. Retirer un role, enregistrer.
**Resultat attendu :** Les changements prennent effet ; les menus visibles par l'utilisateur changent au chargement suivant.
@RESULT

### UAT-ADM-03 - Reinitialiser un mot de passe / forcer le changement
**Role :** Administrateur informatique.
**Etapes :**
1. Ouvrir la Gestion des mots de passe (administration Securite). 2. Reinitialiser le mot de passe d'un utilisateur et/ou activer Forcer le changement a la prochaine connexion.
**Resultat attendu :** L'utilisateur doit definir un nouveau mot de passe a la prochaine connexion. L'action est auditee.
@RESULT

### UAT-ADM-04 - Verrouiller et deverrouiller un compte
**Role :** Administrateur informatique.
**Etapes :**
1. Gestion des mots de passe -> verrouiller un compte. 2. Confirmer que l'utilisateur ne peut pas se connecter. 3. Deverrouiller.
**Resultat attendu :** L'utilisateur verrouille est bloque jusqu'au deverrouillage.
@RESULT

### UAT-ADM-05 - Les roles sont une reference en lecture seule
**Role :** Administrateur informatique.
**Etapes :** 1. Ouvrir Roles et passer en revue les 13 roles systeme et leurs permissions.
**Resultat attendu :** La liste des roles et de leurs permissions s'affiche.
@RESULT

### UAT-ADM-06 - Ajouter la cle IA Anthropic
**Role :** Administrateur informatique.
**Etapes :** 1. Ouvrir Assistant IA -> Parametres IA. 2. Coller la cle API Anthropic et enregistrer.
**Resultat attendu :** La cle est stockee (chiffree) et les fonctions IA (Assistant, OCR, Pinto) deviennent disponibles.
@RESULT

[PAGEBREAK]
# 4. Clients, KYC et conflits

### UAT-CLI-01 - Creer un client avec l'assistant de saisie
**Role :** Avocat / Associe / CFO (droits de gestion client). **Priorite :** Haute.
**Etapes :**
1. Ouvrir Clients -> + Nouveau client. 2. Etape 1 : type, nom, numero d'identification/immatriculation et identifiant fiscal. 3. Etape 2 : contact, adresse, type de dossier, avocat assigne, risque LBC. 4. Etape 3 : joindre un document (PDF/DOCX/JPG/PNG) et cliquer Creer.
**Resultat attendu :** Le client est cree avec un numero unique de la forme CL-AAAA-NNNNN et apparait dans la liste.
@RESULT

### UAT-CLI-02 - Lancer une verification de conflit
**Role :** Droits de gestion client.
**Etapes :** 1. Ouvrir la fiche client. 2. Lancer la verification de conflit et repondre au questionnaire. 3. Soumettre.
**Resultat attendu :** Un rapport de conflit est enregistre. Toute reponse "oui" ou un homonyme marque le client POTENTIEL (revue par un associe requise).
@RESULT

### UAT-CLI-03 - Verifier le KYC (analyse IA)
**Role :** Droits de gestion client. Necessite la cle IA.
**Etapes :** 1. Ouvrir la fiche client. 2. Cliquer Verifier KYC.
**Resultat attendu :** Une analyse Internet s'execute et depose un rapport KYC avec une note de risque ; le client devient VERIFIE sauf risque ELEVE.
@RESULT

### UAT-CLI-04 - Stocker et consulter des documents client
**Role :** L'avocat ecrit ; les autres roles lisent seulement.
**Etapes :** 1. Ouvrir la fiche client -> Documents. 2. En tant qu'avocat, televerser un document. 3. En tant que non-avocat, confirmer la lecture sans possibilite de televerser.
**Resultat attendu :** Les avocats peuvent ajouter des documents ; les roles en lecture seule les consultent sans bouton d'ajout.
@RESULT

### UAT-CLI-05 - Vue portefeuille
**Role :** Lecture client.
**Etapes :** 1. Ouvrir la fiche client et consulter les totaux de facturation, dossiers, factures et solde de fiducie.
**Resultat attendu :** Les chiffres du portefeuille s'affichent et concordent avec les enregistrements du client.
@RESULT

[PAGEBREAK]
# 5. Dossiers (matters)

### UAT-MAT-01 - Ouvrir un dossier pour un client verifie
**Role :** Associe / CFO (gestion des dossiers). **Priorite :** Haute.
**Etapes :**
1. Ouvrir Dossiers -> + Ouvrir un dossier. 2. Selectionner un client verifie KYC. 3. Laisser le Code attribue automatiquement, saisir le nom du dossier, choisir le domaine de pratique et l'associe responsable. 4. Cliquer Creer.
**Resultat attendu :** Le dossier est cree avec un code automatique (M-AAAA-NNNNN) et apparait dans la liste.
@RESULT

### UAT-MAT-02 - Les clients ineligibles sont affiches mais bloques
**Role :** Gestion des dossiers.
**Etapes :** 1. Ouvrir + Ouvrir un dossier. 2. Regarder la liste des clients.
**Resultat attendu :** Les clients en attente de KYC ou bloques pour conflit apparaissent grises avec le motif ; seuls les clients verifies sont selectionnables.
@RESULT

### UAT-MAT-03 - Le code du dossier est attribue automatiquement
**Role :** Gestion des dossiers.
**Etapes :** 1. Ouvrir + Ouvrir un dossier et regarder le champ Code.
**Resultat attendu :** Le Code est en lecture seule, pre-rempli avec le prochain code libre ; impossible de saisir un doublon.
@RESULT

### UAT-MAT-04 - Cloturer un dossier
**Role :** Gestion des dossiers.
**Etapes :** 1. Dans le tableau des dossiers, cliquer Cloturer sur un dossier ouvert.
**Resultat attendu :** Le statut passe a CLOTURE. Le changement est audite.
@RESULT

### UAT-MAT-05 - Supprimer un dossier sans activite
**Role :** Gestion des dossiers.
**Etapes :** 1. Creer un dossier jetable. 2. Cliquer Supprimer et confirmer.
**Resultat attendu :** Un dossier sans temps, debours, factures ni taches est supprime. Un dossier ayant de l'activite est refuse avec un message invitant a le cloturer.
@RESULT

[PAGEBREAK]
# 6. Temps et debours

### UAT-TIM-01 - Saisir du temps facturable
**Role :** Avocat / Associe (time:log). **Priorite :** Haute.
**Etapes :** 1. Ouvrir Saisie des temps. 2. Choisir un dossier, un intervenant, la date, les minutes et le taux ; facturable = Oui ; ajouter un libelle. 3. Soumettre.
**Resultat attendu :** L'ecriture est enregistree et sa valeur egale minutes / 60 x taux ; le recapitulatif facturable se met a jour.
@RESULT

### UAT-TIM-02 - Un role en lecture seule ne peut pas saisir de temps
**Role :** Un role sans time:log (ex. Auditeur).
**Etapes :** 1. Ouvrir Saisie des temps.
**Resultat attendu :** Le formulaire de saisie n'apparait pas ; seule la liste est visible.
@RESULT

### UAT-DIS-01 - Enregistrer un debours
**Role :** disbursement:log.
**Etapes :** 1. Ouvrir Debours. 2. Choisir un dossier, saisir la description, le montant, le fournisseur, l'indicateur facturable. 3. Soumettre.
**Resultat attendu :** Le debours est enregistre et inclus dans le total facturable.
@RESULT

[PAGEBREAK]
# 7. Facturation et comptes clients

### UAT-BIL-01 - Creer une facture brouillon
**Role :** Charge de finances / Responsable financier / CFO (invoice:create). **Priorite :** Haute.
**Etapes :**
1. Ouvrir Facturation -> + Nouvelle facture. 2. Selectionner un dossier. 3. Cocher les temps et debours non factures a inclure. 4. Definir la TVA (19,25%) et une eventuelle retenue a la source. 5. Cliquer Creer.
**Resultat attendu :** Une facture BROUILLON est creee ; les totaux concordent (sous-total + TVA - retenue) ; les elements factures sont verrouilles.
@RESULT

### UAT-BIL-02 - Comptabiliser une facture au grand livre
**Role :** invoice:approve.
**Etapes :** 1. Dans la liste, cliquer Comptabiliser (Post to GL) sur un brouillon.
**Resultat attendu :** Une ecriture equilibree est passee ; la facture devient COMPTABILISEE et la balance reste equilibree.
@RESULT

### UAT-BIL-03 - Enregistrer un encaissement
**Role :** payment:create.
**Etapes :** 1. Sur une facture comptabilisee, cliquer Encaissement. 2. Saisir montant, mode (banque/especes/cheque/virement/mobile) et reference. 3. Enregistrer.
**Resultat attendu :** Le paiement est passe ; la facture passe a PARTIELLEMENT PAYEE ou PAYEE ; le solde du a jour.
@RESULT

### UAT-BIL-04 - Le trop-percu est bloque (test negatif)
**Role :** payment:create.
**Etapes :** 1. Sur une facture comptabilisee, saisir un encaissement superieur au solde du. 2. Enregistrer.
**Resultat attendu :** Le systeme refuse l'encaissement avec une erreur ; aucun paiement n'est enregistre.
@RESULT

### UAT-BIL-05 - Actions masquees sans droits (test negatif)
**Role :** Un role en lecture seule (ex. Auditeur).
**Etapes :** 1. Ouvrir Facturation.
**Resultat attendu :** Aucun bouton + Nouvelle facture, Comptabiliser ou Encaissement n'apparait ; la page ne plante pas.
@RESULT

[PAGEBREAK]
# 8. Comptes de fiducie (trust)

### UAT-TRU-01 - Ouvrir un compte de fiducie
**Role :** trust:manage. **Priorite :** Haute.
**Etapes :** 1. Ouvrir Comptes de fiducie -> + Ouvrir un compte. 2. Choisir un client. 3. Creer.
**Resultat attendu :** Un compte de fiducie est cree pour le client.
@RESULT

### UAT-TRU-02 - Depot et paiement depuis la fiducie
**Role :** trust:manage.
**Etapes :** 1. Ouvrir le compte. 2. Enregistrer un Depot, puis un Paiement.
**Resultat attendu :** Les soldes se mettent a jour ; chaque mouvement est comptabilise.
@RESULT

### UAT-TRU-03 - Le solde de fiducie ne peut pas devenir negatif (test negatif)
**Role :** trust:manage.
**Etapes :** 1. Tenter un Paiement superieur au solde de fiducie.
**Resultat attendu :** Le retrait est refuse ; le solde ne descend jamais sous zero.
@RESULT

### UAT-TRU-04 - Affecter des fonds de fiducie a une facture
**Role :** trust:manage.
**Etapes :** 1. Dans le compte, choisir Affecter a une facture et selectionner une facture ouverte.
**Resultat attendu :** Une ecriture equilibree solde la facture ; la facture avance vers PAYEE et la balance concorde.
@RESULT

[PAGEBREAK]
# 9. Comptes fournisseurs

### UAT-AP-01 - Ajouter un fournisseur
**Role :** ap:manage.
**Etapes :** 1. Ouvrir Fournisseurs -> + Nouveau fournisseur. 2. Saisir les informations et enregistrer.
**Resultat attendu :** Le fournisseur est cree et selectionnable lors de la creation de factures fournisseur.
@RESULT

### UAT-AP-02 - Creer et comptabiliser une facture fournisseur
**Role :** ap:manage (creation), ap:approve (comptabilisation).
**Etapes :** 1. Ouvrir Factures fournisseurs -> + Nouvelle facture. 2. Choisir un fournisseur, un compte de charge et un montant avec TVA deductible. 3. Creer, puis Comptabiliser.
**Resultat attendu :** La facture passe une ecriture equilibree (charge + TVA deductible = fournisseurs).
@RESULT

### UAT-AP-03 - Payer une facture et bloquer le trop-paye (test negatif)
**Role :** ap:approve.
**Etapes :** 1. Payer integralement une facture comptabilisee. 2. Tenter un nouveau paiement au-dela du solde.
**Resultat attendu :** Le premier paiement reussit (partiel -> paye) ; le trop-paye est refuse.
@RESULT

[PAGEBREAK]
# 10. Caisse et banque

### UAT-CSH-01 - Creer une caisse et un mouvement
**Role :** cash:manage.
**Etapes :** 1. Ouvrir Caisse -> + Nouveau. 2. Enregistrer une entree puis une sortie (choisir le compte de contrepartie).
**Resultat attendu :** Le solde se met a jour ; un decouvert est refuse (garde-fou de solde non negatif).
@RESULT

### UAT-BNK-01 - Creer un compte bancaire et une operation
**Role :** bank:manage.
**Etapes :** 1. Ouvrir Banque -> + Nouveau. 2. Enregistrer des frais et une operation d'interet/virement.
**Resultat attendu :** Le solde comptable se met a jour correctement et chaque operation est comptabilisee.
@RESULT

### UAT-BNK-02 - Rapprocher un compte bancaire
**Role :** bank:reconcile.
**Etapes :** 1. Ouvrir un compte bancaire -> Rapprochement. 2. Cocher les elements pointes.
**Resultat attendu :** Les montants comptable / pointe / non rapproche evoluent au fur et a mesure.
@RESULT

[PAGEBREAK]
# 11. Achats (procurement)

### UAT-PRO-01 - Emettre une demande d'achat
**Role :** procure:request.
**Etapes :** 1. Ouvrir Achats -> + Nouvelle demande. 2. Saisir les details et soumettre.
**Resultat attendu :** La demande est creee et en attente d'approbation.
@RESULT

### UAT-PRO-02 - Separation des taches (test negatif)
**Role :** Le demandeur.
**Etapes :** 1. Tenter d'approuver votre propre demande d'achat.
**Resultat attendu :** L'auto-approbation est refusee (un demandeur ne peut pas approuver sa propre demande).
@RESULT

### UAT-PRO-03 - Approuver et emettre un bon de commande
**Role :** procure:approve.
**Etapes :** 1. Approuver la demande d'un collegue ; emettre le bon de commande.
**Resultat attendu :** La demande est approuvee et un bon de commande est emis.
@RESULT

[PAGEBREAK]
# 12. Immobilisations

### UAT-FA-01 - Enregistrer une immobilisation
**Role :** asset:manage.
**Etapes :** 1. Ouvrir Immobilisations -> + Nouveau. 2. Saisir cout, valeur residuelle, duree de vie et compte d'immobilisation. 3. Creer.
**Resultat attendu :** L'immobilisation est enregistree avec les bonnes valeurs d'ouverture.
@RESULT

### UAT-FA-02 - Executer l'amortissement
**Role :** asset:post.
**Etapes :** 1. Cliquer Amortir et choisir la periode.
**Resultat attendu :** Une ecriture lineaire est passee (dotation aux amortissements = amortissements cumules) et s'arrete a cout moins valeur residuelle.
@RESULT

### UAT-FA-03 - Ceder une immobilisation
**Role :** asset:manage.
**Etapes :** 1. Choisir Ceder et saisir le produit de cession.
**Resultat attendu :** La plus ou moins-value est reconnue ; la balance concorde apres cession.
@RESULT

[PAGEBREAK]
# 13. Budgets

### UAT-BUD-01 - Creer un budget annuel
**Role :** budget:manage.
**Etapes :** 1. Ouvrir Budgets -> + Nouveau. 2. Ajouter des lignes de compte avec les montants annuels. 3. Creer.
**Resultat attendu :** Le budget est enregistre avec ses lignes de compte.
@RESULT

### UAT-BUD-02 - Consulter l'ecart budget / realise
**Role :** budget:read.
**Etapes :** 1. Ouvrir un budget -> Voir.
**Resultat attendu :** Les realises proviennent des ecritures comptabilisees ; l'ecart favorable/defavorable et le % utilise s'affichent par compte.
@RESULT

[PAGEBREAK]
# 14. Paie et fiscalite camerounaise

### UAT-PAY-01 - Ajouter un employe
**Role :** payroll:manage.
**Etapes :** 1. Ouvrir Employes -> + Nouveau. 2. Saisir les informations et enregistrer.
**Resultat attendu :** L'employe est ajoute et disponible pour les traitements de paie.
@RESULT

### UAT-PAY-02 - Creer un traitement de paie
**Role :** payroll:manage. **Priorite :** Haute.
**Etapes :** 1. Ouvrir Paie -> creer un traitement pour une periode.
**Resultat attendu :** Un bulletin est calcule par employe avec CNPS, IRPP/PAYE, CAC, CRTV/RAV, Credit Foncier et FNE ; les totaux du traitement s'affichent.
@RESULT

### UAT-PAY-03 - Comptabiliser le journal de paie
**Role :** payroll:post.
**Etapes :** 1. Comptabiliser le traitement au grand livre. 2. Tenter de comptabiliser deux fois le meme traitement (negatif).
**Resultat attendu :** Une ecriture equilibree est passee ; une seconde comptabilisation du meme traitement est refusee.
@RESULT

[PAGEBREAK]
# 15. Grand livre

### UAT-GL-01 - Creer un compte du grand livre
**Role :** gl:manage.
**Etapes :** 1. Ouvrir Plan comptable -> + Nouveau compte. 2. Saisir code, nom et type. 3. Creer.
**Resultat attendu :** Le compte apparait dans le plan comptable SYSCOHADA.
@RESULT

### UAT-GL-02 - Passer une ecriture equilibree
**Role :** gl:post. **Priorite :** Haute.
**Etapes :** 1. Ouvrir Saisie d'ecriture. 2. Choisir le journal et une periode ouverte. 3. Saisir des lignes debit et credit equilibrees. 4. Comptabiliser.
**Resultat attendu :** L'ecriture n'est passee que si debit = credit, la periode est ouverte et les comptes sont mouvementables.
@RESULT

### UAT-GL-03 - Une ecriture desequilibree est refusee (test negatif)
**Role :** gl:post.
**Etapes :** 1. Saisir des lignes ou le debit differe du credit. 2. Tenter de comptabiliser.
**Resultat attendu :** Le bouton Comptabiliser reste desactive / l'ecriture est refusee tant qu'elle n'est pas equilibree.
@RESULT

### UAT-GL-04 - La balance concorde
**Role :** gl:read.
**Etapes :** 1. Ouvrir Balance.
**Resultat attendu :** Le total des debits egale le total des credits.
@RESULT

[PAGEBREAK]
# 16. Etats et analyses

### UAT-REP-01 - Compte de resultat et bilan
**Role :** report:read.
**Etapes :** 1. Ouvrir Etats -> Compte de resultat, puis Bilan.
**Resultat attendu :** Les deux sont calcules a partir des ecritures comptabilisees ; le bilan est equilibre (Actif = Passif + Capitaux propres, resultat de la periode inclus).
@RESULT

### UAT-REP-02 - Balances agees clients et fournisseurs
**Role :** report:read.
**Etapes :** 1. Ouvrir Etats -> Balance agee clients et Balance agee fournisseurs.
**Resultat attendu :** Les elements en cours sont repartis par tranches 0-30 / 31-60 / 61-90 / 90+ jours.
@RESULT

### UAT-REP-03 - Export CSV
**Role :** report:export.
**Etapes :** 1. Sur un etat, cliquer Exporter.
**Resultat attendu :** Un fichier CSV se telecharge avec les donnees. (Les roles sans droit d'export ne voient pas le bouton.)
@RESULT

### UAT-INS-01 - Analyses (Insights)
**Role :** report:read.
**Etapes :** 1. Ouvrir Analyses.
**Resultat attendu :** Detection de doublons de factures, prevision de tresorerie et alertes de retard s'affichent a partir des donnees reelles.
@RESULT

[PAGEBREAK]
# 17. Taches

### UAT-TSK-01 - Creer et assigner une tache
**Role :** Tout utilisateur. **Priorite :** Haute.
**Etapes :** 1. Ouvrir Taches -> + Nouvelle tache. 2. Saisir titre, priorite, categorie, echeance et destinataires. 3. Enregistrer.
**Resultat attendu :** La tache est creee ; les destinataires sont notifies (icone cloche).
@RESULT

### UAT-TSK-02 - Dependances et garde d'achevement (test negatif)
**Role :** Createur/assigne de la tache.
**Etapes :** 1. Creer la tache B dependante de la tache A. 2. Tenter d'achever B alors que A est ouverte.
**Resultat attendu :** L'achevement est bloque tant que la dependance (et les sous-taches) ne sont pas terminees.
@RESULT

### UAT-TSK-03 - Une tache de depot au tribunal forcee en CRITIQUE
**Role :** Tout utilisateur.
**Etapes :** 1. Creer une tache dans la categorie Depot au tribunal.
**Resultat attendu :** Sa priorite est automatiquement mise a CRITIQUE.
@RESULT

### UAT-TSK-04 - Visibilite d'une tache privee
**Role :** Deux utilisateurs differents.
**Etapes :** 1. L'utilisateur A cree une tache PRIVEE. 2. L'utilisateur B (non assigne) la recherche.
**Resultat attendu :** L'utilisateur B ne peut pas voir la tache privee dans la liste ni l'ouvrir directement.
@RESULT

[PAGEBREAK]
# 18. Assistant IA et Pinto

### UAT-AI-01 - Question financiere en langage naturel
**Role :** report:read. Necessite la cle IA.
**Etapes :** 1. Ouvrir Assistant IA. 2. Demander, par ex. "Quel est notre resultat net cette annee ?"
**Resultat attendu :** Une reponse fondee sur les chiffres reels du cabinet est fournie.
@RESULT

### UAT-AI-02 - OCR de facture
**Role :** ap:manage. Necessite la cle IA.
**Etapes :** 1. Assistant IA -> OCR d'une image ou d'un PDF de facture.
**Resultat attendu :** Les champs cles sont extraits pour pre-remplir une facture fournisseur.
@RESULT

### UAT-PIN-01 - Demander a Pinto comment utiliser l'application
**Role :** Tout utilisateur.
**Etapes :** 1. Cliquer le bouton Pinto (en bas a droite). 2. Demander, par ex. "Comment etablir une facture ?"
**Resultat attendu :** Des instructions pas a pas adaptees a vos permissions.
@RESULT

### UAT-PIN-02 - Question juridique (Cameroun / CEMAC / OHADA)
**Role :** Tout utilisateur.
**Etapes :** 1. Poser une question juridique, ex. "Capital social minimum d'une SARL en OHADA ?"
**Resultat attendu :** Une reponse avec sources (Regle / Source / Application) et une mention indiquant qu'il s'agit d'une information generale, pas d'un avis formel.
@RESULT

### UAT-PIN-03 - Generer un document (PDF / DOCX)
**Role :** Tout utilisateur.
**Etapes :** 1. Saisir une demande dans Pinto, ex. "une note de jurisprudence sur la responsabilite des dirigeants en OHADA". 2. Cliquer PDF ou DOCX sous la zone de message.
**Resultat attendu :** Un document mis en forme se telecharge dans le format choisi.
@RESULT

### UAT-PIN-04 - Co-travail : creer une tache via Pinto
**Role :** Tout utilisateur.
**Etapes :** 1. Demander a Pinto de "creer une tache intitulee Revoir le contrat, priorite haute, echeance vendredi prochain".
**Resultat attendu :** Pinto cree la tache et renvoie un lien ; l'action est consignee dans le journal d'audit.
@RESULT

### UAT-PIN-05 - Pinto refuse les actions financieres / informatiques (test negatif)
**Role :** Tout utilisateur.
**Etapes :** 1. Demander a Pinto de "comptabiliser la facture INV-1 et la payer".
**Resultat attendu :** Pinto refuse l'operation financiere et vous oriente vers le bon menu ou la bonne personne.
@RESULT

[PAGEBREAK]
# 19. Elements generaux et transverses

### UAT-GEN-01 - Basculer la langue FR / EN
**Role :** Tout utilisateur.
**Etapes :** 1. Utiliser le commutateur EN / FR dans la barre superieure.
**Resultat attendu :** La langue de l'interface change immediatement, sans deconnexion.
@RESULT

### UAT-GEN-02 - Theme clair / sombre
**Role :** Tout utilisateur.
**Etapes :** 1. Basculer le bouton de theme dans la barre superieure.
**Resultat attendu :** L'interface passe du clair au sombre.
@RESULT

### UAT-GEN-03 - Le menu reflete les permissions
**Role :** Comparer deux roles.
**Etapes :** 1. Se connecter avec un role complet, puis avec un role en lecture seule.
**Resultat attendu :** Chaque role ne voit que les menus et actions autorises ; aucune page n'affiche d'erreur.
@RESULT

### UAT-GEN-04 - Le journal d'audit enregistre les actions
**Role :** audit:read.
**Etapes :** 1. Ouvrir Audit apres avoir effectue plusieurs actions.
**Resultat attendu :** Les actions importantes (qui / quand / quoi) sont listees et non modifiables.
@RESULT

[PAGEBREAK]
# 20. Journal des anomalies

Consignez ici chaque test echoue ou bloque. Copiez ce bloc autant de fois que necessaire.

- **ID anomalie :** ___________   **Test lie :** ___________   **Date :** __________
- **Module :** ____________________   **Gravite :** Critique / Haute / Moyenne / Basse
- **Description (constate vs attendu) :** _________________________________________________
- **Etapes pour reproduire :** __________________________________________________________
- **Signale par :** ________________   **Statut :** Ouvert / Corrige / Reteste / Cloture
---
- **ID anomalie :** ___________   **Test lie :** ___________   **Date :** __________
- **Module :** ____________________   **Gravite :** Critique / Haute / Moyenne / Basse
- **Description :** ______________________________________________________________________
- **Etapes pour reproduire :** __________________________________________________________
- **Signale par :** ________________   **Statut :** Ouvert / Corrige / Reteste / Cloture
---
- **ID anomalie :** ___________   **Test lie :** ___________   **Date :** __________
- **Module :** ____________________   **Gravite :** Critique / Haute / Moyenne / Basse
- **Description :** ______________________________________________________________________
- **Etapes pour reproduire :** __________________________________________________________
- **Signale par :** ________________   **Statut :** Ouvert / Corrige / Reteste / Cloture

[PAGEBREAK]
# 21. Validation de la recette

En signant ci-dessous, le testeur confirme que les modules de ce cahier ont ete testes et les resultats consignes.

**Decision globale :**   Accepte / Accepte avec anomalies / Refuse

- Nom du testeur : ______________________________   Role : ___________________
- Signature : ________________________________   Date : ___________________

- Revu par (Associe gerant / CFO) : ______________________   Date : ____________

- Administrateur informatique : _______________________________   Date : ____________
`;

export const GUIDE_MD = `
# Bienvenue dans Dentons KMN ERP

Dentons KMN ERP est le systeme de finance et d'exploitation du cabinet : comptabilite, gestion des clients et des dossiers, facturation, fonds de fiducie, paie, etats, taches et un assistant IA nomme Pinto. Ce guide explique, module par module, comment realiser le travail quotidien.

**Ou se connecter :** https://dentons-kmn-finance-three.vercel.app

> Astuce : apres une mise a jour, actualisez la page avec Ctrl+Maj+R pour toujours voir la derniere version.

## Premiers pas
1. Ouvrez l'URL de l'application et connectez-vous avec votre e-mail et votre mot de passe.
2. Si demande, definissez un nouveau mot de passe (au moins 12 caracteres, avec majuscule, minuscule, chiffre et symbole).
3. Vous arrivez sur le Tableau de bord.

## Se reperer
- Le **menu de gauche** est le menu principal. Vous ne voyez que les rubriques autorisees par votre role - s'il en manque une, c'est que vous n'avez pas la permission (demandez a l'administrateur informatique).
- La **barre superieure** contient les notifications (la cloche), le commutateur de langue EN / FR et le bouton de theme clair / sombre.
- Le **bouton Pinto** (en bas a droite, sur chaque page) ouvre l'assistant pour l'aide, les questions juridiques, les documents et des actions rapides.

## Votre compte et securite
- Ouvrez **Securite** pour changer votre mot de passe, activer la double authentification (2FA), definir un e-mail de recuperation, consulter votre historique de connexion et fermer des sessions actives.
- La 2FA ajoute un code a 6 chiffres depuis une application d'authentification apres votre mot de passe - recommandee pour quiconque approuve des paiements.

[PAGEBREAK]
# Clients et dossiers

## Creer un client
1. Ouvrez **Clients** -> **+ Nouveau client**.
2. Parcourez les trois etapes : identite (type, nom, identifiant/immatriculation, identifiant fiscal) ; contact et mission (e-mail, telephone, adresse, type de dossier, avocat assigne, risque LBC) ; documents et revue (joindre des fichiers, puis Creer).
3. Le client recoit un numero unique du type CL-2026-00001.

## Verifier le KYC et les conflits
- Dans la fiche client, cliquez **Verifier KYC** pour lancer une analyse Internet automatique ; un rapport KYC est depose et le client devient Verifie sauf risque eleve.
- Cliquez **Lancer la verification de conflit** et repondez au court questionnaire ; un rapport de conflit est depose. Toute alerte marque le client pour revue par un associe.
> Un dossier ne peut etre ouvert que pour un client verifie KYC et non bloque pour conflit.

## Documents et portefeuille client
- Les avocats peuvent televerser des documents dans la fiche client ; les autres roles les consultent.
- La fiche client affiche aussi les totaux de facturation, les dossiers, les factures et le solde de fiducie.

## Ouvrir un dossier
1. Ouvrez **Dossiers** -> **+ Ouvrir un dossier**.
2. Choisissez un client verifie (les clients ineligibles apparaissent grises avec le motif).
3. Le **code du dossier est attribue automatiquement** - vous ne le saisissez pas. Entrez le nom du dossier, choisissez le domaine de pratique et l'associe responsable, puis Creer.
4. Utilisez **Cloturer** pour un dossier termine, ou **Supprimer** pour un dossier ouvert par erreur (uniquement s'il n'a ni temps, ni factures, ni taches).

[PAGEBREAK]
# Temps, debours et facturation

## Saisir du temps
1. Ouvrez **Saisie des temps**.
2. Choisissez le dossier et l'intervenant, saisissez la date, les minutes et le taux, marquez facturable, ajoutez un libelle et soumettez. La valeur est minutes / 60 x taux.

## Enregistrer des debours
1. Ouvrez **Debours**, choisissez le dossier, saisissez la description, le montant et le fournisseur, puis soumettez.

## Etablir une facture
1. Ouvrez **Facturation** -> **+ Nouvelle facture**.
2. Selectionnez le dossier, puis cochez les temps et debours non factures a inclure.
3. Definissez la TVA (19,25%) et une eventuelle retenue a la source. Cliquez **Creer** - cela cree un BROUILLON.
4. Cliquez **Comptabiliser** pour l'officialiser (une ecriture equilibree est passee).
5. Au paiement du client, cliquez **Encaissement**, saisissez le montant, le mode et la reference. La facture passe a partiellement payee ou payee.
> Si un bouton (Nouvelle facture, Comptabiliser, Encaissement) n'est pas visible, votre role n'inclut pas cette etape - demandez a un collegue qui a le droit, ou a l'administrateur informatique.

[PAGEBREAK]
# Comptes de fiducie

L'argent client (fiducie) est conserve separement des fonds du cabinet.
1. Ouvrez **Comptes de fiducie** -> **+ Ouvrir un compte** et choisissez le client.
2. Ouvrez le compte pour enregistrer un **Depot**, un **Paiement** ou **Affecter a une facture** (utiliser des fonds detenus pour solder une facture du cabinet).
> Le solde de fiducie d'un client ne peut jamais devenir negatif - un paiement superieur au solde est refuse.

# Fournisseurs et factures fournisseurs
1. Ajoutez un fournisseur dans **Fournisseurs**.
2. Ouvrez **Factures fournisseurs** -> **+ Nouvelle facture**, choisissez le fournisseur, le compte de charge et le montant (avec TVA deductible), puis Creer et **Comptabiliser**.
3. Utilisez **Payer** pour solder une facture comptabilisee. Le trop-paye est bloque.

# Caisse et banque
- **Caisse** : creez des caisses et enregistrez les entrees/sorties (un mouvement ne peut pas mettre la caisse a decouvert).
- **Banque** : creez des comptes bancaires, enregistrez frais/interets/virements et utilisez **Rapprochement** pour pointer les elements et comparer solde comptable et solde pointe.

# Achats
1. Emettez une demande d'achat dans **Achats**.
2. Une autre personne l'approuve (vous ne pouvez pas approuver votre propre demande) et emet le bon de commande.

[PAGEBREAK]
# Immobilisations, budgets et paie

## Immobilisations
1. Ouvrez **Immobilisations** -> **+ Nouveau** et saisissez cout, valeur residuelle, duree de vie et compte d'immobilisation.
2. Utilisez **Amortir** pour l'amortissement lineaire d'une periode, et **Ceder** pour vendre/reformer une immobilisation (la plus ou moins-value est calculee).

## Budgets
1. Ouvrez **Budgets** -> **+ Nouveau**, ajoutez des lignes de compte avec les montants annuels, puis Creer.
2. Ouvrez un budget et choisissez **Voir** pour l'ecart budget / realise issu des ecritures comptabilisees.

## Paie (Cameroun)
1. Ajoutez les employes dans **Employes**.
2. Ouvrez **Paie** et creez un traitement pour le mois. Chaque bulletin calcule automatiquement CNPS, IRPP/PAYE, CAC, CRTV/RAV, Credit Foncier et FNE.
3. Verifiez les bulletins et les totaux, puis **Comptabilisez** le journal de paie.

[PAGEBREAK]
# Grand livre, etats et analyses

## Grand livre
- **Plan comptable** : consultez et (avec les droits) ajoutez des comptes (base SYSCOHADA).
- **Saisie d'ecriture** : passez des ecritures manuelles - le bouton Comptabiliser ne s'active que si debit = credit, la periode est ouverte et les comptes mouvementables.
- **Balance** : concorde toujours (total debit = total credit).

## Etats
- **Compte de resultat**, **Bilan**, **Balance agee clients** et **Balance agee fournisseurs**, tous a partir des chiffres comptabilises.
- Utilisez **Exporter** pour telecharger un etat en CSV (si votre role inclut le droit d'export).

## Analyses
- Detection automatique des doublons de factures, prevision de tresorerie et alertes de retard a partir de vos donnees reelles.

# Taches
1. Ouvrez **Taches** -> **+ Nouvelle tache**. Saisissez titre, priorite, categorie, echeance et destinataires.
2. Utilisez sous-taches, dependances, commentaires, pieces jointes, rappels et regles recurrentes selon les besoins.
3. Les taches de depot au tribunal sont automatiquement en CRITIQUE. Une tache ne peut etre achevee tant que ses dependances et sous-taches ne sont pas terminees. Les notifications apparaissent sous la cloche.

[PAGEBREAK]
# Pinto - votre assistant IA

Cliquez le bouton **Pinto** (en bas a droite) sur n'importe quelle page. Pinto peut :
- **Expliquer l'application** - "Comment lancer une verification de conflit ?" - avec des etapes adaptees a ce que vous etes autorise a faire.
- **Repondre a des questions juridiques** pour le Cameroun, la zone CEMAC et l'OHADA, avec sources. Il s'agit d'une information juridique generale, pas d'un avis formel - verifiez toujours le texte officiel et faites valider par un avocat qualifie.
- **Creer des documents** - decrivez ce dont vous avez besoin (note, note de jurisprudence, contrat, courrier), puis cliquez **PDF** ou **DOCX** sous la zone de message pour le telecharger. Les avocats peuvent aussi demander a Pinto de classer un document directement dans la fiche d'un client.
- **Agir pour vous** - creer, assigner ou commenter des taches, le tout sous vos propres permissions et consigne dans le journal d'audit.
> Pinto n'effectuera pas d'operations financieres (factures, paiements, paie, grand livre) ni d'actions informatiques/administratives. Il expliquera comment faire et vous orientera vers le bon menu ou la bonne personne.

# Astuces au quotidien
- **Langue :** basculez EN / FR a tout moment depuis la barre superieure - inutile de se deconnecter.
- **Theme :** basculez clair / sombre depuis la barre superieure.
- **Une rubrique ou un bouton manque ?** C'est controle par votre role. Demandez a l'administrateur informatique si vous avez besoin de plus d'acces.
- **Quelque chose semble anormal apres une mise a jour ?** Actualisez avec Ctrl+Maj+R.
- **Vous ne savez pas comment faire ?** Demandez d'abord a Pinto.

# Obtenir de l'aide
- Pour l'acces ou les mots de passe, contactez votre **administrateur informatique**.
- Pour les approbations financieres et la politique, contactez le **CFO** ou un **associe**.
- Pour les questions pratiques, demandez a **Pinto** dans l'application.

[PAGEBREAK]
# Glossaire

- **KYC** - Connaissance du client : verifications d'identite et de risque avant d'agir pour un client.
- **LBC** - Lutte contre le blanchiment de capitaux : note de risque sur un client.
- **Verification de conflit** - confirmer que le cabinet peut agir sans conflit d'interets.
- **Dossier (matter)** - un travail/une affaire specifique pour un client.
- **Debours** - un cout paye pour le compte du client, refacture sur la facture.
- **TVA** - Taxe sur la valeur ajoutee (19,25% au Cameroun).
- **Retenue a la source** - impot preleve a la source.
- **Grand livre** - la comptabilite centrale en partie double du cabinet.
- **Balance** - un etat ou le total des debits egale le total des credits.
- **Compte de fiducie** - argent client separe, jamais melange aux fonds du cabinet.
- **SYSCOHADA** - le referentiel comptable regional OHADA utilise pour le plan comptable.
- **RBAC** - controle d'acces base sur les roles : ce que chaque role peut faire.
- **Journal d'audit** - l'enregistrement permanent de qui a fait quoi, et quand.
`;
