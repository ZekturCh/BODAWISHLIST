import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-app.js";
import {
  browserSessionPersistence,
  getAuth,
  onAuthStateChanged,
  setPersistence,
  signInAnonymously,
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-auth.js";
import {
  collection,
  doc,
  getDoc,
  getFirestore,
  onSnapshot,
  runTransaction,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";

/* ==============================================================
   FIREBASE
   La apiKey identifica el proyecto web; la seguridad real está en
   Authentication + firestore.rules.
   ============================================================== */
const firebaseConfig = {
  apiKey: "AIzaSyBiqqTAaogq4Pk1MaOUvr9YgXq2brqkzqU",
  authDomain: "dbdosparax.firebaseapp.com",
  databaseURL: "https://dbdosparax-default-rtdb.firebaseio.com",
  projectId: "dbdosparax",
  storageBucket: "dbdosparax.firebasestorage.app",
  messagingSenderId: "786506932905",
  appId: "1:786506932905:web:7035619466fd130252ffb8",
  measurementId: "G-CZEML31FL8",
};

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

/* ==============================================================
   DATOS DE LA BODA
   ============================================================== */
const WEDDING_CONFIG = {
  weddingDate: null,
  dateLabel: "Fecha por confirmar",
  ceremony: {
    name: "Lugar por confirmar",
    time: "Hora por confirmar",
    address: "Dirección por confirmar",
    mapUrl: "",
  },
  reception: {
    name: "Lugar por confirmar",
    time: "Hora por confirmar",
    address: "Dirección por confirmar",
    mapUrl: "",
  },
};

/* ==============================================================
   CATÁLOGO DE REGALOS
   Las imágenes serán archivos locales de GitHub. Cuando aún no
   existan, la tarjeta muestra un placeholder elegante.
   ============================================================== */
const GIFT_CATALOG = [
  {
    id: "cafetera",
    name: "Cafetera",
    description: "Para comenzar nuestras mañanas juntos con un buen café.",
    category: "Cocina",
    imageUrl: "assets/regalos/cafetera.webp",
  },
  {
    id: "freidora-aire",
    name: "Freidora de aire",
    description: "Una ayuda práctica para preparar nuestras comidas favoritas.",
    category: "Cocina",
    imageUrl: "assets/regalos/freidora-aire.webp",
  },
  {
    id: "juego-copas",
    name: "Juego de copas",
    description: "Para brindar por todos los momentos que están por venir.",
    category: "Hogar",
    imageUrl: "assets/regalos/juego-copas.webp",
  },
  {
    id: "ropa-cama",
    name: "Juego de ropa de cama",
    description: "Para llenar nuestro nuevo hogar de comodidad.",
    category: "Hogar",
    imageUrl: "assets/regalos/ropa-cama.webp",
  },
  {
    id: "aspiradora",
    name: "Aspiradora",
    description: "Para mantener nuestro espacio limpio y acogedor.",
    category: "Hogar",
    imageUrl: "assets/regalos/aspiradora.webp",
  },
  {
    id: "maletas",
    name: "Set de maletas",
    description: "Para acompañarnos en nuestras próximas aventuras.",
    category: "Viajes",
    imageUrl: "assets/regalos/maletas.webp",
  },
  {
    id: "cena-romantica",
    name: "Cena para dos",
    description: "Un detalle para crear un recuerdo especial como esposos.",
    category: "Experiencias",
    imageUrl: "assets/regalos/cena-romantica.webp",
  },
  {
    id: "luna-miel",
    name: "Experiencia de luna de miel",
    description: "Una colaboración para nuestra primera aventura de casados.",
    category: "Experiencias",
    imageUrl: "assets/regalos/luna-miel.webp",
  },
];

const DEMO_GUESTS = {
  "YAYA-001": { name: "Familia Invitada", seats: 2, status: "pending" },
  "YAYA-002": { name: "Invitado de prueba", seats: 1, status: "pending" },
};

const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

const state = {
  currentGuest: null,
  countdownTimer: null,
  sessionUser: null,
  firebaseReady: false,
  locks: new Set(),
  ownReservation: null,
  giftFilter: "Todos",
  selectedGift: null,
  unsubscribeLocks: null,
  unsubscribeOwnReservation: null,
};

function setText(selector, value) {
  const element = $(selector);
  if (element) element.textContent = value;
}

function cleanName(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function makeAppError(code, message = code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

/* ==============================================================
   INVITACIÓN GENERAL
   ============================================================== */
function configureWeddingData() {
  setText("#heroDate", WEDDING_CONFIG.dateLabel);
  setText("#ceremonyName", WEDDING_CONFIG.ceremony.name);
  setText("#ceremonyTime", WEDDING_CONFIG.ceremony.time);
  setText("#ceremonyAddress", WEDDING_CONFIG.ceremony.address);
  configureMapLink("#ceremonyMap", WEDDING_CONFIG.ceremony.mapUrl);
  setText("#receptionName", WEDDING_CONFIG.reception.name);
  setText("#receptionTime", WEDDING_CONFIG.reception.time);
  setText("#receptionAddress", WEDDING_CONFIG.reception.address);
  configureMapLink("#receptionMap", WEDDING_CONFIG.reception.mapUrl);
}

function configureMapLink(selector, url) {
  const link = $(selector);
  if (!link) return;
  link.href = url || "#";
  link.classList.toggle("is-disabled", !url);
}

function startCountdown() {
  const message = $("#countdownMessage");
  if (!WEDDING_CONFIG.weddingDate) {
    message.textContent = "La fecha se actualizará desde app.js.";
    return;
  }

  const target = new Date(WEDDING_CONFIG.weddingDate).getTime();
  if (Number.isNaN(target)) {
    message.textContent = "La fecha configurada no tiene un formato válido.";
    return;
  }

  const update = () => {
    const distance = target - Date.now();
    if (distance <= 0) {
      clearInterval(state.countdownTimer);
      ["#days", "#hours", "#minutes", "#seconds"].forEach((id) => setText(id, "00"));
      message.textContent = "¡Hoy celebramos!";
      return;
    }

    const days = Math.floor(distance / 86_400_000);
    const hours = Math.floor((distance % 86_400_000) / 3_600_000);
    const minutes = Math.floor((distance % 3_600_000) / 60_000);
    const seconds = Math.floor((distance % 60_000) / 1_000);
    setText("#days", String(days).padStart(2, "0"));
    setText("#hours", String(hours).padStart(2, "0"));
    setText("#minutes", String(minutes).padStart(2, "0"));
    setText("#seconds", String(seconds).padStart(2, "0"));
    message.textContent = WEDDING_CONFIG.dateLabel;
  };

  update();
  state.countdownTimer = window.setInterval(update, 1000);
}

function setupIntro() {
  $("#openInvitation")?.addEventListener("click", async () => {
    $("#intro")?.classList.add("is-hidden");
    document.body.classList.remove("is-locked");
    await toggleMusic(true);
  });
}

async function toggleMusic(forcePlay = null) {
  const audio = $("#backgroundMusic");
  const button = $("#musicButton");
  if (!audio || !button) return;

  const shouldPlay = forcePlay ?? audio.paused;
  try {
    if (shouldPlay) {
      await audio.play();
      button.classList.add("is-playing");
    } else {
      audio.pause();
      button.classList.remove("is-playing");
    }
  } catch {
    button.classList.remove("is-playing");
  }
}

function setupMusic() {
  $("#musicButton")?.addEventListener("click", () => toggleMusic());
}

function setupRevealAnimations() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  $$(".reveal").forEach((item) => observer.observe(item));
}

/* ==============================================================
   SESIÓN ANÓNIMA
   browserSessionPersistence conserva el mismo usuario al recargar,
   pero lo elimina al cerrar la pestaña/ventana.
   ============================================================== */
let sessionUserPromise = null;

async function getSessionUser() {
  if (state.sessionUser) return state.sessionUser;
  if (sessionUserPromise) return sessionUserPromise;

  sessionUserPromise = (async () => {
    await setPersistence(auth, browserSessionPersistence);

    const existingUser = await new Promise((resolve, reject) => {
      let unsubscribe = () => {};
      unsubscribe = onAuthStateChanged(
        auth,
        (user) => {
          unsubscribe();
          resolve(user);
        },
        (error) => {
          unsubscribe();
          reject(error);
        }
      );
    });

    state.sessionUser = existingUser || (await signInAnonymously(auth)).user;
    return state.sessionUser;
  })();

  return sessionUserPromise;
}

/* ==============================================================
   FIRESTORE · LISTA DE REGALOS

   giftLocks/{giftId}           -> estado público reservado
   giftOwners/{giftId}          -> nombre + UID, privado
   userReservations/{uid}       -> una selección por sesión
   ============================================================== */
async function connectGiftRegistry() {
  const status = $("#giftConnectionStatus");

  try {
    const user = await getSessionUser();
    const ownReservationRef = doc(db, "userReservations", user.uid);

    state.unsubscribeLocks = onSnapshot(
      collection(db, "giftLocks"),
      (snapshot) => {
        state.locks = new Set(snapshot.docs.map((item) => item.id));
        state.firebaseReady = true;
        status.textContent = "Lista actualizada en tiempo real";
        $("#giftGrid")?.setAttribute("aria-busy", "false");
        renderGiftRegistry();
      },
      (error) => showGiftConnectionError(error)
    );

    state.unsubscribeOwnReservation = onSnapshot(
      ownReservationRef,
      (snapshot) => {
        state.ownReservation = snapshot.exists()
          ? { id: snapshot.id, ...snapshot.data() }
          : null;
        renderGiftRegistry();
        renderOwnReservation();
      },
      (error) => showGiftConnectionError(error)
    );
  } catch (error) {
    showGiftConnectionError(error);
  }
}

function showGiftConnectionError(error) {
  console.error("Error de Firebase:", error);
  state.firebaseReady = false;
  const status = $("#giftConnectionStatus");
  if (status) status.textContent = "Firebase no está disponible";
  $("#giftGrid")?.setAttribute("aria-busy", "false");
  renderGiftRegistry();
}

async function reserveGift(giftId, guestName) {
  const user = await getSessionUser();
  const name = cleanName(guestName);
  if (name.length < 3 || name.length > 80) throw makeAppError("invalid-name");

  const lockRef = doc(db, "giftLocks", giftId);
  const ownerRef = doc(db, "giftOwners", giftId);
  const userReservationRef = doc(db, "userReservations", user.uid);

  await runTransaction(db, async (transaction) => {
    const [userReservation, giftLock, giftOwner] = await Promise.all([
      transaction.get(userReservationRef),
      transaction.get(lockRef),
      transaction.get(ownerRef),
    ]);

    if (userReservation.exists()) throw makeAppError("session-already-has-gift");
    if (giftLock.exists() || giftOwner.exists()) throw makeAppError("gift-already-reserved");

    transaction.set(lockRef, {
      reserved: true,
      reservedAt: serverTimestamp(),
    });

    transaction.set(ownerRef, {
      ownerUid: user.uid,
      guestName: name,
      createdAt: serverTimestamp(),
    });

    transaction.set(userReservationRef, {
      giftId,
      guestName: name,
      createdAt: serverTimestamp(),
    });
  });
}

async function cancelOwnGift() {
  const user = await getSessionUser();
  const userReservationRef = doc(db, "userReservations", user.uid);

  await runTransaction(db, async (transaction) => {
    const userReservation = await transaction.get(userReservationRef);
    if (!userReservation.exists()) throw makeAppError("reservation-not-found");

    const giftId = userReservation.data().giftId;
    const lockRef = doc(db, "giftLocks", giftId);
    const ownerRef = doc(db, "giftOwners", giftId);

    const [giftLock, giftOwner] = await Promise.all([
      transaction.get(lockRef),
      transaction.get(ownerRef),
    ]);

    if (!giftOwner.exists() || giftOwner.data().ownerUid !== user.uid) {
      throw makeAppError("not-reservation-owner");
    }

    if (!giftLock.exists()) throw makeAppError("reservation-incomplete");

    transaction.delete(lockRef);
    transaction.delete(ownerRef);
    transaction.delete(userReservationRef);
  });
}

/* ==============================================================
   INTERFAZ DE REGALOS
   ============================================================== */
function setupGiftRegistry() {
  const grid = $("#giftGrid");
  const filters = $("#giftFilters");

  filters?.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-gift-filter]");
    if (!button) return;
    state.giftFilter = button.dataset.giftFilter;
    renderGiftFilters();
    renderGiftRegistry();
  });

  grid?.addEventListener("click", (event) => {
    const target = event.target.closest("[data-reserve-gift]");
    if (!target) return;
    openGiftReservation(target.dataset.reserveGift);
  });

  $("#openCancelGift")?.addEventListener("click", openCancelGiftModal);
  renderGiftFilters();
  renderGiftRegistry();
  connectGiftRegistry();
}

