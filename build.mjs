import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { copyFile, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const project = new URL("./", import.meta.url);
const source = new URL("site/", project);
const output = new URL("dist/", project);
const assets = new URL("assets/", output);
const musicSource = new URL("nhac-nen.mp3", project);
const musicOutput = new URL("nhac-nen.mp3", assets);
const linksOutput = new URL("outputs/grad-invitation/guest-links-local.txt", project);
const event = JSON.parse(await readFile(new URL("event.json", project), "utf8"));
const isCI = Boolean(process.env.CI || process.env.GITHUB_ACTIONS);
const guestsSource = process.env.GUESTS_JSON?.trim()
  ? process.env.GUESTS_JSON
  : await readFile(new URL("guests.json", project), "utf8").catch((error) => {
      if (error.code === "ENOENT") {
        throw new Error(
          isCI
            ? "Thiếu GitHub Secret GUESTS_JSON trong Settings -> Secrets and variables -> Actions."
            : "Thiếu guests.json trong thư mục dự án.",
        );
      }
      throw error;
    });
const guests = JSON.parse(guestsSource);
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
const weekdayDate = new Intl.DateTimeFormat("vi-VN", { ...vietnamTime, weekday: "long" });
const shortTime = new Intl.DateTimeFormat("vi-VN", { ...vietnamTime, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const dateLabel = ({ date }) => `${shortTime.format(date)} · ${longDate.format(date)}`;

const name = requiredText("graduateName");
const ceremony = dateValue("ceremonyAt");
const guestFrom = clockTime("guestFrom");
const guestUntil = clockTime("guestUntil");
if (guestFrom >= guestUntil) throw new Error("guestUntil cần muộn hơn guestFrom.");
const meetup = event.photoAt ? dateValue("photoAt") : null;
const maps = httpsUrl("mapsUrl");
const mapEmbed = event.mapEmbedUrl ? httpsUrl("mapEmbedUrl") : null;
const invitation = requiredText("invitation").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
const signature = event.invitationSignature ? requiredText("invitationSignature").split(/\r?\n/) : [];
const venue = requiredText("venue");
const address = requiredText("address");
const guestStart = `${ceremony.value.slice(0, 10)}T${guestFrom}:00+07:00`;
const guestEnd = `${ceremony.value.slice(0, 10)}T${guestUntil}:00+07:00`;
const calendar = new URL("https://calendar.google.com/calendar/render");
const calendarTime = (value) => new Date(value).toISOString().replace(/[-:]|\.000/g, "");
calendar.search = new URLSearchParams({
  action: "TEMPLATE",
  text: `Gặp ${name} tại lễ tốt nghiệp`,
  dates: `${calendarTime(guestStart)}/${calendarTime(guestEnd)}`,
  location: `${venue}, ${address}`,
  details: maps.href,
});
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

const [ceremonyDay, ceremonyMonth, ceremonyYear] = shortDate.format(ceremony.date).split("/");
const values = {
  TITLE: event.isDemo ? "Thiệp mời tốt nghiệp · Bản minh họa" : `Thiệp mời tốt nghiệp · ${name}`,
  NAME: name,
  CEREMONY_AT: ceremony.value,
  CEREMONY_DATE: ceremony.value.slice(0, 10),
  EVENT_DAY: longDate.format(ceremony.date),
  EVENT_DATE_SHORT: `${ceremonyDay}.${ceremonyMonth}.${ceremonyYear}`,
  EVENT_WEEKDAY: weekdayDate.format(ceremony.date),
  EVENT_DAY_NUMBER: ceremonyDay,
  EVENT_MONTH_YEAR: `THÁNG ${Number(ceremonyMonth)} · ${ceremonyYear}`,
  GUEST_START: guestStart,
  CEREMONY_TIME: shortTime.format(ceremony.date),
  GUEST_FROM: guestFrom,
  GUEST_UNTIL: guestUntil,
  VENUE: venue,
  ADDRESS: address,
  MAPS: maps.href,
  CALENDAR: calendar.href,
};
function encryptGuests(guestMap) {
  if (!guestMap || typeof guestMap !== "object" || Array.isArray(guestMap) || !Object.keys(guestMap).length) {
    throw new Error("guests.json cần là object map mã link -> tên khách mời.");
  }
  const encrypted = {};
  const list = [];
  for (const [token, rawName] of Object.entries(guestMap)) {
    if (!/^[a-z0-9_-]{6,64}$/.test(token)) {
      throw new Error(`Mã khách "${token}" trong guests.json chỉ được chứa a-z, 0-9, _ hoặc - (6–64 ký tự).`);
    }
    if (typeof rawName !== "string" || !rawName.trim() || [...rawName.trim()].length > 120) {
      throw new Error(`Tên khách cho mã "${token}" trong guests.json không hợp lệ.`);
    }
    const guestName = rawName.trim();
    const id = createHash("sha256").update(`id:${token}`).digest("hex").slice(0, 32);
    const key = createHash("sha256").update(`key:${token}`).digest();
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const ciphertext = Buffer.concat([cipher.update(guestName, "utf8"), cipher.final()]);
    encrypted[id] = Buffer.concat([iv, ciphertext, cipher.getAuthTag()]).toString("base64");
    list.push({ token, name: guestName });
  }
  return { encrypted, list };
}

const { encrypted: encryptedGuests, list: guestList } = encryptGuests(guests);

const sharePreviewSource = new URL("share-preview.png", source);
const sharePreviewPath = "assets/share-preview.png";
const shareRoute = "moi/";
const shareOutput = new URL(shareRoute, output);
const shareSite = site ? new URL(shareRoute, site) : null;
const [stylesBuffer, invitationBuffer, envelopeBuffer, sharePreview] = await Promise.all([
  readFile(new URL("styles.css", source)),
  readFile(new URL("invitation.js", source)),
  readFile(new URL("envelope.js", source)),
  readFile(sharePreviewSource),
]);
const cacheBust = createHash("sha256")
  .update(stylesBuffer)
  .update(invitationBuffer)
  .update(envelopeBuffer)
  .digest("hex")
  .slice(0, 8);
const shareImage = site ? new URL(sharePreviewPath, site) : null;
shareImage?.searchParams.set("v", createHash("sha256").update(sharePreview).digest("hex").slice(0, 8));
const shareImageAlt = escapeHtml(`Phong bì xanh của thiệp mời tốt nghiệp ${name}`);

const markup = {
  CACHE_BUST: cacheBust,
  GUESTS: JSON.stringify(encryptedGuests).replaceAll("<", "\\u003c"),
  INVITATION: invitation.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("\n              "),
  SIGNATURE: signature.length ? `<p class="letter-signature"><em>${signature.map(escapeHtml).join("<br>")}</em></p>` : "",
  MUSIC_CONTROL: musicFile ? '<button class="music-button" type="button" data-music-toggle aria-controls="background-music" aria-label="Phát nhạc" title="Phát nhạc" hidden></button>' : "",
  DEMO: event.isDemo ? '<p class="demo shell">Bản minh họa · Thông tin buổi lễ là dữ liệu mẫu.</p>' : "",
  MAP_EMBED: mapEmbed ? `<iframe class="venue-map" data-map-src="${escapeHtml(mapEmbed.href)}" title="Bản đồ ${escapeHtml(venue)}" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" hidden></iframe>` : "",
  PHOTO_MEETUP: meetup ? `<div class="detail-item">
            <h3>Hẹn chụp ảnh</h3>
            <p><time datetime="${escapeHtml(meetup.value)}">${escapeHtml(dateLabel(meetup))}</time></p>
          </div>` : "",
};

function socialMetadata() {
  if (!shareImage) return "";
  // Let preview crawlers use the requested URL, including its guest code.
  return [
    `<meta property="og:image" content="${escapeHtml(shareImage.href)}">`,
    `<meta property="og:image:secure_url" content="${escapeHtml(shareImage.href)}">`,
    '<meta property="og:image:type" content="image/png">',
    '<meta property="og:image:width" content="1200">',
    '<meta property="og:image:height" content="630">',
    `<meta property="og:image:alt" content="${shareImageAlt}">`,
    '<meta name="twitter:card" content="summary_large_image">',
    `<meta name="twitter:image" content="${escapeHtml(shareImage.href)}">`,
    `<meta name="twitter:image:alt" content="${shareImageAlt}">`,
  ].join("\n  ");
}

const template = await readFile(new URL("index.html", source), "utf8");
function renderPage(assetBase) {
  const pageMarkup = {
    ...markup,
    ASSET_BASE: assetBase,
    MUSIC: musicFile ? `<audio id="background-music" src="${assetBase}assets/nhac-nen.mp3" preload="none" loop></audio>` : "",
    SOCIAL: socialMetadata(),
  };
  return template.replaceAll(/\{\{([A-Z_]+)\}\}/g, (_, key) => {
    if (Object.hasOwn(pageMarkup, key)) return pageMarkup[key];
    if (Object.hasOwn(values, key)) return escapeHtml(values[key]);
    throw new Error(`Thiếu dữ liệu cho ${key}.`);
  });
}

await Promise.all([mkdir(assets, { recursive: true }), mkdir(shareOutput, { recursive: true })]);
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
  if (asset.isFile() && asset.name !== "share-preview.png" && /\.(?:jpe?g|png|webp)$/i.test(asset.name)) {
    await rm(new URL(encodeURIComponent(asset.name), assets), { force: true });
  }
}
const baseUrl = shareSite ? shareSite.href : `http://127.0.0.1:8712/${shareRoute}`;
const guestLinksText = guestList.map(({ name: guest, token }) => {
  const link = new URL(baseUrl);
  link.searchParams.set("to", token);
  link.searchParams.set("v", "3");
  return `${guest}: ${link.href}`;
}).join("\n");
const copyTasks = [
  copyFile(sharePreviewSource, new URL(sharePreviewPath, output)),
  copyFile(new URL("styles.css", source), new URL("styles.css", output)),
  copyFile(new URL("invitation.js", source), new URL("invitation.js", output)),
  musicFile ? copyFile(musicSource, musicOutput) : rm(musicOutput, { force: true }),
];
if (!isCI) {
  await mkdir(new URL("./", linksOutput), { recursive: true });
  copyTasks.push(writeFile(linksOutput, `${guestLinksText}\n`));
}
await Promise.all(copyTasks);
await Promise.all([
  writeFile(new URL("index.html", output), renderPage("./")),
  writeFile(new URL("index.html", shareOutput), renderPage("../")),
]);
console.log(`Đã dựng ${event.isDemo ? "thiệp minh họa" : "thiệp mời"} trong dist/ (${guestList.length} khách mời).`);
if (!isCI) console.log(guestLinksText);
