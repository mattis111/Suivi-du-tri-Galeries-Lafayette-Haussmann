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

  // BASE DE DONNÉES EN LIGNE (Supabase) : contrôles, photos et comptes partagés entre tous les appareils.
  // Les comptes se gèrent dans l'appli : Suivi > Comptes (administrateur).
  // La clé ci-dessous est la clé PUBLIQUE ("publishable") : elle peut être visible sans risque.
  supabase: {
    url: "https://gciscgfvczuovcrioejk.supabase.co",
    cle: "sb_publishable_DzE1EKWjRH42mCu77ZWV7Q_BMV33ORo"
  },

  dechets: [
    "Rolls cartons",
    "Snapsac papier",
    "Snapsac plastique",
    "DIB",
    "Poubelle à verre"
  ],

  // Zone de texte libre affichée sous les poubelles de chaque étage (sans case à cocher).
  // Mettre "" pour la retirer.
  champTexte: "Autre",

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
    },
    {
      // PARTIE RÉSERVÉE : visible seulement par les comptes qui ont « Accès GL5 Gourmet »
      // (Admin, Clive, Khatri, Service généraux — réglable dans Suivi > Comptes).
      // Le serveur refuse aussi d'envoyer ou de montrer ces contrôles aux autres comptes.
      nom: "GL5 Gourmet",
      restreint: true,
      organisation: "Samsic",   // supervision à part : « Organisation : Samsic »
      paliers: [
        { nom: "Gourmet", niveaux: ["Étage 5 · Pilier 711", "Étage 4 · Pilier 711", "Étage 3 · Pilier 703",
                                    "Étage 2 · Pilier 703", "Étage 1 · Pilier 703", "Sous-sol 1 · Pilier 703"] }
      ]
    }
  ],

  // Poubelles propres à un niveau : REMPLACENT la liste « dechets » pour ce niveau (dans cet ordre).
  // Format : "Magasin|Palier|Niveau": ["Nom de la poubelle", ...]
  dechetsParNiveau: {
    "GL5 Gourmet|Gourmet|Étage 5 · Pilier 711": ["Rolls cartons", "DIB", "Papier", "Plastique"],
    "GL5 Gourmet|Gourmet|Étage 4 · Pilier 711": ["Papier", "Plastique", "DIB", "Rolls cartons"],
    "GL5 Gourmet|Gourmet|Étage 3 · Pilier 703": ["Papier", "Plastique", "Rolls cartons", "DIB", "Poubelle porcelaine"],
    "GL5 Gourmet|Gourmet|Étage 2 · Pilier 703": ["Rolls cartons", "DIB", "Papier", "Plastique"],
    "GL5 Gourmet|Gourmet|Étage 1 · Pilier 703": ["Local DIB", "Rolls cartons"],
    "GL5 Gourmet|Gourmet|Sous-sol 1 · Pilier 703": ["Plastique", "Rolls cartons"]
  },

  // Heure (0-23) à laquelle le matin se termine et l'après-midi commence,
  // pour le calendrier de supervision.
  heureFinMatin: 13,

  // Tableau « Directeurs de département » (compte Administrateur) :
  // code affiché dans la colonne Magasin, et directeur responsable selon le magasin et l'étage.
  // (les étages non listés ici — ex. Coupole Étages 7 à 9 et Sous-sol 3 — restent sans directeur)
  codesMagasin: { "Coupole": "GL1", "Homme": "GL2", "GL5 Gourmet": "GL5" },
  directeurs: [
    { nom: "LOCATELLI Jean-Luc", magasin: "Homme" },
    { nom: "Valérie JUSTE", magasin: "Coupole", niveaux: ["Étage 6", "Étage 5", "Étage 4", "Étage 3", "Étage 2"] },
    { nom: "Benjamin FONTENAS", magasin: "Coupole", niveaux: ["Étage 1", "RDC", "Sous-sol 1"] }
  ]
};