function renderGiftFilters() {
  const container = $("#giftFilters");
  if (!container) return;

  const categories = ["Todos", ...new Set(GIFT_CATALOG.map((gift) => gift.category))];
  container.replaceChildren();

  categories.forEach((category) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "gift-filter";
    button.dataset.giftFilter = category;
    button.textContent = category;
    button.classList.toggle("is-active", state.giftFilter === category);
    button.setAttribute("aria-pressed", String(state.giftFilter === category));
    container.append(button);
  });
}

function renderGiftRegistry() {
  const grid = $("#giftGrid");
  const count = $("#giftCount");
  if (!grid || !count) return;

  const visibleGifts = GIFT_CATALOG.filter((gift) => (
    state.giftFilter === "Todos" || gift.category === state.giftFilter
  ));
  const available = visibleGifts.filter((gift) => !state.locks.has(gift.id)).length;

  count.textContent = `${available} ${available === 1 ? "disponible" : "disponibles"} de ${visibleGifts.length}`;
  grid.replaceChildren();
  visibleGifts.forEach((gift) => grid.append(createGiftCard(gift)));
}

function createGiftCard(gift) {
  const reserved = state.locks.has(gift.id);
  const isOwn = state.ownReservation?.giftId === gift.id;
  const sessionAlreadySelected = Boolean(state.ownReservation);

  const card = document.createElement("article");
  card.className = "gift-card";
  card.classList.toggle("is-reserved", reserved);
  card.classList.toggle("is-own", isOwn);
  card.dataset.reserveGift = gift.id;
  card.tabIndex = !reserved && !sessionAlreadySelected && state.firebaseReady ? 0 : -1;
  card.setAttribute("role", "button");
  card.setAttribute("aria-disabled", String(reserved || sessionAlreadySelected || !state.firebaseReady));
  card.addEventListener("keydown", (event) => {
    if ((event.key === "Enter" || event.key === " ") && card.tabIndex === 0) {
      event.preventDefault();
      openGiftReservation(gift.id);
    }
  });

  const media = document.createElement("div");
  media.className = "gift-card__media";
  const image = document.createElement("img");
  image.src = gift.imageUrl;
  image.alt = gift.name;
  image.loading = "lazy";
  image.addEventListener("error", () => {
    image.remove();
    media.prepend(createGiftPlaceholder());
  }, { once: true });
  media.append(image);

  const badge = document.createElement("span");
  badge.className = "gift-card__badge";
  badge.textContent = isOwn ? "Tu selección" : reserved ? "Reservado" : "Disponible";
  media.append(badge);

  const body = document.createElement("div");
  body.className = "gift-card__body";
  body.innerHTML = `
    <p class="gift-card__category">${escapeHtml(gift.category)}</p>
    <h3>${escapeHtml(gift.name)}</h3>
    <p class="gift-card__description">${escapeHtml(gift.description)}</p>
  `;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "button button--small gift-card__button";
  button.dataset.reserveGift = gift.id;
  button.disabled = reserved || sessionAlreadySelected || !state.firebaseReady;

  if (!state.firebaseReady) button.textContent = "Conectando…";
  else if (isOwn) button.textContent = "Tu regalo reservado";
  else if (reserved) button.textContent = "Ya fue reservado";
  else if (sessionAlreadySelected) button.textContent = "Ya elegiste un regalo";
  else button.textContent = "Elegir este regalo";

  body.append(button);
  card.append(media, body);
  return card;
}

