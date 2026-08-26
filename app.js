const STORAGE_KEY = "baby-care-tracker-records-v1";
const DELETED_KEY = "baby-care-tracker-deleted-v1";
const PROFILE_KEY = "baby-care-tracker-profile-v1";
const SYNC_CONFIG_KEY = "baby-care-tracker-github-sync-v1";
const CLOUD_OWNER = "poplarorz-ui";
const CLOUD_REPO = "baby-care-data";
const CLOUD_FILE_PATH = "宝宝照护记录.json";
const typeMeta = {
  feeding: { title: "记录吃奶", icon: "🍼", label: "吃奶", color: "var(--peach-soft)" },
  poop: { title: "记录大便", icon: "💩", label: "大便", color: "var(--yellow-soft)" },
  pee: { title: "记录小便", icon: "💧", label: "小便", color: "var(--blue-soft)" },
  light: { title: "记录蓝光", icon: "☀️", label: "照蓝光", color: "var(--violet-soft)" },
  bath: { title: "记录洗澡", icon: "🛁", label: "洗澡", color: "#e9f7fb" },
  growth: { title: "记录身高体重", icon: "📏", label: "身高体重", color: "#eaf7f0" },
  jaundice: { title: "记录黄疸数值", icon: "🟡", label: "黄疸", color: "#fff7d9" },
  vaccine: { title: "记录疫苗", icon: "💉", label: "疫苗", color: "#edf3ff" },
};
const amountNames = { small: "小量", medium: "中量", large: "大量" };
const amountShort = { small: "小", medium: "中", large: "大" };
const FEEDING_INTERVAL_MS = 3 * 60 * 60 * 1000;

let records = loadRecords();
let deletedRecords = loadDeletedRecords();
let babyProfile = loadProfile();
let syncConfig = loadSyncConfig();
let selectedDate = dateKey(new Date());
let activeFilter = "all";
let timerId;
let countdownTimerId;
let autoBackupTimerId;
let cloudSyncTimerId;
let cloudSyncInFlight = false;
let cloudSyncQueued = false;
let cloudSyncState = syncConfig ? "waiting" : "off";
let cloudSyncDetail = "";
let lastCloudSyncAt = null;
let editingActiveLightId = null;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function loadRecords() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function loadDeletedRecords() {
  try {
    const value = JSON.parse(localStorage.getItem(DELETED_KEY));
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

function normalizeProfile(value) {
  if (!value || typeof value !== "object") return null;
  const name = String(value.name || "").trim().slice(0, 30);
  const birthAt = Number(value.birthAt);
  if (!name || !Number.isFinite(birthAt) || birthAt <= 0) return null;
  return { name, birthAt, updatedAt: Number(value.updatedAt) || 0 };
}

function loadProfile() {
  try {
    return normalizeProfile(JSON.parse(localStorage.getItem(PROFILE_KEY)));
  } catch {
    return null;
  }
}

function loadSyncConfig() {
  try {
    const value = JSON.parse(localStorage.getItem(SYNC_CONFIG_KEY));
    return value?.token
      ? { owner: CLOUD_OWNER, repo: CLOUD_REPO, token: value.token }
      : null;
  } catch {
    return null;
  }
}

function saveRecords() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  localStorage.setItem(DELETED_KEY, JSON.stringify(deletedRecords));
  if (babyProfile) localStorage.setItem(PROFILE_KEY, JSON.stringify(babyProfile));
  scheduleAutoBackup();
  scheduleCloudSync();
}

function recordTimestamp(record) {
  return record.type === "light" ? Number(record.start) : Number(record.time);
}

function pad(value) { return String(value).padStart(2, "0"); }
function dateKey(date) { return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`; }
function parseLocal(value) {
  if (!value) return NaN;
  const match = String(value).trim().match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})[ T](\d{1,2}):(\d{1,2})$/);
  if (!match) return NaN;
  const [, year, month, day, hour, minute] = match.map(Number);
  const date = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day || date.getHours() !== hour || date.getMinutes() !== minute) return NaN;
  return date.getTime();
}

function parseDateTime(dateValue, timeValue) {
  return parseLocal(`${dateValue || ""} ${timeValue || ""}`);
}

function setDateTimeFields(prefix, date = new Date(), includeTime = true) {
  $(`#${prefix}DateInput`).value = dateKey(date);
  $(`#${prefix}TimeInput`).value = includeTime ? `${pad(date.getHours())}:${pad(date.getMinutes())}` : "";
}
function formatTime(timestamp) { const d = new Date(timestamp); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; }
function formatMonthDay(timestamp) { const d = new Date(timestamp); return `${d.getMonth() + 1}月${d.getDate()}日`; }
function weekday(date) { return ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][date.getDay()]; }

