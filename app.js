
// Ring Master PWA
// Datos: /data/program.json y /data/exercises.json
// Guardado local: localStorage

const LS = {
  completed: "rm.completedSessions.v1",
  days: "rm.trainingDays.v1" // 0=Dom .. 6=Sáb
};

// Nota: Date.getDay() usa 0=Dom .. 6=Sáb.
// Queremos que la semana empiece en lunes (para mostrar/ordenar),
// pero sin romper el índice de getDay().
const WEEKDAYS_BY_INDEX = [
  {i:0, short:"D", name:"Dom"},
  {i:1, short:"L", name:"Lun"},
  {i:2, short:"M", name:"Mar"},
  {i:3, short:"X", name:"Mié"},
  {i:4, short:"J", name:"Jue"},
  {i:5, short:"V", name:"Vie"},
  {i:6, short:"S", name:"Sáb"}
];
// Orden visual: lunes → domingo
const WEEK_ORDER_MON = [1,2,3,4,5,6,0];

let DATA = null; // { program, exById }

function $(sel){ return document.querySelector(sel); }
function el(tag, attrs={}, children=[]){
  const e = document.createElement(tag);
  for (const [k,v] of Object.entries(attrs)){
    if (k === "class") e.className = v;
    else if (k === "html") e.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v);
  }
  for (const c of children){
    if (c == null) continue;
    if (typeof c === "string") e.appendChild(document.createTextNode(c));
    else e.appendChild(c);
  }
  return e;
}

function getCompleted(){
  try { return new Set(JSON.parse(localStorage.getItem(LS.completed) || "[]")); }
  catch { return new Set(); }
}
function setCompleted(setObj){
  localStorage.setItem(LS.completed, JSON.stringify([...setObj]));
}
function getDays(){
  try {
    const arr = JSON.parse(localStorage.getItem(LS.days) || "null");
    if (Array.isArray(arr) && arr.length) return new Set(arr);
  } catch {}
  // default: 3 días (L-X-V) estilo Thenx
  return new Set([1,3,5]);
}
function setDays(setObj){
  localStorage.setItem(LS.days, JSON.stringify([...setObj].sort((a,b)=>a-b)));
}

function nextTrainDates(daysSet, count=12){
  const out=[];
  const d = new Date();
  d.setHours(0,0,0,0);
  let guard = 0;
  while(out.length < count && guard < 120){
    const wd = d.getDay(); // 0..6
    if (daysSet.has(wd)) out.push(new Date(d));
    d.setDate(d.getDate()+1);
    guard++;
  }
  return out;
}

function orderIndexMon(dayIndex){
  // Convierte 0=Dom..6=Sáb a un orden donde lunes=0 ... domingo=6
  return (dayIndex + 6) % 7;
}

function daysToString(daysSet){
  return [...daysSet]
    .sort((a,b)=>orderIndexMon(a)-orderIndexMon(b))
    .map(d=>WEEKDAYS_BY_INDEX[d].name)
    .join(", ");
}

function startOfWeekMonday(date){
  const d = new Date(date);
  d.setHours(0,0,0,0);
  const wd = d.getDay(); // 0=Dom..6=Sáb
  const diff = (wd + 6) % 7; // lunes->0 ... domingo->6
  d.setDate(d.getDate() - diff);
  return d;
}

function endOfWeekSunday(mondayDate){
  const d = new Date(mondayDate);
  d.setDate(d.getDate() + 6);
  return d;
}

function fmtDate(d){
  // ej. "Jue 12 feb"
  const wd = WEEKDAYS_BY_INDEX[d.getDay()].name;
  const day = d.getDate();
  const month = d.toLocaleString("es-ES", {month:"short"});
  return `${wd} ${day} ${month}`;
}

