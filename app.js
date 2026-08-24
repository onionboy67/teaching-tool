/* ============================================================
   TEACHER HQ
   Profiles + School Terms + schedule history + Days Off
   Unit Planner + lesson placeholders + portable backup/read view
============================================================ */

const STORAGE_KEY = "teacherHQData_v4";
const LEGACY_STORAGE_KEYS = ["teacherHQData_v3", "teacherHQData_v2", "teacherHQData_v1"];

const DEFAULT_GRADES = [
  "Kindergarten", "Grade 1", "Grade 2", "Grade 3", "Grade 4",
  "Grade 5", "Grade 6", "Grade 7", "Grade 8"
];

const DEFAULT_SUBJECTS = ["ELA", "Math", "Second Step", "Fine Arts"];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const FUN_UNIT_COLOURS = [
  "#FF5F8F", "#8C6CFF", "#33C7FF", "#39D98A", "#FFB347", "#F04FCB",
  "#6EDB3F", "#FF7043", "#00B8D9", "#FFC93C", "#A45CFF", "#00C48C",
  "#FF4D6D", "#5B8CFF", "#FF8A3D", "#2DD4BF", "#C45CFF", "#A6E22E"
];
const CURRICULUM = Array.isArray(window.TEACHER_HQ_CURRICULUM)
  ? window.TEACHER_HQ_CURRICULUM
  : [];

let appData = loadData();
let activeUserId = appData.activeUserId || null;
let visibleDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
let selectedProfileColour = "#33c7ff";

let readOnlyMode = false;
let readOnlySource = null; // null | preview | shared
let sharedReadOnlyUser = null;

let workingTerm = null;
let editingTermId = null;
let workingScheduleBlocks = [];
let baseScheduleBlocks = [];
let editingScheduleBlockId = null;

let editingDayOffId = null;

let unitWizardStep = 1;
let editingUnitId = null;
let unitDraft = null;
let unitCurriculumSelection = new Set();
let unitVisibleDate = null;
let selectedLessonContext = null;

/* ============================================================
   DOM REFERENCES
============================================================ */

const $ = id => document.getElementById(id);

const userSelectionView = $("userSelectionView");
const teacherHQView = $("teacherHQView");
const profileList = $("profileList");
const createUserDialog = $("createUserDialog");
const createUserForm = $("createUserForm");
const newUsername = $("newUsername");
const profileImageInput = $("profileImageInput");
const currentUsername = $("currentUsername");
const currentUserAvatar = $("currentUserAvatar");
const readOnlyBanner = $("readOnlyBanner");
const readOnlyFileInput = $("readOnlyFileInput");
const restoreBackupInput = $("restoreBackupInput");

const termDialog = $("termDialog");
const scheduleBlockDialog = $("scheduleBlockDialog");
const scheduleBlockForm = $("scheduleBlockForm");
const instructionalOptions = $("instructionalOptions");
const splitClassCheckbox = $("splitClassCheckbox");
const splitGradeArea = $("splitGradeArea");
const blockType = $("blockType");
const blockGrade = $("blockGrade");
const blockSubject = $("blockSubject");
const splitGradeChoices = $("splitGradeChoices");
const blockDayChoices = $("blockDayChoices");

const monthTitle = $("monthTitle");
const calendarGrid = $("calendarGrid");
const unplannedAlert = $("unplannedAlert");
const unplannedAlertText = $("unplannedAlertText");
const conflictAlert = $("conflictAlert");
const conflictAlertText = $("conflictAlertText");
const pdAlert = $("pdAlert");
const pdAlertText = $("pdAlertText");
const pdAlertDetail = $("pdAlertDetail");
const backupReminder = $("backupReminder");
const backupStatusText = $("backupStatusText");

const dayDetailsDialog = $("dayDetailsDialog");
const dayDetailsHeading = $("dayDetailsHeading");
const dayDetailsList = $("dayDetailsList");
const dayExceptionSummary = $("dayExceptionSummary");

const daysOffDialog = $("daysOffDialog");
const dayOffForm = $("dayOffForm");
const dayOffType = $("dayOffType");
const pdFields = $("pdFields");
const nonPDTypeFields = $("nonPDTypeFields");
const dayOffDetailsFields = $("dayOffDetailsFields");
const nonPDFields = $("nonPDFields");

const unitPlannerDialog = $("unitPlannerDialog");
const unitWizardDialog = $("unitWizardDialog");
const unitDetailDialog = $("unitDetailDialog");
const lessonPlaceholderDialog = $("lessonPlaceholderDialog");

/* ============================================================
   STORAGE + MIGRATION
============================================================ */

function defaultData() {
  return { schemaVersion: 4, activeUserId: null, users: [] };
}

function loadData() {
  try {
    const current = localStorage.getItem(STORAGE_KEY);
    if (current) return normalizeData(JSON.parse(current));

    for (const key of LEGACY_STORAGE_KEYS) {
      const legacy = localStorage.getItem(key);
      if (!legacy) continue;
      const migrated = normalizeData(JSON.parse(legacy));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      return migrated;
    }
  } catch (error) {
    console.error("Could not load saved Teacher HQ data:", error);
  }
  return defaultData();
}

function normalizeData(data) {
  const normalized = data && typeof data === "object" ? data : defaultData();
  normalized.schemaVersion = 4;
  if (!Array.isArray(normalized.users)) normalized.users = [];
  if (!("activeUserId" in normalized)) normalized.activeUserId = null;
  normalized.users = normalized.users.map(normalizeUser);
  return normalized;
}

function normalizeUser(user) {
  const normalized = {
    ...user,
    id: user.id || makeId("user"),
    username: user.username || "User",
    profileColour: user.profileColour || "#33c7ff",
    profileImage: user.profileImage || null,
    customGrades: Array.isArray(user.customGrades) ? user.customGrades : [],
    customSubjects: Array.isArray(user.customSubjects) ? user.customSubjects : [],
    lastBackupDate: user.lastBackupDate || null,
    activeTermId: user.activeTermId || user.activeSchoolYearId || null,
    calendarExceptions: Array.isArray(user.calendarExceptions)
      ? user.calendarExceptions.map(normalizeException)
      : [],
    savedHolidayNames: Array.isArray(user.savedHolidayNames) ? user.savedHolidayNames.filter(Boolean) : [],
    units: Array.isArray(user.units) ? user.units.map(normalizeUnit) : []
  };

  if (!Array.isArray(user.terms)) {
    normalized.terms = [];
    if (Array.isArray(user.schoolYears)) {
      user.schoolYears.forEach(year => {
        const scheduleBlocks = Array.isArray(year.scheduleBlocks)
          ? year.scheduleBlocks.map(normalizeBlock)
          : [];
        normalized.terms.push(normalizeTerm({
          id: year.id || makeId("term"),
          name: year.name || "Imported School Term",
          startDate: year.startDate || "",
          endDate: year.endDate || "",
          createdAt: year.createdAt || new Date().toISOString(),
          updatedAt: year.updatedAt || new Date().toISOString(),
          scheduleVersions: [{
            id: makeId("schedule-version"),
            effectiveStart: year.startDate || "",
            effectiveEnd: year.endDate || "",
            createdAt: year.createdAt || new Date().toISOString(),
            scheduleBlocks
          }]
        }));
      });
    }
  } else {
    normalized.terms = user.terms.map(normalizeTerm);
  }

  normalized.terms.sort((a, b) => a.startDate.localeCompare(b.startDate));
  normalized.calendarExceptions.sort((a, b) => a.startDate.localeCompare(b.startDate));
  normalized.calendarExceptions
    .filter(item => item.type === "Holiday" && item.label)
    .forEach(item => {
      if (!normalized.savedHolidayNames.some(name => name.toLowerCase() === item.label.toLowerCase())) {
        normalized.savedHolidayNames.push(item.label);
      }
    });
  normalized.savedHolidayNames.sort((a, b) => a.localeCompare(b));
  assignMissingUnitColours(normalized);
  normalized.units.sort((a, b) => (a.startDate || "9999").localeCompare(b.startDate || "9999"));
  return normalized;
}

function normalizeTerm(term) {
  const normalized = {
    ...term,
    id: term.id || makeId("term"),
    name: term.name || "School Term",
    startDate: term.startDate || "",
    endDate: term.endDate || "",
    createdAt: term.createdAt || new Date().toISOString(),
    updatedAt: term.updatedAt || new Date().toISOString()
  };

  if (!Array.isArray(normalized.scheduleVersions)) {
    normalized.scheduleVersions = [{
      id: makeId("schedule-version"),
      effectiveStart: normalized.startDate,
      effectiveEnd: normalized.endDate,
      createdAt: normalized.createdAt,
      scheduleBlocks: Array.isArray(normalized.scheduleBlocks)
        ? normalized.scheduleBlocks.map(normalizeBlock)
        : []
    }];
  }

  normalized.scheduleVersions = normalized.scheduleVersions.map(version => ({
    id: version.id || makeId("schedule-version"),
    effectiveStart: version.effectiveStart || normalized.startDate,
    effectiveEnd: version.effectiveEnd || normalized.endDate,
    createdAt: version.createdAt || new Date().toISOString(),
    scheduleBlocks: Array.isArray(version.scheduleBlocks)
      ? version.scheduleBlocks.map(normalizeBlock)
      : []
  }));

  normalized.scheduleVersions.sort((a, b) => a.effectiveStart.localeCompare(b.effectiveStart));
  return normalized;
}

function normalizeBlock(block) {
  return {
    id: block.id || makeId("block"),
    repeatGroupId: block.repeatGroupId || makeId("repeat"),
    weekday: block.weekday || "Monday",
    startTime: block.startTime || "08:00",
    endTime: block.endTime || "09:00",
    blockType: block.blockType || "Other",
    label: block.label || "",
    grades: Array.isArray(block.grades) ? [...block.grades] : [],
    subject: block.subject || "",
    plannedDates: Array.isArray(block.plannedDates) ? [...block.plannedDates] : []
  };
}

function normalizeException(item) {
  const startDate = item.startDate || item.date || "";
  const endDate = item.endDate || startDate;
  return {
    id: item.id || makeId("day-off"),
    startDate,
    endDate: endDate < startDate ? startDate : endDate,
    date: startDate,
    type: ["Holiday", "PD Day", "Other"].includes(item.type) ? item.type : "Other",
    label: item.label || "",
    description: item.description || item.topic || "",
    notes: item.notes || "",
    location: item.location || "",
    createdAt: item.createdAt || new Date().toISOString(),
    updatedAt: item.updatedAt || new Date().toISOString()
  };
}

function normalizeUnit(unit) {
  const classSpec = unit.classSpec || {
    grades: Array.isArray(unit.grades) ? unit.grades : [],
    subject: unit.subject || ""
  };
  return {
    id: unit.id || makeId("unit"),
    name: unit.name || "Untitled Unit",
    classSpec: {
      grades: normalizeGradeArray(Array.isArray(classSpec.grades) ? classSpec.grades : []),
      subject: classSpec.subject || ""
    },
    colour: normalizeHexColour(unit.colour) || "",
    selectedCurriculum: Array.isArray(unit.selectedCurriculum) ? unit.selectedCurriculum : [],
    targetMinutes: Number(unit.targetMinutes) || 0,
    allocationMethod: unit.allocationMethod || "hours",
    allocationPercentage: Number(unit.allocationPercentage) || null,
    availableMinutesAtCreation: Number(unit.availableMinutesAtCreation) || 0,
    startDate: unit.startDate || "",
    lessons: Array.isArray(unit.lessons) ? unit.lessons.map(normalizeLesson) : [],
    createdAt: unit.createdAt || new Date().toISOString(),
    updatedAt: unit.updatedAt || new Date().toISOString(),
    needsScheduleReview: Boolean(unit.needsScheduleReview)
  };
}

function normalizeLesson(lesson) {
  const sequence = Number(lesson.sequence) || 1;
  const legacyTitle = String(lesson.title || "").trim();
  const inferredCustomTitle = legacyTitle && !/^Lesson\s+\d+$/i.test(legacyTitle) ? legacyTitle : "";
  return {
    id: lesson.id || makeId("lesson"),
    sequence,
    title: `Lesson ${sequence}`,
    customTitle: String(lesson.customTitle || inferredCustomTitle).trim(),
    dateKey: lesson.dateKey || "",
    startTime: lesson.startTime || "",
    endTime: lesson.endTime || "",
    durationMinutes: Number(lesson.durationMinutes) || 0,
    termId: lesson.termId || "",
    versionId: lesson.versionId || "",
    blockId: lesson.blockId || "",
    classSpec: lesson.classSpec || { grades: [], subject: "" },
    lessonPlanStatus: lesson.lessonPlanStatus || "placeholder",
    locked: Boolean(lesson.locked),
    createdAt: lesson.createdAt || new Date().toISOString()
  };
}

function saveData() {
  if (readOnlySource === "shared") return;
  appData.activeUserId = activeUserId;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
  } catch (error) {
    console.error("Could not save data:", error);
    alert("The browser could not save your changes. If you uploaded a very large profile picture, try a smaller image.");
  }
}

/* ============================================================
   GENERAL HELPERS
============================================================ */

