"use strict";

function getGuestName(fragment) {
  if (!fragment.startsWith("#to=")) return "";

  const encodedName = fragment.slice(4);
  if (encodedName.includes("&")) return "";

  try {
    const name = decodeURIComponent(encodedName.replaceAll("+", " ")).trim();
    const invalid = /[\p{Cc}\p{Bidi_Control}\uFFFD]/u.test(name);
    return invalid || [...name].length > 120 ? "" : name;
  } catch {
    return "";
  }
}

const greeting = document.getElementById("guest-greeting");
let guestName = "";

function updateGreeting() {
  if (window.location.hash !== "#thong-tin" && window.location.hash !== "#loi-moi") {
    guestName = getGuestName(window.location.hash);
  }
  greeting.textContent = guestName ? `Thân mời ${guestName}` : "Thân mời bạn";
}

updateGreeting();
window.addEventListener("hashchange", updateGreeting);

const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
const stage = document.getElementById("envelope-stage");
let envelope;
let loadingEnvelope = false;
let navigation = 0;

async function prepareEnvelope() {
  if (motion.matches || envelope || loadingEnvelope) return;
  loadingEnvelope = true;
  try {
    const { mountEnvelope } = await import("./envelope.js");
    if (!motion.matches) envelope = mountEnvelope(stage);
  } catch {
    // The CSS envelope and the HTML links stay available if 3D is unavailable.
  } finally {
    loadingEnvelope = false;
  }
}

motion.addEventListener("change", () => {
  if (motion.matches) {
    envelope?.dispose();
    envelope = undefined;
  } else {
    void prepareEnvelope();
  }
});
window.requestAnimationFrame(() => window.requestAnimationFrame(prepareEnvelope));

// Scroll without replacing the personalized URL in the address bar.
for (const link of document.querySelectorAll('a[href="#thong-tin"], a[data-open-envelope]')) {
  link.addEventListener("click", async (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    event.preventDefault();
    const request = ++navigation;
    const target = document.getElementById(link.hash.slice(1));
    if (link.hasAttribute("data-open-envelope") && !motion.matches && envelope) {
      await envelope.open();
    }
    if (request !== navigation) return;
    target.scrollIntoView();
    target.focus({ preventScroll: true });
  });
}

const music = document.getElementById("background-music");
if (music) {
  const toggle = document.querySelector(".music-toggle");
  const label = document.getElementById("music-label");
  const status = document.getElementById("music-status");

  function showPlaybackState() {
    label.textContent = music.paused ? "Bật nhạc" : "Tắt nhạc";
  }

  function showPlaybackError() {
    showPlaybackState();
    status.textContent = "Chưa phát được nhạc.";
  }

  music.addEventListener("play", showPlaybackState);
  music.addEventListener("pause", showPlaybackState);
  music.addEventListener("error", showPlaybackError);
  toggle.addEventListener("click", async () => {
    status.textContent = "";
    if (!music.paused) {
      music.pause();
      return;
    }

    try {
      await music.play();
    } catch (error) {
      if (error.name !== "AbortError") showPlaybackError();
    }
  });
  toggle.hidden = false;
}