function youtubeEmbedUrl(url){
  if (!url) return null;
  try{
    const u = new URL(url);
    // youtu.be/<id>
    if (u.hostname === "youtu.be"){
      const id = u.pathname.replace("/","").trim();
      if (!id) return null;
      return `https://www.youtube.com/embed/${id}`;
    }
    // youtube.com/shorts/<id>
    if (u.hostname.includes("youtube.com")){
      const parts = u.pathname.split("/").filter(Boolean);
      if (parts[0] === "shorts" && parts[1]) return `https://www.youtube.com/embed/${parts[1]}`;
      // watch?v=<id>
      const v = u.searchParams.get("v");
      if (v) return `https://www.youtube.com/embed/${v}`;
      // /embed/<id>
      if (parts[0] === "embed" && parts[1]) return `https://www.youtube.com/embed/${parts[1]}`;
    }
  }catch(e){}
  return url; // fallback
}

function route(){
  const hash = location.hash || "#home";
  const app = $("#app");
  app.innerHTML = "";
  const [path, qs] = hash.split("?");
  const params = new URLSearchParams(qs || "");

  if (path === "#home") renderHome(app);
  else if (path.startsWith("#session-")){
    const id = parseInt(path.replace("#session-",""),10);
    renderSession(app, id);
  }
  else if (path.startsWith("#player-")){
    const id = parseInt(path.replace("#player-",""),10);
    const stepIndex = parseInt(params.get("step") || "0", 10);
    renderPlayer(app, id, stepIndex);
  }
  else renderHome(app);
}

function findSession(id){
  return DATA.program.sessions.find(s => s.id === id);
}

function flattenSteps(session){
  const steps=[];
  for (const block of session.blocks){
    for (const st of block.steps){
      steps.push({...st, blockId:block.id, blockType:block.type});
    }
  }
  return steps;
}

function stepLabel(step){
  const ex = DATA.exById.get(step.exId);
  if (step.kind === "rest") return ex?.name || "Descanso";
  return ex?.name || `Ejercicio ${step.exId}`;
}

function stepVideo(step){
  const ex = DATA.exById.get(step.exId);
  return step.videoOverride || ex?.video || null;
}

function renderHome(root){
  const completed = getCompleted();
  const days = getDays();

  const total = DATA.program.sessions.length;
  const doneCount = completed.size;

  root.appendChild(el("div", {class:"card"}, [
    el("div", {class:"row"}, [
      el("div", {}, [
        el("h2", {}, ["Tu semana"]),
        el("div", {class:"muted"}, [`Días de entreno: ${daysToString(days)}`])
      ]),
      el("div", {class:"badge " + (doneCount ? "good" : "")}, [`${doneCount}/${total} completadas`])
    ])
  ]));

  // próximos entrenos (agrupados por semanas, empezando en lunes)
  const pendingSessions = DATA.program.sessions.filter(s => !completed.has(s.id));
  const upcomingDates = nextTrainDates(days, 28); // ~4 semanas

  // Asigna sesiones en orden a cada fecha de entreno futura
  const weekMap = new Map();
  const weeks = [];
  let si = 0;
  for (const date of upcomingDates){
    const ws = startOfWeekMonday(date);
    const key = ws.toISOString().slice(0,10);
    if (!weekMap.has(key)){
      const obj = { start: ws, items: [] };
      weekMap.set(key, obj);
      weeks.push(obj);
    }
    const session = pendingSessions[si] || null;
    if (session) si++;
    weekMap.get(key).items.push({ date, session });
  }

  const upcomingWrap = el("div", {}, []);
  weeks.forEach((w, idx) => {
    const weekStart = w.start;
    const weekEnd = endOfWeekSunday(weekStart);
    const header = el("div", {class:"weekhdr"}, [
      el("div", {class:"weekhdr-title"}, [`Semana ${idx+1}`]),
      el("div", {class:"muted small"}, [`${fmtDate(weekStart)} – ${fmtDate(weekEnd)}`])
    ]);

    const list = el("div", {class:"list"}, []);
    for (const it of w.items){
      const left = el("div", {}, [
        el("div", {class:"item-title"}, [fmtDate(it.date)]),
        el("div", {class:"item-sub"}, [it.session ? `${it.session.name} · ${it.session.phase}` : "Sin sesiones pendientes 🎉"])
      ]);
      const right = el("div", {class:"kbd"}, [it.session ? "Abrir →" : ""]);
      const row = el("a", {class:"item", href: it.session ? `#session-${it.session.id}` : "#home"}, [left, right]);
      list.appendChild(row);
    }

    upcomingWrap.appendChild(header);
    upcomingWrap.appendChild(list);
  });

  root.appendChild(el("div", {class:"card"}, [
    el("h3", {}, ["Próximos entrenos"]),
    el("div", {class:"muted small"}, ["Se asignan en orden (Thenx): la primera sesión no completada cae en tu próximo día elegido." ]),
    upcomingWrap
  ]));

  // lista de sesiones
  const list = el("div", {class:"list"}, []);
  for (const s of DATA.program.sessions){
    const isDone = completed.has(s.id);
    list.appendChild(el("a", {class:"item", href:`#session-${s.id}`}, [
      el("div", {}, [
        el("div", {class:"item-title"}, [`${s.name} ${isDone ? "✅" : ""}`]),
        el("div", {class:"item-sub"}, [`${s.phase} · ${s.description || ""}`])
      ]),
      el("div", {class:"badge"}, [isDone ? "Hecha" : "Pendiente"])
    ]));
  }
  root.appendChild(el("div", {class:"card"}, [
    el("h3", {}, ["Sesiones"]),
    list
  ]));

  root.appendChild(el("div", {class:"footerpad"}));
}