function makeId(prefix = "item") {
  if (window.crypto && crypto.randomUUID) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function structuredCloneSafe(value) {
  if (window.structuredClone) return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function getActiveUser() {
  if (readOnlySource === "shared" && sharedReadOnlyUser) return sharedReadOnlyUser;
  return appData.users.find(user => user.id === activeUserId) || null;
}

function getTermById(termId, user = getActiveUser()) {
  return user?.terms?.find(term => term.id === termId) || null;
}

function getUnitById(unitId, user = getActiveUser()) {
  return user?.units?.find(unit => unit.id === unitId) || null;
}

function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseLocalDate(dateString) {
  if (!dateString) return new Date(NaN);
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addDaysToKey(dateKey, days) {
  const date = parseLocalDate(dateKey);
  date.setDate(date.getDate() + days);
  return getLocalDateKey(date);
}

function clampDateKey(dateKey, startKey, endKey) {
  if (dateKey < startKey) return startKey;
  if (dateKey > endKey) return endKey;
  return dateKey;
}

function isDateWithin(dateKey, startKey, endKey) {
  return Boolean(dateKey && startKey && endKey && dateKey >= startKey && dateKey <= endKey);
}

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(dateString) {
  if (!dateString) return "—";
  return parseLocalDate(dateString).toLocaleDateString("en-CA", {
    month: "short", day: "numeric", year: "numeric"
  });
}

function formatLongDate(dateString) {
  if (!dateString) return "—";
  return parseLocalDate(dateString).toLocaleDateString("en-CA", {
    weekday: "long", month: "long", day: "numeric", year: "numeric"
  });
}

function formatTime(time) {
  if (!time) return "";
  const [hours, minutes] = time.split(":").map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date.toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit" });
}

function timeToMinutes(time) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function durationMinutes(startTime, endTime) {
  return Math.max(0, timeToMinutes(endTime) - timeToMinutes(startTime));
}

function hoursLabel(minutes) {
  const hours = minutes / 60;
  return Number.isInteger(hours) ? `${hours} h` : `${Number(hours.toFixed(2))} h`;
}

function normalizeGradeArray(grades) {
  return [...new Set(grades.filter(Boolean))].sort((a, b) => gradeSortValue(a) - gradeSortValue(b) || a.localeCompare(b));
}

function gradeSortValue(grade) {
  if (grade === "Kindergarten" || grade === "K") return 0;
  const match = String(grade).match(/(\d+)/);
  return match ? Number(match[1]) : 100;
}

function gradeDisplay(grades) {
  const list = normalizeGradeArray(Array.isArray(grades) ? grades : []);
  if (list.length === 0) return "";
  if (list.length === 1) return list[0];
  const labels = list.map(grade => grade === "Kindergarten" ? "K" : grade.replace(/^Grade\s+/i, ""));
  return `Grade ${labels.join("/")}`;
}

function classKey(classSpec) {
  return `${normalizeGradeArray(classSpec?.grades || []).join("|")}::${String(classSpec?.subject || "").trim().toLowerCase()}`;
}

function classLabel(classSpec) {
  return `${gradeDisplay(classSpec?.grades || [])} ${classSpec?.subject || ""}`.trim();
}

function classMatches(block, classSpec) {
  if (!block || !classSpec || block.blockType !== "Instructional Time") return false;
  return classKey({ grades: block.grades, subject: block.subject }) === classKey(classSpec);
}

function parseManualGrades(value) {
  const text = String(value || "").trim();
  if (!text) return [];
  if (/^k(indergarten)?$/i.test(text)) return ["Kindergarten"];
  const slashMatch = text.match(/^(?:grade\s*)?([k\d]+(?:\s*\/\s*[k\d]+)+)$/i);
  if (slashMatch) {
    return normalizeGradeArray(slashMatch[1].split("/").map(part => {
      const clean = part.trim();
      return /^k$/i.test(clean) ? "Kindergarten" : `Grade ${Number(clean)}`;
    }));
  }
  const number = text.match(/^(?:grade\s*)?(\d+)$/i);
  if (number) return [`Grade ${Number(number[1])}`];
  return [text];
}

function termsForDate(dateKey, user = getActiveUser()) {
  return user?.terms?.filter(term => isDateWithin(dateKey, term.startDate, term.endDate)) || [];
}

function getScheduleVersionForDate(term, dateKey) {
  if (!term?.scheduleVersions) return null;
  return term.scheduleVersions
    .filter(version => isDateWithin(dateKey, version.effectiveStart, version.effectiveEnd))
    .sort((a, b) => a.effectiveStart.localeCompare(b.effectiveStart))
    .at(-1) || null;
}

function getLatestScheduleVersion(term) {
  return [...(term?.scheduleVersions || [])]
    .sort((a, b) => a.effectiveStart.localeCompare(b.effectiveStart))
    .at(-1) || null;
}

function getDisplayVersion(term) {
  const todayKey = getLocalDateKey();
  if (isDateWithin(todayKey, term.startDate, term.endDate)) return getScheduleVersionForDate(term, todayKey) || getLatestScheduleVersion(term);
  if (todayKey < term.startDate) return getScheduleVersionForDate(term, term.startDate) || getLatestScheduleVersion(term);
  return getScheduleVersionForDate(term, term.endDate) || getLatestScheduleVersion(term);
}

function scheduleFingerprint(blocks) {
  const cleaned = blocks.map(block => ({
    weekday: block.weekday,
    startTime: block.startTime,
    endTime: block.endTime,
    blockType: block.blockType,
    label: block.label,
    grades: normalizeGradeArray(block.grades || []),
    subject: block.subject
  })).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  return JSON.stringify(cleaned);
}

function timesOverlap(blockA, blockB) {
  return timeToMinutes(blockA.startTime) < timeToMinutes(blockB.endTime) &&
    timeToMinutes(blockB.startTime) < timeToMinutes(blockA.endTime);
}

function blockTypeClass(blockTypeValue) {
  switch (blockTypeValue) {
    case "Admin": return "block-admin";
    case "Prep / Planning": return "block-prep";
    case "Recess": return "block-recess";
    case "Lunch": return "block-lunch";
    case "Duty / Supervision": return "block-duty";
    case "Instructional Time": return "block-instructional-unplanned";
    default: return "block-other";
  }
}

function getExceptionForDate(user, dateKey) {
  return user?.calendarExceptions?.find(item =>
    dateKey >= (item.startDate || item.date || "") &&
    dateKey <= (item.endDate || item.startDate || item.date || "")
  ) || null;
}

function isNoSchoolDate(user, dateKey) {
  return Boolean(getExceptionForDate(user, dateKey));
}

function exceptionDateLabel(item) {
  const start = item.startDate || item.date || "";
  const end = item.endDate || start;
  return start === end ? formatDate(start) : `${formatDate(start)} – ${formatDate(end)}`;
}

function rangesOverlap(startA, endA, startB, endB) {
  return startA <= endB && startB <= endA;
}

function normalizeHexColour(value) {
  const text = String(value || "").trim().toUpperCase();
  return /^#[0-9A-F]{6}$/.test(text) ? text : "";
}

function unitColourUsedByClass(user, classSpec, colour, excludeUnitId = null) {
  const normalizedColour = normalizeHexColour(colour);
  if (!normalizedColour) return false;
  const key = classKey(classSpec);
  return Boolean(user?.units?.some(unit =>
    unit.id !== excludeUnitId &&
    classKey(unit.classSpec) === key &&
    normalizeHexColour(unit.colour) === normalizedColour
  ));
}

function suggestedUnitColour(user, classSpec, excludeUnitId = null, afterColour = null) {
  const used = new Set((user?.units || [])
    .filter(unit => unit.id !== excludeUnitId && classKey(unit.classSpec) === classKey(classSpec))
    .map(unit => normalizeHexColour(unit.colour))
    .filter(Boolean));

  const normalizedAfter = normalizeHexColour(afterColour);
  const startIndex = normalizedAfter ? Math.max(0, FUN_UNIT_COLOURS.indexOf(normalizedAfter) + 1) : 0;
  for (let offset = 0; offset < FUN_UNIT_COLOURS.length; offset++) {
    const colour = FUN_UNIT_COLOURS[(startIndex + offset) % FUN_UNIT_COLOURS.length];
    if (!used.has(colour)) return colour;
  }

  let seed = (user?.units?.length || 0) + 1;
  while (seed < 360) {
    const hue = (seed * 47) % 360;
    const colour = hslToHex(hue, 88, 62);
    if (!used.has(colour)) return colour;
    seed++;
  }
  return "#FF5F8F";
}

function assignMissingUnitColours(user) {
  (user?.units || []).forEach(unit => {
    if (!normalizeHexColour(unit.colour) || unitColourUsedByClass(user, unit.classSpec, unit.colour, unit.id)) {
      unit.colour = suggestedUnitColour(user, unit.classSpec, unit.id);
    }
  });
}

function hslToHex(h, s, l) {
  s /= 100;
  l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g] = [c, x];
  else if (h < 120) [r, g] = [x, c];
  else if (h < 180) [g, b] = [c, x];
  else if (h < 240) [g, b] = [x, c];
  else if (h < 300) [r, b] = [x, c];
  else [r, b] = [c, x];
  const hex = value => Math.round((value + m) * 255).toString(16).padStart(2, "0").toUpperCase();
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

function hexToRgba(hex, alpha) {
  const value = normalizeHexColour(hex) || "#8C6CFF";
  const r = parseInt(value.slice(1, 3), 16);
  const g = parseInt(value.slice(3, 5), 16);
  const b = parseInt(value.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function lessonDisplayTitle(lesson) {
  const sequence = Number(lesson?.sequence) || 1;
  const custom = String(lesson?.customTitle || "").trim();
  return custom ? `${sequence} - ${custom}` : `Lesson ${sequence}`;
}

/* ============================================================
   INITIALIZATION / VIEW SWITCHING
============================================================ */

function initializeApp() {
  appData = normalizeData(appData);
  saveData();
  renderProfileSelection();
  if (activeUserId && getActiveUser()) showTeacherHQ();
  else showUserSelection();
}

function showUserSelection() {
  if (readOnlySource === "shared") exitReadView();
  teacherHQView.classList.add("hidden");
  userSelectionView.classList.remove("hidden");
  renderProfileSelection();
}

function showTeacherHQ() {
  const user = getActiveUser();
  if (!user) {
    activeUserId = null;
    saveData();
    showUserSelection();
    return;
  }
  userSelectionView.classList.add("hidden");
  teacherHQView.classList.remove("hidden");
  renderCurrentUser();
  renderTeacherHQ();
}

function renderTeacherHQ() {
  const user = getActiveUser();
  if (!user) return;
  renderActiveTermsLabel(user);
  renderCalendar();
  renderTermSummaries(user);
  renderTermsList(user);
  renderWeeklyInstructionalBlocks(user);
  renderUnitOverview(user);
  renderBackupState(user);
  renderPDAttention(user);
  applyReadOnlyUI();
}

function applyReadOnlyUI() {
  document.body.classList.toggle("read-only", readOnlyMode);
  readOnlyBanner.classList.toggle("hidden", !readOnlyMode);
  $("previewReadViewButton").textContent = readOnlySource === "preview" ? "Exit Read View" : "Preview Read View";
}

/* ============================================================
   USER PROFILES
============================================================ */

function renderProfileSelection() {
  profileList.innerHTML = "";
  if (appData.users.length === 0) {
    const message = document.createElement("p");
    message.className = "section-subtitle";
    message.textContent = "No profiles yet. Create the first one to get started.";
    profileList.appendChild(message);
    return;
  }

  appData.users.forEach(user => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "profile-card";
    const avatar = document.createElement("div");
    avatar.className = "profile-avatar";
    renderAvatar(avatar, user);
    const name = document.createElement("p");
    name.className = "profile-name";
    name.textContent = user.username;
    card.append(avatar, name);
    card.addEventListener("click", () => {
      activeUserId = user.id;
      readOnlyMode = false;
      readOnlySource = null;
      saveData();
      showTeacherHQ();
    });
    profileList.appendChild(card);
  });
}

function renderAvatar(container, user) {
  container.innerHTML = "";
  container.style.background = "";
  if (user.profileImage) {
    const image = document.createElement("img");
    image.src = user.profileImage;
    image.alt = `${user.username} profile`;
    container.appendChild(image);
    return;
  }
  container.style.background = user.profileColour || "#33c7ff";
  const initial = document.createElement("div");
  initial.className = "avatar-initial";
  initial.textContent = user.username?.trim()?.charAt(0)?.toUpperCase() || "?";
  container.appendChild(initial);
}

function renderCurrentUser() {
  const user = getActiveUser();
  if (!user) return;
  currentUsername.textContent = user.username;
  renderAvatar(currentUserAvatar, user);
  $("switchUserButton").textContent = readOnlySource === "shared" ? "Exit Read View" : "Switch User";
}

$("createUserButton").addEventListener("click", () => {
  createUserForm.reset();
  selectedProfileColour = "#33c7ff";
  document.querySelectorAll(".colour-choice").forEach(choice => {
    choice.classList.toggle("selected", choice.dataset.colour === selectedProfileColour);
  });
  createUserDialog.showModal();
});

$("closeCreateUserButton").addEventListener("click", () => createUserDialog.close());
$("cancelCreateUserButton").addEventListener("click", () => createUserDialog.close());

$("switchUserButton").addEventListener("click", () => {
  if (readOnlySource === "shared") {
    exitReadView();
    showUserSelection();
    return;
  }
  activeUserId = null;
  readOnlyMode = false;
  readOnlySource = null;
  saveData();
  showUserSelection();
});

document.querySelectorAll(".colour-choice").forEach(button => {
  button.addEventListener("click", () => {
    selectedProfileColour = button.dataset.colour;
    document.querySelectorAll(".colour-choice").forEach(choice => choice.classList.remove("selected"));
    button.classList.add("selected");
  });
});

createUserForm.addEventListener("submit", async event => {
  event.preventDefault();
  const username = newUsername.value.trim();
  if (!username) return;
  if (appData.users.some(user => user.username.toLowerCase() === username.toLowerCase())) {
    alert("That username already exists.");
    return;
  }

  let profileImage = null;
  const file = profileImageInput.files?.[0];
  if (file) {
    try { profileImage = await resizeImageForStorage(file); }
    catch (error) { console.error(error); }
  }

  const user = normalizeUser({
    id: makeId("user"), username, profileColour: selectedProfileColour, profileImage,
    createdAt: new Date().toISOString(), customGrades: [], customSubjects: [],
    terms: [], calendarExceptions: [], savedHolidayNames: [], units: [], lastBackupDate: null
  });
  appData.users.push(user);
  activeUserId = user.id;
  saveData();
  createUserDialog.close();
  showTeacherHQ();
});

function resizeImageForStorage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = event => {
      const image = new Image();
      image.onerror = reject;
      image.onload = () => {
        const size = 220;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext("2d");
        const sourceSize = Math.min(image.width, image.height);
        const sourceX = (image.width - sourceSize) / 2;
        const sourceY = (image.height - sourceSize) / 2;
        context.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, size, size);
        resolve(canvas.toDataURL("image/jpeg", 0.78));
      };
      image.src = event.target.result;
    };
    reader.readAsDataURL(file);
  });
}

/* ============================================================
   SCHOOL TERMS + SCHEDULE HISTORY
============================================================ */

function renderActiveTermsLabel(user) {
  const label = $("activeTermsLabel");
  const todayKey = getLocalDateKey();
  const active = termsForDate(todayKey, user);
  if (user.terms.length === 0) {
    label.textContent = "No school terms yet.";
  } else if (active.length === 0) {
    label.textContent = `${user.terms.length} saved school term${user.terms.length === 1 ? "" : "s"}.`;
  } else if (active.length === 1) {
    label.textContent = `Current term: ${active[0].name}`;
  } else {
    label.textContent = `${active.length} school terms are active today.`;
  }
}

$("addTermButton").addEventListener("click", () => openTermDialog());
$("closeTermButton").addEventListener("click", closeTermDialog);
$("cancelTermButton").addEventListener("click", closeTermDialog);
$("saveTermButton").addEventListener("click", saveTerm);
$("addScheduleBlockButton").addEventListener("click", () => openScheduleBlockDialog());

function openTermDialog(termId = null) {
  const user = getActiveUser();
  if (!user || readOnlyMode) return;

  editingTermId = termId;
  workingScheduleBlocks = [];
  baseScheduleBlocks = [];

  const heading = $("termDialogHeading");
  const subtitle = $("termDialogSubtitle");
  const effectiveField = $("effectiveDateField");
  const termStartInput = $("termStart");

  if (!termId) {
    workingTerm = normalizeTerm({
      id: makeId("term"), name: "", startDate: "", endDate: "",
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), scheduleVersions: []
    });
    workingTerm.scheduleVersions = [];
    heading.textContent = "Add School Term";
    subtitle.textContent = "Add a date range and its standard weekly schedule.";
    $("termName").value = "";
    termStartInput.value = "";
    termStartInput.disabled = false;
    $("termEnd").value = "";
    effectiveField.classList.add("hidden");
  } else {
    const existing = getTermById(termId, user);
    if (!existing) return;
    workingTerm = structuredCloneSafe(existing);
    const displayVersion = getDisplayVersion(existing);
    workingScheduleBlocks = structuredCloneSafe(displayVersion?.scheduleBlocks || []);
    baseScheduleBlocks = structuredCloneSafe(displayVersion?.scheduleBlocks || []);

    heading.textContent = "Edit School Term";
    subtitle.textContent = "If the schedule has already started, changes become a new version instead of rewriting previous dates.";
    $("termName").value = existing.name;
    termStartInput.value = existing.startDate;
    $("termEnd").value = existing.endDate;

    const todayKey = getLocalDateKey();
    const started = existing.startDate <= todayKey;
    termStartInput.disabled = started;
    const latest = getLatestScheduleVersion(existing);
    const effectiveDefault = started
      ? clampDateKey(todayKey, latest?.effectiveStart || existing.startDate, existing.endDate)
      : existing.startDate;
    $("scheduleEffectiveDate").value = effectiveDefault;
    $("scheduleEffectiveDate").min = started ? latest?.effectiveStart || existing.startDate : existing.startDate;
    $("scheduleEffectiveDate").max = existing.endDate;
    effectiveField.classList.remove("hidden");
  }

  renderScheduleBuilder();
  termDialog.showModal();
}

function closeTermDialog() {
  termDialog.close();
  workingTerm = null;
  editingTermId = null;
  workingScheduleBlocks = [];
  baseScheduleBlocks = [];
}