function formatDuration(ms, compact = false) {
  const totalMinutes = Math.max(0, Math.round(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (!hours) return compact ? `${minutes}分钟` : `${minutes} 分钟`;
  if (!minutes) return `${hours}小时`;
  return `${hours}小时${minutes}分钟`;
}

function formatClockDuration(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
}

function formatInterval(ms) {
  const minutes = Math.round(ms / 60000);
  if (minutes < 1) return "不到1分钟";
  if (minutes < 60) return `${minutes}分钟`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}小时${rest}分` : `${hours}小时`;
}

function getSelectedRange() {
  const start = new Date(`${selectedDate}T00:00:00`).getTime();
  return { start, end: start + 86400000 };
}

function recordTouchesDay(record, start, end) {
  if (record.type !== "light") return record.time >= start && record.time < end;
  const lightEnd = record.end || Date.now();
  return record.start < end && lightEnd > start;
}

function dailyLightMs(record, dayStart, dayEnd) {
  const end = record.end || Date.now();
  return Math.max(0, Math.min(end, dayEnd) - Math.max(record.start, dayStart));
}

function render() {
  renderDate();
  renderBabyProfile();
  renderFeedingCountdown();
  renderSummary();
  renderDayTimeline();
  renderTimeline();
  renderActiveLight();
  renderHistoryStatus();
}

function renderHistoryStatus() {
  const cloudLabel = syncConfig
    ? cloudSyncState === "synced" ? "云端已同步" : cloudSyncState === "syncing" ? "云端同步中" : cloudSyncState === "error" ? "云同步需检查" : "等待云同步"
    : "浏览器已保存";
  $("#historyStatus").textContent = records.length ? `${cloudLabel} · ${records.length}条` : (syncConfig ? cloudLabel : "浏览器存储已就绪");
  $("#dataRecordCount").textContent = records.length ? `已保存 ${records.length} 条历史记录` : "已启用浏览器自动保存";
  const timestamps = records.map(recordTimestamp).filter(Number.isFinite).sort((a, b) => a - b);
  $("#dataDateRange").textContent = timestamps.length
    ? `${formatMonthDay(timestamps[0])} 至 ${formatMonthDay(timestamps[timestamps.length - 1])} · ${syncConfig ? "本机保留并同步到私有仓库" : "自动保存在本机"}`
    : "新增记录会自动保存在当前浏览器";
}

function renderDate() {
  const selected = new Date(`${selectedDate}T12:00:00`);
  const today = dateKey(new Date());
  const diff = Math.round((new Date(`${selectedDate}T00:00:00`) - new Date(`${today}T00:00:00`)) / 86400000);
  $("#datePrimary").textContent = diff === 0 ? "今天" : diff === -1 ? "昨天" : diff === 1 ? "明天" : `${selected.getMonth() + 1}月${selected.getDate()}日`;
  $("#dateSecondary").textContent = `${selected.getFullYear()}年 · ${weekday(selected)}`;
  $("#summaryDate").textContent = `${selected.getMonth() + 1}月${selected.getDate()}日`;
  $("#timelineChartDate").textContent = `${selected.getMonth() + 1}月${selected.getDate()}日 · ${weekday(selected)}`;
  $("#datePicker").value = selectedDate;
  $("#todayButton").hidden = diff === 0;
  $("#todayLabel").textContent = diff === 0 ? `今天 · ${selected.getMonth() + 1}月${selected.getDate()}日 ${weekday(selected)}` : `回看 · ${selected.getFullYear()}年${selected.getMonth() + 1}月${selected.getDate()}日`;
}

function formatBabyAge(now = Date.now()) {
  if (!babyProfile?.birthAt) return "未设置出生时间";
  const elapsed = Math.max(0, now - babyProfile.birthAt);
  const totalHours = Math.floor(elapsed / 3600000);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  if (days < 60) return `${days}天${hours ? `${hours}小时` : ""}`;
  if (days < 365) return `${Math.floor(days / 30)}个月${days % 30 ? `${days % 30}天` : ""}`;
  return `${Math.floor(days / 365)}岁${Math.floor((days % 365) / 30) ? `${Math.floor((days % 365) / 30)}个月` : ""}`;
}

function latestRecordWithValue(type, field) {
  return records
    .filter((record) => record.type === type && record[field] !== null && record[field] !== undefined && record[field] !== "")
    .sort((a, b) => Number(b.time) - Number(a.time))[0];
}

function vaccineDateLabel(dateValue) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue || "")) return "待安排";
  const date = new Date(`${dateValue}T00:00:00`);
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function vaccineCountdownLabel(dateValue) {
  if (!dateValue) return "点击记录疫苗与下次时间";
  const target = new Date(`${dateValue}T00:00:00`).getTime();
  const today = new Date(`${dateKey(new Date())}T00:00:00`).getTime();
  const days = Math.round((target - today) / 86400000);
  if (days === 0) return "今天接种";
  if (days > 0) return `还有 ${days} 天`;
  return `已过 ${Math.abs(days)} 天`;
}

function renderBabyProfile() {
  $("#babyName").textContent = babyProfile?.name || "设置宝宝档案";
  $("#babyAge").textContent = formatBabyAge();
  $("#babyBirth").textContent = babyProfile
    ? `出生于 ${new Date(babyProfile.birthAt).getFullYear()}.${pad(new Date(babyProfile.birthAt).getMonth() + 1)}.${pad(new Date(babyProfile.birthAt).getDate())} ${formatTime(babyProfile.birthAt)}`
    : "点击填写姓名和出生时间";

  const heightRecord = latestRecordWithValue("growth", "height");
  const weightRecord = latestRecordWithValue("growth", "weight");
  $("#latestHeight").textContent = heightRecord ? `${heightRecord.height}cm` : "--cm";
  $("#latestWeight").textContent = weightRecord ? `${weightRecord.weight}kg` : "--kg";
  const growthTime = Math.max(Number(heightRecord?.time) || 0, Number(weightRecord?.time) || 0);
  $("#latestGrowthTime").textContent = growthTime ? `${formatMonthDay(growthTime)}记录` : "点击记录";

  const jaundice = latestRecordWithValue("jaundice", "value");
  $("#latestJaundice").textContent = jaundice ? `${jaundice.value} ${jaundice.unit}` : "待记录";
  $("#latestJaundiceTime").textContent = jaundice ? `${formatMonthDay(jaundice.time)} ${formatTime(jaundice.time)}` : "点击记录";

  const today = dateKey(new Date());
  const schedules = records
    .filter((record) => record.type === "vaccine" && /^\d{4}-\d{2}-\d{2}$/.test(record.nextDate || ""))
    .sort((a, b) => a.nextDate.localeCompare(b.nextDate));
  const nextVaccine = schedules.find((record) => record.nextDate >= today) || schedules[schedules.length - 1];
  $("#nextVaccineDate").textContent = nextVaccine ? vaccineDateLabel(nextVaccine.nextDate) : "待安排";
  $("#nextVaccineName").textContent = nextVaccine
    ? `${nextVaccine.vaccineName} · ${vaccineCountdownLabel(nextVaccine.nextDate)}`
    : "点击记录疫苗与下次时间";
}

function renderSummary() {
  const { start, end } = getSelectedRange();
  const daily = records.filter((record) => recordTouchesDay(record, start, end));
  const feedings = daily.filter((record) => record.type === "feeding");
  const breast = feedings.filter((record) => record.feedingType === "breast");
  const formula = feedings.filter((record) => record.feedingType === "formula");
  const sumAmount = (items) => items.reduce((total, item) => total + (Number(item.amount) || 0), 0);
  const poops = daily.filter((record) => record.type === "poop");
  const pees = daily.filter((record) => record.type === "pee");
  const lights = daily.filter((record) => record.type === "light");
  const lightMs = lights.reduce((total, record) => total + dailyLightMs(record, start, end), 0);

  $("#feedingCount").textContent = feedings.length;
  $("#feedingAmount").textContent = `${sumAmount(feedings)} ml`;
  $("#breastStats").textContent = `${breast.length}次 · ${sumAmount(breast)}ml`;
  $("#formulaStats").textContent = `${formula.length}次 · ${sumAmount(formula)}ml`;
  $("#poopCount").textContent = poops.length;
  $("#peeCount").textContent = pees.length;
  $("#poopDetail").textContent = outputSummary(poops);
  $("#peeDetail").textContent = outputSummary(pees);
  $("#lightDuration").textContent = formatDuration(lightMs, true);
  $("#lightCount").textContent = `${lights.length} 次`;
}

function outputSummary(items) {
  if (!items.length) return "今天还没有记录";
  const groups = ["large", "medium", "small"].map((amount) => ({ amount, count: items.filter((item) => item.amount === amount).length })).filter((item) => item.count);
  return groups.map((item) => `${amountShort[item.amount]} ${item.count}次`).join(" · ");
}

function formatCountdown(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(total / 86400);
  const clock = `${pad(Math.floor((total % 86400) / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
  return days ? `${days}天 ${clock}` : clock;
}

function relativeDayLabel(timestamp) {
  const target = dateKey(new Date(timestamp));
  const today = dateKey(new Date());
  const diff = Math.round((new Date(`${target}T00:00:00`) - new Date(`${today}T00:00:00`)) / 86400000);
  if (diff === 0) return "今天";
  if (diff === 1) return "明天";
  if (diff === -1) return "昨天";
  return formatMonthDay(timestamp);
}

function renderFeedingCountdown() {
  const card = $("#feedingCountdown");
  const progress = $("#countdownProgress");
  const feedings = records.filter((record) => record.type === "feeding" && Number.isFinite(Number(record.time))).sort((a, b) => b.time - a.time);
  const latest = feedings[0];
  if (!latest) {
    card.classList.remove("has-record", "overdue");
    $("#countdownTitle").textContent = "距离下次吃奶";
    $("#countdownTime").textContent = "--:--:--";
    $("#countdownLastFeed").textContent = "记录一次吃奶后开始 3 小时倒计时";
    $("#nextFeedingTime").textContent = "--:--";
    $("#nextFeedingDate").textContent = "等待记录";
    progress.style.strokeDashoffset = "125.66";
    card.setAttribute("aria-label", "还没有吃奶记录，记录后开始三小时倒计时");
    return;
  }

  const now = Date.now();
  const next = Number(latest.time) + FEEDING_INTERVAL_MS;
  const remaining = next - now;
  const elapsedRatio = Math.min(1, Math.max(0, (now - Number(latest.time)) / FEEDING_INTERVAL_MS));
  const feedType = latest.feedingType === "breast" ? "母乳" : "奶粉";
  card.classList.add("has-record");
  card.classList.toggle("overdue", remaining <= 0);
  $("#countdownTitle").textContent = remaining > 0 ? "距离下次吃奶" : "已到建议吃奶时间";
  $("#countdownTime").textContent = remaining > 0 ? formatCountdown(remaining) : `已超过 ${formatCountdown(-remaining)}`;
  $("#countdownLastFeed").textContent = `上次 ${relativeDayLabel(latest.time)} ${formatTime(latest.time)} · ${feedType} ${latest.amount || 0}ml`;
  $("#nextFeedingTime").textContent = formatTime(next);
  $("#nextFeedingDate").textContent = `${relativeDayLabel(next)} · ${formatMonthDay(next)}`;
  progress.style.strokeDashoffset = String(125.66 * (1 - elapsedRatio));
  card.setAttribute("aria-label", remaining > 0 ? `距离下次吃奶还有${formatCountdown(remaining)}，预计${formatTime(next)}` : `已超过建议吃奶时间${formatCountdown(-remaining)}`);
}

function chartPosition(timestamp, dayStart, dayEnd) {
  return Math.min(100, Math.max(0, ((timestamp - dayStart) / (dayEnd - dayStart)) * 100));
}

function markerEdgeClass(position) {
  return position < 5 ? "edge-start" : position > 95 ? "edge-end" : "";
}

function renderDayTimeline() {
  const { start, end } = getSelectedRange();
  const daily = records.filter((record) => recordTouchesDay(record, start, end));
  const feedings = daily.filter((record) => record.type === "feeding").sort((a, b) => a.time - b.time);
  const outputs = daily.filter((record) => record.type === "poop" || record.type === "pee").sort((a, b) => a.time - b.time);
  const lights = daily.filter((record) => record.type === "light").sort((a, b) => a.start - b.start);
  const gridHours = Array.from({ length: 25 }, (_, hour) => hour);
  const axisHours = Array.from({ length: 9 }, (_, index) => index * 3);
  const grid = gridHours.map((hour) => `<i class="${hour % 6 === 0 ? "major" : hour % 3 === 0 ? "medium" : "hourly"}" style="left:${(hour / 24) * 100}%"></i>`).join("");
  const axis = axisHours.map((hour) => `<span class="${hour % 6 ? "minor-tick" : ""}" style="left:${(hour / 24) * 100}%">${pad(hour)}:00</span>`).join("");
  const now = Date.now();
  const nowIndicator = now >= start && now < end ? `<span class="now-indicator" style="left:${chartPosition(now, start, end).toFixed(3)}%"><b>现在</b></span>` : "";

  const feedingGaps = feedings.slice(1).map((record, index) => {
    const previous = feedings[index];
    const interval = record.time - previous.time;
    if (interval < 60000) return "";
    const left = chartPosition(previous.time, start, end);
    const right = chartPosition(record.time, start, end);
    const width = right - left;
    return `<span class="feeding-gap ${width < 11 ? "narrow-gap" : ""}" style="--gap-start:${left.toFixed(3)}%;--gap-width:${width.toFixed(3)}%"><i>${formatInterval(interval)}</i></span>`;
  }).join("");
  const feedingMarks = feedings.map((record) => {
    const position = chartPosition(record.time, start, end);
    const kind = record.feedingType === "breast" ? "母乳" : "奶粉";
    const description = `${kind} · ${record.amount || 0}ml · ${formatTime(record.time)}`;
    return `<span class="chart-marker feeding-mark ${markerEdgeClass(position)}" style="--position:${position.toFixed(3)}%" role="img" tabindex="0" aria-label="${escapeHtml(description)}" data-tooltip="${escapeHtml(description)}"><span class="marker-symbol" aria-hidden="true">🍼</span></span>`;
  }).join("");
  const outputMarks = outputs.map((record) => {
    const position = chartPosition(record.time, start, end);
    const isPoop = record.type === "poop";
    const description = `${isPoop ? "大便" : "小便"} · ${amountNames[record.amount] || "中量"} · ${formatTime(record.time)}`;
    return `<span class="chart-marker ${isPoop ? "poop-mark" : "pee-mark"} ${markerEdgeClass(position)}" style="--position:${position.toFixed(3)}%" role="img" tabindex="0" aria-label="${escapeHtml(description)}" data-tooltip="${escapeHtml(description)}"><span class="marker-symbol" aria-hidden="true">${isPoop ? "💩" : "💧"}</span></span>`;
  }).join("");
  const lightPeriods = lights.map((record) => {
    const recordEnd = record.end || Date.now();
    const clippedStart = Math.max(record.start, start);
    const clippedEnd = Math.min(recordEnd, end);
    const left = chartPosition(clippedStart, start, end);
    const right = chartPosition(clippedEnd, start, end);
    const labelStart = record.start < start ? "00:00" : formatTime(record.start);
    const labelEnd = recordEnd > end ? "24:00" : formatTime(recordEnd);
    const description = `蓝光 ${labelStart}至${labelEnd}，${formatDuration(clippedEnd - clippedStart)}`;
    return `<span class="light-period ${!record.end ? "active" : ""} ${left < 5 ? "edge-start" : right > 95 ? "edge-end" : ""}" style="--start:${left.toFixed(3)}%;--width:${Math.max(0, right - left).toFixed(3)}%" role="button" tabindex="0" aria-label="${escapeHtml(description)}" data-tooltip="${escapeHtml(description)}"></span>`;
  }).join("");
  const empty = `<span class="lane-empty">暂无</span>`;
  const summary = `当天吃奶${feedings.length}次，排泄${outputs.length}次，蓝光${lights.length}段`;
  $("#dayTimeline").setAttribute("aria-label", summary);
  $("#dayTimeline").innerHTML = `<div class="chart-grid" aria-hidden="true">${grid}${nowIndicator}</div>
    <div class="chart-lane feeding-lane"><strong class="lane-name"><span>🍼</span>吃奶</strong><div class="lane-track">${feedingGaps}${feedingMarks || empty}</div></div>
    <div class="chart-lane output-lane"><strong class="lane-name"><span>💧</span>排泄</strong><div class="lane-track">${outputMarks || empty}</div></div>
    <div class="chart-lane light-lane"><strong class="lane-name"><span>☀</span>蓝光</strong><div class="lane-track">${lightPeriods || empty}</div></div>
    <div class="time-axis" aria-hidden="true">${axis}</div>`;
}

function getPreviousSame(record) {
  const timestamp = record.type === "light" ? record.start : record.time;
  const candidates = records.filter((item) => item.type === record.type && item.id !== record.id && (item.type === "light" ? item.start : item.time) < timestamp);
  if (!candidates.length) return null;
  return candidates.sort((a, b) => (b.type === "light" ? b.start : b.time) - (a.type === "light" ? a.start : a.time))[0];
}

function renderTimeline() {
  const { start, end } = getSelectedRange();
  let daily = records.filter((record) => recordTouchesDay(record, start, end));
  if (activeFilter === "feeding") daily = daily.filter((record) => record.type === "feeding");
  if (activeFilter === "output") daily = daily.filter((record) => record.type === "poop" || record.type === "pee");
  if (activeFilter === "light") daily = daily.filter((record) => record.type === "light");
  if (activeFilter === "health") daily = daily.filter((record) => ["bath", "growth", "jaundice", "vaccine"].includes(record.type));
  daily.sort((a, b) => (b.type === "light" ? b.start : b.time) - (a.type === "light" ? a.start : a.time));

  const timeline = $("#timeline");
  if (!daily.length) {
    timeline.innerHTML = `<div class="empty-state"><div><span>🌱</span><h3>这一天还没有记录</h3><p>点击上面的快捷按钮，宝宝的每一个小日常都会整齐地留在这里。</p></div></div>`;
    return;
  }
  timeline.innerHTML = daily.map((record, index) => timelineItem(record, index)).join("");
}

function timelineItem(record, index) {
  const meta = typeMeta[record.type];
  const timestamp = record.type === "light" ? record.start : record.time;
  const previous = getPreviousSame(record);
  const previousTime = previous ? (previous.type === "light" ? previous.start : previous.time) : 0;
  let title = meta.label;
  let value = "";
  let detail = record.note || "";
  if (record.type === "feeding") {
    title = record.feedingType === "breast" ? "母乳" : "奶粉";
    value = `${record.amount || 0} ml`;
  } else if (record.type === "poop" || record.type === "pee") {
    value = amountNames[record.amount] || "中量";
  } else if (record.type === "light") {
    value = record.end ? formatDuration(record.end - record.start) : "进行中";
    detail = `${formatTime(record.start)} 开始${record.end ? ` · ${formatTime(record.end)} 结束` : ""}${record.note ? ` · ${record.note}` : ""}`;
  } else if (record.type === "growth") {
    value = [record.height ? `${record.height}cm` : "", record.weight ? `${record.weight}kg` : ""].filter(Boolean).join(" · ");
  } else if (record.type === "jaundice") {
    value = `${record.value} ${record.unit}`;
  } else if (record.type === "vaccine") {
    title = record.vaccineName;
    value = record.dose || "已接种";
    detail = `${record.nextDate ? `下次 ${vaccineDateLabel(record.nextDate)}` : "未填写下次时间"}${record.note ? ` · ${record.note}` : ""}`;
  } else if (record.type === "bath") {
    value = record.duration ? `${record.duration} 分钟` : "已洗澡";
    detail = `${record.waterTemp ? `水温 ${record.waterTemp}℃` : ""}${record.note ? `${record.waterTemp ? " · " : ""}${record.note}` : ""}`;
  }
  const interval = previous ? `<span class="interval-pill">⏱ 距上次 ${formatInterval(timestamp - previousTime)}</span>` : `<span class="interval-pill first">首次记录</span>`;
  return `<article class="timeline-item ${record.type}" style="animation-delay:${Math.min(index * 30, 180)}ms">
    <div class="timeline-dot">${meta.icon}</div>
    <div class="timeline-content"><div class="timeline-main"><strong>${escapeHtml(title)}</strong><b>${escapeHtml(value)}</b><time>${formatTime(timestamp)}</time></div>${detail ? `<p>${escapeHtml(detail)}</p>` : ""}</div>
    <div class="timeline-actions">${interval}<button class="delete-button" data-delete="${record.id}" type="button" aria-label="删除这条记录" title="删除">×</button></div>
  </article>`;
}

function renderActiveLight() {
  const active = records.find((record) => record.type === "light" && !record.end);
  $("#activeLight").hidden = !active;
  $("#lightQuickSubtitle").textContent = active ? "正在计时中" : "开始 / 结束";
  if (!active) { clearInterval(timerId); timerId = undefined; return; }
  const update = () => {
    $("#activeLightDuration").textContent = formatClockDuration(Date.now() - active.start);
    $("#activeLightStart").textContent = `${formatMonthDay(active.start)} ${formatTime(active.start)} 开始`;
  };
  update();
  if (!timerId) timerId = setInterval(() => { update(); renderSummary(); }, 1000);
}

function openModal(type) {
  const meta = typeMeta[type];
  editingActiveLightId = null;
  $("#recordForm").reset();
  $("#recordType").value = type;
  $("#modalTitle").textContent = meta.title;
  $("#modalIcon").textContent = meta.icon;
  $("#modalIcon").style.background = meta.color;
  $("#feedingFields").hidden = type !== "feeding";
  $("#outputFields").hidden = type !== "poop" && type !== "pee";
  $("#growthFields").hidden = type !== "growth";
  $("#jaundiceFields").hidden = type !== "jaundice";
  $("#vaccineFields").hidden = type !== "vaccine";
  $("#bathFields").hidden = type !== "bath";
  $("#singleTimeFields").hidden = type === "light";
  $("#lightFields").hidden = type !== "light";
  $("#eventTimeInput").required = type !== "light";
  $("#eventDateInput").required = type !== "light";
  $("#lightStartDateInput").required = type === "light";
  $("#lightStartTimeInput").required = type === "light";
  setDateTimeFields("event");
  setDateTimeFields("lightStart");
  setDateTimeFields("lightEnd", new Date(), false);
  $("#durationPreview").classList.add("ongoing");
  $("#durationPreview").innerHTML = "<span>●</span> 未填结束时间，将保存为“正在进行”";
  $("#submitButton").textContent = type === "light" ? "保存蓝光记录" : "保存记录";

  const activeLight = type === "light" ? records.find((item) => item.type === "light" && !item.end) : null;
  if (activeLight) {
    editingActiveLightId = activeLight.id;
    $("#modalTitle").textContent = "结束蓝光";
    setDateTimeFields("lightStart", new Date(activeLight.start));
    setDateTimeFields("lightEnd");
    $("#noteInput").value = activeLight.note || "";
    $("#submitButton").textContent = "保存结束时间";
    updateDurationPreview();
  }
  $("#modalBackdrop").hidden = false;
  document.body.style.overflow = "hidden";
  const focusTarget = type === "feeding" ? $("#feedingAmountInput")
    : type === "growth" ? $("#heightInput")
    : type === "jaundice" ? $("#jaundiceValueInput")
    : type === "vaccine" ? $("#vaccineNameInput")
    : type === "bath" ? $("#bathDurationInput")
    : type === "light" && activeLight ? $("#lightEndTimeInput")
    : type === "light" ? $("#lightStartTimeInput")
    : $("#eventTimeInput");
  setTimeout(() => focusTarget.focus(), 50);
}

function closeModal() {
  $("#modalBackdrop").hidden = true;
  document.body.style.overflow = "";
  editingActiveLightId = null;
}

function openProfileModal() {
  $("#profileForm").reset();
  $("#babyNameInput").value = babyProfile?.name || "";
  setDateTimeFields("babyBirth", babyProfile ? new Date(babyProfile.birthAt) : new Date());
  $("#profileModalBackdrop").hidden = false;
  document.body.style.overflow = "hidden";
  setTimeout(() => $("#babyNameInput").focus(), 50);
}

function closeProfileModal() {
  $("#profileModalBackdrop").hidden = true;
  document.body.style.overflow = "";
}

function submitProfile(event) {
  event.preventDefault();
  const name = $("#babyNameInput").value.trim();
  const birthAt = parseDateTime($("#babyBirthDateInput").value, $("#babyBirthTimeInput").value);
  if (!name) return showToast("请填写宝宝姓名");
  if (!Number.isFinite(birthAt)) return showToast("请正确填写出生日期和时间");
  if (birthAt > Date.now()) return showToast("出生时间不能晚于现在");
  babyProfile = { name, birthAt, updatedAt: Date.now() };
  saveRecords();
  closeProfileModal();
  render();
  showToast("宝宝档案已保存", true);
}

function submitRecord(event) {
  event.preventDefault();
  const type = $("#recordType").value;
  const note = $("#noteInput").value.trim();
  const now = Date.now();
  const base = { id: `${now}-${Math.random().toString(16).slice(2)}`, type, note, createdAt: now, updatedAt: now };
  let record;
  if (type === "feeding") {
    const amount = Number($("#feedingAmountInput").value);
    if (!Number.isFinite(amount) || amount <= 0) return showToast("请填写大于 0 的奶量");
    const time = parseDateTime($("#eventDateInput").value, $("#eventTimeInput").value);
    if (!Number.isFinite(time)) return showToast("请正确填写发生日期和时间");
    record = { ...base, feedingType: new FormData(event.currentTarget).get("feedingType"), amount, time };
  } else if (type === "poop" || type === "pee") {
    const time = parseDateTime($("#eventDateInput").value, $("#eventTimeInput").value);
    if (!Number.isFinite(time)) return showToast("请正确填写发生日期和时间");
    record = { ...base, amount: new FormData(event.currentTarget).get("outputAmount"), time };
  } else if (type === "growth") {
    const time = parseDateTime($("#eventDateInput").value, $("#eventTimeInput").value);
    const heightValue = $("#heightInput").value.trim();
    const weightValue = $("#weightInput").value.trim();
    const height = heightValue ? Number(heightValue) : null;
    const weight = weightValue ? Number(weightValue) : null;
    if (!Number.isFinite(time)) return showToast("请正确填写测量日期和时间");
    if (height === null && weight === null) return showToast("身高和体重至少填写一项");
    if (height !== null && (!Number.isFinite(height) || height <= 0)) return showToast("请正确填写身高");
    if (weight !== null && (!Number.isFinite(weight) || weight <= 0)) return showToast("请正确填写体重");
    record = { ...base, time, height, weight };
  } else if (type === "jaundice") {
    const time = parseDateTime($("#eventDateInput").value, $("#eventTimeInput").value);
    const value = Number($("#jaundiceValueInput").value);
    if (!Number.isFinite(time)) return showToast("请正确填写测量日期和时间");
    if (!Number.isFinite(value) || value < 0) return showToast("请正确填写黄疸数值");
    record = { ...base, time, value, unit: new FormData(event.currentTarget).get("jaundiceUnit") || "mg/dL" };
  } else if (type === "vaccine") {
    const time = parseDateTime($("#eventDateInput").value, $("#eventTimeInput").value);
    const vaccineName = $("#vaccineNameInput").value.trim();
    const dose = $("#vaccineDoseInput").value.trim();
    const nextDate = $("#nextVaccineDateInput").value;
    if (!vaccineName) return showToast("请填写疫苗名称");
    if (!Number.isFinite(time)) return showToast("请正确填写接种日期和时间");
    if (nextDate && nextDate < dateKey(new Date(time))) return showToast("下次疫苗日期不能早于本次接种日期");
    record = { ...base, time, vaccineName, dose, nextDate };
  } else if (type === "bath") {
    const time = parseDateTime($("#eventDateInput").value, $("#eventTimeInput").value);
    const durationValue = $("#bathDurationInput").value.trim();
    const waterTempValue = $("#bathWaterTempInput").value.trim();
    const duration = durationValue ? Number(durationValue) : null;
    const waterTemp = waterTempValue ? Number(waterTempValue) : null;
    if (!Number.isFinite(time)) return showToast("请正确填写洗澡日期和时间");
    if (duration !== null && (!Number.isFinite(duration) || duration <= 0)) return showToast("请正确填写洗澡时长");
    if (waterTemp !== null && (!Number.isFinite(waterTemp) || waterTemp <= 0)) return showToast("请正确填写水温");
    record = { ...base, time, duration, waterTemp };
  } else {
    const start = parseDateTime($("#lightStartDateInput").value, $("#lightStartTimeInput").value);
    const endTimeValue = $("#lightEndTimeInput").value;
    const end = endTimeValue ? parseDateTime($("#lightEndDateInput").value, endTimeValue) : null;
    if (!Number.isFinite(start)) return showToast("请正确填写蓝光开始时间");
    if (endTimeValue && !Number.isFinite(end)) return showToast("请正确填写蓝光结束日期和时间");
    if (end && end <= start) return showToast("结束时间要晚于开始时间");
    const existingActive = records.find((item) => item.type === "light" && !item.end && item.id !== editingActiveLightId);
    if (!end && existingActive) return showToast("已有一段蓝光正在计时，请先结束");
    if (editingActiveLightId) {
      record = records.find((item) => item.id === editingActiveLightId);
      if (!record) return showToast("未找到正在进行的蓝光记录");
      Object.assign(record, { start, end, note, updatedAt: Date.now() });
    } else {
      record = { ...base, start, end };
    }
  }
  if (!editingActiveLightId) records.push(record);
  saveRecords();
  selectedDate = dateKey(new Date(type === "light" ? record.start : record.time));
  closeModal();
  render();
  showToast(type === "light" && !record.end ? "蓝光计时已开始，并已保存" : "记录已保存到历史数据", true);
}

function updateDurationPreview() {
  const start = parseDateTime($("#lightStartDateInput").value, $("#lightStartTimeInput").value);
  const endTimeValue = $("#lightEndTimeInput").value;
  const end = endTimeValue ? parseDateTime($("#lightEndDateInput").value, endTimeValue) : NaN;
  const preview = $("#durationPreview");
  preview.classList.toggle("ongoing", !endTimeValue);
  if (!endTimeValue) { preview.innerHTML = "<span>●</span> 未填结束时间，将保存为“正在进行”"; return; }
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) { preview.textContent = "结束时间需要晚于开始时间"; return; }
  preview.textContent = `本次蓝光时长：${formatDuration(end - start)}`;
}

function stopActiveLight() {
  const active = records.find((record) => record.type === "light" && !record.end);
  if (!active) return;
  active.end = Date.now();
  active.updatedAt = active.end;
  saveRecords();
  clearInterval(timerId); timerId = undefined;
  render();
  showToast(`蓝光已结束并保存 · 本次 ${formatDuration(active.end - active.start)}`, true);
}

function changeDay(delta) {
  const date = new Date(`${selectedDate}T12:00:00`);
  date.setDate(date.getDate() + delta);
  selectedDate = dateKey(date);
  render();
}

function deleteRecord(id) {
  const record = records.find((item) => item.id === id);
  if (!record || !window.confirm(`确定删除这条“${typeMeta[record.type].label}”记录吗？`)) return;
  records = records.filter((item) => item.id !== id);
  deletedRecords[id] = Date.now();
  saveRecords();
  render();
  showToast("记录已删除");
}

function buildExportPayload() {
  return { app: "宝宝照护日记", version: 2, exportedAt: new Date().toISOString(), profile: babyProfile, recordCount: records.length, records };
}

function setCloudSyncState(state, detail = "") {
  cloudSyncState = state;
  if (detail) cloudSyncDetail = detail;
  else if (state === "off" || state === "syncing") cloudSyncDetail = "";
  const status = $("#cloudSyncStatus");
  const summary = $("#cloudSyncSummary");
  if (!status || !summary) return;
  const labels = {
    off: "尚未开启",
    waiting: "等待同步",
    syncing: "正在同步…",
    synced: lastCloudSyncAt ? `已同步 · ${formatTime(lastCloudSyncAt)}` : "已同步",
    error: "同步失败",
  };
  status.textContent = labels[state] || labels.off;
  status.dataset.state = state;
  summary.textContent = detail || cloudSyncDetail || (syncConfig
    ? `私有仓库 ${syncConfig.owner}/${syncConfig.repo} · 自动合并并保存明文 JSON`
    : "连接私有 GitHub 仓库后，多台设备会自动合并记录");
}

function renderCloudSyncPanel() {
  const connected = Boolean(syncConfig);
  const panel = $("#cloudSyncPanel");
  if (!panel) return;
  $("#cloudTokenInput").value = syncConfig?.token || "";
  $("#cloudDisconnectButton").hidden = !connected;
  $("#cloudSyncNowButton").hidden = !connected;
  $("#cloudConnectButton").textContent = connected ? "更新配置并同步" : "连接并首次同步";
  setCloudSyncState(cloudSyncState, cloudSyncDetail);
}

function scheduleCloudSync(delay = 1400) {
  if (!syncConfig) return;
  clearTimeout(cloudSyncTimerId);
  setCloudSyncState("waiting", "新记录已保存在本机，等待上传到私有仓库");
  cloudSyncTimerId = setTimeout(() => syncWithCloud({ silent: true }), delay);
}

function bytesToBase64(bytes) {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 32768) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 32768));
  }
  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(String(value).replace(/\s/g, ""));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function githubHeaders(config) {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${config.token}`,
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

async function githubRequest(url, config, options = {}) {
  let response;
  try {
    response = await fetch(url, { ...options, headers: { ...githubHeaders(config), ...(options.headers || {}) } });
  } catch {
    throw new Error("github-network-error");
  }
  if (response.status === 401) throw new Error("github-unauthorized");
  if (response.status === 403) throw new Error("github-forbidden");
  return response;
}

function githubRepositoryApi(config) {
  return `https://api.github.com/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}`;
}

