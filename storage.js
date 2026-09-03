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

    function isBlank(value) {
        if (value === undefined || value === null) return true;
        if (Array.isArray(value)) return value.length === 0;
        if (typeof value === "object") return Object.keys(value).length === 0;
        return false;
    }

    function mergeMarks(a, b) {
        if (isBlank(a)) return b;
        if (isBlank(b)) return a;

        const out = { ...a };

        Object.entries(b).forEach(([key, value]) => {
            if (out[key] === undefined) {
                out[key] = value;
                return;
            }

            if (value === true) {
                out[key] = true;
                return;
            }

            if (typeof value === "string") {
                if (String(value).length > String(out[key] || "").length) {
                    out[key] = value;
                }
                return;
            }

            if (Array.isArray(value)) {
                const other = Array.isArray(out[key]) ? out[key] : [];
                const length = Math.max(other.length, value.length);
                const merged = [];
                for (let i = 0; i < length; i += 1) {
                    merged[i] = Boolean(other[i] || value[i]);
                }
                out[key] = merged;
            }
        });

        return out;
    }

    function pickCycle(a, b) {
        if (isBlank(a)) return b;
        if (isBlank(b)) return a;
        return (b.updatedAt || 0) > (a.updatedAt || 0) ? b : a;
    }

    function pickHistory(a, b) {
        const left = Array.isArray(a) ? a : [];
        const right = Array.isArray(b) ? b : [];
        if (right.length > left.length) return right;
        if (left.length) return left;
        if (right.length) return right;
        return undefined;
    }

    /**
     * Получение данных: localStorage + IndexedDB, берём более полное значение
     */
    async function get(key) {
        let localVal;
        const localItem = localStorage.getItem(key);
        if (localItem) {
            try {
                localVal = JSON.parse(localItem);
            } catch (error) {
                console.error(`Ошибка парсинга localStorage (${key}):`, error);
            }
        }

        let idbVal;
        try {
            if (!db) await initDB();
            idbVal = await getIndexedDB(key);
        } catch (error) {
            console.warn(`Не удалось загрузить из IndexedDB (${key}):`, error);
        }

        let value;
        if (key === "cycleMarks") {
            value = mergeMarks(localVal, idbVal);
        } else if (key === "cycleHistory") {
            value = pickHistory(localVal, idbVal);
        } else if (key === "cycleData") {
            value = pickCycle(localVal, idbVal);
        } else if (!isBlank(localVal) && !isBlank(idbVal) && typeof localVal === "object") {
            value = { ...idbVal, ...localVal };
        } else {
            value = isBlank(localVal) ? idbVal : localVal;
        }

        if (value === undefined) {
            console.log(`⚠️ Данные не найдены: ${key}`);
            return undefined;
        }

        console.log(`📦 Данные загружены (${key})`);
        return value;
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
        const keys = ["cycleData", "cycleMarks", "cycleHistory", "cyclePrefs"];

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