function saveTerm() {
  const user = getActiveUser();
  if (!user || !workingTerm || readOnlyMode) return;

  const name = $("termName").value.trim();
  const existing = editingTermId ? getTermById(editingTermId, user) : null;
  const startDate = existing && existing.startDate <= getLocalDateKey()
    ? existing.startDate
    : $("termStart").value;
  const endDate = $("termEnd").value;

  if (!name || !startDate || !endDate) {
    alert("Please enter the term name, start date and end date.");
    return;
  }
  if (endDate < startDate) {
    alert("The term end date must be on or after the start date.");
    return;
  }

  let reflowFrom = null;

  if (!existing) {
    const term = normalizeTerm({
      id: workingTerm.id,
      name,
      startDate,
      endDate,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      scheduleVersions: [{
        id: makeId("schedule-version"),
        effectiveStart: startDate,
        effectiveEnd: endDate,
        createdAt: new Date().toISOString(),
        scheduleBlocks: structuredCloneSafe(workingScheduleBlocks)
      }]
    });
    user.terms.push(term);
    user.activeTermId = term.id;
    reflowFrom = startDate;
  } else {
    existing.name = name;
    existing.endDate = endDate;
    existing.updatedAt = new Date().toISOString();

    const scheduleChanged = scheduleFingerprint(baseScheduleBlocks) !== scheduleFingerprint(workingScheduleBlocks);
    if (scheduleChanged) {
      let effectiveDate = $("scheduleEffectiveDate").value || existing.startDate;
      const todayKey = getLocalDateKey();
      if (existing.startDate <= todayKey && effectiveDate < todayKey) effectiveDate = todayKey;
      effectiveDate = clampDateKey(effectiveDate, existing.startDate, endDate);
      applyScheduleRevision(existing, effectiveDate, workingScheduleBlocks);
      reflowFrom = effectiveDate;
    } else {
      const latest = getLatestScheduleVersion(existing);
      if (latest) latest.effectiveEnd = endDate;
    }
    user.activeTermId = existing.id;
  }

  user.terms.sort((a, b) => a.startDate.localeCompare(b.startDate));
  if (reflowFrom) reconcileFutureUnits(user, reflowFrom);
  saveData();
  closeTermDialog();
  renderTeacherHQ();
}

function applyScheduleRevision(term, effectiveDate, blocks) {
  const versions = term.scheduleVersions.sort((a, b) => a.effectiveStart.localeCompare(b.effectiveStart));
  const activeVersion = getScheduleVersionForDate(term, effectiveDate) ||
    versions.filter(version => version.effectiveStart <= effectiveDate).at(-1) || versions[0];

  term.scheduleVersions = term.scheduleVersions.filter(version =>
    version.effectiveStart < effectiveDate || version.id === activeVersion?.id
  );

  if (activeVersion && effectiveDate > activeVersion.effectiveStart) {
    activeVersion.effectiveEnd = addDaysToKey(effectiveDate, -1);
  } else if (activeVersion && effectiveDate === activeVersion.effectiveStart) {
    term.scheduleVersions = term.scheduleVersions.filter(version => version.id !== activeVersion.id);
  }

  term.scheduleVersions.push({
    id: makeId("schedule-version"),
    effectiveStart: effectiveDate,
    effectiveEnd: term.endDate,
    createdAt: new Date().toISOString(),
    scheduleBlocks: cloneBlocksForNewVersion(blocks, effectiveDate)
  });
  term.scheduleVersions.sort((a, b) => a.effectiveStart.localeCompare(b.effectiveStart));
}

function cloneBlocksForNewVersion(blocks, effectiveDate) {
  const groupMap = new Map();
  return blocks.map(block => {
    const oldGroup = block.repeatGroupId || block.id;
    if (!groupMap.has(oldGroup)) groupMap.set(oldGroup, makeId("repeat"));
    return {
      ...structuredCloneSafe(block),
      id: makeId("block"),
      repeatGroupId: groupMap.get(oldGroup),
      plannedDates: (block.plannedDates || []).filter(dateKey => dateKey >= effectiveDate)
    };
  });
}

function renderTermSummaries(user) {
  const container = $("termSummaryList");
  container.innerHTML = "";
  const todayKey = getLocalDateKey();
  user.terms.forEach(term => {
    const card = document.createElement("div");
    card.className = "term-summary-card";
    if (isDateWithin(todayKey, term.startDate, term.endDate)) card.classList.add("current");
    if (term.endDate < todayKey) card.classList.add("past-term");
    const name = document.createElement("strong");
    name.textContent = term.name;
    const meta = document.createElement("div");
    meta.className = "term-summary-meta";
    meta.textContent = `${formatDate(term.startDate)} – ${formatDate(term.endDate)} · ${term.scheduleVersions.length} schedule version${term.scheduleVersions.length === 1 ? "" : "s"}`;
    card.append(name, meta);
    container.appendChild(card);
  });
}

function renderTermsList(user) {
  const section = $("termsSection");
  const container = $("termsList");
  container.innerHTML = "";
  if (user.terms.length === 0) {
    section.classList.add("hidden");
    return;
  }
  section.classList.remove("hidden");

  user.terms.forEach(term => {
    const card = document.createElement("div");
    card.className = "term-card";
    const info = document.createElement("div");
    const name = document.createElement("strong");
    name.textContent = term.name;
    const meta = document.createElement("div");
    meta.className = "term-meta";
    meta.textContent = `${formatDate(term.startDate)} – ${formatDate(term.endDate)} · ${term.scheduleVersions.length} schedule version${term.scheduleVersions.length === 1 ? "" : "s"}`;
    info.append(name, meta);
    card.appendChild(info);
    if (!readOnlyMode) {
      const actions = document.createElement("div");
      actions.className = "term-card-actions edit-only";
      const edit = document.createElement("button");
      edit.type = "button";
      edit.className = "secondary-button";
      edit.textContent = "Edit Term";
      edit.addEventListener("click", () => openTermDialog(term.id));
      actions.appendChild(edit);
      card.appendChild(actions);
    }
    container.appendChild(card);
  });
}

/* ============================================================
   SCHEDULE BLOCK EDITOR
============================================================ */

$("closeScheduleBlockButton").addEventListener("click", () => scheduleBlockDialog.close());
$("cancelScheduleBlockButton").addEventListener("click", () => scheduleBlockDialog.close());
blockType.addEventListener("change", updateInstructionalVisibility);
splitClassCheckbox.addEventListener("change", updateSplitGradeVisibility);

function getAvailableGrades(user) {
  return [...DEFAULT_GRADES, ...(user?.customGrades || [])];
}

function getAvailableSubjects(user) {
  return [...DEFAULT_SUBJECTS, ...(user?.customSubjects || [])];
}

function populateGradeAndSubjectSelectors() {
  const user = getActiveUser();
  if (!user) return;
  const currentGrade = blockGrade.value;
  const currentSubject = blockSubject.value;
  blockGrade.innerHTML = '<option value="">Select grade</option>';
  getAvailableGrades(user).forEach(grade => {
    const option = document.createElement("option");
    option.value = grade;
    option.textContent = grade;
    blockGrade.appendChild(option);
  });
  blockSubject.innerHTML = '<option value="">Select subject</option>';
  getAvailableSubjects(user).forEach(subject => {
    const option = document.createElement("option");
    option.value = subject;
    option.textContent = subject;
    blockSubject.appendChild(option);
  });
  if ([...blockGrade.options].some(option => option.value === currentGrade)) blockGrade.value = currentGrade;
  if ([...blockSubject.options].some(option => option.value === currentSubject)) blockSubject.value = currentSubject;
  populateSplitGradeChoices();
}

function populateSplitGradeChoices() {
  const user = getActiveUser();
  if (!user) return;
  const selected = Array.from(splitGradeChoices.querySelectorAll('input[type="checkbox"]:checked')).map(input => input.value);
  splitGradeChoices.innerHTML = "";
  getAvailableGrades(user).forEach(grade => {
    const label = document.createElement("label");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = grade;
    checkbox.checked = selected.includes(grade);
    label.append(checkbox, document.createTextNode(grade));
    splitGradeChoices.appendChild(label);
  });
}

function openScheduleBlockDialog(blockId = null) {
  const user = getActiveUser();
  if (!user || readOnlyMode) return;
  populateGradeAndSubjectSelectors();
  scheduleBlockForm.reset();
  editingScheduleBlockId = blockId;
  $("scheduleBlockHeading").textContent = blockId ? "Edit Block" : "Add Block";

  blockDayChoices.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
    checkbox.checked = checkbox.value === "Monday";
  });
  $("blockStartTime").value = "08:00";
  $("blockEndTime").value = "09:00";

  if (blockId) {
    const block = workingScheduleBlocks.find(item => item.id === blockId);
    if (!block) return;
    const related = block.repeatGroupId
      ? workingScheduleBlocks.filter(item => item.repeatGroupId === block.repeatGroupId)
      : [block];
    const selectedDays = related.map(item => item.weekday);
    blockDayChoices.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
      checkbox.checked = selectedDays.includes(checkbox.value);
    });
    $("blockStartTime").value = block.startTime;
    $("blockEndTime").value = block.endTime;
    blockType.value = block.blockType;
    $("blockLabel").value = block.label || "";
    blockSubject.value = block.subject || "";
    const grades = block.grades || [];
    if (grades.length > 1) {
      splitClassCheckbox.checked = true;
      populateSplitGradeChoices();
      splitGradeChoices.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
        checkbox.checked = grades.includes(checkbox.value);
      });
    } else {
      splitClassCheckbox.checked = false;
      blockGrade.value = grades[0] || "";
    }
  }

  updateInstructionalVisibility();
  updateSplitGradeVisibility();
  scheduleBlockDialog.showModal();
}

function updateInstructionalVisibility() {
  instructionalOptions.classList.toggle("hidden", blockType.value !== "Instructional Time");
}

function updateSplitGradeVisibility() {
  const split = splitClassCheckbox.checked;
  splitGradeArea.classList.toggle("hidden", !split);
  blockGrade.closest(".form-field").classList.toggle("hidden", split);
  if (split) populateSplitGradeChoices();
}

$("addCustomGradeButton").addEventListener("click", () => {
  const user = getActiveUser();
  if (!user) return;
  const value = prompt("Enter the grade or class name:")?.trim();
  if (!value) return;
  if (!getAvailableGrades(user).some(grade => grade.toLowerCase() === value.toLowerCase())) user.customGrades.push(value);
  saveData();
  populateGradeAndSubjectSelectors();
  blockGrade.value = value;
});

$("addCustomSubjectButton").addEventListener("click", () => {
  const user = getActiveUser();
  if (!user) return;
  const value = prompt("Enter the subject name:")?.trim();
  if (!value) return;
  if (!getAvailableSubjects(user).some(subject => subject.toLowerCase() === value.toLowerCase())) user.customSubjects.push(value);
  saveData();
  populateGradeAndSubjectSelectors();
  blockSubject.value = value;
});

scheduleBlockForm.addEventListener("submit", event => {
  event.preventDefault();
  const selectedDays = Array.from(blockDayChoices.querySelectorAll('input[type="checkbox"]:checked')).map(checkbox => checkbox.value);
  if (selectedDays.length === 0) return alert("Please select at least one day.");

  const startTime = $("blockStartTime").value;
  const endTime = $("blockEndTime").value;
  const selectedBlockType = blockType.value;
  const label = $("blockLabel").value.trim();
  if (!startTime || !endTime) return alert("Please enter a start and end time.");
  if (endTime <= startTime) return alert("The block end time must be after the start time.");

  let grades = [];
  let subject = "";
  if (selectedBlockType === "Instructional Time") {
    subject = blockSubject.value;
    if (splitClassCheckbox.checked) {
      grades = Array.from(splitGradeChoices.querySelectorAll('input[type="checkbox"]:checked')).map(input => input.value);
      if (grades.length < 2) return alert("A split class needs at least two grades.");
    } else if (blockGrade.value) {
      grades = [blockGrade.value];
    }
    if (grades.length === 0) return alert("Please select a grade.");
    if (!subject) return alert("Please select a subject.");
  }

  let repeatGroupId = makeId("repeat");
  let plannedDates = [];
  if (editingScheduleBlockId) {
    const existingBlock = workingScheduleBlocks.find(item => item.id === editingScheduleBlockId);
    if (existingBlock?.repeatGroupId) {
      repeatGroupId = existingBlock.repeatGroupId;
      const groupPlannedDates = new Set();
      workingScheduleBlocks.filter(item => item.repeatGroupId === repeatGroupId)
        .forEach(item => (item.plannedDates || []).forEach(dateKey => groupPlannedDates.add(dateKey)));
      plannedDates = [...groupPlannedDates];
      workingScheduleBlocks = workingScheduleBlocks.filter(item => item.repeatGroupId !== repeatGroupId);
    } else {
      plannedDates = [...(existingBlock?.plannedDates || [])];
      workingScheduleBlocks = workingScheduleBlocks.filter(item => item.id !== editingScheduleBlockId);
    }
  }

  selectedDays.forEach(weekday => {
    workingScheduleBlocks.push(normalizeBlock({
      id: makeId("block"), repeatGroupId, weekday, startTime, endTime,
      blockType: selectedBlockType, label, grades: [...grades], subject, plannedDates: [...plannedDates]
    }));
  });
  sortScheduleBlocks(workingScheduleBlocks);
  renderScheduleBuilder();
  scheduleBlockDialog.close();
  editingScheduleBlockId = null;
});

function sortScheduleBlocks(blocks) {
  blocks.sort((a, b) => {
    const dayDifference = WEEKDAYS.indexOf(a.weekday) - WEEKDAYS.indexOf(b.weekday);
    return dayDifference !== 0 ? dayDifference : a.startTime.localeCompare(b.startTime);
  });
}

function renderScheduleBuilder() {
  WEEKDAYS.forEach(day => {
    const container = $(`${day}Blocks`);
    if (!container) return;
    container.innerHTML = "";
    const blocks = workingScheduleBlocks.filter(block => block.weekday === day);
    if (blocks.length === 0) {
      const empty = document.createElement("p");
      empty.className = "section-subtitle mini-empty";
      empty.textContent = "No blocks";
      container.appendChild(empty);
      return;
    }
    blocks.forEach(block => container.appendChild(createScheduleBlockElement(block, true)));
  });
}

function createScheduleBlockElement(block, editable, status = null) {
  const element = document.createElement("div");
  element.className = `schedule-block ${blockTypeClass(block.blockType)}`;
  if (block.blockType === "Instructional Time" && status) {
    element.classList.remove("block-instructional-unplanned");
    element.classList.add(status === "planned" ? "block-instructional-planned" : "block-instructional-unplanned");
  }

  const time = document.createElement("div");
  time.className = "schedule-block-time";
  time.textContent = `${formatTime(block.startTime)} – ${formatTime(block.endTime)}`;
  const title = document.createElement("div");
  title.className = "schedule-block-title";
  title.textContent = block.blockType === "Instructional Time"
    ? `${gradeDisplay(block.grades)} ${block.subject}`.trim()
    : block.label || block.blockType;
  element.append(time, title);

  if (block.label && block.blockType === "Instructional Time") {
    const detail = document.createElement("div");
    detail.className = "schedule-block-detail";
    detail.textContent = block.label;
    element.appendChild(detail);
  }

  if (editable) {
    const actions = document.createElement("div");
    actions.className = "schedule-block-actions";
    const edit = document.createElement("button");
    edit.type = "button";
    edit.textContent = "Edit";
    edit.addEventListener("click", () => openScheduleBlockDialog(block.id));
    const del = document.createElement("button");
    del.type = "button";
    del.textContent = "Delete";
    del.addEventListener("click", () => {
      if (!confirm("Delete this repeating schedule block?")) return;
      workingScheduleBlocks = workingScheduleBlocks.filter(item => block.repeatGroupId ? item.repeatGroupId !== block.repeatGroupId : item.id !== block.id);
      renderScheduleBuilder();
    });
    actions.append(edit, del);
    element.appendChild(actions);
  }
  return element;
}

/* ============================================================
   DAYS OFF / HOLIDAYS / PD DAYS
============================================================ */

