// Mode clair / sombre — chargé en premier pour éviter un flash de couleur.
// Sans choix enregistré, l'appli suit le réglage du téléphone ou de l'ordinateur.
(function () {
  var KEY = "tri.theme", mq = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
  function saved() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function apply() {
    var t = saved() || (mq && mq.matches ? "dark" : "light");
    document.documentElement.setAttribute("data-theme", t);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", t === "dark" ? "#0B0F0E" : "#1C2321");
  }
  apply();
  if (mq && mq.addEventListener) mq.addEventListener("change", function () { if (!saved()) { apply(); if (window.TriRoute) window.TriRoute(); } });
  window.TriTheme = { set: function (t) { try { localStorage.setItem(KEY, t); } catch (e) {} apply(); } };
})();
