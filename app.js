
/* =========================
   APP VERSION / PWA UPDATE
   ========================= */

const APP_VERSION = "1.1.0";

function registerPWA() {
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register(
        `./sw.js?v=${encodeURIComponent(APP_VERSION)}`,
        { updateViaCache: "none" }
      );

      // Ask the browser to check for a new Service Worker on every page load.
      await registration.update();

      // If a new worker is waiting, activate it immediately.
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

const PDF_URL =
  "https://about-man.ru/pl/fileservice/user/file/download/h/9db14a308a7be57b2c9d1b8fe60d178d.pdf";


/* =========================
   ПРОГРАМИ
========================= */

const programs = [

  {
    id: "vulva",
    title: "Вульва",
    description: "8 днів. Масаж через день.",
    days: [
      ["Вульва", "8 хв", "vulva"],
      ["Відпочинок", "", "rest"],
      ["Вульва", "8 хв", "vulva"],
      ["Відпочинок", "", "rest"],
      ["Вульва", "8 хв", "vulva"],
      ["Відпочинок", "", "rest"],
      ["Вульва", "8 хв", "vulva"],
      ["Відпочинок", "", "rest"]
    ]
  },

  {
    id: "clit",
    title: "Клитор",
    description: "4 → 8 → 12 хвилин.",
    days: [
      ["Клитор", "4 хв", "clit"],
      ["Клитор", "4 хв", "clit"],
      ["Клитор", "4 хв", "clit"],
      ["Клитор", "8 хв", "clit"],
      ["Клитор", "8 хв", "clit"],
      ["Клитор", "8 хв", "clit"],
      ["Клитор", "12 хв", "clit"],
      ["Клитор", "12 хв", "clit"],
      ["Відпочинок", "", "rest"]
    ]
  },

  {
    id: "combo",
    title: "Вульва + клитор",
    description: "Чергуємо вульву та клитор.",
    days: [
      ["Вульва", "8 хв", "vulva"],
      ["Клитор", "12 хв", "clit"],
      ["Вульва", "8 хв", "vulva"],
      ["Клитор", "12 хв", "clit"],
      ["Вульва", "8 хв", "vulva"],
      ["Клитор", "12 хв", "clit"],
      ["Відпочинок", "", "rest"]
    ]
  },

  {
    id: "g",
    title: "Зона G",
    description: "7 днів. Повторювати 2–4 тижні.",
    days: [
      ["Вульва", "8 хв", "vulva"],
      ["Зона G", "12 хв", "g"],
      ["Вульва", "8 хв", "vulva"],
      ["Зона G", "12 хв", "g"],
      ["Вульва", "8 хв", "vulva"],
      ["Клитор", "12 хв", "clit"],
      ["Відпочинок", "", "rest"]
    ]
  },

  {
    id: "k",
    title: "Зона К",
    description: "7 днів. Повторювати 2–4 тижні.",
    days: [
      ["Вульва", "8 хв", "vulva"],
      ["Зона К", "12 хв", "k"],
      ["Вульва", "8 хв", "vulva"],
      ["Зона К", "12 хв", "k"],
      ["Вульва", "8 хв", "vulva"],
      ["Клитор", "12 хв", "clit"],
      ["Відпочинок", "", "rest"]
    ]
  },

  {
    id: "maintenance",
    title: "Підтримання",
    description: "1–2 рази на тиждень.",
    days: [
      ["Дихання", "12 хв", "breath"],
      ["Вульва", "3 хв", "vulva"],
      ["Клитор", "3 хв", "clit"],
      ["Зона G", "3 хв", "g"],
      ["Зона К", "3 хв", "k"]
    ]
  }

];


/* =========================
   СТАН
========================= */

let cycle = null;
let marks = {};
let activeProgram = "vulva";
let isPDFOpen = false;

/**
 * Загрузка данных из безопасного хранилища
 */
async function loadAppData() {
  try {
    const cycleData = await StorageManager.get("cycleData");
    const cycleMarks = await StorageManager.get("cycleMarks");

    cycle = cycleData || null;
    marks = cycleMarks || {};

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
    await StorageManager.set("cycleData", cycle);
    await StorageManager.set("cycleMarks", marks);
  } catch (error) {
    console.error("Ошибка при сохранении данных:", error);
  }
}


/* =========================
   START
========================= */

function startCycle() {

  cycle = {
    start:
      new Date().toISOString().slice(0, 10),

    paused: false,

    pauseStart: null,

    pausedDays: 0
  };

  marks = {};

  save();

  render();

}


/* =========================
   DAY
========================= */

function currentDay() {

  if (!cycle) return 1;

  const start =
    new Date(cycle.start);

  const now =
    new Date();

  let days =
    Math.floor(
      (now - start) / 86400000
    ) + 1;

  days -=
    cycle.pausedDays || 0;

  return Math.max(1, days);

}


/* =========================
   MENSTRUATION PAUSE
========================= */

function togglePause() {

  if (!cycle) return;

  if (!cycle.paused) {

    cycle.paused = true;

    cycle.pauseStart =
      new Date()
        .toISOString()
        .slice(0, 10);

  }

  else {

    const a =
      new Date(cycle.pauseStart);

    const b =
      new Date();

    const days =
      Math.max(
        1,
        Math.floor(
          (b - a) / 86400000
        )
      );

    cycle.pausedDays =
      (cycle.pausedDays || 0)
      + days;

    cycle.paused = false;

    cycle.pauseStart = null;

  }

  save();

  render();

}


/* =========================
   REMINDERS
========================= */

function getReminder(id, index) {

  if (
    id === "vulva" &&
    index % 2 === 0
  ) {

    return [
      "Підготовка",
      "Водний лубрикант з гіалуроновою кислотою"
    ];

  }


  if (
    id === "clit" &&
    index <= 7
  ) {

    return [
      "За 15 хвилин",
      "Крем з L-Arginin"
    ];

  }


  if (
    id === "g" &&
    (index === 1 || index === 3)
  ) {

    return [
      "За 20 хвилин",
      "Крем G-Spot"
    ];

  }


  if (
    id === "k" &&
    (index === 1 || index === 3)
  ) {

    return [
      "Підготовка",
      "Водний лубрикант"
    ];

  }


  return null;

}


/* =========================
   PDF NAVIGATION
========================= */

function openPDF() {
  isPDFOpen = true;
  const pdfViewer = document.getElementById("pdfViewer");
  const mainContent = document.getElementById("mainContent");
  const pdfHeader = document.getElementById("pdfHeader");
  const header = document.querySelector("header:not(.pdf-header)");
  const footer = document.getElementById("footer");

  if (header) header.style.display = "none";
  mainContent.style.display = "none";
  pdfHeader.style.display = "flex";
  footer.style.display = "none";
  pdfViewer.style.display = "block";

  // Open PDF directly in iframe
  pdfViewer.src = PDF_URL;
}

function closePDF() {
  isPDFOpen = false;
  const pdfViewer = document.getElementById("pdfViewer");
  const mainContent = document.getElementById("mainContent");
  const pdfHeader = document.getElementById("pdfHeader");
  const header = document.querySelector("header:not(.pdf-header)");
  const footer = document.getElementById("footer");

  if (header) header.style.display = "block";
  pdfViewer.style.display = "none";
  pdfHeader.style.display = "none";
  mainContent.style.display = "block";
  footer.style.display = "block";
  pdfViewer.src = "";
}

/* =========================
   HERO
========================= */

function renderHero() {

  const hero =
    document.getElementById("hero");


  if (!cycle) {

    hero.innerHTML = `

      <section class="card">

        <div class="small">
          ТВОЄЙ ЦИКЛ
        </div>

        <h2>
          День 1 🧡
        </h2>

        <p>
          Почати можна сьогодні,
          незалежно від дня тижня.
        </p>

        <button
          class="primary"
          onclick="startCycle()">

          Почати цикл сьогодні

        </button>

        <button
          class="pdf"
          onclick="openPDF()">

          📖 Массаж + дихання • PDF

        </button>

      </section>

    `;

    return;

  }


  if (cycle.paused) {

    hero.innerHTML = `

      <section class="card">

        <div class="small">
          ПАУЗА
        </div>

        <h2>
          🩷 Менструація
        </h2>

        <p>
          Масаж тимчасово призупинено.
        </p>

        <button
          class="resume"
          onclick="togglePause()">

          Продовжити цикл

        </button>

        <button
          class="pdf"
          onclick="openPDF()">

          📖 Массаж + дихання • PDF

        </button>

      </section>

    `;

    return;

  }


  hero.innerHTML = `

    <section class="card">

      <div class="small">
        СЬОГОДНІ
      </div>

      <h2>
        День ${currentDay()} 🧡
      </h2>

      <button
        class="pause"
        onclick="togglePause()">

        🩷 Почалася менструація
        • Поставити паузу

      </button>

      <div class="actions">

        <button onclick="startCycle()">
          Новий цикл
        </button>

      </div>

      <button
        class="pdf"
        onclick="openPDF()">

        📖 Массаж + дихання • PDF

      </button>

    </section>

  `;

}


/* =========================
   TABS
========================= */

function renderTabs() {

  document.getElementById("tabs")
    .innerHTML =

    programs.map(p => `

      <button
        class="${activeProgram === p.id ? 'active' : ''}"
        onclick="selectProgram('${p.id}')">

        ${p.title}

      </button>

    `).join("");

}


/* =========================
   CALENDAR
========================= */

function renderCalendar() {

  const p =
    programs.find(
      x => x.id === activeProgram
    );

  let html = `

    <section class="card">

      <h2>
        ${p.title}
      </h2>

      <div class="description">
        ${p.description}
      </div>

      <div class="legend">

        <span class="tag vulvaTag">
          Вульва
        </span>

        <span class="tag clitTag">
          Клитор
        </span>

        <span class="tag gTag">
          🌊 Зона G
        </span>

        <span class="tag kTag">
          Зона К
        </span>

        <span class="tag breathTag">
          Дихання
        </span>

        <span class="tag restTag">
          Відпочинок
        </span>

      </div>

      <div class="calendar">
  `;


  p.days.forEach(
    (item, index) => {

      const key =
        p.id + "_" + index;

      const completed =
        marks[key] === true;

      html += `

        <button
          class="
            day
            ${item[2]}
            ${completed ? 'completed' : ''}
          "
          onclick="
            openDay('${p.id}',${index})
          ">

          <strong>
            День ${index + 1}
          </strong>

          <div class="dayName">
            ${item[0]}
          </div>

          <div class="minutes">
            ${item[1]}
          </div>

          <span class="check">
            ✓
          </span>

        </button>

      `;

    }
  );


  html += `

      </div>

    </section>

  `;

  document.getElementById("content")
    .innerHTML = html;

}


/* =========================
   OPEN DAY
========================= */

function openDay(id, index) {

  const p =
    programs.find(
      x => x.id === id
    );

  const item =
    p.days[index];

  const key =
    id + "_" + index;


  if (item[2] === "rest") {

    marks[key] =
      !marks[key];

    save();

    render();

    return;

  }


  const steps = [];

  const reminder =
    getReminder(id, index);


  if (reminder) {

    steps.push({

      note: true,

      title: reminder[0],

      text: reminder[1]

    });

  }


  if (item[0] !== "Дихання") {

    steps.push({

      title: "Дихання",

      text: "Виконати дихальні вправи за схемою з PDF."

    });


    steps.push({

      title: "Лубрикант",

      text: "Водний лубрикант."

    });

  }


  steps.push({

    title: "Массаж",

    text:
      item[0] + " · " + item[1]

  });


  const saved =
    marks[key + "_steps"] || [];


  let html = `

    <section class="card">

      <h2>
        День ${index + 1}
        · ${item[0]}
      </h2>

      <div class="description">
        ${item[1]}
      </div>

  `;


  steps.forEach(
    (s, n) => {

      html += `

        <label
          class="step
          ${s.note ? 'note' : ''}">

          <input
            type="checkbox"
            ${saved[n] ? 'checked' : ''}
            onchange="
              toggleStep(
                '${key}',
                ${n},
                this.checked
              )
            ">

          <span>

            <b>
              ${s.title}
            </b>

            <small>
              ${s.text}
            </small>

          </span>

        </label>

      `;

    }
  );


  html += `

      <div class="actions">

        <button
          onclick="render()">

          ← До календаря

        </button>

        <button
          onclick="
            finishDay(
              '${key}',
              ${steps.length}
            )
          ">

          ✓ Завершити день

        </button>

      </div>

    </section>

  `;


  document.getElementById("content")
    .innerHTML = html;

}


/* =========================
   STEP
========================= */

function toggleStep(key, index, value) {

  const arr =
    marks[key + "_steps"] || [];

  arr[index] = value;

  marks[key + "_steps"] = arr;

  marks[key] =
    arr.length > 0 &&
    arr.every(Boolean);

  save();

  updateProgress();

}


/* =========================
   FINISH
========================= */

function finishDay(key, count) {

  marks[key + "_steps"] =
    Array(count).fill(true);

  marks[key] = true;

  save();

  render();

}


/* =========================
   PROGRAM
========================= */

function selectProgram(id) {

  activeProgram = id;

  render();

}


/* =========================
   PROGRESS
========================= */

function updateProgress() {

  let total = 0;
  let done = 0;


  programs.forEach(
    p => {

      p.days.forEach(
        (_, i) => {

          total++;

          if (
            marks[p.id + "_" + i]
          ) {

            done++;

          }

        }
      );

    }
  );


  const percent =
    Math.round(
      done / total * 100
    );


  document.getElementById(
    "progressFill"
  ).style.width =
    percent + "%";


  document.getElementById(
    "progressText"
  ).textContent =

    cycle
      ? `${done} із ${total} відмічено · ${percent}%`
      : "Цикл ще не розпочато";

}


/* =========================
   RENDER
========================= */

function render() {

  renderHero();

  renderTabs();

  renderCalendar();

  updateProgress();

}


/**
 * Инициализация приложения
 */
async function initializeApp() {
  // Ждем загрузки хранилища
  if (window.StorageManager) {
    await StorageManager.initialize();
  }

  // Загружаем данные приложения
  await loadAppData();

  // Отображаем приложение
  render();

  // Регистрируем PWA
  registerPWA();

  // Уведомляем пользователя о статусе хранилища (если нужно)
  if (window.StorageManager) {
    const isPersistent = StorageManager.getPersistentStatus();
    if (!isPersistent) {
      console.info(
        "💡 Совет: Браузер может удалить ваши данные при очистке истории. " +
        "Рекомендуем разрешить постоянное хранилище."
      );
    }
  }
}

// Запуск инициализации
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeApp);
} else {
  initializeApp();
}