function createGiftPlaceholder() {
  const placeholder = document.createElement("div");
  placeholder.className = "gift-card__placeholder";
  placeholder.setAttribute("aria-hidden", "true");
  placeholder.innerHTML = '<svg viewBox="0 0 64 64"><path d="M9 27h46v28H9zM6 18h52v10H6zM32 18v37M18 18c-8 0-9-12-1-12 7 0 15 12 15 12M46 18c8 0 9-12 1-12-7 0-15 12-15 12"/></svg>';
  return placeholder;
}

function renderOwnReservation() {
  const panel = $("#myGiftReservation");
  if (!panel) return;

  if (!state.ownReservation) {
    panel.hidden = true;
    return;
  }

  const gift = GIFT_CATALOG.find((item) => item.id === state.ownReservation.giftId);
  setText("#myGiftName", gift?.name || "Regalo seleccionado");
  setText("#myGiftGuestName", state.ownReservation.guestName || "Invitado");
  panel.hidden = false;
}

function setupGiftReservationModal() {
  const modal = $("#giftReservationModal");
  const form = $("#giftReservationForm");
  if (!modal || !form) return;

  $$('[data-close-gift-modal]', modal).forEach((element) => {
    element.addEventListener("click", closeGiftReservation);
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!state.selectedGift) return;

    const guestName = cleanName($("#giftGuestName")?.value);
    const button = $("#reserveGiftButton");
    button.disabled = true;
    button.textContent = "Reservando…";
    showGiftReservationStatus("");

    try {
      await reserveGift(state.selectedGift.id, guestName);
      $("#giftReservationContent").hidden = true;
      $("#giftReservationSuccess").hidden = false;
    } catch (error) {
      console.error(error);
      showGiftReservationStatus(getGiftErrorMessage(error), "error");
    } finally {
      button.disabled = false;
      button.textContent = "Reservar regalo";
    }
  });
}

