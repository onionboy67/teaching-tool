/* ============================================================
   TEACHER HQ
   Profiles + School Terms + historical schedule versions
   Local storage + portable backups + read view
============================================================ */

const STORAGE_KEY = "teacherHQData_v2";
const LEGACY_STORAGE_KEY = "teacherHQData_v1";

const DEFAULT_GRADES = [
  "Kindergarten",
  "Grade 1",
  "Grade 2",
  "Grade 3",
  "Grade 4",
  "Grade 5",
  "Grade 6",
  "Grade 7",
  "Grade 8"
];

const DEFAULT_SUBJECTS = [
  "ELA",
  "Math",
  "Second Step",
  "Fine Arts"
];

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday"
];


/* ============================================================
   APP STATE
============================================================ */

let appData = loadData();
let activeUserId = appData.activeUserId || null;

let visibleDate = new Date();
visibleDate = new Date(
  visibleDate.getFullYear(),
  visibleDate.getMonth(),
  1
);

let selectedProfileColour = "#33c7ff";

let workingTerm = null;
let editingTermId = null;
let workingScheduleBlocks = [];
let baseScheduleBlocks = [];
let editingScheduleBlockId = null;

let selectedDayDateKey = null;
let readOnlyMode = false;


/* ============================================================
   DOM REFERENCES
============================================================ */

const userSelectionView = document.getElementById("userSelectionView");
const teacherHQView = document.getElementById("teacherHQView");

const profileList = document.getElementById("profileList");
const createUserDialog = document.getElementById("createUserDialog");
const createUserForm = document.getElementById("createUserForm");
const newUsername = document.getElementById("newUsername");
const profileImageInput = document.getElementById("profileImageInput");

const currentUsername = document.getElementById("currentUsername");
const currentUserAvatar = document.getElementById("currentUserAvatar");
const readOnlyBanner = document.getElementById("readOnlyBanner");

const termDialog = document.getElementById("termDialog");
const scheduleBlockDialog = document.getElementById("scheduleBlockDialog");
const scheduleBlockForm = document.getElementById("scheduleBlockForm");

const instructionalOptions = document.getElementById("instructionalOptions");
const splitClassCheckbox = document.getElementById("splitClassCheckbox");
const splitGradeArea = document.getElementById("splitGradeArea");
const blockType = document.getElementById("blockType");
const blockGrade = document.getElementById("blockGrade");
const blockSubject = document.getElementById("blockSubject");
const splitGradeChoices = document.getElementById("splitGradeChoices");
const blockDayChoices = document.getElementById("blockDayChoices");

const monthTitle = document.getElementById("monthTitle");
const calendarGrid = document.getElementById("calendarGrid");

const unplannedAlert = document.getElementById("unplannedAlert");
const unplannedAlertText = document.getElementById("unplannedAlertText");
const conflictAlert = document.getElementById("conflictAlert");
const conflictAlertText = document.getElementById("conflictAlertText");
const backupReminder = document.getElementById("backupReminder");
const backupStatusText = document.getElementById("backupStatusText");

const dayDetailsDialog = document.getElementById("dayDetailsDialog");
const dayDetailsHeading = document.getElementById("dayDetailsHeading");
const dayDetailsList = document.getElementById("dayDetailsList");

const restoreBackupInput = document.getElementById("restoreBackupInput");


/* ============================================================
   STORAGE + MIGRATION
============================================================ */

function defaultData() {
  return {
    schemaVersion: 2,
    activeUserId: null,
    users: []
  };
}

function loadData() {
  try {
    const current = localStorage.getItem(STORAGE_KEY);

    if (current) {
      const parsed = JSON.parse(current);
      return normalizeData(parsed);
    }

    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);

    if (legacy) {
      const parsedLegacy = JSON.parse(legacy);
      const migrated = normalizeData(parsedLegacy);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      return migrated;
    }
  } catch (error) {
    console.error("Could not load saved data:", error);
  }

  return defaultData();
}

function normalizeData(data) {
  const normalized = data && typeof data === "object"
    ? data
    : defaultData();

  normalized.schemaVersion = 2;

  if (!Array.isArray(normalized.users)) {
    normalized.users = [];
  }

  normalized.users.forEach(user => {
    if (!Array.isArray(user.customGrades)) {
      user.customGrades = [];
    }

    if (!Array.isArray(user.customSubjects)) {
      user.customSubjects = [];
    }

    /*
      Migrate the old School Years structure into School Terms.
      Existing data is preserved rather than discarded.
    */
    if (!Array.isArray(user.terms)) {
      user.terms = [];

      if (Array.isArray(user.schoolYears)) {
        user.schoolYears.forEach(year => {
          const scheduleBlocks =
            Array.isArray(year.scheduleBlocks)
              ? year.scheduleBlocks.map(normalizeBlock)
              : [];

          user.terms.push({
            id: year.id || makeId("term"),
            name: year.name || "Imported School Term",
            startDate: year.startDate || "",
            endDate: year.endDate || "",
            createdAt: year.createdAt || new Date().toISOString(),
            updatedAt: year.updatedAt || new Date().toISOString(),
            scheduleVersions: [
              {
                id: makeId("schedule-version"),
                effectiveStart: year.startDate || "",
                effectiveEnd: year.endDate || "",
                createdAt: year.createdAt || new Date().toISOString(),
                scheduleBlocks
              }
            ]
          });
        });
      }
    }

    user.terms = user.terms.map(normalizeTerm);

    if (!user.activeTermId && user.activeSchoolYearId) {
      user.activeTermId = user.activeSchoolYearId;
    }

    if (!("lastBackupDate" in user)) {
      user.lastBackupDate = null;
    }
  });

  if (!("activeUserId" in normalized)) {
    normalized.activeUserId = null;
  }

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
    normalized.scheduleVersions = [
      {
        id: makeId("schedule-version"),
        effectiveStart: normalized.startDate,
        effectiveEnd: normalized.endDate,
        createdAt: normalized.createdAt,
        scheduleBlocks: Array.isArray(normalized.scheduleBlocks)
          ? normalized.scheduleBlocks.map(normalizeBlock)
          : []
      }
    ];
  }

  normalized.scheduleVersions =
    normalized.scheduleVersions.map(version => ({
      id: version.id || makeId("schedule-version"),
      effectiveStart: version.effectiveStart || normalized.startDate,
      effectiveEnd: version.effectiveEnd || normalized.endDate,
      createdAt: version.createdAt || new Date().toISOString(),
      scheduleBlocks: Array.isArray(version.scheduleBlocks)
        ? version.scheduleBlocks.map(normalizeBlock)
        : []
    }));

  normalized.scheduleVersions.sort((a, b) =>
    a.effectiveStart.localeCompare(b.effectiveStart)
  );

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
    plannedDates: Array.isArray(block.plannedDates)
      ? [...block.plannedDates]
      : []
  };
}

function saveData() {
  appData.activeUserId = activeUserId;

  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(appData)
    );
  } catch (error) {
    console.error("Could not save data:", error);

    alert(
      "The browser could not save your changes. " +
      "If you uploaded a very large profile picture, try a smaller image."
    );
  }
}


/* ============================================================
   GENERAL HELPERS
============================================================ */

