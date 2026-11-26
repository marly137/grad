import { copyFile, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const project = new URL("./", import.meta.url);
const source = new URL("site/", project);
const output = new URL("dist/", project);
const assets = new URL("assets/", output);
const musicSource = new URL("nhac-nen.mp3", project);
const musicOutput = new URL("nhac-nen.mp3", assets);
const event = JSON.parse(await readFile(new URL("event.json", project), "utf8"));
const publishing = process.argv.includes("--publish");

function requiredText(key) {
  const value = event[key];
  if (typeof value !== "string" || !value.trim()) throw new Error(`Hãy điền ${key} trong event.json.`);
  return value.trim();
}

function dateValue(key) {
  const value = requiredText(key);
  const format = /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d\+07:00$/;
  const date = new Date(value);
  if (!format.test(value) || Number.isNaN(date.getTime()) || shortDate.format(date).split("/").reverse().join("-") !== value.slice(0, 10)) {
    throw new Error(`${key} cần có dạng YYYY-MM-DDTHH:mm:ss+07:00 và là ngày giờ hợp lệ.`);
  }
  return { date, value };
}

function httpsUrl(key) {
  const url = new URL(requiredText(key));
  if (url.protocol !== "https:" || url.username || url.password) throw new Error(`${key} cần là URL HTTPS.`);
  return url;
}

function clockTime(key) {
  const value = requiredText(key);
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) throw new Error(`${key} cần có dạng HH:mm.`);
  return value;
}

function escapeHtml(value) {
  const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return String(value).replace(/[&<>"']/g, (character) => entities[character]);
}

const vietnamTime = { timeZone: "Asia/Ho_Chi_Minh" };
const shortDate = new Intl.DateTimeFormat("en-GB", { ...vietnamTime, day: "2-digit", month: "2-digit", year: "numeric" });
const longDate = new Intl.DateTimeFormat("vi-VN", { ...vietnamTime, dateStyle: "full" });
const shortTime = new Intl.DateTimeFormat("vi-VN", { ...vietnamTime, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const dateLabel = ({ date }) => `${shortTime.format(date)} · ${longDate.format(date)}`;

const name = requiredText("graduateName");
const ceremony = dateValue("ceremonyAt");
const guestFrom = clockTime("guestFrom");
const guestUntil = clockTime("guestUntil");
if (guestFrom >= guestUntil) throw new Error("guestUntil cần muộn hơn guestFrom.");
const meetup = event.photoAt ? dateValue("photoAt") : null;
const maps = httpsUrl("mapsUrl");
const invitation = requiredText("invitation").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
const signature = event.invitationSignature ? requiredText("invitationSignature").split(/\r?\n/) : [];
const venue = requiredText("venue");
const address = requiredText("address");
if (typeof event.isDemo !== "boolean") throw new Error("isDemo cần là true hoặc false.");
const site = event.siteUrl ? httpsUrl("siteUrl") : null;
if (site && (site.search || site.hash)) throw new Error("siteUrl cần là địa chỉ gốc của thiệp, không có query hoặc fragment.");
if (site && !site.pathname.endsWith("/")) site.pathname += "/";
if (publishing && (event.isDemo || !site)) throw new Error("Hãy cập nhật thông tin thật, đặt isDemo thành false và điền siteUrl trước khi gửi thiệp.");

const musicFile = await stat(musicSource).catch((error) => {
  if (error.code === "ENOENT") return null;
  throw error;
});
if (musicFile && (!musicFile.isFile() || musicFile.size === 0 || musicFile.size > 25 * 1024 * 1024)) {
  throw new Error("nhac-nen.mp3 cần là file MP3 có dung lượng lớn hơn 0 và tối đa 25 MiB.");
}

const values = {
  TITLE: event.isDemo ? "Thiệp mời tốt nghiệp · Bản minh họa" : `Thiệp mời tốt nghiệp · ${name}`,
  DESCRIPTION: invitation[0],
  NAME: name,
  CEREMONY_AT: ceremony.value,
  CEREMONY_DATE: ceremony.value.slice(0, 10),
  EVENT_DAY: longDate.format(ceremony.date),
  COVER_DATE: shortDate.format(ceremony.date).replaceAll("/", "."),
  CEREMONY_TIME: shortTime.format(ceremony.date),
  GUEST_FROM: guestFrom,
  GUEST_UNTIL: guestUntil,
  VENUE: venue,
  ADDRESS: address,
  MAPS: maps.href,
};
const markup = {
  INVITATION: invitation.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("\n        "),
  SIGNATURE: signature.length ? `<p class="letter-signature"><em>${signature.map(escapeHtml).join("<br>")}</em></p>` : "",
  MUSIC: musicFile ? `<div class="music-control">
      <button class="music-toggle" type="button" hidden><span aria-hidden="true">♫</span> <span id="music-label">Bật nhạc</span></button>
      <audio id="background-music" src="./assets/nhac-nen.mp3" preload="none" loop></audio>
      <p class="music-status" id="music-status" role="status"></p>
    </div>` : "",
  SOCIAL: site ? [
    `<link rel="canonical" href="${escapeHtml(site.href)}">`,
    `<meta property="og:url" content="${escapeHtml(site.href)}">`,
  ].join("\n  ") : "",
  DEMO: event.isDemo ? '<p class="demo shell">Bản minh họa · Thông tin buổi lễ là dữ liệu mẫu.</p>' : "",
  PHOTO_MEETUP: meetup ? `<div class="detail-item">
            <h3>Hẹn chụp ảnh</h3>
            <p><time datetime="${escapeHtml(meetup.value)}">${escapeHtml(dateLabel(meetup))}</time></p>
          </div>` : "",
};

const template = await readFile(new URL("index.html", source), "utf8");
const html = template.replaceAll(/\{\{([A-Z_]+)\}\}/g, (_, key) => {
  if (Object.hasOwn(markup, key)) return markup[key];
  if (Object.hasOwn(values, key)) return escapeHtml(values[key]);
  throw new Error(`Thiếu dữ liệu cho ${key}.`);
});

await mkdir(assets, { recursive: true });
await build({
  entryPoints: [fileURLToPath(new URL("envelope.js", source))],
  outfile: fileURLToPath(new URL("envelope.js", output)),
  bundle: true,
  format: "esm",
  target: "es2022",
  minify: true,
  legalComments: "eof",
});

// Remove cover images from previous builds so the static upload contains no portraits.
const oldAssets = await readdir(assets, { withFileTypes: true });
for (const asset of oldAssets) {
  if (asset.isFile() && /\.(?:jpe?g|png|webp)$/i.test(asset.name)) {
    await rm(new URL(encodeURIComponent(asset.name), assets), { force: true });
  }
}
await Promise.all([
  copyFile(new URL("styles.css", source), new URL("styles.css", output)),
  copyFile(new URL("invitation.js", source), new URL("invitation.js", output)),
  musicFile ? copyFile(musicSource, musicOutput) : rm(musicOutput, { force: true }),
]);
await writeFile(new URL("index.html", output), html);
console.log(`Đã dựng ${event.isDemo ? "thiệp minh họa" : "thiệp mời"} trong dist/.`);