function openGiftReservation(giftId) {
  const gift = GIFT_CATALOG.find((item) => item.id === giftId);
  if (!gift || !state.firebaseReady || state.locks.has(giftId) || state.ownReservation) return;

  state.selectedGift = gift;
  setText("#selectedGiftCategory", gift.category);
  setText("#giftReservationTitle", gift.name);
  setText("#selectedGiftDescription", gift.description);
  $("#selectedGiftId").value = gift.id;
  $("#giftReservationForm").reset();
  $("#selectedGiftId").value = gift.id;
  $("#giftReservationContent").hidden = false;
  $("#giftReservationSuccess").hidden = true;
  showGiftReservationStatus("");

  const preview = $("#selectedGiftPreview");
  preview.style.backgroundImage = `linear-gradient(rgba(20, 25, 20, .08), rgba(20, 25, 20, .08)), url("${gift.imageUrl}")`;

  openModal($("#giftReservationModal"));
  window.setTimeout(() => $("#giftGuestName")?.focus(), 80);
}

function closeGiftReservation() {
  closeModal($("#giftReservationModal"));
  state.selectedGift = null;
}

function openCancelGiftModal() {
  if (!state.ownReservation) return;
  const gift = GIFT_CATALOG.find((item) => item.id === state.ownReservation.giftId);
  setText("#cancelGiftName", gift?.name || "tu regalo");
  showCancelStatus("");
  openModal($("#cancelGiftModal"));
}

