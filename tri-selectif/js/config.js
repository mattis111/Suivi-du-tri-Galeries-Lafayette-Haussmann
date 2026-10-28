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
    }
  ],

  // Heure (0-23) à laquelle le matin se termine et l'après-midi commence,
  // pour le calendrier de supervision.
  heureFinMatin: 13
};