function renderSession(root, sessionId){
  const completed = getCompleted();
  const s = findSession(sessionId);
  if (!s){
    root.appendChild(el("div", {class:"card"}, ["Sesión no encontrada."]));
    return;
  }
  const isDone = completed.has(s.id);

  root.appendChild(el("div", {class:"card"}, [
    el("div", {class:"row"}, [
      el("div", {}, [
        el("h2", {}, [s.name]),
        el("div", {class:"muted"}, [`${s.phase}`]),
      ]),
      el("span", {class:"badge " + (isDone ? "good":"")}, [isDone ? "Completada" : "Pendiente"])
    ]),
    s.description ? el("p", {class:"muted"}, [s.description]) : null,
    el("div", {class:"controls"}, [
      el("a", {class:"btn primary", href:`#player-${s.id}?step=0`}, ["Empezar sesión"]),
      el("button", {class:"btn", onclick: () => { location.hash="#home"; }}, ["Volver"])
    ]),
  ]));

  // bloques
  for (const block of s.blocks){
    const steps = block.steps.map(st => {
      const ex = DATA.exById.get(st.exId);
      const label = stepLabel(st);
      const meta = st.seconds ? `${st.seconds}s` : (st.reps ? `${st.reps} reps` : "");
      const kind = st.kind === "rest" ? "Descanso" : "Ejercicio";
      return el("div", {class:"item"}, [
        el("div", {}, [
          el("div", {class:"item-title"}, [label]),
          el("div", {class:"item-sub"}, [`${kind}${meta ? " · " + meta : ""}`]),
        ]),
        el("div", {class:"kbd"}, ["→"])
      ]);
    });

    root.appendChild(el("div", {class:"card"}, [
      el("div", {class:"row"}, [
        el("h3", {}, [`Bloque ${block.id}`]),
        el("span", {class:"badge"}, [block.type])
      ]),
      el("div", {class:"list"}, steps)
    ]));
  }

  // marcar completada
  const btn = el("button", {class:"btn " + (isDone ? "" : "primary"), onclick: () => {
    const set = getCompleted();
    if (set.has(s.id)) set.delete(s.id);
    else set.add(s.id);
    setCompleted(set);
    route();
  }}, [isDone ? "Marcar como pendiente" : "Marcar como completada ✅"]);

  root.appendChild(el("div", {class:"card"}, [btn]));
}

let playerState = {
  timerId: null,
  remaining: 0,
  running: false
};

function stopTimer(){
  if (playerState.timerId) clearInterval(playerState.timerId);
  playerState.timerId = null;
  playerState.running = false;
}