function setupCancelGiftModal() {
  const modal = $("#cancelGiftModal");
  if (!modal) return;

  $$('[data-close-cancel-modal]', modal).forEach((element) => {
    element.addEventListener("click", () => closeModal(modal));
  });

  $("#confirmCancelGift")?.addEventListener("click", async () => {
    const button = $("#confirmCancelGift");
    button.disabled = true;
    button.textContent = "Liberando…";
    showCancelStatus("");

    try {
      await cancelOwnGift();
      closeModal(modal);
      $("#regalos")?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      console.error(error);
      showCancelStatus(getGiftErrorMessage(error), "error");
    } finally {
      button.disabled = false;
      button.textContent = "Sí, liberar";
    }
  });
}

function openModal(modal) {
  if (!modal) return;
  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
}

function closeModal(modal) {
  if (!modal) return;
  modal.classList.remove("is-open");
  modal.setAttribute("aria-hidden", "true");
  if (!$(".modal.is-open")) document.body.classList.remove("modal-open");
}

function setupModalKeyboard() {
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    const open = $(".modal.is-open");
    if (!open) return;
    closeModal(open);
    if (open.id === "giftReservationModal") state.selectedGift = null;
  });
}

function showGiftReservationStatus(message, type = null) {
  const status = $("#giftReservationStatus");
  status.textContent = message;
  status.className = "gift-reservation-status";
  if (type) status.classList.add(`is-${type}`);
}

function showCancelStatus(message, type = null) {
  const status = $("#cancelGiftStatus");
  status.textContent = message;
  status.className = "gift-reservation-status";
  if (type) status.classList.add(`is-${type}`);
}