function makeId(prefix = "item") {
  if (window.crypto && crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random()
    .toString(16)
    .slice(2)}`;
}

function structuredCloneSafe(value) {
  if (window.structuredClone) {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value));
}

function getActiveUser() {
  return appData.users.find(
    user => user.id === activeUserId
  ) || null;
}

function getTermById(termId, user = getActiveUser()) {
  if (!user || !Array.isArray(user.terms)) {
    return null;
  }

  return user.terms.find(term => term.id === termId) || null;
}

function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function parseLocalDate(dateString) {
  const [year, month, day] =
    dateString.split("-").map(Number);

  return new Date(year, month - 1, day);
}

function addDaysToKey(dateKey, days) {
  const date = parseLocalDate(dateKey);
  date.setDate(date.getDate() + days);
  return getLocalDateKey(date);
}

function clampDateKey(dateKey, startKey, endKey) {
  if (dateKey < startKey) {
    return startKey;
  }

  if (dateKey > endKey) {
    return endKey;
  }

  return dateKey;
}

function isDateWithin(dateKey, startKey, endKey) {
  return Boolean(
    dateKey &&
    startKey &&
    endKey &&
    dateKey >= startKey &&
    dateKey <= endKey
  );
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
  if (!dateString) {
    return "—";
  }

  const date = parseLocalDate(dateString);

  return date.toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function formatLongDate(dateString) {
  if (!dateString) {
    return "—";
  }

  const date = parseLocalDate(dateString);

  return date.toLocaleDateString("en-CA", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric"
  });
}

function formatTime(time) {
  if (!time) {
    return "";
  }

  const [hours, minutes] =
    time.split(":").map(Number);

  const date = new Date();
  date.setHours(hours, minutes, 0, 0);

  return date.toLocaleTimeString("en-CA", {
    hour: "numeric",
    minute: "2-digit"
  });
}

function gradeDisplay(grades) {
  if (!Array.isArray(grades) || grades.length === 0) {
    return "";
  }

  if (grades.length === 1) {
    return grades[0];
  }

  const labels = grades.map(grade => {
    if (grade === "Kindergarten") {
      return "K";
    }

    return grade.replace("Grade ", "");
  });

  return `Grade ${labels.join("/")}`;
}

function timeToMinutes(time) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function termsForDate(dateKey, user = getActiveUser()) {
  if (!user) {
    return [];
  }

  return user.terms.filter(term =>
    isDateWithin(dateKey, term.startDate, term.endDate)
  );
}

function getScheduleVersionForDate(term, dateKey) {
  if (!term || !Array.isArray(term.scheduleVersions)) {
    return null;
  }

  const candidates = term.scheduleVersions.filter(version =>
    isDateWithin(
      dateKey,
      version.effectiveStart,
      version.effectiveEnd
    )
  );

  return candidates.sort((a, b) =>
    a.effectiveStart.localeCompare(b.effectiveStart)
  ).at(-1) || null;
}

function getLatestScheduleVersion(term) {
  return [...(term?.scheduleVersions || [])]
    .sort((a, b) =>
      a.effectiveStart.localeCompare(b.effectiveStart)
    )
    .at(-1) || null;
}

function getDisplayVersion(term) {
  const todayKey = getLocalDateKey();

  if (isDateWithin(todayKey, term.startDate, term.endDate)) {
    return getScheduleVersionForDate(term, todayKey) ||
      getLatestScheduleVersion(term);
  }

  if (todayKey < term.startDate) {
    return getScheduleVersionForDate(term, term.startDate) ||
      getLatestScheduleVersion(term);
  }

  return getScheduleVersionForDate(term, term.endDate) ||
    getLatestScheduleVersion(term);
}

function blockTypeClass(blockType) {
  switch (blockType) {
    case "Admin":
      return "block-admin";
    case "Prep / Planning":
      return "block-prep";
    case "Recess":
      return "block-recess";
    case "Lunch":
      return "block-lunch";
    case "Duty / Supervision":
      return "block-duty";
    case "Instructional Time":
      return "block-instructional-unplanned";
    default:
      return "block-other";
  }
}

function scheduleFingerprint(blocks) {
  const cleaned = blocks.map(block => ({
    weekday: block.weekday,
    startTime: block.startTime,
    endTime: block.endTime,
    blockType: block.blockType,
    label: block.label,
    grades: [...(block.grades || [])].sort(),
    subject: block.subject
  }));

  cleaned.sort((a, b) =>
    JSON.stringify(a).localeCompare(JSON.stringify(b))
  );

  return JSON.stringify(cleaned);
}


/* ============================================================
   INITIALIZATION
============================================================ */

function initializeApp() {
  appData = normalizeData(appData);
  saveData();

  renderProfileSelection();
  renderCalendar();

  if (activeUserId && getActiveUser()) {
    showTeacherHQ();
  } else {
    showUserSelection();
  }
}


/* ============================================================
   USER SELECTION
============================================================ */

function showUserSelection() {
  teacherHQView.classList.add("hidden");
  userSelectionView.classList.remove("hidden");
  exitReadView();
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

function renderProfileSelection() {
  profileList.innerHTML = "";

  if (appData.users.length === 0) {
    const message = document.createElement("p");
    message.className = "section-subtitle";
    message.textContent =
      "No profiles yet. Create the first one to get started.";

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

    card.appendChild(avatar);
    card.appendChild(name);

    card.addEventListener("click", () => {
      activeUserId = user.id;
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

  container.style.background =
    user.profileColour || "#33c7ff";

  const initial = document.createElement("div");
  initial.textContent =
    user.username?.trim()?.charAt(0)?.toUpperCase() || "?";

  initial.style.width = "100%";
  initial.style.height = "100%";
  initial.style.display = "grid";
  initial.style.placeItems = "center";
  initial.style.fontSize = "24px";
  initial.style.fontWeight = "800";
  initial.style.color = "#1d1d1f";

  container.appendChild(initial);
}

function renderCurrentUser() {
  const user = getActiveUser();

  if (!user) {
    return;
  }

  currentUsername.textContent = user.username;
  renderAvatar(currentUserAvatar, user);
}


/* ============================================================
   CREATE USER
============================================================ */

document
  .getElementById("createUserButton")
  .addEventListener("click", openCreateUserDialog);

document
  .getElementById("closeCreateUserButton")
  .addEventListener("click", closeCreateUserDialog);

document
  .getElementById("cancelCreateUserButton")
  .addEventListener("click", closeCreateUserDialog);

document
  .getElementById("switchUserButton")
  .addEventListener("click", () => {
    activeUserId = null;
    saveData();
    showUserSelection();
  });

document
  .querySelectorAll(".colour-choice")
  .forEach(button => {
    button.addEventListener("click", () => {
      selectedProfileColour = button.dataset.colour;

      document
        .querySelectorAll(".colour-choice")
        .forEach(choice =>
          choice.classList.remove("selected")
        );

      button.classList.add("selected");
    });
  });

function openCreateUserDialog() {
  createUserForm.reset();
  selectedProfileColour = "#33c7ff";

  document
    .querySelectorAll(".colour-choice")
    .forEach(choice => {
      choice.classList.toggle(
        "selected",
        choice.dataset.colour === selectedProfileColour
      );
    });

  createUserDialog.showModal();
}

function closeCreateUserDialog() {
  createUserDialog.close();
}

createUserForm.addEventListener(
  "submit",
  async event => {
    event.preventDefault();

    const username = newUsername.value.trim();

    if (!username) {
      return;
    }

    const duplicate = appData.users.some(
      user =>
        user.username.toLowerCase() ===
        username.toLowerCase()
    );

    if (duplicate) {
      alert("That username already exists.");
      return;
    }

    let profileImage = null;
    const file = profileImageInput.files?.[0];

    if (file) {
      try {
        profileImage = await resizeImageForStorage(file);
      } catch (error) {
        console.error(error);

        alert(
          "That profile picture could not be processed. " +
          "The user will be created using the selected colour instead."
        );
      }
    }

    const user = {
      id: makeId("user"),
      username,
      profileColour: selectedProfileColour,
      profileImage,
      createdAt: new Date().toISOString(),
      customGrades: [],
      customSubjects: [],
      terms: [],
      activeTermId: null,
      lastBackupDate: null
    };

    appData.users.push(user);
    activeUserId = user.id;

    saveData();
    closeCreateUserDialog();
    showTeacherHQ();
  }
);

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

        context.drawImage(
          image,
          sourceX,
          sourceY,
          sourceSize,
          sourceSize,
          0,
          0,
          size,
          size
        );

        resolve(
          canvas.toDataURL("image/jpeg", 0.78)
        );
      };

      image.src = event.target.result;
    };

    reader.readAsDataURL(file);
  });
}


/* ============================================================
   TEACHER HQ
============================================================ */

function renderTeacherHQ() {
  const user = getActiveUser();

  if (!user) {
    return;
  }

  renderActiveTermsLabel(user);
  renderCalendar();
  renderTermSummaries(user);
  renderTermsList(user);
  renderWeeklyInstructionalBlocks(user);
  renderBackupState(user);
}

function renderActiveTermsLabel(user) {
  const label = document.getElementById("activeTermsLabel");
  const todayKey = getLocalDateKey();
  const active = termsForDate(todayKey, user);

  if (user.terms.length === 0) {
    label.textContent = "No school terms yet.";
    return;
  }

  if (active.length === 0) {
    label.textContent = `${user.terms.length} saved school term${user.terms.length === 1 ? "" : "s"}.`;
    return;
  }

  label.textContent =
    active.length === 1
      ? `Current term: ${active[0].name}`
      : `${active.length} school terms are active today.`;
}


/* ============================================================
   CALENDAR + OCCURRENCES
============================================================ */

function getOccurrencesForDate(date, user = getActiveUser()) {
  if (!user) {
    return [];
  }

  const dateKey = getLocalDateKey(date);
  const weekday = WEEKDAYS[date.getDay()];
  const occurrences = [];

  termsForDate(dateKey, user).forEach(term => {
    const version = getScheduleVersionForDate(term, dateKey);

    if (!version) {
      return;
    }

    version.scheduleBlocks
      .filter(block => block.weekday === weekday)
      .forEach(block => {
        const planned =
          block.blockType === "Instructional Time" &&
          (block.plannedDates || []).includes(dateKey);

        occurrences.push({
          occurrenceId: `${term.id}|${version.id}|${block.id}|${dateKey}`,
          dateKey,
          termId: term.id,
          termName: term.name,
          versionId: version.id,
          blockId: block.id,
          block,
          planned,
          conflict: false
        });
      });
  });

  markOccurrenceConflicts(occurrences);

  return occurrences.sort((a, b) =>
    a.block.startTime.localeCompare(b.block.startTime)
  );
}

function markOccurrenceConflicts(occurrences) {
  for (let i = 0; i < occurrences.length; i++) {
    for (let j = i + 1; j < occurrences.length; j++) {
      if (
        timesOverlap(
          occurrences[i].block,
          occurrences[j].block
        )
      ) {
        occurrences[i].conflict = true;
        occurrences[j].conflict = true;
      }
    }
  }
}

function timesOverlap(blockA, blockB) {
  const startA = timeToMinutes(blockA.startTime);
  const endA = timeToMinutes(blockA.endTime);
  const startB = timeToMinutes(blockB.startTime);
  const endB = timeToMinutes(blockB.endTime);

  return startA < endB && startB < endA;
}

function getConflictPairCount(occurrences) {
  let count = 0;

  for (let i = 0; i < occurrences.length; i++) {
    for (let j = i + 1; j < occurrences.length; j++) {
      if (
        timesOverlap(
          occurrences[i].block,
          occurrences[j].block
        )
      ) {
        count++;
      }
    }
  }

  return count;
}

function renderCalendar() {
  calendarGrid.innerHTML = "";

  const user = getActiveUser();
  const today = new Date();
  const todayKey = getLocalDateKey(today);

  const year = visibleDate.getFullYear();
  const month = visibleDate.getMonth();

  monthTitle.textContent =
    visibleDate.toLocaleDateString("en-CA", {
      month: "long",
      year: "numeric"
    });

  const weekdayNames = [
    "Sun",
    "Mon",
    "Tue",
    "Wed",
    "Thu",
    "Fri",
    "Sat"
  ];

  weekdayNames.forEach((weekday, index) => {
    const heading = document.createElement("div");

    heading.className = "weekday";
    heading.textContent = weekday;

    if (index === 0 || index === 6) {
      heading.style.opacity = "0.55";
    }

    calendarGrid.appendChild(heading);
  });

  const firstWeekday =
    new Date(year, month, 1).getDay();

  const daysInMonth =
    new Date(year, month + 1, 0).getDate();

  for (let index = 0; index < firstWeekday; index++) {
    const empty = document.createElement("div");
    empty.className = "day empty";
    calendarGrid.appendChild(empty);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const dateKey = getLocalDateKey(date);
    const cell = document.createElement("div");

    cell.className = "day";

    if (date.getDay() === 0 || date.getDay() === 6) {
      cell.classList.add("weekend");
    }

    if (dateKey < todayKey) {
      cell.classList.add("past");
    }

    if (dateKey === todayKey) {
      cell.classList.add("today");
    }

    const number = document.createElement("span");
    number.className = "day-number";
    number.textContent = day;
    cell.appendChild(number);

    const occurrences = user
      ? getOccurrencesForDate(date, user)
      : [];

    const instructional = occurrences.filter(
      occurrence =>
        occurrence.block.blockType === "Instructional Time"
    );

    const unplannedCount = instructional.filter(
      occurrence => !occurrence.planned
    ).length;

    const plannedCount = instructional.filter(
      occurrence => occurrence.planned
    ).length;

    const conflictCount = getConflictPairCount(occurrences);

    const statuses = document.createElement("div");
    statuses.className = "day-statuses";

    if (unplannedCount > 0) {
      statuses.appendChild(
        makeCalendarStatus(unplannedCount, "status-red", "Unplanned instructional blocks")
      );
    }

    if (plannedCount > 0) {
      statuses.appendChild(
        makeCalendarStatus(plannedCount, "status-green", "Planned instructional blocks")
      );
    }

    if (conflictCount > 0) {
      statuses.appendChild(
        makeCalendarStatus(conflictCount, "status-yellow", "Schedule conflicts")
      );
    }

    cell.appendChild(statuses);

    if (occurrences.length > 0) {
      cell.title = occurrences
        .map(occurrence => occurrenceSummary(occurrence))
        .join("\n");
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

  const status =
    block.blockType === "Instructional Time"
      ? occurrence.planned
        ? "Planned"
        : "Unplanned"
      : block.blockType;

  const conflict = occurrence.conflict
    ? " · Conflict"
    : "";

  return `${formatTime(block.startTime)}–${formatTime(block.endTime)} · ${main} · ${status}${conflict}`;
}

function renderCalendarAlerts(user) {
  if (!user || user.terms.length === 0) {
    unplannedAlert.classList.add("hidden");
    conflictAlert.classList.add("hidden");
    return;
  }

  const counts = countFutureAttentionItems(user);

  if (counts.unplanned === 0) {
    unplannedAlert.classList.add("hidden");
  } else {
    unplannedAlertText.textContent =
      counts.unplanned === 1
        ? "1 unplanned instructional block needs attention"
        : `${counts.unplanned} unplanned instructional blocks need attention`;

    unplannedAlert.classList.remove("hidden");
  }

  if (counts.conflicts === 0) {
    conflictAlert.classList.add("hidden");
  } else {
    conflictAlertText.textContent =
      counts.conflicts === 1
        ? "1 schedule conflict needs review"
        : `${counts.conflicts} schedule conflicts need review`;

    conflictAlert.classList.remove("hidden");
  }
}

function countFutureAttentionItems(user) {
  const todayKey = getLocalDateKey();
  const termEndDates = user.terms
    .map(term => term.endDate)
    .filter(Boolean)
    .sort();

  if (termEndDates.length === 0) {
    return {
      unplanned: 0,
      conflicts: 0
    };
  }

  const latestEnd = termEndDates.at(-1);
  const startKey = user.terms.some(term =>
    isDateWithin(todayKey, term.startDate, term.endDate)
  )
    ? todayKey
    : user.terms
        .map(term => term.startDate)
        .filter(date => date >= todayKey)
        .sort()[0] || todayKey;

  let date = parseLocalDate(startKey);
  const end = parseLocalDate(latestEnd);

  let unplanned = 0;
  let conflicts = 0;

  while (date <= end) {
    const occurrences = getOccurrencesForDate(date, user);

    unplanned += occurrences.filter(
      occurrence =>
        occurrence.block.blockType === "Instructional Time" &&
        !occurrence.planned
    ).length;

    conflicts += getConflictPairCount(occurrences);

    date.setDate(date.getDate() + 1);
  }

  return {
    unplanned,
    conflicts
  };
}

document
  .getElementById("previousMonth")
  .addEventListener("click", event => {
    event.stopPropagation();

    visibleDate = new Date(
      visibleDate.getFullYear(),
      visibleDate.getMonth() - 1,
      1
    );

    renderCalendar();
  });

document
  .getElementById("nextMonth")
  .addEventListener("click", event => {
    event.stopPropagation();

    visibleDate = new Date(
      visibleDate.getFullYear(),
      visibleDate.getMonth() + 1,
      1
    );

    renderCalendar();
  });

document
  .getElementById("calendarCard")
  .addEventListener("click", () => {
    window.location.href = "calendar.html";
  });


/* ============================================================
   DAY DETAILS + TEMPORARY PLANNED/UNPLANNED TOGGLE
============================================================ */

function openDayDetails(dateKey) {
  selectedDayDateKey = dateKey;
  const date = parseLocalDate(dateKey);
  const occurrences = getOccurrencesForDate(date);

  dayDetailsHeading.textContent = formatLongDate(dateKey);
  dayDetailsList.innerHTML = "";

  if (occurrences.length === 0) {
    const empty = document.createElement("p");
    empty.className = "section-subtitle";
    empty.textContent = "No scheduled blocks on this date.";
    dayDetailsList.appendChild(empty);
    dayDetailsDialog.showModal();
    return;
  }

  occurrences.forEach(occurrence => {
    const card = document.createElement("div");
    const block = occurrence.block;

    card.className = "day-detail-card";

    if (dateKey < getLocalDateKey()) {
      card.classList.add("past-occurrence");
    }

    if (block.blockType === "Instructional Time") {
      card.classList.add(
        occurrence.planned
          ? "status-planned"
          : "status-unplanned"
      );
    } else {
      card.classList.add(blockTypeClass(block.blockType));
    }

    if (occurrence.conflict) {
      card.classList.add("status-conflict");
    }

    const header = document.createElement("div");
    header.className = "day-detail-header";

    const titleWrap = document.createElement("div");
    const title = document.createElement("strong");

    title.textContent =
      block.blockType === "Instructional Time"
        ? `${gradeDisplay(block.grades)} ${block.subject}`.trim()
        : block.label || block.blockType;

    const meta = document.createElement("div");
    meta.className = "term-meta";
    meta.textContent =
      `${formatTime(block.startTime)}–${formatTime(block.endTime)} · ${occurrence.termName}`;

    titleWrap.appendChild(title);
    titleWrap.appendChild(meta);
    header.appendChild(titleWrap);
    card.appendChild(header);

    if (block.label && block.blockType === "Instructional Time") {
      const detail = document.createElement("div");
      detail.className = "term-meta";
      detail.textContent = block.label;
      card.appendChild(detail);
    }

    if (occurrence.conflict) {
      const warning = document.createElement("span");
      warning.className = "conflict-note";
      warning.textContent = "Schedule overlap";
      card.appendChild(warning);
    }

    if (
      block.blockType === "Instructional Time" &&
      !readOnlyMode
    ) {
      const actions = document.createElement("div");
      actions.className = "day-detail-actions edit-only";

      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "secondary-button";
      toggle.textContent =
        occurrence.planned
          ? "Mark Unplanned"
          : "Mark Planned";

      toggle.addEventListener("click", () => {
        setOccurrencePlanned(
          occurrence,
          !occurrence.planned
        );
      });

      actions.appendChild(toggle);
      card.appendChild(actions);
    }

    dayDetailsList.appendChild(card);
  });

  dayDetailsDialog.showModal();
}

function setOccurrencePlanned(occurrence, planned) {
  const user = getActiveUser();
  const term = getTermById(occurrence.termId, user);

  if (!term) {
    return;
  }

  const version = term.scheduleVersions.find(
    item => item.id === occurrence.versionId
  );

  const block = version?.scheduleBlocks.find(
    item => item.id === occurrence.blockId
  );

  if (!block) {
    return;
  }

  const plannedDates = new Set(block.plannedDates || []);

  if (planned) {
    plannedDates.add(occurrence.dateKey);
  } else {
    plannedDates.delete(occurrence.dateKey);
  }

  block.plannedDates = [...plannedDates].sort();
  term.updatedAt = new Date().toISOString();

  saveData();
  renderTeacherHQ();
  openDayDetails(occurrence.dateKey);
}

document
  .getElementById("closeDayDetailsButton")
  .addEventListener("click", () => {
    dayDetailsDialog.close();
  });


/* ============================================================
   SCHOOL TERM SETUP
============================================================ */

document
  .getElementById("addTermButton")
  .addEventListener("click", () => {
    openTermDialog();
  });

document
  .getElementById("closeTermButton")
  .addEventListener("click", closeTermDialog);

document
  .getElementById("cancelTermButton")
  .addEventListener("click", closeTermDialog);

document
  .getElementById("saveTermButton")
  .addEventListener("click", saveTerm);

document
  .getElementById("addScheduleBlockButton")
  .addEventListener("click", () => {
    openScheduleBlockDialog();
  });

function openTermDialog(termId = null) {
  const user = getActiveUser();

  if (!user || readOnlyMode) {
    return;
  }

  editingTermId = termId;
  workingScheduleBlocks = [];
  baseScheduleBlocks = [];

  const heading = document.getElementById("termDialogHeading");
  const subtitle = document.getElementById("termDialogSubtitle");
  const effectiveField = document.getElementById("effectiveDateField");
  const termStartInput = document.getElementById("termStart");

  if (!termId) {
    workingTerm = {
      id: makeId("term"),
      name: "",
      startDate: "",
      endDate: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      scheduleVersions: []
    };

    heading.textContent = "Add School Term";
    subtitle.textContent =
      "Add a date range and its standard weekly schedule.";

    document.getElementById("termName").value = "";
    termStartInput.value = "";
    termStartInput.disabled = false;
    document.getElementById("termEnd").value = "";
    effectiveField.classList.add("hidden");
  } else {
    const existing = getTermById(termId, user);

    if (!existing) {
      return;
    }

    workingTerm = structuredCloneSafe(existing);

    const displayVersion = getDisplayVersion(existing);
    workingScheduleBlocks = structuredCloneSafe(
      displayVersion?.scheduleBlocks || []
    );

    baseScheduleBlocks = structuredCloneSafe(
      displayVersion?.scheduleBlocks || []
    );

    heading.textContent = "Edit School Term";
    subtitle.textContent =
      "If the schedule has already started, changes become a new version instead of rewriting previous dates.";

    document.getElementById("termName").value = existing.name;
    termStartInput.value = existing.startDate;
    document.getElementById("termEnd").value = existing.endDate;

    const todayKey = getLocalDateKey();
    const termAlreadyStarted = existing.startDate <= todayKey;

    /*
      Once a term has started, the original start date is locked.
      This protects the historical record.
    */
    termStartInput.disabled = termAlreadyStarted;

    const latest = getLatestScheduleVersion(existing);
    const effectiveDefault = termAlreadyStarted
      ? clampDateKey(
          todayKey,
          latest?.effectiveStart || existing.startDate,
          existing.endDate
        )
      : existing.startDate;

    document.getElementById("scheduleEffectiveDate").value =
      effectiveDefault;

    document.getElementById("scheduleEffectiveDate").min =
      termAlreadyStarted
        ? latest?.effectiveStart || existing.startDate
        : existing.startDate;

    document.getElementById("scheduleEffectiveDate").max =
      existing.endDate;

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

  if (!user || !workingTerm || readOnlyMode) {
    return;
  }

  const name =
    document.getElementById("termName").value.trim();

  const existing = editingTermId
    ? getTermById(editingTermId, user)
    : null;

  const startDate = existing &&
    existing.startDate <= getLocalDateKey()
      ? existing.startDate
      : document.getElementById("termStart").value;

  const endDate =
    document.getElementById("termEnd").value;

  if (!name || !startDate || !endDate) {
    alert(
      "Please enter the term name, start date and end date."
    );
    return;
  }

  if (endDate < startDate) {
    alert(
      "The term end date must be on or after the start date."
    );
    return;
  }

  if (!existing) {
    const term = {
      id: workingTerm.id,
      name,
      startDate,
      endDate,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      scheduleVersions: [
        {
          id: makeId("schedule-version"),
          effectiveStart: startDate,
          effectiveEnd: endDate,
          createdAt: new Date().toISOString(),
          scheduleBlocks:
            structuredCloneSafe(workingScheduleBlocks)
        }
      ]
    };

    user.terms.push(term);
    user.activeTermId = term.id;
  } else {
    existing.name = name;
    existing.endDate = endDate;
    existing.updatedAt = new Date().toISOString();

    const scheduleChanged =
      scheduleFingerprint(baseScheduleBlocks) !==
      scheduleFingerprint(workingScheduleBlocks);

    if (scheduleChanged) {
      let effectiveDate =
        document.getElementById("scheduleEffectiveDate").value;

      const todayKey = getLocalDateKey();

      /*
        A term that has already begun cannot have a schedule
        edit back-dated before today. This is what protects the
        record of what previously happened.
      */
      if (existing.startDate <= todayKey && effectiveDate < todayKey) {
        effectiveDate = todayKey;
      }

      effectiveDate = clampDateKey(
        effectiveDate,
        existing.startDate,
        endDate
      );

      applyScheduleRevision(
        existing,
        effectiveDate,
        workingScheduleBlocks
      );
    } else {
      /*
        Metadata-only edits do not create a new schedule version.
        Extend the most recent version if the term end date changed.
      */
      const latest = getLatestScheduleVersion(existing);

      if (latest) {
        latest.effectiveEnd = endDate;
      }
    }

    user.activeTermId = existing.id;
  }

  user.terms.sort((a, b) =>
    a.startDate.localeCompare(b.startDate)
  );

  saveData();
  closeTermDialog();
  renderTeacherHQ();
}

function applyScheduleRevision(term, effectiveDate, blocks) {
  const versions = term.scheduleVersions
    .sort((a, b) =>
      a.effectiveStart.localeCompare(b.effectiveStart)
    );

  const activeVersion =
    getScheduleVersionForDate(term, effectiveDate) ||
    versions.filter(version =>
      version.effectiveStart <= effectiveDate
    ).at(-1) ||
    versions[0];

  /*
    Remove future versions beginning on/after the new change date.
    The new schedule becomes the source of truth going forward.
  */
  term.scheduleVersions = term.scheduleVersions.filter(
    version =>
      version.effectiveStart < effectiveDate ||
      version.id === activeVersion?.id
  );

  if (
    activeVersion &&
    effectiveDate > activeVersion.effectiveStart
  ) {
    activeVersion.effectiveEnd =
      addDaysToKey(effectiveDate, -1);
  } else if (
    activeVersion &&
    effectiveDate === activeVersion.effectiveStart
  ) {
    term.scheduleVersions =
      term.scheduleVersions.filter(
        version => version.id !== activeVersion.id
      );
  }

  term.scheduleVersions.push({
    id: makeId("schedule-version"),
    effectiveStart: effectiveDate,
    effectiveEnd: term.endDate,
    createdAt: new Date().toISOString(),
    scheduleBlocks:
      cloneBlocksForNewVersion(blocks, effectiveDate)
  });

  term.scheduleVersions.sort((a, b) =>
    a.effectiveStart.localeCompare(b.effectiveStart)
  );
}

function cloneBlocksForNewVersion(blocks, effectiveDate) {
  const groupMap = new Map();

  return blocks.map(block => {
    const oldGroup =
      block.repeatGroupId || block.id;

    if (!groupMap.has(oldGroup)) {
      groupMap.set(
        oldGroup,
        makeId("repeat")
      );
    }

    return {
      ...structuredCloneSafe(block),
      id: makeId("block"),
      repeatGroupId: groupMap.get(oldGroup),
      plannedDates: (block.plannedDates || []).filter(
        dateKey => dateKey >= effectiveDate
      )
    };
  });
}


/* ============================================================
   TERM SUMMARIES + TERM LIST
============================================================ */

function renderTermSummaries(user) {
  const container =
    document.getElementById("termSummaryList");

  container.innerHTML = "";

  if (user.terms.length === 0) {
    return;
  }

  const todayKey = getLocalDateKey();

  user.terms.forEach(term => {
    const card = document.createElement("div");
    card.className = "term-summary-card";

    if (isDateWithin(todayKey, term.startDate, term.endDate)) {
      card.classList.add("current");
    }

    if (term.endDate < todayKey) {
      card.classList.add("past-term");
    }

    const name = document.createElement("strong");
    name.textContent = term.name;

    const meta = document.createElement("div");
    meta.className = "term-summary-meta";
    meta.textContent =
      `${formatDate(term.startDate)} – ${formatDate(term.endDate)} · ` +
      `${term.scheduleVersions.length} schedule version${term.scheduleVersions.length === 1 ? "" : "s"}`;

    card.appendChild(name);
    card.appendChild(meta);
    container.appendChild(card);
  });
}

function renderTermsList(user) {
  const section = document.getElementById("termsSection");
  const container = document.getElementById("termsList");

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
    meta.textContent =
      `${formatDate(term.startDate)} – ${formatDate(term.endDate)} · ` +
      `${term.scheduleVersions.length} schedule version${term.scheduleVersions.length === 1 ? "" : "s"}`;

    info.appendChild(name);
    info.appendChild(meta);
    card.appendChild(info);

    if (!readOnlyMode) {
      const actions = document.createElement("div");
      actions.className = "term-card-actions edit-only";

      const edit = document.createElement("button");
      edit.type = "button";
      edit.className = "secondary-button";
      edit.textContent = "Edit Term";
      edit.addEventListener("click", () => {
        openTermDialog(term.id);
      });

      actions.appendChild(edit);
      card.appendChild(actions);
    }

    container.appendChild(card);
  });
}


/* ============================================================
   WEEKLY INSTRUCTIONAL BLOCKS ONLY
============================================================ */

function renderWeeklyInstructionalBlocks(user) {
  const section =
    document.getElementById("weeklyScheduleSection");

  const display =
    document.getElementById("weeklyScheduleDisplay");

  display.innerHTML = "";

  if (user.terms.length === 0) {
    section.classList.add("hidden");
    return;
  }

  const todayKey = getLocalDateKey();
  let relevantTerms = termsForDate(todayKey, user);

  if (relevantTerms.length === 0) {
    const upcoming = user.terms
      .filter(term => term.startDate > todayKey)
      .sort((a, b) =>
        a.startDate.localeCompare(b.startDate)
      );

    if (upcoming.length > 0) {
      const firstDate = upcoming[0].startDate;
      relevantTerms = upcoming.filter(
        term => term.startDate === firstDate
      );
    }
  }

  if (relevantTerms.length === 0) {
    section.classList.add("hidden");
    return;
  }

  section.classList.remove("hidden");

  relevantTerms.forEach(term => {
    const version = getDisplayVersion(term);

    if (!version) {
      return;
    }

    const instructional = version.scheduleBlocks.filter(
      block => block.blockType === "Instructional Time"
    );

    if (instructional.length === 0) {
      return;
    }

    const group = document.createElement("div");
    group.className = "weekly-term-group";

    const heading = document.createElement("div");
    heading.className = "weekly-term-heading";

    const name = document.createElement("strong");
    name.textContent = term.name;

    const dates = document.createElement("p");
    dates.textContent =
      `${formatDate(version.effectiveStart)} – ${formatDate(version.effectiveEnd)}`;

    heading.appendChild(name);
    heading.appendChild(dates);
    group.appendChild(heading);

    const schedule = document.createElement("div");
    schedule.className = "weekly-schedule";

    WEEKDAYS.forEach(day => {
      const column = document.createElement("div");
      column.className = "weekday-column";

      if (day === "Sunday" || day === "Saturday") {
        column.classList.add("weekend-column");
      }

      const title = document.createElement("h4");
      title.textContent = day;
      column.appendChild(title);

      const blocksContainer = document.createElement("div");
      blocksContainer.className = "weekday-blocks";

      const blocks = instructional.filter(
        block => block.weekday === day
      );

      if (blocks.length === 0) {
        const empty = document.createElement("p");
        empty.className = "section-subtitle";
        empty.style.fontSize = "12px";
        empty.textContent = "No instructional blocks";
        blocksContainer.appendChild(empty);
      } else {
        blocks.forEach(block => {
          blocksContainer.appendChild(
            createScheduleBlockElement(
              block,
              false,
              term,
              version
            )
          );
        });
      }

      column.appendChild(blocksContainer);
      schedule.appendChild(column);
    });

    group.appendChild(schedule);
    display.appendChild(group);
  });
}


/* ============================================================
   ADD / EDIT SCHEDULE BLOCK
============================================================ */

document
  .getElementById("closeScheduleBlockButton")
  .addEventListener("click", closeScheduleBlockDialog);

document
  .getElementById("cancelScheduleBlockButton")
  .addEventListener("click", closeScheduleBlockDialog);

blockType.addEventListener(
  "change",
  updateInstructionalVisibility
);

splitClassCheckbox.addEventListener(
  "change",
  updateSplitGradeVisibility
);

function openScheduleBlockDialog(blockId = null) {
  const user = getActiveUser();

  if (!user || readOnlyMode) {
    return;
  }

  populateGradeAndSubjectSelectors();
  scheduleBlockForm.reset();

  editingScheduleBlockId = blockId;

  document.getElementById(
    "scheduleBlockHeading"
  ).textContent =
    blockId ? "Edit Block" : "Add Block";

  blockDayChoices
    .querySelectorAll('input[type="checkbox"]')
    .forEach(checkbox => {
      checkbox.checked =
        checkbox.value === "Monday";
    });

  document.getElementById("blockStartTime").value = "08:00";
  document.getElementById("blockEndTime").value = "09:00";

  if (blockId) {
    const block = workingScheduleBlocks.find(
      item => item.id === blockId
    );

    if (!block) {
      return;
    }

    const relatedBlocks = block.repeatGroupId
      ? workingScheduleBlocks.filter(
          item =>
            item.repeatGroupId ===
            block.repeatGroupId
        )
      : [block];

    const selectedDays = relatedBlocks.map(
      item => item.weekday
    );

    blockDayChoices
      .querySelectorAll('input[type="checkbox"]')
      .forEach(checkbox => {
        checkbox.checked =
          selectedDays.includes(checkbox.value);
      });

    document.getElementById("blockStartTime").value =
      block.startTime;

    document.getElementById("blockEndTime").value =
      block.endTime;

    blockType.value = block.blockType;

    document.getElementById("blockLabel").value =
      block.label || "";

    blockSubject.value = block.subject || "";

    const grades = block.grades || [];

    if (grades.length > 1) {
      splitClassCheckbox.checked = true;
      populateSplitGradeChoices();

      splitGradeChoices
        .querySelectorAll('input[type="checkbox"]')
        .forEach(checkbox => {
          checkbox.checked =
            grades.includes(checkbox.value);
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

function closeScheduleBlockDialog() {
  scheduleBlockDialog.close();
  editingScheduleBlockId = null;
}

function updateInstructionalVisibility() {
  const instructional =
    blockType.value === "Instructional Time";

  instructionalOptions.classList.toggle(
    "hidden",
    !instructional
  );
}

function updateSplitGradeVisibility() {
  const split = splitClassCheckbox.checked;

  splitGradeArea.classList.toggle(
    "hidden",
    !split
  );

  blockGrade
    .closest(".form-field")
    .classList.toggle(
      "hidden",
      split
    );

  if (split) {
    populateSplitGradeChoices();
  }
}

function getAvailableGrades(user) {
  return [
    ...DEFAULT_GRADES,
    ...(user?.customGrades || [])
  ];
}

function getAvailableSubjects(user) {
  return [
    ...DEFAULT_SUBJECTS,
    ...(user?.customSubjects || [])
  ];
}

function populateGradeAndSubjectSelectors() {
  const user = getActiveUser();

  if (!user) {
    return;
  }

  const currentGrade = blockGrade.value;
  const currentSubject = blockSubject.value;

  blockGrade.innerHTML =
    '<option value="">Select grade</option>';

  getAvailableGrades(user).forEach(grade => {
    const option = document.createElement("option");
    option.value = grade;
    option.textContent = grade;
    blockGrade.appendChild(option);
  });

  blockSubject.innerHTML =
    '<option value="">Select subject</option>';

  getAvailableSubjects(user).forEach(subject => {
    const option = document.createElement("option");
    option.value = subject;
    option.textContent = subject;
    blockSubject.appendChild(option);
  });

  if (
    [...blockGrade.options].some(
      option => option.value === currentGrade
    )
  ) {
    blockGrade.value = currentGrade;
  }

  if (
    [...blockSubject.options].some(
      option => option.value === currentSubject
    )
  ) {
    blockSubject.value = currentSubject;
  }

  populateSplitGradeChoices();
}

function populateSplitGradeChoices() {
  const user = getActiveUser();

  if (!user) {
    return;
  }

  const previouslySelected = Array.from(
    splitGradeChoices.querySelectorAll(
      'input[type="checkbox"]:checked'
    )
  ).map(input => input.value);

  splitGradeChoices.innerHTML = "";

  getAvailableGrades(user).forEach(grade => {
    const label = document.createElement("label");
    const checkbox = document.createElement("input");

    checkbox.type = "checkbox";
    checkbox.value = grade;
    checkbox.checked =
      previouslySelected.includes(grade);

    label.appendChild(checkbox);
    label.appendChild(
      document.createTextNode(grade)
    );

    splitGradeChoices.appendChild(label);
  });
}

document
  .getElementById("addCustomGradeButton")
  .addEventListener("click", () => {
    const user = getActiveUser();

    if (!user) {
      return;
    }

    const value = prompt(
      "Enter the grade or class name:"
    );

    if (!value?.trim()) {
      return;
    }

    const cleaned = value.trim();

    const exists = getAvailableGrades(user).some(
      grade =>
        grade.toLowerCase() ===
        cleaned.toLowerCase()
    );

    if (!exists) {
      user.customGrades.push(cleaned);
      saveData();
    }

    populateGradeAndSubjectSelectors();
    blockGrade.value = cleaned;
  });

document
  .getElementById("addCustomSubjectButton")
  .addEventListener("click", () => {
    const user = getActiveUser();

    if (!user) {
      return;
    }

    const value = prompt(
      "Enter the subject name:"
    );

    if (!value?.trim()) {
      return;
    }

    const cleaned = value.trim();

    const exists = getAvailableSubjects(user).some(
      subject =>
        subject.toLowerCase() ===
        cleaned.toLowerCase()
    );

    if (!exists) {
      user.customSubjects.push(cleaned);
      saveData();
    }

    populateGradeAndSubjectSelectors();
    blockSubject.value = cleaned;
  });

scheduleBlockForm.addEventListener(
  "submit",
  saveScheduleBlock
);

function saveScheduleBlock(event) {
  event.preventDefault();

  const selectedDays = Array.from(
    blockDayChoices.querySelectorAll(
      'input[type="checkbox"]:checked'
    )
  ).map(checkbox => checkbox.value);

  if (selectedDays.length === 0) {
    alert("Please select at least one day.");
    return;
  }

  const startTime =
    document.getElementById("blockStartTime").value;

  const endTime =
    document.getElementById("blockEndTime").value;

  const selectedBlockType = blockType.value;

  const label =
    document.getElementById("blockLabel").value.trim();

  if (!startTime || !endTime) {
    alert("Please enter a start and end time.");
    return;
  }

  if (endTime <= startTime) {
    alert(
      "The block end time must be after the start time."
    );
    return;
  }

  let grades = [];
  let subject = "";

  if (selectedBlockType === "Instructional Time") {
    subject = blockSubject.value;

    if (splitClassCheckbox.checked) {
      grades = Array.from(
        splitGradeChoices.querySelectorAll(
          'input[type="checkbox"]:checked'
        )
      ).map(input => input.value);

      if (grades.length < 2) {
        alert(
          "A split class needs at least two grades."
        );
        return;
      }
    } else if (blockGrade.value) {
      grades = [blockGrade.value];
    }

    if (grades.length === 0) {
      alert("Please select a grade.");
      return;
    }

    if (!subject) {
      alert("Please select a subject.");
      return;
    }
  }

  let repeatGroupId = makeId("repeat");
  let plannedDates = [];

  if (editingScheduleBlockId) {
    const existingBlock = workingScheduleBlocks.find(
      item =>
        item.id === editingScheduleBlockId
    );

    if (existingBlock) {
      plannedDates =
        [...(existingBlock.plannedDates || [])];
    }

    if (existingBlock?.repeatGroupId) {
      repeatGroupId =
        existingBlock.repeatGroupId;

      const groupPlannedDates = new Set();

      workingScheduleBlocks
        .filter(
          item =>
            item.repeatGroupId === repeatGroupId
        )
        .forEach(item =>
          (item.plannedDates || []).forEach(
            dateKey => groupPlannedDates.add(dateKey)
          )
        );

      plannedDates = [...groupPlannedDates];

      workingScheduleBlocks =
        workingScheduleBlocks.filter(
          item =>
            item.repeatGroupId !== repeatGroupId
        );
    } else {
      workingScheduleBlocks =
        workingScheduleBlocks.filter(
          item =>
            item.id !== editingScheduleBlockId
        );
    }
  }

  selectedDays.forEach(weekday => {
    workingScheduleBlocks.push({
      id: makeId("block"),
      repeatGroupId,
      weekday,
      startTime,
      endTime,
      blockType: selectedBlockType,
      label,
      grades: [...grades],
      subject,
      plannedDates: [...plannedDates]
    });
  });

  sortScheduleBlocks(workingScheduleBlocks);
  renderScheduleBuilder();

  scheduleBlockDialog.close();
  editingScheduleBlockId = null;
}

function sortScheduleBlocks(blocks) {
  blocks.sort((a, b) => {
    const dayDifference =
      WEEKDAYS.indexOf(a.weekday) -
      WEEKDAYS.indexOf(b.weekday);

    if (dayDifference !== 0) {
      return dayDifference;
    }

    return a.startTime.localeCompare(
      b.startTime
    );
  });
}


/* ============================================================
   SCHEDULE BUILDER + BLOCK DISPLAY
============================================================ */

function renderScheduleBuilder() {
  WEEKDAYS.forEach(day => {
    const container = document.getElementById(
      `${day}Blocks`
    );

    container.innerHTML = "";

    const blocks = workingScheduleBlocks.filter(
      block => block.weekday === day
    );

    if (blocks.length === 0) {
      const empty = document.createElement("p");
      empty.className = "section-subtitle";
      empty.style.fontSize = "12px";
      empty.textContent = "No blocks";
      container.appendChild(empty);
      return;
    }

    blocks.forEach(block => {
      container.appendChild(
        createScheduleBlockElement(
          block,
          true,
          null,
          null
        )
      );
    });
  });
}

function createScheduleBlockElement(
  block,
  editable,
  term = null,
  version = null
) {
  const element = document.createElement("div");

  element.className =
    `schedule-block ${blockTypeClass(block.blockType)}`;

  if (
    block.blockType === "Instructional Time" &&
    term &&
    version
  ) {
    const hasFutureUnplanned =
      blockHasFutureUnplanned(
        block,
        term,
        version
      );

    element.classList.remove(
      "block-instructional-unplanned"
    );

    element.classList.add(
      hasFutureUnplanned
        ? "block-instructional-unplanned"
        : "block-instructional-planned"
    );
  }

  const time = document.createElement("div");
  time.className = "schedule-block-time";
  time.textContent =
    `${formatTime(block.startTime)} – ${formatTime(block.endTime)}`;

  const title = document.createElement("div");
  title.className = "schedule-block-title";

  if (block.blockType === "Instructional Time") {
    title.textContent =
      `${gradeDisplay(block.grades)} ${block.subject}`.trim();
  } else {
    title.textContent =
      block.label || block.blockType;
  }

  element.appendChild(time);
  element.appendChild(title);

  if (
    block.blockType === "Instructional Time" &&
    block.label
  ) {
    const detail = document.createElement("div");
    detail.className = "schedule-block-detail";
    detail.textContent = block.label;
    element.appendChild(detail);
  }

  if (
    block.blockType !== "Instructional Time" &&
    block.label
  ) {
    const detail = document.createElement("div");
    detail.className = "schedule-block-detail";
    detail.textContent = block.blockType;
    element.appendChild(detail);
  }

  if (editable) {
    const actions = document.createElement("div");
    actions.className = "schedule-block-actions";

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.textContent = "Edit";

    editButton.addEventListener("click", () => {
      openScheduleBlockDialog(block.id);
    });

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.textContent = "Delete";

    deleteButton.addEventListener("click", () => {
      const confirmed = confirm(
        "Delete this repeating schedule block?"
      );

      if (!confirmed) {
        return;
      }

      const repeatGroupId =
        block.repeatGroupId;

      workingScheduleBlocks =
        workingScheduleBlocks.filter(
          item =>
            repeatGroupId
              ? item.repeatGroupId !== repeatGroupId
              : item.id !== block.id
        );

      renderScheduleBuilder();
    });

    actions.appendChild(editButton);
    actions.appendChild(deleteButton);
    element.appendChild(actions);
  }

  return element;
}

function blockHasFutureUnplanned(
  block,
  term,
  version
) {
  const todayKey = getLocalDateKey();
  const startKey =
    todayKey > version.effectiveStart
      ? todayKey
      : version.effectiveStart;

  if (startKey > version.effectiveEnd) {
    return false;
  }

  let date = parseLocalDate(startKey);
  const end = parseLocalDate(version.effectiveEnd);

  while (date <= end) {
    if (
      WEEKDAYS[date.getDay()] ===
      block.weekday
    ) {
      const key = getLocalDateKey(date);

      if (
        !(block.plannedDates || []).includes(key)
      ) {
        return true;
      }
    }

    date.setDate(date.getDate() + 1);
  }

  return false;
}


/* ============================================================
   BACKUP + RESTORE + READ VIEW
============================================================ */

document
  .getElementById("downloadBackupButton")
  .addEventListener("click", downloadDailyBackup);

document
  .getElementById("backupReminderButton")
  .addEventListener("click", downloadDailyBackup);

document
  .getElementById("downloadReadViewButton")
  .addEventListener("click", downloadReadView);

document
  .getElementById("previewReadViewButton")
  .addEventListener("click", toggleReadView);

document
  .getElementById("restoreBackupButton")
  .addEventListener("click", () => {
    restoreBackupInput.click();
  });

document
  .getElementById("restoreBackupHQButton")
  .addEventListener("click", () => {
    restoreBackupInput.click();
  });

restoreBackupInput.addEventListener(
  "change",
  restoreBackupFromFile
);

function renderBackupState(user) {
  const todayKey = getLocalDateKey();

  if (user.lastBackupDate === todayKey) {
    backupReminder.classList.add("hidden");
    backupStatusText.textContent =
      `Daily backup downloaded today (${formatDate(todayKey)}).`;
  } else {
    backupReminder.classList.remove("hidden");

    backupStatusText.textContent =
      user.lastBackupDate
        ? `Last downloaded backup: ${formatDate(user.lastBackupDate)}.`
        : "No downloaded backup has been recorded for this profile yet.";
  }
}

function downloadDailyBackup() {
  const user = getActiveUser();

  if (!user) {
    return;
  }

  const todayKey = getLocalDateKey();
  const html = buildReadableExportHTML(
    user,
    {
      title: `Teacher HQ Backup — ${todayKey}`,
      includeRestoreData: true,
      fullAppData: appData
    }
  );

  downloadBlob(
    html,
    `TeacherHQ_Backup_${todayKey}.html`,
    "text/html"
  );

  user.lastBackupDate = todayKey;
  saveData();
  renderBackupState(user);
}

function downloadReadView() {
  const user = getActiveUser();

  if (!user) {
    return;
  }

  const todayKey = getLocalDateKey();

  const html = buildReadableExportHTML(
    user,
    {
      title: `Teacher HQ Read View — ${user.username}`,
      includeRestoreData: false
    }
  );

  downloadBlob(
    html,
    `TeacherHQ_ReadView_${user.username.replace(/\s+/g, "_")}_${todayKey}.html`,
    "text/html"
  );
}

function toggleReadView() {
  readOnlyMode = !readOnlyMode;

  document.body.classList.toggle(
    "read-only",
    readOnlyMode
  );

  readOnlyBanner.classList.toggle(
    "hidden",
    !readOnlyMode
  );

  document.getElementById(
    "previewReadViewButton"
  ).textContent =
    readOnlyMode
      ? "Exit Read View"
      : "Preview Read View";

  renderTeacherHQ();
}

function exitReadView() {
  readOnlyMode = false;
  document.body.classList.remove("read-only");
  readOnlyBanner.classList.add("hidden");

  const button =
    document.getElementById("previewReadViewButton");

  if (button) {
    button.textContent = "Preview Read View";
  }
}

async function restoreBackupFromFile(event) {
  const file = event.target.files?.[0];

  if (!file) {
    return;
  }

  try {
    const text = await file.text();
    let restored;

    if (
      file.name.toLowerCase().endsWith(".json") ||
      text.trim().startsWith("{")
    ) {
      restored = JSON.parse(text);
    } else {
      const match = text.match(
        /<script[^>]*id=["']teacherHQBackupData["'][^>]*>([\s\S]*?)<\/script>/i
      );

      if (!match) {
        throw new Error(
          "No restorable Teacher HQ data was found in that file."
        );
      }

      restored = JSON.parse(match[1]);
    }

    if (
      !restored ||
      !Array.isArray(restored.users)
    ) {
      throw new Error(
        "This does not look like a valid Teacher HQ backup."
      );
    }

    const confirmed = confirm(
      "Restore this backup? This will replace the Teacher HQ data currently stored in this browser."
    );

    if (!confirmed) {
      restoreBackupInput.value = "";
      return;
    }

    appData = normalizeData(restored);
    activeUserId = appData.activeUserId || null;

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(appData)
    );

    restoreBackupInput.value = "";

    alert("Backup restored successfully.");

    if (activeUserId && getActiveUser()) {
      showTeacherHQ();
    } else {
      showUserSelection();
    }
  } catch (error) {
    console.error(error);

    alert(
      `Could not restore that backup: ${error.message}`
    );

    restoreBackupInput.value = "";
  }
}

function downloadBlob(contents, filename, type) {
  const blob = new Blob(
    [contents],
    { type }
  );

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;

  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}

function buildReadableExportHTML(
  user,
  {
    title,
    includeRestoreData,
    fullAppData = null
  }
) {
  const termsHTML =
    buildReadableTermsHTML(user);

  const monthsHTML =
    buildReadableCalendarHTML(user);

  const embedded = includeRestoreData
    ? `<script id="teacherHQBackupData" type="application/json">${safeJSONForScript(fullAppData)}</script>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHTML(title)}</title>