function renderPlayer(root, sessionId, stepIndex){
  const s = findSession(sessionId);
  if (!s){
    root.appendChild(el("div", {class:"card"}, ["Sesión no encontrada."]));
    return;
  }
  const steps = flattenSteps(s);
  const step = steps[stepIndex];
  if (!step){
    root.appendChild(el("div", {class:"card"}, [
      el("h2", {}, ["Sesión terminada 🎉"]),
      el("a", {class:"btn primary", href:`#session-${s.id}`}, ["Volver a la sesión"])
    ]));
    return;
  }

  stopTimer();

  const ex = DATA.exById.get(step.exId);
  const title = stepLabel(step);
  const videoUrl = youtubeEmbedUrl(stepVideo(step));
  const isRest = step.kind === "rest";

  const header = el("div", {class:"card"}, [
    el("div", {class:"row"}, [
      el("div", {}, [
        el("h2", {}, [title]),
        el("div", {class:"muted"}, [`${s.name} · Paso ${stepIndex+1}/${steps.length}`])
      ]),
      el("span", {class:"badge"}, [isRest ? "DESCANSO" : "EJERCICIO"])
    ]),
    el("div", {class:"stepmeta"}, [
      step.seconds ? el("span", {class:"pill " + (isRest?"rest":"exercise")}, [`⏱ ${step.seconds}s`]) : null,
      step.reps ? el("span", {class:"pill " + (isRest?"rest":"exercise")}, [`🔁 ${step.reps} reps`]) : null,
      el("span", {class:"pill"}, [`Bloque ${step.blockId}`])
    ])
  ]);

  const video = videoUrl ? el("div", {class:"video"}, [
    el("iframe", {
      src: videoUrl,
      allow: "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share",
      allowfullscreen: "true",
      title: title
    })
  ]) : el("div", {class:"card muted"}, ["(Sin vídeo para este paso)"]);

  const desc = (!isRest && ex?.description) ? el("div", {class:"card"}, [
    el("h3", {}, ["Técnica (resumen)"]),
    el("div", {class:"muted"}, [ex.description.split("\n").slice(0,6).join("\n") + (ex.description.split("\n").length>6 ? "\n…" : "")]),
    el("div", {class:"muted small"}, ["(Texto recortado para lectura rápida durante el entreno)"])
  ]) : null;

  // controls + timer
  const controls = el("div", {class:"card player"}, []);
  const timerEl = el("div", {class:"timer"}, ["--:--"]);
  const setTimer = (sec) => {
    const m = String(Math.floor(sec/60)).padStart(2,"0");
    const s = String(sec%60).padStart(2,"0");
    timerEl.textContent = `${m}:${s}`;
  };

  if (step.seconds && step.seconds > 0){
    playerState.remaining = step.seconds;
    setTimer(playerState.remaining);

    const startCountdown = (autoAdvance=true) => {
      if (playerState.running) return;
      playerState.running = true;
      playerState.timerId = setInterval(() => {
        playerState.remaining -= 1;
        setTimer(Math.max(playerState.remaining,0));
        if (playerState.remaining <= 0){
          stopTimer();
          if (autoAdvance){
            location.hash = `#player-${sessionId}?step=${stepIndex+1}`;
          }
        }
      }, 1000);
    };

    const btnPrev = el("button", {class:"btn small", onclick: () => {
      stopTimer();
      location.hash = `#player-${sessionId}?step=${Math.max(stepIndex-1,0)}`;
    }}, ["← Anterior"]);

    const btnNext = el("button", {class:"btn small", onclick: () => {
      stopTimer();
      location.hash = `#player-${sessionId}?step=${stepIndex+1}`;
    }}, ["Siguiente →"]);

    if (isRest){
      // Descanso: empieza SOLO y avanza SOLO al terminar
      controls.appendChild(el("div", {class:"muted small"}, ["Descanso: empieza solo. Puedes alargarlo +10s."]));
      controls.appendChild(timerEl);

      const btnPlus10 = el("button", {class:"btn small", onclick: () => {
        playerState.remaining += 10;
        setTimer(playerState.remaining);
      }}, ["+10s"]);

      controls.appendChild(el("div", {class:"controls"}, [btnPrev, btnPlus10, btnNext]));

      // Autostart del descanso al entrar en el paso (sin “Start”)
      setTimeout(() => startCountdown(true), 0);
    } else {
      // Ejercicio por tiempo: el usuario pulsa Start. Al terminar, avanza solo (y el descanso siguiente arrancará solo).
      controls.appendChild(el("div", {class:"muted small"}, ["Ejercicio por tiempo: pulsa Start."]));
      controls.appendChild(timerEl);

      const btnStart = el("button", {class:"btn primary big", onclick: () => startCountdown(true)}, ["Start"]);

      // Start grande arriba, navegación pequeña abajo
      controls.appendChild(btnStart);
      controls.appendChild(el("div", {class:"controls"}, [btnPrev, btnNext]));
    }
  } else {
    // reps / sin tiempo
    const btnDone = el("button", {class:"btn primary big", onclick: () => {
      stopTimer();
      location.hash = `#player-${sessionId}?step=${stepIndex+1}`;
    }}, ["Hecho ✅"]);

    const btnBack = el("button", {class:"btn small", onclick: () => {
      stopTimer();
      location.hash = `#player-${sessionId}?step=${Math.max(stepIndex-1,0)}`;
    }}, ["← Anterior"]);

    const btnSkip = el("button", {class:"btn small", onclick: () => {
      stopTimer();
      location.hash = `#player-${sessionId}?step=${stepIndex+1}`;
    }}, ["Siguiente →"]);

    controls.appendChild(el("div", {class:"muted small"}, ["Reps: marca “Hecho” y sigue."]));
    controls.appendChild(btnDone);
    controls.appendChild(el("div", {class:"controls"}, [btnBack, btnSkip]));
  }


  // progressions
  if (!isRest && ex){
    const prog = el("div", {class:"card"}, [
      el("h3", {}, ["Progresión estilo Thenx"]),
      el("div", {class:"muted"}, [
        `Más fácil: ${ex.easierId ? (DATA.exById.get(ex.easierId)?.name || ex.easier) : (ex.easier || "—")}\n` +
        `Más difícil: ${ex.harderId ? (DATA.exById.get(ex.harderId)?.name || ex.harder) : (ex.harder || "—")}`
      ])
    ]);
    root.appendChild(prog);
  }

  root.appendChild(header);
  root.appendChild(video);
  if (desc) root.appendChild(desc);
  root.appendChild(controls);

  root.appendChild(el("div", {class:"card"}, [
    el("div", {class:"controls"}, [
      el("a", {class:"btn", href:`#session-${s.id}`}, ["Volver a la sesión"]),
      el("a", {class:"btn", href:"#home"}, ["Inicio"])
    ])
  ]));
}

