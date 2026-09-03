const TELEGRAM_URL = "https://t.me/s/codexstudys";
const WHATSAPP_URL = "https://whatsapp.com/channel/0029VbDI2CGEAKWNSoya5L2w";
const BRAND_IMAGE = "assets/codex-telegram.png";
const STORE = "codex-studys:";
const get = (key, fallback) => { try { return JSON.parse(localStorage.getItem(STORE + key)) ?? fallback; } catch { return fallback; } };
const put = (key, value) => localStorage.setItem(STORE + key, JSON.stringify(value));
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
let batches = [], batchFilter = "all", batchSearch = "", batchLimit = 40;
let session = { running: false, started: null, elapsed: 0 };
let pomo = { running: false, focus: true, seconds: 1500, sessions: 0 };
let flashIndex = 0, flashFlipped = false;

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (c) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;" }[c]));
}
function initials(name = "C") { return escapeHtml(name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "C"); }
function toast(message) {
  $(".toast")?.remove(); const node = document.createElement("div"); node.className = "toast"; node.textContent = message;
  document.body.append(node); setTimeout(() => node.remove(), 2600);
}
function showView(view) {
  $$("[data-screen]").forEach((section) => section.classList.toggle("active", section.dataset.screen === view));
  $$("[data-view]").forEach((link) => link.classList.toggle("active", link.dataset.view === view));
  $("#navLinks").classList.remove("open"); $("#menuBtn").setAttribute("aria-expanded", "false"); window.scrollTo({ top: 0, behavior: "smooth" });
}
function closeModal(id) { document.getElementById(id)?.classList.remove("visible"); if (!$(".overlay.visible")) document.body.classList.remove("modal-open"); }
function openModal(id) { const modal = document.getElementById(id); if (!modal) return; modal.classList.add("visible"); document.body.classList.add("modal-open"); modal.querySelector("input")?.focus(); }

function categoryFor(batch) {
  const text = `${batch.name || batch.title || ""} ${batch.byName || batch.description || ""}`.toLowerCase();
  if (/\bjee\b|iit/.test(text)) return "jee"; if (/neet|medical/.test(text)) return "neet";
  if (/class|cbse|icse|school|commerce|humanities/.test(text)) return "school"; return "exam";
}
function getTitle(batch) { return batch.name || batch.title || batch.batchName || "Untitled batch"; }
function getImage(batch) {
  const candidate = batch.previewImage || batch.thumbnail || batch.thumbnailUrl || batch.image || batch.imageUrl || batch.logo || batch.logoUrl || batch.images?.[0] || "";
  if (typeof candidate === "string") return candidate;
  if (candidate && typeof candidate === "object") return candidate.url || candidate.src || candidate.href || "";
  return "";
}
function getId(batch) { return batch._id || batch.id || batch.batch_id || batch.slug || ""; }
function visibleBatches() {
  const query = batchSearch.trim().toLowerCase();
  return batches.filter((b) => (batchFilter === "all" || categoryFor(b) === batchFilter) &&
    (!query || `${getTitle(b)} ${b.byName || ""} ${b.description || ""} ${b.language || ""}`.toLowerCase().includes(query)));
}
function batchCard(batch) {
  const title = escapeHtml(getTitle(batch)), description = escapeHtml(batch.byName || batch.description || "Open the course to explore its subjects.");
  const image = getImage(batch), category = categoryFor(batch), language = escapeHtml(batch.language || "Course");
  return `<article class="course-card" data-batch-id="${escapeHtml(getId(batch))}">
    <div class="course-thumb"><div class="thumb-fallback">${initials(getTitle(batch))}</div>${image ? `<img src="${escapeHtml(image)}" alt="" loading="lazy" onerror="this.remove()">` : ""}<span class="course-tag">${category}</span></div>
    <div class="course-body"><h3 class="course-title">${title}</h3><p class="course-desc">${description}</p><div class="course-meta"><span>${language}</span><span class="open-label">OPEN →</span></div></div>
  </article>`;
}
function openBatch(batch) {
  const id = getId(batch); if (!id) return toast("This batch has no open link.");
  const name = encodeURIComponent(getTitle(batch)).replace(/%20/g, "+");
  window.location.href = `https://stream.testuk.org/subjects?batchId=${encodeURIComponent(id)}&batchName=${name}`;
}
function renderBatches() {
  const list = visibleBatches(), shown = list.slice(0, batchLimit); $("#batchGrid").innerHTML = shown.length ? shown.map(batchCard).join("") : '<div class="empty">No batches match this search.</div>';
  $("#resultsNote").textContent = `${list.length.toLocaleString()} batch${list.length === 1 ? "" : "es"} available${batchSearch ? " for this search" : ""}. Showing ${shown.length.toLocaleString()}.`;
  $("#loadMore").style.display = shown.length < list.length ? "inline-flex" : "none";
  $$(".course-card").forEach((card) => card.addEventListener("click", () => openBatch(list.find((b) => String(getId(b)) === card.dataset.batchId))));
}
async function loadBatches() {
  try { const response = await fetch("batches.json", { cache: "no-store" }); if (!response.ok) throw new Error("load failed"); const data = await response.json();
    batches = Array.isArray(data.batches) ? data.batches : []; renderBatches();
  } catch (error) { console.error(error); $("#resultsNote").textContent = "Batches could not be loaded."; $("#batchGrid").innerHTML = '<div class="empty">Refresh to reconnect to the course library.</div>'; }
  finally { $("#globalPreloader").classList.add("hide"); }
}

