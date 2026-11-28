"use strict";

const guestEntries = (() => {
  try {
    return JSON.parse(document.getElementById("guest-data")?.textContent || "{}");
  } catch {
    return {};
  }
})();

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const greetings = document.querySelectorAll("[data-guest-name]");
const stage = document.getElementById("envelope-stage");
const music = document.getElementById("background-music");
const musicToggle = document.querySelector("[data-music-toggle]");
const cover = document.querySelector(".cover:not(.access-denied)");
const accessDenied = document.querySelector(".access-denied:not(noscript .access-denied)");
const content = document.getElementById("loi-moi");
const openingTitle = document.getElementById("opening-title");
const openLink = document.querySelector("[data-open-envelope]");

let guestName = "";
let activeToken = "";
let openedToken = "";
let envelope;
let envelopePreparation;
let openingInvitation;
let invitationInitialized = false;
let navigation = 0;
let resolveGeneration = 0;
let resumeMusicOnShow = false;

function rememberOpenedInvitation(scrollY) {
  if (!openedToken || openedToken !== activeToken) return;
  try {
    history.replaceState({ ...history.state, graduationInvitation: { token: openedToken, scrollY } }, "");
  } catch {
    // The invitation stays usable if the browser restricts history changes.
  }
}

function decodeBase64(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function resolveGuestName(token) {
  if (!token || !window.crypto?.subtle) return "";
  try {
    const idDigest = await window.crypto.subtle.digest("SHA-256", encoder.encode(`id:${token}`));
    const idHex = Array.from(new Uint8Array(idDigest).slice(0, 16), (b) => b.toString(16).padStart(2, "0")).join("");
    const payload = guestEntries[idHex];
    if (typeof payload !== "string") return "";

    const raw = decodeBase64(payload);
    if (raw.length <= 12) return "";

    const keyDigest = await window.crypto.subtle.digest("SHA-256", encoder.encode(`key:${token}`));
    const key = await window.crypto.subtle.importKey("raw", keyDigest, "AES-GCM", false, ["decrypt"]);
    const decrypted = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: raw.slice(0, 12) },
      key,
      raw.slice(12),
    );
    return decoder.decode(decrypted).trim();
  } catch {
    return "";
  }
}

function prepareEnvelope() {
  if (envelopePreparation) return envelopePreparation;
  const token = activeToken;
  envelopePreparation = import("./envelope.js").then(({ mountEnvelope }) => {
    if (activeToken === token && !cover.hidden && !envelope && !stage.hasAttribute("data-opening-fallback")) {
      envelope = mountEnvelope(stage);
    }
  }).catch(() => {
    // The CSS envelope and the HTML links stay available if 3D is unavailable.
  });
  return envelopePreparation;
}

async function syncGuestAccess() {
  const generation = ++resolveGeneration;
  const token = readInvitationToken();
  const resolved = await resolveGuestName(token);
  if (generation !== resolveGeneration) return;

  if (token !== activeToken) {
    navigation++;
    activeToken = token;
    openingInvitation = undefined;
    envelope?.dispose();
    envelope = undefined;
    envelopePreparation = undefined;
    stage.removeAttribute("data-opening");
    stage.removeAttribute("data-opening-fallback");
    resumeMusicOnShow = false;
    if (music && !music.paused) music.pause();
  }
  guestName = resolved;
  for (const greeting of greetings) greeting.textContent = guestName;

  if (!guestName) {
    navigation++;
    resumeMusicOnShow = false;
    if (music && !music.paused) music.pause();
    cover.hidden = true;
    content.hidden = true;
    accessDenied.hidden = false;
    document.documentElement.removeAttribute("data-cover-pending");
    return;
  }

  accessDenied.hidden = true;
  const saved = history.state?.graduationInvitation;
  if (openedToken === token || saved?.token === token) {
    const restoring = openedToken !== token;
    openedToken = token;
    showInvitation();
    if (restoring && Number.isFinite(saved.scrollY)) {
      window.requestAnimationFrame(() => window.scrollTo({ top: saved.scrollY, behavior: "instant" }));
    }
  } else {
    cover.hidden = false;
    content.hidden = true;
    void prepareEnvelope();
  }
  document.documentElement.removeAttribute("data-cover-pending");
}

void syncGuestAccess();
window.addEventListener("hashchange", () => { void syncGuestAccess(); });
window.addEventListener("pagehide", () => rememberOpenedInvitation(window.scrollY));

