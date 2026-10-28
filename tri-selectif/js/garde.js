// Sécurité : empêche l'appli d'être affichée à l'intérieur d'un autre site (anti-« clickjacking »).
if (window.top !== window.self) {
  document.documentElement.style.display = "none";
  try { window.top.location = window.self.location; } catch (e) { /* bloqué : la page reste masquée */ }
}
