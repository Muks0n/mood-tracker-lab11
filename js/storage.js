
// Практична №11. Варіант №3.
// Локальні сховища даних: localStorage та IndexedDB.

const DB_NAME = "MoodTrackerDB";
const DB_VERSION = 1;
const STORE_NAME = "moodEntries";

const LOCAL_STORAGE_KEY = "moodEntries";
const MIGRATION_KEY = "moodEntriesMigrated";

// Крок 1. Модель даних.
const INITIAL_MOOD_RECORDS = [
    { id: 1, date: "2026-10-05", mood: 5, note: "Хороший день" },
    { id: 2, date: "2026-10-06", mood: 3, note: "Звичайний день" },
    { id: 3, date: "2026-10-07", mood: 5, note: "Чудовий настрій" },
    { id: 4, date: "2026-10-08", mood: 4, note: "Все пройшло непогано" },
    { id: 5, date: "2026-10-09", mood: 2, note: "Був складний день" },
    { id: 6, date: "2026-10-10", mood: 5, note: "Приємний день" },
    { id: 7, date: "2026-10-11", mood: 1, note: "Жахливий день" }
];

// Крок 2. Збереження масиву в localStorage.
function saveToLocalStorage(items) {
    localStorage.setItem(
        LOCAL_STORAGE_KEY,
        JSON.stringify(items)
    );
}

// Крок 2. Читання даних з обробкою помилок JSON.parse.
function loadFromLocalStorage() {
    try {
        const raw = localStorage.getItem(LOCAL_STORAGE_KEY);

        if (raw === null) {
            return [];
        }

        const items = JSON.parse(raw);

        if (!Array.isArray(items)) {
            throw new Error("Дані не є масивом");
        }

        return items;
    } catch (error) {
        console.error("Помилка читання localStorage:", error);
        return [];
    }
}

// Кроки 5–6. Відкриття IndexedDB.
// onupgradeneeded створює сховище при першому запуску.
function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;

            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, {
                    keyPath: "id",
                    autoIncrement: true
                });
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// Крок 7. CREATE — додавання запису в IndexedDB.
async function addItem(item) {
    const db = await openDB();

    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);

        const record = {
            date: item.date,
            mood: item.mood,
            note: item.note
        };

        // Під час міграції зберігаємо наявний id.
        if (item.id !== undefined && item.id !== null) {
            record.id = item.id;
        }

        const request = store.add(record);

        let newId;

        request.onsuccess = () => {
            newId = request.result;
        };

        tx.oncomplete = () => {
            db.close();
            resolve(newId);
        };

        tx.onerror = () => {
            db.close();
            reject(tx.error);
        };

        tx.onabort = () => {
            db.close();
            reject(tx.error);
        };
    });
}

// Крок 7. READ — отримання всіх записів.
async function getAllItems() {
    const db = await openDB();

    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const request = tx.objectStore(STORE_NAME).getAll();

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);

        tx.oncomplete = () => db.close();
    });
}

// Крок 7. UPDATE — оновлення запису через put.
async function updateItem(item) {
    const db = await openDB();

    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");

        tx.objectStore(STORE_NAME).put(item);

        tx.oncomplete = () => {
            db.close();
            resolve();
        };

        tx.onerror = () => {
            db.close();
            reject(tx.error);
        };

        tx.onabort = () => {
            db.close();
            reject(tx.error);
        };
    });
}

// Крок 7. DELETE — видалення запису за id.
async function deleteItem(id) {
    const db = await openDB();

    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");

        tx.objectStore(STORE_NAME).delete(id);

        tx.oncomplete = () => {
            db.close();
            resolve();
        };

        tx.onerror = () => {
            db.close();
            reject(tx.error);
        };

        tx.onabort = () => {
            db.close();
            reject(tx.error);
        };
    });
}

// Крок 8. Одноразова міграція localStorage -> IndexedDB.
async function migrateFromLocalStorage() {
    if (localStorage.getItem(MIGRATION_KEY) === "true") {
        return;
    }

    const existingItems = await getAllItems();

    // Міграція виконується лише для порожнього сховища.
    if (existingItems.length !== 0) {
        return;
    }

    const localItems = loadFromLocalStorage();

    if (localItems.length === 0) {
        return;
    }

    // Переносимо всі записи в одній транзакції.
    const db = await openDB();

    await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);

        for (const item of localItems) {
            store.add(item);
        }

        tx.oncomplete = () => {
            db.close();
            resolve();
        };

        tx.onerror = () => {
            db.close();
            reject(tx.error);
        };

        tx.onabort = () => {
            db.close();
            reject(tx.error);
        };
    });

    localStorage.setItem(MIGRATION_KEY, "true");
}

// Крок 9. Ініціалізація сховища та отримання записів.
async function initializeStorage() {
    const existingItems = await getAllItems();

    // Початкові записи створюємо лише на чистому запуску.
    if (
        existingItems.length === 0 &&
        localStorage.getItem(LOCAL_STORAGE_KEY) === null &&
        localStorage.getItem(MIGRATION_KEY) !== "true"
    ) {
        saveToLocalStorage(INITIAL_MOOD_RECORDS);
    }

    await migrateFromLocalStorage();

    return getAllItems();
}