function startCountdown() {
  const countdown = document.querySelector("[data-countdown]");
  const deadline = Date.parse(countdown.dataset.countdown);
  const grid = countdown.querySelector(".countdown-grid");
  const values = grid.querySelectorAll("dd");
  const intervals = [86400, 3600, 60, 1];
  if (!Number.isFinite(deadline) || deadline <= Date.now()) return;

  function update() {
    let seconds = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
    if (!seconds) {
      window.clearInterval(timer);
      grid.hidden = true;
      return;
    }
    for (const [index, interval] of intervals.entries()) {
      values[index].textContent = String(Math.floor(seconds / interval)).padStart(2, "0");
      seconds %= interval;
    }
    grid.hidden = false;
  }

  const timer = window.setInterval(update, 250);
  update();
}

function syncMusicToggle() {
  const playing = !music.paused;
  const label = playing ? "Tạm dừng nhạc" : "Phát nhạc";
  musicToggle.toggleAttribute("data-playing", playing);
  musicToggle.setAttribute("aria-label", label);
  musicToggle.title = label;
}

function playMusic() {
  if (music?.paused) void music.play().catch(syncMusicToggle);
}

function pauseMusicForBackground() {
  if (!music || music.paused) return;
  resumeMusicOnShow = true;
  music.pause();
}

if (music && musicToggle) {
  music.addEventListener("play", syncMusicToggle);
  music.addEventListener("pause", syncMusicToggle);
  musicToggle.addEventListener("click", () => {
    resumeMusicOnShow = false;
    if (music.paused) playMusic();
    else music.pause();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      pauseMusicForBackground();
    } else if (resumeMusicOnShow) {
      resumeMusicOnShow = false;
      if (guestName) playMusic();
    }
  });
  window.addEventListener("pagehide", pauseMusicForBackground);
  window.addEventListener("pageshow", (event) => {
    if (event.persisted && resumeMusicOnShow && !document.hidden) {
      resumeMusicOnShow = false;
      if (guestName) playMusic();
    }
  });
  musicToggle.hidden = false;
}

function showInvitation() {
  cover.hidden = true;
  content.hidden = false;
  if (invitationInitialized) return;
  invitationInitialized = true;
  const map = document.querySelector("[data-map-src]");
  if (map) {
    map.src = map.dataset.mapSrc;
    map.hidden = false;
  }
  startCountdown();
}

async function openEnvelope(token) {
  if (!envelope) {
    await Promise.race([
      prepareEnvelope(),
      new Promise((resolve) => window.setTimeout(resolve, 1200)),
    ]);
  }
  if (token !== activeToken) return;
  if (envelope && stage.hasAttribute("data-rendered")) {
    stage.setAttribute("data-opening", "");
    await envelope.open();
    if (token !== activeToken || stage.hasAttribute("data-rendered")) return;
    stage.removeAttribute("data-opening");
  }

  stage.setAttribute("data-opening-fallback", "");
  const animations = stage.getAnimations({ subtree: true });
  await Promise.allSettled(animations.map((animation) => animation.finished));
}

function revealInvitation() {
  if (!guestName || openedToken === activeToken) return Promise.resolve();
  if (openingInvitation) return openingInvitation;
  const token = activeToken;
  // Start audio within the click gesture, before waiting for the animation.
  playMusic();
  openingInvitation = openEnvelope(token).then(() => {
    if (!guestName || activeToken !== token) return;
    openedToken = token;
    rememberOpenedInvitation(0);
    showInvitation();
  });
  return openingInvitation;
}

// Scroll without replacing the personalized URL in the address bar.
for (const link of [openLink, ...document.querySelectorAll("[data-invitation-link]")]) {
  link.addEventListener("click", async (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    event.preventDefault();
    if (!guestName) return;
    const request = ++navigation;
    const target = document.getElementById(link.hash.slice(1));
    const opensEnvelope = link === openLink;
    if (opensEnvelope) await revealInvitation();
    if (request !== navigation || !guestName) return;
    target.scrollIntoView({ behavior: opensEnvelope ? "instant" : "auto" });
    (opensEnvelope ? openingTitle : target).focus({ preventScroll: true });
  });
}

const copyButton = document.querySelector("[data-copy-address]");
if (navigator.clipboard?.writeText) {
  copyButton.hidden = false;
  copyButton.addEventListener("click", async () => {
    const status = document.querySelector(".copy-status");
    try {
      await navigator.clipboard.writeText(document.getElementById("venue-address").textContent.trim());
      status.textContent = "Đã sao chép địa chỉ.";
    } catch {
      status.textContent = "Bạn có thể bôi đen địa chỉ để sao chép.";
    }
  });
}
