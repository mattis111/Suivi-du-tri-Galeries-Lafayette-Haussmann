/*
 * CONFIGURATION DE L'APPLICATION
 * ------------------------------
 * C'est le seul fichier à modifier pour adapter l'appli à ton site :
 * nom de l'organisation, magasins, paliers, niveaux et types de déchets.
 *
 * - Un "magasin" contient un ou plusieurs "paliers".
 * - Un "palier" contient une liste de "niveaux" (étages, sous-sols…).
 * - Chaque niveau est contrôlé pour chaque type de déchet.
 */
window.APP_CONFIG = {
  organisation: "DESPS",

  // COMPTES UTILISATEURS
  // Rôles : "admin" (tout + gestion des comptes), "superviseur" (contrôle + suivi + exports),
  //         "agent" (saisie des contrôles uniquement).
  // Les mots de passe ne sont jamais écrits en clair : "sel" + "hash" sont générés
  // par l'appli (Suivi > Comptes, réservé à l'admin). Copie-colle la liste générée ici.
  comptes: [
    { identifiant: "Admin", nom: "Admin", role: "admin",
      sel: "1752470aaaf7a91b", hash: "db83f86a7525be31c1b424ff52f633574a3ebbc21e1da9cb146cf107242407a2" },
    { identifiant: "samir", nom: "Samir", role: "agent",
      sel: "2a04102c750d5f0f", hash: "5cf66125c2b69225960cb1b324d44d6c5a415c65d5249f1b4257a4f45944911d" },
    { identifiant: "mattis", nom: "Mattis", role: "responsable",
      sel: "3a277c10ff2ebd39", hash: "283086fb31361a901f6a5f469105af0649f035f4d0e013dbcf2d5f3cf0b814d3" },
    { identifiant: "barbara", nom: "Barbara", role: "responsable",
      sel: "4f3b5856b0fecddc", hash: "3f74a4ac7f1bc66aeafb7341995128660f0c059f211646b4e4989e45495761d2" },
    { identifiant: "hicham", nom: "Hicham", role: "responsable",
      sel: "bbf17d4e0096743a", hash: "7360ab6d159b86021a37a50ee987eb2edf50dbb6a09861fa23f652101ba846ab" },
    { identifiant: "khatri", nom: "Khatri", role: "superviseur",
      sel: "32d69cee29829df8", hash: "e1b7539c95f5c618cc62a9f8a729c0d248be396a9391de89b098a32bae8a392d" },
    { identifiant: "hamid", nom: "Hamid", role: "agent",
      sel: "a605d895364dcd88", hash: "1847a950598021ba6f7e8baa90f08c1837f86f9c3b0e433d476fb4197e23f405" }
  ],

  dechets: [
    "Rolls cartons",
    "Snapsac papier",
    "Snapsac plastique",
    "DIB",
    "Poubelle à verre"
  ],

  // Poubelles en plus, seulement sur certains niveaux.
  // Format : "Magasin|Palier|Niveau": ["Nom de la poubelle", ...]
  dechetsSupplementaires: {
    "Coupole|Provence|Étage 1": ["Biodéchets", "Canettes et bouteilles"]
  },

  magasins: [
    {
      nom: "Coupole",
      paliers: [
        {
          nom: "Antin",
          niveaux: ["Étage 8", "Étage 7", "Étage 6", "Étage 5", "Étage 4", "Étage 3",
                    "Étage 2", "Étage 1", "RDC", "Sous-sol 1", "Sous-sol 3"]
        },
        {
          nom: "Provence",
          niveaux: ["Étage 9", "Étage 8", "Étage 7", "Étage 6", "Étage 5", "Étage 4", "Étage 3",
                    "Étage 2", "Étage 1", "RDC", "Sous-sol 1", "Sous-sol 3"]
        }
      ]
    },
    {
      nom: "Homme",
      paliers: [
        {
          nom: "Homme",
          niveaux: ["Étage 4", "Étage 3", "Étage 2", "Étage 1", "RDC", "Sous-sol 1"]
        }
      ]
    }
  ],

  // Heure (0-23) à laquelle le matin se termine et l'après-midi commence,
  // pour le calendrier de supervision.
  heureFinMatin: 13
};
