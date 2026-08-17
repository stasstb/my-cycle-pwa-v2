/* =========================
   DIAGNOSTIC SCRIPT
   ========================= */

/**
 * Откройте консоль браузера (F12 → Console) и выполните эту функцию:
 * 
 * diagnosis();
 * 
 * Это покажет статус всех хранилищ и поможет найти проблему
 */

async function diagnosis() {
    console.group("🔍 ДИАГНОСТИКА ХРАНИЛИЩА ДАННЫХ");

    // 1. Проверка localStorage
    console.group("1️⃣ localStorage");
    try {
        localStorage.setItem("_test", "ok");
        const value = localStorage.getItem("_test");
        localStorage.removeItem("_test");
        console.log("✅ localStorage работает");
        console.log(`   Размер используется: ${new Blob(Object.values(localStorage)).size} байт`);

        const cycleData = localStorage.getItem("cycleData");
        const cycleMarks = localStorage.getItem("cycleMarks");
        console.log(`   cycleData: ${cycleData ? "✅ найдено" : "❌ не найдено"}`);
        console.log(`   cycleMarks: ${cycleMarks ? "✅ найдено" : "❌ не найдено"}`);
    } catch (error) {
        console.error("❌ localStorage не работает:", error);
    }
    console.groupEnd();

    // 2. Проверка IndexedDB
    console.group("2️⃣ IndexedDB");
    try {
        const dbs = await indexedDB.databases?.() || [];
        console.log(`✅ IndexedDB доступна`);
        console.log(`   Найдено БД: ${dbs.length}`);

        dbs.forEach(db => {
            console.log(`   - ${db.name} (v${db.version})`);
        });

        // Открываем нашу БД
        const request = indexedDB.open("miy-cykl-db");
        request.onerror = () => {
            console.error("❌ Не удалось открыть miy-cykl-db:", request.error);
        };
        request.onsuccess = () => {
            const db = request.result;
            const storeNames = Array.from(db.objectStoreNames);
            console.log(`   Хранилища в miy-cykl-db: ${storeNames.join(", ")}`);

            // Проверяем данные
            const transaction = db.transaction(["appData"], "readonly");
            const store = transaction.objectStore("appData");

            const cycleDataReq = store.get("cycleData");
            const cycleMarksReq = store.get("cycleMarks");

            cycleDataReq.onsuccess = () => {
                console.log(`   cycleData: ${cycleDataReq.result ? "✅ найдено" : "❌ не найдено"}`);
            };

            cycleMarksReq.onsuccess = () => {
                console.log(`   cycleMarks: ${cycleMarksReq.result ? "✅ найдено" : "❌ не найдено"}`);
            };

            db.close();
        };
    } catch (error) {
        console.error("❌ IndexedDB не работает:", error);
    }
    console.groupEnd();

    // 3. Проверка Storage Manager API
    console.group("3️⃣ Storage Manager API");
    try {
        if (navigator.storage) {
            console.log("✅ Storage API поддерживается");

            if (navigator.storage.estimate) {
                const estimate = await navigator.storage.estimate();
                const usage = (estimate.usage / 1024 / 1024).toFixed(2);
                const quota = (estimate.quota / 1024 / 1024).toFixed(2);
                const percent = ((estimate.usage / estimate.quota) * 100).toFixed(2);

                console.log(`   Использовано: ${usage} МБ из ${quota} МБ (${percent}%)`);
            }

            if (navigator.storage.persisted) {
                const isPersistent = await navigator.storage.persisted();
                console.log(`   Постоянное хранилище: ${isPersistent ? "✅ Да" : "❌ Нет"}`);
            }

            if (navigator.storage.persist) {
                console.log("   ℹ️  Можно запросить постоянное хранилище через navigator.storage.persist()");
            }
        } else {
            console.warn("⚠️  Storage API не поддерживается браузером");
        }
    } catch (error) {
        console.error("❌ Ошибка при проверке Storage API:", error);
    }
    console.groupEnd();

    // 4. Проверка StorageManager
    console.group("4️⃣ StorageManager (наше приложение)");
    try {
        if (window.StorageManager) {
            console.log("✅ StorageManager доступен");

            const cycleData = await StorageManager.get("cycleData");
            const cycleMarks = await StorageManager.get("cycleMarks");

            console.log(`   cycleData:`, cycleData || "❌ не найдено");
            console.log(`   cycleMarks:`, cycleMarks || "❌ не найдено");

            const isPersistent = StorageManager.getPersistentStatus();
            console.log(`   Статус постоянного хранилища: ${isPersistent ? "✅ Активно" : "❌ Неактивно"}`);
        } else {
            console.error("❌ StorageManager не доступен (storage.js не загрулся?)");
        }
    } catch (error) {
        console.error("❌ Ошибка при проверке StorageManager:", error);
    }
    console.groupEnd();

    // 5. Проверка приложения
    console.group("5️⃣ Состояние приложения");
    try {
        console.log(`   cycle:`, window.cycle || "❌ не инициализирована");
        console.log(`   marks:`, window.marks || "❌ не инициализирована");
        console.log(`   activeProgram:`, window.activeProgram || "❌ не установлена");
    } catch (error) {
        console.error("❌ Ошибка при проверке приложения:", error);
    }
    console.groupEnd();

    // 6. Рекомендации
    console.group("📋 РЕКОМЕНДАЦИИ");
    console.log(`
❌ ЕСЛИ ДАННЫЕ ТЕРЯЮТСЯ:

1. Это ожидаемое поведение браузера при очистке истории
   - При выборе "Очистить историю" браузер удаляет ВСЕ хранилища:
     • localStorage
     • IndexedDB
     • sessionStorage
     • Cookies
     • кэш

2. Решение: При очистке истории НЕ выбирайте:
   - "Файлы куки и другие данные сайтов"
   - или используйте "Очистить недавнюю историю" вместо полной

3. Для максимальной защиты:
   - Разрешите постоянное хранилище (браузер запросит разрешение)
   - Добавьте приложение на главный экран (iOS/Android)
   - Используйте опцию "не очищать данные сайтов"

⚠️  ЕСЛИ ДАННЫЕ НЕ СОХРАНЯЮТСЯ ВООБЩЕ:

1. Проверьте консоль браузера (выше) на ошибки
2. Убедитесь, что localStorage/IndexedDB работают
3. Проверьте, не включен ли приватный режим браузера
4. Перезагрузите страницу и проверьте логи инициализации
  `);
    console.groupEnd();

    console.groupEnd(); // Конец диагностики
}

// Запуск диагностики
console.log("✅ Загрузите эту страницу и выполните в консоли (F12):");
console.log("   diagnosis()");