function renderGoals() {
  const goals = get("goals", []), complete = goals.filter((g) => g.done).length;
  $("#goalList").innerHTML = goals.length ? goals.map((g, i) => `<div class="goal ${g.done ? "done" : ""}"><input class="check" type="checkbox" data-goal="${i}" ${g.done ? "checked" : ""} aria-label="Complete goal"><span class="goal-text">${escapeHtml(g.text)}</span><button type="button" data-remove-goal="${i}" aria-label="Delete goal">×</button></div>`).join("") : '<div class="hint">No goals yet — add one for this session.</div>';
  $("#goalBar").style.width = goals.length ? `${complete / goals.length * 100}%` : "0%"; $("#dashGoalBar").style.width = goals.length ? `${complete / goals.length * 100}%` : "0%"; $("#goalSummary").textContent = `${complete} / ${goals.length}`;
  $$("[data-goal]").forEach((box) => box.addEventListener("change", () => { const next = get("goals", []); next[Number(box.dataset.goal)].done = box.checked; put("goals", next); renderGoals(); }));
  $$("[data-remove-goal]").forEach((button) => button.addEventListener("click", () => { const next = get("goals", []); next.splice(Number(button.dataset.removeGoal), 1); put("goals", next); renderGoals(); }));
}
function setupGoals() {
  $("#goalForm").addEventListener("submit", (event) => { event.preventDefault(); const input = $("#goalInput"); const goals = get("goals", []); goals.push({ text: input.value.trim(), done: false }); put("goals", goals); input.value = ""; renderGoals(); });
  renderGoals();
}
function formatHms(seconds) { const h = Math.floor(seconds / 3600), m = Math.floor(seconds % 3600 / 60), s = seconds % 60; return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":"); }
function updateSession() {
  const elapsed = session.running ? session.elapsed + Math.floor((Date.now() - session.started) / 1000) : session.elapsed; $("#sessionTime").textContent = formatHms(elapsed);
  $("#sessionToggle").textContent = session.running ? "Stop session" : "Start session"; $("#dashSessionText").textContent = session.running ? "Your active time is being recorded." : "Start a session to log real study time.";
}
function setupSession() {
  $("#sessionToggle").addEventListener("click", () => { if (session.running) { session.elapsed += Math.floor((Date.now() - session.started) / 1000); session.running = false; put("sessions", [...get("sessions", []), { date: new Date().toISOString(), seconds: session.elapsed }]); updateStats(); } else { session.started = Date.now(); session.running = true; } updateSession(); });
  $("#sessionReset").addEventListener("click", () => { session = { running: false, started: null, elapsed: 0 }; updateSession(); });
  setInterval(updateSession, 1000);
}
function updateClock() { const now = new Date(); $("#currentDate").textContent = now.toLocaleDateString(undefined, { weekday:"long", month:"short", day:"numeric", year:"numeric" }); }
function setupMood() { const saved = get("mood", ""); $$(".mood").forEach((button) => { button.classList.toggle("selected", button.dataset.mood === saved); button.addEventListener("click", () => { put("mood", button.dataset.mood); $("#moodLabel").textContent = `Feeling ${button.dataset.mood} today`; $("#dashMood").textContent = button.dataset.mood; $$(".mood").forEach((b) => b.classList.toggle("selected", b === button)); }); }); if (saved) { $("#moodLabel").textContent = `Feeling ${saved} today`; $("#dashMood").textContent = saved; } }
function setupMotivation() { const quotes = ["Show up gently.", "One clear concept at a time.", "Progress likes consistency.", "Your next session is enough.", "Make the next useful move."]; const day = Math.floor(Date.now() / 86400000); $("#dailyQuote").textContent = get("custom-quote", "") || quotes[day % quotes.length]; }
function setupNotes() {
  let active = "study"; const area = $("#quickNote"); const load = () => { area.value = get(`note-${active}`, ""); $("#noteCount").textContent = `${area.value.length} / 4000`; };
  $$("#noteTabs .tab").forEach((tab) => tab.addEventListener("click", () => { active = tab.dataset.note; $$("#noteTabs .tab").forEach((t) => t.classList.toggle("active", t === tab)); load(); }));
  area.addEventListener("input", () => { put(`note-${active}`, area.value); $("#noteCount").textContent = `${area.value.length} / 4000`; }); $("#exportNote").addEventListener("click", () => { const blob = new Blob([area.value], { type: "text/plain" }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = `codex-studys-${active}-note.txt`; link.click(); URL.revokeObjectURL(url); }); load();
}
function updatePomo() { const min = String(Math.floor(pomo.seconds / 60)).padStart(2, "0"), sec = String(pomo.seconds % 60).padStart(2, "0"); $("#pomoTime").textContent = `${min}:${sec}`; $("#pomoMode").textContent = pomo.focus ? "Focus session" : "Break"; $("#pomoToggle").textContent = pomo.running ? "Pause" : "Start"; $("#pomoSessions").textContent = `${pomo.sessions} session${pomo.sessions === 1 ? "" : "s"}`; $("#dashPomo").textContent = pomo.sessions; }
function setupPomo() {
  pomo.sessions = get("pomo-sessions", 0); pomo.seconds = Number($("#focusDuration").value) * 60; updatePomo();
  $("#pomoToggle").addEventListener("click", () => { pomo.running = !pomo.running; updatePomo(); }); $("#pomoReset").addEventListener("click", () => { pomo.running = false; pomo.focus = true; pomo.seconds = Number($("#focusDuration").value) * 60; updatePomo(); });
  $("#focusDuration").addEventListener("change", () => { if (!pomo.running && pomo.focus) { pomo.seconds = Number($("#focusDuration").value) * 60; updatePomo(); } }); $("#breakDuration").addEventListener("change", () => { if (!pomo.running && !pomo.focus) { pomo.seconds = Number($("#breakDuration").value) * 60; updatePomo(); } });
  setInterval(() => { if (!pomo.running) return; if (pomo.seconds > 0) pomo.seconds--; else { pomo.running = false; if (pomo.focus) { pomo.sessions++; put("pomo-sessions", pomo.sessions); } pomo.focus = !pomo.focus; pomo.seconds = Number(pomo.focus ? $("#focusDuration").value : $("#breakDuration").value) * 60; updatePomo(); toast(pomo.focus ? "Break complete — ready to focus?" : "Focus complete — take a break."); } updatePomo(); }, 1000);
}

let flashcards = [
  ["Physics · JEE", "What is the SI unit of electric charge?", "Coulomb (C)"], ["Chemistry · JEE", "What does Avogadro's number measure?", "The number of particles in one mole: 6.022 × 10²³."], ["Biology · NEET", "What is the powerhouse of the cell?", "The mitochondrion."], ["Maths · JEE", "What is the derivative of sin x?", "cos x"], ["English · CUET", "What is a word with the opposite meaning called?", "An antonym."], ["CUET / GK", "Which planet is known as the Red Planet?", "Mars"]
];
function renderFlashcard() { const [subject, question, answer] = flashcards[flashIndex]; $("#flashSubject").textContent = subject; $("#flashQuestion").textContent = question; $("#flashAnswer").textContent = flashFlipped ? answer : ""; $("#flashHint").textContent = flashFlipped ? "Tap to hide answer" : "Tap to reveal answer"; $("#flashProgress").textContent = `${flashIndex + 1} / ${flashcards.length}`; $("#flashKnown").textContent = `${get("known-cards", []).length} known`; }
function setupFlashcards() {
  flashcards = [...flashcards, ...get("custom-cards", [])];
  const flip = () => { flashFlipped = !flashFlipped; renderFlashcard(); }; $("#flashcard").addEventListener("click", flip); $("#flashFlip").addEventListener("click", flip);
  $("#flashPrev").addEventListener("click", () => { flashIndex = (flashIndex - 1 + flashcards.length) % flashcards.length; flashFlipped = false; renderFlashcard(); }); $("#flashNext").addEventListener("click", () => { flashIndex = (flashIndex + 1) % flashcards.length; flashFlipped = false; renderFlashcard(); });
  $("#flashKnownBtn").addEventListener("click", () => { const known = new Set(get("known-cards", [])); known.add(flashIndex); put("known-cards", [...known]); flashIndex = (flashIndex + 1) % flashcards.length; flashFlipped = false; renderFlashcard(); }); $("#flashUnknownBtn").addEventListener("click", () => { flashIndex = (flashIndex + 1) % flashcards.length; flashFlipped = false; renderFlashcard(); });
  $("#flashFavorite").addEventListener("click", () => { const favorites = new Set(get("favorite-cards", [])); favorites.has(flashIndex) ? favorites.delete(flashIndex) : favorites.add(flashIndex); put("favorite-cards", [...favorites]); $("#flashFavorite").textContent = favorites.has(flashIndex) ? "★ Favorite" : "☆ Favorite"; });
  $("#exportCards").addEventListener("click", () => { const blob = new Blob([JSON.stringify(flashcards, null, 2)], { type:"application/json" }); const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = "codex-studys-flashcards.json"; link.click(); URL.revokeObjectURL(link.href); });
  $("#flashForm").addEventListener("submit", (event) => { event.preventDefault(); const card = ["Custom", $("#flashQuestionInput").value.trim(), $("#flashAnswerInput").value.trim()]; const custom = get("custom-cards", []); custom.push(card); put("custom-cards", custom); flashcards.push(card); event.target.reset(); flashIndex = flashcards.length - 1; flashFlipped = false; renderFlashcard(); toast("Flashcard added."); });
  $("#importCards").addEventListener("change", () => { const file = $("#importCards").files[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => { try { const imported = file.name.endsWith(".csv") ? reader.result.trim().split(/\r?\n/).slice(1).map((line) => line.split(",")).filter((row) => row.length >= 2).map((row) => ["Imported", row[0].trim(), row.slice(1).join(",").trim()]) : JSON.parse(reader.result); const valid = Array.isArray(imported) ? imported.filter((row) => Array.isArray(row) && row.length >= 2).map((row) => [row[0] || "Imported", row[1] || "", row[2] || ""]) : []; const custom = [...get("custom-cards", []), ...valid]; put("custom-cards", custom); flashcards = [...flashcards, ...valid]; renderFlashcard(); toast(`${valid.length} card${valid.length === 1 ? "" : "s"} imported.`); } catch { toast("Could not read that flashcard file."); } }; reader.readAsText(file); });
  document.addEventListener("keydown", (event) => { if ($("#hubView").classList.contains("active")) { if (event.key === "ArrowRight") $("#flashNext").click(); if (event.key === "ArrowLeft") $("#flashPrev").click(); if (event.code === "Space") { event.preventDefault(); flip(); } } }); renderFlashcard();
}

const defaultExams = [["JEE Main", "2027-01-28"], ["JEE Advanced", "2027-05-16"], ["NEET UG", "2027-05-06"], ["CUET UG", "2027-05-12"], ["BITSAT", "2027-04-28"], ["MHT-CET", "2026-12-15"], ["UPSC CSE", "2027-05-23"], ["BPSC", "2026-12-01"]];
function countdown(date) { const distance = new Date(`${date}T00:00:00`).getTime() - Date.now(); if (distance <= 0) return "Date reached"; const days = Math.floor(distance / 86400000), hours = Math.floor(distance % 86400000 / 3600000); return `${days}d ${hours}h`; }
function renderExams() { const exams = [...defaultExams, ...get("custom-exams", [])]; $("#examList").innerHTML = exams.map((exam, i) => `<div class="exam"><div><div class="exam-name">${escapeHtml(exam[0])}</div><div class="exam-date">${escapeHtml(exam[1])}</div></div><div class="exam-count ${new Date(exam[1]) - Date.now() < 30 * 86400000 ? "urgent" : ""}">${countdown(exam[1])}${i >= defaultExams.length ? ` <button class="goal" data-remove-exam="${i - defaultExams.length}" style="display:inline;padding:2px 5px">×</button>` : ""}</div></div>`).join(""); $$("[data-remove-exam]").forEach((button) => button.addEventListener("click", () => { const custom = get("custom-exams", []); custom.splice(Number(button.dataset.removeExam), 1); put("custom-exams", custom); renderExams(); })); }
function setupExams() { $("#examForm").addEventListener("submit", (event) => { event.preventDefault(); const custom = get("custom-exams", []); custom.push([$("#examName").value.trim(), $("#examDate").value]); put("custom-exams", custom); event.target.reset(); renderExams(); }); renderExams(); setInterval(renderExams, 60000); }

function profileData() { let profile = get("profile", null); if (!profile) { profile = { memberSince: new Date().toISOString(), profileId: `CXS-${Math.random().toString(36).slice(2, 8).toUpperCase()}`, name:"", username:"", role:"", graduationYear:"", location:"", bio:"", avatar:"" }; put("profile", profile); } return profile; }
function renderProfile() { const p = profileData(); ["name","username","role","graduationYear","location","bio"].forEach((key) => { const input = document.getElementById(key === "name" ? "fullName" : key); if (input) input.value = p[key] || ""; }); $("#memberSince").value = new Date(p.memberSince).toLocaleDateString(); $("#profileId").value = p.profileId; $("#profileNamePreview").textContent = p.name || "Your name"; $("#profileUsernamePreview").textContent = p.username ? `@${p.username.replace(/^@/, "")}` : "@username"; $("#profileBioPreview").textContent = p.bio || "Add a short bio about your learning journey."; $("#avatarPreview").innerHTML = p.avatar ? `<img src="${escapeHtml(p.avatar)}" alt="Your avatar">` : initials(p.name || "C"); const minutes = Math.floor(get("sessions", []).reduce((sum, s) => sum + Number(s.seconds || 0), 0) / 60); $("#profileXp").textContent = `${minutes} XP`; $("#profileRank").textContent = minutes > 600 ? "Focused scholar" : minutes > 120 ? "Steady learner" : "New learner"; }
function saveProfile() { const old = profileData(), p = { ...old, name:$("#fullName").value.trim(), username:$("#username").value.trim(), role:$("#role").value.trim(), graduationYear:$("#graduationYear").value, location:$("#location").value.trim(), bio:$("#bio").value.trim() }; put("profile", p); renderProfile(); toast("Profile saved on this device."); }
function updateStats() { const sessions = get("sessions", []), now = Date.now(), day = 86400000, total = (filter) => sessions.filter((s) => now - new Date(s.date).getTime() < filter).reduce((sum, s) => sum + s.seconds, 0); const all = sessions.reduce((sum, s) => sum + s.seconds, 0); const fmt = (seconds) => `${Math.floor(seconds / 60)}m`; $("#statToday").textContent = fmt(total(day)); $("#statWeek").textContent = fmt(total(day * 7)); $("#statMonth").textContent = fmt(total(day * 30)); $("#statAll").textContent = fmt(all); $("#statDetail").textContent = `Average session: ${sessions.length ? fmt(all / sessions.length) : "0m"} · Productivity score: ${sessions.length ? "Based on logged time" : "No sessions logged yet"}`; renderProfile(); }
function setupProfile() {
  renderProfile(); updateStats(); $("#saveProfile").addEventListener("click", saveProfile); $("#uploadAvatar").addEventListener("click", () => $("#avatarUpload").click()); $("#avatarUpload").addEventListener("change", () => { const file = $("#avatarUpload").files[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => { const p = profileData(); p.avatar = reader.result; put("profile", p); renderProfile(); }; reader.readAsDataURL(file); });
  $("#copyProfileId").addEventListener("click", async () => { await navigator.clipboard?.writeText($("#profileId").value); toast("Profile ID copied."); }); $("#shareProfile").addEventListener("click", async () => { const p = profileData(); const text = `${p.name || "CODEX STUDYS learner"} · ${$("#profileId").value}`; if (navigator.share) await navigator.share({ title:"CODEX STUDYS profile", text }); else { await navigator.clipboard?.writeText(text); toast("Profile summary copied."); } });
}
const themes = [["light","Light"],["dark","Dark"],["sandalwood","Sandalwood"],["forest-emerald","Forest"],["ocean-deep","Ocean"],["sakura-blossom","Sakura"],["dracula-midnight","Dracula"],["lavender-mist","Lavender"],["cyberpunk-neon","Cyberpunk"],["system","System"]];
function setupAppearance() { const saved = get("theme", "dark"); document.body.dataset.theme = saved; $("#themeGrid").innerHTML = themes.map(([value, label]) => `<button class="theme ${saved === value ? "active" : ""}" data-theme="${value}">${label}</button>`).join(""); $$(".theme").forEach((button) => button.addEventListener("click", () => { document.body.dataset.theme = button.dataset.theme; put("theme", button.dataset.theme); $$(".theme").forEach((b) => b.classList.toggle("active", b === button)); $("#themeName").textContent = button.textContent; })); $("#themeName").textContent = themes.find(([value]) => value === saved)?.[1] || "Dark"; const font = get("font", "normal"); $("#fontSize").value = font; document.body.classList.add(font === "compact" ? "compact-font" : font === "large" ? "large-font" : ""); $("#fontSize").addEventListener("change", (e) => { document.body.classList.remove("compact-font","large-font"); if (e.target.value !== "normal") document.body.classList.add(`${e.target.value}-font`); put("font", e.target.value); }); const reduce = get("reduce-motion", false); $("#reducedMotion").checked = reduce; document.body.classList.toggle("reduce-motion", reduce); $("#reducedMotion").addEventListener("change", (e) => { document.body.classList.toggle("reduce-motion", e.target.checked); put("reduce-motion", e.target.checked); }); $("#animationSelect").value = get("animation", "none"); $("#animationSelect").addEventListener("change", (e) => { put("animation", e.target.value); toast(e.target.value === "none" ? "Animations disabled." : `${e.target.options[e.target.selectedIndex].text} preview selected.`); }); }
function setupNetwork() { const render = () => { const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection; $("#networkType").textContent = navigator.onLine ? (connection?.effectiveType?.toUpperCase() || "Online") : "Offline"; $("#onlineStatus").textContent = navigator.onLine ? "Online" : "Offline"; $("#networkDetail").textContent = connection ? `Browser reports ${connection.effectiveType || "an available connection"}${connection.downlink ? ` · ${connection.downlink} Mbps` : ""}.` : "Detailed network information is not exposed by this browser."; }; $("#refreshNetwork").addEventListener("click", render); window.addEventListener("online", render); window.addEventListener("offline", render); render(); }
function setupAlarms() { const render = () => { const alarms = get("alarms", []); $("#alarmList").innerHTML = alarms.length ? alarms.map((a, i) => `<div class="alarm"><span><b>${escapeHtml(a.time)}</b> · ${escapeHtml(a.label)}<small>${a.daily ? "Daily" : "Once"}</small></span><button class="btn btn-soft btn-small" data-remove-alarm="${i}">Remove</button></div>`).join("") : '<div class="hint">No alarms set.</div>'; $$("[data-remove-alarm]").forEach((b) => b.addEventListener("click", () => { const next = get("alarms", []); next.splice(Number(b.dataset.removeAlarm),1); put("alarms",next); render(); })); }; $("#alarmForm").addEventListener("submit", (e) => { e.preventDefault(); const next = get("alarms", []); next.push({ label:$("#alarmLabel").value.trim(), time:$("#alarmTime").value, daily:true }); put("alarms",next); e.target.reset(); render(); toast("Alarm saved locally."); }); render(); }
function setupVisits() { const render = () => { const platforms = get("platforms", []); $("#visitList").innerHTML = platforms.length ? platforms.map((p, i) => `<div class="visit"><a href="${escapeHtml(p.url)}" target="_blank" rel="noopener" data-visit="${i}"><b>${escapeHtml(p.name)}</b><small>${Number(p.visits || 0)} visit${Number(p.visits || 0) === 1 ? "" : "s"}</small></a><span>↗</span></div>`).join("") : '<div class="hint">No platform links are configured.</div>'; $$("[data-visit]").forEach((link) => link.addEventListener("click", () => { const next = get("platforms", []); next[Number(link.dataset.visit)].visits = Number(next[Number(link.dataset.visit)].visits || 0) + 1; put("platforms", next); setTimeout(render, 50); })); }; $("#platformForm").addEventListener("submit", (e) => { e.preventDefault(); const url = $("#platformUrl").value.trim(); try { const parsed = new URL(url); if (!["http:","https:"].includes(parsed.protocol)) throw new Error("protocol"); const next = get("platforms", []); next.push({ name:$("#platformName").value.trim(), url:parsed.href, visits:0 }); put("platforms", next); e.target.reset(); render(); toast("Platform added."); } catch { toast("Use a valid http or https link."); } }); render(); }
function setupPopups() { const now = Date.now(), dismissed = (key) => now - Number(localStorage.getItem(STORE + key) || 0) < 86400000; const dismiss = (key, check) => { if (check.checked) localStorage.setItem(STORE + key, String(Date.now())); closeModal(key === "telegram-dismissed" ? "telegramModal" : "whatsappModal"); };
  $("#joinTelegramModal").addEventListener("click", () => localStorage.setItem(STORE + "telegram-dismissed", String(Date.now()))); $("#joinWhatsappModal").addEventListener("click", () => localStorage.setItem(STORE + "whatsapp-dismissed", String(Date.now())));
  $$('[data-close="telegramModal"]').forEach((b) => b.addEventListener("click", () => dismiss("telegram-dismissed", $("#telegram24h")))); $$('[data-close="whatsappModal"]').forEach((b) => b.addEventListener("click", () => dismiss("whatsapp-dismissed", $("#whatsapp24h"))));
  if (!dismissed("telegram-dismissed")) setTimeout(() => openModal("telegramModal"), 1200);
}
function setupNavigation() { $$("[data-view]").forEach((link) => link.addEventListener("click", () => showView(link.dataset.view))); $("#menuBtn").addEventListener("click", () => { const open = $("#navLinks").classList.toggle("open"); $("#menuBtn").setAttribute("aria-expanded", String(open)); }); }
function setupSearch() { $("#searchBtn").addEventListener("click", () => openModal("searchModal")); $$("#batchSearch").forEach((input) => input.addEventListener("input", (e) => { batchSearch = e.target.value; batchLimit = 40; renderBatches(); })); $("#clearBatchSearch").addEventListener("click", () => { $("#batchSearch").value = ""; batchSearch = ""; renderBatches(); }); $$("#filters .filter").forEach((b) => b.addEventListener("click", () => { batchFilter = b.dataset.filter; batchLimit = 40; $$("#filters .filter").forEach((x) => x.classList.toggle("active", x === b)); renderBatches(); })); $("#loadMore").addEventListener("click", () => { batchLimit += 40; renderBatches(); }); $("#searchInput").addEventListener("input", (e) => { const q = e.target.value.toLowerCase(); const matches = batches.filter((b) => `${getTitle(b)} ${b.byName || ""}`.toLowerCase().includes(q)).slice(0,30); $("#searchResults").innerHTML = q && matches.length ? matches.map((b) => `<div class="search-result" data-search-id="${escapeHtml(getId(b))}"><div class="search-thumb">${getImage(b) ? `<img src="${escapeHtml(getImage(b))}" alt="" onerror="this.remove()">` : initials(getTitle(b))}</div><div><strong>${escapeHtml(getTitle(b))}</strong><small>${escapeHtml(b.byName || b.language || "Batch")}</small></div></div>`).join("") : '<div class="hint">No matching batches yet.</div>'; $$(".search-result").forEach((r) => r.addEventListener("click", () => { openBatch(batches.find((b) => String(getId(b)) === r.dataset.searchId)); closeModal("searchModal"); })); }); $$("[data-open-modal]").forEach((b) => b.addEventListener("click", () => openModal(b.dataset.openModal))); $$("[data-close]").forEach((b) => b.addEventListener("click", () => closeModal(b.dataset.close))); $$(".overlay").forEach((o) => o.addEventListener("click", (e) => { if (e.target === o) closeModal(o.id); })); document.addEventListener("keydown", (e) => { if (e.key === "Escape") $$(".overlay.visible").forEach((o) => closeModal(o.id)); }); }

document.addEventListener("DOMContentLoaded", () => {
  setupNavigation(); setupSearch(); setupGoals(); setupSession(); setupMood(); setupMotivation(); setupNotes(); setupPomo(); setupFlashcards(); setupExams(); setupProfile(); setupAppearance(); setupNetwork(); setupAlarms(); setupVisits(); setupPopups(); updateClock(); setInterval(updateClock, 30000); loadBatches();
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch((error) => console.warn("PWA unavailable", error));
});