<style>
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;margin:0;background:#f5f5f7;color:#1d1d1f}
main{width:min(1100px,92%);margin:0 auto;padding:40px 0 80px}
h1{font-size:38px;margin-bottom:8px}h2{margin-top:36px}
.muted{color:#74747a}.term{background:#fff;border:1px solid #e3e3e8;border-radius:16px;padding:16px;margin:12px 0}
.week{display:grid;grid-template-columns:repeat(7,1fr);gap:6px}.day{min-height:95px;background:#fff;border:1px solid #e3e3e8;border-radius:10px;padding:7px;font-size:12px}.day.past{opacity:.62}
.date{font-weight:800;margin-bottom:5px}.item{margin:4px 0;padding:4px 6px;border-radius:6px}.planned{background:#ecf8f1;border-left:3px solid #2e9d62}.unplanned{background:#fff1f1;border-left:3px solid #e5484d}.other{background:#f1f1f3;border-left:3px solid #8c8c94}.conflict{box-shadow:inset 0 0 0 2px #e3be4d}
.weekday{font-weight:700;text-align:center;color:#74747a}.schedule{display:grid;grid-template-columns:repeat(7,minmax(130px,1fr));gap:8px;overflow:auto}.col{background:#fff;border:1px solid #e3e3e8;border-radius:12px;padding:9px;min-width:130px}.block{padding:7px;border-radius:8px;background:#f1f1f3;margin:6px 0;font-size:12px}
@media print{body{background:#fff}.day,.term,.col{break-inside:avoid}}
</style>
</head>
<body>
<main>
<h1>${escapeHTML(title)}</h1>
<p class="muted">Profile: ${escapeHTML(user.username)} · Generated ${escapeHTML(new Date().toLocaleString("en-CA"))}</p>
${includeRestoreData
  ? `<p class="muted"><strong>Restorable backup:</strong> this file contains the machine-readable Teacher HQ data needed to restore the site information.</p>`
  : `<p class="muted"><strong>Read-only copy:</strong> this file is a readable snapshot and does not edit the live Teacher HQ site.</p>`
}
<h2>School Terms</h2>
${termsHTML || '<p class="muted">No school terms saved.</p>'}
<h2>Calendar Record</h2>
${monthsHTML || '<p class="muted">No dated schedule information available.</p>'}
</main>
${embedded}
</body>
</html>`;
}

function safeJSONForScript(value) {
  return JSON.stringify(value)
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("&", "\\u0026");
}

function buildReadableTermsHTML(user) {
  return user.terms.map(term => {
    const version = getLatestScheduleVersion(term);

    const scheduleColumns = WEEKDAYS.map(day => {
      const blocks = (version?.scheduleBlocks || [])
        .filter(block => block.weekday === day)
        .map(block => {
          const title =
            block.blockType === "Instructional Time"
              ? `${gradeDisplay(block.grades)} ${block.subject}`.trim()
              : block.label || block.blockType;

          return `<div class="block"><strong>${escapeHTML(formatTime(block.startTime))}–${escapeHTML(formatTime(block.endTime))}</strong><br>${escapeHTML(title)}<br><span class="muted">${escapeHTML(block.blockType)}</span></div>`;
        })
        .join("");

      return `<div class="col"><strong>${escapeHTML(day)}</strong>${blocks || '<p class="muted">—</p>'}</div>`;
    }).join("");

    return `<section class="term">
      <strong>${escapeHTML(term.name)}</strong>
      <p class="muted">${escapeHTML(formatDate(term.startDate))} – ${escapeHTML(formatDate(term.endDate))} · ${term.scheduleVersions.length} schedule version${term.scheduleVersions.length === 1 ? "" : "s"}</p>
      <div class="schedule">${scheduleColumns}</div>
    </section>`;
  }).join("");
}

function buildReadableCalendarHTML(user) {
  if (user.terms.length === 0) {
    return "";
  }

  const starts = user.terms
    .map(term => term.startDate)
    .filter(Boolean)
    .sort();

  const ends = user.terms
    .map(term => term.endDate)
    .filter(Boolean)
    .sort();

  if (starts.length === 0 || ends.length === 0) {
    return "";
  }

  let cursor = parseLocalDate(starts[0]);
  const end = parseLocalDate(ends.at(-1));
  const sections = [];

  cursor = new Date(
    cursor.getFullYear(),
    cursor.getMonth(),
    1
  );

  while (cursor <= end) {
    sections.push(
      buildReadableMonthHTML(
        cursor.getFullYear(),
        cursor.getMonth(),
        user
      )
    );

    cursor = new Date(
      cursor.getFullYear(),
      cursor.getMonth() + 1,
      1
    );
  }

  return sections.join("");
}

function buildReadableMonthHTML(year, month, user) {
  const title = new Date(
    year,
    month,
    1
  ).toLocaleDateString("en-CA", {
    month: "long",
    year: "numeric"
  });

  const weekdays = [
    "Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"
  ];

  const first = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const cells = [];

  weekdays.forEach(day => {
    cells.push(`<div class="weekday">${day}</div>`);
  });

  for (let i = 0; i < first; i++) {
    cells.push('<div></div>');
  }

  const todayKey = getLocalDateKey();

  for (let day = 1; day <= days; day++) {
    const date = new Date(year, month, day);
    const dateKey = getLocalDateKey(date);
    const occurrences =
      getOccurrencesForDate(date, user);

    const classes = [
      "day",
      dateKey < todayKey ? "past" : ""
    ].filter(Boolean).join(" ");

    const items = occurrences.map(occurrence => {
      const block = occurrence.block;

      let statusClass = "other";

      if (block.blockType === "Instructional Time") {
        statusClass = occurrence.planned
          ? "planned"
          : "unplanned";
      }

      if (occurrence.conflict) {
        statusClass += " conflict";
      }

      const title =
        block.blockType === "Instructional Time"
          ? `${gradeDisplay(block.grades)} ${block.subject}`.trim()
          : block.label || block.blockType;

      return `<div class="item ${statusClass}">
        ${escapeHTML(formatTime(block.startTime))} ${escapeHTML(title)}
      </div>`;
    }).join("");

    cells.push(
      `<div class="${classes}">
        <div class="date">${day}</div>
        ${items}
      </div>`
    );
  }

  return `<section>
    <h3>${escapeHTML(title)}</h3>
    <div class="week">${cells.join("")}</div>
  </section>`;
}


/* ============================================================
   READ VIEW PREVIEW
============================================================ */

function setReadOnlyControls() {
  document.body.classList.toggle(
    "read-only",
    readOnlyMode
  );

  readOnlyBanner.classList.toggle(
    "hidden",
    !readOnlyMode
  );
}


/* ============================================================
   MODAL BACKDROP CLOSE
============================================================ */

[
  createUserDialog,
  termDialog,
  scheduleBlockDialog,
  dayDetailsDialog
].forEach(dialog => {
  dialog.addEventListener(
    "click",
    event => {
      if (event.target === dialog) {
        dialog.close();
      }
    }
  );
});


/* ============================================================
   START
============================================================ */

initializeApp();