async function verifyPrivateRepository(config) {
  const response = await githubRequest(githubRepositoryApi(config), config);
  if (response.status === 404) throw new Error("github-repository-unavailable");
  if (!response.ok) throw new Error("github-api-error");
  const repository = await response.json();
  if (!repository.private) throw new Error("github-repository-must-be-private");
}

async function readCloudSnapshot(config) {
  const response = await githubRequest(`${githubRepositoryApi(config)}/contents/${CLOUD_FILE_PATH}`, config, {
    headers: { Accept: "application/vnd.github.object+json" },
  });
  if (response.status === 404) return { sha: null, profile: null, records: [], deletedRecords: {} };
  if (!response.ok) throw new Error("github-api-error");
  const file = await response.json();
  let payload;
  try {
    payload = JSON.parse(new TextDecoder().decode(base64ToBytes(file.content)));
  } catch {
    throw new Error("invalid-cloud-data");
  }
  return {
    sha: file.sha,
    profile: normalizeProfile(payload.profile),
    records: Array.isArray(payload.records) ? payload.records : [],
    deletedRecords: payload.deletedRecords && typeof payload.deletedRecords === "object" ? payload.deletedRecords : {},
  };
}

function mergeCloudSnapshot(remoteRecords, remoteDeletedRecords, remoteProfile) {
  const mergedDeleted = { ...deletedRecords };
  Object.entries(remoteDeletedRecords || {}).forEach(([id, timestamp]) => {
    const value = Number(timestamp) || 0;
    if (value > (Number(mergedDeleted[id]) || 0)) mergedDeleted[id] = value;
  });

  const merged = new Map();
  [...records, ...remoteRecords.map(normalizeImportedRecord).filter(Boolean)].forEach((record) => {
    const existing = merged.get(record.id);
    const recordVersion = Number(record.updatedAt) || Number(record.createdAt) || 0;
    const existingVersion = Number(existing?.updatedAt) || Number(existing?.createdAt) || 0;
    if (!existing || recordVersion >= existingVersion) merged.set(record.id, record);
  });

  records = [...merged.values()].filter((record) => {
    const deletedAt = Number(mergedDeleted[record.id]) || 0;
    const updatedAt = Number(record.updatedAt) || Number(record.createdAt) || 0;
    return deletedAt < updatedAt;
  });
  deletedRecords = mergedDeleted;
  if (remoteProfile && (!babyProfile || remoteProfile.updatedAt >= (Number(babyProfile.updatedAt) || 0))) {
    babyProfile = remoteProfile;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  localStorage.setItem(DELETED_KEY, JSON.stringify(deletedRecords));
  if (babyProfile) localStorage.setItem(PROFILE_KEY, JSON.stringify(babyProfile));
}

async function writeCloudSnapshot(config, sha) {
  const payload = JSON.stringify({
    app: "宝宝照护日记",
    version: 2,
    syncedAt: new Date().toISOString(),
    profile: babyProfile,
    recordCount: records.length,
    records,
    deletedRecords,
  }, null, 2);
  const body = {
    message: "Sync baby care records",
    content: bytesToBase64(new TextEncoder().encode(payload)),
    branch: "main",
  };
  if (sha) body.sha = sha;
  return githubRequest(`${githubRepositoryApi(config)}/contents/${CLOUD_FILE_PATH}`, config, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function cloudErrorMessage(error) {
  const messages = {
    "github-unauthorized": "令牌无效或已过期",
    "github-forbidden": "GitHub 拒绝写入，请确认令牌只选中了 baby-care-data 且 Contents 为 Read and write",
    "github-repository-unavailable": "找不到数据仓库，或令牌没有访问权限",
    "github-repository-must-be-private": "为保护隐私，数据仓库必须设为 Private",
    "github-network-error": "当前浏览器无法连接 GitHub API，请检查网络后重试",
    "github-api-error": "GitHub API 返回异常，请稍后重试",
    "github-sync-conflict": "云端刚被其他设备更新，请再次同步",
    "invalid-cloud-data": "云端数据文件不是有效的宝宝照护 JSON",
  };
  return messages[error?.message] || "网络或 GitHub 服务暂时不可用";
}

async function syncWithCloud({ silent = false } = {}) {
  if (!syncConfig) return;
  if (cloudSyncInFlight) { cloudSyncQueued = true; return; }
  cloudSyncInFlight = true;
  setCloudSyncState("syncing");
  try {
    await verifyPrivateRepository(syncConfig);
    let completed = false;
    for (let attempt = 0; attempt < 3 && !completed; attempt += 1) {
      const remote = await readCloudSnapshot(syncConfig);
      mergeCloudSnapshot(remote.records, remote.deletedRecords, remote.profile);
      const response = await writeCloudSnapshot(syncConfig, remote.sha);
      if (response.ok) {
        completed = true;
      } else if (response.status !== 409 && response.status !== 422) {
        throw new Error("github-api-error");
      }
    }
    if (!completed) throw new Error("github-sync-conflict");
    lastCloudSyncAt = Date.now();
    render();
    setCloudSyncState("synced", `共 ${records.length} 条 · 已保存至 ${syncConfig.owner}/${syncConfig.repo}`);
    if (!silent) showToast(`云同步完成 · 共 ${records.length} 条记录`);
  } catch (error) {
    const message = cloudErrorMessage(error);
    setCloudSyncState("error", message);
    if (!silent) showToast(`云同步失败：${message}`);
  } finally {
    cloudSyncInFlight = false;
    if (cloudSyncQueued) {
      cloudSyncQueued = false;
      scheduleCloudSync(500);
    }
  }
}

async function connectCloudSync() {
  const token = $("#cloudTokenInput").value.trim();
  if (token.length < 20) return showToast("请填写该私有仓库的访问令牌");
  syncConfig = { owner: CLOUD_OWNER, repo: CLOUD_REPO, token };
  localStorage.setItem(SYNC_CONFIG_KEY, JSON.stringify(syncConfig));
  cloudSyncState = "waiting";
  renderCloudSyncPanel();
  await syncWithCloud({ silent: false });
}

function disconnectCloudSync() {
  if (!window.confirm("关闭云同步？本机记录不会删除，之后仍可重新连接。")) return;
  clearTimeout(cloudSyncTimerId);
  localStorage.removeItem(SYNC_CONFIG_KEY);
  syncConfig = null;
  cloudSyncState = "off";
  renderCloudSyncPanel();
  renderHistoryStatus();
  showToast("云同步已关闭，本机记录仍然保留");
}

function canUseLocalBackupService() {
  const host = window.location.hostname;
  if (host === "localhost" || host === "127.0.0.1" || host === "::1") return true;
  if (/^10\./.test(host) || /^192\.168\./.test(host)) return true;
  const match = host.match(/^172\.(\d{1,2})\./);
  return Boolean(match && Number(match[1]) >= 16 && Number(match[1]) <= 31);
}

async function writeBackupToCurrentDirectory(payload) {
  if (!canUseLocalBackupService()) throw new Error("local-save-unavailable");
  const response = await fetch("/api/records", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Baby-Care-Local": "1" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error("local-save-unavailable");
  return response.json();
}

function scheduleAutoBackup(delay = 700) {
  clearTimeout(autoBackupTimerId);
  autoBackupTimerId = setTimeout(async () => {
    try {
      await writeBackupToCurrentDirectory(buildExportPayload());
    } catch {
      // 浏览器存储已经完成；本地服务不可用时等待下次修改或打开页面再同步文件。
    }
  }, delay);
}

async function exportRecords() {
  if (!records.length) return showToast("还没有可以导出的记录");
  const payload = buildExportPayload();
  try {
    const result = await writeBackupToCurrentDirectory(payload);
    showToast(`已覆盖保存 ${result.recordCount} 条记录到宝宝照护记录.json`);
  } catch {
    const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "宝宝照护记录.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    showToast("已下载宝宝照护记录.json，请妥善保存备份");
  }
}

function openDataModal() {
  renderHistoryStatus();
  renderCloudSyncPanel();
  $("#dataModalBackdrop").hidden = false;
  document.body.style.overflow = "hidden";
}

function closeDataModal() {
  $("#dataModalBackdrop").hidden = true;
  document.body.style.overflow = "";
}

function normalizeImportedRecord(item, index) {
  if (!item || typeof item !== "object" || !typeMeta[item.type]) return null;
  const fallbackId = `import-${Date.now()}-${index}-${Math.random().toString(16).slice(2)}`;
  const id = typeof item.id === "string" && /^[\w-]{1,100}$/.test(item.id) ? item.id : fallbackId;
  const createdAt = Number(item.createdAt) || Date.now();
  const base = { id, type: item.type, note: String(item.note || "").slice(0, 60), createdAt, updatedAt: Number(item.updatedAt) || createdAt };

  if (item.type === "feeding") {
    const time = Number(item.time);
    const amount = Number(item.amount);
    if (!Number.isFinite(time) || !Number.isFinite(amount) || amount <= 0) return null;
    return { ...base, time, amount, feedingType: item.feedingType === "breast" ? "breast" : "formula" };
  }
  if (item.type === "poop" || item.type === "pee") {
    const time = Number(item.time);
    if (!Number.isFinite(time)) return null;
    return { ...base, time, amount: ["small", "medium", "large"].includes(item.amount) ? item.amount : "medium" };
  }
  if (item.type === "growth") {
    const time = Number(item.time);
    const height = item.height === null || item.height === undefined || item.height === "" ? null : Number(item.height);
    const weight = item.weight === null || item.weight === undefined || item.weight === "" ? null : Number(item.weight);
    if (!Number.isFinite(time) || (height === null && weight === null)) return null;
    if ((height !== null && (!Number.isFinite(height) || height <= 0)) || (weight !== null && (!Number.isFinite(weight) || weight <= 0))) return null;
    return { ...base, time, height, weight };
  }
  if (item.type === "jaundice") {
    const time = Number(item.time);
    const value = Number(item.value);
    if (!Number.isFinite(time) || !Number.isFinite(value) || value < 0) return null;
    return { ...base, time, value, unit: item.unit === "μmol/L" ? "μmol/L" : "mg/dL" };
  }
  if (item.type === "vaccine") {
    const time = Number(item.time);
    const vaccineName = String(item.vaccineName || "").slice(0, 30);
    const dose = String(item.dose || "").slice(0, 20);
    const nextDate = /^\d{4}-\d{2}-\d{2}$/.test(item.nextDate || "") ? item.nextDate : "";
    if (!Number.isFinite(time) || !vaccineName) return null;
    return { ...base, time, vaccineName, dose, nextDate };
  }
  if (item.type === "bath") {
    const time = Number(item.time);
    const duration = item.duration === null || item.duration === undefined || item.duration === "" ? null : Number(item.duration);
    const waterTemp = item.waterTemp === null || item.waterTemp === undefined || item.waterTemp === "" ? null : Number(item.waterTemp);
    if (!Number.isFinite(time)) return null;
    if ((duration !== null && (!Number.isFinite(duration) || duration <= 0)) || (waterTemp !== null && (!Number.isFinite(waterTemp) || waterTemp <= 0))) return null;
    return { ...base, time, duration, waterTemp };
  }
  const start = Number(item.start);
  const end = item.end === null || item.end === undefined ? null : Number(item.end);
  if (!Number.isFinite(start) || (end !== null && (!Number.isFinite(end) || end <= start))) return null;
  return { ...base, start, end };
}

async function importRecords(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    const source = Array.isArray(parsed) ? parsed : parsed.records;
    if (!Array.isArray(source)) throw new Error("invalid-format");
    const importedProfile = Array.isArray(parsed) ? null : normalizeProfile(parsed.profile);
    const imported = source.map(normalizeImportedRecord).filter(Boolean);
    if (!imported.length) throw new Error("no-records");

    const existingIds = new Set(records.map((item) => item.id));
    const addedCount = imported.filter((item) => !existingIds.has(item.id)).length;
    const merged = new Map(records.map((item) => [item.id, item]));
    imported.forEach((item) => {
      merged.set(item.id, item);
      delete deletedRecords[item.id];
    });
    records = [...merged.values()];
    if (importedProfile && (!babyProfile || importedProfile.updatedAt >= (Number(babyProfile.updatedAt) || 0))) babyProfile = importedProfile;
    saveRecords();
    render();
    closeDataModal();
    showToast(`导入完成 · 新增 ${addedCount} 条，共 ${records.length} 条`);
  } catch {
    showToast("导入失败，请选择本页面导出的 JSON 文件");
  } finally {
    event.target.value = "";
  }
}

function syncHistoryFromStorage(showNotice = false) {
  records = loadRecords();
  deletedRecords = loadDeletedRecords();
  babyProfile = loadProfile();
  render();
  if (showNotice && records.length) showToast(`已同步 ${records.length} 条历史记录`);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
}

let toastTimeout;
function showToast(message, offerExport = false) {
  const toast = $("#toast");
  const action = $("#toastAction");
  $("#toastMessage").textContent = message;
  action.hidden = !offerExport;
  action.onclick = offerExport ? exportRecords : null;
  toast.classList.add("show");
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.remove("show"), offerExport ? 5000 : 2600);
}

$$('[data-open]').forEach((button) => button.addEventListener("click", () => openModal(button.dataset.open)));
$("#modalClose").addEventListener("click", closeModal);
$("#modalBackdrop").addEventListener("click", (event) => { if (event.target === event.currentTarget) closeModal(); });
$("#profileEditButton").addEventListener("click", openProfileModal);
$("#profileModalClose").addEventListener("click", closeProfileModal);
$("#profileModalBackdrop").addEventListener("click", (event) => { if (event.target === event.currentTarget) closeProfileModal(); });
$("#profileForm").addEventListener("submit", submitProfile);
$("#dataButton").addEventListener("click", openDataModal);
$("#dataModalClose").addEventListener("click", closeDataModal);
$("#dataModalBackdrop").addEventListener("click", (event) => { if (event.target === event.currentTarget) closeDataModal(); });
$("#importButton").addEventListener("click", () => $("#importFileInput").click());
$("#importFileInput").addEventListener("change", importRecords);
$("#cloudSyncToggle").addEventListener("click", () => {
  const panel = $("#cloudSyncPanel");
  panel.hidden = !panel.hidden;
  $("#cloudSyncToggle").setAttribute("aria-expanded", String(!panel.hidden));
  if (!panel.hidden) renderCloudSyncPanel();
});
$("#cloudConnectButton").addEventListener("click", connectCloudSync);
$("#cloudSyncNowButton").addEventListener("click", () => syncWithCloud({ silent: false }));
$("#cloudDisconnectButton").addEventListener("click", disconnectCloudSync);
$("#recordForm").addEventListener("submit", submitRecord);
$("#previousDay").addEventListener("click", () => changeDay(-1));
$("#nextDay").addEventListener("click", () => changeDay(1));
$("#todayButton").addEventListener("click", () => { selectedDate = dateKey(new Date()); render(); });
$("#dateDisplay").addEventListener("click", () => { try { $("#datePicker").showPicker(); } catch { $("#datePicker").click(); } });
$("#datePicker").addEventListener("change", (event) => { if (event.target.value) { selectedDate = event.target.value; render(); } });
$("#stopLightButton").addEventListener("click", stopActiveLight);
$("#exportButton").addEventListener("click", exportRecords);
$$('#lightStartDateInput, #lightStartTimeInput, #lightEndDateInput, #lightEndTimeInput').forEach((input) => input.addEventListener("input", updateDurationPreview));
$$('[data-now-for]').forEach((button) => button.addEventListener("click", () => { setDateTimeFields(button.dataset.nowFor); updateDurationPreview(); }));
$$('[data-amount]').forEach((button) => button.addEventListener("click", () => { $("#feedingAmountInput").value = button.dataset.amount; }));
$$('[data-filter]').forEach((button) => button.addEventListener("click", () => { activeFilter = button.dataset.filter; $$('[data-filter]').forEach((item) => item.classList.toggle("active", item === button)); renderTimeline(); }));
$("#timeline").addEventListener("click", (event) => { const button = event.target.closest("[data-delete]"); if (button) deleteRecord(button.dataset.delete); });
window.addEventListener("storage", (event) => { if (event.key === STORAGE_KEY || event.key === PROFILE_KEY) syncHistoryFromStorage(true); });
window.addEventListener("pageshow", () => syncHistoryFromStorage(false));
document.addEventListener("visibilitychange", () => { if (!document.hidden) syncHistoryFromStorage(false); });
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (!$("#modalBackdrop").hidden) closeModal();
  if (!$("#profileModalBackdrop").hidden) closeProfileModal();
  if (!$("#dataModalBackdrop").hidden) closeDataModal();
});

render();
if (!countdownTimerId) countdownTimerId = setInterval(renderFeedingCountdown, 1000);
if (records.length) scheduleAutoBackup(1500);
if (records.length) setTimeout(() => showToast(`已同步 ${records.length} 条历史记录`), 450);
if (syncConfig) setTimeout(() => syncWithCloud({ silent: true }), 900);
