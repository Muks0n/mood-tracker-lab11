
// Обрано Vue 3, оскільки він підтримує реактивність
// і компоненти та легко підключається через CDN.

// Практична №11.
// Для кроків 2–4 встановити "local".
// Для кроків 5–12 встановити "indexed".
const STORAGE_MODE = "indexed";

const API_URL =
    "https://jsonplaceholder.typicode.com/comments?postId=1";

// Компонент одного запису настрою.
const MoodEntry = {
    props: {
        id: {
            type: Number,
            required: true
        },

        date: {
            type: String,
            required: true
        },

        mood: {
            type: Number,
            required: true
        },

        note: {
            type: String,
            default: ""
        }
    },

    emits: ["edit", "delete"],

    computed: {
        moodEmoji() {
            const emoji = {
                1: "😢",
                2: "😔",
                3: "😐",
                4: "🙂",
                5: "😄"
            };

            return emoji[this.mood] || "❔";
        },

        moodLabel() {
            const labels = {
                1: "Дуже сумний",
                2: "Сумний",
                3: "Нейтральний",
                4: "Задовільний",
                5: "Щасливий"
            };

            return labels[this.mood] || "Невідомий";
        }
    },

    template: `
        <article
            class="mood-card"
            :class="[
                'mood-card-' + mood,
                mood >= 4 ? 'good' : 'hard'
            ]"
            :data-mood="mood"
        >
            <h3>
                Дата: {{ date }}
                <span
                    class="mood-emoji"
                    :aria-label="moodLabel"
                >
                    {{ moodEmoji }}
                </span>
            </h3>

            <p>
                Настрій: {{ moodLabel }}. {{ note }}
            </p>

            <div class="record-actions">
                <button
                    type="button"
                    @click="$emit('edit', id)"
                >
                    Редагувати
                </button>

                <button
                    type="button"
                    @click="$emit('delete', id)"
                >
                    Видалити
                </button>
            </div>
        </article>
    `
};

const app = Vue.createApp({
    components: {
        MoodEntry
    },

    data() {
        return {
            moodRecords: [],

            editingId: null,

            newDate: "",
            newMood: "",
            newNote: "",

            storageReady: false,
            storageError: "",

            apiRecords: [],
            isLoading: false,
            errorMessage: ""
        };
    },

    computed: {
        averageMood() {
            if (this.moodRecords.length === 0) {
                return 0;
            }

            const sum = this.moodRecords.reduce(
                (total, record) => total + record.mood,
                0
            );

            return sum / this.moodRecords.length;
        }
    },

    methods: {
        // Кроки 3 і 9. Додавання або редагування запису.
        async saveMoodRecord() {
            if (!this.storageReady) {
                return;
            }

            const mood = Number(this.newMood);

            if (
                !this.newDate ||
                !Number.isInteger(mood) ||
                mood < 1 ||
                mood > 5
            ) {
                return;
            }

            const record = {
                date: this.newDate,
                mood: mood,
                note: this.newNote.trim()
            };

            this.storageReady = false;
            this.storageError = "";

            try {
                if (STORAGE_MODE === "local") {
                    if (this.editingId === null) {
                        const maxId = Math.max(
                            0,
                            ...this.moodRecords.map(item => item.id)
                        );

                        record.id = maxId + 1;
                        this.moodRecords.push(record);
                    } else {
                        record.id = this.editingId;

                        const index = this.moodRecords.findIndex(
                            item => item.id === this.editingId
                        );

                        if (index !== -1) {
                            this.moodRecords[index] = record;
                        }
                    }

                    // Крок 3: збереження після зміни стану.
                    saveToLocalStorage(this.moodRecords);
                } else {
                    if (this.editingId === null) {
                        await addItem(record);
                    } else {
                        record.id = this.editingId;
                        await updateItem(record);
                    }

                    // Крок 9: перечитування після CRUD.
                    this.moodRecords = await getAllItems();
                }

                this.cancelEditing();
            } catch (error) {
                this.storageError =
                    "Не вдалося зберегти запис.";

                console.error(error);

                if (STORAGE_MODE === "local") {
                    this.moodRecords = loadFromLocalStorage();
                }
            } finally {
                this.storageReady = true;
            }
        },

        // Заповнення форми для редагування.
        startEditing(id) {
            const record = this.moodRecords.find(
                item => item.id === id
            );

            if (!record) {
                return;
            }

            this.editingId = id;
            this.newDate = record.date;
            this.newMood = String(record.mood);
            this.newNote = record.note;

            document.getElementById("mood-tracker")
                .scrollIntoView({ behavior: "smooth" });
        },

        cancelEditing() {
            this.editingId = null;
            this.newDate = "";
            this.newMood = "";
            this.newNote = "";
        },

        // Кроки 3 і 9. Видалення запису.
        async removeMoodRecord(id) {
            if (!this.storageReady) {
                return;
            }

            this.storageReady = false;
            this.storageError = "";

            try {
                if (STORAGE_MODE === "local") {
                    this.moodRecords = this.moodRecords.filter(
                        item => item.id !== id
                    );

                    saveToLocalStorage(this.moodRecords);
                } else {
                    await deleteItem(id);

                    // Оновлення реактивного списку.
                    this.moodRecords = await getAllItems();
                }

                if (this.editingId === id) {
                    this.cancelEditing();
                }
            } catch (error) {
                this.storageError =
                    "Не вдалося видалити запис.";

                console.error(error);

                if (STORAGE_MODE === "local") {
                    this.moodRecords = loadFromLocalStorage();
                }
            } finally {
                this.storageReady = true;
            }
        },

        // Кроки 4, 9, 11. Завантаження записів.
        async loadSavedMoodRecords() {
            this.storageReady = false;
            this.storageError = "";

            try {
                if (STORAGE_MODE === "local") {
                    const saved = localStorage.getItem(
                        LOCAL_STORAGE_KEY
                    );

                    if (saved === null) {
                        saveToLocalStorage(INITIAL_MOOD_RECORDS);
                    }

                    this.moodRecords = loadFromLocalStorage();
                } else {
                    this.moodRecords = await initializeStorage();
                }

                this.storageReady = true;
            } catch (error) {
                this.storageError =
                    "Не вдалося відкрити сховище даних. " +
                    "Перевірте доступність IndexedDB у браузері.";

                console.error(error);
            }
        },

        // Практична №9: отримання даних через Fetch API.
        async loadData() {
            this.isLoading = true;
            this.errorMessage = "";

            try {
                const response = await fetch(API_URL);

                if (!response.ok) {
                    throw new Error(
                        "Сервер відповів кодом " + response.status
                    );
                }

                const data = await response.json();

                if (!Array.isArray(data)) {
                    throw new Error(
                        "Некоректний формат даних API"
                    );
                }

                this.apiRecords = data;
                console.log(data);
            } catch (error) {
                this.errorMessage =
                    "Записи тимчасово недоступні";

                console.error(error);
            } finally {
                this.isLoading = false;
            }
        }
    },

    mounted() {
        this.loadSavedMoodRecords();
        this.loadData();
    }
});

app.mount("#app");
