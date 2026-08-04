import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-app.js";
import {
  browserSessionPersistence,
  getAuth,
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
  setDoc,
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";

/* ==============================================================
   FIREBASE
   Esta configuración conecta la web con el proyecto dbdosparax.
   La API key identifica el proyecto; la seguridad real depende de
   Authentication y firestore.rules.
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

const WEDDING_CONFIG = {
  weddingDate: "2026-11-07T00:00:00-05:00",
  dateLabel: "7 de noviembre de 2026",
  address: "Av. Universitaria 6084, Los Olivos 15304",
};

/* ==============================================================
   CATÁLOGO COMPLETO: 40 REGALOS
   Las imágenes deben existir dentro de assets/regalos/.
   ============================================================== */
const GIFT_CATALOG = [
  gift("set-platos-tendidos", "Set de platos tendidos", "Blanco", "Vajilla"),
  gift("set-tazas", "Set de tazas", "Blanco", "Vajilla"),
  gift("set-vasos", "Set de vasos", "Transparente", "Vajilla"),
  gift("licuadora", "Licuadora", "Plateada", "Electrodomésticos"),
  gift("sandwichera", "Sandwichera", "Plateada o negra", "Electrodomésticos"),
  gift("waflera", "Waflera", "Plateada o negra", "Electrodomésticos"),
  gift("termo", "Termo", "Negro o azul", "Cocina"),
  gift("jarra-vidrio", "Jarra de vidrio", "Transparente", "Vajilla"),
  gift("microondas", "Microondas", "Plateado o negro", "Electrodomésticos"),
  gift("set-ollas", "Set de ollas", "Plateadas o negras", "Cocina"),
  gift("olla-presion", "Olla a presión", "Plateada o negra", "Cocina"),
  gift("set-cuchillos", "Set de cuchillos", "Plateado o negro", "Cocina"),
  gift("set-cubiertos", "Set de tenedores y cucharas", "Plateado o negro", "Vajilla"),
  gift("set-condimentos", "Set para condimentos", "Sin preferencia", "Cocina"),
  gift("maquina-popcorn", "Máquina de pop corn", "Sin preferencia", "Electrodomésticos"),
  gift("set-sartenes", "Set de sartenes", "Plateadas o negras", "Cocina"),
  gift("set-limpieza", "Set de limpieza", "Sin preferencia", "Limpieza"),
  gift("set-tinas-ropa", "Set de tinas para ropa", "Sin preferencia", "Limpieza"),
  gift("olla-arrocera", "Olla arrocera", "Plateada o negra", "Electrodomésticos"),
  gift("ventilador-pie", "Ventilador de pie", "Plateado, negro o blanco", "Electrodomésticos"),
  gift("escurreplatos", "Escurreplatos de aluminio", "Plateado o negro", "Cocina"),
  gift("verdulero", "Verdulero", "Plateado, negro o madera", "Organización"),
  gift("set-platos-hondos", "Set de platos hondos", "Blanco", "Vajilla"),
  gift("prensa-papas", "Prensa papas", "Plateada, negra o blanca", "Cocina"),
  gift("pica-todo", "Pica todo", "Plateado, negro o blanco", "Cocina"),
  gift("set-coladores", "Set de coladores de aluminio", "Plateado o negro", "Cocina"),
  gift("plancha", "Plancha", "Plateada o negra", "Electrodomésticos"),
  gift("tabla-planchar", "Tabla de planchar", "Plateada o negra", "Limpieza"),
  gift("espejo-sala", "Espejo para sala", "Marco color madera", "Decoración"),
  gift("freidora-aire", "Freidora de aire", "Plateada o negra", "Electrodomésticos"),
  gift("utensilios-reposteria", "Utensilios de repostería de aluminio", "Plateado", "Cocina"),
  gift("set-sabanas", "Set de sábanas", "Crema, rosado o blanco", "Dormitorio"),
  gift("set-toallas", "Set de toallas", "Crema, rosado o blanco", "Dormitorio"),
  gift("cafetera-electrica", "Cafetera eléctrica", "Plateada o negra", "Electrodomésticos"),
  gift("tetera", "Tetera", "Plateada o negra", "Cocina"),
  gift("cubre-cama", "Cubre cama", "Vintage, vino, crema o marrón", "Dormitorio"),
  gift("aspiradora", "Aspiradora", "Plateada o negra", "Limpieza"),
  gift("protector-colchon", "Protector de colchón", "Negro o plomo", "Dormitorio"),
  gift("batidora-electrica", "Batidora eléctrica", "Negra o plateada", "Electrodomésticos"),
  gift("set-copas", "Set de copas", "Transparente", "Vajilla"),
];

/*
  Regalos ya separados según la hoja al 4 de agosto de 2026.
  Los nombres NO se publican en la web. También están bloqueados
  en las reglas para que nadie pueda reservarlos desde el cliente.
*/
const PRE_RESERVED_GIFT_IDS = new Set([
  "set-platos-tendidos",
  "set-tazas",
  "set-vasos",
  "microondas",
  "freidora-aire",
]);

function gift(id, name, preferredColor, category) {
  return {
    id,
    name,
    preferredColor,
    category,
    description: `Color de preferencia: ${preferredColor}.`,
    imageUrl: `assets/regalos/${id}.webp`,
  };
}

const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

const state = {
  countdownTimer: null,
  authPromise: null,
  sessionUser: null,
  firebaseReady: false,
  dynamicLocks: new Set(),
  ownReservation: null,
  giftFilter: "Todos",
  selectedGift: null,
  unsubscribeLocks: null,
  unsubscribeOwnReservation: null,
  unsubscribeRsvp: null,
};

function setText(selector, value) {
  const element = $(selector);
  if (element) element.textContent = value;
}

function cleanText(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function makeAppError(code, message = code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function isGiftReserved(giftId) {
  return PRE_RESERVED_GIFT_IDS.has(giftId) || state.dynamicLocks.has(giftId);
}

async function getSessionUser() {
  if (state.sessionUser) return state.sessionUser;

  if (!state.authPromise) {
    state.authPromise = (async () => {
      await setPersistence(auth, browserSessionPersistence);
      if (auth.currentUser) return auth.currentUser;
      const credential = await signInAnonymously(auth);
      return credential.user;
    })();
  }

  state.sessionUser = await state.authPromise;
  return state.sessionUser;
}

/* ==============================================================
   INVITACIÓN GENERAL
   ============================================================== */
function configureWeddingData() {
  setText("#heroDate", WEDDING_CONFIG.dateLabel);
}

function startCountdown() {
  const target = new Date(WEDDING_CONFIG.weddingDate).getTime();
  const message = $("#countdownMessage");

  if (Number.isNaN(target)) {
    if (message) message.textContent = WEDDING_CONFIG.dateLabel;
    return;
  }

  const update = () => {
    const distance = target - Date.now();
    if (distance <= 0) {
      clearInterval(state.countdownTimer);
      ["#days", "#hours", "#minutes", "#seconds"].forEach((id) => setText(id, "00"));
      if (message) message.textContent = "¡Hoy celebramos!";
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
    if (message) message.textContent = WEDDING_CONFIG.dateLabel;
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
  const revealElements = $$(".reveal");
  if (!("IntersectionObserver" in window)) {
    revealElements.forEach((element) => element.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-visible");
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.12 });

  revealElements.forEach((element) => observer.observe(element));
}

function setupAddressCopy() {
  $("#copyAddress")?.addEventListener("click", async () => {
    const status = $("#copyAddressStatus");
    try {
      await navigator.clipboard.writeText(WEDDING_CONFIG.address);
      if (status) status.textContent = "Dirección copiada.";
    } catch {
      if (status) status.textContent = WEDDING_CONFIG.address;
    }
  });
}

/* ==============================================================
   FIRESTORE: LISTA DE REGALOS
   ============================================================== */
async function connectGiftRegistry() {
  const status = $("#giftConnectionStatus");

  try {
    const user = await getSessionUser();
    const ownReservationRef = doc(db, "userReservations", user.uid);

    state.unsubscribeLocks = onSnapshot(
      collection(db, "giftLocks"),
      (snapshot) => {
        state.dynamicLocks = new Set(snapshot.docs.map((item) => item.id));
        state.firebaseReady = true;
        if (status) status.textContent = "Lista actualizada en tiempo real";
        $("#giftGrid")?.setAttribute("aria-busy", "false");
        renderGiftRegistry();
      },
      showGiftConnectionError,
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
      showGiftConnectionError,
    );
  } catch (error) {
    showGiftConnectionError(error);
  }
}

function showGiftConnectionError(error) {
  console.error("Error de Firebase:", error);
  state.firebaseReady = false;
  const status = $("#giftConnectionStatus");
  if (status) status.textContent = getFirebaseConnectionMessage(error);
  $("#giftGrid")?.setAttribute("aria-busy", "false");
  renderGiftRegistry();
}

async function reserveGift(giftId, guestName) {
  if (PRE_RESERVED_GIFT_IDS.has(giftId)) throw makeAppError("gift-already-reserved");
  if (!GIFT_CATALOG.some((giftItem) => giftItem.id === giftId)) throw makeAppError("invalid-gift");

  const user = await getSessionUser();
  const name = cleanText(guestName);
  if (name.length < 3 || name.length > 80) throw makeAppError("invalid-name");

  const lockRef = doc(db, "giftLocks", giftId);
  const userReservationRef = doc(db, "userReservations", user.uid);

  await runTransaction(db, async (transaction) => {
    // Solo se leen documentos cuya lectura permiten las reglas.
    const [userReservation, giftLock] = await Promise.all([
      transaction.get(userReservationRef),
      transaction.get(lockRef),
    ]);

    if (userReservation.exists()) throw makeAppError("session-already-has-gift");
    if (giftLock.exists()) throw makeAppError("gift-already-reserved");

    transaction.set(lockRef, {
      reserved: true,
      ownerUid: user.uid,
      reservedAt: serverTimestamp(),
    });

    // El nombre queda en el documento privado de la sesión.
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
    const giftLock = await transaction.get(lockRef);

    if (!giftLock.exists()) throw makeAppError("reservation-incomplete");
    if (giftLock.data().ownerUid !== user.uid) {
      throw makeAppError("not-reservation-owner");
    }

    transaction.delete(lockRef);
    transaction.delete(userReservationRef);
  });
}

function setupGiftRegistry() {
  const grid = $("#giftGrid");
  const filters = $("#giftFilters");

  // El grid completo puede ser más alto que la ventana. Si conserva la animación
  // .reveal con threshold 0.12, nunca alcanza el porcentaje visible necesario.
  // Lo mostramos desde el inicio para que aparezcan los 40 regalos sin filtrar.
  grid?.classList.add("is-visible");

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

  const categories = ["Todos", ...new Set(GIFT_CATALOG.map((giftItem) => giftItem.category))];
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

  const visibleGifts = GIFT_CATALOG.filter((giftItem) => (
    state.giftFilter === "Todos" || giftItem.category === state.giftFilter
  ));
  const available = visibleGifts.filter((giftItem) => !isGiftReserved(giftItem.id)).length;

  count.textContent = `${available} ${available === 1 ? "disponible" : "disponibles"} de ${visibleGifts.length}`;
  grid.replaceChildren();
  visibleGifts.forEach((giftItem) => grid.append(createGiftCard(giftItem)));
}

function createGiftCard(giftItem) {
  const reserved = isGiftReserved(giftItem.id);
  const isOwn = state.ownReservation?.giftId === giftItem.id;
  const sessionAlreadySelected = Boolean(state.ownReservation);
  const canReserve = state.firebaseReady && !reserved && !sessionAlreadySelected;

  const card = document.createElement("article");
  card.className = "gift-card";
  card.classList.toggle("is-reserved", reserved);
  card.classList.toggle("is-own", isOwn);
  card.dataset.reserveGift = giftItem.id;
  card.tabIndex = canReserve ? 0 : -1;
  card.setAttribute("role", "button");
  card.setAttribute("aria-disabled", String(!canReserve));
  card.addEventListener("keydown", (event) => {
    if ((event.key === "Enter" || event.key === " ") && canReserve) {
      event.preventDefault();
      openGiftReservation(giftItem.id);
    }
  });

  const media = document.createElement("div");
  media.className = "gift-card__media";
  const image = document.createElement("img");
  image.src = giftItem.imageUrl;
  image.alt = giftItem.name;
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
    <p class="gift-card__category">${escapeHtml(giftItem.category)}</p>
    <h3>${escapeHtml(giftItem.name)}</h3>
    <p class="gift-card__description">${escapeHtml(giftItem.description)}</p>
  `;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "button button--small gift-card__button";
  button.dataset.reserveGift = giftItem.id;
  button.disabled = !canReserve;

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

  const giftItem = GIFT_CATALOG.find((item) => item.id === state.ownReservation.giftId);
  setText("#myGiftName", giftItem?.name || "Regalo seleccionado");
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

    const guestName = cleanText($("#giftGuestName")?.value);
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
  const giftItem = GIFT_CATALOG.find((item) => item.id === giftId);
  if (!giftItem || !state.firebaseReady || isGiftReserved(giftId) || state.ownReservation) return;

  state.selectedGift = giftItem;
  setText("#selectedGiftCategory", giftItem.category);
  setText("#giftReservationTitle", giftItem.name);
  setText("#selectedGiftDescription", giftItem.description);
  $("#giftReservationForm").reset();
  $("#selectedGiftId").value = giftItem.id;
  $("#giftReservationContent").hidden = false;
  $("#giftReservationSuccess").hidden = true;
  showGiftReservationStatus("");

  const preview = $("#selectedGiftPreview");
  preview.style.backgroundImage = `linear-gradient(rgba(20,25,20,.08), rgba(20,25,20,.08)), url("${giftItem.imageUrl}")`;

  openModal($("#giftReservationModal"));
  window.setTimeout(() => $("#giftGuestName")?.focus(), 80);
}

function closeGiftReservation() {
  closeModal($("#giftReservationModal"));
  state.selectedGift = null;
}

function openCancelGiftModal() {
  if (!state.ownReservation) return;
  const giftItem = GIFT_CATALOG.find((item) => item.id === state.ownReservation.giftId);
  setText("#cancelGiftName", giftItem?.name || "tu regalo");
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

/* ==============================================================
   FIRESTORE: FORMULARIO RSVP SIN CÓDIGO
   Un documento por sesión anónima: rsvps/{uid}
   ============================================================== */
async function connectRsvp() {
  const connection = $("#rsvpConnectionStatus");

  try {
    const user = await getSessionUser();
    const rsvpRef = doc(db, "rsvps", user.uid);

    state.unsubscribeRsvp = onSnapshot(
      rsvpRef,
      (snapshot) => {
        if (connection) connection.textContent = "Conectado a Firestore";
        if (snapshot.exists()) fillRsvpForm(snapshot.data());
      },
      (error) => {
        console.error("Error RSVP:", error);
        if (connection) connection.textContent = getFirebaseConnectionMessage(error);
      },
    );
  } catch (error) {
    console.error("Error RSVP:", error);
    if (connection) connection.textContent = getFirebaseConnectionMessage(error);
  }
}

function setupRsvpForm() {
  const form = $("#rsvpForm");
  if (!form) return;

  form.addEventListener("change", (event) => {
    if (event.target.name !== "attendance") return;
    const guestCount = $("#guestCount");
    const attends = event.target.value === "yes";
    guestCount.disabled = !attends;
    guestCount.required = attends;
    if (!attends) guestCount.value = "1";
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const fullName = cleanText(data.get("fullName"));
    const phone = cleanText(data.get("phone"));
    const attendance = data.get("attendance");
    const guestCount = attendance === "yes" ? Number(data.get("guestCount")) : 0;

    if (fullName.length < 3) {
      showFormStatus("Escribe tu nombre y apellido.", "error");
      return;
    }
    if (phone.length < 6) {
      showFormStatus("Escribe un celular o WhatsApp válido.", "error");
      return;
    }
    if (!attendance) {
      showFormStatus("Indica si podrás asistir.", "error");
      return;
    }

    const button = $("#submitRsvp");
    button.disabled = true;
    button.textContent = "Guardando…";
    showFormStatus("");

    try {
      const user = await getSessionUser();
      const rsvpRef = doc(db, "rsvps", user.uid);
      const existing = await getDoc(rsvpRef);

      const payload = {
        ownerUid: user.uid,
        fullName,
        phone,
        attendance,
        guestCount,
        dietary: cleanText(data.get("dietary")),
        message: cleanText(data.get("message")),
        updatedAt: serverTimestamp(),
      };

      if (!existing.exists()) payload.createdAt = serverTimestamp();
      await setDoc(rsvpRef, payload, { merge: true });
      showFormStatus("¡Confirmación guardada correctamente!", "success");
    } catch (error) {
      console.error(error);
      showFormStatus(getRsvpErrorMessage(error), "error");
    } finally {
      button.disabled = false;
      button.textContent = "Guardar confirmación";
    }
  });

  connectRsvp();
}

function fillRsvpForm(data) {
  if (data.fullName) $("#rsvpName").value = data.fullName;
  if (data.phone) $("#rsvpPhone").value = data.phone;
  if (data.dietary) $("#dietary").value = data.dietary;
  if (data.message) $("#message").value = data.message;
  if (data.guestCount) $("#guestCount").value = String(data.guestCount);

  const attendance = data.attendance;
  if (attendance === "yes" || attendance === "no") {
    const radio = $(`input[name="attendance"][value="${attendance}"]`);
    if (radio) radio.checked = true;
    const guestCount = $("#guestCount");
    guestCount.disabled = attendance === "no";
    guestCount.required = attendance === "yes";
  }
}

function showFormStatus(message, type = null) {
  const status = $("#formStatus");
  if (!status) return;
  status.textContent = message;
  status.className = "form-status";
  if (type) status.classList.add(`is-${type}`);
}

function getRsvpErrorMessage(error) {
  const code = String(error?.code || error?.message || "");
  if (code.includes("permission-denied")) return "Firestore rechazó el formulario. Publica las reglas nuevas.";
  if (code.includes("auth/configuration-not-found")) return "Inicializa Firebase Authentication y activa el acceso anónimo.";
  if (code.includes("auth/operation-not-allowed")) return "Activa el inicio de sesión anónimo en Firebase Authentication.";
  if (code.includes("auth/unauthorized-domain")) return "Agrega el dominio de GitHub Pages a Authorized domains en Firebase Authentication.";
  if (code.includes("network") || code.includes("unavailable")) return "No hay conexión estable. Inténtalo nuevamente.";
  return "No se pudo guardar la confirmación. Revisa la configuración de Firebase.";
}

function getFirebaseConnectionMessage(error) {
  const code = String(error?.code || error?.message || "");
  if (code.includes("auth/operation-not-allowed")) return "Falta activar Authentication anónimo";
  if (code.includes("auth/unauthorized-domain")) return "Dominio no autorizado en Firebase";
  if (code.includes("permission-denied")) return "Falta publicar firestore.rules";
  return "Firebase no está disponible";
}

/* ==============================================================
   MODALES Y MENSAJES
   ============================================================== */
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
  if (!status) return;
  status.textContent = message;
  status.className = "gift-reservation-status";
  if (type) status.classList.add(`is-${type}`);
}

function showCancelStatus(message, type = null) {
  const status = $("#cancelGiftStatus");
  if (!status) return;
  status.textContent = message;
  status.className = "gift-reservation-status";
  if (type) status.classList.add(`is-${type}`);
}

function getGiftErrorMessage(error) {
  const code = String(error?.code || error?.message || "");
  if (code.includes("gift-already-reserved") || code.includes("already-exists") || code.includes("aborted")) {
    return "Otra persona reservó este regalo antes. Elige otro disponible.";
  }
  if (code.includes("session-already-has-gift")) return "Esta sesión ya tiene un regalo. Bórralo primero para elegir otro.";
  if (code.includes("invalid-name")) return "Escribe tu nombre y apellido.";
  if (code.includes("permission-denied")) return "Firestore rechazó la operación. Publica las reglas nuevas.";
  if (code.includes("auth/configuration-not-found")) return "Inicializa Firebase Authentication y activa el acceso anónimo.";
  if (code.includes("auth/operation-not-allowed")) return "Activa el acceso anónimo en Firebase Authentication.";
  if (code.includes("auth/unauthorized-domain")) return "Autoriza el dominio de GitHub Pages en Firebase Authentication.";
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

function initialize() {
  configureWeddingData();
  startCountdown();
  setupIntro();
  setupMusic();
  setupRevealAnimations();
  setupAddressCopy();
  setupGiftRegistry();
  setupGiftReservationModal();
  setupCancelGiftModal();
  setupModalKeyboard();
  setupRsvpForm();
}

document.addEventListener("DOMContentLoaded", initialize);
window.addEventListener("beforeunload", () => {
  state.unsubscribeLocks?.();
  state.unsubscribeOwnReservation?.();
  state.unsubscribeRsvp?.();
});
