/* =========================
   SECURE DATA STORAGE
   ========================= */

/**
 * StorageManager - надежное хранилище данных для PWA
 * Использует IndexedDB как основное хранилище с fallback на localStorage
 * Запрашивает постоянное хранилище у браузера (Storage Manager API)
 */

const StorageManager = (() => {
    const DB_NAME = "miy-cykl-db";
    const STORE_NAME = "appData";
    const VERSION = 1;

    let db = null;
    let isPersistent = false;

    /**
     * Инициализация IndexedDB
     */
    async function initDB() {
        return new Promise((resolve, reject) => {
            if (db) {
                resolve(db);
                return;
            }

            const request = indexedDB.open(DB_NAME, VERSION);

            request.onerror = () => {
                console.error("IndexedDB initialization failed:", request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                db = request.result;
                console.log("✓ IndexedDB initialized");
                resolve(db);
            };

            request.onupgradeneeded = (event) => {
                const database = event.target.result;
                if (!database.objectStoreNames.contains(STORE_NAME)) {
                    database.createObjectStore(STORE_NAME);
                    console.log("✓ IndexedDB object store created");
                }
            };
        });
    }

    /**
     * Запрос постоянного хранилища у браузера
     * Защищает данные от автоматической очистки при заполнении памяти
     * Но может быть стерто при ручной очистке истории пользователем
     */
    async function requestPersistentStorage() {
        if (!navigator.storage || !navigator.storage.persist) {
            console.warn(
                "⚠ Storage Manager API не поддерживается браузером"
            );
            return false;
        }

        try {
            const granted = await navigator.storage.persist();
            isPersistent = granted;

            if (granted) {
                console.log(
                    "✓ Постоянное хранилище активировано. Данные защищены от автоматической очистки."
                );
            } else {
                console.warn(
                    "⚠ Пользователь или браузер отклонили запрос на постоянное хранилище. " +
                    "Данные могут быть удалены при заполнении памяти браузера."
                );
            }

            return granted;
        } catch (error) {
            console.error("Ошибка при запросе постоянного хранилища:", error);
            return false;
        }
    }

    /**
     * Проверка статуса постоянного хранилища
     */
    async function checkPersistentStorage() {
        if (!navigator.storage || !navigator.storage.persisted) {
            return false;
        }

        try {
            return await navigator.storage.persisted();
        } catch (error) {
            console.error("Ошибка при проверке статуса хранилища:", error);
            return false;
        }
    }

    /**
     * Сохранение данных в IndexedDB
     */
    async function setIndexedDB(key, value) {
        try {
            if (!db) await initDB();

            return new Promise((resolve, reject) => {
                const transaction = db.transaction([STORE_NAME], "readwrite");
                const store = transaction.objectStore(STORE_NAME);
                const request = store.put(value, key);

                request.onerror = () => {
                    console.error(`Ошибка при сохранении в IndexedDB (${key}):`, request.error);
                    reject(request.error);
                };

                request.onsuccess = () => {
                    console.log(`✓ Данные сохранены в IndexedDB (${key})`);
                    resolve();
                };
            });
        } catch (error) {
            console.error("Ошибка IndexedDB:", error);
            throw error;
        }
    }

    /**
     * Загрузка данных из IndexedDB
     */
    async function getIndexedDB(key) {
        try {
            if (!db) await initDB();

            return new Promise((resolve, reject) => {
                const transaction = db.transaction([STORE_NAME], "readonly");
                const store = transaction.objectStore(STORE_NAME);
                const request = store.get(key);

                request.onerror = () => {
                    console.error(`Ошибка при загрузке из IndexedDB (${key}):`, request.error);
                    reject(request.error);
                };

                request.onsuccess = () => {
                    resolve(request.result);
                };
            });
        } catch (error) {
            console.error("Ошибка IndexedDB:", error);
            throw error;
        }
    }

    /**
     * Удаление данных из IndexedDB
     */
    async function deleteIndexedDB(key) {
        try {
            if (!db) await initDB();

            return new Promise((resolve, reject) => {
                const transaction = db.transaction([STORE_NAME], "readwrite");
                const store = transaction.objectStore(STORE_NAME);
                const request = store.delete(key);

                request.onerror = () => reject(request.error);
                request.onsuccess = () => {
                    console.log(`✓ Данные удалены из IndexedDB (${key})`);
                    resolve();
                };
            });
        } catch (error) {
            console.error("Ошибка при удалении из IndexedDB:", error);
            throw error;
        }
    }

    /**
     * Получение данных (IndexedDB → localStorage fallback)
     */
    async function get(key) {
        // Всегда пытаемся получить из localStorage сначала
        const localItem = localStorage.getItem(key);
        if (localItem) {
            try {
                const parsed = JSON.parse(localItem);
                console.log(`📦 Данные загружены из localStorage (${key})`);
                return parsed;
            } catch (e) {
                console.error(`Ошибка парсинга localStorage (${key}):`, e);
            }
        }

        // Если в localStorage нет, пытаемся получить из IndexedDB
        try {
            if (db) {
                const value = await getIndexedDB(key);
                if (value !== undefined) {
                    console.log(`📦 Данные загружены из IndexedDB (${key})`);
                    return value;
                }
            }
        } catch (error) {
            console.warn(`Не удалось загрузить из IndexedDB (${key}):`, error);
        }

        console.log(`⚠️ Данные не найдены: ${key}`);
        return undefined;
    }

    /**
     * Сохранение данных (localStorage + IndexedDB)
     */
    async function set(key, value) {
        // Всегда сохраняем в localStorage (надежный fallback)
        try {
            localStorage.setItem(key, JSON.stringify(value));
            console.log(`💾 Данные сохранены в localStorage (${key})`);
        } catch (error) {
            console.error(`Ошибка сохранения в localStorage (${key}):`, error);
        }

        // Пытаемся сохранить в IndexedDB (если доступна)
        try {
            if (db) {
                await setIndexedDB(key, value);
            }
        } catch (error) {
            console.warn(`Ошибка сохранения в IndexedDB (${key}), но localStorage работает:`, error);
        }
    }

    /**
     * Миграция данных из localStorage в IndexedDB
     */
    async function migrateFromLocalStorage() {
        const keys = ["cycleData", "cycleMarks"];

        for (const key of keys) {
            const item = localStorage.getItem(key);
            if (item && !localStorage.getItem(`_migrated_${key}`)) {
                try {
                    const value = JSON.parse(item);
                    await setIndexedDB(key, value);
                    localStorage.setItem(`_migrated_${key}`, "true");
                    console.log(`✓ Данные мигрированы: ${key}`);
                } catch (error) {
                    console.error(`Ошибка при миграции ${key}:`, error);
                }
            }
        }
    }

    /**
     * Инициализация системы хранения
     */
    async function initialize() {
        console.log("🔐 Инициализация системы хранения данных...");

        // Проверяем localStorage
        try {
            const testKey = "_storage_test_";
            localStorage.setItem(testKey, "test");
            const testValue = localStorage.getItem(testKey);
            localStorage.removeItem(testKey);

            if (testValue === "test") {
                console.log("✅ localStorage работает (основное хранилище)");
            } else {
                console.error("❌ localStorage не работает");
            }
        } catch (error) {
            console.error("❌ localStorage недоступен:", error);
        }

        try {
            // Инициализируем IndexedDB
            await initDB();
            console.log("✅ IndexedDB инициализирована (дополнительное хранилище)");
        } catch (error) {
            console.warn("⚠️ IndexedDB недоступна (будет использован только localStorage):", error);
        }

        // Запрашиваем постоянное хранилище
        try {
            await requestPersistentStorage();
        } catch (error) {
            console.warn("⚠️ Storage Manager API недоступен:", error);
        }

        // Проверяем статус
        const persistent = await checkPersistentStorage();
        console.log(
            `📊 Статус хранилища: ${persistent ? "Постоянное 🔒" : "Временное ⚠️"}`
        );

        // Мигрируем старые данные
        try {
            await migrateFromLocalStorage();
        } catch (error) {
            console.error("Ошибка при миграции данных:", error);
        }

        console.log("✅ Система хранения готова");
        console.log("💡 Совет: Если данные теряются при очистке истории браузера, это ожидаемое поведение. Используйте 'Очистить историю' без опции 'Файлы куки и другие данные сайтов' для сохранения данных приложения.");
        return true;
    }

    /**
     * Получить статус постоянного хранилища
     */
    function getPersistentStatus() {
        return isPersistent;
    }

    // Публичный API
    return {
        initialize,
        get,
        set,
        getPersistentStatus,
        checkPersistentStorage,
        requestPersistentStorage,
        deleteIndexedDB
    };
})();