function getGiftErrorMessage(error) {
  const code = String(error?.code || error?.message || "");
  if (code.includes("gift-already-reserved") || code.includes("already-exists") || code.includes("aborted")) {
    return "Otra persona reservó este regalo antes. Elige otro disponible.";
  }
  if (code.includes("session-already-has-gift")) {
    return "Esta sesión ya tiene un regalo. Bórralo desde el bloque inferior antes de elegir otro.";
  }
  if (code.includes("invalid-name")) return "Escribe tu nombre y apellido.";
  if (code.includes("permission-denied")) return "Firestore rechazó la operación. Publica el archivo firestore.rules incluido.";
  if (code.includes("auth/operation-not-allowed")) return "Activa el acceso anónimo en Firebase Authentication.";
  if (code.includes("network") || code.includes("unavailable")) return "No hay conexión estable. Inténtalo nuevamente.";
  if (code.includes("reservation-not-found")) return "Esta reserva ya no existe.";
  return "No se pudo completar la operación. Inténtalo nuevamente.";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* ==============================================================
   RSVP TEMPORAL
   ============================================================== */
function normalizeGuestCode(code) {
  return String(code || "").trim().toUpperCase().replace(/\s+/g, "");
}

async function getGuestByCode(code) {
  await new Promise((resolve) => window.setTimeout(resolve, 250));
  return DEMO_GUESTS[code] ?? null;
}

async function saveRsvp(payload) {
  localStorage.setItem(`wedding-rsvp-${payload.guestCode}`, JSON.stringify(payload));
  await new Promise((resolve) => window.setTimeout(resolve, 250));
}

function setupGuestLookup() {
  const form = $("#lookupForm");
  const result = $("#guestResult");
  if (!form || !result) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const code = normalizeGuestCode($("#guestCode").value);
    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;
    submit.textContent = "Buscando…";
    showFormStatus("");

    try {
      const guest = await getGuestByCode(code);
      if (!guest) {
        state.currentGuest = null;
        result.hidden = true;
        showFormStatus("No encontramos ese código.", "error");
        return;
      }
      state.currentGuest = { code, ...guest };
      renderGuest(state.currentGuest);
      result.hidden = false;
    } finally {
      submit.disabled = false;
      submit.textContent = "Buscar";
    }
  });
}

function renderGuest(guest) {
  setText("#guestName", guest.name);
  setText("#guestSeats", guest.seats);
  $("#rsvpGuestCode").value = guest.code;
  const select = $("#confirmedSeats");
  select.replaceChildren();
  for (let seats = 1; seats <= guest.seats; seats += 1) {
    const option = document.createElement("option");
    option.value = String(seats);
    option.textContent = `${seats} ${seats === 1 ? "persona" : "personas"}`;
    select.append(option);
  }
}

function setupRsvpForm() {
  const form = $("#rsvpForm");
  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!state.currentGuest) return;
    const data = new FormData(form);
    const payload = {
      guestCode: state.currentGuest.code,
      guestName: state.currentGuest.name,
      attendance: data.get("attendance"),
      confirmedSeats: data.get("attendance") === "yes" ? Number(data.get("confirmedSeats")) : 0,
      dietary: cleanName(data.get("dietary")),
      song: cleanName(data.get("song")),
      message: cleanName(data.get("message")),
      updatedAt: new Date().toISOString(),
    };

    const button = $("#submitRsvp");
    button.disabled = true;
    button.textContent = "Guardando…";
    try {
      await saveRsvp(payload);
      showFormStatus("¡Respuesta registrada! Gracias por confirmar.", "success");
      form.reset();
    } catch {
      showFormStatus("No se pudo guardar la respuesta.", "error");
    } finally {
      button.disabled = false;
      button.textContent = "Confirmar respuesta";
    }
  });
}

function showFormStatus(message, type = null) {
  const status = $("#formStatus");
  if (!status) return;
  status.textContent = message;
  status.className = "form-status";
  if (type) status.classList.add(`is-${type}`);
}

function loadGuestCodeFromUrl() {
  const code = new URLSearchParams(window.location.search).get("code");
  if (code && $("#guestCode")) $("#guestCode").value = normalizeGuestCode(code);
}

function initialize() {
  configureWeddingData();
  startCountdown();
  setupIntro();
  setupMusic();
  setupRevealAnimations();
  setupGiftRegistry();
  setupGiftReservationModal();
  setupCancelGiftModal();
  setupModalKeyboard();
  setupGuestLookup();
  setupRsvpForm();
  loadGuestCodeFromUrl();
}

document.addEventListener("DOMContentLoaded", initialize);
window.addEventListener("beforeunload", () => {
  state.unsubscribeLocks?.();
  state.unsubscribeOwnReservation?.();
});