async function loadData(){
  const [p, e] = await Promise.all([
    fetch("data/program.json").then(r=>r.json()),
    fetch("data/exercises.json").then(r=>r.json())
  ]);
  const exById = new Map();
  for (const ex of (e.exercises || [])) exById.set(ex.id, ex);
  DATA = { program: p, exById };
}

function setupSettings(){
  const dlg = $("#settingsDialog");
  const picker = $("#weekdayPicker");

  function renderPicker(daysSet){
    picker.innerHTML = "";
    for (const idx of WEEK_ORDER_MON){
      const wd = WEEKDAYS_BY_INDEX[idx];
      const chip = el("div", {class:"daychip " + (daysSet.has(wd.i) ? "selected":""), onclick: () => {
        if (daysSet.has(wd.i)) daysSet.delete(wd.i);
        else daysSet.add(wd.i);
        renderPicker(daysSet);
      }}, [wd.short]);
      picker.appendChild(chip);
    }
  }

  $("#btnSettings").addEventListener("click", () => {
    const days = getDays();
    renderPicker(days);
    dlg.showModal();

    $("#btnSaveSettings").onclick = () => {
      if (days.size === 0) {
        // no bloqueamos, pero evitamos “semana vacía”
        days.add(1); days.add(3); days.add(5);
      }
      setDays(days);
      dlg.close();
      route();
    };

    $("#btnResetProgress").onclick = () => {
      localStorage.removeItem(LS.completed);
      dlg.close();
      route();
    };

    $("#btnResetAll").onclick = () => {
      localStorage.removeItem(LS.completed);
      localStorage.removeItem(LS.days);
      dlg.close();
      route();
    };
  });
}

async function init(){
  // SW (offline UI + datos)
  if ("serviceWorker" in navigator){
    try{ await navigator.serviceWorker.register("service-worker.js"); }catch(e){}
  }

  await loadData();
  setupSettings();
  window.addEventListener("hashchange", route);
  route();
}

init();
