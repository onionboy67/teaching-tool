/* ============================================================
   TEACHER HQ
   Profiles + School Terms + schedule history + Days Off
   Unit Planner + lesson placeholders + portable backup/read view
============================================================ */

const STORAGE_KEY = "teacherHQData_v6";
const LEGACY_STORAGE_KEYS = ["teacherHQData_v5", "teacherHQData_v4", "teacherHQData_v3", "teacherHQData_v2", "teacherHQData_v1"];

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

const BLOOM_REFERENCE = window.TEACHER_HQ_BLOOM && typeof window.TEACHER_HQ_BLOOM === "object"
  ? window.TEACHER_HQ_BLOOM
  : { levels: {}, preferred: {} };

const BLOOM_LEVELS = ["Remember", "Understand", "Apply", "Analyze", "Evaluate", "Create"];
const BLOOM_BANDS = {
  Remember: "green",
  Understand: "green",
  Apply: "blue",
  Analyze: "blue",
  Evaluate: "black",
  Create: "black"
};

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

let activeUnitWorkspaceId = null;
let activeUnitWorkspaceSection = null;
let unitWorkspaceVisibleDate = null;
let workspaceCurriculumMode = null;
let workspaceResourceEditorId = null;
let workspaceModalityEditorId = null;
let workspaceIndigenousEditorId = null;
let workspaceFieldTripEditorId = null;

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
  return { schemaVersion: 6, activeUserId: null, users: [] };
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
  normalized.schemaVersion = 6;
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
    bloomOverrides: user.bloomOverrides && typeof user.bloomOverrides === "object"
      ? { ...user.bloomOverrides }
      : {},
    resourceLibrary: Array.isArray(user.resourceLibrary)
      ? user.resourceLibrary.map(normalizeResourceRecord)
      : [],
    learningModalities: Array.isArray(user.learningModalities)
      ? user.learningModalities.map(normalizeLearningModality)
      : [],
    indigenousResources: Array.isArray(user.indigenousResources)
      ? user.indigenousResources.map(normalizeIndigenousResource)
      : [],
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

function normalizeResourceRecord(resource) {
  const kind = ["reference", "physical", "online", "book"].includes(resource.kind)
    ? resource.kind
    : "online";

  return {
    id: resource.id || makeId("resource"),
    kind,
    referenceKind: kind === "reference" && ["book", "online"].includes(resource.referenceKind)
      ? resource.referenceKind
      : "",
    title: String(resource.title || "Untitled Resource").trim(),
    author: String(resource.author || "").trim(),
    publisher: String(resource.publisher || "").trim(),
    year: String(resource.year || "").trim(),
    edition: String(resource.edition || "").trim(),
    url: String(resource.url || "").trim(),
    location: String(resource.location || "").trim(),
    notes: String(resource.notes || "").trim(),
    createdAt: resource.createdAt || new Date().toISOString(),
    updatedAt: resource.updatedAt || new Date().toISOString()
  };
}

function normalizeLearningModality(modality) {
  return {
    id: modality.id || makeId("modality"),
    title: String(modality.title || "Learning Modality").trim(),
    description: String(modality.description || "").trim(),
    createdAt: modality.createdAt || new Date().toISOString(),
    updatedAt: modality.updatedAt || new Date().toISOString()
  };
}

function normalizeIndigenousResource(resource) {
  const normalized = normalizeResourceRecord({ ...resource, id: resource.id || makeId("indigenous-resource") });
  return {
    ...normalized,
    description: String(resource.description || "").trim(),
    grades: normalizeGradeArray(Array.isArray(resource.grades) ? resource.grades : []),
    subjects: Array.isArray(resource.subjects)
      ? [...new Set(resource.subjects.map(value => String(value || "").trim()).filter(Boolean))]
      : []
  };
}

function normalizeFieldTrip(fieldTrip) {
  const startDate = fieldTrip.startDate || fieldTrip.date || "";
  const endDate = fieldTrip.endDate || startDate;
  return {
    id: fieldTrip.id || makeId("field-trip"),
    title: String(fieldTrip.title || "Field Trip").trim(),
    description: String(fieldTrip.description || "").trim(),
    purpose: String(fieldTrip.purpose || "").trim(),
    location: String(fieldTrip.location || "").trim(),
    startDate,
    endDate: endDate && startDate && endDate < startDate ? startDate : endDate,
    manualOverride: Boolean(fieldTrip.manualOverride),
    curriculumIds: Array.isArray(fieldTrip.curriculumIds) ? [...new Set(fieldTrip.curriculumIds)] : [],
    createdAt: fieldTrip.createdAt || new Date().toISOString(),
    updatedAt: fieldTrip.updatedAt || new Date().toISOString()
  };
}

function normalizeUnit(unit) {
  const classSpec = unit.classSpec || {
    grades: Array.isArray(unit.grades) ? unit.grades : [],
    subject: unit.subject || ""
  };

  const legacyWorking = Array.isArray(unit.selectedCurriculum)
    ? unit.selectedCurriculum.map(record => structuredCloneSafe(record))
    : [];

  const sourceLinks = unit.curriculumLinks && typeof unit.curriculumLinks === "object"
    ? unit.curriculumLinks
    : {};

  const curriculumLinks = {
    working: Array.isArray(sourceLinks.working)
      ? sourceLinks.working.map(record => structuredCloneSafe(record))
      : legacyWorking,
    prerequisite: Array.isArray(sourceLinks.prerequisite)
      ? sourceLinks.prerequisite.map(record => structuredCloneSafe(record))
      : [],
    lookingAhead: Array.isArray(sourceLinks.lookingAhead)
      ? sourceLinks.lookingAhead.map(record => structuredCloneSafe(record))
      : [],
    crossCurricular: Array.isArray(sourceLinks.crossCurricular)
      ? sourceLinks.crossCurricular.map(record => structuredCloneSafe(record))
      : []
  };

  return {
    id: unit.id || makeId("unit"),
    name: unit.name || "Untitled Unit",
    classSpec: {
      grades: normalizeGradeArray(Array.isArray(classSpec.grades) ? classSpec.grades : []),
      subject: classSpec.subject || ""
    },
    colour: normalizeHexColour(unit.colour) || "",
    selectedCurriculum: curriculumLinks.working.map(record => structuredCloneSafe(record)),
    curriculumLinks,
    targetMinutes: Number(unit.targetMinutes) || 0,
    allocationMethod: unit.allocationMethod || "hours",
    allocationPercentage: Number(unit.allocationPercentage) || null,
    availableMinutesAtCreation: Number(unit.availableMinutesAtCreation) || 0,
    startDate: unit.startDate || "",
    lessons: Array.isArray(unit.lessons) ? unit.lessons.map(normalizeLesson) : [],
    workspace: normalizeUnitWorkspace(unit.workspace),
    createdAt: unit.createdAt || new Date().toISOString(),
    updatedAt: unit.updatedAt || new Date().toISOString(),
    needsScheduleReview: Boolean(unit.needsScheduleReview)
  };
}