$("manageDaysOffButton").addEventListener("click", openDaysOffDialog);
$("pdAlertButton").addEventListener("click", openDaysOffDialog);
$("closeDaysOffButton").addEventListener("click", () => daysOffDialog.close());
$("cancelDayOffEditButton").addEventListener("click", resetDayOffForm);
$("dayOffPDYes").addEventListener("change", updateDayOffFlow);
$("dayOffPDNo").addEventListener("change", updateDayOffFlow);
$("dayOffHolidayChoice").addEventListener("change", updateDayOffFlow);
$("dayOffOtherChoice").addEventListener("change", updateDayOffFlow);
$("dayOffStartDate").addEventListener("change", () => {
  if (!$("dayOffEndDate").value || $("dayOffEndDate").value < $("dayOffStartDate").value) {
    $("dayOffEndDate").value = $("dayOffStartDate").value;
  }
  $("dayOffEndDate").min = $("dayOffStartDate").value;
});
$("searchPDLocationButton").addEventListener("click", () => {
  const query = $("pdLocation").value.trim();
  if (!query) return alert("Enter a location first, then Teacher HQ can search it in Google Maps.");
  window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`, "_blank", "noopener,noreferrer");
});

dayOffForm.addEventListener("submit", event => {
  event.preventDefault();
  const user = getActiveUser();
  if (!user || readOnlyMode) return;

  const type = dayOffType.value;
  const startDate = $("dayOffStartDate").value;
  const endDate = $("dayOffEndDate").value || startDate;
  if (!type) return alert("Please tell Teacher HQ whether this is a PD Day, Holiday, or Other day off.");
  if (!startDate || !endDate) return alert("Please choose the start and end date.");
  if (endDate < startDate) return alert("The end date cannot be before the start date.");

  const overlap = user.calendarExceptions.find(item =>
    item.id !== editingDayOffId &&
    rangesOverlap(startDate, endDate, item.startDate || item.date, item.endDate || item.startDate || item.date)
  );
  if (overlap) {
    return alert(`Those dates overlap with ${overlap.label || overlap.type} (${exceptionDateLabel(overlap)}). Edit the existing entry or choose a different range.`);
  }

  const label = type === "PD Day" ? "PD Day" : $("dayOffLabel").value.trim();
  const description = type === "PD Day" ? $("pdDescription").value.trim() : $("dayOffDescription").value.trim();
  const notes = type === "PD Day" ? "" : $("dayOffNotes").value.trim();
  const location = type === "PD Day" ? $("pdLocation").value.trim() : "";
  const previousException = editingDayOffId
    ? user.calendarExceptions.find(item => item.id === editingDayOffId)
    : null;
  const previousStartDate = previousException?.startDate || previousException?.date || startDate;
  const payload = normalizeException({
    id: editingDayOffId || makeId("day-off"),
    startDate, endDate, type, label, description, notes, location,
    createdAt: previousException?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  if (editingDayOffId) {
    const index = user.calendarExceptions.findIndex(item => item.id === editingDayOffId);
    if (index >= 0) user.calendarExceptions[index] = payload;
  } else {
    user.calendarExceptions.push(payload);
  }

  if (type === "Holiday" && label && !user.savedHolidayNames.some(name => name.toLowerCase() === label.toLowerCase())) {
    user.savedHolidayNames.push(label);
    user.savedHolidayNames.sort((a, b) => a.localeCompare(b));
  }

  user.calendarExceptions.sort((a, b) => a.startDate.localeCompare(b.startDate));
  reconcileFutureUnits(user, previousStartDate < startDate ? previousStartDate : startDate);
  saveData();
  resetDayOffForm();
  populateHolidayNameSuggestions(user);
  renderDaysOffList(user);
  renderTeacherHQ();
});

function openDaysOffDialog() {
  const user = getActiveUser();
  if (!user || readOnlyMode) return;
  resetDayOffForm();
  populateHolidayNameSuggestions(user);
  renderDaysOffList(user);
  daysOffDialog.showModal();
}

function resetDayOffForm() {
  editingDayOffId = null;
  dayOffForm.reset();
  $("dayOffId").value = "";
  dayOffType.value = "";
  $("dayOffEndDate").min = "";
  nonPDTypeFields.classList.add("hidden");
  dayOffDetailsFields.classList.add("hidden");
  pdFields.classList.add("hidden");
  nonPDFields.classList.add("hidden");
  $("holidayNameHint").classList.add("hidden");
  $("cancelDayOffEditButton").classList.add("hidden");
  $("saveDayOffButton").textContent = "Save Days";
}

function updateDayOffFlow() {
  const pdChoice = document.querySelector('input[name="dayOffIsPD"]:checked')?.value || "";
  if (!pdChoice) {
    dayOffType.value = "";
    nonPDTypeFields.classList.add("hidden");
    dayOffDetailsFields.classList.add("hidden");
    return;
  }

  if (pdChoice === "yes") {
    dayOffType.value = "PD Day";
    nonPDTypeFields.classList.add("hidden");
    dayOffDetailsFields.classList.remove("hidden");
    pdFields.classList.remove("hidden");
    nonPDFields.classList.add("hidden");
    return;
  }

  nonPDTypeFields.classList.remove("hidden");
  const nonPDChoice = document.querySelector('input[name="dayOffNonPDType"]:checked')?.value || "";
  dayOffType.value = nonPDChoice;
  if (!nonPDChoice) {
    dayOffDetailsFields.classList.add("hidden");
    pdFields.classList.add("hidden");
    nonPDFields.classList.add("hidden");
    return;
  }

  dayOffDetailsFields.classList.remove("hidden");
  pdFields.classList.add("hidden");
  nonPDFields.classList.remove("hidden");
  $("holidayNameHint").classList.toggle("hidden", nonPDChoice !== "Holiday");
}

function populateHolidayNameSuggestions(user) {
  const datalist = $("holidayNameSuggestions");
  datalist.innerHTML = "";
  [...new Set(user?.savedHolidayNames || [])].sort((a, b) => a.localeCompare(b)).forEach(name => {
    const option = document.createElement("option");
    option.value = name;
    datalist.appendChild(option);
  });
}

function editDayOff(id) {
  const user = getActiveUser();
  const item = user?.calendarExceptions.find(exception => exception.id === id);
  if (!item) return;
  editingDayOffId = id;
  $("dayOffId").value = id;
  $("dayOffStartDate").value = item.startDate || item.date;
  $("dayOffEndDate").value = item.endDate || item.startDate || item.date;
  $("dayOffEndDate").min = item.startDate || item.date;

  if (item.type === "PD Day") {
    $("dayOffPDYes").checked = true;
    $("pdDescription").value = item.description || "";
    $("pdLocation").value = item.location || "";
  } else {
    $("dayOffPDNo").checked = true;
    $(item.type === "Holiday" ? "dayOffHolidayChoice" : "dayOffOtherChoice").checked = true;
    $("dayOffLabel").value = item.label || "";
    $("dayOffDescription").value = item.description || "";
    $("dayOffNotes").value = item.notes || "";
  }
  updateDayOffFlow();
  $("cancelDayOffEditButton").classList.remove("hidden");
  $("saveDayOffButton").textContent = "Save Changes";
}

function deleteDayOff(id) {
  const user = getActiveUser();
  const item = user?.calendarExceptions.find(exception => exception.id === id);
  if (!user || !item || !confirm(`Remove ${item.label || item.type} (${exceptionDateLabel(item)}) from Days Off?`)) return;
  user.calendarExceptions = user.calendarExceptions.filter(exception => exception.id !== id);
  reconcileFutureUnits(user, item.startDate || item.date);
  saveData();
  renderDaysOffList(user);
  renderTeacherHQ();
}

function renderDaysOffList(user) {
  const container = $("daysOffList");
  container.innerHTML = "";
  if (user.calendarExceptions.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "No days off have been entered yet.";
    container.appendChild(empty);
    return;
  }

  user.calendarExceptions.forEach(item => {
    const card = document.createElement("div");
    card.className = `day-off-card day-off-${item.type.toLowerCase().replaceAll(" ", "-")}`;
    const info = document.createElement("div");
    info.className = "day-off-card-copy";
    const title = document.createElement("strong");
    title.textContent = item.label || item.type;
    const date = document.createElement("div");
    date.className = "day-off-date-label";
    date.textContent = exceptionDateLabel(item);
    const meta = document.createElement("div");
    meta.className = "term-meta";
    const details = [item.type];
    if (item.description) details.push(item.description);
    if (item.location) details.push(item.location);
    if (item.notes) details.push(`Notes: ${item.notes}`);
    meta.textContent = details.join(" · ");
    info.append(title, date, meta);
    card.appendChild(info);

    const actions = document.createElement("div");
    actions.className = "term-card-actions";
    const edit = document.createElement("button");
    edit.className = "secondary-button";
    edit.type = "button";
    edit.textContent = "Edit";
    edit.addEventListener("click", () => editDayOff(item.id));
    const del = document.createElement("button");
    del.className = "text-button danger-text";
    del.type = "button";
    del.textContent = "Delete";
    del.addEventListener("click", () => deleteDayOff(item.id));
    actions.append(edit, del);
    card.appendChild(actions);
    container.appendChild(card);
  });
}

function getPDAttentionItems(user) {
  const todayKey = getLocalDateKey();
  const twoWeeksKey = addDaysToKey(todayKey, 14);
  return user.calendarExceptions
    .filter(item => {
      if (item.type !== "PD Day") return false;
      const start = item.startDate || item.date;
      const end = item.endDate || start;
      return end >= todayKey && start <= twoWeeksKey && (!item.location || !item.description);
    })
    .sort((a, b) => (a.startDate || a.date).localeCompare(b.startDate || b.date));
}

function renderPDAttention(user) {
  const items = getPDAttentionItems(user);
  if (items.length === 0) {
    pdAlert.classList.add("hidden");
    return;
  }
  const first = items[0];
  pdAlertText.textContent = items.length === 1
    ? `PD Day details need attention — ${exceptionDateLabel(first)}`
    : `${items.length} upcoming PD Day entries have incomplete details`;
  const missing = [];
  if (!first.location) missing.push("location");
  if (!first.description) missing.push("description");
  pdAlertDetail.textContent = `PD Day: missing ${missing.join(" and ")}.`;
  pdAlert.classList.remove("hidden");
}

/* ============================================================
   MASTER CALENDAR + OCCURRENCES
============================================================ */

function getOccurrencesForDate(date, user = getActiveUser()) {
  if (!user) return [];
  const dateKey = getLocalDateKey(date);
  if (isNoSchoolDate(user, dateKey)) return [];

  const weekday = WEEKDAYS[date.getDay()];
  const occurrences = [];
  termsForDate(dateKey, user).forEach(term => {
    const version = getScheduleVersionForDate(term, dateKey);
    if (!version) return;
    version.scheduleBlocks
      .filter(block => block.weekday === weekday)
      .forEach(block => {
        const planned = block.blockType === "Instructional Time" && (block.plannedDates || []).includes(dateKey);
        occurrences.push({
          occurrenceId: `${term.id}|${version.id}|${block.id}|${dateKey}`,
          dateKey, termId: term.id, termName: term.name, versionId: version.id, blockId: block.id,
          block, planned, conflict: false
        });
      });
  });
  markOccurrenceConflicts(occurrences);
  return occurrences.sort((a, b) => a.block.startTime.localeCompare(b.block.startTime));
}

function markOccurrenceConflicts(occurrences) {
  for (let i = 0; i < occurrences.length; i++) {
    for (let j = i + 1; j < occurrences.length; j++) {
      if (timesOverlap(occurrences[i].block, occurrences[j].block)) {
        occurrences[i].conflict = true;
        occurrences[j].conflict = true;
      }
    }
  }
}

function getConflictPairCount(occurrences) {
  let count = 0;
  for (let i = 0; i < occurrences.length; i++) {
    for (let j = i + 1; j < occurrences.length; j++) {
      if (timesOverlap(occurrences[i].block, occurrences[j].block)) count++;
    }
  }
  return count;
}

function renderCalendar() {
  calendarGrid.innerHTML = "";
  const user = getActiveUser();
  const todayKey = getLocalDateKey();
  const year = visibleDate.getFullYear();
  const month = visibleDate.getMonth();
  monthTitle.textContent = visibleDate.toLocaleDateString("en-CA", { month: "long", year: "numeric" });

  ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].forEach((weekday, index) => {
    const heading = document.createElement("div");
    heading.className = "weekday";
    heading.textContent = weekday;
    if (index === 0 || index === 6) heading.classList.add("weekend-heading");
    calendarGrid.appendChild(heading);
  });

  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let i = 0; i < firstWeekday; i++) {
    const empty = document.createElement("div");
    empty.className = "day empty";
    calendarGrid.appendChild(empty);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const dateKey = getLocalDateKey(date);
    const cell = document.createElement("div");
    cell.className = "day";
    if (date.getDay() === 0 || date.getDay() === 6) cell.classList.add("weekend");
    if (dateKey < todayKey) cell.classList.add("past");
    if (dateKey === todayKey) cell.classList.add("today");

    const number = document.createElement("span");
    number.className = "day-number";
    number.textContent = day;
    cell.appendChild(number);

    const exception = user ? getExceptionForDate(user, dateKey) : null;
    if (exception) {
      cell.classList.add("no-school-day", `no-school-${exception.type.toLowerCase().replaceAll(" ", "-")}`);
      const chip = document.createElement("span");
      chip.className = `day-off-chip ${exception.type === "PD Day" ? "pd-chip" : ""}`;
      chip.textContent = exception.label || exception.type;
      chip.title = `${exception.type} · ${exceptionDateLabel(exception)}`;
      cell.appendChild(chip);
    } else {
      const occurrences = user ? getOccurrencesForDate(date, user) : [];
      const instructional = occurrences.filter(item => item.block.blockType === "Instructional Time");
      const unplannedCount = instructional.filter(item => !item.planned).length;
      const plannedCount = instructional.filter(item => item.planned).length;
      const conflictCount = getConflictPairCount(occurrences);
      const statuses = document.createElement("div");
      statuses.className = "day-statuses";
      if (unplannedCount) statuses.appendChild(makeCalendarStatus(unplannedCount, "status-red", "Unplanned instructional blocks"));
      if (plannedCount) statuses.appendChild(makeCalendarStatus(plannedCount, "status-green", "Planned instructional blocks"));
      if (conflictCount) statuses.appendChild(makeCalendarStatus(conflictCount, "status-yellow", "Schedule conflicts"));
      cell.appendChild(statuses);
      if (occurrences.length) cell.title = occurrences.map(occurrenceSummary).join("\n");
    }

    cell.addEventListener("click", event => {
      event.stopPropagation();
      openDayDetails(dateKey);
    });
    calendarGrid.appendChild(cell);
  }

  renderCalendarAlerts(user);
}

function makeCalendarStatus(count, className, title) {
  const badge = document.createElement("span");
  badge.className = `calendar-status ${className}`;
  badge.textContent = count;
  badge.title = title;
  return badge;
}

function occurrenceSummary(occurrence) {
  const block = occurrence.block;
  const main = block.blockType === "Instructional Time"
    ? `${gradeDisplay(block.grades)} ${block.subject}`.trim()
    : block.label || block.blockType;
  const status = block.blockType === "Instructional Time" ? (occurrence.planned ? "Planned" : "Unplanned") : block.blockType;
  return `${formatTime(block.startTime)}–${formatTime(block.endTime)} · ${main} · ${status}${occurrence.conflict ? " · Conflict" : ""}`;
}

function countFutureAttentionItems(user) {
  const todayKey = getLocalDateKey();
  const termEndDates = user.terms.map(term => term.endDate).filter(Boolean).sort();
  if (termEndDates.length === 0) return { unplanned: 0, conflicts: 0 };
  const latestEnd = termEndDates.at(-1);
  const futureStarts = user.terms.map(term => term.startDate).filter(date => date >= todayKey).sort();
  const startKey = user.terms.some(term => isDateWithin(todayKey, term.startDate, term.endDate)) ? todayKey : futureStarts[0] || todayKey;
  let date = parseLocalDate(startKey);
  const end = parseLocalDate(latestEnd);
  let unplanned = 0;
  let conflicts = 0;
  while (date <= end) {
    const occurrences = getOccurrencesForDate(date, user);
    unplanned += occurrences.filter(item => item.block.blockType === "Instructional Time" && !item.planned).length;
    conflicts += getConflictPairCount(occurrences);
    date.setDate(date.getDate() + 1);
  }
  return { unplanned, conflicts };
}

function renderCalendarAlerts(user) {
  if (!user || user.terms.length === 0) {
    unplannedAlert.classList.add("hidden");
    conflictAlert.classList.add("hidden");
    return;
  }
  const counts = countFutureAttentionItems(user);
  if (counts.unplanned === 0) unplannedAlert.classList.add("hidden");
  else {
    unplannedAlertText.textContent = counts.unplanned === 1
      ? "1 unplanned instructional block needs attention"
      : `${counts.unplanned} unplanned instructional blocks need attention`;
    unplannedAlert.classList.remove("hidden");
  }
  if (counts.conflicts === 0) conflictAlert.classList.add("hidden");
  else {
    conflictAlertText.textContent = counts.conflicts === 1
      ? "1 schedule conflict needs review"
      : `${counts.conflicts} schedule conflicts need review`;
    conflictAlert.classList.remove("hidden");
  }
}

$("previousMonth").addEventListener("click", event => {
  event.stopPropagation();
  visibleDate = new Date(visibleDate.getFullYear(), visibleDate.getMonth() - 1, 1);
  renderCalendar();
});

$("nextMonth").addEventListener("click", event => {
  event.stopPropagation();
  visibleDate = new Date(visibleDate.getFullYear(), visibleDate.getMonth() + 1, 1);
  renderCalendar();
});

$("calendarCard").addEventListener("click", () => { window.location.href = "calendar.html"; });

/* ============================================================
   DAY DETAILS + PLANNED TOGGLE + UNIT ALLOCATION LINKS
============================================================ */

function openDayDetails(dateKey) {
  const user = getActiveUser();
  if (!user) return;
  dayDetailsHeading.textContent = formatLongDate(dateKey);
  dayDetailsList.innerHTML = "";
  const exception = getExceptionForDate(user, dateKey);
  if (exception) {
    dayExceptionSummary.classList.remove("hidden");
    dayExceptionSummary.className = `day-exception-summary ${exception.type === "PD Day" ? "pd-summary" : ""}`;
    const details = [exception.label || exception.type, exceptionDateLabel(exception)];
    if (exception.description) details.push(exception.description);
    if (exception.location) details.push(`Location: ${exception.location}`);
    if (exception.notes) details.push(`Notes: ${exception.notes}`);
    dayExceptionSummary.textContent = `${exception.type} · ${details.join(" · ")}`;
    const empty = document.createElement("p");
    empty.className = "section-subtitle";
    empty.textContent = "No lessons or teaching blocks can be scheduled on this date.";
    dayDetailsList.appendChild(empty);
    dayDetailsDialog.showModal();
    return;
  }

  dayExceptionSummary.classList.add("hidden");
  const occurrences = getOccurrencesForDate(parseLocalDate(dateKey), user);
  if (occurrences.length === 0) {
    const empty = document.createElement("p");
    empty.className = "section-subtitle";
    empty.textContent = "No scheduled blocks on this date.";
    dayDetailsList.appendChild(empty);
    dayDetailsDialog.showModal();
    return;
  }

  occurrences.forEach(occurrence => {
    const block = occurrence.block;
    const card = document.createElement("div");
    card.className = "day-detail-card";
    if (dateKey < getLocalDateKey()) card.classList.add("past-occurrence");
    if (block.blockType === "Instructional Time") card.classList.add(occurrence.planned ? "status-planned" : "status-unplanned");
    else card.classList.add(blockTypeClass(block.blockType));
    if (occurrence.conflict) card.classList.add("status-conflict");

    const title = document.createElement("strong");
    title.textContent = block.blockType === "Instructional Time"
      ? `${gradeDisplay(block.grades)} ${block.subject}`.trim()
      : block.label || block.blockType;
    const meta = document.createElement("div");
    meta.className = "term-meta";
    meta.textContent = `${formatTime(block.startTime)}–${formatTime(block.endTime)} · ${occurrence.termName}`;
    card.append(title, meta);

    const allocations = findUnitLessonsForOccurrence(user, occurrence);
    allocations.forEach(({ unit, lesson }) => {
      const allocation = document.createElement("button");
      allocation.type = "button";
      allocation.className = "unit-allocation-link";
      allocation.style.setProperty("--unit-colour", unit.colour || "#8C6CFF");
      allocation.textContent = `${unit.name} · ${lessonDisplayTitle(lesson)}`;
      allocation.addEventListener("click", () => openLessonPlaceholder(unit.id, lesson.id));
      card.appendChild(allocation);
    });

    if (occurrence.conflict) {
      const warning = document.createElement("span");
      warning.className = "conflict-note";
      warning.textContent = "Schedule overlap";
      card.appendChild(warning);
    }

    if (block.blockType === "Instructional Time" && !readOnlyMode) {
      const actions = document.createElement("div");
      actions.className = "day-detail-actions edit-only";
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "secondary-button";
      toggle.textContent = occurrence.planned ? "Mark Unplanned" : "Mark Planned";
      toggle.addEventListener("click", () => setOccurrencePlanned(occurrence, !occurrence.planned));
      actions.appendChild(toggle);
      card.appendChild(actions);
    }
    dayDetailsList.appendChild(card);
  });
  dayDetailsDialog.showModal();
}

function setOccurrencePlanned(occurrence, planned) {
  const user = getActiveUser();
  if (!user || readOnlyMode) return;
  const term = getTermById(occurrence.termId, user);
  const version = term?.scheduleVersions.find(item => item.id === occurrence.versionId);
  const block = version?.scheduleBlocks.find(item => item.id === occurrence.blockId);
  if (!block) return;
  const dates = new Set(block.plannedDates || []);
  if (planned) dates.add(occurrence.dateKey); else dates.delete(occurrence.dateKey);
  block.plannedDates = [...dates].sort();
  term.updatedAt = new Date().toISOString();
  saveData();
  renderTeacherHQ();
  openDayDetails(occurrence.dateKey);
}

$("closeDayDetailsButton").addEventListener("click", () => dayDetailsDialog.close());

/* ============================================================
   WEEKLY INSTRUCTIONAL BLOCKS ONLY
============================================================ */

function renderWeeklyInstructionalBlocks(user) {
  const section = $("weeklyScheduleSection");
  const display = $("weeklyScheduleDisplay");
  display.innerHTML = "";
  if (user.terms.length === 0) {
    section.classList.add("hidden");
    return;
  }

  const todayKey = getLocalDateKey();
  let relevantTerms = termsForDate(todayKey, user);
  if (relevantTerms.length === 0) {
    const upcoming = user.terms.filter(term => term.startDate > todayKey).sort((a, b) => a.startDate.localeCompare(b.startDate));
    if (upcoming.length) {
      const firstDate = upcoming[0].startDate;
      relevantTerms = upcoming.filter(term => term.startDate === firstDate);
    }
  }
  if (relevantTerms.length === 0) {
    section.classList.add("hidden");
    return;
  }
  section.classList.remove("hidden");

  relevantTerms.forEach(term => {
    const version = getDisplayVersion(term);
    if (!version) return;
    const instructional = version.scheduleBlocks.filter(block => block.blockType === "Instructional Time");
    if (!instructional.length) return;

    const group = document.createElement("div");
    group.className = "weekly-term-group";
    const heading = document.createElement("div");
    heading.className = "weekly-term-heading";
    const name = document.createElement("strong");
    name.textContent = term.name;
    const dates = document.createElement("p");
    dates.textContent = `${formatDate(version.effectiveStart)} – ${formatDate(version.effectiveEnd)}`;
    heading.append(name, dates);
    group.appendChild(heading);

    const schedule = document.createElement("div");
    schedule.className = "weekly-schedule";
    WEEKDAYS.forEach(day => {
      const column = document.createElement("div");
      column.className = "weekday-column";
      if (day === "Sunday" || day === "Saturday") column.classList.add("weekend-column");
      const title = document.createElement("h4");
      title.textContent = day;
      column.appendChild(title);
      const blocksContainer = document.createElement("div");
      blocksContainer.className = "weekday-blocks";
      const blocks = instructional.filter(block => block.weekday === day);
      if (!blocks.length) {
        const empty = document.createElement("p");
        empty.className = "section-subtitle mini-empty";
        empty.textContent = "No instructional blocks";
        blocksContainer.appendChild(empty);
      } else {
        blocks.forEach(block => {
          const next = findNextOccurrenceForBlock(user, term, version, block);
          const status = next?.planned ? "planned" : "unplanned";
          blocksContainer.appendChild(createScheduleBlockElement(block, false, status));
        });
      }
      column.appendChild(blocksContainer);
      schedule.appendChild(column);
    });
    group.appendChild(schedule);
    display.appendChild(group);
  });
}

function findNextOccurrenceForBlock(user, term, version, block) {
  const todayKey = getLocalDateKey();
  const startKey = todayKey > version.effectiveStart ? todayKey : version.effectiveStart;
  let date = parseLocalDate(startKey);
  const end = parseLocalDate(version.effectiveEnd);
  while (date <= end) {
    const key = getLocalDateKey(date);
    if (!isNoSchoolDate(user, key) && WEEKDAYS[date.getDay()] === block.weekday) {
      return { dateKey: key, planned: (block.plannedDates || []).includes(key) };
    }
    date.setDate(date.getDate() + 1);
  }
  return null;
}

/* ============================================================
   UNIT PLANNER — CLASS OPTIONS
============================================================ */

function getClassOptions(user) {
  const map = new Map();
  user.terms.forEach(term => {
    term.scheduleVersions.forEach(version => {
      version.scheduleBlocks
        .filter(block => block.blockType === "Instructional Time")
        .forEach(block => {
          const spec = { grades: normalizeGradeArray(block.grades || []), subject: block.subject || "" };
          if (!spec.subject || !spec.grades.length) return;
          map.set(classKey(spec), spec);
        });
    });
  });
  return [...map.values()].sort((a, b) => classLabel(a).localeCompare(classLabel(b)));
}

function renderUnitOverview(user) {
  const container = $("unitOverviewList");
  container.innerHTML = "";
  if (!user.units.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state-card";
    empty.textContent = "No units yet. Open Unit Planner when you're ready to create the first one.";
    container.appendChild(empty);
    return;
  }
  user.units.slice(0, 6).forEach(unit => container.appendChild(makeUnitCard(unit, true)));
}

$("openUnitPlannerButton").addEventListener("click", openUnitPlanner);
$("closeUnitPlannerButton").addEventListener("click", () => unitPlannerDialog.close());
$("createUnitButton").addEventListener("click", () => openUnitWizard());

function openUnitPlanner() {
  const user = getActiveUser();
  if (!user) return;
  renderUnitPlannerList(user);
  unitPlannerDialog.showModal();
}

function renderUnitPlannerList(user) {
  const container = $("unitPlannerList");
  container.innerHTML = "";
  if (!user.units.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state-card";
    empty.textContent = "No unit plans have been created yet.";
    container.appendChild(empty);
    return;
  }
  user.units.forEach(unit => container.appendChild(makeUnitCard(unit, false)));
}

function makeUnitCard(unit, compact) {
  const card = document.createElement("button");
  card.type = "button";
  card.className = `unit-card ${compact ? "compact-unit-card" : ""}`;
  card.style.setProperty("--unit-colour", unit.colour || "#8C6CFF");
  const name = document.createElement("strong");
  name.textContent = unit.name;
  const meta = document.createElement("div");
  meta.className = "term-meta";
  const scheduled = unit.lessons.reduce((sum, lesson) => sum + lesson.durationMinutes, 0);
  meta.textContent = `${classLabel(unit.classSpec)} · ${hoursLabel(unit.targetMinutes)} target · ${unit.lessons.length} lesson${unit.lessons.length === 1 ? "" : "s"}`;
  card.append(name, meta);
  if (unit.needsScheduleReview) {
    const flag = document.createElement("span");
    flag.className = "unit-review-flag";
    flag.textContent = "Schedule review needed";
    card.appendChild(flag);
  }
  if (scheduled > unit.targetMinutes) {
    const surplus = document.createElement("span");
    surplus.className = "unit-surplus-label";
    surplus.textContent = `${hoursLabel(scheduled - unit.targetMinutes)} surplus capacity`;
    card.appendChild(surplus);
  }
  card.addEventListener("click", () => openUnitDetail(unit.id));
  return card;
}

/* ============================================================
   UNIT WIZARD
============================================================ */

$("closeUnitWizardButton").addEventListener("click", closeUnitWizard);
$("unitWizardBackButton").addEventListener("click", () => {
  if (unitWizardStep > 1) goToUnitStep(unitWizardStep - 1);
});
$("unitWizardNextButton").addEventListener("click", handleUnitWizardNext);
$("useManualClassButton").addEventListener("click", useManualUnitClass);
$("unitClassSelect").addEventListener("change", handleUnitClassSelect);
$("clearCurriculumSelectionButton").addEventListener("click", () => {
  unitCurriculumSelection.clear();
  renderCurriculumBrowser();
});
$("unitHoursInput").addEventListener("input", () => {
  if ($("unitHoursInput").value) $("unitPercentageInput").value = "";
  updateAllocationSummary();
});
$("unitPercentageInput").addEventListener("input", () => {
  if ($("unitPercentageInput").value) $("unitHoursInput").value = "";
  updateAllocationSummary();
});
$("manualAvailableHoursInput").addEventListener("input", updateAllocationSummary);
$("unitPreviousMonth").addEventListener("click", () => {
  unitVisibleDate = new Date(unitVisibleDate.getFullYear(), unitVisibleDate.getMonth() - 1, 1);
  renderUnitCalendar();
});
$("unitNextMonth").addEventListener("click", () => {
  unitVisibleDate = new Date(unitVisibleDate.getFullYear(), unitVisibleDate.getMonth() + 1, 1);
  renderUnitCalendar();
});
$("unitColourPicker").addEventListener("input", () => {
  setUnitDraftColour($("unitColourPicker").value);
});
$("unitColourHex").addEventListener("input", () => {
  const colour = normalizeHexColour($("unitColourHex").value);
  if (colour) setUnitDraftColour(colour, false);
  else renderUnitColourStatus();
});
$("unitColourHex").addEventListener("blur", () => {
  if (!normalizeHexColour($("unitColourHex").value)) {
    $("unitColourHex").value = unitDraft?.colour || "#FF5F8F";
  }
  renderUnitColourStatus();
});
$("nextUnitColourButton").addEventListener("click", () => {
  const user = getActiveUser();
  if (!unitDraft || !user) return;
  setUnitDraftColour(suggestedUnitColour(user, unitDraft.classSpec, editingUnitId, unitDraft.colour));
});

function openUnitWizard(unitId = null) {
  const user = getActiveUser();
  if (!user || readOnlyMode) return;
  editingUnitId = unitId;
  const existing = unitId ? getUnitById(unitId, user) : null;
  unitDraft = existing ? structuredCloneSafe(existing) : normalizeUnit({
    id: makeId("unit"), name: "", classSpec: { grades: [], subject: "" }, colour: "", selectedCurriculum: [],
    targetMinutes: 0, allocationMethod: "hours", startDate: "", lessons: [],
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
  });
  unitCurriculumSelection = new Set(unitDraft.selectedCurriculum.map(record => record.id));
  $("unitWizardHeading").textContent = existing ? "Edit Unit" : "Create Unit";
  $("unitNameInput").value = unitDraft.name === "Untitled Unit" ? "" : unitDraft.name;
  populateUnitClassSelect();
  selectExistingUnitClass();
  $("unitManualGrade").value = "";
  $("unitManualSubject").value = "";
  $("unitHoursInput").value = unitDraft.allocationMethod === "hours" && unitDraft.targetMinutes ? formatHoursInput(unitDraft.targetMinutes) : "";
  $("unitPercentageInput").value = unitDraft.allocationMethod === "percentage" && unitDraft.allocationPercentage ? unitDraft.allocationPercentage : "";
  $("manualAvailableHoursInput").value = "";
  unitVisibleDate = defaultUnitMonth(user, unitDraft);
  syncUnitColourControls();
  goToUnitStep(1);
  unitWizardDialog.showModal();
}

function closeUnitWizard() {
  unitWizardDialog.close();
  unitDraft = null;
  editingUnitId = null;
  unitCurriculumSelection = new Set();
}

function populateUnitClassSelect() {
  const user = getActiveUser();
  const select = $("unitClassSelect");
  select.innerHTML = '<option value="">Select a class</option>';
  getClassOptions(user).forEach(spec => {
    const option = document.createElement("option");
    option.value = classKey(spec);
    option.textContent = classLabel(spec);
    option.dataset.grades = JSON.stringify(spec.grades);
    option.dataset.subject = spec.subject;
    select.appendChild(option);
  });
}

function selectExistingUnitClass() {
  const select = $("unitClassSelect");
  const key = classKey(unitDraft.classSpec);
  const option = [...select.options].find(item => item.value === key);
  if (option) select.value = key;
  renderUnitClassSummary();
}

function handleUnitClassSelect() {
  const select = $("unitClassSelect");
  const option = select.selectedOptions[0];
  if (!option?.value) return;
  unitDraft.classSpec = {
    grades: JSON.parse(option.dataset.grades || "[]"),
    subject: option.dataset.subject || ""
  };
  unitCurriculumSelection.clear();
  renderUnitClassSummary();
}

function useManualUnitClass() {
  const gradeText = $("unitManualGrade").value.trim();
  const subject = $("unitManualSubject").value.trim();
  const grades = parseManualGrades(gradeText);
  if (!grades.length || !subject) return alert("Enter both a grade/class and a subject.");
  unitDraft.classSpec = { grades, subject };
  const user = getActiveUser();
  grades.forEach(grade => {
    if (!getAvailableGrades(user).some(existing => existing.toLowerCase() === grade.toLowerCase())) user.customGrades.push(grade);
  });
  if (!getAvailableSubjects(user).some(existing => existing.toLowerCase() === subject.toLowerCase())) user.customSubjects.push(subject);
  saveData();
  $("unitClassSelect").value = "";
  unitCurriculumSelection.clear();
  renderUnitClassSummary();
}

function renderUnitClassSummary() {
  const summary = $("unitClassSummary");
  if (!unitDraft?.classSpec?.subject || !unitDraft.classSpec.grades.length) {
    summary.classList.add("hidden");
    return;
  }
  summary.textContent = `Selected: ${classLabel(unitDraft.classSpec)}`;
  summary.classList.remove("hidden");
}

function goToUnitStep(step) {
  unitWizardStep = step;
  document.querySelectorAll(".wizard-step").forEach(element => element.classList.add("hidden"));
  $(`unitStep${step}`).classList.remove("hidden");
  document.querySelectorAll("[data-wizard-step]").forEach(element => {
    element.classList.toggle("active", Number(element.dataset.wizardStep) === step);
    element.classList.toggle("complete", Number(element.dataset.wizardStep) < step);
  });
  $("unitWizardStepLabel").textContent = `Step ${step} of 4`;
  $("unitWizardBackButton").classList.toggle("hidden", step === 1);
  $("unitWizardNextButton").textContent = step === 4 ? "Save Unit" : "Continue";
  if (step === 2) renderCurriculumBrowser();
  if (step === 3) updateAllocationSummary();
  if (step === 4) {
    if (unitDraft.startDate && !normalizeHexColour(unitDraft.colour)) {
      unitDraft.colour = suggestedUnitColour(getActiveUser(), unitDraft.classSpec, editingUnitId);
    }
    syncUnitColourControls();
    renderUnitCalendar();
  }
}

function handleUnitWizardNext() {
  if (unitWizardStep === 1) {
    const name = $("unitNameInput").value.trim();
    if (!name) return alert("Give the unit a name.");
    if (!unitDraft.classSpec.subject || !unitDraft.classSpec.grades.length) return alert("Select a grade/class and subject.");
    unitDraft.name = name;
    goToUnitStep(2);
    return;
  }
  if (unitWizardStep === 2) {
    unitDraft.selectedCurriculum = buildSelectedCurriculumSnapshots();
    goToUnitStep(3);
    return;
  }
  if (unitWizardStep === 3) {
    if (!validateAllocationStep()) return;
    goToUnitStep(4);
    return;
  }
  saveUnitFromWizard();
}

function formatHoursInput(minutes) {
  return Number((minutes / 60).toFixed(2));
}

function validateManualHours(hours) {
  if (!Number.isFinite(hours) || hours <= 0) return false;
  const fraction = Number((hours - Math.floor(hours)).toFixed(2));
  return [0, 0.25, 0.5].includes(fraction);
}

function validateAllocationStep() {
  const user = getActiveUser();
  const hoursValue = $("unitHoursInput").value.trim();
  const percentageValue = $("unitPercentageInput").value.trim();
  const calculatedAvailable = calculateAvailableMinutesForClass(user, unitDraft.classSpec, editingUnitId);

  if (hoursValue) {
    const hours = Number(hoursValue);
    if (!validateManualHours(hours)) {
      alert("Use whole hours, .25 (15 minutes), or .5 (30 minutes). For example: 20, 20.25, or 20.5.");
      return false;
    }
    unitDraft.targetMinutes = Math.round(hours * 60);
    unitDraft.allocationMethod = "hours";
    unitDraft.allocationPercentage = null;
    unitDraft.availableMinutesAtCreation = calculatedAvailable;
    return true;
  }

  if (percentageValue) {
    const percentage = Number(percentageValue);
    if (!Number.isFinite(percentage) || percentage <= 0 || percentage > 100) {
      alert("Enter a percentage between 0 and 100.");
      return false;
    }
    let available = calculatedAvailable;
    if (available <= 0) {
      const manualHours = Number($("manualAvailableHoursInput").value);
      if (!Number.isFinite(manualHours) || manualHours <= 0) {
        alert("No matching instructional blocks were found. Enter the total instructional hours available for this class.");
        return false;
      }
      available = Math.round(manualHours * 60);
    }
    const rawTarget = available * (percentage / 100);
    unitDraft.targetMinutes = Math.ceil(rawTarget / 15) * 15;
    unitDraft.allocationMethod = "percentage";
    unitDraft.allocationPercentage = percentage;
    unitDraft.availableMinutesAtCreation = available;
    return true;
  }

  alert("Enter either hours allocated to the unit or a percentage of available instructional time.");
  return false;
}

function updateAllocationSummary() {
  if (!unitDraft?.classSpec?.subject) return;
  const user = getActiveUser();
  const available = calculateAvailableMinutesForClass(user, unitDraft.classSpec, editingUnitId);
  $("manualAvailableHoursField").classList.toggle("hidden", available > 0);
  $("availableHoursText").textContent = available > 0
    ? `${hoursLabel(available)} of usable instructional time found in the master calendar (days off excluded).`
    : "No matching instructional blocks were found in the master calendar.";

  const summary = $("unitAllocationSummary");
  const hoursValue = $("unitHoursInput").value.trim();
  const percentageValue = $("unitPercentageInput").value.trim();
  if (hoursValue) {
    const hours = Number(hoursValue);
    summary.textContent = Number.isFinite(hours) ? `Target: ${hours} hours.` : "";
    summary.classList.toggle("hidden", !summary.textContent);
    return;
  }
  if (percentageValue) {
    const percentage = Number(percentageValue);
    let base = available;
    if (base <= 0) base = Number($("manualAvailableHoursInput").value || 0) * 60;
    if (percentage > 0 && base > 0) {
      const target = Math.ceil((base * percentage / 100) / 15) * 15;
      summary.textContent = `${percentage}% of ${hoursLabel(base)} = ${hoursLabel(target)} allocated (rounded up to a 15-minute increment when needed).`;
      summary.classList.remove("hidden");
      return;
    }
  }
  summary.classList.add("hidden");
}

/* ============================================================
   CURRICULUM BROWSER
============================================================ */


function buildSelectedCurriculumSnapshots() {
  const catalogIds = new Set(CURRICULUM.map(record => record.id));
  const selectedFromCatalog = CURRICULUM
    .filter(record => unitCurriculumSelection.has(record.id))
    .map(record => structuredCloneSafe(record));
  const preservedSnapshots = (unitDraft?.selectedCurriculum || [])
    .filter(record => !catalogIds.has(record.id) && unitCurriculumSelection.has(record.id))
    .map(record => structuredCloneSafe(record));
  return [...selectedFromCatalog, ...preservedSnapshots];
}

function getCurriculumForClass(classSpec) {
  const subject = String(classSpec?.subject || "").toLowerCase();
  const grades = normalizeGradeArray(classSpec?.grades || []);
  return CURRICULUM.filter(record =>
    String(record.subject || "").toLowerCase() === subject && grades.includes(record.grade)
  );
}

function renderCurriculumBrowser() {
  const container = $("curriculumBrowser");
  const empty = $("curriculumEmptyMessage");
  container.innerHTML = "";
  const records = getCurriculumForClass(unitDraft.classSpec);
  if (!records.length) {
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");

  const byGrade = groupBy(records, record => record.grade);
  Object.entries(byGrade).forEach(([grade, gradeRecords]) => {
    const gradeSection = document.createElement("details");
    gradeSection.className = "curriculum-level curriculum-grade";
    gradeSection.open = true;
    const summary = document.createElement("summary");
    summary.innerHTML = `<strong>${escapeHTML(grade)} ${escapeHTML(unitDraft.classSpec.subject)}</strong>`;
    summary.appendChild(makeSelectAllButton(gradeRecords, "Select all"));
    gradeSection.appendChild(summary);

    const byOrganizingIdea = groupBy(gradeRecords, record => `${record.organizingIdea}|||${record.organizingIdeaDescription || ""}`);
    Object.entries(byOrganizingIdea).forEach(([oiKey, oiRecords]) => {
      const [oi, description] = oiKey.split("|||");
      const section = document.createElement("details");
      section.className = "curriculum-level curriculum-organizing-idea";
      const oiSummary = document.createElement("summary");
      const text = document.createElement("div");
      text.className = "curriculum-card-title";
      text.innerHTML = `<strong>${escapeHTML(oi)}</strong><small>${escapeHTML(description)}</small>`;
      oiSummary.append(text, makeSelectAllButton(oiRecords, "Select all"));
      section.appendChild(oiSummary);

      const byGQ = groupBy(oiRecords, record => record.guidingQuestion || "Guiding Question");
      Object.entries(byGQ).forEach(([gq, gqRecords]) => {
        const gqSection = document.createElement("details");
        gqSection.className = "curriculum-level curriculum-gq";
        const gqSummary = document.createElement("summary");
        const gqText = document.createElement("div");
        gqText.className = "curriculum-card-title";
        gqText.innerHTML = `<strong>${escapeHTML(gq)}</strong>`;
        gqSummary.append(gqText, makeSelectAllButton(gqRecords, "Select all"));
        gqSection.appendChild(gqSummary);

        const byLO = groupBy(gqRecords, record => record.learningOutcome || "Learning Outcome");
        Object.entries(byLO).forEach(([lo, loRecords]) => {
          const loSection = document.createElement("details");
          loSection.className = "curriculum-level curriculum-lo";
          const loSummary = document.createElement("summary");
          const loText = document.createElement("div");
          loText.className = "curriculum-card-title";
          loText.innerHTML = `<strong>${escapeHTML(lo)}</strong>`;
          loSummary.append(loText, makeSelectAllButton(loRecords, "Select all"));
          loSection.appendChild(loSummary);

          ["Knowledge", "Understanding", "Skills & Procedures"].forEach(type => {
            const typeRecords = loRecords.filter(record => record.type === type);
            if (!typeRecords.length) return;
            const typeBox = document.createElement("div");
            typeBox.className = "curriculum-type-box";
            const typeHeader = document.createElement("div");
            typeHeader.className = "curriculum-type-header";
            const heading = document.createElement("strong");
            heading.textContent = type;
            typeHeader.append(heading, makeSelectAllButton(typeRecords, "Select all"));
            typeBox.appendChild(typeHeader);
            typeRecords.forEach(record => {
              const label = document.createElement("label");
              label.className = "curriculum-leaf";
              const checkbox = document.createElement("input");
              checkbox.type = "checkbox";
              checkbox.checked = unitCurriculumSelection.has(record.id);
              checkbox.addEventListener("change", () => {
                if (checkbox.checked) unitCurriculumSelection.add(record.id);
                else unitCurriculumSelection.delete(record.id);
                refreshCurriculumSelectAllStates();
              });
              const span = document.createElement("span");
              span.textContent = record.text;
              label.append(checkbox, span);
              typeBox.appendChild(label);
            });
            loSection.appendChild(typeBox);
          });
          gqSection.appendChild(loSection);
        });
        section.appendChild(gqSection);
      });
      gradeSection.appendChild(section);
    });
    container.appendChild(gradeSection);
  });
  refreshCurriculumSelectAllStates();
}

function groupBy(records, keyFn) {
  return records.reduce((groups, record) => {
    const key = keyFn(record);
    (groups[key] ||= []).push(record);
    return groups;
  }, {});
}

function makeSelectAllButton(records, labelText) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "curriculum-select-all";
  button.textContent = labelText;
  button.dataset.ids = records.map(record => record.id).join("|");
  button.addEventListener("click", event => {
    event.preventDefault();
    event.stopPropagation();
    const ids = records.map(record => record.id);
    const allSelected = ids.every(id => unitCurriculumSelection.has(id));
    ids.forEach(id => allSelected ? unitCurriculumSelection.delete(id) : unitCurriculumSelection.add(id));
    renderCurriculumBrowser();
  });
  return button;
}

function refreshCurriculumSelectAllStates() {
  document.querySelectorAll(".curriculum-select-all").forEach(button => {
    const ids = button.dataset.ids.split("|").filter(Boolean);
    const all = ids.length && ids.every(id => unitCurriculumSelection.has(id));
    button.textContent = all ? "Clear all" : "Select all";
    button.classList.toggle("selected", all);
  });
}

/* ============================================================
   UNIT TIME CALCULATION + AUTO-SCHEDULING
============================================================ */

function getRelevantDateRange(user) {
  const starts = user.terms.map(term => term.startDate).filter(Boolean).sort();
  const ends = user.terms.map(term => term.endDate).filter(Boolean).sort();
  return starts.length && ends.length ? { start: starts[0], end: ends.at(-1) } : null;
}

function calculateAvailableMinutesForClass(user, classSpec) {
  const range = getRelevantDateRange(user);
  if (!range) return 0;
  let date = parseLocalDate(range.start);
  const end = parseLocalDate(range.end);
  let total = 0;
  while (date <= end) {
    const occurrences = dedupeClassOccurrences(
      getOccurrencesForDate(date, user).filter(item => classMatches(item.block, classSpec))
    );
    occurrences.forEach(item => {
      total += durationMinutes(item.block.startTime, item.block.endTime);
    });
    date.setDate(date.getDate() + 1);
  }
  return total;
}

function dedupeClassOccurrences(occurrences) {
  const map = new Map();
  occurrences.forEach(item => {
    const key = `${item.dateKey}|${item.block.startTime}|${item.block.endTime}|${classKey({ grades: item.block.grades, subject: item.block.subject })}`;
    if (!map.has(key)) map.set(key, item);
  });
  return [...map.values()].sort((a, b) => a.block.startTime.localeCompare(b.block.startTime));
}

function lessonOccurrenceKey(lesson) {
  return `${lesson.dateKey}|${lesson.startTime}|${lesson.endTime}|${classKey(lesson.classSpec)}`;
}

function occurrenceAllocationKey(occurrence) {
  return `${occurrence.dateKey}|${occurrence.block.startTime}|${occurrence.block.endTime}|${classKey({ grades: occurrence.block.grades, subject: occurrence.block.subject })}`;
}

function isOccurrenceAllocated(user, occurrence, excludeUnitId = null) {
  const key = occurrenceAllocationKey(occurrence);
  return user.units.some(unit => unit.id !== excludeUnitId && unit.lessons.some(lesson => lessonOccurrenceKey(lesson) === key));
}

function findUnitLessonsForOccurrence(user, occurrence) {
  const key = occurrenceAllocationKey(occurrence);
  const found = [];
  user.units.forEach(unit => unit.lessons.forEach(lesson => {
    if (lessonOccurrenceKey(lesson) === key) found.push({ unit, lesson });
  }));
  return found;
}

function setUnitDraftColour(value, syncHex = true) {
  if (!unitDraft) return;
  const colour = normalizeHexColour(value);
  if (!colour) return;
  unitDraft.colour = colour;
  $("unitColourPicker").value = colour;
  if (syncHex) $("unitColourHex").value = colour;
  $("unitColourLegendSwatch").style.background = colour;
  renderUnitColourStatus();
  renderUnitCalendar();
}

function syncUnitColourControls() {
  if (!unitDraft) return;
  const panel = $("unitColourPanel");
  const legend = $("unitColourLegend");
  const visible = Boolean(unitDraft.startDate);
  panel.classList.toggle("hidden", !visible);
  legend.classList.toggle("hidden", !visible);
  if (!visible) return;
  if (!normalizeHexColour(unitDraft.colour)) {
    unitDraft.colour = suggestedUnitColour(getActiveUser(), unitDraft.classSpec, editingUnitId);
  }
  $("unitColourPicker").value = unitDraft.colour;
  $("unitColourHex").value = unitDraft.colour;
  $("unitColourLegendSwatch").style.background = unitDraft.colour;
  renderUnitColourStatus();
}

function renderUnitColourStatus() {
  if (!unitDraft) return;
  const status = $("unitColourStatus");
  const typed = normalizeHexColour($("unitColourHex").value);
  if (!typed) {
    status.textContent = "Enter a six-digit hex colour such as #FF5F8F.";
    status.className = "unit-colour-status colour-status-error";
    return;
  }
  const duplicate = unitColourUsedByClass(getActiveUser(), unitDraft.classSpec, typed, editingUnitId);
  status.textContent = duplicate
    ? "That colour is already used by another unit in this grade/subject. Choose a different one."
    : "Unique for this grade/subject.";
  status.className = `unit-colour-status ${duplicate ? "colour-status-error" : "colour-status-ok"}`;
}

function defaultUnitMonth(user, unit) {
  if (unit?.startDate) {
    const date = parseLocalDate(unit.startDate);
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }
  const range = getRelevantDateRange(user);
  if (range) {
    const start = parseLocalDate(range.start);
    const septemberYear = start.getMonth() <= 8 ? start.getFullYear() : start.getFullYear() + 1;
    return new Date(septemberYear, 8, 1);
  }
  const now = new Date();
  return new Date(now.getFullYear(), 8, 1);
}

function renderUnitCalendar() {
  const user = getActiveUser();
  const grid = $("unitCalendarGrid");
  grid.innerHTML = "";
  if (!unitVisibleDate) unitVisibleDate = defaultUnitMonth(user, unitDraft);
  $("unitMonthTitle").textContent = unitVisibleDate.toLocaleDateString("en-CA", { month: "long", year: "numeric" });
  syncUnitColourControls();

  ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].forEach((weekday, index) => {
    const heading = document.createElement("div");
    heading.className = "weekday";
    heading.textContent = weekday;
    if (index === 0 || index === 6) heading.classList.add("weekend-heading");
    grid.appendChild(heading);
  });

  const year = unitVisibleDate.getFullYear();
  const month = unitVisibleDate.getMonth();
  const first = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  for (let i = 0; i < first; i++) {
    const empty = document.createElement("div");
    empty.className = "day empty";
    grid.appendChild(empty);
  }

  for (let day = 1; day <= days; day++) {
    const date = new Date(year, month, day);
    const dateKey = getLocalDateKey(date);
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "day unit-calendar-day";
    if (date.getDay() === 0 || date.getDay() === 6) cell.classList.add("weekend");

    const number = document.createElement("span");
    number.className = "day-number";
    number.textContent = day;
    cell.appendChild(number);

    const exception = getExceptionForDate(user, dateKey);
    const lessonsHere = unitDraft.lessons.filter(lesson => lesson.dateKey === dateKey);

    if (exception) {
      cell.classList.add("unit-off-day", `unit-off-${exception.type.toLowerCase().replaceAll(" ", "-")}`);
      const label = document.createElement("span");
      label.className = "unit-calendar-note off-note";
      label.textContent = exception.label || exception.type;
      cell.appendChild(label);
    } else if (lessonsHere.length) {
      const colour = normalizeHexColour(unitDraft.colour) || "#8C6CFF";
      cell.classList.add("unit-lesson-date");
      cell.style.setProperty("--unit-colour", colour);
      cell.style.setProperty("--unit-colour-soft", hexToRgba(colour, 0.22));
      lessonsHere.forEach(lesson => {
        const label = document.createElement("span");
        label.className = "unit-calendar-note unit-lesson-note";
        label.textContent = lessonDisplayTitle(lesson);
        cell.appendChild(label);
      });
    } else {
      const matching = dedupeClassOccurrences(getOccurrencesForDate(date, user).filter(item => classMatches(item.block, unitDraft.classSpec)));
      const available = matching.filter(item => !isOccurrenceAllocated(user, item, editingUnitId));
      const allocated = matching.length - available.length;
      if (available.length) {
        cell.classList.add("unit-class-available");
        const marker = document.createElement("span");
        marker.className = "unit-calendar-note available-note";
        marker.textContent = "Available";
        cell.appendChild(marker);
      }
      if (allocated > 0) {
        const label = document.createElement("span");
        label.className = "unit-calendar-note allocated-note";
        label.textContent = allocated === 1 ? "Used by another unit" : `${allocated} blocks already used`;
        cell.appendChild(label);
      }
    }

    if (unitDraft.startDate === dateKey) {
      cell.classList.add("unit-start-date");
      const colour = normalizeHexColour(unitDraft.colour) || "#8C6CFF";
      cell.style.setProperty("--unit-colour", colour);
      cell.style.setProperty("--unit-colour-soft", hexToRgba(colour, 0.22));
      if (!lessonsHere.length) {
        const startLabel = document.createElement("span");
        startLabel.className = "unit-calendar-note unit-start-note";
        startLabel.textContent = "Unit starts";
        cell.appendChild(startLabel);
      }
    }

    cell.addEventListener("click", () => chooseUnitStartDate(dateKey));
    grid.appendChild(cell);
  }
  renderUnitLessonPreview();
}

function chooseUnitStartDate(dateKey) {
  unitDraft.startDate = dateKey;
  const user = getActiveUser();
  if (!normalizeHexColour(unitDraft.colour) || unitColourUsedByClass(user, unitDraft.classSpec, unitDraft.colour, editingUnitId)) {
    unitDraft.colour = suggestedUnitColour(user, unitDraft.classSpec, editingUnitId, unitDraft.colour);
  }
  syncUnitColourControls();
  const result = allocateLessons(unitDraft, user, dateKey, editingUnitId);
  unitDraft.lessons = result.lessons;
  unitDraft.needsScheduleReview = result.scheduledMinutes < unitDraft.targetMinutes;
  renderUnitCalendar();
}

function allocateLessons(unit, user, startDateKey, excludeUnitId = null, preserve = []) {
  const range = getRelevantDateRange(user);
  if (!range) return { lessons: preserve, scheduledMinutes: preserve.reduce((sum, lesson) => sum + lesson.durationMinutes, 0) };
  const fixed = preserve.map(normalizeLesson).sort((a, b) => a.dateKey.localeCompare(b.dateKey) || a.startTime.localeCompare(b.startTime));
  let scheduledMinutes = fixed.reduce((sum, lesson) => sum + lesson.durationMinutes, 0);
  let date = parseLocalDate(startDateKey);
  const end = parseLocalDate(range.end);
  const lessons = [...fixed];

  while (date <= end && scheduledMinutes < unit.targetMinutes) {
    const dateKey = getLocalDateKey(date);
    if (!isNoSchoolDate(user, dateKey)) {
      const occurrences = dedupeClassOccurrences(
        getOccurrencesForDate(date, user).filter(item => classMatches(item.block, unit.classSpec))
      );
      for (const occurrence of occurrences) {
        if (scheduledMinutes >= unit.targetMinutes) break;
        if (isOccurrenceAllocated(user, occurrence, excludeUnitId)) continue;
        const key = occurrenceAllocationKey(occurrence);
        if (lessons.some(lesson => lessonOccurrenceKey(lesson) === key)) continue;
        const minutes = durationMinutes(occurrence.block.startTime, occurrence.block.endTime);
        if (minutes <= 0) continue;
        const lesson = normalizeLesson({
          id: makeId("lesson"),
          sequence: lessons.length + 1,
          title: `Lesson ${lessons.length + 1}`,
          customTitle: "",
          dateKey,
          startTime: occurrence.block.startTime,
          endTime: occurrence.block.endTime,
          durationMinutes: minutes,
          termId: occurrence.termId,
          versionId: occurrence.versionId,
          blockId: occurrence.blockId,
          classSpec: structuredCloneSafe(unit.classSpec),
          lessonPlanStatus: "placeholder",
          locked: false,
          createdAt: new Date().toISOString()
        });
        lessons.push(lesson);
        scheduledMinutes += minutes;
      }
    }
    date.setDate(date.getDate() + 1);
  }

  lessons.sort((a, b) => a.dateKey.localeCompare(b.dateKey) || a.startTime.localeCompare(b.startTime));
  lessons.forEach((lesson, index) => {
    lesson.sequence = index + 1;
    lesson.title = `Lesson ${index + 1}`;
  });
  return { lessons, scheduledMinutes };
}

function renderUnitLessonPreview() {
  const summary = $("unitScheduleSummary");
  if (!unitDraft.startDate) {
    summary.classList.add("hidden");
    return;
  }
  const scheduled = unitDraft.lessons.reduce((sum, lesson) => sum + lesson.durationMinutes, 0);
  const difference = scheduled - unitDraft.targetMinutes;
  summary.innerHTML = `<strong>Target:</strong> ${escapeHTML(hoursLabel(unitDraft.targetMinutes))} · <strong>Scheduled capacity:</strong> ${escapeHTML(hoursLabel(scheduled))}${difference > 0 ? ` · <strong>Surplus:</strong> ${escapeHTML(hoursLabel(difference))}` : difference < 0 ? ` · <strong>Short:</strong> ${escapeHTML(hoursLabel(Math.abs(difference)))}` : ""}`;
  summary.classList.remove("hidden");
}

function saveUnitFromWizard() {
  const user = getActiveUser();
  if (!user || readOnlyMode) return;
  if (!unitDraft.startDate && !confirm("No unit start date has been selected. Save this unit as a draft without lesson placeholders?")) return;
  if (unitDraft.startDate) {
    const colour = normalizeHexColour(unitDraft.colour);
    if (!colour) return alert("Choose a valid unit colour before saving.");
    if (unitColourUsedByClass(user, unitDraft.classSpec, colour, editingUnitId)) {
      return alert("That colour is already used by another unit in this grade/subject. Choose a different colour so units remain easy to distinguish.");
    }
    unitDraft.colour = colour;
  }

  unitDraft.name = $("unitNameInput").value.trim() || unitDraft.name;
  unitDraft.selectedCurriculum = buildSelectedCurriculumSnapshots();
  unitDraft.updatedAt = new Date().toISOString();
  if (!unitDraft.createdAt) unitDraft.createdAt = unitDraft.updatedAt;

  const index = user.units.findIndex(unit => unit.id === unitDraft.id);
  if (index >= 0) user.units[index] = normalizeUnit(unitDraft);
  else user.units.push(normalizeUnit(unitDraft));
  user.units.sort((a, b) => (a.startDate || "9999").localeCompare(b.startDate || "9999"));
  saveData();
  unitWizardDialog.close();
  renderTeacherHQ();
  renderUnitPlannerList(user);
  openUnitDetail(unitDraft.id);
  unitDraft = null;
  editingUnitId = null;
}

function reconcileFutureUnits(user, fromDateKey) {
  const todayKey = getLocalDateKey();
  const reflowStart = fromDateKey < todayKey ? todayKey : fromDateKey;
  user.units.forEach(unit => {
    if (!unit.startDate || !unit.targetMinutes) return;
    const fixed = unit.lessons.filter(lesson => lesson.dateKey < reflowStart || lesson.locked || lesson.lessonPlanStatus !== "placeholder");
    const originalTarget = unit.targetMinutes;
    const temp = { ...unit, targetMinutes: originalTarget };
    const result = allocateLessons(temp, user, reflowStart > unit.startDate ? reflowStart : unit.startDate, unit.id, fixed);
    unit.lessons = result.lessons;
    unit.needsScheduleReview = result.scheduledMinutes < originalTarget;
    unit.updatedAt = new Date().toISOString();
  });
}

/* ============================================================
   UNIT DETAILS + SELECTABLE LESSON PLACEHOLDERS
============================================================ */

$("closeUnitDetailButton").addEventListener("click", () => unitDetailDialog.close());
$("editUnitButton").addEventListener("click", () => {
  const unitId = $("editUnitButton").dataset.unitId;
  unitDetailDialog.close();
  openUnitWizard(unitId);
});
$("closeLessonPlaceholderButton").addEventListener("click", () => lessonPlaceholderDialog.close());
$("startLessonPlannerButton").addEventListener("click", () => {
  if (!selectedLessonContext) return;
  alert("This lesson placeholder is ready for the Lesson Plan Builder. The guided lesson-planning wizard is the next feature we will attach here.");
});

function openUnitDetail(unitId) {
  const user = getActiveUser();
  const unit = getUnitById(unitId, user);
  if (!unit) return;
  $("unitDetailHeading").textContent = unit.name;
  $("unitDetailHeading").style.setProperty("--unit-colour", unit.colour || "#8C6CFF");
  $("unitDetailMeta").textContent = `${classLabel(unit.classSpec)}${unit.startDate ? ` · Starts ${formatDate(unit.startDate)}` : " · Draft"}`;
  $("editUnitButton").dataset.unitId = unit.id;

  const scheduled = unit.lessons.reduce((sum, lesson) => sum + lesson.durationMinutes, 0);
  const stats = $("unitDetailStats");
  stats.innerHTML = "";
  [
    ["Target", hoursLabel(unit.targetMinutes)],
    ["Scheduled", hoursLabel(scheduled)],
    ["Lessons", String(unit.lessons.length)],
    ["Curriculum Items", String(unit.selectedCurriculum.length)]
  ].forEach(([label, value]) => {
    const card = document.createElement("div");
    card.className = "summary-card";
    card.innerHTML = `<span class="summary-label">${escapeHTML(label)}</span><strong>${escapeHTML(value)}</strong>`;
    stats.appendChild(card);
  });

  const curriculumContainer = $("unitDetailCurriculum");
  curriculumContainer.innerHTML = "";
  if (!unit.selectedCurriculum.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "No curriculum selected yet. You can add it later.";
    curriculumContainer.appendChild(empty);
  } else {
    unit.selectedCurriculum.forEach(record => {
      const item = document.createElement("div");
      item.className = "curriculum-summary-item";
      item.innerHTML = `<strong>${escapeHTML(record.type)}</strong><span>${escapeHTML(record.text)}</span><small>${escapeHTML(record.grade)} · ${escapeHTML(record.organizingIdea)} · ${escapeHTML(record.guidingQuestion)}</small>`;
      curriculumContainer.appendChild(item);
    });
  }

  const lessonList = $("unitLessonList");
  lessonList.innerHTML = "";
  if (!unit.lessons.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "This unit is currently saved as a draft without lesson placeholders.";
    lessonList.appendChild(empty);
  } else {
    unit.lessons.forEach(lesson => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "unit-lesson-button";
      button.innerHTML = `<strong>${escapeHTML(lessonDisplayTitle(lesson))}</strong><span>${escapeHTML(formatLongDate(lesson.dateKey))}</span><small>${escapeHTML(formatTime(lesson.startTime))}–${escapeHTML(formatTime(lesson.endTime))} · ${escapeHTML(hoursLabel(lesson.durationMinutes))} · Lesson plan not built</small>`;
      button.addEventListener("click", () => openLessonPlaceholder(unit.id, lesson.id));
      lessonList.appendChild(button);
    });
  }
  unitDetailDialog.showModal();
}

function openLessonPlaceholder(unitId, lessonId) {
  const user = getActiveUser();
  const unit = getUnitById(unitId, user);
  const lesson = unit?.lessons.find(item => item.id === lessonId);
  if (!unit || !lesson) return;
  selectedLessonContext = { unitId, lessonId };
  $("lessonPlaceholderHeading").textContent = `${lessonDisplayTitle(lesson)} — ${unit.name}`;
  $("lessonPlaceholderMeta").textContent = `${formatLongDate(lesson.dateKey)} · ${formatTime(lesson.startTime)}–${formatTime(lesson.endTime)}`;
  $("lessonPlaceholderDetails").innerHTML = `
    <div class="summary-card"><span class="summary-label">Class</span><strong>${escapeHTML(classLabel(unit.classSpec))}</strong></div>
    <div class="summary-card"><span class="summary-label">Allocated Time</span><strong>${escapeHTML(hoursLabel(lesson.durationMinutes))}</strong></div>
    <div class="summary-card"><span class="summary-label">Unit</span><strong>${escapeHTML(unit.name)}</strong></div>
    <div class="summary-card"><span class="summary-label">Status</span><strong>Lesson plan not built</strong></div>`;
  $("startLessonPlannerButton").classList.toggle("hidden", readOnlyMode);
  lessonPlaceholderDialog.showModal();
}

/* ============================================================
   BACKUP + RESTORE + READ-ONLY SHARING
============================================================ */

$("downloadBackupButton").addEventListener("click", downloadDailyBackup);
$("backupReminderButton").addEventListener("click", downloadDailyBackup);
$("downloadReadViewButton").addEventListener("click", downloadReadView);
$("previewReadViewButton").addEventListener("click", toggleReadView);
$("restoreBackupButton").addEventListener("click", () => restoreBackupInput.click());
$("restoreBackupHQButton").addEventListener("click", () => restoreBackupInput.click());
$("openReadOnlyButton").addEventListener("click", () => readOnlyFileInput.click());
restoreBackupInput.addEventListener("change", restoreBackupFromFile);
readOnlyFileInput.addEventListener("change", openReadOnlyFromFile);

function renderBackupState(user) {
  if (readOnlySource === "shared") {
    backupReminder.classList.add("hidden");
    backupStatusText.textContent = "Read-only shared file — no local working data is being changed.";
    return;
  }
  const todayKey = getLocalDateKey();
  if (user.lastBackupDate === todayKey) {
    backupReminder.classList.add("hidden");
    backupStatusText.textContent = `Daily backup downloaded today (${formatDate(todayKey)}).`;
  } else {
    backupReminder.classList.remove("hidden");
    backupStatusText.textContent = user.lastBackupDate
      ? `Last downloaded backup: ${formatDate(user.lastBackupDate)}.`
      : "No downloaded backup has been recorded for this profile yet.";
  }
}

function downloadDailyBackup() {
  const user = getActiveUser();
  if (!user || readOnlySource === "shared") return;
  const todayKey = getLocalDateKey();
  const html = buildReadableExportHTML(user, {
    title: `Teacher HQ Backup — ${todayKey}`,
    includeRestoreData: true,
    includeReadOnlyData: false,
    fullAppData: appData
  });
  downloadBlob(html, `TeacherHQ_Backup_${todayKey}.html`, "text/html");
  user.lastBackupDate = todayKey;
  saveData();
  renderBackupState(user);
}

function downloadReadView() {
  const user = getActiveUser();
  if (!user) return;
  const todayKey = getLocalDateKey();
  const html = buildReadableExportHTML(user, {
    title: `Teacher HQ Read View — ${user.username}`,
    includeRestoreData: false,
    includeReadOnlyData: true
  });
  downloadBlob(html, `TeacherHQ_ReadView_${user.username.replace(/\s+/g, "_")}_${todayKey}.html`, "text/html");
}

function toggleReadView() {
  if (readOnlySource === "shared") return;
  if (readOnlySource === "preview") {
    exitReadView();
    renderTeacherHQ();
    return;
  }
  readOnlyMode = true;
  readOnlySource = "preview";
  renderTeacherHQ();
}

function exitReadView() {
  readOnlyMode = false;
  readOnlySource = null;
  sharedReadOnlyUser = null;
  document.body.classList.remove("read-only");
  readOnlyBanner.classList.add("hidden");
  if ($("previewReadViewButton")) $("previewReadViewButton").textContent = "Preview Read View";
}

async function openReadOnlyFromFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    let user = null;

    const readOnlyMatch = text.match(/<script[^>]*id=["']teacherHQReadOnlyData["'][^>]*>([\s\S]*?)<\/script>/i);
    if (readOnlyMatch) {
      const payload = JSON.parse(readOnlyMatch[1]);
      user = payload?.user || null;
    }

    if (!user) {
      const backupMatch = text.match(/<script[^>]*id=["']teacherHQBackupData["'][^>]*>([\s\S]*?)<\/script>/i);
      if (backupMatch) {
        const backup = normalizeData(JSON.parse(backupMatch[1]));
        user = backup.users.find(item => item.id === backup.activeUserId) || backup.users[0] || null;
      }
    }

    if (!user && (file.name.toLowerCase().endsWith(".json") || text.trim().startsWith("{"))) {
      const parsed = JSON.parse(text);
      if (parsed.user) user = parsed.user;
      else if (Array.isArray(parsed.users)) {
        const normalized = normalizeData(parsed);
        user = normalized.users.find(item => item.id === normalized.activeUserId) || normalized.users[0] || null;
      }
    }

    if (!user) throw new Error("No Teacher HQ read-only data was found in that file.");
    sharedReadOnlyUser = normalizeUser(structuredCloneSafe(user));
    readOnlyMode = true;
    readOnlySource = "shared";
    userSelectionView.classList.add("hidden");
    teacherHQView.classList.remove("hidden");
    renderCurrentUser();
    renderTeacherHQ();
  } catch (error) {
    console.error(error);
    alert(`Could not open that read-only file: ${error.message}`);
  } finally {
    readOnlyFileInput.value = "";
  }
}

async function restoreBackupFromFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    let restored;
    if (file.name.toLowerCase().endsWith(".json") || text.trim().startsWith("{")) {
      restored = JSON.parse(text);
    } else {
      const match = text.match(/<script[^>]*id=["']teacherHQBackupData["'][^>]*>([\s\S]*?)<\/script>/i);
      if (!match) throw new Error("No restorable Teacher HQ backup data was found in that file. Read View files should be opened with ‘Open Read-Only File’. ");
      restored = JSON.parse(match[1]);
    }
    if (!restored || !Array.isArray(restored.users)) throw new Error("This does not look like a valid Teacher HQ backup.");
    if (!confirm("Restore this backup? This will replace the Teacher HQ data currently stored in this browser.")) return;
    appData = normalizeData(restored);
    activeUserId = appData.activeUserId || null;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
    alert("Backup restored successfully.");
    if (activeUserId && getActiveUser()) showTeacherHQ(); else showUserSelection();
  } catch (error) {
    console.error(error);
    alert(`Could not restore that backup: ${error.message}`);
  } finally {
    restoreBackupInput.value = "";
  }
}

function downloadBlob(contents, filename, type) {
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function safeJSONForScript(value) {
  return JSON.stringify(value)
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("&", "\\u0026");
}

function buildReadableExportHTML(user, { title, includeRestoreData, includeReadOnlyData, fullAppData = null }) {
  const termsHTML = buildReadableTermsHTML(user);
  const exceptionsHTML = buildReadableExceptionsHTML(user);
  const unitsHTML = buildReadableUnitsHTML(user);
  const monthsHTML = buildReadableCalendarHTML(user);
  const embeddedBackup = includeRestoreData
    ? `<script id="teacherHQBackupData" type="application/json">${safeJSONForScript(fullAppData)}</script>`
    : "";
  const embeddedReadOnly = includeReadOnlyData
    ? `<script id="teacherHQReadOnlyData" type="application/json">${safeJSONForScript({ kind: "teacher-hq-readonly-share", schemaVersion: 4, user })}</script>`
    : "";

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${escapeHTML(title)}</title>
<style>
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;margin:0;background:#f5f5f7;color:#1d1d1f}main{width:min(1120px,92%);margin:auto;padding:40px 0 80px}h1{font-size:38px;margin-bottom:8px}h2{margin-top:36px}.muted{color:#74747a}.card{background:#fff;border:1px solid #e3e3e8;border-radius:16px;padding:16px;margin:12px 0}.week{display:grid;grid-template-columns:repeat(7,1fr);gap:6px}.day{min-height:105px;background:#fff;border:1px solid #e3e3e8;border-radius:10px;padding:7px;font-size:12px}.day.past{opacity:.62}.date{font-weight:800;margin-bottom:5px}.item{margin:4px 0;padding:4px 6px;border-radius:6px}.planned{background:#ecf8f1;border-left:3px solid #2e9d62}.unplanned{background:#fff1f1;border-left:3px solid #e5484d}.other{background:#f1f1f3;border-left:3px solid #8c8c94}.off{background:#eef5ff;border-left:3px solid #4e8de8}.conflict{box-shadow:inset 0 0 0 2px #e3be4d}.weekday{font-weight:700;text-align:center;color:#74747a}.schedule{display:grid;grid-template-columns:repeat(7,minmax(130px,1fr));gap:8px;overflow:auto}.col{background:#fff;border:1px solid #e3e3e8;border-radius:12px;padding:9px;min-width:130px}.block{padding:7px;border-radius:8px;background:#f1f1f3;margin:6px 0;font-size:12px}.lesson{padding:8px;border-left:3px solid #8c6cff;margin:6px 0;background:#f5f1ff}@media print{body{background:#fff}.day,.card,.col{break-inside:avoid}}
</style></head><body><main>
<h1>${escapeHTML(title)}</h1><p class="muted">Profile: ${escapeHTML(user.username)} · Generated ${escapeHTML(new Date().toLocaleString("en-CA"))}</p>
${includeRestoreData ? '<p class="muted"><strong>Restorable backup:</strong> this file contains the machine-readable data needed to restore Teacher HQ.</p>' : '<p class="muted"><strong>Read-only copy:</strong> this file can be opened directly or uploaded through “Open Read-Only File” on Teacher HQ.</p>'}
<h2>School Terms</h2>${termsHTML || '<p class="muted">No school terms saved.</p>'}
<h2>Days Off &amp; PD Days</h2>${exceptionsHTML || '<p class="muted">No days off saved.</p>'}
<h2>Unit Plans</h2>${unitsHTML || '<p class="muted">No units saved.</p>'}
<h2>Calendar Record</h2>${monthsHTML || '<p class="muted">No dated schedule information available.</p>'}
</main>${embeddedBackup}${embeddedReadOnly}</body></html>`;
}

function buildReadableTermsHTML(user) {
  return user.terms.map(term => {
    const version = getLatestScheduleVersion(term);
    const columns = WEEKDAYS.map(day => {
      const blocks = (version?.scheduleBlocks || []).filter(block => block.weekday === day).map(block => {
        const title = block.blockType === "Instructional Time" ? `${gradeDisplay(block.grades)} ${block.subject}`.trim() : block.label || block.blockType;
        return `<div class="block"><strong>${escapeHTML(formatTime(block.startTime))}–${escapeHTML(formatTime(block.endTime))}</strong><br>${escapeHTML(title)}<br><span class="muted">${escapeHTML(block.blockType)}</span></div>`;
      }).join("");
      return `<div class="col"><strong>${escapeHTML(day)}</strong>${blocks || '<p class="muted">—</p>'}</div>`;
    }).join("");
    return `<section class="card"><strong>${escapeHTML(term.name)}</strong><p class="muted">${escapeHTML(formatDate(term.startDate))} – ${escapeHTML(formatDate(term.endDate))} · ${term.scheduleVersions.length} schedule version${term.scheduleVersions.length === 1 ? "" : "s"}</p><div class="schedule">${columns}</div></section>`;
  }).join("");
}

function buildReadableExceptionsHTML(user) {
  return user.calendarExceptions.map(item => {
    const details = [];
    if (item.description) details.push(item.description);
    if (item.location) details.push(`Location: ${item.location}`);
    if (item.notes) details.push(`Notes: ${item.notes}`);
    return `<div class="card"><strong>${escapeHTML(exceptionDateLabel(item))} · ${escapeHTML(item.label || item.type)}</strong><p class="muted">${escapeHTML(item.type)}${details.length ? ` · ${escapeHTML(details.join(" · "))}` : ""}</p></div>`;
  }).join("");
}

function buildReadableUnitsHTML(user) {
  return user.units.map(unit => {
    const scheduled = unit.lessons.reduce((sum, lesson) => sum + lesson.durationMinutes, 0);
    const curriculum = unit.selectedCurriculum.map(record => `<li><strong>${escapeHTML(record.type)}:</strong> ${escapeHTML(record.text)}</li>`).join("");
    const lessons = unit.lessons.map(lesson => `<div class="lesson" style="border-left-color:${escapeHTML(unit.colour || "#8C6CFF")};background:${escapeHTML(hexToRgba(unit.colour || "#8C6CFF", 0.10))}"><strong>${escapeHTML(lessonDisplayTitle(lesson))}</strong> · ${escapeHTML(formatDate(lesson.dateKey))} · ${escapeHTML(formatTime(lesson.startTime))}–${escapeHTML(formatTime(lesson.endTime))}</div>`).join("");
    return `<section class="card"><strong>${escapeHTML(unit.name)}</strong><p class="muted">${escapeHTML(classLabel(unit.classSpec))} · Target ${escapeHTML(hoursLabel(unit.targetMinutes))} · Scheduled ${escapeHTML(hoursLabel(scheduled))}</p>${curriculum ? `<ul>${curriculum}</ul>` : '<p class="muted">No curriculum selected.</p>'}${lessons || '<p class="muted">No lesson placeholders.</p>'}</section>`;
  }).join("");
}

function buildReadableCalendarHTML(user) {
  const starts = user.terms.map(term => term.startDate).filter(Boolean).sort();
  const ends = user.terms.map(term => term.endDate).filter(Boolean).sort();
  if (!starts.length || !ends.length) return "";
  let cursor = new Date(parseLocalDate(starts[0]).getFullYear(), parseLocalDate(starts[0]).getMonth(), 1);
  const end = parseLocalDate(ends.at(-1));
  const sections = [];
  while (cursor <= end) {
    sections.push(buildReadableMonthHTML(cursor.getFullYear(), cursor.getMonth(), user));
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }
  return sections.join("");
}

function buildReadableMonthHTML(year, month, user) {
  const title = new Date(year, month, 1).toLocaleDateString("en-CA", { month: "long", year: "numeric" });
  const cells = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => `<div class="weekday">${day}</div>`);
  const first = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  for (let i = 0; i < first; i++) cells.push("<div></div>");
  const todayKey = getLocalDateKey();
  for (let day = 1; day <= days; day++) {
    const date = new Date(year, month, day);
    const dateKey = getLocalDateKey(date);
    const exception = getExceptionForDate(user, dateKey);
    let items = "";
    if (exception) {
      items = `<div class="item off"><strong>${escapeHTML(exception.label || exception.type)}</strong><br><span class="muted">${escapeHTML(exception.type)}</span></div>`;
    } else {
      const occurrences = getOccurrencesForDate(date, user);
      items = occurrences.map(occurrence => {
        const block = occurrence.block;
        let statusClass = "other";
        if (block.blockType === "Instructional Time") statusClass = occurrence.planned ? "planned" : "unplanned";
        if (occurrence.conflict) statusClass += " conflict";
        const blockTitle = block.blockType === "Instructional Time" ? `${gradeDisplay(block.grades)} ${block.subject}`.trim() : block.label || block.blockType;
        const allocations = findUnitLessonsForOccurrence(user, occurrence).map(({ unit, lesson }) => ` · ${unit.name}/${lesson.title}`).join("");
        return `<div class="item ${statusClass}">${escapeHTML(formatTime(block.startTime))} ${escapeHTML(blockTitle)}${escapeHTML(allocations)}</div>`;
      }).join("");
    }
    cells.push(`<div class="day ${dateKey < todayKey ? "past" : ""}"><div class="date">${day}</div>${items}</div>`);
  }
  return `<section><h3>${escapeHTML(title)}</h3><div class="week">${cells.join("")}</div></section>`;
}

/* ============================================================
   DIALOG BACKDROPS + START
============================================================ */

[
  createUserDialog, termDialog, scheduleBlockDialog, dayDetailsDialog,
  daysOffDialog, unitPlannerDialog, unitWizardDialog, unitDetailDialog, lessonPlaceholderDialog
].forEach(dialog => {
  dialog?.addEventListener("click", event => {
    if (event.target === dialog) dialog.close();
  });
});

initializeApp();
