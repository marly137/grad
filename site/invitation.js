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
const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
const stage = document.getElementById("envelope-stage");
const music = document.getElementById("background-music");
const musicToggle = document.querySelector("[data-music-toggle]");
const cover = document.querySelector(".cover:not(.access-denied)");
const accessDenied = document.querySelector(".access-denied:not(noscript .access-denied)");
const content = document.getElementById("loi-moi");
const openingTitle = document.getElementById("opening-title");
const openLink = document.querySelector("[data-open-envelope]");

let guestName = "";
let envelope;
let envelopePrepared = false;
let openingInvitation;
let navigation = 0;
let resolveGeneration = 0;

function parseGuestToken(fragment) {
  if (!fragment.startsWith("#to=")) return "";
  const token = fragment.slice(4);
  return /^[a-z0-9_-]{6,64}$/.test(token) ? token : "";
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

async function prepareEnvelope() {
  if (envelopePrepared) return;
  envelopePrepared = true;
  try {
    const { mountEnvelope } = await import("./envelope.js");
    envelope = mountEnvelope(stage);
    if (openingInvitation) void envelope?.open(false);
  } catch {
    // The CSS envelope and the HTML links stay available if 3D is unavailable.
  }
}

async function syncGuestAccess() {
  const generation = ++resolveGeneration;
  const token = parseGuestToken(window.location.hash);
  const resolved = await resolveGuestName(token);
  if (generation !== resolveGeneration) return;

  guestName = resolved;
  for (const greeting of greetings) greeting.textContent = guestName;

  if (!guestName) {
    navigation++;
    if (music && !music.paused) music.pause();
    cover.hidden = true;
    content.hidden = true;
    accessDenied.hidden = false;
    return;
  }

  accessDenied.hidden = true;
  if (openingInvitation) {
    cover.hidden = true;
    content.hidden = false;
  } else {
    cover.hidden = false;
    content.hidden = true;
    window.requestAnimationFrame(() => window.requestAnimationFrame(prepareEnvelope));
  }
}

void syncGuestAccess();
window.addEventListener("hashchange", () => { void syncGuestAccess(); });

motion.addEventListener("change", () => {
  if (motion.matches && openingInvitation) void envelope?.open(false);
});

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

if (music && musicToggle) {
  music.addEventListener("play", syncMusicToggle);
  music.addEventListener("pause", syncMusicToggle);
  musicToggle.addEventListener("click", () => {
    if (music.paused) playMusic();
    else music.pause();
  });
  musicToggle.hidden = false;
}

function revealInvitation() {
  if (!guestName) return Promise.resolve();
  if (openingInvitation) return openingInvitation;
  // Start audio within the click gesture, before waiting for the animation.
  playMusic();
  openingInvitation = Promise.resolve(envelope?.open(!motion.matches)).then(() => {
    if (!guestName) return;
    cover.hidden = true;
    content.hidden = false;
    const map = document.querySelector("[data-map-src]");
    if (map) {
      map.src = map.dataset.mapSrc;
      map.hidden = false;
    }
    startCountdown();
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
    if (link === openLink) await revealInvitation();
    if (request !== navigation || !guestName) return;
    target.scrollIntoView({ behavior: link === openLink ? "instant" : "auto" });
    (link === openLink ? openingTitle : target).focus({ preventScroll: true });
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
