
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

let pdfDoc = null;
let currentPage = 1;
let totalPages = 0;


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

  // Load PDF if not already loaded
  if (!pdfDoc) {
    try {
      console.log("📖 Загружаем PDF с:", PDF_URL);
      pdfDoc = await pdfjsLib.getDocument({
        url: PDF_URL,
        withCredentials: false,
        headers: {
          'Accept': 'application/pdf'
        }
      }).promise;
      totalPages = pdfDoc.numPages;
      currentPage = 1;
      await renderPage(currentPage);
      console.log("✅ PDF загружен успешно, страниц:", totalPages);
    } catch (error) {
      console.error("❌ Ошибка при загрузке PDF:", error);
      pdfDoc = null;
      
      // Восстановить интерфейс
      if (header) header.style.display = "block";
      mainContent.style.display = "block";
      pdfHeader.style.display = "none";
      pdfContainer.style.display = "none";
      footer.style.display = "block";
      isPDFOpen = false;
      
      // Показать деталь ошибки
      let errorMsg = "Помилка при завантаженні PDF.";
      if (error.message.includes("CORS") || error.message.includes("NetworkError")) {
        errorMsg += "\n\nПроблема с доступом. Спробуйте позже или проверьте інтернет.";
      } else if (error.message.includes("404")) {
        errorMsg += "\n\nFail - PDF файл не знайдено.";
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
    console.log(`📄 Рендерируем страницу ${pageNum}/${totalPages}`);
    const page = await pdfDoc.getPage(pageNum);
    const scale = window.innerWidth > 768 ? 1.5 : 1;
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    const renderContext = {
      canvasContext: context,
      viewport,
    };

    await page.render(renderContext).promise;

    const pdfPages = document.getElementById("pdfPages");
    pdfPages.innerHTML = "";
    pdfPages.appendChild(canvas);

    // Update page info
    document.getElementById("pageInfo").textContent = `${currentPage} / ${totalPages}`;

    // Update button states
    document.getElementById("prevBtn").disabled = currentPage === 1;
    document.getElementById("nextBtn").disabled = currentPage === totalPages;
    
    console.log(`✅ Страница ${pageNum} загружена успешно`);
  } catch (error) {
    console.error("❌ Ошибка при рендеринге страницы:", error);
    alert("Помилка при показуванні сторінки: " + error.message);
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


/* =========================
   NOTIFICATIONS SYSTEM
========================= */

/**
 * Запросить разрешение на уведомления
 */
async function requestNotificationPermission() {
  if (!("Notification" in window)) {
    console.warn("⚠️ Браузер не поддерживает Notification API");
    return false;
  }

  if (Notification.permission === "granted") {
    console.log("✅ Уведомления уже разрешены");
    return true;
  }

  if (Notification.permission === "denied") {
    console.log("❌ Уведомления запрещены пользователем");
    return false;
  }

  try {
    const permission = await Notification.requestPermission();
    const granted = permission === "granted";
    console.log(granted ? "✅ Уведомления разрешены" : "❌ Уведомления запрещены");
    return granted;
  } catch (error) {
    console.error("Ошибка при запросе разрешения на уведомления:", error);
    return false;
  }
}

/**
 * Отправить уведомление напрямую (если браузер открыт)
 */
function sendNotification(title, options = {}) {
  if (Notification.permission !== "granted") {
    return;
  }

  const defaultOptions = {
    icon: "./icons/icon-192.svg",
    badge: "./icons/icon-192.svg",
    tag: "cycle-reminder",
    requireInteraction: false,
    silent: false
  };

  try {
    const notification = new Notification(title, { ...defaultOptions, ...options });
    console.log("📬 Уведомление отправлено:", title);

    notification.onclick = () => {
      window.focus();
      notification.close();
    };

    return notification;
  } catch (error) {
    console.error("Ошибка при отправке уведомления:", error);
  }
}

/**
 * Отправить уведомление через Service Worker (более надежно)
 */
function sendNotificationViaSW(title, options = {}) {
  if (!navigator.serviceWorker?.controller) {
    console.warn("⚠️ Service Worker не готов, используем встроенное уведомление");
    return sendNotification(title, options);
  }

  try {
    navigator.serviceWorker.controller.postMessage({
      type: "SEND_NOTIFICATION",
      title,
      options
    });
    console.log("📬 Уведомление отправлено через SW:", title);
  } catch (error) {
    console.error("Ошибка при отправке уведомления через SW:", error);
  }
}

/**
 * Запланировать напоминание на определенное время каждый день
 */
function scheduleDailyReminder(hour, minute, getReminderData) {
  function checkAndSend() {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    if (currentHour === hour && currentMinute === minute) {
      const reminderData = getReminderData();
      if (reminderData) {
        sendNotificationViaSW(reminderData.title, reminderData.options);
      }
    }

    // Проверять каждую минуту
    setTimeout(checkAndSend, 60000);
  }

  checkAndSend();
}

/**
 * Инициализировать напоминания программы
 */
function initializeReminders() {
  if (!cycle || cycle.paused) {
    return;
  }

  // Напоминание в 09:00: "Добрый день, пора начинать!"
  scheduleDailyReminder(9, 0, () => {
    const program = programs.find(p => p.id === activeProgram);
    const day = currentDay();

    if (!program) return null;

    return {
      title: `🧡 День ${day}! Доброе утро!`,
      options: {
        body: `${program.title} ждет тебя. Открой приложение.`,
        badge: "./icons/icon-192.svg"
      }
    };
  });

  // Напоминание в 18:00: "Вечер! Не забыл сегодняшний план?"
  scheduleDailyReminder(18, 0, () => {
    const program = programs.find(p => p.id === activeProgram);
    const day = currentDay();
    const dayData = program?.days[day - 1];

    if (!dayData) return null;

    const key = activeProgram + "_" + (day - 1);
    const completed = marks[key] === true;

    if (completed) {
      return {
        title: `✅ День ${day} завершен!`,
        options: {
          body: "Отличная работа! Твой прогресс впечатляет."
        }
      };
    }

    return {
      title: `🧡 День ${day}: ${dayData[0]}`,
      options: {
        body: `⏱️ ${dayData[1]} • Не забудь сегодняшний массаж!`,
        badge: "./icons/icon-192.svg"
      }
    };
  });

  // Напоминание в 21:00: "Последний шанс сегодня"
  scheduleDailyReminder(21, 0, () => {
    const program = programs.find(p => p.id === activeProgram);
    const day = currentDay();
    const key = activeProgram + "_" + (day - 1);
    const completed = marks[key] === true;

    if (completed) {
      return null; // Не отправлять, если уже сделано
    }

    return {
      title: `🌙 Последний звонок!`,
      options: {
        body: "Еще есть время на сегодняшний массаж перед сном.",
        requireInteraction: true
      }
    };
  });

  console.log("✅ Система напоминаний инициализирована");
}

/**
 * Отправить notification при начале нового дня
 */
function notifyNewDay() {
  const program = programs.find(p => p.id === activeProgram);
  const day = currentDay();
  const dayData = program?.days[day - 1];

  if (!dayData) return;

  sendNotificationViaSW(`🧡 Новый день! День ${day}`, {
    body: `${dayData[0]} · ${dayData[1]}`,
    badge: "./icons/icon-192.svg"
  });

  console.log("📬 Уведомление о новом дне отправлено");
}

/**
 * Инициализировать статус-уведомление о хранилище
 */
async function notifyStorageStatus() {
  if (!window.StorageManager) return;

  const isPersistent = await StorageManager.checkPersistentStorage();

  if (!isPersistent && Notification.permission === "granted") {
    setTimeout(() => {
      sendNotificationViaSW("💾 Совет по сохранению данных", {
        body: "Разреши постоянное хранилище, чтобы данные не потерялись при очистке истории.",
        badge: "./icons/icon-192.svg",
        tag: "storage-tip"
      });
    }, 3000);
  }
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

  // Запрашиваем разрешение на уведомления
  await requestNotificationPermission();

  // Инициализируем систему напоминаний
  initializeReminders();

  // Уведомляем о статусе хранилища
  await notifyStorageStatus();

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