function normalizeUnitWorkspace(workspace) {
  const source = workspace && typeof workspace === "object" ? workspace : {};
  const simulation = source.simulation && typeof source.simulation === "object" ? source.simulation : {};
  const project = source.project && typeof source.project === "object" ? source.project : {};

  return {
    ...structuredCloneSafe(source),
    simulation: {
      enabled: typeof simulation.enabled === "boolean" ? simulation.enabled : null,
      title: String(simulation.title || "").trim(),
      description: String(simulation.description || "").trim()
    },
    project: {
      enabled: typeof project.enabled === "boolean" ? project.enabled : null,
      title: String(project.title || "").trim(),
      description: String(project.description || "").trim(),
      skillIds: Array.isArray(project.skillIds) ? [...new Set(project.skillIds)] : []
    },
    resourceIds: Array.isArray(source.resourceIds) ? [...new Set(source.resourceIds)] : [],
    fieldTrips: Array.isArray(source.fieldTrips) ? source.fieldTrips.map(normalizeFieldTrip) : [],
    learningModalityIds: Array.isArray(source.learningModalityIds)
      ? [...new Set(source.learningModalityIds)]
      : [],
    indigenousVoiceResourceIds: Array.isArray(source.indigenousVoiceResourceIds)
      ? [...new Set(source.indigenousVoiceResourceIds)]
      : []
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
    override: lesson.override && typeof lesson.override === "object"
      ? structuredCloneSafe(lesson.override)
      : null,
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
  const totalMinutes = Math.max(0, Math.round(Number(minutes) || 0));
  const hours = Math.floor(totalMinutes / 60);
  const remainder = totalMinutes % 60;

  if (hours && remainder) return `${hours} h ${remainder} min`;
  if (hours) return `${hours} h`;
  return `${remainder} min`;
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

    const fieldTrips = user ? getFieldTripsForDate(user, dateKey) : [];
    fieldTrips.forEach(({ unit, trip }) => {
      const chip = document.createElement("span");
      chip.className = "overview-field-trip-chip";
      chip.style.setProperty("--field-trip-colour", normalizeHexColour(unit.colour) || "#FF7043");
      chip.textContent = `[FIELD TRIP] ${trip.title}`;
      chip.title = `${unit.name} · ${trip.location || "Field trip"}`;
      cell.appendChild(chip);
    });

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
  const fieldTrips = getFieldTripsForDate(user, dateKey);
  appendFieldTripDayCards(dayDetailsList, fieldTrips);
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
    empty.textContent = fieldTrips.length
      ? "This is a Day Off. The field trip above exists because its date was added with Manual Override."
      : "No lessons or teaching blocks can be scheduled on this date.";
    dayDetailsList.appendChild(empty);
    dayDetailsDialog.showModal();
    return;
  }

  dayExceptionSummary.classList.add("hidden");
  const occurrences = getOccurrencesForDate(parseLocalDate(dateKey), user);
  if (occurrences.length === 0) {
    const empty = document.createElement("p");
    empty.className = "section-subtitle";
    empty.textContent = fieldTrips.length
      ? "No regular scheduled blocks on this date."
      : "No scheduled blocks on this date.";
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
      allocation.textContent = `${unit.name} · ${lessonDisplayTitleForUnit(unit, lesson)}`;
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

$("selectAllCurriculumButton").addEventListener("click", () => {
  getCurriculumForClass(unitDraft?.classSpec).forEach(record => unitCurriculumSelection.add(record.id));
  syncCurriculumSelectionUI();
});

$("clearCurriculumSelectionButton").addEventListener("click", () => {
  unitCurriculumSelection.clear();
  syncCurriculumSelectionUI();
});

["unitHoursWholeInput", "unitMinutesSelect"].forEach(id => {
  $(id).addEventListener("input", () => {
    if (getTargetMinutesFromInputs() > 0) $("unitPercentageInput").value = "";
    updateAllocationSummary();
  });
  $(id).addEventListener("change", () => {
    if (getTargetMinutesFromInputs() > 0) $("unitPercentageInput").value = "";
    updateAllocationSummary();
  });
});

$("unitPercentageInput").addEventListener("input", () => {
  if ($("unitPercentageInput").value) {
    $("unitHoursWholeInput").value = "";
    $("unitMinutesSelect").value = "0";
  }
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

function openUnitWizard(unitId = null, startStep = 1) {
  const user = getActiveUser();
  if (!user || readOnlyMode) return;
  editingUnitId = unitId;
  const existing = unitId ? getUnitById(unitId, user) : null;
  unitDraft = existing ? structuredCloneSafe(existing) : normalizeUnit({
    id: makeId("unit"),
    name: "",
    classSpec: { grades: [], subject: "" },
    colour: "",
    selectedCurriculum: [],
    curriculumLinks: { working: [], prerequisite: [], lookingAhead: [], crossCurricular: [] },
    targetMinutes: 0,
    allocationMethod: "hours",
    startDate: "",
    lessons: [],
    workspace: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  unitCurriculumSelection = new Set(
    (unitDraft.curriculumLinks?.working || unitDraft.selectedCurriculum || [])
      .map(record => record.id)
  );

  $("unitWizardHeading").textContent = existing ? "Edit Unit" : "Create Unit";
  $("unitNameInput").value = unitDraft.name === "Untitled Unit" ? "" : unitDraft.name;
  populateUnitClassSelect();
  selectExistingUnitClass();
  $("unitManualGrade").value = "";
  $("unitManualSubject").value = "";

  if (unitDraft.allocationMethod === "hours" && unitDraft.targetMinutes) {
    setHourMinuteInputs(unitDraft.targetMinutes);
  } else {
    $("unitHoursWholeInput").value = "";
    $("unitMinutesSelect").value = "0";
  }

  $("unitPercentageInput").value =
    unitDraft.allocationMethod === "percentage" && unitDraft.allocationPercentage
      ? unitDraft.allocationPercentage
      : "";

  $("manualAvailableHoursInput").value = "";
  unitVisibleDate = defaultUnitMonth(user, unitDraft);
  syncUnitColourControls();

  const safeStep = Math.min(4, Math.max(1, Number(startStep) || 1));
  goToUnitStep(safeStep);
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
  $("unitWizardNextButton").textContent = step === 4 ? "Save Unit" : "Next";
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
    unitDraft.curriculumLinks ||= { working: [], prerequisite: [], lookingAhead: [], crossCurricular: [] };
    unitDraft.curriculumLinks.working = structuredCloneSafe(unitDraft.selectedCurriculum);
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

function setHourMinuteInputs(totalMinutes) {
  const safeMinutes = Math.max(0, Number(totalMinutes) || 0);
  const wholeHours = Math.floor(safeMinutes / 60);
  const minuteRemainder = safeMinutes % 60;
  const allowedMinutes = [0, 15, 30, 45];
  const normalizedRemainder = allowedMinutes.includes(minuteRemainder)
    ? minuteRemainder
    : Math.ceil(minuteRemainder / 15) * 15;

  $("unitHoursWholeInput").value = wholeHours;
  $("unitMinutesSelect").value = String(normalizedRemainder === 60 ? 0 : normalizedRemainder);

  if (normalizedRemainder === 60) {
    $("unitHoursWholeInput").value = wholeHours + 1;
  }
}

function getTargetMinutesFromInputs() {
  const hoursText = $("unitHoursWholeInput").value.trim();
  const hours = hoursText === "" ? 0 : Number(hoursText);
  const minutes = Number($("unitMinutesSelect").value || 0);

  if (!Number.isInteger(hours) || hours < 0) return NaN;
  if (![0, 15, 30, 45].includes(minutes)) return NaN;

  return hours * 60 + minutes;
}

function validateAllocationStep() {
  const user = getActiveUser();
  const percentageValue = $("unitPercentageInput").value.trim();
  const manualTargetMinutes = getTargetMinutesFromInputs();
  const hasManualTime =
    $("unitHoursWholeInput").value.trim() !== "" ||
    Number($("unitMinutesSelect").value || 0) > 0;

  const calculatedAvailable = calculateAvailableMinutesForClass(
    user,
    unitDraft.classSpec,
    editingUnitId
  );

  if (hasManualTime) {
    if (!Number.isFinite(manualTargetMinutes) || manualTargetMinutes <= 0) {
      alert("Enter at least 15 minutes of instructional time.");
      return false;
    }

    unitDraft.targetMinutes = manualTargetMinutes;
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
        alert(
          "No matching instructional blocks were found. Enter the total instructional hours available for this class."
        );
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

  alert("Enter either hours/minutes allocated to the unit or a percentage of available instructional time.");
  return false;
}

function updateAllocationSummary() {
  if (!unitDraft?.classSpec?.subject) return;

  const user = getActiveUser();
  const available = calculateAvailableMinutesForClass(
    user,
    unitDraft.classSpec,
    editingUnitId
  );

  $("manualAvailableHoursField").classList.toggle("hidden", available > 0);
  $("availableHoursText").textContent = available > 0
    ? `${hoursLabel(available)} of usable instructional time found in the master calendar (days off excluded).`
    : "No matching instructional blocks were found in the master calendar.";

  const summary = $("unitAllocationSummary");
  const targetMinutes = getTargetMinutesFromInputs();
  const hasManualTime =
    $("unitHoursWholeInput").value.trim() !== "" ||
    Number($("unitMinutesSelect").value || 0) > 0;

  const percentageValue = $("unitPercentageInput").value.trim();

  if (hasManualTime && Number.isFinite(targetMinutes) && targetMinutes > 0) {
    summary.textContent = `Target: ${hoursLabel(targetMinutes)}.`;
    summary.classList.remove("hidden");
    return;
  }

  if (percentageValue) {
    const percentage = Number(percentageValue);
    let base = available;

    if (base <= 0) {
      base = Number($("manualAvailableHoursInput").value || 0) * 60;
    }

    if (percentage > 0 && base > 0) {
      const target = Math.ceil((base * percentage / 100) / 15) * 15;
      summary.textContent =
        `${percentage}% of ${hoursLabel(base)} = ${hoursLabel(target)} allocated ` +
        "(rounded up to a 15-minute increment when needed).";
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
  const user = getActiveUser();
  const catalogIds = new Set(CURRICULUM.map(record => record.id));

  const selectedFromCatalog = CURRICULUM
    .filter(record => unitCurriculumSelection.has(record.id))
    .map(record => enrichCurriculumSnapshot(record, user));

  const preservedSnapshots = (
    unitDraft?.curriculumLinks?.working ||
    unitDraft?.selectedCurriculum ||
    []
  )
    .filter(record => !catalogIds.has(record.id) && unitCurriculumSelection.has(record.id))
    .map(record => enrichCurriculumSnapshot(record, user));

  return [...selectedFromCatalog, ...preservedSnapshots];
}

function enrichCurriculumSnapshot(record, user = getActiveUser()) {
  const snapshot = structuredCloneSafe(record);
  if (record.type === "Skills & Procedures") {
    const analysis = analyzeCurriculumVerb(record.text);
    snapshot.keyVerb = analysis.keyVerb;
    snapshot.bloomMatches = [...analysis.matches];
    snapshot.bloomLevel = getCurriculumBloomLevel(record, user, analysis);
  }
  return snapshot;
}

function getCurriculumForClass(classSpec) {
  const subject = String(classSpec?.subject || "").toLowerCase();
  const grades = normalizeGradeArray(classSpec?.grades || []);

  return CURRICULUM.filter(record =>
    String(record.subject || "").toLowerCase() === subject &&
    grades.includes(record.grade)
  );
}

function getBloomPhrases() {
  const phrases = new Set();
  BLOOM_LEVELS.forEach(level => {
    (BLOOM_REFERENCE.levels?.[level] || []).forEach(phrase => {
      if (phrase) phrases.add(String(phrase).trim().toLowerCase());
    });
  });

  return [...phrases].sort((a, b) => b.length - a.length);
}

function analyzeCurriculumVerb(text) {
  const original = String(text || "").trim();
  const lower = original.toLowerCase();
  const phrases = getBloomPhrases();

  let matchedPhrase = "";

  for (const phrase of phrases) {
    if (
      lower === phrase ||
      lower.startsWith(`${phrase} `) ||
      lower.startsWith(`${phrase},`) ||
      lower.startsWith(`${phrase}.`) ||
      lower.startsWith(`${phrase}:`)
    ) {
      matchedPhrase = phrase;
      break;
    }
  }

  let keyVerb = "";

  if (matchedPhrase) {
    keyVerb = original.slice(0, matchedPhrase.length);
  } else {
    const fallback = original.match(/^[A-Za-zÀ-ÖØ-öø-ÿ'-]+/);
    keyVerb = fallback?.[0] || "";
  }

  const normalizedVerb = keyVerb.toLowerCase();
  const matches = BLOOM_LEVELS.filter(level =>
    (BLOOM_REFERENCE.levels?.[level] || [])
      .some(verb => String(verb).trim().toLowerCase() === normalizedVerb)
  );

  const preferred = BLOOM_REFERENCE.preferred?.[normalizedVerb];
  let suggested = "";

  if (preferred && matches.includes(preferred)) {
    suggested = preferred;
  } else if (matches.length === 1) {
    suggested = matches[0];
  } else if (matches.length > 1) {
    suggested = matches[Math.floor((matches.length - 1) / 2)];
  }

  return {
    keyVerb,
    normalizedVerb,
    matches,
    suggested
  };
}

function getCurriculumBloomLevel(record, user = getActiveUser(), analysis = null) {
  if (!record || record.type !== "Skills & Procedures") return "";

  const override = user?.bloomOverrides?.[record.id];
  if (BLOOM_LEVELS.includes(override)) return override;

  const resolvedAnalysis = analysis || analyzeCurriculumVerb(record.text);
  return resolvedAnalysis.suggested || "";
}

function getBloomBand(level) {
  return BLOOM_BANDS[level] || "neutral";
}

function makeCurriculumText(record, user) {
  const wrapper = document.createElement("div");
  wrapper.className = "curriculum-objective-copy";

  const text = document.createElement("span");
  text.className = "curriculum-leaf-text";

  if (record.type !== "Skills & Procedures") {
    text.textContent = record.text;
    wrapper.appendChild(text);
    return wrapper;
  }

  const analysis = analyzeCurriculumVerb(record.text);
  const level = getCurriculumBloomLevel(record, user, analysis);
  const band = getBloomBand(level);

  if (analysis.keyVerb && record.text.toLowerCase().startsWith(analysis.keyVerb.toLowerCase())) {
    const verb = document.createElement("mark");
    verb.className = `curriculum-key-verb bloom-band-${band}`;
    verb.textContent = record.text.slice(0, analysis.keyVerb.length);

    text.appendChild(verb);
    text.appendChild(document.createTextNode(record.text.slice(analysis.keyVerb.length)));
  } else {
    text.textContent = record.text;
  }

  wrapper.appendChild(text);

  const meta = document.createElement("div");
  meta.className = "curriculum-verb-meta";

  const verbBadge = document.createElement("span");
  verbBadge.className = `curriculum-verb-badge bloom-band-${band}`;
  verbBadge.textContent = analysis.keyVerb
    ? `Verb: ${analysis.keyVerb}`
    : "Verb not detected";

  const bloomSelect = document.createElement("select");
  bloomSelect.className = `curriculum-bloom-select bloom-band-${band}`;
  bloomSelect.setAttribute("aria-label", `Bloom classification for ${analysis.keyVerb || "this objective"}`);

  const automatic = document.createElement("option");
  automatic.value = "";

  if (analysis.suggested) {
    automatic.textContent = user?.bloomOverrides?.[record.id]
      ? `Use suggestion: ${analysis.suggested}`
      : `Suggested: ${analysis.suggested}`;
  } else {
    automatic.textContent = "Bloom: choose level";
  }

  bloomSelect.appendChild(automatic);

  BLOOM_LEVELS.forEach(item => {
    const option = document.createElement("option");
    option.value = item;
    option.textContent = item;
    bloomSelect.appendChild(option);
  });

  bloomSelect.value = user?.bloomOverrides?.[record.id] || "";
  bloomSelect.disabled = readOnlyMode;

  bloomSelect.addEventListener("click", event => {
    event.stopPropagation();
  });

  bloomSelect.addEventListener("change", () => {
    const activeUser = getActiveUser();
    if (!activeUser || readOnlyMode) return;

    if (!activeUser.bloomOverrides || typeof activeUser.bloomOverrides !== "object") {
      activeUser.bloomOverrides = {};
    }

    if (bloomSelect.value) {
      activeUser.bloomOverrides[record.id] = bloomSelect.value;
    } else {
      delete activeUser.bloomOverrides[record.id];
    }

    saveData();

    if (unitDraft) {
      renderCurriculumBrowserPreservingOpenState();
    } else if (activeUnitWorkspaceId) {
      renderUnitWorkspace();
    }
  });

  meta.append(verbBadge, bloomSelect);

  if (analysis.matches.length > 1 && !user?.bloomOverrides?.[record.id]) {
    const note = document.createElement("span");
    note.className = "curriculum-bloom-note";
    note.textContent = `Also appears in: ${analysis.matches.filter(item => item !== analysis.suggested).join(", ")}`;
    meta.appendChild(note);
  } else if (!analysis.matches.length) {
    const note = document.createElement("span");
    note.className = "curriculum-bloom-note";
    note.textContent = "Not found in the supplied Bloom verb table.";
    meta.appendChild(note);
  }

  wrapper.appendChild(meta);
  return wrapper;
}

function captureCurriculumOpenState() {
  const openIds = new Set();
  document
    .querySelectorAll("#curriculumBrowser details[open][data-curriculum-branch-id]")
    .forEach(element => openIds.add(element.dataset.curriculumBranchId));

  return openIds;
}

function renderCurriculumBrowserPreservingOpenState() {
  const openState = captureCurriculumOpenState();
  renderCurriculumBrowser(openState);
}

function renderCurriculumBrowser(openState = null) {
  const container = $("curriculumBrowser");
  const empty = $("curriculumEmptyMessage");
  const user = getActiveUser();

  container.innerHTML = "";

  const records = getCurriculumForClass(unitDraft?.classSpec);

  if (!records.length) {
    empty.classList.remove("hidden");
    $("selectAllCurriculumButton").disabled = true;
    $("clearCurriculumSelectionButton").disabled = true;
    return;
  }

  empty.classList.add("hidden");
  $("selectAllCurriculumButton").disabled = false;

  const byGrade = groupBy(records, record => record.grade);

  Object.entries(byGrade).forEach(([grade, gradeRecords]) => {
    const gradeSection = document.createElement("details");
    const gradeBranchId = `grade::${grade}`;

    gradeSection.className = "curriculum-level curriculum-grade";
    gradeSection.dataset.curriculumBranchId = gradeBranchId;
    gradeSection.open = openState ? openState.has(gradeBranchId) : true;

    const summary = document.createElement("summary");

    const summaryMain = document.createElement("div");
    summaryMain.className = "curriculum-summary-main";

    const chevron = document.createElement("span");
    chevron.className = "curriculum-chevron";
    chevron.setAttribute("aria-hidden", "true");

    const title = document.createElement("div");
    title.className = "curriculum-card-title";
    title.innerHTML = `<strong>${escapeHTML(grade)} ${escapeHTML(unitDraft.classSpec.subject)}</strong><small>Curriculum</small>`;

    summaryMain.append(chevron, title);
    summary.append(summaryMain, makeCurriculumSelectionControls(gradeRecords));
    gradeSection.appendChild(summary);

    const byOrganizingIdea = groupBy(
      gradeRecords,
      record => `${record.organizingIdea}|||${record.organizingIdeaDescription || ""}`
    );

    Object.entries(byOrganizingIdea).forEach(([oiKey, oiRecords]) => {
      const [oi, description] = oiKey.split("|||");
      const section = document.createElement("details");
      const branchId = `${gradeBranchId}::oi::${oi}`;

      section.className = "curriculum-level curriculum-organizing-idea";
      section.dataset.curriculumBranchId = branchId;
      section.open = openState?.has(branchId) || false;

      const oiSummary = document.createElement("summary");
      const oiMain = document.createElement("div");
      oiMain.className = "curriculum-summary-main";

      const chevron = document.createElement("span");
      chevron.className = "curriculum-chevron";
      chevron.setAttribute("aria-hidden", "true");

      const text = document.createElement("div");
      text.className = "curriculum-card-title";
      text.innerHTML = `<strong>${escapeHTML(oi)}</strong><small>${escapeHTML(description)}</small>`;

      oiMain.append(chevron, text);
      oiSummary.append(oiMain, makeCurriculumSelectionControls(oiRecords));
      section.appendChild(oiSummary);

      const byGQ = groupBy(oiRecords, record => record.guidingQuestion || "Guiding Question");

      Object.entries(byGQ).forEach(([gq, gqRecords], gqIndex) => {
        const gqSection = document.createElement("details");
        const gqBranchId = `${branchId}::gq::${gqIndex}`;

        gqSection.className = "curriculum-level curriculum-gq";
        gqSection.dataset.curriculumBranchId = gqBranchId;
        gqSection.open = openState?.has(gqBranchId) || false;

        const gqSummary = document.createElement("summary");
        const gqMain = document.createElement("div");
        gqMain.className = "curriculum-summary-main";

        const chevron = document.createElement("span");
        chevron.className = "curriculum-chevron";
        chevron.setAttribute("aria-hidden", "true");

        const gqText = document.createElement("div");
        gqText.className = "curriculum-card-title";
        gqText.innerHTML = `<span class="curriculum-level-label">Guiding Question</span><strong>${escapeHTML(gq)}</strong>`;

        gqMain.append(chevron, gqText);
        gqSummary.append(gqMain, makeCurriculumSelectionControls(gqRecords));
        gqSection.appendChild(gqSummary);

        const byLO = groupBy(gqRecords, record => record.learningOutcome || "Learning Outcome");

        Object.entries(byLO).forEach(([lo, loRecords], loIndex) => {
          const loSection = document.createElement("details");
          const loBranchId = `${gqBranchId}::lo::${loIndex}`;

          loSection.className = "curriculum-level curriculum-lo";
          loSection.dataset.curriculumBranchId = loBranchId;
          loSection.open = openState?.has(loBranchId) || false;

          const loSummary = document.createElement("summary");
          const loMain = document.createElement("div");
          loMain.className = "curriculum-summary-main";

          const chevron = document.createElement("span");
          chevron.className = "curriculum-chevron";
          chevron.setAttribute("aria-hidden", "true");

          const loText = document.createElement("div");
          loText.className = "curriculum-card-title";
          loText.innerHTML = `<span class="curriculum-level-label">Learning Outcome</span><strong>${escapeHTML(lo)}</strong>`;

          loMain.append(chevron, loText);
          loSummary.append(loMain, makeCurriculumSelectionControls(loRecords));
          loSection.appendChild(loSummary);

          ["Knowledge", "Understanding", "Skills & Procedures"].forEach(type => {
            const typeRecords = loRecords.filter(record => record.type === type);
            if (!typeRecords.length) return;

            const typeBox = document.createElement("section");
            typeBox.className = `curriculum-type-box curriculum-type-${type.toLowerCase().replaceAll(" ", "-").replaceAll("&", "and")}`;

            const typeHeader = document.createElement("div");
            typeHeader.className = "curriculum-type-header";

            const headingWrap = document.createElement("div");
            headingWrap.className = "curriculum-type-heading";

            const heading = document.createElement("strong");
            heading.textContent = type;

            const count = document.createElement("span");
            count.className = "curriculum-type-count";
            count.textContent = `${typeRecords.length} item${typeRecords.length === 1 ? "" : "s"}`;

            headingWrap.append(heading, count);
            typeHeader.append(headingWrap, makeCurriculumSelectionControls(typeRecords));
            typeBox.appendChild(typeHeader);

            const leafList = document.createElement("div");
            leafList.className = "curriculum-leaf-list";

            typeRecords.forEach(record => {
              const label = document.createElement("label");
              label.className = "curriculum-leaf";

              const checkbox = document.createElement("input");
              checkbox.type = "checkbox";
              checkbox.dataset.curriculumId = record.id;
              checkbox.checked = unitCurriculumSelection.has(record.id);

              checkbox.addEventListener("change", () => {
                if (checkbox.checked) unitCurriculumSelection.add(record.id);
                else unitCurriculumSelection.delete(record.id);

                label.classList.toggle("selected", checkbox.checked);
                syncCurriculumSelectionUI();
              });

              const visualCheck = document.createElement("span");
              visualCheck.className = "curriculum-checkmark";
              visualCheck.setAttribute("aria-hidden", "true");

              const objective = makeCurriculumText(record, user);

              label.classList.toggle("selected", checkbox.checked);
              label.append(checkbox, visualCheck, objective);
              leafList.appendChild(label);
            });

            typeBox.appendChild(leafList);
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

  syncCurriculumSelectionUI();
}

function groupBy(records, keyFn) {
  return records.reduce((groups, record) => {
    const key = keyFn(record);
    (groups[key] ||= []).push(record);
    return groups;
  }, {});
}

function makeCurriculumSelectionControls(records) {
  const wrapper = document.createElement("div");
  wrapper.className = "curriculum-selection-controls";
  wrapper.dataset.ids = records.map(record => record.id).join("|");

  const count = document.createElement("span");
  count.className = "curriculum-selection-count";

  const selectButton = document.createElement("button");
  selectButton.type = "button";
  selectButton.className = "curriculum-select-all";
  selectButton.textContent = "Select all";

  const clearButton = document.createElement("button");
  clearButton.type = "button";
  clearButton.className = "curriculum-clear-all";
  clearButton.textContent = "Clear all";

  [selectButton, clearButton].forEach(button => {
    button.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
    });
  });

  selectButton.addEventListener("click", () => {
    records.forEach(record => unitCurriculumSelection.add(record.id));
    syncCurriculumSelectionUI();
  });

  clearButton.addEventListener("click", () => {
    records.forEach(record => unitCurriculumSelection.delete(record.id));
    syncCurriculumSelectionUI();
  });

  wrapper.append(count, selectButton, clearButton);
  return wrapper;
}

function syncCurriculumSelectionUI() {
  document
    .querySelectorAll('#curriculumBrowser input[data-curriculum-id]')
    .forEach(checkbox => {
      checkbox.checked = unitCurriculumSelection.has(checkbox.dataset.curriculumId);
      checkbox.closest(".curriculum-leaf")?.classList.toggle("selected", checkbox.checked);
    });

  document
    .querySelectorAll("#curriculumBrowser .curriculum-selection-controls")
    .forEach(wrapper => {
      const ids = wrapper.dataset.ids.split("|").filter(Boolean);
      const selectedCount = ids.filter(id => unitCurriculumSelection.has(id)).length;

      const count = wrapper.querySelector(".curriculum-selection-count");
      const selectButton = wrapper.querySelector(".curriculum-select-all");
      const clearButton = wrapper.querySelector(".curriculum-clear-all");

      if (count) count.textContent = `${selectedCount}/${ids.length}`;
      if (selectButton) selectButton.disabled = ids.length > 0 && selectedCount === ids.length;
      if (clearButton) clearButton.disabled = selectedCount === 0;
    });

  const classRecords = getCurriculumForClass(unitDraft?.classSpec);
  const allSelected = classRecords.length > 0 &&
    classRecords.every(record => unitCurriculumSelection.has(record.id));

  $("selectAllCurriculumButton").disabled = allSelected || classRecords.length === 0;
  $("clearCurriculumSelectionButton").disabled = unitCurriculumSelection.size === 0;
}

function refreshCurriculumSelectAllStates() {
  syncCurriculumSelectionUI();
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

  if (duplicate) {
    status.textContent = "That colour is already used by another unit in this grade/subject. Choose a different one.";
    status.className = "unit-colour-status colour-status-error";
    status.classList.remove("hidden");
  } else {
    status.textContent = "";
    status.className = "unit-colour-status colour-status-ok hidden";
  }
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

  if (!unitVisibleDate) {
    unitVisibleDate = defaultUnitMonth(user, unitDraft);
  }

  $("unitMonthTitle").textContent = unitVisibleDate.toLocaleDateString("en-CA", {
    month: "long",
    year: "numeric"
  });

  syncUnitColourControls();

  ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].forEach((weekday, index) => {
    const heading = document.createElement("div");
    heading.className = "weekday";
    heading.textContent = weekday;

    if (index === 0 || index === 6) {
      heading.classList.add("weekend-heading");
    }

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

  const sameClassUnits = (user?.units || []).filter(unit =>
    unit.id !== editingUnitId &&
    classKey(unit.classSpec) === classKey(unitDraft.classSpec)
  );

  for (let day = 1; day <= days; day++) {
    const date = new Date(year, month, day);
    const dateKey = getLocalDateKey(date);

    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "day unit-calendar-day";

    if (date.getDay() === 0 || date.getDay() === 6) {
      cell.classList.add("weekend");
    }

    const number = document.createElement("span");
    number.className = "day-number";
    number.textContent = day;
    cell.appendChild(number);

    const exception = getExceptionForDate(user, dateKey);
    const lessonsHere = unitDraft.lessons.filter(lesson => lesson.dateKey === dateKey);

    const otherUnitLessons = [];

    sameClassUnits.forEach(unit => {
      unit.lessons
        .filter(lesson => lesson.dateKey === dateKey)
        .forEach(lesson => {
          otherUnitLessons.push({ unit, lesson });
        });
    });

    if (exception) {
      cell.classList.add(
        "unit-off-day",
        `unit-off-${exception.type.toLowerCase().replaceAll(" ", "-")}`
      );

      const label = document.createElement("span");
      label.className = "unit-calendar-note off-note";
      label.textContent = exception.label || exception.type;
      cell.appendChild(label);
    } else {
      if (lessonsHere.length) {
        const colour = normalizeHexColour(unitDraft.colour) || "#8C6CFF";

        cell.classList.add("unit-lesson-date");
        cell.style.setProperty("--unit-colour", colour);
        cell.style.setProperty("--unit-colour-soft", hexToRgba(colour, 0.22));

        lessonsHere.forEach(lesson => {
          const label = document.createElement("span");
          label.className = "unit-calendar-note unit-lesson-note";
          label.textContent = lessonDisplayTitleForUnit(unitDraft, lesson);
          label.style.setProperty("--lesson-colour", colour);
          label.style.setProperty("--lesson-colour-soft", hexToRgba(colour, 0.22));
          cell.appendChild(label);
        });
      }

      otherUnitLessons
        .sort((a, b) =>
          a.lesson.startTime.localeCompare(b.lesson.startTime) ||
          a.unit.name.localeCompare(b.unit.name)
        )
        .forEach(({ unit, lesson }) => {
          const colour = normalizeHexColour(unit.colour) || "#8C6CFF";
          const label = document.createElement("span");

          label.className = "unit-calendar-note other-unit-note";
          label.style.setProperty("--other-unit-colour", colour);
          label.style.setProperty("--other-unit-colour-soft", hexToRgba(colour, 0.2));
          label.innerHTML =
            `<small>${escapeHTML(unit.name)}</small>` +
            `<strong>${escapeHTML(lessonDisplayTitleForUnit(unit, lesson))}</strong>`;

          cell.appendChild(label);
        });

      const matching = dedupeClassOccurrences(
        getOccurrencesForDate(date, user)
          .filter(item => classMatches(item.block, unitDraft.classSpec))
      );

      const available = matching.filter(
        item => !isOccurrenceAllocated(user, item, editingUnitId)
      );

      if (available.length) {
        cell.classList.add("unit-class-available");

        const marker = document.createElement("span");
        marker.className = "unit-calendar-note available-note";
        marker.textContent = available.length === 1
          ? "Available"
          : `${available.length} blocks available`;

        cell.appendChild(marker);
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
  unitDraft.curriculumLinks ||= { working: [], prerequisite: [], lookingAhead: [], crossCurricular: [] };
  unitDraft.curriculumLinks.working = structuredCloneSafe(unitDraft.selectedCurriculum);
  syncFieldTripOverrides(unitDraft);
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
    syncFieldTripOverrides(unit);
    unit.needsScheduleReview = result.scheduledMinutes < originalTarget;
    unit.updatedAt = new Date().toISOString();
  });
}

/* ============================================================
   UNIT WORKSPACE + SELECTABLE LESSON PLACEHOLDERS
============================================================ */

$("closeUnitDetailButton").addEventListener("click", () => {
  unitDetailDialog.close();
  activeUnitWorkspaceId = null;
  activeUnitWorkspaceSection = null;
});

$("closeLessonPlaceholderButton").addEventListener("click", () => lessonPlaceholderDialog.close());

$("startLessonPlannerButton").addEventListener("click", () => {
  if (!selectedLessonContext) return;
  alert(
    "This lesson placeholder is ready for the Lesson Plan Builder. " +
    "The full living lesson-planning workspace will attach to this exact record in a later release."
  );
});

$("unitWorkspacePreviousMonth").addEventListener("click", () => {
  if (!unitWorkspaceVisibleDate) return;
  unitWorkspaceVisibleDate = new Date(
    unitWorkspaceVisibleDate.getFullYear(),
    unitWorkspaceVisibleDate.getMonth() - 1,
    1
  );
  renderUnitWorkspaceCalendar();
});

$("unitWorkspaceNextMonth").addEventListener("click", () => {
  if (!unitWorkspaceVisibleDate) return;
  unitWorkspaceVisibleDate = new Date(
    unitWorkspaceVisibleDate.getFullYear(),
    unitWorkspaceVisibleDate.getMonth() + 1,
    1
  );
  renderUnitWorkspaceCalendar();
});

$("unitWorkspaceBackToCalendar").addEventListener("click", () => {
  activeUnitWorkspaceSection = null;
  workspaceCurriculumMode = null;
  workspaceResourceEditorId = null;
  workspaceModalityEditorId = null;
  workspaceIndigenousEditorId = null;
  workspaceFieldTripEditorId = null;
  renderUnitWorkspace();
});

$("unitWorkspaceTitleButton").addEventListener("click", beginUnitTitleEdit);

$("unitWorkspaceTitleInput").addEventListener("keydown", event => {
  if (event.key === "Enter") {
    event.preventDefault();
    commitUnitTitleEdit();
  }

  if (event.key === "Escape") {
    event.preventDefault();
    cancelUnitTitleEdit();
  }
});

$("unitWorkspaceTitleInput").addEventListener("blur", commitUnitTitleEdit);

$("unitWorkspaceClassButton").addEventListener("click", () => {
  openWorkspaceUnitWizardStep(1);
});

$("unitWorkspaceDateButton").addEventListener("click", () => {
  openWorkspaceUnitWizardStep(4);
});

$("unitWorkspaceTimeButton").addEventListener("click", () => {
  openWorkspaceUnitWizardStep(3);
});

$("unitWorkspaceColourButton").addEventListener("click", () => {
  openWorkspaceUnitWizardStep(4);
});

$("unitWorkspaceNav").querySelectorAll("[data-unit-section]").forEach(button => {
  button.addEventListener("click", () => {
    activeUnitWorkspaceSection = button.dataset.unitSection;
    workspaceCurriculumMode = null;
    workspaceResourceEditorId = null;
    workspaceModalityEditorId = null;
    workspaceIndigenousEditorId = null;
    workspaceFieldTripEditorId = null;
    renderUnitWorkspace();
  });
});

function openWorkspaceUnitWizardStep(step) {
  const unitId = activeUnitWorkspaceId;

  if (!unitId || readOnlyMode) return;

  unitDetailDialog.close();
  openUnitWizard(unitId, step);
}

function unitEndDate(unit) {
  const lessonDates = (unit?.lessons || [])
    .map(lesson => lesson.dateKey)
    .filter(Boolean)
    .sort();

  if (lessonDates.length) return lessonDates.at(-1);
  return unit?.startDate || "";
}

function autosaveUnit(unit) {
  if (!unit || readOnlyMode || readOnlySource === "shared") return;

  unit.updatedAt = new Date().toISOString();
  saveData();

  const user = getActiveUser();
  if (user) {
    renderUnitOverview(user);
    renderUnitPlannerList(user);
  }
}

function openUnitDetail(unitId) {
  const user = getActiveUser();
  const unit = getUnitById(unitId, user);

  if (!unit) return;

  activeUnitWorkspaceId = unit.id;
  activeUnitWorkspaceSection = null;
  workspaceCurriculumMode = null;
  workspaceResourceEditorId = null;
  workspaceModalityEditorId = null;
  workspaceIndigenousEditorId = null;
  workspaceFieldTripEditorId = null;

  const baseDate = unit.startDate
    ? parseLocalDate(unit.startDate)
    : defaultUnitMonth(user, unit);

  unitWorkspaceVisibleDate = new Date(
    baseDate.getFullYear(),
    baseDate.getMonth(),
    1
  );

  renderUnitWorkspace();
  unitDetailDialog.showModal();
}

function renderUnitWorkspace() {
  const user = getActiveUser();
  const unit = getUnitById(activeUnitWorkspaceId, user);

  if (!unit) {
    unitDetailDialog.close();
    return;
  }

  const endDate = unitEndDate(unit);
  const dateLabel = unit.startDate
    ? `${formatDate(unit.startDate)} – ${formatDate(endDate)}`
    : "Draft · No start date";

  $("unitWorkspaceTitleButton").textContent = unit.name;
  $("unitWorkspaceTitleInput").value = unit.name;
  $("unitDetailHeading").textContent = unit.name;

  $("unitWorkspaceTitleButton").classList.toggle("hidden", readOnlyMode);
  $("unitWorkspaceTitleInput").classList.add("hidden");
  $("unitDetailHeading").classList.toggle("hidden", !readOnlyMode);

  $("unitDetailMeta").textContent =
    `${classLabel(unit.classSpec)} · ${dateLabel}`;

  $("unitWorkspaceClassButton").textContent =
    `Class · ${classLabel(unit.classSpec)}`;

  $("unitWorkspaceDateButton").textContent =
    unit.startDate
      ? `Dates · ${formatDate(unit.startDate)} – ${formatDate(endDate)}`
      : "Dates · Add start date";

  $("unitWorkspaceTimeButton").textContent =
    `Time · ${hoursLabel(unit.targetMinutes)}`;

  const swatch = $("unitWorkspaceColourSwatch");
  const colour = normalizeHexColour(unit.colour) || "#8C6CFF";
  swatch.style.background = colour;

  document
    .querySelectorAll("#unitWorkspaceNav [data-unit-section]")
    .forEach(button => {
      button.classList.toggle(
        "active",
        button.dataset.unitSection === activeUnitWorkspaceSection
      );
    });

  const calendarView = $("unitWorkspaceCalendarView");
  const panel = $("unitWorkspacePanel");

  if (!activeUnitWorkspaceSection) {
    calendarView.classList.remove("hidden");
    panel.classList.add("hidden");
    renderUnitWorkspaceCalendar();
    return;
  }

  calendarView.classList.add("hidden");
  panel.classList.remove("hidden");
  renderUnitWorkspacePanel(unit, activeUnitWorkspaceSection);
}

function beginUnitTitleEdit() {
  if (readOnlyMode || !activeUnitWorkspaceId) return;

  const button = $("unitWorkspaceTitleButton");
  const input = $("unitWorkspaceTitleInput");

  button.classList.add("hidden");
  input.classList.remove("hidden");
  input.focus();
  input.select();
}

function cancelUnitTitleEdit() {
  const unit = getUnitById(activeUnitWorkspaceId);
  const input = $("unitWorkspaceTitleInput");
  const button = $("unitWorkspaceTitleButton");

  input.value = unit?.name || "";
  input.classList.add("hidden");
  button.classList.remove("hidden");
}

function commitUnitTitleEdit() {
  if (readOnlyMode || !activeUnitWorkspaceId) return;

  const unit = getUnitById(activeUnitWorkspaceId);
  const input = $("unitWorkspaceTitleInput");
  const button = $("unitWorkspaceTitleButton");

  if (!unit || input.classList.contains("hidden")) return;

  const value = input.value.trim();

  if (!value) {
    input.value = unit.name;
    input.focus();
    return;
  }

  unit.name = value;
  autosaveUnit(unit);

  input.classList.add("hidden");
  button.classList.remove("hidden");

  renderUnitWorkspace();
}

function renderUnitWorkspaceCalendar() {
  const user = getActiveUser();
  const currentUnit = getUnitById(activeUnitWorkspaceId, user);
  const grid = $("unitWorkspaceCalendarGrid");
  const legend = $("unitWorkspaceCalendarLegend");

  if (!user || !currentUnit) return;

  if (!unitWorkspaceVisibleDate) {
    unitWorkspaceVisibleDate = defaultUnitMonth(user, currentUnit);
  }

  grid.innerHTML = "";
  legend.innerHTML = "";

  $("unitWorkspaceMonthTitle").textContent =
    unitWorkspaceVisibleDate.toLocaleDateString("en-CA", {
      month: "long",
      year: "numeric"
    });

  ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].forEach((weekday, index) => {
    const heading = document.createElement("div");
    heading.className = "weekday";
    heading.textContent = weekday;

    if (index === 0 || index === 6) {
      heading.classList.add("weekend-heading");
    }

    grid.appendChild(heading);
  });

  const year = unitWorkspaceVisibleDate.getFullYear();
  const month = unitWorkspaceVisibleDate.getMonth();
  const first = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();

  for (let index = 0; index < first; index++) {
    const empty = document.createElement("div");
    empty.className = "day empty";
    grid.appendChild(empty);
  }

  const classUnits = user.units
    .filter(unit => classKey(unit.classSpec) === classKey(currentUnit.classSpec))
    .sort((a, b) => (a.startDate || "9999").localeCompare(b.startDate || "9999"));

  for (let day = 1; day <= days; day++) {
    const date = new Date(year, month, day);
    const dateKey = getLocalDateKey(date);

    const cell = document.createElement("div");
    cell.className = "day unit-workspace-calendar-day";

    if (date.getDay() === 0 || date.getDay() === 6) {
      cell.classList.add("weekend");
    }

    const number = document.createElement("span");
    number.className = "day-number";
    number.textContent = day;
    cell.appendChild(number);

    const exception = getExceptionForDate(user, dateKey);

    if (exception) {
      cell.classList.add(
        "unit-off-day",
        `unit-off-${exception.type.toLowerCase().replaceAll(" ", "-")}`
      );

      const off = document.createElement("span");
      off.className = "unit-calendar-note off-note";
      off.textContent = exception.label || exception.type;
      cell.appendChild(off);
    }

    classUnits.forEach(unit => {
      unit.lessons
        .filter(lesson => lesson.dateKey === dateKey)
        .sort((a, b) => a.startTime.localeCompare(b.startTime))
        .forEach(lesson => {
          const colour = normalizeHexColour(unit.colour) || "#8C6CFF";
          const lessonButton = document.createElement("button");

          lessonButton.type = "button";
          lessonButton.className = "workspace-unit-lesson";
          lessonButton.classList.toggle("current-unit", unit.id === currentUnit.id);
          lessonButton.style.setProperty("--workspace-unit-colour", colour);
          lessonButton.style.setProperty("--workspace-unit-colour-soft", hexToRgba(colour, 0.2));

          const unitName = document.createElement("small");
          unitName.textContent = unit.name;

          const lessonTitle = document.createElement("strong");
          lessonTitle.textContent = lessonDisplayTitleForUnit(unit, lesson);

          lessonButton.append(unitName, lessonTitle);

          lessonButton.addEventListener("click", event => {
            event.stopPropagation();
            openLessonPlaceholder(unit.id, lesson.id);
          });

          cell.appendChild(lessonButton);
        });
    });

    classUnits.forEach(unit => {
      (unit.workspace?.fieldTrips || [])
        .filter(trip => isDateWithin(dateKey, trip.startDate, trip.endDate))
        .forEach(trip => {
          const alreadyShownThroughLesson = (unit.lessons || []).some(lesson =>
            lesson.dateKey === dateKey &&
            lesson.override?.type === "fieldTrip" &&
            lesson.override?.fieldTripId === trip.id
          );

          if (alreadyShownThroughLesson) return;

          const colour = normalizeHexColour(unit.colour) || "#8C6CFF";
          const eventButton = document.createElement("button");
          eventButton.type = "button";
          eventButton.className = "workspace-field-trip-event";
          eventButton.style.setProperty("--workspace-unit-colour", colour);
          eventButton.style.setProperty("--workspace-unit-colour-soft", hexToRgba(colour, 0.18));
          eventButton.innerHTML = `<small>${escapeHTML(unit.name)}</small><strong>[FIELD TRIP] ${escapeHTML(trip.title)}</strong>`;
          eventButton.addEventListener("click", event => {
            event.stopPropagation();
            activeUnitWorkspaceId = unit.id;
            activeUnitWorkspaceSection = "fieldTrips";
            workspaceFieldTripEditorId = trip.id;
            renderUnitWorkspace();
          });
          cell.appendChild(eventButton);
        });
    });

    grid.appendChild(cell);
  }

  classUnits.forEach(unit => {
    const item = document.createElement("span");
    item.className = "workspace-unit-legend-item";

    const swatch = document.createElement("i");
    swatch.style.background = normalizeHexColour(unit.colour) || "#8C6CFF";

    const text = document.createElement("span");
    text.textContent = unit.name;

    item.append(swatch, text);

    if (unit.id === currentUnit.id) {
      item.classList.add("current");
    }

    legend.appendChild(item);
  });
}

function renderUnitWorkspacePanel(unit, section) {
  const heading = $("unitWorkspacePanelHeading");
  const content = $("unitWorkspacePanelContent");

  const labels = {
    curriculum: "Curriculum",
    simulation: "Simulation",
    project: "Project",
    assessments: "Assessments",
    resources: "Resources",
    fieldTrips: "Field Trips",
    lessons: "Lessons",
    numeracy: "Numeracy",
    literacy: "Literacy",
    learningModalities: "Learning Modalities",
    indigenousVoices: "Indigenous Voices",
    cognitiveTempo: "Cognitive Tempo"
  };

  heading.textContent = labels[section] || "Unit";
  content.innerHTML = "";

  if (section === "curriculum") return renderUnitWorkspaceCurriculum(unit, content);
  if (section === "simulation") return renderUnitWorkspaceSimulation(unit, content);
  if (section === "project") return renderUnitWorkspaceProject(unit, content);
  if (section === "resources") return renderUnitWorkspaceResources(unit, content);
  if (section === "fieldTrips") return renderUnitWorkspaceFieldTrips(unit, content);
  if (section === "learningModalities") return renderUnitWorkspaceLearningModalities(unit, content);
  if (section === "indigenousVoices") return renderUnitWorkspaceIndigenousVoices(unit, content);
  if (section === "lessons") return renderUnitWorkspaceLessons(unit, content);

  const empty = document.createElement("div");
  empty.className = "workspace-section-empty";

  const title = document.createElement("strong");
  title.textContent = `${labels[section] || "This section"} is intentionally waiting for its dedicated release.`;

  const copy = document.createElement("p");
  copy.textContent = section === "assessments"
    ? "Assessment creation, assessment histories, one-point and three-point rubrics arrive in Release C."
    : section === "cognitiveTempo"
      ? "Cognitive Tempo will be calculated after assessments are attached to lessons in the assessment and lesson releases."
      : "The data structure and Unit Workspace are ready, but this section depends on source data or the Lesson system that comes later.";

  empty.append(title, copy);
  content.appendChild(empty);
}

/* ============================================================
   UNIT WORKSPACE — CURRICULUM RELATIONSHIPS
============================================================ */

function renderUnitWorkspaceCurriculum(unit, container) {
  if (workspaceCurriculumMode) {
    renderWorkspaceCurriculumPicker(unit, workspaceCurriculumMode, container);
    return;
  }

  const links = unit.curriculumLinks || {
    working: unit.selectedCurriculum || [],
    prerequisite: [],
    lookingAhead: [],
    crossCurricular: []
  };

  const intro = document.createElement("p");
  intro.className = "section-subtitle workspace-section-intro";
  intro.textContent =
    "Curriculum is kept in separate pools so prerequisite, current, future, and cross-curricular material never gets mixed together in the Lesson Planner.";
  container.appendChild(intro);

  const cards = document.createElement("div");
  cards.className = "workspace-curriculum-cards";

  [
    {
      key: "prerequisite",
      title: "Prerequisite Curriculum",
      subtitle: "Previous-grade curriculum. Saved as last-grade context, never as today's objective."
    },
    {
      key: "working",
      title: "Working Curriculum",
      subtitle: "The curriculum this unit is actively teaching and can use in lessons and assessments."
    },
    {
      key: "lookingAhead",
      title: "Looking Ahead",
      subtitle: "Next-grade curriculum. Saved as future context, separate from current objectives."
    },
    {
      key: "crossCurricular",
      title: "Cross-Curricular Connections",
      subtitle: "Connections to other loaded curriculum that remain distinct from Working Curriculum."
    }
  ].forEach(item => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "workspace-curriculum-card";

    const count = Array.isArray(links[item.key]) ? links[item.key].length : 0;

    card.innerHTML =
      `<span class="workspace-curriculum-card-copy">` +
        `<strong>${escapeHTML(item.title)}</strong>` +
        `<small>${escapeHTML(item.subtitle)}</small>` +
      `</span>` +
      `<span class="workspace-curriculum-count">${count}</span>`;

    card.addEventListener("click", () => {
      workspaceCurriculumMode = item.key;
      renderUnitWorkspacePanel(unit, "curriculum");
    });

    cards.appendChild(card);
  });

  container.appendChild(cards);

  const working = links.working || [];
  const heading = document.createElement("div");
  heading.className = "workspace-subheading";
  heading.innerHTML =
    `<div><p class="small-label">Working Curriculum</p>` +
    `<h4>${working.length} selected item${working.length === 1 ? "" : "s"}</h4></div>`;
  container.appendChild(heading);

  if (!working.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "No working curriculum has been selected yet.";
    container.appendChild(empty);
    return;
  }

  const list = document.createElement("div");
  list.className = "workspace-working-curriculum-list";

  working.forEach(record => {
    const item = document.createElement("article");
    item.className = "workspace-curriculum-objective";

    const path = document.createElement("small");
    path.className = "workspace-curriculum-path";
    path.textContent =
      `${record.grade} · ${record.organizingIdea} · ${record.type}`;

    const text = makeCurriculumText(record, getActiveUser());
    item.append(path, text);
    list.appendChild(item);
  });

  container.appendChild(list);
}

function relationTitle(relation) {
  return {
    prerequisite: "Prerequisite Curriculum",
    working: "Working Curriculum",
    lookingAhead: "Looking Ahead",
    crossCurricular: "Cross-Curricular Connections"
  }[relation] || "Curriculum";
}

function previousOrNextGrade(grade, delta) {
  if (grade === "Kindergarten" || grade === "K") {
    return delta > 0 ? "Grade 1" : "";
  }

  const match = String(grade || "").match(/^(?:Grade\s*)?(\d+)$/i);
  if (!match) return "";

  const number = Number(match[1]) + delta;
  if (number < 0) return "";
  if (number === 0) return "Kindergarten";
  return `Grade ${number}`;
}

function curriculumRecordsForRelation(unit, relation) {
  const subject = String(unit?.classSpec?.subject || "").toLowerCase();
  const grades = normalizeGradeArray(unit?.classSpec?.grades || []);

  if (relation === "crossCurricular") {
    return [...CURRICULUM];
  }

  let targetGrades = grades;
  if (relation === "prerequisite") {
    targetGrades = normalizeGradeArray(grades.map(grade => previousOrNextGrade(grade, -1)).filter(Boolean));
  }
  if (relation === "lookingAhead") {
    targetGrades = normalizeGradeArray(grades.map(grade => previousOrNextGrade(grade, 1)).filter(Boolean));
  }

  return CURRICULUM.filter(record =>
    String(record.subject || "").toLowerCase() === subject &&
    targetGrades.includes(record.grade)
  );
}

function curriculumRelationTargetLabel(unit, relation) {
  const grades = normalizeGradeArray(unit?.classSpec?.grades || []);
  const subject = unit?.classSpec?.subject || "";

  if (relation === "working") return classLabel(unit.classSpec);
  if (relation === "crossCurricular") return "Any curriculum currently loaded in Teacher HQ";

  const shifted = normalizeGradeArray(
    grades.map(grade => previousOrNextGrade(grade, relation === "prerequisite" ? -1 : 1)).filter(Boolean)
  );

  return shifted.length ? `${gradeDisplay(shifted)} ${subject}`.trim() : `No ${relation === "prerequisite" ? "previous" : "next"} grade can be inferred`;
}

function renderWorkspaceCurriculumPicker(unit, relation, container) {
  const top = document.createElement("div");
  top.className = "workspace-subpage-heading";

  const back = document.createElement("button");
  back.type = "button";
  back.className = "text-button workspace-back-button";
  back.textContent = "← Curriculum";
  back.addEventListener("click", () => {
    workspaceCurriculumMode = null;
    renderUnitWorkspacePanel(unit, "curriculum");
  });

  const copy = document.createElement("div");
  copy.innerHTML =
    `<p class="small-label">${escapeHTML(curriculumRelationTargetLabel(unit, relation))}</p>` +
    `<h4>${escapeHTML(relationTitle(relation))}</h4>`;

  top.append(back, copy);
  container.appendChild(top);

  const description = document.createElement("p");
  description.className = "section-subtitle workspace-section-intro";
  description.textContent = relation === "prerequisite"
    ? "Selections here are saved as last-grade context and will not be offered as today's curricular objectives in the Lesson Planner."
    : relation === "lookingAhead"
      ? "Selections here are saved as next-grade context and remain separate from current objectives."
      : relation === "crossCurricular"
        ? "Selections here are saved as cross-curricular connections and remain distinct from Working Curriculum."
        : "These are the objectives this unit is actively teaching. Changes autosave immediately.";
  container.appendChild(description);

  const records = curriculumRecordsForRelation(unit, relation);
  const selectedSnapshots = unit.curriculumLinks?.[relation] || [];
  const selectedIds = new Set(selectedSnapshots.map(record => record.id));

  const actions = document.createElement("div");
  actions.className = "section-action-row workspace-curriculum-global-actions";

  const selectAll = document.createElement("button");
  selectAll.type = "button";
  selectAll.className = "secondary-button";
  selectAll.textContent = "Select All";

  const clearAll = document.createElement("button");
  clearAll.type = "button";
  clearAll.className = "secondary-button";
  clearAll.textContent = "Clear All";

  actions.append(selectAll, clearAll);
  if (!readOnlyMode) container.appendChild(actions);

  if (!records.length) {
    selectAll.disabled = true;
    clearAll.disabled = selectedSnapshots.length === 0;

    clearAll.addEventListener("click", () => {
      if (readOnlyMode) return;
      unit.curriculumLinks[relation] = [];
      if (relation === "working") unit.selectedCurriculum = [];
      autosaveUnit(unit);
      renderUnitWorkspacePanel(unit, "curriculum");
    });

    const empty = document.createElement("div");
    empty.className = "workspace-catalog-missing";
    empty.innerHTML =
      `<strong>No matching curriculum has been loaded yet.</strong>` +
      `<p>Teacher HQ will never invent missing curriculum. When you upload ${escapeHTML(curriculumRelationTargetLabel(unit, relation))}, it will appear here automatically.</p>`;
    container.appendChild(empty);

    if (selectedSnapshots.length) {
      const retained = document.createElement("div");
      retained.className = "workspace-retained-curriculum";
      retained.innerHTML = `<h4>Previously saved selections</h4>`;
      selectedSnapshots.forEach(record => {
        const card = document.createElement("article");
        card.className = "workspace-curriculum-objective";
        card.appendChild(makeCurriculumText(record, getActiveUser()));
        retained.appendChild(card);
      });
      container.appendChild(retained);
    }
    return;
  }

  const browser = document.createElement("div");
  browser.className = "curriculum-browser workspace-curriculum-browser";
  container.appendChild(browser);

  const persist = () => {
    const catalogIds = new Set(CURRICULUM.map(record => record.id));
    const snapshots = CURRICULUM
      .filter(record => selectedIds.has(record.id))
      .map(record => enrichCurriculumSnapshot(record, getActiveUser()));

    (unit.curriculumLinks?.[relation] || [])
      .filter(record => !catalogIds.has(record.id) && selectedIds.has(record.id))
      .forEach(record => snapshots.push(enrichCurriculumSnapshot(record, getActiveUser())));

    unit.curriculumLinks[relation] = snapshots;
    if (relation === "working") {
      unit.selectedCurriculum = snapshots.map(record => structuredCloneSafe(record));
    }

    autosaveUnit(unit);
  };

  const sync = () => {
    browser.querySelectorAll('input[data-workspace-curriculum-id]').forEach(checkbox => {
      checkbox.checked = selectedIds.has(checkbox.dataset.workspaceCurriculumId);
      checkbox.closest(".curriculum-leaf")?.classList.toggle("selected", checkbox.checked);
    });

    browser.querySelectorAll(".curriculum-selection-controls").forEach(wrapper => {
      const ids = wrapper.dataset.ids.split("|").filter(Boolean);
      const count = ids.filter(id => selectedIds.has(id)).length;
      const counter = wrapper.querySelector(".curriculum-selection-count");
      const select = wrapper.querySelector(".curriculum-select-all");
      const clear = wrapper.querySelector(".curriculum-clear-all");
      if (counter) counter.textContent = `${count}/${ids.length}`;
      if (select) select.disabled = count === ids.length;
      if (clear) clear.disabled = count === 0;
    });

    selectAll.disabled = records.every(record => selectedIds.has(record.id));
    clearAll.disabled = selectedIds.size === 0;
  };

  const makeControls = branchRecords => {
    const wrapper = document.createElement("div");
    wrapper.className = "curriculum-selection-controls";
    wrapper.dataset.ids = branchRecords.map(record => record.id).join("|");

    const count = document.createElement("span");
    count.className = "curriculum-selection-count";

    const select = document.createElement("button");
    select.type = "button";
    select.className = "curriculum-select-all";
    select.textContent = "Select all";

    const clear = document.createElement("button");
    clear.type = "button";
    clear.className = "curriculum-clear-all";
    clear.textContent = "Clear all";

    [select, clear].forEach(button => button.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
    }));

    select.addEventListener("click", () => {
      branchRecords.forEach(record => selectedIds.add(record.id));
      persist();
      sync();
    });

    clear.addEventListener("click", () => {
      branchRecords.forEach(record => selectedIds.delete(record.id));
      persist();
      sync();
    });

    if (readOnlyMode) {
      select.disabled = true;
      clear.disabled = true;
      select.classList.add("hidden");
      clear.classList.add("hidden");
    }

    wrapper.append(count, select, clear);
    return wrapper;
  };

  const byCourse = groupBy(records, record => `${record.grade}|||${record.subject}`);

  Object.entries(byCourse).forEach(([courseKey, courseRecords]) => {
    const [grade, subject] = courseKey.split("|||");
    const gradeSection = document.createElement("details");
    gradeSection.className = "curriculum-level curriculum-grade";
    gradeSection.open = true;

    const summary = document.createElement("summary");
    const main = document.createElement("div");
    main.className = "curriculum-summary-main";
    main.innerHTML =
      `<span class="curriculum-chevron" aria-hidden="true"></span>` +
      `<div class="curriculum-card-title"><span class="curriculum-level-label">Grade / Subject</span><strong>${escapeHTML(grade)} ${escapeHTML(subject)}</strong></div>`;
    summary.append(main, makeControls(courseRecords));
    gradeSection.appendChild(summary);

    const byOI = groupBy(courseRecords, record => `${record.organizingIdea}|||${record.organizingIdeaDescription || ""}`);

    Object.entries(byOI).forEach(([oiKey, oiRecords]) => {
      const [oi, oiDescription] = oiKey.split("|||");
      const oiSection = document.createElement("details");
      oiSection.className = "curriculum-level curriculum-organizing-idea";

      const oiSummary = document.createElement("summary");
      const oiMain = document.createElement("div");
      oiMain.className = "curriculum-summary-main";
      oiMain.innerHTML =
        `<span class="curriculum-chevron" aria-hidden="true"></span>` +
        `<div class="curriculum-card-title"><strong>${escapeHTML(oi)}</strong><small>${escapeHTML(oiDescription)}</small></div>`;
      oiSummary.append(oiMain, makeControls(oiRecords));
      oiSection.appendChild(oiSummary);

      const byGQ = groupBy(oiRecords, record => record.guidingQuestion || "Guiding Question");
      Object.entries(byGQ).forEach(([gq, gqRecords]) => {
        const gqSection = document.createElement("details");
        gqSection.className = "curriculum-level curriculum-gq";

        const gqSummary = document.createElement("summary");
        const gqMain = document.createElement("div");
        gqMain.className = "curriculum-summary-main";
        gqMain.innerHTML =
          `<span class="curriculum-chevron" aria-hidden="true"></span>` +
          `<div class="curriculum-card-title"><span class="curriculum-level-label">Guiding Question</span><strong>${escapeHTML(gq)}</strong></div>`;
        gqSummary.append(gqMain, makeControls(gqRecords));
        gqSection.appendChild(gqSummary);

        const byLO = groupBy(gqRecords, record => record.learningOutcome || "Learning Outcome");
        Object.entries(byLO).forEach(([lo, loRecords]) => {
          const loSection = document.createElement("details");
          loSection.className = "curriculum-level curriculum-lo";

          const loSummary = document.createElement("summary");
          const loMain = document.createElement("div");
          loMain.className = "curriculum-summary-main";
          loMain.innerHTML =
            `<span class="curriculum-chevron" aria-hidden="true"></span>` +
            `<div class="curriculum-card-title"><span class="curriculum-level-label">Learning Outcome</span><strong>${escapeHTML(lo)}</strong></div>`;
          loSummary.append(loMain, makeControls(loRecords));
          loSection.appendChild(loSummary);

          ["Knowledge", "Understanding", "Skills & Procedures"].forEach(type => {
            const typeRecords = loRecords.filter(record => record.type === type);
            if (!typeRecords.length) return;

            const box = document.createElement("section");
            box.className = `curriculum-type-box curriculum-type-${type.toLowerCase().replaceAll(" ", "-").replaceAll("&", "and")}`;

            const typeHeader = document.createElement("div");
            typeHeader.className = "curriculum-type-header";
            typeHeader.innerHTML = `<div class="curriculum-type-heading"><strong>${escapeHTML(type)}</strong><span class="curriculum-type-count">${typeRecords.length} item${typeRecords.length === 1 ? "" : "s"}</span></div>`;
            typeHeader.appendChild(makeControls(typeRecords));
            box.appendChild(typeHeader);

            const leafList = document.createElement("div");
            leafList.className = "curriculum-leaf-list";

            typeRecords.forEach(record => {
              const label = document.createElement("label");
              label.className = "curriculum-leaf";

              const checkbox = document.createElement("input");
              checkbox.type = "checkbox";
              checkbox.dataset.workspaceCurriculumId = record.id;
              checkbox.checked = selectedIds.has(record.id);
              checkbox.disabled = readOnlyMode;

              checkbox.addEventListener("change", () => {
                if (checkbox.checked) selectedIds.add(record.id);
                else selectedIds.delete(record.id);
                label.classList.toggle("selected", checkbox.checked);
                persist();
                sync();
              });

              const visual = document.createElement("span");
              visual.className = "curriculum-checkmark";
              visual.setAttribute("aria-hidden", "true");

              label.classList.toggle("selected", checkbox.checked);
              label.append(checkbox, visual, makeCurriculumText(record, getActiveUser()));
              leafList.appendChild(label);
            });

            box.appendChild(leafList);
            loSection.appendChild(box);
          });

          gqSection.appendChild(loSection);
        });

        oiSection.appendChild(gqSection);
      });

      gradeSection.appendChild(oiSection);
    });

    browser.appendChild(gradeSection);
  });

  selectAll.addEventListener("click", () => {
    records.forEach(record => selectedIds.add(record.id));
    persist();
    sync();
  });

  clearAll.addEventListener("click", () => {
    records.forEach(record => selectedIds.delete(record.id));
    persist();
    sync();
  });

  sync();
}

/* ============================================================
   UNIT WORKSPACE — SIMULATION
============================================================ */

function renderUnitWorkspaceSimulation(unit, container) {
  const simulation = unit.workspace.simulation;

  container.innerHTML = `
    <div class="workspace-editor-card">
      <div class="workspace-editor-heading">
        <div>
          <p class="small-label">Optional Unit Element</p>
          <h4>Interactive Simulation</h4>
          <p class="section-subtitle">Describe the simulation that frames or anchors this unit.</p>
        </div>
        <div class="segmented-choice" role="group" aria-label="Interactive simulation">
          <button type="button" data-simulation-choice="yes" class="${simulation.enabled === true ? "selected" : ""}">Yes</button>
          <button type="button" data-simulation-choice="no" class="${simulation.enabled === false ? "selected" : ""}">No simulation</button>
        </div>
      </div>
      <div id="simulationFields" class="${simulation.enabled === false ? "hidden" : ""}">
        <label class="form-field"><span>Simulation Title</span><input id="simulationTitleInput" type="text" value="${escapeHTML(simulation.title)}" placeholder="e.g., Run a community grocery store" /></label>
        <label class="form-field"><span>Description</span><textarea id="simulationDescriptionInput" rows="7" placeholder="Describe what students will experience, the roles they take, and how the simulation develops through the unit.">${escapeHTML(simulation.description)}</textarea></label>
      </div>
      ${simulation.enabled === false ? '<div class="workspace-disabled-note">No interactive simulation for this unit.</div>' : ""}
    </div>`;

  if (readOnlyMode) {
    container.querySelectorAll("button, input, textarea").forEach(element => element.disabled = true);
    return;
  }

  container.querySelectorAll("[data-simulation-choice]").forEach(button => {
    button.addEventListener("click", () => {
      simulation.enabled = button.dataset.simulationChoice === "yes";
      autosaveUnit(unit);
      renderUnitWorkspacePanel(unit, "simulation");
    });
  });

  const title = container.querySelector("#simulationTitleInput");
  const description = container.querySelector("#simulationDescriptionInput");

  title?.addEventListener("input", () => {
    simulation.title = title.value;
    autosaveUnit(unit);
  });
  description?.addEventListener("input", () => {
    simulation.description = description.value;
    autosaveUnit(unit);
  });
}

/* ============================================================
   UNIT WORKSPACE — PROJECT + BLOOM
============================================================ */

function renderUnitWorkspaceProject(unit, container) {
  const project = unit.workspace.project;
  const workingSkills = (unit.curriculumLinks?.working || [])
    .filter(record => record.type === "Skills & Procedures");
  const selected = new Set(project.skillIds || []);

  const card = document.createElement("div");
  card.className = "workspace-editor-card";
  card.innerHTML = `
    <div class="workspace-editor-heading">
      <div>
        <p class="small-label">Optional Unit Element</p>
        <h4>Unit Project</h4>
        <p class="section-subtitle">Identify the culminating or ongoing project and the curriculum it intentionally demonstrates.</p>
      </div>
      <div class="segmented-choice" role="group" aria-label="Unit project">
        <button type="button" data-project-choice="yes" class="${project.enabled === true ? "selected" : ""}">Yes</button>
        <button type="button" data-project-choice="no" class="${project.enabled === false ? "selected" : ""}">No project</button>
      </div>
    </div>
    <div id="projectFields" class="${project.enabled === false ? "hidden" : ""}">
      <label class="form-field"><span>Project Title</span><input id="projectTitleInput" type="text" value="${escapeHTML(project.title)}" placeholder="Project title" /></label>
      <label class="form-field"><span>Description</span><textarea id="projectDescriptionInput" rows="7" placeholder="Describe the project students will complete.">${escapeHTML(project.description)}</textarea></label>
    </div>
    ${project.enabled === false ? '<div class="workspace-disabled-note">No project for this unit.</div>' : ""}`;
  container.appendChild(card);

  if (project.enabled !== false) {
    const skillsSection = document.createElement("section");
    skillsSection.className = "project-skills-section";
    skillsSection.innerHTML = `
      <div class="workspace-subheading">
        <div><p class="small-label">Working Curriculum</p><h4>Skills & Procedures represented in the project</h4></div>
        <div class="ski-key"><span class="ski-green">Green</span><span class="ski-blue">Blue</span><span class="ski-black">Black</span></div>
      </div>
      <p class="section-subtitle">The highlighted verb is classified using your Bloom reference. You can override the classification at any time. Selected items will flow into Assessments in Release C.</p>`;

    if (!workingSkills.length) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = "No Skills & Procedures are currently selected in Working Curriculum.";
      skillsSection.appendChild(empty);
    } else {
      const list = document.createElement("div");
      list.className = "project-skill-list";

      workingSkills.forEach(record => {
        const analysis = analyzeCurriculumVerb(record.text);
        const level = getCurriculumBloomLevel(record, getActiveUser(), analysis);
        const band = getBloomBand(level);
        const label = document.createElement("label");
        label.className = `project-skill-card project-skill-${band}`;

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = selected.has(record.id);
        checkbox.disabled = readOnlyMode;

        const copy = document.createElement("div");
        copy.className = "project-skill-copy";
        copy.appendChild(makeCurriculumText(record, getActiveUser()));

        const meta = document.createElement("div");
        meta.className = "project-skill-meta";
        meta.innerHTML = `<span>${escapeHTML(level || "Teacher classification needed")}</span><span>${band === "green" ? "Green · Remember / Understand" : band === "blue" ? "Blue · Apply / Analyze" : band === "black" ? "Black · Evaluate / Create" : "Bloom level not assigned"}</span>`;
        copy.appendChild(meta);

        checkbox.addEventListener("change", () => {
          if (checkbox.checked) selected.add(record.id);
          else selected.delete(record.id);
          project.skillIds = [...selected];
          autosaveUnit(unit);
          label.classList.toggle("selected", checkbox.checked);
        });

        label.classList.toggle("selected", checkbox.checked);
        label.append(checkbox, copy);
        list.appendChild(label);
      });

      skillsSection.appendChild(list);
    }

    container.appendChild(skillsSection);
  }

  if (readOnlyMode) {
    container.querySelectorAll("button, input, textarea, select").forEach(element => element.disabled = true);
    return;
  }

  container.querySelectorAll("[data-project-choice]").forEach(button => {
    button.addEventListener("click", () => {
      project.enabled = button.dataset.projectChoice === "yes";
      autosaveUnit(unit);
      renderUnitWorkspacePanel(unit, "project");
    });
  });

  const title = container.querySelector("#projectTitleInput");
  const description = container.querySelector("#projectDescriptionInput");
  title?.addEventListener("input", () => {
    project.title = title.value;
    autosaveUnit(unit);
  });
  description?.addEventListener("input", () => {
    project.description = description.value;
    autosaveUnit(unit);
  });
}

/* ============================================================
   UNIT WORKSPACE — REUSABLE RESOURCES
============================================================ */

function resourceKindLabel(resource) {
  if (resource.kind === "reference") {
    return resource.referenceKind === "book" ? "Reference · Book" : "Reference · Online Resource";
  }
  if (resource.kind === "physical") return "Physical Object";
  if (resource.kind === "book") return "Book";
  return "Online Resource";
}

function resourceSecondaryText(resource) {
  if (resource.kind === "physical") return resource.location || resource.notes || "Physical classroom resource";
  if (resource.kind === "book" || (resource.kind === "reference" && resource.referenceKind === "book")) {
    const citation = [resource.author, resource.publisher, resource.year].filter(Boolean).join(" · ");
    return citation || resource.notes || "Book";
  }
  return resource.url || resource.notes || "Online resource";
}

function renderUnitWorkspaceResources(unit, container) {
  const user = getActiveUser();
  const linked = new Set(unit.workspace.resourceIds || []);

  const header = document.createElement("div");
  header.className = "section-heading-row compact-heading-row";
  header.innerHTML = `<div><h4>Resources Used in This Unit</h4><p class="section-subtitle">Resources are saved to your reusable library, then linked to any units that use them.</p></div>`;

  if (!readOnlyMode) {
    const add = document.createElement("button");
    add.type = "button";
    add.className = "primary-button";
    add.textContent = "+ Add New";
    add.addEventListener("click", () => {
      workspaceResourceEditorId = "__new__";
      renderUnitWorkspacePanel(unit, "resources");
    });
    header.appendChild(add);
  }
  container.appendChild(header);

  if (workspaceResourceEditorId && !readOnlyMode) {
    renderResourceEditor(unit, container, workspaceResourceEditorId);
    return;
  }

  const linkedRecords = user.resourceLibrary.filter(resource => linked.has(resource.id));
  if (!linkedRecords.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "No resources have been linked to this unit yet.";
    container.appendChild(empty);
  } else {
    const list = document.createElement("div");
    list.className = "resource-card-list";
    linkedRecords.forEach(resource => list.appendChild(makeResourceCard(unit, resource, true)));
    container.appendChild(list);
  }

  if (readOnlyMode) return;

  const libraryHeading = document.createElement("div");
  libraryHeading.className = "workspace-subheading";
  libraryHeading.innerHTML = `<div><p class="small-label">Reusable Library</p><h4>Saved Resources</h4></div>`;
  container.appendChild(libraryHeading);

  if (!user.resourceLibrary.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "Your reusable resource library is empty.";
    container.appendChild(empty);
    return;
  }

  const library = document.createElement("div");
  library.className = "resource-library-list";
  user.resourceLibrary.forEach(resource => library.appendChild(makeResourceCard(unit, resource, false)));
  container.appendChild(library);
}

function makeResourceCard(unit, resource, linkedOnly) {
  const linked = (unit.workspace.resourceIds || []).includes(resource.id);
  const card = document.createElement("article");
  card.className = "resource-card";

  const copy = document.createElement("div");
  copy.className = "resource-card-copy";
  copy.innerHTML = `<span class="resource-kind">${escapeHTML(resourceKindLabel(resource))}</span><strong>${escapeHTML(resource.title)}</strong><small>${escapeHTML(resourceSecondaryText(resource))}</small>`;
  card.appendChild(copy);

  if (!readOnlyMode) {
    const actions = document.createElement("div");
    actions.className = "resource-card-actions";

    const linkButton = document.createElement("button");
    linkButton.type = "button";
    linkButton.className = linked ? "secondary-button resource-linked" : "secondary-button";
    linkButton.textContent = linked ? "✓ Used in Unit" : "Use in Unit";
    linkButton.addEventListener("click", () => {
      const ids = new Set(unit.workspace.resourceIds || []);
      if (ids.has(resource.id)) ids.delete(resource.id);
      else ids.add(resource.id);
      unit.workspace.resourceIds = [...ids];
      autosaveUnit(unit);
      renderUnitWorkspacePanel(unit, "resources");
    });

    const edit = document.createElement("button");
    edit.type = "button";
    edit.className = "text-button";
    edit.textContent = "Edit";
    edit.addEventListener("click", () => {
      workspaceResourceEditorId = resource.id;
      renderUnitWorkspacePanel(unit, "resources");
    });

    actions.append(linkButton, edit);
    card.appendChild(actions);
  }

  if (linkedOnly) card.classList.add("linked-resource");
  return card;
}

function renderResourceEditor(unit, container, resourceId) {
  const user = getActiveUser();
  const existing = resourceId === "__new__"
    ? null
    : user.resourceLibrary.find(resource => resource.id === resourceId);
  const resource = existing ? structuredCloneSafe(existing) : {
    ...normalizeResourceRecord({ title: "New Resource", kind: "online" }),
    title: ""
  };

  const editor = document.createElement("form");
  editor.className = "workspace-inline-editor resource-editor";
  editor.innerHTML = `
    <div class="workspace-inline-editor-heading">
      <div><p class="small-label">${existing ? "Edit Resource" : "New Resource"}</p><h4>${existing ? escapeHTML(existing.title) : "Add a reusable resource"}</h4></div>
      <button type="button" class="text-button" data-resource-cancel>Cancel</button>
    </div>
    <div class="form-grid two-column-grid">
      <label class="form-field"><span>Resource Type</span>
        <select data-resource-kind>
          <option value="reference" ${resource.kind === "reference" ? "selected" : ""}>Reference</option>
          <option value="physical" ${resource.kind === "physical" ? "selected" : ""}>Physical Object</option>
          <option value="online" ${resource.kind === "online" ? "selected" : ""}>Online Resource</option>
          <option value="book" ${resource.kind === "book" ? "selected" : ""}>Book</option>
        </select>
      </label>
      <label class="form-field"><span>Title <small>(required)</small></span><input data-resource-title type="text" value="${escapeHTML(resource.title)}" required /></label>
    </div>
    <label class="form-field resource-reference-kind"><span>Reference Type</span>
      <select data-resource-reference-kind>
        <option value="book" ${resource.referenceKind === "book" ? "selected" : ""}>Book</option>
        <option value="online" ${resource.referenceKind !== "book" ? "selected" : ""}>Online Resource</option>
      </select>
    </label>
    <div class="resource-book-fields form-grid two-column-grid">
      <label class="form-field"><span>Author</span><input data-resource-author type="text" value="${escapeHTML(resource.author)}" /></label>
      <label class="form-field"><span>Publisher</span><input data-resource-publisher type="text" value="${escapeHTML(resource.publisher)}" /></label>
      <label class="form-field"><span>Year</span><input data-resource-year type="text" value="${escapeHTML(resource.year)}" /></label>
      <label class="form-field"><span>Edition</span><input data-resource-edition type="text" value="${escapeHTML(resource.edition)}" /></label>
    </div>
    <label class="form-field resource-url-field"><span>Link</span><input data-resource-url type="url" value="${escapeHTML(resource.url)}" placeholder="https://..." /></label>
    <label class="form-field resource-location-field"><span>Location</span><input data-resource-location type="text" value="${escapeHTML(resource.location)}" placeholder="Shelf, cupboard, classroom, etc." /></label>
    <label class="form-field"><span>Notes</span><textarea data-resource-notes rows="4">${escapeHTML(resource.notes)}</textarea></label>
    <div class="modal-actions compact-actions">
      ${existing ? '<button type="button" class="danger-text-button" data-resource-delete>Delete Resource</button>' : ""}
      <button type="submit" class="primary-button">${existing ? "Save Changes" : "Add Resource"}</button>
    </div>`;

  container.prepend(editor);

  const syncFields = () => {
    const kind = editor.querySelector("[data-resource-kind]").value;
    const referenceKind = editor.querySelector("[data-resource-reference-kind]").value;
    const isReference = kind === "reference";
    const isBook = kind === "book" || (isReference && referenceKind === "book");
    const isOnline = kind === "online" || (isReference && referenceKind === "online");
    const isPhysical = kind === "physical";
    editor.querySelector(".resource-reference-kind").classList.toggle("hidden", !isReference);
    editor.querySelector(".resource-book-fields").classList.toggle("hidden", !isBook);
    editor.querySelector(".resource-url-field").classList.toggle("hidden", !isOnline);
    editor.querySelector(".resource-location-field").classList.toggle("hidden", !isPhysical);
  };

  editor.querySelector("[data-resource-kind]").addEventListener("change", syncFields);
  editor.querySelector("[data-resource-reference-kind]").addEventListener("change", syncFields);
  syncFields();

  editor.querySelector("[data-resource-cancel]").addEventListener("click", () => {
    workspaceResourceEditorId = null;
    renderUnitWorkspacePanel(unit, "resources");
  });

  editor.addEventListener("submit", event => {
    event.preventDefault();
    const title = editor.querySelector("[data-resource-title]").value.trim();
    if (!title) {
      alert("Please give this resource a title.");
      return;
    }

    const saved = normalizeResourceRecord({
      ...resource,
      id: existing?.id || makeId("resource"),
      title,
      kind: editor.querySelector("[data-resource-kind]").value,
      referenceKind: editor.querySelector("[data-resource-reference-kind]").value,
      author: editor.querySelector("[data-resource-author]").value,
      publisher: editor.querySelector("[data-resource-publisher]").value,
      year: editor.querySelector("[data-resource-year]").value,
      edition: editor.querySelector("[data-resource-edition]").value,
      url: editor.querySelector("[data-resource-url]").value,
      location: editor.querySelector("[data-resource-location]").value,
      notes: editor.querySelector("[data-resource-notes]").value,
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    const index = user.resourceLibrary.findIndex(item => item.id === saved.id);
    if (index >= 0) user.resourceLibrary[index] = saved;
    else user.resourceLibrary.push(saved);

    if (!(unit.workspace.resourceIds || []).includes(saved.id)) {
      unit.workspace.resourceIds.push(saved.id);
    }

    workspaceResourceEditorId = null;
    autosaveUnit(unit);
    renderUnitWorkspacePanel(unit, "resources");
  });

  editor.querySelector("[data-resource-delete]")?.addEventListener("click", () => {
    if (!confirm(`Delete “${existing.title}” from your reusable resource library?`)) return;
    user.resourceLibrary = user.resourceLibrary.filter(item => item.id !== existing.id);
    user.units.forEach(savedUnit => {
      savedUnit.workspace.resourceIds = (savedUnit.workspace.resourceIds || []).filter(id => id !== existing.id);
    });
    workspaceResourceEditorId = null;
    saveData();
    renderUnitWorkspacePanel(unit, "resources");
  });
}

/* ============================================================
   UNIT WORKSPACE — LEARNING MODALITIES
============================================================ */

function renderUnitWorkspaceLearningModalities(unit, container) {
  const user = getActiveUser();
  const used = new Set(unit.workspace.learningModalityIds || []);

  const header = document.createElement("div");
  header.className = "section-heading-row compact-heading-row";
  header.innerHTML = `<div><h4>Learning Modalities</h4><p class="section-subtitle">Build a reusable library of ways students work and learn. Lesson agenda parts will link to these later.</p></div>`;

  if (!readOnlyMode) {
    const add = document.createElement("button");
    add.type = "button";
    add.className = "primary-button";
    add.textContent = "+ Add Modality";
    add.addEventListener("click", () => {
      workspaceModalityEditorId = "__new__";
      renderUnitWorkspacePanel(unit, "learningModalities");
    });
    header.appendChild(add);
  }
  container.appendChild(header);

  if (workspaceModalityEditorId && !readOnlyMode) {
    renderModalityEditor(unit, container, workspaceModalityEditorId);
    return;
  }

  if (!user.learningModalities.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "No learning modalities saved yet. Add your own when you're ready.";
    container.appendChild(empty);
    return;
  }

  const list = document.createElement("div");
  list.className = "modality-grid";

  user.learningModalities.forEach(modality => {
    const card = document.createElement("article");
    card.className = `modality-card ${used.has(modality.id) ? "selected" : ""}`;
    card.innerHTML = `<div><strong>${escapeHTML(modality.title)}</strong><p>${escapeHTML(modality.description || "No description yet.")}</p></div>`;

    if (!readOnlyMode) {
      const actions = document.createElement("div");
      actions.className = "modality-actions";

      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "secondary-button";
      toggle.textContent = used.has(modality.id) ? "✓ Used in Unit" : "Use in Unit";
      toggle.addEventListener("click", () => {
        if (used.has(modality.id)) used.delete(modality.id);
        else used.add(modality.id);
        unit.workspace.learningModalityIds = [...used];
        autosaveUnit(unit);
        renderUnitWorkspacePanel(unit, "learningModalities");
      });

      const edit = document.createElement("button");
      edit.type = "button";
      edit.className = "text-button";
      edit.textContent = "Edit";
      edit.addEventListener("click", () => {
        workspaceModalityEditorId = modality.id;
        renderUnitWorkspacePanel(unit, "learningModalities");
      });

      actions.append(toggle, edit);
      card.appendChild(actions);
    }

    list.appendChild(card);
  });
  container.appendChild(list);
}

function renderModalityEditor(unit, container, modalityId) {
  const user = getActiveUser();
  const existing = modalityId === "__new__" ? null : user.learningModalities.find(item => item.id === modalityId);

  const form = document.createElement("form");
  form.className = "workspace-inline-editor";
  form.innerHTML = `
    <div class="workspace-inline-editor-heading"><div><p class="small-label">${existing ? "Edit" : "New"}</p><h4>Learning Modality</h4></div><button type="button" class="text-button" data-modality-cancel>Cancel</button></div>
    <label class="form-field"><span>Title <small>(required)</small></span><input data-modality-title type="text" value="${escapeHTML(existing?.title || "")}" placeholder="Small group work" required /></label>
    <label class="form-field"><span>Description</span><textarea data-modality-description rows="5" placeholder="Describe what this learning setup looks like in your classroom.">${escapeHTML(existing?.description || "")}</textarea></label>
    <div class="modal-actions compact-actions">${existing ? '<button type="button" class="danger-text-button" data-modality-delete>Delete</button>' : ""}<button type="submit" class="primary-button">Save Modality</button></div>`;
  container.prepend(form);

  form.querySelector("[data-modality-cancel]").addEventListener("click", () => {
    workspaceModalityEditorId = null;
    renderUnitWorkspacePanel(unit, "learningModalities");
  });

  form.addEventListener("submit", event => {
    event.preventDefault();
    const title = form.querySelector("[data-modality-title]").value.trim();
    if (!title) return;
    const saved = normalizeLearningModality({
      ...existing,
      id: existing?.id || makeId("modality"),
      title,
      description: form.querySelector("[data-modality-description]").value,
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    const index = user.learningModalities.findIndex(item => item.id === saved.id);
    if (index >= 0) user.learningModalities[index] = saved;
    else user.learningModalities.push(saved);
    if (!(unit.workspace.learningModalityIds || []).includes(saved.id)) unit.workspace.learningModalityIds.push(saved.id);
    workspaceModalityEditorId = null;
    autosaveUnit(unit);
    renderUnitWorkspacePanel(unit, "learningModalities");
  });

  form.querySelector("[data-modality-delete]")?.addEventListener("click", () => {
    if (!confirm(`Delete “${existing.title}” from your saved modalities?`)) return;
    user.learningModalities = user.learningModalities.filter(item => item.id !== existing.id);
    user.units.forEach(savedUnit => {
      savedUnit.workspace.learningModalityIds = (savedUnit.workspace.learningModalityIds || []).filter(id => id !== existing.id);
    });
    workspaceModalityEditorId = null;
    saveData();
    renderUnitWorkspacePanel(unit, "learningModalities");
  });
}

/* ============================================================
   UNIT WORKSPACE — INDIGENOUS VOICES RESOURCE LIBRARY
============================================================ */

function renderUnitWorkspaceIndigenousVoices(unit, container) {
  const user = getActiveUser();
  const linked = new Set(unit.workspace.indigenousVoiceResourceIds || []);

  const header = document.createElement("div");
  header.className = "section-heading-row compact-heading-row";
  header.innerHTML = `<div><h4>Indigenous Voices</h4><p class="section-subtitle">A reusable resource collection tagged across grades and subjects so respectful, relevant resources are not trapped inside one unit.</p></div>`;
  if (!readOnlyMode) {
    const add = document.createElement("button");
    add.type = "button";
    add.className = "primary-button";
    add.textContent = "+ Add Resource";
    add.addEventListener("click", () => {
      workspaceIndigenousEditorId = "__new__";
      renderUnitWorkspacePanel(unit, "indigenousVoices");
    });
    header.appendChild(add);
  }
  container.appendChild(header);

  if (workspaceIndigenousEditorId && !readOnlyMode) {
    renderIndigenousResourceEditor(unit, container, workspaceIndigenousEditorId);
    return;
  }

  const ordered = [...user.indigenousResources].sort((a, b) => {
    const score = resource => {
      const gradeMatch = (resource.grades || []).some(grade => unit.classSpec.grades.includes(grade));
      const subjectMatch = (resource.subjects || []).some(subject => subject.toLowerCase() === unit.classSpec.subject.toLowerCase());
      return gradeMatch && subjectMatch ? 3 : subjectMatch ? 2 : gradeMatch ? 1 : 0;
    };
    return score(b) - score(a) || a.title.localeCompare(b.title);
  });

  if (!ordered.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "No Indigenous Voices resources have been saved yet.";
    container.appendChild(empty);
    return;
  }

  const list = document.createElement("div");
  list.className = "indigenous-resource-list";

  ordered.forEach(resource => {
    const card = document.createElement("article");
    card.className = `indigenous-resource-card ${linked.has(resource.id) ? "selected" : ""}`;
    const tags = [
      ...(resource.grades || []),
      ...(resource.subjects || [])
    ];
    card.innerHTML = `
      <div class="indigenous-resource-copy">
        <span class="resource-kind">${escapeHTML(resourceKindLabel(resource))}</span>
        <strong>${escapeHTML(resource.title)}</strong>
        ${resource.description ? `<p>${escapeHTML(resource.description)}</p>` : ""}
        <div class="resource-tag-row">${tags.map(tag => `<span>${escapeHTML(tag)}</span>`).join("")}</div>
      </div>`;

    if (!readOnlyMode) {
      const actions = document.createElement("div");
      actions.className = "resource-card-actions";
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "secondary-button";
      toggle.textContent = linked.has(resource.id) ? "✓ Linked to Unit" : "Link to Unit";
      toggle.addEventListener("click", () => {
        if (linked.has(resource.id)) linked.delete(resource.id);
        else linked.add(resource.id);
        unit.workspace.indigenousVoiceResourceIds = [...linked];
        autosaveUnit(unit);
        renderUnitWorkspacePanel(unit, "indigenousVoices");
      });
      const edit = document.createElement("button");
      edit.type = "button";
      edit.className = "text-button";
      edit.textContent = "Edit";
      edit.addEventListener("click", () => {
        workspaceIndigenousEditorId = resource.id;
        renderUnitWorkspacePanel(unit, "indigenousVoices");
      });
      actions.append(toggle, edit);
      card.appendChild(actions);
    }
    list.appendChild(card);
  });
  container.appendChild(list);
}

function renderIndigenousResourceEditor(unit, container, resourceId) {
  const user = getActiveUser();
  const existing = resourceId === "__new__" ? null : user.indigenousResources.find(item => item.id === resourceId);
  const resource = existing ? structuredCloneSafe(existing) : {
    ...normalizeIndigenousResource({ title: "New Resource", kind: "online", grades: unit.classSpec.grades, subjects: [unit.classSpec.subject] }),
    title: ""
  };

  const gradeOptions = [...new Set([...DEFAULT_GRADES, ...(user.customGrades || []), ...unit.classSpec.grades])];
  const subjectOptions = [...new Set([...DEFAULT_SUBJECTS, ...(user.customSubjects || []), unit.classSpec.subject].filter(Boolean))];

  const form = document.createElement("form");
  form.className = "workspace-inline-editor indigenous-editor";
  form.innerHTML = `
    <div class="workspace-inline-editor-heading"><div><p class="small-label">${existing ? "Edit" : "New"}</p><h4>Indigenous Voices Resource</h4></div><button type="button" class="text-button" data-indigenous-cancel>Cancel</button></div>
    <div class="form-grid two-column-grid">
      <label class="form-field"><span>Resource Type</span><select data-indigenous-kind>
        <option value="online" ${resource.kind === "online" ? "selected" : ""}>Online Resource</option>
        <option value="book" ${resource.kind === "book" ? "selected" : ""}>Book</option>
        <option value="physical" ${resource.kind === "physical" ? "selected" : ""}>Physical Object</option>
        <option value="reference" ${resource.kind === "reference" ? "selected" : ""}>Reference</option>
      </select></label>
      <label class="form-field"><span>Title <small>(required)</small></span><input data-indigenous-title type="text" value="${escapeHTML(resource.title)}" required /></label>
    </div>
    <label class="form-field"><span>Description</span><textarea data-indigenous-description rows="4">${escapeHTML(resource.description || "")}</textarea></label>
    <label class="form-field"><span>Link <small>(optional)</small></span><input data-indigenous-url type="url" value="${escapeHTML(resource.url || "")}" placeholder="https://..." /></label>
    <label class="form-field"><span>Location <small>(optional)</small></span><input data-indigenous-location type="text" value="${escapeHTML(resource.location || "")}" /></label>
    <div class="form-grid two-column-grid">
      <label class="form-field"><span>Author</span><input data-indigenous-author type="text" value="${escapeHTML(resource.author || "")}" /></label>
      <label class="form-field"><span>Publisher</span><input data-indigenous-publisher type="text" value="${escapeHTML(resource.publisher || "")}" /></label>
      <label class="form-field"><span>Year</span><input data-indigenous-year type="text" value="${escapeHTML(resource.year || "")}" /></label>
      <label class="form-field"><span>Edition</span><input data-indigenous-edition type="text" value="${escapeHTML(resource.edition || "")}" /></label>
    </div>
    <fieldset class="form-field"><legend>Grade Tags</legend><div class="tag-checkbox-grid">${gradeOptions.map(grade => `<label><input type="checkbox" data-indigenous-grade value="${escapeHTML(grade)}" ${(resource.grades || []).includes(grade) ? "checked" : ""}><span>${escapeHTML(grade)}</span></label>`).join("")}</div></fieldset>
    <fieldset class="form-field"><legend>Subject Tags</legend><div class="tag-checkbox-grid">${subjectOptions.map(subject => `<label><input type="checkbox" data-indigenous-subject value="${escapeHTML(subject)}" ${(resource.subjects || []).includes(subject) ? "checked" : ""}><span>${escapeHTML(subject)}</span></label>`).join("")}</div></fieldset>
    <label class="form-field"><span>Notes</span><textarea data-indigenous-notes rows="4">${escapeHTML(resource.notes || "")}</textarea></label>
    <div class="modal-actions compact-actions">${existing ? '<button type="button" class="danger-text-button" data-indigenous-delete>Delete Resource</button>' : ""}<button type="submit" class="primary-button">Save Resource</button></div>`;
  container.prepend(form);

  form.querySelector("[data-indigenous-cancel]").addEventListener("click", () => {
    workspaceIndigenousEditorId = null;
    renderUnitWorkspacePanel(unit, "indigenousVoices");
  });

  form.addEventListener("submit", event => {
    event.preventDefault();
    const title = form.querySelector("[data-indigenous-title]").value.trim();
    if (!title) return;
    const grades = [...form.querySelectorAll("[data-indigenous-grade]:checked")].map(input => input.value);
    const subjects = [...form.querySelectorAll("[data-indigenous-subject]:checked")].map(input => input.value);
    const saved = normalizeIndigenousResource({
      ...resource,
      id: existing?.id || makeId("indigenous-resource"),
      title,
      kind: form.querySelector("[data-indigenous-kind]").value,
      description: form.querySelector("[data-indigenous-description]").value,
      url: form.querySelector("[data-indigenous-url]").value,
      location: form.querySelector("[data-indigenous-location]").value,
      author: form.querySelector("[data-indigenous-author]").value,
      publisher: form.querySelector("[data-indigenous-publisher]").value,
      year: form.querySelector("[data-indigenous-year]").value,
      edition: form.querySelector("[data-indigenous-edition]").value,
      notes: form.querySelector("[data-indigenous-notes]").value,
      grades,
      subjects,
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    const index = user.indigenousResources.findIndex(item => item.id === saved.id);
    if (index >= 0) user.indigenousResources[index] = saved;
    else user.indigenousResources.push(saved);
    if (!(unit.workspace.indigenousVoiceResourceIds || []).includes(saved.id)) unit.workspace.indigenousVoiceResourceIds.push(saved.id);
    workspaceIndigenousEditorId = null;
    autosaveUnit(unit);
    renderUnitWorkspacePanel(unit, "indigenousVoices");
  });

  form.querySelector("[data-indigenous-delete]")?.addEventListener("click", () => {
    if (!confirm(`Delete “${existing.title}” from Indigenous Voices?`)) return;
    user.indigenousResources = user.indigenousResources.filter(item => item.id !== existing.id);
    user.units.forEach(savedUnit => {
      savedUnit.workspace.indigenousVoiceResourceIds = (savedUnit.workspace.indigenousVoiceResourceIds || []).filter(id => id !== existing.id);
    });
    workspaceIndigenousEditorId = null;
    saveData();
    renderUnitWorkspacePanel(unit, "indigenousVoices");
  });
}

/* ============================================================
   UNIT WORKSPACE — FIELD TRIPS
============================================================ */

function renderUnitWorkspaceFieldTrips(unit, container) {
  const trips = unit.workspace.fieldTrips || [];

  const header = document.createElement("div");
  header.className = "section-heading-row compact-heading-row";
  header.innerHTML = `<div><h4>Field Trips</h4><p class="section-subtitle">Field trips can replace scheduled unit lessons without deleting the original lesson record.</p></div>`;
  if (!readOnlyMode) {
    const add = document.createElement("button");
    add.type = "button";
    add.className = "primary-button";
    add.textContent = "+ Add Field Trip";
    add.addEventListener("click", () => {
      workspaceFieldTripEditorId = "__new__";
      renderUnitWorkspacePanel(unit, "fieldTrips");
    });
    header.appendChild(add);
  }
  container.appendChild(header);

  if (workspaceFieldTripEditorId && !readOnlyMode) {
    renderFieldTripEditor(unit, container, workspaceFieldTripEditorId);
    return;
  }

  if (!trips.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "No field trips have been added to this unit.";
    container.appendChild(empty);
    return;
  }

  const list = document.createElement("div");
  list.className = "field-trip-list";
  trips
    .slice()
    .sort((a, b) => (a.startDate || "9999").localeCompare(b.startDate || "9999"))
    .forEach(trip => {
      const card = document.createElement("article");
      card.className = "field-trip-card";
      const curriculumCount = (trip.curriculumIds || []).length;
      const dateText = trip.startDate === trip.endDate || !trip.endDate
        ? formatDate(trip.startDate)
        : `${formatDate(trip.startDate)} – ${formatDate(trip.endDate)}`;
      card.innerHTML = `
        <div class="field-trip-icon">↗</div>
        <div class="field-trip-copy">
          <span class="resource-kind">${trip.manualOverride ? "Manual date override" : "Unit calendar date"}</span>
          <strong>${escapeHTML(trip.title)}</strong>
          <p>${escapeHTML(dateText)}${trip.location ? ` · ${escapeHTML(trip.location)}` : ""}</p>
          ${trip.purpose ? `<small>${escapeHTML(trip.purpose)}</small>` : ""}
          <div class="resource-tag-row"><span>${curriculumCount} curriculum connection${curriculumCount === 1 ? "" : "s"}</span></div>
        </div>`;

      if (!readOnlyMode) {
        const edit = document.createElement("button");
        edit.type = "button";
        edit.className = "secondary-button";
        edit.textContent = "Edit";
        edit.addEventListener("click", () => {
          workspaceFieldTripEditorId = trip.id;
          renderUnitWorkspacePanel(unit, "fieldTrips");
        });
        card.appendChild(edit);
      }
      list.appendChild(card);
    });
  container.appendChild(list);
}

function unitLessonDateOptions(unit) {
  return [...new Set((unit.lessons || []).map(lesson => lesson.dateKey).filter(Boolean))].sort();
}

function renderFieldTripEditor(unit, container, fieldTripId) {
  const user = getActiveUser();
  const existing = fieldTripId === "__new__" ? null : (unit.workspace.fieldTrips || []).find(item => item.id === fieldTripId);
  const lessonDates = unitLessonDateOptions(unit);
  const defaultDate = lessonDates[0] || unit.startDate || "";
  const trip = existing ? structuredCloneSafe(existing) : normalizeFieldTrip({ title: "", startDate: defaultDate, endDate: defaultDate });
  const working = unit.curriculumLinks?.working || [];
  const selectedCurriculum = new Set(trip.curriculumIds || []);
  const range = getRelevantDateRange(user);

  const form = document.createElement("form");
  form.className = "workspace-inline-editor field-trip-editor";
  form.innerHTML = `
    <div class="workspace-inline-editor-heading"><div><p class="small-label">${existing ? "Edit" : "New"}</p><h4>Field Trip</h4></div><button type="button" class="text-button" data-fieldtrip-cancel>Cancel</button></div>
    <label class="form-field"><span>Title <small>(required)</small></span><input data-fieldtrip-title type="text" value="${escapeHTML(trip.title)}" placeholder="Field trip title" required /></label>
    <label class="form-field"><span>Description</span><textarea data-fieldtrip-description rows="4">${escapeHTML(trip.description)}</textarea></label>
    <label class="form-field"><span>Purpose</span><textarea data-fieldtrip-purpose rows="4" placeholder="Why is this trip part of the unit?">${escapeHTML(trip.purpose)}</textarea></label>
    <label class="form-field"><span>Location</span><input data-fieldtrip-location type="text" value="${escapeHTML(trip.location)}" /></label>

    <div class="field-trip-date-mode">
      <label class="manual-override-toggle"><input data-fieldtrip-manual type="checkbox" ${trip.manualOverride ? "checked" : ""}><span><strong>Manual date override</strong><small>Use any date in the school year, including weekends or Days Off.</small></span></label>
    </div>

    <div class="fieldtrip-unit-date-fields form-grid two-column-grid">
      <label class="form-field"><span>Start Date</span><select data-fieldtrip-start-select>${lessonDates.map(date => `<option value="${date}" ${date === trip.startDate ? "selected" : ""}>${escapeHTML(formatLongDate(date))}</option>`).join("")}</select></label>
      <label class="form-field"><span>End Date</span><select data-fieldtrip-end-select>${lessonDates.map(date => `<option value="${date}" ${date === trip.endDate ? "selected" : ""}>${escapeHTML(formatLongDate(date))}</option>`).join("")}</select></label>
    </div>

    <div class="fieldtrip-manual-date-fields form-grid two-column-grid">
      <label class="form-field"><span>Start Date</span><input data-fieldtrip-start-input type="date" min="${escapeHTML(range?.start || "")}" max="${escapeHTML(range?.end || "")}" value="${escapeHTML(trip.startDate)}" /></label>
      <label class="form-field"><span>End Date</span><input data-fieldtrip-end-input type="date" min="${escapeHTML(range?.start || "")}" max="${escapeHTML(range?.end || "")}" value="${escapeHTML(trip.endDate)}" /></label>
    </div>

    <section class="field-trip-curriculum-picker">
      <div class="workspace-subheading"><div><p class="small-label">Curriculum Connections</p><h4>Working Curriculum</h4></div></div>
      ${working.length ? '<div class="field-trip-curriculum-list"></div>' : '<p class="empty-state">No Working Curriculum is selected yet. Add curriculum from the Curriculum section, then return here.</p>'}
    </section>

    <div class="modal-actions compact-actions">${existing ? '<button type="button" class="danger-text-button" data-fieldtrip-delete>Delete Field Trip</button>' : ""}<button type="submit" class="primary-button">Save Field Trip</button></div>`;

  container.prepend(form);

  const curriculumList = form.querySelector(".field-trip-curriculum-list");
  if (curriculumList) {
    working.forEach(record => {
      const label = document.createElement("label");
      label.className = "field-trip-curriculum-item";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.value = record.id;
      checkbox.checked = selectedCurriculum.has(record.id);
      const copy = document.createElement("div");
      copy.innerHTML = `<small>${escapeHTML(record.type)} · ${escapeHTML(record.organizingIdea)}</small><span>${escapeHTML(record.text)}</span>`;
      label.append(checkbox, copy);
      curriculumList.appendChild(label);
    });
  }

  const syncMode = () => {
    const manual = form.querySelector("[data-fieldtrip-manual]").checked;
    form.querySelector(".fieldtrip-unit-date-fields").classList.toggle("hidden", manual);
    form.querySelector(".fieldtrip-manual-date-fields").classList.toggle("hidden", !manual);
  };
  form.querySelector("[data-fieldtrip-manual]").addEventListener("change", syncMode);
  syncMode();

  form.querySelector("[data-fieldtrip-cancel]").addEventListener("click", () => {
    workspaceFieldTripEditorId = null;
    renderUnitWorkspacePanel(unit, "fieldTrips");
  });

  form.addEventListener("submit", event => {
    event.preventDefault();
    const manualOverride = form.querySelector("[data-fieldtrip-manual]").checked;
    const title = form.querySelector("[data-fieldtrip-title]").value.trim();
    const startDate = manualOverride
      ? form.querySelector("[data-fieldtrip-start-input]").value
      : form.querySelector("[data-fieldtrip-start-select]").value;
    const endDate = manualOverride
      ? form.querySelector("[data-fieldtrip-end-input]").value
      : form.querySelector("[data-fieldtrip-end-select]").value;

    if (!title || !startDate || !endDate) {
      alert("Please add a title and select the field trip date or date range.");
      return;
    }
    if (endDate < startDate) {
      alert("The field trip end date cannot be before the start date.");
      return;
    }
    if (manualOverride && (
      termsForDate(startDate, user).length === 0 ||
      termsForDate(endDate, user).length === 0
    )) {
      alert("Manual override dates still need to fall within one of your saved School Terms.");
      return;
    }

    const curriculumIds = [...form.querySelectorAll(".field-trip-curriculum-item input:checked")].map(input => input.value);
    const saved = normalizeFieldTrip({
      ...trip,
      id: existing?.id || makeId("field-trip"),
      title,
      description: form.querySelector("[data-fieldtrip-description]").value,
      purpose: form.querySelector("[data-fieldtrip-purpose]").value,
      location: form.querySelector("[data-fieldtrip-location]").value,
      startDate,
      endDate,
      manualOverride,
      curriculumIds,
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    const index = unit.workspace.fieldTrips.findIndex(item => item.id === saved.id);
    if (index >= 0) unit.workspace.fieldTrips[index] = saved;
    else unit.workspace.fieldTrips.push(saved);

    syncFieldTripOverrides(unit);
    workspaceFieldTripEditorId = null;
    autosaveUnit(unit);
    renderUnitWorkspacePanel(unit, "fieldTrips");
  });

  form.querySelector("[data-fieldtrip-delete]")?.addEventListener("click", () => {
    if (!confirm(`Delete the field trip “${existing.title}”? The underlying lesson records will be restored.`)) return;
    unit.workspace.fieldTrips = unit.workspace.fieldTrips.filter(item => item.id !== existing.id);
    syncFieldTripOverrides(unit);
    workspaceFieldTripEditorId = null;
    autosaveUnit(unit);
    renderUnitWorkspacePanel(unit, "fieldTrips");
  });
}

function getFieldTripsForDate(user, dateKey) {
  const results = [];
  (user?.units || []).forEach(unit => {
    (unit.workspace?.fieldTrips || []).forEach(trip => {
      if (isDateWithin(dateKey, trip.startDate, trip.endDate)) {
        results.push({ unit, trip });
      }
    });
  });
  return results.sort((a, b) => a.unit.name.localeCompare(b.unit.name) || a.trip.title.localeCompare(b.trip.title));
}

function appendFieldTripDayCards(container, fieldTrips) {
  fieldTrips.forEach(({ unit, trip }) => {
    const card = document.createElement("div");
    card.className = "day-detail-card day-detail-field-trip";
    card.style.setProperty("--field-trip-colour", normalizeHexColour(unit.colour) || "#FF7043");

    const title = document.createElement("strong");
    title.textContent = `[FIELD TRIP] ${trip.title}`;
    const meta = document.createElement("div");
    meta.className = "term-meta";
    meta.textContent = `${unit.name}${trip.location ? ` · ${trip.location}` : ""}${trip.manualOverride ? " · Manual date override" : ""}`;
    card.append(title, meta);

    if (trip.purpose) {
      const purpose = document.createElement("p");
      purpose.className = "field-trip-day-purpose";
      purpose.textContent = trip.purpose;
      card.appendChild(purpose);
    }

    container.appendChild(card);
  });
}

function syncFieldTripOverrides(unit) {
  (unit.lessons || []).forEach(lesson => {
    if (lesson.override?.type === "fieldTrip") lesson.override = null;
  });

  const trips = (unit.workspace.fieldTrips || [])
    .slice()
    .sort((a, b) => (a.startDate || "9999").localeCompare(b.startDate || "9999"));

  trips.forEach(trip => {
    (unit.lessons || []).forEach(lesson => {
      if (isDateWithin(lesson.dateKey, trip.startDate, trip.endDate) && !lesson.override) {
        lesson.override = { type: "fieldTrip", fieldTripId: trip.id };
      }
    });
  });
}

function getFieldTripForLesson(unit, lesson) {
  if (lesson?.override?.type !== "fieldTrip") return null;
  return (unit?.workspace?.fieldTrips || []).find(trip => trip.id === lesson.override.fieldTripId) || null;
}

function lessonDisplayTitleForUnit(unit, lesson) {
  const trip = getFieldTripForLesson(unit, lesson);
  if (trip) return `${Number(lesson.sequence) || 1} - [FIELD TRIP] ${trip.title}`;
  return lessonDisplayTitle(lesson);
}


function renderUnitWorkspaceLessons(unit, container) {
  const intro = document.createElement("p");
  intro.className = "section-subtitle";
  intro.textContent =
    "Lesson records are already stable and selectable. " +
    "The full living Lesson Planner will attach to these records in the lesson-system release.";

  container.appendChild(intro);

  const list = document.createElement("div");
  list.className = "unit-lesson-list";

  if (!unit.lessons.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "This unit does not have lesson placeholders yet.";
    list.appendChild(empty);
  } else {
    unit.lessons.forEach(lesson => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "unit-lesson-button";

      button.innerHTML =
        `<strong>${escapeHTML(lessonDisplayTitleForUnit(unit, lesson))}</strong>` +
        `<span>${escapeHTML(formatLongDate(lesson.dateKey))}</span>` +
        `<small>${escapeHTML(formatTime(lesson.startTime))}–${escapeHTML(formatTime(lesson.endTime))} · ` +
        `${escapeHTML(hoursLabel(lesson.durationMinutes))}</small>`;

      button.addEventListener("click", () => openLessonPlaceholder(unit.id, lesson.id));
      list.appendChild(button);
    });
  }

  container.appendChild(list);
}

function openLessonPlaceholder(unitId, lessonId) {
  const user = getActiveUser();
  const unit = getUnitById(unitId, user);
  const lesson = unit?.lessons.find(item => item.id === lessonId);
  if (!unit || !lesson) return;
  selectedLessonContext = { unitId, lessonId };
  $("lessonPlaceholderHeading").textContent = `${lessonDisplayTitleForUnit(unit, lesson)} — ${unit.name}`;
  $("lessonPlaceholderMeta").textContent = `${formatLongDate(lesson.dateKey)} · ${formatTime(lesson.startTime)}–${formatTime(lesson.endTime)}`;
  const fieldTrip = getFieldTripForLesson(unit, lesson);
  $("lessonPlaceholderDetails").innerHTML = `
    <div class="summary-card"><span class="summary-label">Class</span><strong>${escapeHTML(classLabel(unit.classSpec))}</strong></div>
    <div class="summary-card"><span class="summary-label">Allocated Time</span><strong>${escapeHTML(hoursLabel(lesson.durationMinutes))}</strong></div>
    <div class="summary-card"><span class="summary-label">Unit</span><strong>${escapeHTML(unit.name)}</strong></div>
    <div class="summary-card"><span class="summary-label">Status</span><strong>${fieldTrip ? `Overridden by field trip: ${escapeHTML(fieldTrip.title)}` : "Lesson plan not built"}</strong></div>`;
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
    ? `<script id="teacherHQReadOnlyData" type="application/json">${safeJSONForScript({ kind: "teacher-hq-readonly-share", schemaVersion: 6, user })}</script>`
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
    const curriculum = (unit.curriculumLinks?.working || unit.selectedCurriculum || [])
      .map(record => `<li><strong>${escapeHTML(record.type)}:</strong> ${escapeHTML(record.text)}</li>`)
      .join("");

    const simulation = unit.workspace?.simulation;
    const project = unit.workspace?.project;
    const linkedResources = user.resourceLibrary
      .filter(resource => (unit.workspace?.resourceIds || []).includes(resource.id))
      .map(resource => `<li>${escapeHTML(resource.title)} <span class="muted">(${escapeHTML(resourceKindLabel(resource))})</span></li>`)
      .join("");
    const modalities = user.learningModalities
      .filter(item => (unit.workspace?.learningModalityIds || []).includes(item.id))
      .map(item => escapeHTML(item.title))
      .join(", ");
    const indigenous = user.indigenousResources
      .filter(item => (unit.workspace?.indigenousVoiceResourceIds || []).includes(item.id))
      .map(item => escapeHTML(item.title))
      .join(", ");
    const fieldTrips = (unit.workspace?.fieldTrips || []).map(trip => {
      const dateLabel = trip.startDate === trip.endDate
        ? formatDate(trip.startDate)
        : `${formatDate(trip.startDate)} – ${formatDate(trip.endDate)}`;
      return `<li><strong>${escapeHTML(trip.title)}</strong> · ${escapeHTML(dateLabel)}${trip.location ? ` · ${escapeHTML(trip.location)}` : ""}</li>`;
    }).join("");

    const lessons = unit.lessons.map(lesson =>
      `<div class="lesson" style="border-left-color:${escapeHTML(unit.colour || "#8C6CFF")};background:${escapeHTML(hexToRgba(unit.colour || "#8C6CFF", 0.10))}"><strong>${escapeHTML(lessonDisplayTitleForUnit(unit, lesson))}</strong> · ${escapeHTML(formatDate(lesson.dateKey))} · ${escapeHTML(formatTime(lesson.startTime))}–${escapeHTML(formatTime(lesson.endTime))}</div>`
    ).join("");

    const unitContent = [
      simulation?.enabled === true
        ? `<p><strong>Simulation:</strong> ${escapeHTML(simulation.title || "Untitled simulation")}${simulation.description ? ` — ${escapeHTML(simulation.description)}` : ""}</p>`
        : simulation?.enabled === false ? '<p class="muted">No interactive simulation for this unit.</p>' : "",
      project?.enabled === true
        ? `<p><strong>Project:</strong> ${escapeHTML(project.title || "Untitled project")}${project.description ? ` — ${escapeHTML(project.description)}` : ""}</p>`
        : project?.enabled === false ? '<p class="muted">No project for this unit.</p>' : "",
      linkedResources ? `<p><strong>Resources</strong></p><ul>${linkedResources}</ul>` : "",
      fieldTrips ? `<p><strong>Field Trips</strong></p><ul>${fieldTrips}</ul>` : "",
      modalities ? `<p><strong>Learning Modalities:</strong> ${modalities}</p>` : "",
      indigenous ? `<p><strong>Indigenous Voices:</strong> ${indigenous}</p>` : ""
    ].filter(Boolean).join("");

    return `<section class="card"><strong>${escapeHTML(unit.name)}</strong><p class="muted">${escapeHTML(classLabel(unit.classSpec))} · Target ${escapeHTML(hoursLabel(unit.targetMinutes))} · Scheduled ${escapeHTML(hoursLabel(scheduled))}</p>${unitContent}${curriculum ? `<p><strong>Working Curriculum</strong></p><ul>${curriculum}</ul>` : '<p class="muted">No working curriculum selected.</p>'}${lessons || '<p class="muted">No lesson placeholders.</p>'}</section>`;
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
