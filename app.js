/* =========================
   APP VERSION / PWA UPDATE
   ========================= */

const APP_VERSION = "1.2.0";

function registerPWA() {
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register(
        `./sw.js?v=${encodeURIComponent(APP_VERSION)}`,
        { updateViaCache: "none" }
      );

      await registration.update();

      if (registration.waiting) {
        registration.waiting.postMessage({ type: "SKIP_WAITING" });
      }

      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        if (!worker) return;

        worker.addEventListener("statechange", () => {
          if (
            worker.state === "installed" &&
            navigator.serviceWorker.controller
          ) {
            worker.postMessage({ type: "SKIP_WAITING" });
          }
        });
      });

      let refreshing = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
      });
    } catch (error) {
      console.warn("PWA registration failed:", error);
    }
  });
}

/* =========================
   PDF
========================= */

const PDF_URL = "./Календарь пробуждения зон.pdf";

let pdfDoc = null;
let currentPage = 1;
let totalPages = 0;

/* =========================
   ДАТЫ (локальный календарь)
========================= */

const MONTHS_RU = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря"
];

const WEEKDAYS_RU = [
  "воскресенье", "понедельник", "вторник", "среда",
  "четверг", "пятница", "суббота"
];

const WEEKDAY_SHORT = [
  { id: 1, label: "Пн" },
  { id: 2, label: "Вт" },
  { id: 3, label: "Ср" },
  { id: 4, label: "Чт" },
  { id: 5, label: "Пт" },
  { id: 6, label: "Сб" },
  { id: 0, label: "Вс" }
];

const NOTE_EXAMPLES = [
  "Получила оргазм после медитирования",
  "Плохо расслабилась, возбудилась, но без оргазма",
  "Было сложно сосредоточиться",
  "Хорошо расслабилась, чувствительность выше",
  "Сегодня ничего особенного"
];

function toISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function todayISO() {
  return toISODate(new Date());
}

function parseISODate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function addDaysISO(iso, days) {
  const date = parseISODate(iso);
  date.setDate(date.getDate() + days);
  return toISODate(date);
}

function diffDaysISO(fromISO, toISO) {
  const from = parseISODate(fromISO);
  const to = parseISODate(toISO);
  return Math.round((to - from) / 86400000);
}

function mondayOf(iso) {
  const date = parseISODate(iso);
  const day = date.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + offset);
  return toISODate(date);
}

function formatDate(iso) {
  if (!iso) return "";
  const date = parseISODate(iso);
  return `${date.getDate()} ${MONTHS_RU[date.getMonth()]}`;
}

function formatDateShort(iso) {
  if (!iso) return "";
  const date = parseISODate(iso);
  const wd = WEEKDAYS_RU[date.getDay()].slice(0, 2);
  return `${wd}, ${date.getDate()} ${MONTHS_RU[date.getMonth()].slice(0, 3)}`;
}

