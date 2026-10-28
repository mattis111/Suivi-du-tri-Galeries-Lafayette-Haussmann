/* Contrôle du tri sélectif – application monopage, données stockées dans le navigateur. */
(function () {
  "use strict";

  const CFG = window.APP_CONFIG;
  const DECHETS = CFG.dechets;
  // Poubelles en plus sur certains niveaux (voir config.js > dechetsSupplementaires).
  const EXTRA = CFG.dechetsSupplementaires || {};
  const dechetsOf = (m, p, n) => {
    const extra = EXTRA[`${m}|${p}|${n}`] || [];
    const i = DECHETS.indexOf("Autre");
    return i < 0 ? DECHETS.concat(extra) : [...DECHETS.slice(0, i), ...extra, ...DECHETS.slice(i)];
  };
  const TEXTE = CFG.champTexte || "";            // libellé de la zone de texte libre ("Autre")
  const noteOf = v => (v && typeof v.__note === "string" ? v.__note.trim() : "");
  const ALL_DECHETS = [...new Set(DECHETS.concat(...Object.values(EXTRA)))];
  const STATUTS = {
    bien: { label: "Bien trié", icon: "✓" },
    mal:  { label: "Mal trié",  icon: "✕" },
    na:   { label: "Non applicable", icon: "–" }
  };
  const $app = document.getElementById("app");

  /* ---------------- Stockage ---------------- */
  const store = {
    get(key, fallback) {
      try { const v = localStorage.getItem("tri." + key); return v ? JSON.parse(v) : fallback; }
      catch (e) { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem("tri." + key, JSON.stringify(value)); return true; }
      catch (e) { toast("Mémoire du navigateur pleine : exporte puis efface d'anciennes données."); return false; }
    },
    del(key) { try { localStorage.removeItem("tri." + key); } catch (e) {} }
  };

  const S = {
    user: null, role: null, ident: null,
    records: store.get("records", []),
    draft: store.get("draft", {}),
    ui: store.get("ui", { mag: 0, pal: 0, niv: {} }),
    hist: { period: "", mag: "", pal: "", niv: "", agent: "", statut: "", du: "", au: "", q: "", size: 20, page: 0 },
    sup: { agent: "", y: new Date().getFullYear(), m: new Date().getMonth() },
    ana: { mag: 0, pal: 0, niv: 0, dechet: "" },
    dash: { weeks: 12, agent: "", dechet: "" }
  };
  const saveRecords = () => store.set("records", S.records);
  const saveDraft = () => store.set("draft", S.draft);
  const saveUi = () => store.set("ui", S.ui);

  /* ---------------- Comptes & permissions ---------------- */
  const ROLES = {
    admin:       { label: "Administrateur", perms: ["controle", "suivi", "export", "supervision", "demo", "wipe", "comptes"] },
    // Responsable : tout, sauf l'effacement des données et la gestion des comptes.
    responsable: { label: "Responsable",    perms: ["controle", "suivi", "export", "supervision", "demo"] },
    // Superviseur : interface des paliers + consultation des données envoyées (Historique, Tableau de bord, Analyse).
    // Pas de Supervision, pas de comptes, pas de données de démo ni d'effacement.
    superviseur: { label: "Superviseur",    perms: ["controle", "suivi", "export"] },
    agent:       { label: "Agent",          perms: ["controle"] }
  };
  const ACCOUNTS = CFG.comptes || [];
  const findAccount = id => ACCOUNTS.find(a => a.identifiant.toLowerCase() === String(id || "").trim().toLowerCase());
  const can = perm => !!(S.role && ROLES[S.role] && ROLES[S.role].perms.includes(perm));
  async function sha256(text) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
  }
  const hashFor = (sel, id, pw) => sha256(`${sel}:${id.trim().toLowerCase()}:${pw}`);
  const newSalt = () => [...crypto.getRandomValues(new Uint8Array(8))].map(b => b.toString(16).padStart(2, "0")).join("");
  function openSession(acc) {
    S.user = acc.nom || acc.identifiant; S.role = acc.role; S.ident = acc.identifiant;
  }
  // Session mémorisée : on relit toujours le rôle dans config.js (un compte supprimé n'a plus accès).
  (function restoreSession() {
    store.del("user");
    const sess = store.get("session", null);
    const acc = sess && findAccount(sess.identifiant);
    if (acc && ROLES[acc.role]) openSession(acc); else store.del("session");
  })();

  /* ---------------- Utilitaires ---------------- */
  const h = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const pad = n => String(n).padStart(2, "0");
  const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const frDate = d => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  const frTime = d => `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  const halfOf = d => (d.getHours() < CFG.heureFinMatin ? "am" : "pm");
  const halfId = d => ymd(d) + "-" + halfOf(d);
  const nKey = (m, p, n) => `${m}|${p}|${n}`;
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const MOIS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

  let toastTimer;
  function toast(msg) {
    const t = document.getElementById("toast");
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.hidden = true), msg.length > 60 ? 4500 : 2600);
  }
  function modal(html) {
    document.getElementById("modal-body").innerHTML = html;
    document.getElementById("modal").hidden = false;
  }
  document.getElementById("modal-close").onclick = () => (document.getElementById("modal").hidden = true);
  document.getElementById("modal").onclick = e => { if (e.target.id === "modal") e.target.hidden = true; };

  function download(blob, filename) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  // Réduit une photo pour qu'elle tienne dans le stockage du navigateur.
  function resizePhoto(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const max = 1000, r = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * r); c.height = Math.round(img.height * r);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(img.src);
        resolve(c.toDataURL("image/jpeg", 0.7));
      };
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }

  /* ---------------- En-tête ---------------- */
  function header(eyebrow, title, actions) {
    document.getElementById("hdr-eyebrow").textContent = eyebrow;
    document.getElementById("hdr-title").textContent = title;
    document.getElementById("hdr-actions").innerHTML = actions;
  }
  const userBox = () => S.user
    ? `<button class="hbtn huser" data-act="logout"><span><small>${h(S.user)} · ${h(ROLES[S.role].label)}</small>Se déconnecter</span></button>` : "";

  /* ---------------- Routage ---------------- */
  function route() {
    const r = location.hash.replace(/^#\/?/, "");
    if (!S.user) return renderLogin();
    if (r.startsWith("suivi") && can("suivi")) {
      const tab = r.includes("supervision") && can("supervision") ? "supervision" : r.includes("analyse") ? "analyse" : r.includes("tableau") ? "dashboard"
        : r.includes("comptes") && can("comptes") ? "comptes" : "historique";
      return renderSuivi(tab);
    }
    if (r && r !== "controle") { history.replaceState(null, "", "#/controle"); }
    renderControle();
  }
  window.addEventListener("hashchange", route);

  /* ---------------- Connexion ---------------- */
  function renderLogin() {
    header("Contrôle terrain", "Tri sélectif par palier", "");
    $app.className = "";
    $app.innerHTML = `
      <form class="card login" id="login-form" autocomplete="on">
        <div class="label">Organisation · ${h(CFG.organisation)}</div>
        <h2>Connexion</h2>
        <label class="label" for="login-id">Identifiant</label>
        <input id="login-id" autocomplete="username" autocapitalize="none" required>
        <label class="label" for="login-pw">Mot de passe</label>
        <input id="login-pw" type="password" autocomplete="current-password" required>
        <div class="login-err" id="login-err" hidden></div>
        <button class="btn-dark" type="submit">Se connecter</button>
      </form>`;
    const err = msg => { const e = document.getElementById("login-err"); e.textContent = msg; e.hidden = !msg; };
    document.getElementById("login-form").onsubmit = async e => {
      e.preventDefault();
      const id = document.getElementById("login-id").value, pw = document.getElementById("login-pw").value;
      const btn = e.target.querySelector("button"); btn.disabled = true;
      try {
        const acc = findAccount(id);
        const ok = acc && ROLES[acc.role] && (await hashFor(acc.sel, acc.identifiant, pw)) === acc.hash;
        if (!ok) {
          await new Promise(r => setTimeout(r, 700)); // ralentit les essais au hasard
          err("Identifiant ou mot de passe incorrect.");
          document.getElementById("login-pw").value = "";
          return;
        }
        openSession(acc);
        store.set("session", { identifiant: acc.identifiant });
        location.hash = acc.role === "agent" ? "#/controle" : location.hash || "#/controle";
        route();
      } catch (ex) {
        err("Connexion impossible : ouvre l'appli via son adresse https (GitHub Pages).");
      } finally { btn.disabled = false; }
    };
  }

  /* ---------------- Contrôle terrain ---------------- */
  // Dernier envoi (aujourd'hui) d'un niveau, pour information seulement : il ne pré-remplit plus la saisie.
  function lastSentToday(mag, pal, niv) {
    const today = ymd(new Date());
    for (let i = S.records.length - 1; i >= 0; i--) {
      const r = S.records[i];
      if (ymd(new Date(r.date)) !== today) break;
      if (r.magasin === mag && r.palier === pal && r.niveau === niv) return r;
    }
    return null;
  }
  // Statuts affichés pour un niveau : uniquement la saisie en cours (vide après chaque envoi).
  function levelValues(mag, pal, niv) {
    return { values: S.draft[nKey(mag, pal, niv)] || {}, sent: lastSentToday(mag, pal, niv) };
  }
  const countDone = (values, list) => (list || DECHETS).filter(x => values[x] && values[x].statut).length;
  const countBad = (values, list) => (list || DECHETS).filter(x => values[x] && values[x].statut === "mal").length;
  const listOfKey = k => { const [m, p, n] = k.split("|"); return dechetsOf(m, p, n); };

  function palierProgress(mag, pal) {
    let done = 0, total = 0;
    pal.niveaux.forEach(n => { const L = dechetsOf(mag.nom, pal.nom, n); total += L.length; done += countDone(levelValues(mag.nom, pal.nom, n).values, L); });
    return { done, total };
  }
  function magProgress(mag) {
    let done = 0, total = 0;
    mag.paliers.forEach(p => { const r = palierProgress(mag, p); done += r.done; total += r.total; });
    return { done, total };
  }

  function renderControle() {
    header("Contrôle terrain", "Tri sélectif par palier",
      `${can("suivi") ? `<button class="hbtn" data-act="go" data-to="#/suivi">📊 Suivi</button>` : ""}${userBox()}`);
    $app.className = "";

    const mi = Math.min(S.ui.mag || 0, CFG.magasins.length - 1);
    const mag = CFG.magasins[mi];
    const pi = Math.min(S.ui.pal || 0, mag.paliers.length - 1);
    const pal = mag.paliers[pi];
    const palKey = mag.nom + "|" + pal.nom;
    const ni = Math.min(S.ui.niv[palKey] || 0, pal.niveaux.length - 1);
    const niv = pal.niveaux[ni];
    const { values, sent } = levelValues(mag.nom, pal.nom, niv);
    const draftCount = Object.keys(S.draft).length;

    const stores = CFG.magasins.map((m, i) => {
      const p = magProgress(m), pct = p.total ? Math.round(p.done / p.total * 100) : 0;
      return `<button class="store ${i === mi ? "on" : ""} ${p.done === p.total ? "full" : ""}" data-act="mag" data-i="${i}">
        <b>${h(m.nom)}</b>
        <div class="meta">${p.done}/${p.total} · ${pct}%</div>
        ${m.paliers.length > 1 ? `<div class="meta">${m.paliers.length} Paliers</div>` : ""}
      </button>`;
    }).join("");

    const paliers = mag.paliers.length > 1 ? `<div class="row mt">${mag.paliers.map((p, i) => {
      const pr = palierProgress(mag, p);
      return `<button class="pill ${i === pi ? "on" : ""}" data-act="pal" data-i="${i}">${h(p.nom)} · ${pr.done}/${pr.total}</button>`;
    }).join("")}</div>` : "";

    const floors = pal.niveaux.map((n, i) => {
      const L = dechetsOf(mag.nom, pal.nom, n), lv = levelValues(mag.nom, pal.nom, n), v = lv.values, c = countDone(v, L), bad = countBad(v, L);
      return `<button class="floor ${i === ni ? "on" : ""} ${c === L.length ? "done" : ""} ${bad ? "bad" : ""}" data-act="niv" data-i="${i}">
        <b>${h(n)}</b><span>${c}/${L.length}</span>${lv.sent ? `<em title="Dernier envoi aujourd'hui">✓ ${frTime(new Date(lv.sent.date)).slice(0, 5)}</em>` : ""}</button>`;
    }).join("");

    const LIST = dechetsOf(mag.nom, pal.nom, niv);
    const items = LIST.map(d => {
      const v = values[d] || {};
      const choices = Object.entries(STATUTS).map(([k, s]) =>
        `<button class="choice ${k} ${v.statut === k ? "on" : ""}" data-act="set" data-d="${h(d)}" data-s="${k}"><i>${s.icon}</i>${s.label}</button>`).join("");
      const extra = v.statut === "mal" ? `
        <div class="mal-extra">
          <input type="text" placeholder="Commentaire (ex. carton non plié)" value="${h(v.commentaire || "")}" data-act="comment" data-d="${h(d)}">
          <div class="photo-row">
            ${v.photo ? `<img src="${v.photo}" alt="Photo" data-act="zoom">` : ""}
            <label class="photo-btn">📷 ${v.photo ? "Changer la photo" : "Ajouter une photo"}
              <input type="file" accept="image/*" capture="environment" hidden data-act="photo" data-d="${h(d)}">
            </label>
            ${v.photo ? `<button class="linkbtn" data-act="rmphoto" data-d="${h(d)}">Retirer</button>` : ""}
          </div>
        </div>` : "";
      return `<div class="item"><div class="item-name">${h(d)}</div><div class="choices">${choices}</div>${extra}</div>`;
    }).join("");

    $app.innerHTML = `
      <div class="stores">${stores}</div>
      ${paliers}
      <div class="row between mt2">
        <span class="label">${h(mag.nom)} — ${h(pal.nom)} — ${pal.niveaux.length} niveaux</span>
        <button class="linkbtn" data-act="reset">↻ réinitialiser</button>
      </div>
      <div class="floors mt" id="floors">${floors}</div>
      <section class="card mt">
        <div class="card-head">
          <h2>${h(niv)}</h2>
          <span class="count">${sent ? `Dernier envoi ${frTime(new Date(sent.date)).slice(0, 5)} · ` : ""}${countDone(values, LIST)}/${LIST.length} contrôlés</span>
        </div>
        ${items}
        ${TEXTE ? `<div class="item note-item">
          <label class="item-name" for="note-field">${h(TEXTE)}</label>
          <textarea id="note-field" rows="2" placeholder="Remarque libre pour ${h(niv)} (facultatif)">${h((values.__note) || "")}</textarea>
        </div>` : ""}
        <div class="send-wrap">
          <button class="btn-dark" data-act="send" ${draftCount ? "" : "disabled"}>🚀 TOUT envoyer${draftCount ? ` (${draftCount} niveau${draftCount > 1 ? "x" : ""})` : ""}</button>
        </div>
      </section>`;

    const sel = document.querySelector(".floor.on");
    if (sel) sel.scrollIntoView({ block: "nearest", inline: "center" });

    // Gestion des champs (commentaire, photo)
    const note = document.getElementById("note-field");
    if (note) note.oninput = () => {
      const had = !!S.draft[nKey(mag.nom, pal.nom, niv)];
      draftFor(mag.nom, pal.nom, niv).__note = note.value; saveDraft();
      if (!had) refreshSendButton();
    };
    $app.querySelectorAll('input[data-act="comment"]').forEach(inp => {
      inp.oninput = () => { draftFor(mag.nom, pal.nom, niv)[inp.dataset.d].commentaire = inp.value; saveDraft(); };
    });
    $app.querySelectorAll('input[data-act="photo"]').forEach(inp => {
      inp.onchange = async () => {
        const f = inp.files[0]; if (!f) return;
        try {
          const data = await resizePhoto(f);
          draftFor(mag.nom, pal.nom, niv)[inp.dataset.d].photo = data;
          if (saveDraft()) renderControle();
        } catch (e) { toast("Impossible de lire cette image."); }
      };
    });
    current = { mag, pal, niv, palKey };
  }
  let current = null;

  // Crée (si besoin) le brouillon d'un niveau, pré-rempli avec le dernier envoi de la demi-journée.
  function draftFor(mag, pal, niv) {
    const k = nKey(mag, pal, niv);
    if (!S.draft[k]) S.draft[k] = {};
    return S.draft[k];
  }

  function refreshSendButton() {
    const b = document.querySelector('[data-act="send"]'), n = Object.keys(S.draft).length;
    if (!b) return;
    b.disabled = !n;
    b.textContent = "🚀 TOUT envoyer" + (n ? ` (${n} niveau${n > 1 ? "x" : ""})` : "");
  }

  function sendAll() {
    const keys = Object.keys(S.draft).filter(k => countDone(S.draft[k], listOfKey(k)) > 0 || noteOf(S.draft[k]));
    if (!keys.length) { toast("Rien à envoyer."); return; }
    const missing = keys.reduce((s, k) => s + (countDone(S.draft[k], listOfKey(k)) ? listOfKey(k).length - countDone(S.draft[k], listOfKey(k)) : 0), 0);
    if (missing && !confirm(`${missing} élément(s) ne sont pas renseignés. Envoyer quand même ?`)) return;
    const now = new Date().toISOString();
    keys.forEach(k => {
      const [magasin, palier, niveau] = k.split("|");
      const items = listOfKey(k).filter(d => S.draft[k][d] && S.draft[k][d].statut).map(d => {
        const v = S.draft[k][d];
        const it = { dechet: d, statut: v.statut };
        if (v.statut === "mal") { if (v.commentaire) it.commentaire = v.commentaire.trim(); if (v.photo) it.photo = v.photo; }
        return it;
      });
      const rec = { id: uid(), date: now, agent: S.user, magasin, palier, niveau, items };
      if (noteOf(S.draft[k])) rec.autre = noteOf(S.draft[k]);
      S.records.push(rec);
    });
    if (!saveRecords()) { S.records.splice(S.records.length - keys.length); return; }
    S.draft = {}; saveDraft();
    toast(`✓ ${keys.length} niveau${keys.length > 1 ? "x" : ""} envoyé${keys.length > 1 ? "s" : ""} à ${frTime(new Date(now)).slice(0, 5)} — la saisie est vide, prête pour le prochain passage`);
    renderControle();
  }

  /* ---------------- Suivi : historique & supervision ---------------- */
  function renderSuivi(tab) {
    header("Supervision", "Suivi — " + CFG.organisation,
      `<button class="hbtn" data-act="go" data-to="#/controle">← Contrôle</button>${userBox()}`);
    $app.className = "wide";
    $app.innerHTML = `
      <div class="row">
        <button class="pill round dark ${tab === "historique" ? "on" : ""}" data-act="go" data-to="#/suivi/historique">Historique</button>
        <button class="pill round dark ${tab === "dashboard" ? "on" : ""}" data-act="go" data-to="#/suivi/tableau">📊 Tableau de bord</button>
        <button class="pill round dark ${tab === "analyse" ? "on" : ""}" data-act="go" data-to="#/suivi/analyse">📈 Analyse par étage</button>
        ${can("supervision") ? `<button class="pill round dark ${tab === "supervision" ? "on" : ""}" data-act="go" data-to="#/suivi/supervision">📅 Supervision</button>` : ""}
        ${can("comptes") ? `<button class="pill round dark ${tab === "comptes" ? "on" : ""}" data-act="go" data-to="#/suivi/comptes">👥 Comptes</button>` : ""}
      </div>
      <div id="suivi-body"></div>
      ${can("demo") || can("wipe") ? `<div class="row mt2" style="justify-content:center;gap:16px">
        ${can("demo") ? `<button class="linkbtn" data-act="demo">Générer des données de démo</button>` : ""}
        ${can("wipe") ? `<button class="linkbtn" data-act="wipe">Effacer tout l'historique</button>` : ""}
      </div>` : ""}`;
    if (tab === "supervision") renderSupervision();
    else if (tab === "analyse") renderAnalyse();
    else if (tab === "dashboard") renderDashboard();
    else if (tab === "comptes") renderComptes();
    else renderHistorique();
  }

  const agents = () => [...new Set([S.user, ...S.records.map(r => r.agent)].filter(Boolean))].sort((a, b) => a.localeCompare(b));

  function periodRange(p) {
    const now = new Date(), t = ymd(now);
    if (p === "jour") return [t, t];
    if (p === "semaine") { const d = new Date(now); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return [ymd(d), t]; }
    if (p === "mois") return [ymd(new Date(now.getFullYear(), now.getMonth(), 1)), t];
    if (p === "annee") return [ymd(new Date(now.getFullYear(), 0, 1)), t];
    if (p === "7j") return [ymd(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6)), t];
    if (p === "30j") return [ymd(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29)), t];
    if (p === "moisprec") return [ymd(new Date(now.getFullYear(), now.getMonth() - 1, 1)), ymd(new Date(now.getFullYear(), now.getMonth(), 0))];
    if (p === "3mois") return [ymd(new Date(now.getFullYear(), now.getMonth() - 3, now.getDate() + 1)), t];
    return ["", ""];
  }
  const PERIODS = [["", "Toutes dates"], ["jour", "Aujourd'hui"], ["7j", "7 derniers jours"], ["semaine", "Cette semaine"], ["30j", "30 derniers jours"],
    ["mois", "Ce mois"], ["moisprec", "Mois dernier"], ["3mois", "3 derniers mois"], ["annee", "Cette année"]];
  const periodPills = F => PERIODS.map(([k, l]) => {
    const on = k ? F.period === k : !F.period && !F.du && !F.au;
    return `<button class="pill round ${on ? "on" : ""}" data-act="period" data-p="${k}">${l}</button>`;
  }).join("");
  const fr = d => d.split("-").reverse().join("/");
  const rangeLabel = F => F.du && F.au ? (F.du === F.au ? `le ${fr(F.du)}` : `du ${fr(F.du)} au ${fr(F.au)}`)
    : F.du ? `depuis le ${fr(F.du)}` : F.au ? `jusqu'au ${fr(F.au)}` : "toutes dates";

  function renderHistorique() {
    const F = S.hist;
    const mag = CFG.magasins.find(m => m.nom === F.mag);
    const palOptions = mag ? mag.paliers : CFG.magasins.flatMap(m => m.paliers).filter((p, i, a) => a.findIndex(x => x.nom === p.nom) === i);
    // Étages proposés : ceux du palier choisi, sinon de tous les paliers du magasin (ou de tous les magasins).
    const nivPals = (mag ? mag.paliers : CFG.magasins.flatMap(m => m.paliers)).filter(p => !F.pal || p.nom === F.pal);
    const nivOptions = [...new Set(nivPals.flatMap(p => p.niveaux))];
    if (F.niv && !nivOptions.includes(F.niv)) F.niv = "";
    const opt = (v, label, cur) => `<option value="${h(v)}" ${v === cur ? "selected" : ""}>${h(label)}</option>`;

    document.getElementById("suivi-body").innerHTML = `
      <div class="row between mt2">
        <button class="btn" data-act="refresh">↻ Actualiser</button>
        <div class="row">
          <button class="btn" data-act="csv">⬇ Exporter CSV</button>
          <button class="btn" data-act="pdf">📄 Mal triés (PDF)</button>
          <button class="btn" data-act="xlsx">📗 Mal triés (Excel)</button>
        </div>
      </div>
      <div class="row mt">
        <span class="label">Période</span>
        ${periodPills(F)}
      </div>
      <div class="row mt filters">
        <select data-f="mag" aria-label="Magasin">${opt("", "Tous magasins", F.mag)}${CFG.magasins.map(m => opt(m.nom, m.nom, F.mag)).join("")}</select>
        <select data-f="pal" aria-label="Palier">${opt("", "Tous paliers", F.pal)}${palOptions.map(p => opt(p.nom, p.nom, F.pal)).join("")}</select>
        <select data-f="niv" aria-label="Étage">${opt("", "Tous étages", F.niv)}${nivOptions.map(n => opt(n, n, F.niv)).join("")}</select>
        <select data-f="agent" aria-label="Agent">${opt("", "Tous agents", F.agent)}${agents().map(a => opt(a, a, F.agent)).join("")}</select>
        <select data-f="statut" aria-label="Statut">${opt("", "Tous statuts", F.statut)}${Object.entries(STATUTS).map(([k, s]) => opt(k, s.label, F.statut)).join("")}</select>
        <label class="dt">Du <input type="date" data-f="du" value="${F.du}"></label>
        <label class="dt">Au <input type="date" data-f="au" value="${F.au}"></label>
        <input type="search" data-f="q" placeholder="Recherche libre…" value="${h(F.q)}">
      </div>
      <div id="hist-results"></div>`;

    document.querySelectorAll("#suivi-body [data-f]").forEach(el => {
      const ev = el.tagName === "SELECT" || el.type === "date" ? "change" : "input";
      el.addEventListener(ev, () => {
        F[el.dataset.f] = el.value; F.page = 0;
        if (el.dataset.f === "du" || el.dataset.f === "au") F.period = "";
        if (el.dataset.f === "mag") { F.pal = ""; F.niv = ""; renderHistorique(); }
        else if (el.dataset.f === "pal") renderHistorique();
        else renderHistResults();
        if (el.type === "date") document.querySelectorAll('[data-act="period"]').forEach(b => b.classList.remove("on"));
      });
    });
    renderHistResults();
  }

  function filteredRecords() {
    const F = S.hist, q = F.q.trim().toLowerCase();
    const out = [];
    for (const r of S.records) {
      const d = new Date(r.date), day = ymd(d);
      if (F.mag && r.magasin !== F.mag) continue;
      if (F.pal && r.palier !== F.pal) continue;
      if (F.niv && r.niveau !== F.niv) continue;
      if (F.agent && r.agent !== F.agent) continue;
      if (F.du && day < F.du) continue;
      if (F.au && day > F.au) continue;
      if (q) {
        const txt = [r.magasin, r.palier, r.niveau, r.agent, r.autre || "", ...r.items.map(i => i.dechet + " " + (i.commentaire || "") + " " + STATUTS[i.statut].label)].join(" ").toLowerCase();
        if (!txt.includes(q)) continue;
      }
      const items = F.statut ? r.items.filter(i => i.statut === F.statut) : r.items;
      if (!items.length && !(r.autre && !F.statut)) continue;
      out.push({ ...r, items });
    }
    return out.sort((a, b) => b.date.localeCompare(a.date));
  }

  // Miniature de la photo d'un mal trié ; un clic l'ouvre en grand.
  const photoThumb = (r, i) => i.photo
    ? `<button class="thumb" data-act="showphoto" data-id="${r.id}" data-d="${h(i.dechet)}" title="Agrandir la photo"><img src="${i.photo}" alt="Photo ${h(i.dechet)}" loading="lazy"><span>🔍 Agrandir</span></button>`
    : "";

  function renderHistResults() {
    const F = S.hist, recs = filteredRecords();
    const all = recs.flatMap(r => r.items);
    const n = { bien: 0, mal: 0, na: 0 };
    all.forEach(i => n[i.statut]++);
    const respect = n.bien + n.mal ? (n.bien / (n.bien + n.mal) * 100).toFixed(1) + "%" : "—";
    const size = F.size || recs.length || 1;
    const pages = Math.max(1, Math.ceil(recs.length / size));
    F.page = Math.min(F.page, pages - 1);
    const from = F.page * size, page = recs.slice(from, from + size);

    const cards = page.map(r => {
      const d = new Date(r.date);
      return `<section class="card rec">
        <div class="rec-head"><b>${h(r.magasin)} — ${h(r.palier)} — ${h(r.niveau)}</b><small>${h(r.agent)} · ${frDate(d)} ${frTime(d)}</small></div>
        ${r.items.map(i => `<div class="rec-line">
          <div>${h(i.dechet)}${i.commentaire ? `<div class="cm">💬 ${h(i.commentaire)}</div>` : ""}${photoThumb(r, i)}</div>
          <div class="row" style="flex-wrap:nowrap">
            
            <span class="tag ${i.statut}">${STATUTS[i.statut].label}</span>
          </div></div>`).join("")}
        ${r.autre ? `<div class="rec-line note-line"><div>${h(TEXTE || "Autre")}</div><div class="note-text">${h(r.autre)}</div></div>` : ""}
      </section>`;
    }).join("");

    document.getElementById("hist-results").innerHTML = `
      <div class="stats mt">
        <div class="stat"><b>${all.length}</b><span>Éléments contrôlés</span></div>
        <div class="stat g"><b>${n.bien}</b><span>Bien triés</span></div>
        <div class="stat r"><b>${n.mal}</b><span>Mal triés</span></div>
        <div class="stat n"><b>${n.na}</b><span>Non applicable</span></div>
        <div class="stat"><b>${respect}</b><span>Respect du tri</span></div>
      </div>
      <div class="row between mt">
        <div class="row">
          <span class="label">Afficher</span>
          ${[10, 20, 50, 0].map(s => `<button class="pill round dark ${F.size === s ? "on" : ""}" data-act="size" data-s="${s}">${s || "Sans limite"}</button>`).join("")}
        </div>
        <div class="row">
          <span class="label" style="letter-spacing:0;text-transform:none">${recs.length ? `${from + 1}–${Math.min(from + size, recs.length)} sur ${recs.length}` : "0 contrôle"}</span>
          ${pages > 1 ? `<button class="pill" data-act="page" data-d="-1" ${F.page === 0 ? "disabled" : ""}>‹</button><button class="pill" data-act="page" data-d="1" ${F.page >= pages - 1 ? "disabled" : ""}>›</button>` : ""}
        </div>
      </div>
      ${cards || `<div class="card empty mt">Aucun contrôle pour ces critères.${S.records.length || !can("demo") ? "" : `<br><br><button class="btn" data-act="demo">Générer des données de démo</button>`}</div>`}`;
  }

  /* ---------------- Exports ---------------- */
  function exportRows(onlyMal) {
    const rows = [];
    filteredRecords().forEach(r => {
      const d = new Date(r.date);
      r.items.forEach(i => {
        if (onlyMal && i.statut !== "mal") return;
        rows.push({ r, i, d, cols: [frDate(d), frTime(d), r.agent, r.magasin, r.palier, r.niveau, i.dechet, STATUTS[i.statut].label, i.commentaire || "", i.photo ? "Oui" : "Non"] });
      });
      if (!onlyMal && r.autre) rows.push({ r, i: { dechet: TEXTE || "Autre" }, d, cols: [frDate(d), frTime(d), r.agent, r.magasin, r.palier, r.niveau, TEXTE || "Autre", "Texte libre", r.autre, "Non"] });
    });
    return rows;
  }
  const HEAD = ["Date", "Heure", "Agent", "Magasin", "Palier", "Niveau", "Déchet", "Statut", "Commentaire", "Photo"];
  const stamp = () => ymd(new Date());

  function exportCsv() {
    const rows = exportRows(false);
    if (!rows.length) return toast("Aucune donnée à exporter.");
    const q = v => /[;"\n]/.test(v) ? `"${String(v).replace(/"/g, '""')}"` : v;
    const csv = [HEAD, ...rows.map(x => x.cols)].map(r => r.map(q).join(";")).join("\r\n");
    download(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }), `controles-tri-${stamp()}.csv`);
  }
  function exportXlsx() {
    const rows = exportRows(true);
    if (!rows.length) return toast("Aucun élément mal trié pour ces critères.");
    download(XlsxWriter.build([HEAD, ...rows.map(x => x.cols)], "Mal triés"), `mal-tries-${stamp()}.xlsx`);
  }
  function exportPdf() {
    const rows = exportRows(true);
    if (!rows.length) return toast("Aucun élément mal trié pour ces critères.");
    const F = S.hist;
    const crit = [F.du && "du " + F.du.split("-").reverse().join("/"), F.au && "au " + F.au.split("-").reverse().join("/"),
      F.mag, F.pal, F.niv, F.agent].filter(Boolean).join(" · ") || "Toutes périodes";
    const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>Mal triés ${stamp()}</title>
      <style>
        body{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1C2321;margin:24px;font-size:11px}
        h1{font-size:18px;margin:0}.sub{color:#777;margin:4px 0 16px}
        table{width:100%;border-collapse:collapse}th{background:#1C2321;color:#fff;text-align:left;padding:6px;font-size:10px}
        td{border-bottom:1px solid #ddd;padding:6px;vertical-align:top}tr{page-break-inside:avoid}
        img{max-width:110px;max-height:90px;border-radius:4px}
        @page{size:A4 landscape;margin:12mm}
      </style></head><body>
      <h1>Éléments mal triés — ${h(CFG.organisation)}</h1>
      <div class="sub">${h(crit)} · ${rows.length} élément(s) · édité le ${frDate(new Date())} par ${h(S.user)}</div>
      <table><thead><tr><th>Date</th><th>Agent</th><th>Magasin</th><th>Palier</th><th>Niveau</th><th>Déchet</th><th>Commentaire</th><th>Photo</th></tr></thead><tbody>
      ${rows.map(({ r, i, d }) => `<tr><td>${frDate(d)} ${frTime(d).slice(0, 5)}</td><td>${h(r.agent)}</td><td>${h(r.magasin)}</td><td>${h(r.palier)}</td><td>${h(r.niveau)}</td><td>${h(i.dechet)}</td><td>${h(i.commentaire || "")}</td><td>${i.photo ? `<img src="${i.photo}">` : ""}</td></tr>`).join("")}
      </tbody></table></body></html>`;
    const frame = document.createElement("iframe");
    frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
    document.body.appendChild(frame);
    frame.srcdoc = html;
    frame.onload = () => {
      setTimeout(() => {
        try { frame.contentWindow.focus(); frame.contentWindow.print(); }
        catch (e) { download(new Blob([html], { type: "text/html" }), `mal-tries-${stamp()}.html`); }
        setTimeout(() => frame.remove(), 60000);
      }, 300);
    };
    toast("Choisis « Enregistrer au format PDF » dans la fenêtre d'impression.");
  }

  /* ---------------- Analyse par étage ---------------- */
  // Taux de tri = bien triés / (bien triés + mal triés). Les "Non applicable" ne comptent pas.
  const rateOf = c => (c && c.bien + c.mal ? c.bien / (c.bien + c.mal) * 100 : null);
  const rateCls = r => (r === null ? "none" : r >= 80 ? "g" : r >= 50 ? "a" : "r");
  const rateTxt = r => (r === null ? "—" : Math.round(r) + "%");
  const zero = () => ({ bien: 0, mal: 0, na: 0 });
  const addC = (a, b) => { a.bien += b.bien; a.mal += b.mal; a.na += b.na; return a; };

  // Contrôles filtrés par période / magasin / palier / agent (sans statut ni recherche).
  function baseRecords() {
    const F = S.hist;
    return S.records.filter(r => {
      const day = ymd(new Date(r.date));
      return (!F.mag || r.magasin === F.mag) && (!F.pal || r.palier === F.pal) && (!F.agent || r.agent === F.agent)
        && (!F.du || day >= F.du) && (!F.au || day <= F.au);
    });
  }

  // Statistiques par niveau : { "mag|pal|niv": { n: nbContrôles, last, d: { déchet: {bien,mal,na} } } }
  function floorStats(recs) {
    const m = {};
    recs.forEach(r => {
      const k = nKey(r.magasin, r.palier, r.niveau);
      const s = m[k] || (m[k] = { n: 0, last: "", d: {} });
      s.n++; if (r.date > s.last) s.last = r.date;
      r.items.forEach(i => { (s.d[i.dechet] || (s.d[i.dechet] = zero()))[i.statut]++; });
    });
    return m;
  }
  const totalOf = s => ALL_DECHETS.reduce((t, d) => addC(t, (s && s.d[d]) || zero()), zero());

  function filterBar() {
    const F = S.hist;
    const mag = CFG.magasins.find(m => m.nom === F.mag);
    const palOptions = mag ? mag.paliers : CFG.magasins.flatMap(m => m.paliers).filter((p, i, a) => a.findIndex(x => x.nom === p.nom) === i);
    const opt = (v, label, cur) => `<option value="${h(v)}" ${v === cur ? "selected" : ""}>${h(label)}</option>`;
    return `
      <div class="row mt">
        <span class="label">Période</span>
        ${periodPills(F)}
      </div>
      <div class="row mt filters">
        <select data-f="mag" aria-label="Magasin">${opt("", "Tous magasins", F.mag)}${CFG.magasins.map(m => opt(m.nom, m.nom, F.mag)).join("")}</select>
        <select data-f="pal" aria-label="Palier">${opt("", "Tous paliers", F.pal)}${palOptions.map(p => opt(p.nom, p.nom, F.pal)).join("")}</select>
        <select data-f="agent" aria-label="Agent">${opt("", "Tous agents", F.agent)}${agents().map(a => opt(a, a, F.agent)).join("")}</select>
        <label class="dt">Du <input type="date" data-f="du" value="${F.du}"></label>
        <label class="dt">Au <input type="date" data-f="au" value="${F.au}"></label>
      </div>`;
  }

  // Semaines (du lundi) couvrant la période choisie ; 12 dernières semaines si aucune date.
  function weeksForRange(du, au) {
    const end = au ? new Date(au + "T12:00:00") : new Date();
    let start = du ? new Date(du + "T12:00:00") : new Date(end.getFullYear(), end.getMonth(), end.getDate() - 7 * 11);
    if (!du && !au) {
      const first = S.records.length ? new Date(S.records.reduce((a, r) => (r.date < a ? r.date : a), S.records[0].date)) : start;
      if (first > start) start = first;
    }
    const mon = d => new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));
    const out = [];
    for (let w = mon(start); w <= end && out.length < 104; w = new Date(w.getFullYear(), w.getMonth(), w.getDate() + 7)) {
      const e = new Date(w.getFullYear(), w.getMonth(), w.getDate() + 7);
      out.push({ start: w, end: e, label: "S" + isoWeek(w), sub: `${pad(w.getDate())}/${pad(w.getMonth() + 1)}` });
    }
    return out;
  }

  // Fiche "taux de respect du tri" d'une poubelle sur un étage, pour la période choisie.
  let focusData = null;
  function focusCard(mag, pal, niv, dechet) {
    const F = S.hist;
    const recs = baseRecords().filter(r => r.magasin === mag.nom && r.palier === pal.nom && r.niveau === niv);
    const c = zero(); let n = 0;
    recs.forEach(r => r.items.forEach(i => { if (i.dechet === dechet) { c[i.statut]++; n++; } }));
    const r = rateOf(c);
    const weeks = weeksForRange(F.du, F.au);
    const wk = weeks.map(() => zero());
    recs.forEach(rec => {
      const t = new Date(rec.date).getTime();
      const wi = weeks.findIndex(w => t >= w.start.getTime() && t < w.end.getTime());
      if (wi >= 0) rec.items.forEach(i => { if (i.dechet === dechet) wk[wi][i.statut]++; });
    });
    focusData = { weeks, series: [{ key: "focus", nom: dechet, full: `${dechet} — ${pal.nom} ${niv}`, color: SERIES_COLORS[0], rates: wk.map(rateOf) }] };
    return `<section class="card mt focus">
      <div class="detail-head">
        <div>
          <div class="label">Taux de respect du tri</div>
          <h2 style="font-family:var(--sans);font-size:16px">${h(dechet)}</h2>
          <div class="cat-n">${h(mag.nom)} — ${h(pal.nom)} — <b>${h(niv)}</b> · ${rangeLabel(F)}${F.agent ? " · " + h(F.agent) : ""}</div>
        </div>
        <div class="big-rate ${rateCls(r)}"><b>${rateTxt(r)}</b><span>${n} contrôle${n > 1 ? "s" : ""} de cette poubelle</span></div>
      </div>
      <div class="stats" style="padding:0 12px 6px">
        <div class="stat g"><b>${c.bien}</b><span>Bien triés</span></div>
        <div class="stat r"><b>${c.mal}</b><span>Mal triés</span></div>
        <div class="stat n"><b>${c.na}</b><span>Non applicable</span></div>
      </div>
      <div class="label" style="padding:8px 12px 0">Évolution semaine par semaine</div>
      <div class="chart" id="chart"></div>
    </section>`;
  }
  function drawFocusChart() { if (focusData) drawChart(focusData.weeks, focusData.series); }

  // Remarques libres ("Autre") : pas de taux ni de graphique, juste le texte, étage par étage.
  function notesByFloor(mags) {
    const F = S.hist, recs = baseRecords().filter(r => r.autre);
    const cards = mags.flatMap(m => m.paliers.filter(p => !F.pal || p.nom === F.pal).map(p => {
      const rows = p.niveaux.map(n => {
        const list = recs.filter(r => r.magasin === m.nom && r.palier === p.nom && r.niveau === n)
          .sort((a, b) => b.date.localeCompare(a.date));
        return `<div class="note-floor">
          <div class="note-floor-name">${h(n)}${list.length ? ` <span class="note-count">${list.length}</span>` : ""}</div>
          <div class="note-floor-list">${list.length ? list.map(r => `<div class="note-entry">
              <span>📝 ${h(r.autre)}</span>
              <small>${h(r.agent)} · ${frDate(new Date(r.date))} ${frTime(new Date(r.date)).slice(0, 5)}</small>
            </div>`).join("") : `<span class="note-none">Aucune remarque</span>`}</div>
        </div>`;
      }).join("");
      return `<section class="card mt">
        <div class="card-head"><h2 style="font-family:var(--sans);font-size:13px">${h(m.nom)} — ${h(p.nom)}</h2>
          <span class="count">${recs.filter(r => r.magasin === m.nom && r.palier === p.nom).length} remarque(s)</span></div>
        ${rows}
      </section>`;
    })).join("");
    return `<div class="label mt2">Remarques « ${h(TEXTE)} » par étage · ${rangeLabel(F)}</div>${cards}`;
  }

  function renderAnalyse() {
    const A = S.ana, F = S.hist;
    const stats = floorStats(baseRecords());

    // --- Étage choisi ---
    A.mag = Math.min(A.mag, CFG.magasins.length - 1);
    const mag = CFG.magasins[A.mag];
    A.pal = Math.min(A.pal, mag.paliers.length - 1);
    const pal = mag.paliers[A.pal];
    A.niv = Math.min(A.niv, pal.niveaux.length - 1);
    const niv = pal.niveaux[A.niv];
    const LIST = dechetsOf(mag.nom, pal.nom, niv);
    if (A.dechet && !LIST.includes(A.dechet)) A.dechet = "";
    const st = stats[nKey(mag.nom, pal.nom, niv)];
    const tot = totalOf(st), gRate = rateOf(tot);

    const catRows = LIST.map(d => {
      const c = (st && st.d[d]) || zero(), r = rateOf(c);
      return `<div class="cat ${d === A.dechet ? "cat-sel" : ""}" data-act="pickdechet" data-d="${h(d)}" title="Voir le détail de ${h(d)} sur cet étage">
        <div class="cat-top"><span>${h(d)}</span><b class="rate ${rateCls(r)}">${rateTxt(r)}</b></div>
        <div class="bar"><span class="${rateCls(r)}" style="width:${r === null ? 0 : r}%"></span></div>
        <div class="cat-n"><span class="g">${c.bien} bien trié${c.bien > 1 ? "s" : ""}</span> · <span class="r">${c.mal} mal trié${c.mal > 1 ? "s" : ""}</span> · ${c.na} non applicable</div>
      </div>`;
    }).join("");

    const malList = baseRecords()
      .filter(r => r.magasin === mag.nom && r.palier === pal.nom && r.niveau === niv)
      .sort((a, b) => b.date.localeCompare(a.date))
      .flatMap(r => r.items.filter(i => i.statut === "mal").map(i => ({ r, i })))
      .slice(0, 8);
    const noteList = baseRecords()
      .filter(r => r.autre && r.magasin === mag.nom && r.palier === pal.nom && r.niveau === niv)
      .sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);

    const optIdx = (arr, cur, lab) => arr.map((x, i) => `<option value="${i}" ${i === cur ? "selected" : ""}>${h(lab(x))}</option>`).join("");

    // --- Tableau de tous les étages ---
    const mags = CFG.magasins.filter(m => !F.mag || m.nom === F.mag);
    const tables = mags.flatMap(m => m.paliers.filter(p => !F.pal || p.nom === F.pal).map(p => {
      const PD = [...new Set(p.niveaux.flatMap(n => dechetsOf(m.nom, p.nom, n)))];
      const palTot = {}; PD.forEach(d => (palTot[d] = zero()));
      let palN = 0;
      const rows = p.niveaux.map((n, ni) => {
        const s = stats[nKey(m.nom, p.nom, n)];
        if (s) { palN += s.n; PD.forEach(d => addC(palTot[d], s.d[d] || zero())); }
        const isSel = m === mag && p === pal && n === niv;
        const L = dechetsOf(m.nom, p.nom, n);
        const cells = PD.map(d => {
          if (!L.includes(d)) return `<td class="cell none" title="Pas de poubelle ${h(d)} à cet étage"></td>`;
          const c = (s && s.d[d]) || zero(), r = rateOf(c);
          return `<td class="cell ${rateCls(r)}" title="${h(d)} : ${c.bien} bien / ${c.mal} mal / ${c.na} NA">${rateTxt(r)}</td>`;
        }).join("");
        const g = rateOf(totalOf(s));
        return `<tr class="${isSel ? "sel" : ""}" data-act="pickfloor" data-m="${CFG.magasins.indexOf(m)}" data-p="${m.paliers.indexOf(p)}" data-n="${ni}">
          <th>${h(n)}</th>${cells}<td class="cell tot ${rateCls(g)}">${rateTxt(g)}</td><td class="nb">${s ? s.n : 0}</td></tr>`;
      }).join("");
      const allTot = PD.reduce((t, d) => addC(t, palTot[d]), zero());
      return `<section class="card mt">
        <div class="card-head"><h2 style="font-family:var(--sans);font-size:13px">${h(m.nom)} — ${h(p.nom)}</h2><span class="count">Taux global ${rateTxt(rateOf(allTot))}</span></div>
        <div class="matrix-wrap"><table class="matrix">
          <thead><tr><th>Étage</th>${PD.map(d => `<th>${h(d)}</th>`).join("")}<th>Global</th><th>Contrôles</th></tr></thead>
          <tbody>${rows}</tbody>
          <tfoot><tr><th>Total</th>${PD.map(d => { const r = rateOf(palTot[d]); return `<td class="cell ${rateCls(r)}">${rateTxt(r)}</td>`; }).join("")}
            <td class="cell tot ${rateCls(rateOf(allTot))}">${rateTxt(rateOf(allTot))}</td><td class="nb">${palN}</td></tr></tfoot>
        </table></div>
      </section>`;
    })).join("");

    document.getElementById("suivi-body").innerHTML = `
      <div class="row between mt2">
        <button class="btn" data-act="refresh">↻ Actualiser</button>
        <button class="btn" data-act="anaxlsx">📗 Exporter l'analyse (Excel)</button>
      </div>
      ${filterBar()}

      <div class="label mt2">Étage à analyser</div>
      <div class="row mt filters">
        <select id="ana-mag" aria-label="Magasin">${optIdx(CFG.magasins, A.mag, x => x.nom)}</select>
        <select id="ana-pal" aria-label="Palier">${optIdx(mag.paliers, A.pal, x => x.nom)}</select>
        <button class="pill" data-act="stepfloor" data-d="-1" ${A.niv === 0 ? "disabled" : ""}>‹</button>
        <select id="ana-niv" aria-label="Étage">${optIdx(pal.niveaux, A.niv, x => x)}</select>
        <button class="pill" data-act="stepfloor" data-d="1" ${A.niv >= pal.niveaux.length - 1 ? "disabled" : ""}>›</button>
        <select id="ana-dechet" aria-label="Poubelle">
          <option value="">Toutes les poubelles</option>
          ${LIST.map(d => `<option value="${h(d)}" ${d === A.dechet ? "selected" : ""}>${h(d)}</option>`).join("")}
        </select>
      </div>
      ${A.dechet ? focusCard(mag, pal, niv, A.dechet) : ""}

      <section class="card mt" id="ana-detail">
        <div class="detail-head">
          <div>
            <div class="label">${h(mag.nom)} — ${h(pal.nom)}</div>
            <h2>${h(niv)}</h2>
            <div class="cat-n">${rangeLabel(F)} · ${st ? `${st.n} contrôle${st.n > 1 ? "s" : ""} · dernier le ${frDate(new Date(st.last))}` : "aucun contrôle sur cette période"}</div>
          </div>
          <div class="big-rate ${rateCls(gRate)}"><b>${rateTxt(gRate)}</b><span>Taux de tri de l'étage</span></div>
        </div>
        <div class="stats" style="padding:0 12px 12px">
          <div class="stat g"><b>${tot.bien}</b><span>Bien triés</span></div>
          <div class="stat r"><b>${tot.mal}</b><span>Mal triés</span></div>
          <div class="stat n"><b>${tot.na}</b><span>Non applicable</span></div>
        </div>
        <div class="cats">${catRows}</div>
        ${noteList.length ? `<div class="mal-list">
          <div class="label" style="margin-bottom:6px">Dernières remarques « ${h(TEXTE || "Autre")} »</div>
          ${noteList.map(r => `<div class="rec-line" style="padding:6px 0"><div class="cm" style="margin:0">📝 ${h(r.autre)}</div>
            <small class="label" style="letter-spacing:0;white-space:nowrap">${h(r.agent)} · ${frDate(new Date(r.date))}</small></div>`).join("")}
        </div>` : ""}
        ${malList.length ? `<div class="mal-list">
          <div class="label" style="margin-bottom:6px">Derniers mal triés de l'étage</div>
          ${malList.map(({ r, i }) => `<div class="rec-line" style="padding:6px 0">
            <div>${h(i.dechet)}${i.commentaire ? `<div class="cm">💬 ${h(i.commentaire)}</div>` : ""}${photoThumb(r, i)}</div>
            <div class="row" style="flex-wrap:nowrap">
              
              <small class="label" style="letter-spacing:0">${h(r.agent)} · ${frDate(new Date(r.date))}</small>
            </div></div>`).join("")}
        </div>` : ""}
      </section>

      <div class="row between mt2">
        <span class="label">Taux de tri par étage et par poubelle</span>
        <span class="legend" style="padding:0">
          <span><span class="sw g"></span>≥ 80 %</span><span><span class="sw a"></span>50–79 %</span><span><span class="sw r"></span>&lt; 50 %</span>
        </span>
      </div>
      ${tables || `<div class="card empty mt">Aucun palier pour ces filtres.</div>`}
      <p class="label mt" style="letter-spacing:.04em;text-transform:none;line-height:1.5">
        Taux de tri = bien triés ÷ (bien triés + mal triés). Les « Non applicable » ne sont pas comptés.
        Clique sur une ligne du tableau pour voir le détail de l'étage.
      </p>`;

    bindFilters(renderAnalyse);
    document.getElementById("ana-mag").onchange = e => { A.mag = +e.target.value; A.pal = 0; A.niv = 0; renderAnalyse(); };
    document.getElementById("ana-pal").onchange = e => { A.pal = +e.target.value; A.niv = 0; renderAnalyse(); };
    document.getElementById("ana-niv").onchange = e => { A.niv = +e.target.value; renderAnalyse(); };
    document.getElementById("ana-dechet").onchange = e => { A.dechet = e.target.value; renderAnalyse(); };
    if (A.dechet) drawFocusChart();
  }

  function bindFilters(rerender) {
    const F = S.hist;
    document.querySelectorAll("#suivi-body [data-f]").forEach(el => {
      el.addEventListener("change", () => {
        F[el.dataset.f] = el.value; F.page = 0;
        if (el.dataset.f === "du" || el.dataset.f === "au") F.period = "";
        if (el.dataset.f === "mag") F.pal = "";
        rerender();
      });
    });
  }

  function exportAnalyse() {
    const stats = floorStats(baseRecords());
    const rows = [["Magasin", "Palier", "Étage", "Contrôles", ...ALL_DECHETS.map(d => d + " (%)"), "Global (%)", "Bien triés", "Mal triés", "Non applicable"]];
    CFG.magasins.filter(m => !S.hist.mag || m.nom === S.hist.mag).forEach(m =>
      m.paliers.filter(p => !S.hist.pal || p.nom === S.hist.pal).forEach(p =>
        p.niveaux.forEach(n => {
          const s = stats[nKey(m.nom, p.nom, n)], t = totalOf(s);
          const pct = r => (r === null ? "" : Math.round(r * 10) / 10);
          rows.push([m.nom, p.nom, n, s ? s.n : 0, ...ALL_DECHETS.map(d => (dechetsOf(m.nom, p.nom, n).includes(d) ? pct(rateOf(s && s.d[d])) : "")), pct(rateOf(t)), t.bien, t.mal, t.na]);
        })));
    download(XlsxWriter.build(rows, "Analyse par étage"), `analyse-etages-${stamp()}.xlsx`);
  }

  /* ---------------- Tableau de bord : évolution hebdomadaire par palier ---------------- */
  // Couleurs fixes par palier (suivent le palier, jamais son rang) – palette validée daltonisme.
  const SERIES_COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"];
  const ALL_PALIERS = CFG.magasins.flatMap(m => m.paliers.map(p => ({
    key: m.nom + "|" + p.nom,
    nom: p.nom,
    full: m.nom + " — " + p.nom
  }))).map((p, i) => ({ ...p, color: SERIES_COLORS[i % SERIES_COLORS.length] }));

  function isoWeek(d) {
    const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const day = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - day);
    const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
    return Math.ceil(((t - y0) / 86400000 + 1) / 7);
  }
  function lastWeeks(n) {
    const now = new Date();
    const mon = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
    const out = [];
    for (let i = n - 1; i >= 0; i--) {
      const start = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() - 7 * i);
      const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
      out.push({ start, end, label: "S" + isoWeek(start), sub: `${pad(start.getDate())}/${pad(start.getMonth() + 1)}` });
    }
    return out;
  }

  function dashData() {
    const D = S.dash, weeks = lastWeeks(D.weeks);
    const t0 = weeks[0].start.getTime();
    const per = {}; ALL_PALIERS.forEach(p => (per[p.key] = weeks.map(() => ({ ...zero(), n: 0 }))));
    const all = weeks.map(() => ({ ...zero(), n: 0 }));
    S.records.forEach(r => {
      if (D.agent && r.agent !== D.agent) return;
      const t = new Date(r.date).getTime();
      if (t < t0) return;
      const wi = weeks.findIndex(w => t >= w.start.getTime() && t < w.end.getTime());
      if (wi < 0) return;
      const arr = per[r.magasin + "|" + r.palier];
      r.items.forEach(i => {
        if (D.dechet && i.dechet !== D.dechet) return;
        if (arr) arr[wi][i.statut]++;
        all[wi][i.statut]++;
      });
      if (arr) arr[wi].n++;
    });
    const series = ALL_PALIERS.map(p => ({ ...p, rates: per[p.key].map(rateOf), counts: per[p.key] }));
    return { weeks, series, overall: all.map(rateOf) };
  }

  // Écart en points entre deux taux, affiché avec flèche.
  function deltaHtml(cur, prev, suffix) {
    if (cur === null || prev === null || cur === undefined || prev === undefined) return `<span class="delta flat">${suffix ? "pas de comparaison" : ""}</span>`;
    const d = Math.round(cur - prev);
    if (d > 0) return `<span class="delta up">▲ +${d} pt${d > 1 ? "s" : ""}${suffix || ""}</span>`;
    if (d < 0) return `<span class="delta down">▼ −${-d} pt${d < -1 ? "s" : ""}${suffix || ""}</span>`;
    return `<span class="delta flat">= stable${suffix || ""}</span>`;
  }
  const firstLast = arr => { const v = arr.filter(x => x !== null); return v.length >= 2 ? [v[0], v[v.length - 1]] : [null, null]; };

  // Courbes affichées, mémorisées sur l'appareil. Par défaut : tous les paliers, sans la courbe "Tous paliers".
  function dashShown() {
    let sh = S.dash.shown || store.get("dashShown", null);
    if (!sh) { sh = {}; ALL_PALIERS.forEach(p => (sh[p.key] = true)); }
    S.dash.shown = sh;
    return sh;
  }
  function setShown(sh) { S.dash.shown = sh; store.set("dashShown", sh); renderDashboard(); }

  function renderDashboard() {
    const D = S.dash;
    const { weeks, series: pals, overall } = dashData();
    // Courbe "Tous paliers" (moyenne de tous les paliers), en encre foncée.
    const series = [...pals, { key: "__all", nom: "Tous paliers", full: "Tous paliers", color: "#1C2321", rates: overall }];
    const shown = dashShown();
    const vis = series.filter(s => shown[s.key]);
    const n = weeks.length, cur = n - 1, prev = n - 2;

    const kpi = (key, name, color, rates, title) => {
      const [a, b] = firstLast(rates);
      let li = -1; rates.forEach((r, i) => { if (r !== null) li = i; });
      const v = li >= 0 ? rates[li] : null;
      const vs = li > 0 ? deltaHtml(v, rates[li - 1], " vs " + weeks[li - 1].label) : `<span class="delta flat">pas de comparaison</span>`;
      return `<button class="kpi ${shown[key] ? "" : "off"}" data-act="toggleserie" data-k="${h(key)}" title="${h(title || name)} — cliquer pour ${shown[key] ? "retirer" : "ajouter"} la courbe">
        <div class="kpi-name">${color ? `<span class="key" style="background:${color}"></span>` : ""}${h(name)}</div>
        <b class="rate ${rateCls(v)}">${rateTxt(v)}${li >= 0 && li !== cur ? `<small> en ${weeks[li].label}</small>` : ""}</b>
        <div>${li < 0 ? `<span class="delta flat">aucun contrôle</span>` : vs}</div>
        <div class="kpi-sub">Sur ${n} sem. : ${a === null ? "—" : deltaHtml(b, a)}</div>
        <span class="kpi-check">${shown[key] ? "✓ sur le graphique" : "+ ajouter au graphique"}</span>
      </button>`;
    };

    const opt = (v, label, curv) => `<option value="${h(v)}" ${v === curv ? "selected" : ""}>${h(label)}</option>`;

    const table = `<table class="matrix weekly">
      <thead><tr><th>Palier</th>${weeks.map(w => `<th>${w.label}<br><span style="font-weight:400">${w.sub}</span></th>`).join("")}<th>Évolution</th></tr></thead>
      <tbody>${vis.map(s => {
        const [a, b] = firstLast(s.rates);
        return `<tr class="${s.key === "__all" ? "all" : ""}"><th><span class="key" style="background:${s.color}"></span>${h(s.nom)}</th>${s.rates.map((r, i) => {
          const pr = i > 0 ? s.rates[i - 1] : null;
          const arrow = r === null || pr === null ? "" : r > pr + 0.5 ? `<i class="up">▲</i>` : r < pr - 0.5 ? `<i class="down">▼</i>` : `<i class="flat">=</i>`;
          return `<td class="cell ${rateCls(r)}" title="${h(s.full)} · ${weeks[i].label}">${rateTxt(r)}${arrow}</td>`;
        }).join("")}<td>${a === null ? "—" : deltaHtml(b, a)}</td></tr>`;
      }).join("")}
      </tbody></table>`;

    document.getElementById("suivi-body").innerHTML = `
      <div class="row between mt2">
        <button class="btn" data-act="refresh">↻ Actualiser</button>
        <button class="btn" data-act="dashxlsx">📗 Exporter (Excel)</button>
      </div>
      <div class="row mt filters">
        <span class="label">Période</span>
        ${[8, 12, 26, 52].map(w => `<button class="pill round ${D.weeks === w ? "on" : ""}" data-act="weeks" data-w="${w}">${w} semaines</button>`).join("")}
      </div>
      <div class="row mt filters">
        <select id="dash-agent" aria-label="Agent">${opt("", "Tous agents", D.agent)}${agents().map(a => opt(a, a, D.agent)).join("")}</select>
        <select id="dash-dechet" aria-label="Poubelle">${opt("", "Toutes poubelles", D.dechet)}${ALL_DECHETS.map(d => opt(d, d, D.dechet)).join("")}</select>
      </div>

      <div class="label mt2">Semaine en cours (${weeks[cur].label}) — taux de tri et évolution</div>
      <div class="kpis mt">
        ${series.map(s => kpi(s.key, s.nom, s.color, s.rates, s.full)).join("")}
      </div>

      <section class="card mt chart-card">
        <div class="card-head" style="border:0;padding-bottom:4px">
          <h2 style="font-family:var(--sans);font-size:13px">Taux de tri hebdomadaire par palier${D.dechet ? " · " + h(D.dechet) : ""}</h2>
        </div>
        <div class="chooser">
          <span class="label">Courbes affichées · ${vis.length}/${series.length}</span>
          <div class="chips">${series.map(s => `<span class="chip ${shown[s.key] ? "on" : ""}">
            <button class="chip-main" data-act="toggleserie" data-k="${h(s.key)}" aria-pressed="${!!shown[s.key]}" title="${shown[s.key] ? "Retirer" : "Ajouter"} la courbe ${h(s.full)}">
              <span class="box">${shown[s.key] ? "✓" : ""}</span><span class="lkey" style="background:${s.color}"></span>${h(s.nom)}
            </button>
            <button class="chip-solo" data-act="soloserie" data-k="${h(s.key)}" title="Afficher uniquement ${h(s.full)}">seule</button>
          </span>`).join("")}</div>
          <div class="row" style="gap:12px">
            <button class="linkbtn" data-act="showall">Tout afficher</button>
            <button class="linkbtn" data-act="showpals">Paliers seulement</button>
          </div>
        </div>
        <div class="chart" id="chart"></div>
      </section>

      <div class="label mt2">Détail semaine par semaine</div>
      <section class="card mt">${vis.length ? `<div class="matrix-wrap">${table}</div>` : `<div class="empty">Aucune courbe sélectionnée.</div>`}</section>
      <p class="label mt" style="letter-spacing:.04em;text-transform:none;line-height:1.5">
        Taux de tri = bien triés ÷ (bien triés + mal triés). ▲ hausse / ▼ baisse par rapport à la semaine précédente, en points.
        La semaine en cours n'est pas terminée : son taux peut encore bouger.
      </p>`;

    document.getElementById("dash-agent").onchange = e => { D.agent = e.target.value; renderDashboard(); };
    document.getElementById("dash-dechet").onchange = e => { D.dechet = e.target.value; renderDashboard(); };
    drawChart(weeks, vis);
    // Le tableau s'ouvre sur les semaines les plus récentes.
    const tbl = document.querySelector("#suivi-body .weekly");
    if (tbl) tbl.parentElement.scrollLeft = tbl.parentElement.scrollWidth;
  }

  function drawChart(weeks, series) {
    const box = document.getElementById("chart");
    if (!box) return;
    const W = Math.max(300, box.clientWidth), small = W < 520;
    const H = small ? 240 : 300, m = { l: 34, r: small ? 64 : 96, t: 14, b: 34 };
    const pw = W - m.l - m.r, ph = H - m.t - m.b, n = weeks.length;
    const X = i => m.l + (n === 1 ? pw / 2 : (i * pw) / (n - 1));
    const Y = v => m.t + ph - (v / 100) * ph;
    const step = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(pw / 46))));

    let svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Courbe hebdomadaire du taux de tri par palier">`;
    [0, 25, 50, 75, 100].forEach(v => {
      svg += `<line x1="${m.l}" x2="${m.l + pw}" y1="${Y(v)}" y2="${Y(v)}" stroke="#ECE9E2" stroke-width="1"/>`;
      svg += `<text x="${m.l - 6}" y="${Y(v) + 3}" text-anchor="end" class="ax">${v}%</text>`;
    });
    weeks.forEach((w, i) => {
      if ((n - 1 - i) % step) return;
      svg += `<text x="${X(i)}" y="${H - m.b + 15}" text-anchor="middle" class="ax">${w.label}</text>`;
      svg += `<text x="${X(i)}" y="${H - m.b + 27}" text-anchor="middle" class="ax faint">${w.sub}</text>`;
    });

    const ends = [];
    series.forEach(s => {
      let d = "", pen = false;
      s.rates.forEach((r, i) => {
        if (r === null) { pen = false; return; }
        d += (pen ? "L" : "M") + X(i).toFixed(1) + " " + Y(r).toFixed(1) + " "; pen = true;
      });
      if (d) svg += `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
      // Semaines sans contrôle : on relie les points voisins en pointillés.
      let pi = -1;
      s.rates.forEach((r, i) => {
        if (r === null) return;
        if (pi >= 0 && i - pi > 1) svg += `<line x1="${X(pi)}" y1="${Y(s.rates[pi])}" x2="${X(i)}" y2="${Y(r)}" stroke="${s.color}" stroke-width="1.5" stroke-dasharray="3 4" opacity=".7"/>`;
        pi = i;
      });
      s.rates.forEach((r, i) => {
        if (r !== null) svg += `<circle cx="${X(i)}" cy="${Y(r)}" r="3.5" fill="${s.color}" stroke="#fff" stroke-width="2"/>`;
      });
      let li = -1; s.rates.forEach((r, i) => { if (r !== null) li = i; });
      if (li >= 0) ends.push({ s, y: Y(s.rates[li]), v: s.rates[li], x: X(li) });
    });
    // Étiquettes directes en bout de courbe, écartées pour ne pas se chevaucher.
    ends.sort((a, b) => a.y - b.y);
    for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 14) ends[i].y = ends[i - 1].y + 14;
    const over = ends.length ? ends[ends.length - 1].y - (m.t + ph + 4) : 0;
    if (over > 0) ends.forEach(e => (e.y -= over));
    ends.forEach(e => {
      svg += `<text x="${m.l + pw + 8}" y="${e.y + 3.5}" class="dl"><tspan class="dlv">${rateTxt(e.v)}</tspan> ${h(small || series.length === 1 ? "" : e.s.nom)}</text>`;
      svg += `<line x1="${m.l + pw + 2}" x2="${m.l + pw + 6}" y1="${e.y}" y2="${e.y}" stroke="${e.s.color}" stroke-width="2"/>`;
    });

    svg += `<line id="xh" x1="0" x2="0" y1="${m.t}" y2="${m.t + ph}" stroke="#1C2321" stroke-width="1" opacity="0"/>`;
    svg += `<rect id="hit" x="${m.l - 12}" y="${m.t}" width="${pw + 24}" height="${ph}" fill="transparent"/>`;
    svg += `</svg>`;
    if (!series.length) svg = `<div class="empty">Aucune courbe affichée. Coche un palier ci-dessus pour l'ajouter.</div>`;
    box.innerHTML = svg + `<div class="tip" id="tip" hidden></div>`;
    if (!series.length) return;

    const hit = document.getElementById("hit"), xh = document.getElementById("xh"), tip = document.getElementById("tip");
    const show = ev => {
      const rect = box.getBoundingClientRect();
      const px = ev.clientX - rect.left;
      const i = Math.max(0, Math.min(n - 1, Math.round(n === 1 ? 0 : ((px - m.l) / pw) * (n - 1))));
      xh.setAttribute("x1", X(i)); xh.setAttribute("x2", X(i)); xh.setAttribute("opacity", ".35");
      const w = weeks[i], endD = new Date(w.end.getTime() - 86400000);
      tip.innerHTML = `<div class="tip-h">${w.label} · ${w.sub} → ${pad(endD.getDate())}/${pad(endD.getMonth() + 1)}</div>` +
        series.map(s => {
          const r = s.rates[i], pr = i > 0 ? s.rates[i - 1] : null;
          return `<div class="tip-r"><span class="lkey" style="background:${s.color}"></span><b>${rateTxt(r)}</b><span class="tn">${h(s.nom)}</span>${r !== null && pr !== null ? deltaHtml(r, pr) : ""}</div>`;
        }).join("");
      tip.hidden = false;
      const tw = tip.offsetWidth;
      tip.style.left = (X(i) + 14 + tw > W ? X(i) - tw - 14 : X(i) + 14) + "px";
      tip.style.top = m.t + "px";
    };
    hit.addEventListener("pointermove", show);
    hit.addEventListener("pointerdown", show);
    hit.addEventListener("pointerleave", () => { tip.hidden = true; xh.setAttribute("opacity", "0"); });
  }
  let resizeT;
  window.addEventListener("resize", () => {
    clearTimeout(resizeT);
    resizeT = setTimeout(() => {
      if (!S.user) return;
      if (location.hash.includes("tableau")) renderDashboard();
      else if (location.hash.includes("analyse") && S.ana.dechet) drawFocusChart();
    }, 150);
  });

  function exportDashboard() {
    const { weeks, series, overall } = dashData();
    const pct = r => (r === null ? "" : Math.round(r * 10) / 10);
    const rows = [["Palier", ...weeks.map(w => `${w.label} (${w.sub})`)]];
    series.forEach(s => rows.push([s.full, ...s.rates.map(pct)]));
    rows.push(["Tous paliers", ...overall.map(pct)]);
    download(XlsxWriter.build(rows, "Taux hebdomadaire"), `taux-hebdo-paliers-${stamp()}.xlsx`);
  }

  /* ---------------- Gestion des comptes (admin) ---------------- */
  // Liste de travail : on part des comptes de config.js, l'admin modifie, puis copie le bloc généré dans config.js.
  let draftAccounts = null;
  const sameAccounts = () => JSON.stringify(draftAccounts) === JSON.stringify(ACCOUNTS);
  function accountsCode() {
    const q = v => JSON.stringify(v);
    return "  comptes: [\n" + draftAccounts.map(a =>
      `    { identifiant: ${q(a.identifiant)}, nom: ${q(a.nom)}, role: ${q(a.role)},\n      sel: ${q(a.sel)}, hash: ${q(a.hash)} }`).join(",\n") + "\n  ],";
  }

  function renderComptes(editId) {
    if (!can("comptes")) return;
    if (!draftAccounts) draftAccounts = JSON.parse(JSON.stringify(ACCOUNTS));
    const ed = editId ? draftAccounts.find(a => a.identifiant === editId) : null;
    const roleOpt = cur => Object.entries(ROLES).map(([k, r]) => `<option value="${k}" ${k === cur ? "selected" : ""}>${r.label}</option>`).join("");
    const changed = !sameAccounts();

    document.getElementById("suivi-body").innerHTML = `
      <section class="card mt2">
        <div class="card-head"><h2 style="font-family:var(--sans);font-size:13px">Comptes (${draftAccounts.length})</h2>
          ${changed ? `<span class="tag mal">Modifications à publier</span>` : `<span class="tag bien">À jour</span>`}</div>
        <div class="matrix-wrap"><table class="matrix acc">
          <thead><tr><th>Identifiant</th><th>Nom affiché</th><th>Rôle</th><th></th></tr></thead>
          <tbody>${draftAccounts.map(a => `<tr>
            <th>${h(a.identifiant)}${a.identifiant === S.ident ? ` <span class="label">(toi)</span>` : ""}</th>
            <td>${h(a.nom)}</td><td><span class="role-tag ${a.role}">${h(ROLES[a.role] ? ROLES[a.role].label : a.role)}</span></td>
            <td style="white-space:nowrap"><button class="linkbtn" data-act="accedit" data-id="${h(a.identifiant)}">Modifier</button>
              · <button class="linkbtn danger" data-act="accdel" data-id="${h(a.identifiant)}">Supprimer</button></td>
          </tr>`).join("")}</tbody>
        </table></div>
      </section>

      <form class="card mt acc-form" id="acc-form" autocomplete="off">
        <div class="label">${ed ? "Modifier le compte " + h(ed.identifiant) : "Ajouter un compte"}</div>
        <div class="acc-grid">
          <label>Identifiant<input id="acc-id" required value="${ed ? h(ed.identifiant) : ""}" ${ed ? "readonly" : ""} autocapitalize="none" placeholder="ex. samir"></label>
          <label>Nom affiché<input id="acc-nom" required value="${ed ? h(ed.nom) : ""}" placeholder="ex. Samir"></label>
          <label>Rôle<select id="acc-role">${roleOpt(ed ? ed.role : "agent")}</select></label>
          <label>Mot de passe<input id="acc-pw" type="password" autocomplete="new-password" ${ed ? `placeholder="laisser vide = inchangé"` : "required"} minlength="6"></label>
        </div>
        <div class="row mt">
          <button class="btn-dark" type="submit" style="width:auto;padding:9px 16px">${ed ? "Enregistrer" : "Ajouter le compte"}</button>
          ${ed ? `<button class="btn" type="button" data-act="acccancel">Annuler</button>` : ""}
        </div>
        <p class="hint">Agent : saisie des contrôles uniquement · Superviseur : interface des paliers + consultation et export des données (historique, tableau de bord, analyse) · Responsable : tout sauf l'effacement des données et les comptes · Administrateur : tout.</p>
      </form>

      <section class="card mt">
        <div class="card-head"><h2 style="font-family:var(--sans);font-size:13px">Publier les comptes</h2>
          <button class="btn" data-act="acccopy">📋 Copier le bloc</button></div>
        <div style="padding:12px">
          <ol class="steps">
            <li>Clique sur <b>Copier le bloc</b>.</li>
            <li>Sur GitHub, ouvre <b>js/config.js</b> puis le crayon ✏️.</li>
            <li>Remplace tout le bloc <code>comptes: [ … ],</code> par celui copié, puis <b>Commit changes</b>.</li>
            <li>Une à deux minutes plus tard, les comptes sont actifs sur tous les appareils.</li>
          </ol>
          <textarea id="acc-code" readonly rows="${Math.min(14, draftAccounts.length * 2 + 2)}">${h(accountsCode())}</textarea>
          <p class="hint">Les mots de passe n'apparaissent jamais en clair : seule une empreinte chiffrée est enregistrée.</p>
        </div>
      </section>`;

    document.getElementById("acc-form").onsubmit = async e => {
      e.preventDefault();
      const id = document.getElementById("acc-id").value.trim();
      const nom = document.getElementById("acc-nom").value.trim();
      const role = document.getElementById("acc-role").value;
      const pw = document.getElementById("acc-pw").value;
      if (!/^[A-Za-z0-9._-]{2,40}$/.test(id)) return toast("Identifiant : lettres, chiffres, point, tiret (2 à 40 caractères).");
      const existing = draftAccounts.find(a => a.identifiant.toLowerCase() === id.toLowerCase());
      if (!ed && existing) return toast("Cet identifiant existe déjà.");
      if (pw && pw.length < 6) return toast("Mot de passe : 6 caractères minimum.");
      if (ed && ed.role === "admin" && role !== "admin" && draftAccounts.filter(a => a.role === "admin").length === 1)
        return toast("Il faut garder au moins un administrateur.");
      const acc = ed || { identifiant: id };
      acc.nom = nom; acc.role = role;
      if (pw) { acc.sel = newSalt(); acc.hash = await hashFor(acc.sel, acc.identifiant, pw); }
      if (!ed) draftAccounts.push(acc);
      toast(ed ? "Compte modifié — pense à publier" : "Compte ajouté — pense à publier");
      renderComptes();
    };
  }

  /* ---------------- Supervision (calendrier) ---------------- */
  function renderSupervision() {
    const P = S.sup;
    const first = new Date(P.y, P.m, 1), days = new Date(P.y, P.m + 1, 0).getDate();
    const offset = (first.getDay() + 6) % 7;
    const now = new Date();
    const done = new Set(S.records.filter(r => !P.agent || r.agent === P.agent).map(r => halfId(new Date(r.date))));

    let ok = 0, expected = 0, cells = "";
    for (let i = 0; i < offset; i++) cells += `<div class="cal-day blank"></div>`;
    for (let day = 1; day <= days; day++) {
      const d = new Date(P.y, P.m, day), key = ymd(d);
      const halves = [
        { id: key + "-am", end: new Date(P.y, P.m, day, CFG.heureFinMatin) },
        { id: key + "-pm", end: new Date(P.y, P.m, day + 1) }
      ];
      const dots = halves.map(x => {
        if (done.has(x.id)) { ok++; expected++; return `<span class="dot ok" title="Contrôle fait"></span>`; }
        if (x.end <= now) { expected++; return `<span class="dot ko" title="Manqué"></span>`; }
        return `<span class="dot" title="À venir"></span>`;
      }).join("");
      cells += `<button class="cal-day ${key === ymd(now) ? "today" : ""}" data-act="day" data-day="${key}" title="Voir l'historique du ${frDate(d)}">
        <span class="n">${day}</span><span class="dots">${dots}</span></button>`;
    }
    const taux = expected ? Math.round(ok / expected * 100) + "%" : "—";

    document.getElementById("suivi-body").innerHTML = `
      <div class="mt"><span class="chip-org">Supervision société</span></div>
      <div class="mt"><button class="btn" data-act="refresh">↻ Actualiser</button></div>
      <div class="row mt" style="align-items:flex-end">
        <div><div class="label">Organisation</div><div class="org-box mt" style="margin-top:4px">${h(CFG.organisation)}</div></div>
        <div class="filters"><div class="label">Agent</div>
          <select id="sup-agent" style="margin-top:4px">${["", ...agents()].map(a => `<option value="${h(a)}" ${a === P.agent ? "selected" : ""}>${a ? h(a) : "Tous"}</option>`).join("")}</select>
        </div>
      </div>
      <div class="month-nav mt">
        <button class="pill" data-act="month" data-d="-1">‹</button>
        <strong>${MOIS[P.m]} ${P.y}</strong>
        <button class="pill" data-act="month" data-d="1">›</button>
      </div>
      <div class="stats mt">
        <div class="stat a"><b>${taux}</b><span>Taux de réalisation</span></div>
        <div class="stat"><b>${ok}/${expected}</b><span>Demi-journées contrôlées</span></div>
        <div class="stat r"><b>${expected - ok}</b><span>Manquées</span></div>
      </div>
      <section class="card calendar mt">
        <div class="cal-grid">
          ${["L", "M", "M", "J", "V", "S", "D"].map(x => `<div class="cal-dow">${x}</div>`).join("")}
          ${cells}
        </div>
        <div class="legend">
          <span><span class="dot ok"></span>Contrôle fait</span>
          <span><span class="dot ko"></span>Manqué</span>
          <span><span class="dot"></span>À venir</span>
          <span class="hint">Pastille gauche = matin · droite = après-midi</span>
        </div>
      </section>`;
    document.getElementById("sup-agent").onchange = e => { P.agent = e.target.value; renderSupervision(); };
  }

  /* ---------------- Données de démo ---------------- */
  function generateDemo() {
    if (S.records.length && !confirm("Ajouter des données de démo à l'historique existant ?")) return;
    const names = ["Samir", "Inès", S.user || "Matis"];
    const comments = ["Carton non plié", "Plastique dans le papier", "Sac non fermé", "Verre dans le DIB", "Biodéchets mélangés", "Bac débordant", ""];
    const pick = a => a[Math.floor(Math.random() * a.length)];
    const now = new Date(), recs = [];
    // Tendance propre à chaque palier pour que les courbes montent et descendent de façon réaliste.
    const trend = {};
    ALL_PALIERS.forEach((p, i) => (trend[p.key] = { base: 0.6 + 0.04 * i, slope: [0.18, -0.06, 0.1][i % 3], amp: 0.08, ph: i * 1.7 }));
    const DAYS = 370;
    for (let back = DAYS; back >= 0; back--) {
      for (const half of ["am", "pm"]) {
        if (Math.random() > 0.68) continue;
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - back,
          half === "am" ? 8 + Math.floor(Math.random() * 4) : 14 + Math.floor(Math.random() * 4),
          Math.floor(Math.random() * 60), Math.floor(Math.random() * 60));
        if (d > now) continue;
        const mag = pick(CFG.magasins), pal = pick(mag.paliers), agent = pick(names);
        const tr = trend[mag.nom + "|" + pal.nom], prog = 1 - back / DAYS;
        const pBien = Math.max(0.2, Math.min(0.97, tr.base + tr.slope * prog + tr.amp * Math.sin(back / 9 + tr.ph)));
        const start = Math.floor(Math.random() * pal.niveaux.length);
        const count = 2 + Math.floor(Math.random() * (pal.niveaux.length - 1));
        for (let k = 0; k < count && start + k < pal.niveaux.length; k++) {
          const t = new Date(d.getTime() + k * 1000);
          const items = dechetsOf(mag.nom, pal.nom, pal.niveaux[start + k]).map(x => {
            const statut = Math.random() < 0.4 ? "na" : Math.random() < pBien ? "bien" : "mal";
            const it = { dechet: x, statut };
            if (statut === "mal") { const c = pick(comments); if (c) it.commentaire = c; }
            return it;
          });
          recs.push({ id: uid(), date: t.toISOString(), agent, magasin: mag.nom, palier: pal.nom, niveau: pal.niveaux[start + k], items, demo: true });
        }
      }
    }
    S.records = S.records.concat(recs).sort((a, b) => a.date.localeCompare(b.date));
    saveRecords();
    toast(`${recs.length} contrôles de démo ajoutés`);
    route();
  }

  /* ---------------- Actions (délégation d'événements) ---------------- */
  document.addEventListener("click", e => {
    const el = e.target.closest("[data-act]");
    if (!el || el.tagName === "INPUT") return;
    const a = el.dataset.act;
    const NEED = { csv: "export", xlsx: "export", pdf: "export", anaxlsx: "export", dashxlsx: "export", demo: "demo", wipe: "wipe", accedit: "comptes", acccancel: "comptes", accdel: "comptes", acccopy: "comptes" };
    if (NEED[a] && !can(NEED[a])) { toast("Action non autorisée pour ton compte."); return; }
    switch (a) {
      case "go": location.hash = el.dataset.to; break;
      case "logout":
        if (Object.keys(S.draft).length && !confirm("Des contrôles non envoyés seront conservés sur cet appareil. Se déconnecter ?")) return;
        S.user = S.role = S.ident = null; store.del("session"); history.replaceState(null, "", location.pathname); route(); break;
      case "mag": S.ui.mag = +el.dataset.i; S.ui.pal = 0; saveUi(); renderControle(); break;
      case "pal": S.ui.pal = +el.dataset.i; saveUi(); renderControle(); break;
      case "niv": S.ui.niv[current.palKey] = +el.dataset.i; saveUi(); renderControle(); break;
      case "set": {
        const dft = draftFor(current.mag.nom, current.pal.nom, current.niv);
        const d = el.dataset.d, s = el.dataset.s;
        if (dft[d] && dft[d].statut === s) delete dft[d];
        else dft[d] = { ...(dft[d] || {}), statut: s };
        saveDraft(); renderControle(); break;
      }
      case "rmphoto": { const dft = draftFor(current.mag.nom, current.pal.nom, current.niv); delete dft[el.dataset.d].photo; saveDraft(); renderControle(); break; }
      case "zoom": modal(`<img src="${el.getAttribute("src")}" alt="Photo">`); break;
      case "reset": {
        const pref = current.mag.nom + "|" + current.pal.nom + "|";
        const ks = Object.keys(S.draft).filter(k => k.startsWith(pref));
        if (!ks.length) { toast("Aucune saisie en cours sur ce palier."); return; }
        if (!confirm(`Effacer la saisie non envoyée du palier ${current.pal.nom} ?`)) return;
        ks.forEach(k => delete S.draft[k]); saveDraft(); renderControle(); break;
      }
      case "send": sendAll(); break;
      case "refresh": S.records = store.get("records", []); route(); toast("Données actualisées"); break;
      case "period": {
        const p = el.dataset.p === S.hist.period ? "" : el.dataset.p;
        S.hist.period = p; [S.hist.du, S.hist.au] = periodRange(p); S.hist.page = 0;
        location.hash.includes("analyse") ? renderAnalyse() : renderHistorique(); break;
      }
      case "pickfloor":
        Object.assign(S.ana, { mag: +el.dataset.m, pal: +el.dataset.p, niv: +el.dataset.n });
        renderAnalyse();
        document.getElementById("ana-detail").scrollIntoView({ behavior: "smooth", block: "start" });
        break;
      case "stepfloor": S.ana.niv += +el.dataset.d; renderAnalyse(); break;
      case "pickdechet":
        S.ana.dechet = S.ana.dechet === el.dataset.d ? "" : el.dataset.d; renderAnalyse();
        if (S.ana.dechet) document.querySelector(".focus").scrollIntoView({ behavior: "smooth", block: "start" });
        break;
      case "anaxlsx": exportAnalyse(); break;
      case "accedit": renderComptes(el.dataset.id); break;
      case "acccancel": renderComptes(); break;
      case "accdel": {
        const acc = draftAccounts.find(a => a.identifiant === el.dataset.id);
        if (acc.role === "admin" && draftAccounts.filter(a => a.role === "admin").length === 1) { toast("Il faut garder au moins un administrateur."); return; }
        if (!confirm(`Supprimer le compte ${acc.identifiant} ?`)) return;
        draftAccounts = draftAccounts.filter(a => a !== acc); renderComptes(); break;
      }
      case "acccopy": {
        const ta = document.getElementById("acc-code");
        const done = () => toast("Bloc copié : colle-le dans js/config.js sur GitHub");
        if (navigator.clipboard) navigator.clipboard.writeText(ta.value).then(done, () => { ta.select(); document.execCommand("copy"); done(); });
        else { ta.select(); document.execCommand("copy"); done(); }
        break;
      }
      case "weeks": S.dash.weeks = +el.dataset.w; renderDashboard(); break;
      case "toggleserie": { const sh = { ...dashShown() }; sh[el.dataset.k] = !sh[el.dataset.k]; setShown(sh); break; }
      case "soloserie": setShown({ [el.dataset.k]: true }); break;
      case "showall": { const sh = { __all: true }; ALL_PALIERS.forEach(p => (sh[p.key] = true)); setShown(sh); break; }
      case "showpals": { const sh = {}; ALL_PALIERS.forEach(p => (sh[p.key] = true)); setShown(sh); break; }
      case "dashxlsx": exportDashboard(); break;
      case "size": S.hist.size = +el.dataset.s; S.hist.page = 0; renderHistResults(); break;
      case "page": S.hist.page += +el.dataset.d; renderHistResults(); window.scrollTo({ top: 0, behavior: "smooth" }); break;
      case "showphoto": {
        const r = S.records.find(x => x.id === el.dataset.id);
        const it = r && r.items.find(i => i.dechet === el.dataset.d);
        if (it && it.photo) modal(`<img src="${it.photo}" alt="Photo"><p class="label mt">${h(r.niveau)} · ${h(it.dechet)}${it.commentaire ? " · " + h(it.commentaire) : ""}</p>`);
        break;
      }
      case "csv": exportCsv(); break;
      case "xlsx": exportXlsx(); break;
      case "pdf": exportPdf(); break;
      case "month": {
        const m = S.sup.m + +el.dataset.d;
        S.sup.y += Math.floor(m / 12); S.sup.m = (m + 12) % 12; renderSupervision(); break;
      }
      case "day":
        Object.assign(S.hist, { du: el.dataset.day, au: el.dataset.day, period: "", agent: S.sup.agent, page: 0 });
        location.hash = "#/suivi/historique"; break;
      case "demo": generateDemo(); break;
      case "wipe":
        if (!S.records.length) { toast("L'historique est déjà vide."); return; }
        if (!confirm("Effacer définitivement tout l'historique de cet appareil ? Pense à exporter le CSV avant.")) return;
        S.records = []; saveRecords(); route(); toast("Historique effacé"); break;
    }
  });

  route();
})();