function formatDateRange(startISO, endISO) {
  return `${formatDate(startISO)} — ${formatDate(endISO)}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function newCycleId() {
  return `c_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/* =========================
   ПРОГРАММЫ
========================= */

const programs = [

  {
    id: "vulva",
    title: "Вульва",
    description: "8 дней. Массаж через день.",
    days: [
      ["Вульва", "8 мин", "vulva"],
      ["Отдых", "", "rest"],
      ["Вульва", "8 мин", "vulva"],
      ["Отдых", "", "rest"],
      ["Вульва", "8 мин", "vulva"],
      ["Отдых", "", "rest"],
      ["Вульва", "8 мин", "vulva"],
      ["Отдых", "", "rest"]
    ]
  },

  {
    id: "clit",
    title: "Клитор",
    description: "4 → 8 → 12 минут.",
    days: [
      ["Клитор", "4 мин", "clit"],
      ["Клитор", "4 мин", "clit"],
      ["Клитор", "4 мин", "clit"],
      ["Клитор", "8 мин", "clit"],
      ["Клитор", "8 мин", "clit"],
      ["Клитор", "8 мин", "clit"],
      ["Клитор", "12 мин", "clit"],
      ["Клитор", "12 мин", "clit"],
      ["Отдых", "", "rest"]
    ]
  },

  {
    id: "combo",
    title: "Вульва + клитор",
    description: "Чередуем вульву и клитор.",
    days: [
      ["Вульва", "8 мин", "vulva"],
      ["Клитор", "12 мин", "clit"],
      ["Вульва", "8 мин", "vulva"],
      ["Клитор", "12 мин", "clit"],
      ["Вульва", "8 мин", "vulva"],
      ["Клитор", "12 мин", "clit"],
      ["Отдых", "", "rest"]
    ]
  },

  {
    id: "g",
    title: "Зона G",
    description: "7 дней. Повторять 2–4 недели.",
    days: [
      ["Вульва", "8 мин", "vulva"],
      ["Зона G", "12 мин", "g"],
      ["Вульва", "8 мин", "vulva"],
      ["Зона G", "12 мин", "g"],
      ["Вульва", "8 мин", "vulva"],
      ["Клитор", "12 мин", "clit"],
      ["Отдых", "", "rest"]
    ]
  },

  {
    id: "k",
    title: "Зона К",
    description: "7 дней. Повторять 2–4 недели.",
    days: [
      ["Вульва", "8 мин", "vulva"],
      ["Зона К", "12 мин", "k"],
      ["Вульва", "8 мин", "vulva"],
      ["Зона К", "12 мин", "k"],
      ["Вульва", "8 мин", "vulva"],
      ["Клитор", "12 мин", "clit"],
      ["Отдых", "", "rest"]
    ]
  },

  {
    id: "maintenance",
    title: "Поддержание",
    description: "1–2 раза в неделю, пожизненно. Выбери дни практики — недели повторяются.",
    repeating: true,
    days: []
  }

];

function programById(id) {
  return programs.find(item => item.id === id);
}

/* =========================
   СОСТОЯНИЕ
========================= */

let cycle = null;
let marks = {};
let cycleHistory = [];
let activeProgram = "vulva";
let isPDFOpen = false;
let openDayState = null;
let maintenanceWeeksShown = 16;
const MAINTENANCE_WEEKS_MAX = 104;

async function loadAppData() {
  try {
    const cycleData = await StorageManager.get("cycleData");
    const cycleMarks = await StorageManager.get("cycleMarks");
    const historyData = await StorageManager.get("cycleHistory");
    const prefs = await StorageManager.get("cyclePrefs");

    cycle = cycleData || null;
    marks = cycleMarks || {};
    cycleHistory = Array.isArray(historyData) ? historyData : [];

    if (cycle?.programId) {
      activeProgram = cycle.programId;
    }

    if (cycle && !Array.isArray(cycle.maintenanceWeekdays)) {
      cycle.maintenanceWeekdays = Array.isArray(prefs?.maintenanceWeekdays)
        ? prefs.maintenanceWeekdays
        : [];
    }

    console.log("✓ Данные приложения загружены");
    return true;
  } catch (error) {
    console.error("Ошибка при загрузке данных:", error);
    return false;
  }
}

/* =========================
   SAVE
========================= */

async function save() {
  try {
    if (cycle) {
      cycle.updatedAt = Date.now();
      cycle.programId = activeProgram;
    }

    await StorageManager.set("cycleData", cycle);
    await StorageManager.set("cycleMarks", marks);
    await StorageManager.set("cycleHistory", cycleHistory);
    await StorageManager.set("cyclePrefs", {
      maintenanceWeekdays: cycle?.maintenanceWeekdays || []
    });
  } catch (error) {
    console.error("Ошибка при сохранении данных:", error);
  }
}

async function persistUserData() {
  await save();
  if (window.StorageManager?.requestPersistentStorage) {
    try {
      await StorageManager.requestPersistentStorage();
    } catch (error) {
      console.warn("Не удалось запросить постоянное хранилище:", error);
    }
  }
}

/* =========================
   START / HISTORY
========================= */

function emptyCycle() {
  const weekdays = cycle?.maintenanceWeekdays?.slice()
    || cycleHistory[0]?.maintenanceWeekdays?.slice()
    || [];

  return {
    id: newCycleId(),
    start: todayISO(),
    paused: false,
    pauseStart: null,
    pausedDays: 0,
    programId: activeProgram,
    maintenanceWeekdays: weekdays,
    updatedAt: Date.now()
  };
}

function countCompleted(sourceMarks, programId) {
  const data = sourceMarks || {};
  if (programId === "maintenance") {
    return Object.keys(data).filter(key =>
      key.startsWith("maintenance_") &&
      !key.includes("_steps") &&
      !key.includes("_note") &&
      data[key] === true
    ).length;
  }

  const program = programById(programId);
  if (!program?.days) return 0;

  return program.days.reduce((sum, _, index) => (
    data[`${programId}_${index}`] === true ? sum + 1 : sum
  ), 0);
}

function snapshotCurrentCycle() {
  if (!cycle) return null;

  return {
    id: cycle.id || newCycleId(),
    start: cycle.start,
    end: todayISO(),
    programId: cycle.programId || activeProgram,
    pausedDays: cycle.pausedDays || 0,
    maintenanceWeekdays: (cycle.maintenanceWeekdays || []).slice(),
    marks: JSON.parse(JSON.stringify(marks || {})),
    completed: countCompleted(marks, cycle.programId || activeProgram)
  };
}

function startCycle() {
  cycle = emptyCycle();
  marks = {};
  openDayState = null;
  persistUserData();
  render();
}

function startNewCycle() {
  if (!cycle) {
    startCycle();
    return;
  }

  const ok = window.confirm(
    "Начать новый цикл? Текущий цикл сохранится в истории."
  );
  if (!ok) return;

  const snapshot = snapshotCurrentCycle();
  if (snapshot) {
    cycleHistory.unshift(snapshot);
  }

  startCycle();
}

/* =========================
   DAY
========================= */

function currentDay() {
  if (!cycle) return 1;

  let days = diffDaysISO(cycle.start, todayISO()) + 1;
  days -= cycle.pausedDays || 0;

  if (cycle.paused && cycle.pauseStart) {
    days -= diffDaysISO(cycle.pauseStart, todayISO());
  }

  return Math.max(1, days);
}

function programSlotDate(index) {
  if (!cycle) return null;
  return addDaysISO(cycle.start, index + (cycle.pausedDays || 0));
}

function markKeyForProgram(id, index) {
  return `${id}_${index}`;
}

function markKeyForMaintenance(dateISO) {
  return `maintenance_${dateISO}`;
}

function isCompleted(key) {
  return marks[key] === true;
}

function getNote(key) {
  return marks[`${key}_note`] || "";
}

/* =========================
   MENSTRUATION PAUSE
========================= */

function togglePause() {
  if (!cycle) return;

  if (!cycle.paused) {
    cycle.paused = true;
    cycle.pauseStart = todayISO();
  } else {
    const days = Math.max(
      0,
      diffDaysISO(cycle.pauseStart || todayISO(), todayISO())
    );
    cycle.pausedDays = (cycle.pausedDays || 0) + days;
    cycle.paused = false;
    cycle.pauseStart = null;
  }

  persistUserData();
  render();
}

/* =========================
   REMINDERS
========================= */

function getReminder(id, index) {
  if (id === "vulva" && index % 2 === 0) {
    return ["Подготовка", "Водный лубрикант с гиалуроновой кислотой"];
  }

  if (id === "clit" && index <= 7) {
    return ["За 15 минут", "Крем с L-Arginin"];
  }

  if (id === "g" && (index === 1 || index === 3)) {
    return ["За 20 минут", "Крем G-Spot"];
  }

  if (id === "k" && (index === 1 || index === 3)) {
    return ["Подготовка", "Водный лубрикант"];
  }

  if (id === "maintenance") {
    return ["Поддержание", "Короткая практика 1–2 раза в неделю"];
  }

  return null;
}

/* =========================
   PDF NAVIGATION
========================= */

async function openPDF() {
  isPDFOpen = true;
  const pdfContainer = document.getElementById("pdfContainer");
  const mainContent = document.getElementById("mainContent");
  const pdfHeader = document.getElementById("pdfHeader");
  const header = document.querySelector("header:not(.pdf-header)");
  const footer = document.getElementById("footer");

  if (header) header.style.display = "none";
  mainContent.style.display = "none";
  pdfHeader.style.display = "flex";
  footer.style.display = "none";
  pdfContainer.style.display = "flex";

  if (!pdfDoc) {
    try {
      console.log("📖 Загружаем PDF с:", PDF_URL);
      pdfDoc = await pdfjsLib.getDocument({
        url: PDF_URL,
        withCredentials: false,
        headers: {
          Accept: "application/pdf"
        }
      }).promise;
      totalPages = pdfDoc.numPages;
      currentPage = 1;
      await renderPage(currentPage);
      console.log("✅ PDF загружен успешно, страниц:", totalPages);
    } catch (error) {
      console.error("❌ Ошибка при загрузке PDF:", error);
      pdfDoc = null;

      if (header) header.style.display = "block";
      mainContent.style.display = "block";
      pdfHeader.style.display = "none";
      pdfContainer.style.display = "none";
      footer.style.display = "block";
      isPDFOpen = false;

      let errorMsg = "Ошибка при загрузке PDF.";
      if (error.message.includes("CORS") || error.message.includes("NetworkError")) {
        errorMsg += "\n\nПроблема с доступом. Попробуйте позже или проверьте интернет.";
      } else if (error.message.includes("404")) {
        errorMsg += "\n\nFail - PDF файл не найден.";
      }

      alert(errorMsg + "\n\nДеталь: " + error.message);
    }
  } else {
    await renderPage(currentPage);
  }
}

function closePDF() {
  isPDFOpen = false;
  const pdfContainer = document.getElementById("pdfContainer");
  const mainContent = document.getElementById("mainContent");
  const pdfHeader = document.getElementById("pdfHeader");
  const header = document.querySelector("header:not(.pdf-header)");
  const footer = document.getElementById("footer");

  if (header) header.style.display = "block";
  pdfContainer.style.display = "none";
  pdfHeader.style.display = "none";
  mainContent.style.display = "block";
  footer.style.display = "block";
}

async function renderPage(pageNum) {
  if (!pdfDoc) {
    console.warn("⚠️ PDF документ не загружен");
    return;
  }

  try {
    console.log(`📄 Рендерим страницу ${pageNum}/${totalPages}`);
    const page = await pdfDoc.getPage(pageNum);
    const scale = window.innerWidth > 768 ? 1.5 : 1;
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    const renderContext = {
      canvasContext: context,
      viewport
    };

    await page.render(renderContext).promise;

    const pdfPages = document.getElementById("pdfPages");
    pdfPages.innerHTML = "";
    pdfPages.appendChild(canvas);

    document.getElementById("pageInfo").textContent = `${currentPage} / ${totalPages}`;
    document.getElementById("prevBtn").disabled = currentPage === 1;
    document.getElementById("nextBtn").disabled = currentPage === totalPages;

    console.log(`✅ Страница ${pageNum} загружена успешно`);
  } catch (error) {
    console.error("❌ Ошибка при рендеринге страницы:", error);
    alert("Ошибка при отображении страницы: " + error.message);
  }
}

async function nextPage() {
  if (currentPage < totalPages) {
    currentPage++;
    await renderPage(currentPage);
  }
}

async function previousPage() {
  if (currentPage > 1) {
    currentPage--;
    await renderPage(currentPage);
  }
}

/* =========================
   HERO
========================= */

function renderHero() {
  const hero = document.getElementById("hero");

  if (!cycle) {
    hero.innerHTML = `
      <section class="card">
        <div class="small">ВАШ ЦИКЛ</div>
        <h2>День 1</h2>
        <p>Начать можно сегодня, ${formatDateFullFriendly(todayISO())}.</p>
        <button class="primary" onclick="startCycle()">
          Начать цикл сегодня
        </button>
        <button class="pdf" onclick="openPDF()">
          Массаж + дыхание • PDF
        </button>
      </section>
    `;
    return;
  }

  if (cycle.paused) {
    hero.innerHTML = `
      <section class="card">
        <div class="small">ПАУЗА • ${formatDate(todayISO())}</div>
        <h2>Менструация</h2>
        <p>Массаж временно приостановлен. Счётчик дней не идёт.</p>
        <button class="resume" onclick="togglePause()">
          Продолжить цикл
        </button>
        <button class="pdf" onclick="openPDF()">
          Массаж + дыхание • PDF
        </button>
      </section>
    `;
    return;
  }

  hero.innerHTML = `
    <section class="card">
      <div class="small">СЕГОДНЯ • ${formatDateFullFriendly(todayISO())}</div>
      <h2>День ${currentDay()}</h2>
      <p class="description">
        Старт цикла: ${formatDate(cycle.start)}
      </p>
      <button class="pause" onclick="togglePause()">
        Началась менструация • Поставить на паузу
      </button>
      <div class="actions">
        <button onclick="startNewCycle()">
          Новый цикл
        </button>
      </div>
      <button class="pdf" onclick="openPDF()">
        Массаж + дыхание • PDF
      </button>
    </section>
  `;
}

function formatDateFullFriendly(iso) {
  const date = parseISODate(iso);
  return `${WEEKDAYS_RU[date.getDay()]}, ${date.getDate()} ${MONTHS_RU[date.getMonth()]}`;
}

/* =========================
   TABS
========================= */

function renderTabs() {
  document.getElementById("tabs").innerHTML = programs.map(program => `
    <button
      class="${activeProgram === program.id ? "active" : ""}"
      onclick="selectProgram('${program.id}')">
      ${program.title}
    </button>
  `).join("");
}

/* =========================
   NOTES UI
========================= */

function renderNoteBlock(key, completed) {
  if (!completed) {
    return `
      <p class="description noteHint">
        После выполнения дня появится поле «Как прошла практика?»
      </p>
    `;
  }

  const examples = NOTE_EXAMPLES.map((text, index) => `
    <button type="button" class="exampleChip" onclick="useNoteExample('${key}', ${index})">
      ${escapeHtml(text)}
    </button>
  `).join("");

  return `
    <div class="practiceNote">
      <label for="practiceNote"><b>Как прошла практика?</b></label>
      <p class="description">Моя заметка — напиши несколько слов.</p>
      <textarea
        id="practiceNote"
        rows="4"
        placeholder="Напиши несколько слов..."
        oninput="saveNote('${key}')"></textarea>
      <div class="exampleChips">${examples}</div>
    </div>
  `;
}

function hydrateNoteField(key) {
  const textarea = document.getElementById("practiceNote");
  if (textarea) {
    textarea.value = getNote(key);
  }
}

let noteSaveTimer = null;

function saveNote(key) {
  const textarea = document.getElementById("practiceNote");
  if (!textarea) return;
  marks[`${key}_note`] = textarea.value;
  clearTimeout(noteSaveTimer);
  noteSaveTimer = setTimeout(() => save(), 250);
}

function useNoteExample(key, index) {
  const textarea = document.getElementById("practiceNote");
  const text = NOTE_EXAMPLES[index] || "";
  if (textarea) textarea.value = text;
  marks[`${key}_note`] = text;
  save();
}

function renderDaySteps(key, item, reminder) {
  const steps = [];

  if (reminder) {
    steps.push({
      note: true,
      title: reminder[0],
      text: reminder[1]
    });
  }

  if (item[2] !== "rest" && item[0] !== "Дыхание") {
    steps.push({
      title: "Дыхание",
      text: "Выполнить дыхательные упражнения по схеме из PDF."
    });
    steps.push({
      title: "Лубрикант",
      text: "Водный лубрикант."
    });
  }

  if (item[2] !== "rest") {
    steps.push({
      title: item[2] === "breath" ? "Дыхание" : "Массаж",
      text: item[1] ? `${item[0]} · ${item[1]}` : item[0]
    });
  } else {
    steps.push({
      title: "Отдых",
      text: "Сегодня без массажа. Можно отметить день и оставить заметку."
    });
  }

  const saved = marks[`${key}_steps`] || [];

  const stepsHtml = steps.map((step, index) => `
    <label class="step ${step.note ? "note" : ""}">
      <input
        type="checkbox"
        ${saved[index] ? "checked" : ""}
        onchange="toggleStep('${key}', ${index}, this.checked)">
      <span>
        <b>${escapeHtml(step.title)}</b>
        <small>${escapeHtml(step.text)}</small>
      </span>
    </label>
  `).join("");

  return { steps, html: stepsHtml };
}

/* =========================
   CALENDAR
========================= */

function renderCalendar() {
  const program = programById(activeProgram);
  const todayIndex = cycle ? currentDay() - 1 : -1;

  let html = `
    <section class="card">
      <h2>${program.title}</h2>
      <div class="description">${program.description}</div>
      <div class="legend">
        <span class="tag vulvaTag">Вульва</span>
        <span class="tag clitTag">Клитор</span>
        <span class="tag gTag">Зона G</span>
        <span class="tag kTag">Зона К</span>
        <span class="tag breathTag">Дыхание</span>
        <span class="tag restTag">Отдых</span>
      </div>
      <div class="calendar">
  `;

  program.days.forEach((item, index) => {
    const key = markKeyForProgram(program.id, index);
    const completed = isCompleted(key);
    const dateISO = programSlotDate(index);
    const isToday = Boolean(cycle) && !cycle.paused && index === todayIndex;
    const note = getNote(key);

    html += `
      <button
        class="day ${item[2]} ${completed ? "completed" : ""} ${isToday ? "today" : ""}"
        onclick="openDay('${program.id}', ${index})">
        <strong>День ${index + 1}</strong>
        <div class="dayDate">${dateISO ? formatDateShort(dateISO) : "дата после старта"}</div>
        <div class="dayName">${item[0]}</div>
        <div class="minutes">${item[1] || (isToday ? "сегодня" : "")}</div>
        ${note ? `<div class="dayNotePreview">• ${escapeHtml(note)}</div>` : ""}
        <span class="check">✓</span>
      </button>
    `;
  });

  html += `
      </div>
    </section>
  `;

  document.getElementById("content").innerHTML = html + renderHistoryHtml();
}

/* =========================
   MAINTENANCE
========================= */

function maintenanceWeekdays() {
  return cycle?.maintenanceWeekdays || [];
}

function toggleMaintenanceWeekday(id) {
  if (!cycle) {
    alert("Сначала начни цикл — тогда можно выбрать дни практики.");
    return;
  }

  const selected = maintenanceWeekdays().slice();
  const position = selected.indexOf(id);

  if (position >= 0) {
    selected.splice(position, 1);
  } else if (selected.length >= 2) {
    alert("Для поддержания выбери 1 или 2 дня в неделю.");
    return;
  } else {
    selected.push(id);
  }

  cycle.maintenanceWeekdays = selected;
  persistUserData();
  render();
}

function showMoreMaintenanceWeeks() {
  maintenanceWeeksShown = Math.min(
    MAINTENANCE_WEEKS_MAX,
    maintenanceWeeksShown + 16
  );
  render();
}

function renderMaintenanceCalendar() {
  const program = programById("maintenance");
  const selected = maintenanceWeekdays();
  const startISO = cycle?.start || todayISO();
  const firstMonday = mondayOf(startISO);
  const today = todayISO();

  const weekdayButtons = WEEKDAY_SHORT.map(day => `
    <button
      type="button"
      class="weekdayBtn ${selected.includes(day.id) ? "active" : ""}"
      onclick="toggleMaintenanceWeekday(${day.id})">
      ${day.label}
    </button>
  `).join("");

  let weeksHtml = "";

  if (!cycle) {
    weeksHtml = `<p class="description">Начни цикл, чтобы открыть календарь поддержания.</p>`;
  } else if (!selected.length) {
    weeksHtml = `<p class="description">Выбери 1–2 дня недели — на них будут повторяться тренировки.</p>`;
  } else {
    for (let week = 0; week < maintenanceWeeksShown; week += 1) {
      const monday = addDaysISO(firstMonday, week * 7);
      const sunday = addDaysISO(monday, 6);
      const daysHtml = [0, 1, 2, 3, 4, 5, 6].map(offset => {
        const dateISO = addDaysISO(monday, offset);
        const jsDay = parseISODate(dateISO).getDay();
        if (!selected.includes(jsDay)) return "";

        const key = markKeyForMaintenance(dateISO);
        const completed = isCompleted(key);
        const isToday = dateISO === today && !cycle.paused;
        const note = getNote(key);
        const weekdayLabel = WEEKDAY_SHORT.find(item => item.id === jsDay)?.label || "";

        return `
          <button
            class="day practice ${completed ? "completed" : ""} ${isToday ? "today" : ""}"
            onclick="openMaintenanceDay('${dateISO}')">
            <strong>${weekdayLabel}</strong>
            <div class="dayDate">${formatDate(dateISO)}</div>
            <div class="dayName">Практика</div>
            <div class="minutes">12–15 мин</div>
            ${note ? `<div class="dayNotePreview">• ${escapeHtml(note)}</div>` : ""}
            <span class="check">✓</span>
          </button>
        `;
      }).join("");

      weeksHtml += `
        <div class="weekBlock">
          <div class="weekLabel">Неделя ${week + 1} · ${formatDateRange(monday, sunday)}</div>
          <div class="calendar weekCalendar">${daysHtml}</div>
        </div>
      `;
    }
  }

  const moreButton = selected.length && maintenanceWeeksShown < MAINTENANCE_WEEKS_MAX
    ? `<button class="moreWeeks" onclick="showMoreMaintenanceWeeks()">Показать ещё 16 недель</button>`
    : "";

  document.getElementById("content").innerHTML = `
    <section class="card">
      <h2>${program.title}</h2>
      <div class="description">${program.description}</div>
      <div class="weekdayRow">${weekdayButtons}</div>
      ${weeksHtml}
      ${moreButton}
    </section>
    ${renderHistoryHtml()}
  `;
}

/* =========================
   OPEN DAY
========================= */

function openDay(id, index) {
  openDayState = { kind: "program", id, index };
  render();
}

function openMaintenanceDay(dateISO) {
  openDayState = { kind: "maintenance", date: dateISO };
  render();
}

function closeDay() {
  openDayState = null;
  render();
}

function renderOpenDay() {
  if (!openDayState) return false;

  if (openDayState.kind === "program") {
    renderProgramDay(openDayState.id, openDayState.index);
    return true;
  }

  if (openDayState.kind === "maintenance") {
    renderMaintenanceSession(openDayState.date);
    return true;
  }

  return false;
}

function renderProgramDay(id, index) {
  const program = programById(id);
  const item = program.days[index];
  const key = markKeyForProgram(id, index);
  const dateISO = programSlotDate(index);
  const reminder = getReminder(id, index);
  const { steps, html: stepsHtml } = renderDaySteps(key, item, reminder);
  const completed = isCompleted(key);

  document.getElementById("content").innerHTML = `
    <section class="card">
      <div class="small">${dateISO ? formatDateFullFriendly(dateISO) : "Дата появится после старта цикла"}</div>
      <h2>День ${index + 1} · ${escapeHtml(item[0])}</h2>
      <div class="description">${escapeHtml(item[1] || "")}</div>
      ${stepsHtml}
      ${renderNoteBlock(key, completed)}
      <div class="actions">
        <button onclick="closeDay()">← К календарю</button>
        <button onclick="finishDay('${key}', ${steps.length})">✓ Завершить день</button>
      </div>
    </section>
  `;

  hydrateNoteField(key);
}

function renderMaintenanceSession(dateISO) {
  const key = markKeyForMaintenance(dateISO);
  const item = ["Практика поддержания", "12–15 мин", "practice"];
  const reminder = getReminder("maintenance", 0);
  const { steps, html: stepsHtml } = renderDaySteps(key, item, reminder);
  const completed = isCompleted(key);

  document.getElementById("content").innerHTML = `
    <section class="card">
      <div class="small">${formatDateFullFriendly(dateISO)}</div>
      <h2>Поддержание · тренировка</h2>
      <div class="description">Короткая практика. После выполнения можно оставить заметку к этой тренировке.</div>
      ${stepsHtml}
      ${renderNoteBlock(key, completed)}
      <div class="actions">
        <button onclick="closeDay()">← К календарю</button>
        <button onclick="finishDay('${key}', ${steps.length})">✓ Завершить тренировку</button>
      </div>
    </section>
  `;

  hydrateNoteField(key);
}

/* =========================
   STEP / FINISH
========================= */

function toggleStep(key, index, value) {
  const arr = marks[`${key}_steps`] || [];
  const wasCompleted = isCompleted(key);
  arr[index] = value;
  marks[`${key}_steps`] = arr;
  marks[key] = arr.length > 0 && arr.every(flag => flag === true);
  save();
  updateProgress();

  if (openDayState && wasCompleted !== isCompleted(key)) {
    render();
  }
}

function finishDay(key, count) {
  marks[`${key}_steps`] = Array(count).fill(true);
  marks[key] = true;
  persistUserData();
  render();
}

/* =========================
   PROGRAM
========================= */

function selectProgram(id) {
  activeProgram = id;
  openDayState = null;
  if (cycle) {
    cycle.programId = id;
    persistUserData();
  }
  render();
}

/* =========================
   HISTORY
========================= */

function renderHistoryHtml() {
  if (!cycleHistory.length) return "";

  const items = cycleHistory.map((item, index) => {
    const program = programById(item.programId);
    const title = program?.title || item.programId;
    const notes = collectNotes(item.marks).slice(0, 3);
    const notesHtml = notes.map(note =>
      `<div class="historyNote">• ${escapeHtml(note)}</div>`
    ).join("");

    return `
      <div class="historyItem">
        <button type="button" class="historyToggle" onclick="toggleHistoryDetails(${index})">
          <strong>${escapeHtml(title)}</strong>
          <span>${formatDateRange(item.start, item.end)} · ${item.completed || 0} отметок</span>
        </button>
        <div class="historyDetails" id="historyDetails-${index}" hidden>
          ${notesHtml || "<div class=\"description\">Заметок не было</div>"}
        </div>
      </div>
    `;
  }).join("");

  return `
    <section class="card">
      <h2>История циклов</h2>
      <div class="description">Прошлые циклы остаются в этом браузере.</div>
      <div class="historyList">${items}</div>
    </section>
  `;
}

function collectNotes(sourceMarks) {
  const data = sourceMarks || {};
  return Object.keys(data)
    .filter(key => key.endsWith("_note") && data[key])
    .map(key => data[key]);
}

function toggleHistoryDetails(index) {
  const node = document.getElementById(`historyDetails-${index}`);
  if (!node) return;
  node.hidden = !node.hidden;
}

/* =========================
   PROGRESS
========================= */

function updateProgress() {
  let total = 0;
  let done = 0;
  const program = programById(activeProgram);

  if (activeProgram === "maintenance") {
    const selected = maintenanceWeekdays();
    if (cycle && selected.length) {
      const firstMonday = mondayOf(cycle.start);
      const today = todayISO();
      const weeks = Math.min(
        maintenanceWeeksShown,
        Math.max(1, Math.ceil((diffDaysISO(firstMonday, today) + 1) / 7) + 1)
      );

      for (let week = 0; week < weeks; week += 1) {
        const monday = addDaysISO(firstMonday, week * 7);
        for (let offset = 0; offset < 7; offset += 1) {
          const dateISO = addDaysISO(monday, offset);
          const jsDay = parseISODate(dateISO).getDay();
          if (!selected.includes(jsDay)) continue;
          if (dateISO > today) continue;
          total += 1;
          if (isCompleted(markKeyForMaintenance(dateISO))) done += 1;
        }
      }
    }
  } else if (program?.days?.length) {
    total = program.days.length;
    program.days.forEach((_, index) => {
      if (isCompleted(markKeyForProgram(program.id, index))) done += 1;
    });
  }

  const percent = total ? Math.round(done / total * 100) : 0;

  document.getElementById("progressFill").style.width = percent + "%";
  document.getElementById("progressText").textContent = cycle
    ? `${done} из ${total} отмечено · ${percent}%`
    : "Цикл еще не начат";
}

function renderFooter() {
  const footer = document.getElementById("footer");
  if (!footer) return;
  footer.innerHTML = `
    Данные хранятся только на этом устройстве.
    На iPhone добавь приложение на экран «Домой» в Safari — так браузер реже стирает записи.
  `;
}

/* =========================
   RENDER
========================= */

function render() {
  renderHero();
  renderTabs();

  if (!renderOpenDay()) {
    if (activeProgram === "maintenance") {
      renderMaintenanceCalendar();
    } else {
      renderCalendar();
    }
  }

  updateProgress();
  renderFooter();
}

/* =========================
   NOTIFICATIONS SYSTEM
========================= */

async function requestNotificationPermission() {
  if (!("Notification" in window)) {
    console.warn("⚠️ Браузер не поддерживает Notification API");
    return false;
  }

  if (Notification.permission === "granted") {
    return true;
  }

  if (Notification.permission === "denied") {
    return false;
  }

  try {
    const permission = await Notification.requestPermission();
    return permission === "granted";
  } catch (error) {
    console.error("Ошибка при запросе разрешения на уведомления:", error);
    return false;
  }
}

function sendNotification(title, options = {}) {
  if (Notification.permission !== "granted") return;

  const defaultOptions = {
    icon: "./icons/icon-192.svg",
    badge: "./icons/icon-192.svg",
    tag: "cycle-reminder",
    requireInteraction: false,
    silent: false
  };

  try {
    const notification = new Notification(title, { ...defaultOptions, ...options });
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
    return notification;
  } catch (error) {
    console.error("Ошибка при отправке уведомления:", error);
  }
}

function sendNotificationViaSW(title, options = {}) {
  if (!navigator.serviceWorker?.controller) {
    return sendNotification(title, options);
  }

  try {
    navigator.serviceWorker.controller.postMessage({
      type: "SEND_NOTIFICATION",
      title,
      options
    });
  } catch (error) {
    console.error("Ошибка при отправке уведомления через SW:", error);
  }
}

function scheduleDailyReminder(hour, minute, getReminderData) {
  function checkAndSend() {
    const now = new Date();
    if (now.getHours() === hour && now.getMinutes() === minute) {
      const reminderData = getReminderData();
      if (reminderData) {
        sendNotificationViaSW(reminderData.title, reminderData.options);
      }
    }
    setTimeout(checkAndSend, 60000);
  }

  checkAndSend();
}

function todayReminderContext() {
  const program = programById(activeProgram);
  const day = currentDay();

  if (activeProgram === "maintenance") {
    const key = markKeyForMaintenance(todayISO());
    const selected = maintenanceWeekdays();
    const jsDay = new Date().getDay();
    const isPractice = selected.includes(jsDay);
    return {
      program,
      day,
      title: "Практика",
      duration: "12–15 мин",
      completed: isCompleted(key),
      isPractice
    };
  }

  const dayData = program?.days[day - 1];
  const key = markKeyForProgram(activeProgram, day - 1);

  return {
    program,
    day,
    title: dayData?.[0],
    duration: dayData?.[1],
    completed: isCompleted(key),
    isPractice: Boolean(dayData)
  };
}

function initializeReminders() {
  if (!cycle || cycle.paused) return;

  scheduleDailyReminder(9, 0, () => {
    const context = todayReminderContext();
    if (!context.program) return null;
    return {
      title: `День ${context.day}! Доброе утро!`,
      options: {
        body: `${context.program.title} ждет тебя. Открой приложение.`,
        badge: "./icons/icon-192.svg"
      }
    };
  });

  scheduleDailyReminder(18, 0, () => {
    const context = todayReminderContext();
    if (!context.isPractice) return null;
    if (context.completed) {
      return {
        title: `День ${context.day} завершен!`,
        options: { body: "Отличная работа! Твой прогресс впечатляет." }
      };
    }
    return {
      title: `День ${context.day}: ${context.title}`,
      options: {
        body: `${context.duration || ""} • Не забудь сегодняшний массаж!`.trim(),
        badge: "./icons/icon-192.svg"
      }
    };
  });

  scheduleDailyReminder(21, 0, () => {
    const context = todayReminderContext();
    if (!context.isPractice || context.completed) return null;
    return {
      title: "Последний звонок!",
      options: {
        body: "Еще есть время на сегодняшний массаж перед сном.",
        requireInteraction: true
      }
    };
  });
}

async function notifyStorageStatus() {
  if (!window.StorageManager) return;

  const isPersistent = await StorageManager.checkPersistentStorage();

  if (!isPersistent && Notification.permission === "granted") {
    setTimeout(() => {
      sendNotificationViaSW("Совет по сохранению данных", {
        body: "Добавь приложение на экран Домой и разреши постоянное хранилище, чтобы записи не стёрлись.",
        badge: "./icons/icon-192.svg",
        tag: "storage-tip"
      });
    }, 3000);
  }
}

function bindPersistenceEvents() {
  const flush = () => {
    save();
  };

  window.addEventListener("pagehide", flush);
  window.addEventListener("beforeunload", flush);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });
}

async function initializeApp() {
  if (window.StorageManager) {
    await StorageManager.initialize();
  }

  await loadAppData();
  render();
  bindPersistenceEvents();

  await requestNotificationPermission();
  initializeReminders();
  await notifyStorageStatus();
  registerPWA();

  if (window.StorageManager) {
    await persistUserData();
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeApp);
} else {
  initializeApp();
}
