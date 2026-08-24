/* ============================================================
   TEACHER HQ
   Local prototype storage + profiles + school year setup
============================================================ */

const STORAGE_KEY = "teacherHQData_v1";

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

const CALENDAR_WEEKDAYS = [
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

let workingSchoolYear = null;
let editingSchoolYearId = null;

let workingScheduleBlocks = [];
let editingScheduleBlockId = null;


/* ============================================================
   DOM REFERENCES
============================================================ */

const userSelectionView =
  document.getElementById("userSelectionView");

const teacherHQView =
  document.getElementById("teacherHQView");

const profileList =
  document.getElementById("profileList");

const createUserDialog =
  document.getElementById("createUserDialog");

const createUserForm =
  document.getElementById("createUserForm");

const newUsername =
  document.getElementById("newUsername");

const profileImageInput =
  document.getElementById("profileImageInput");

const currentUsername =
  document.getElementById("currentUsername");

const currentUserAvatar =
  document.getElementById("currentUserAvatar");

const schoolYearDialog =
  document.getElementById("schoolYearDialog");

const scheduleBlockDialog =
  document.getElementById("scheduleBlockDialog");

const scheduleBlockForm =
  document.getElementById("scheduleBlockForm");

const saveScheduleBlockButton =
  document.getElementById("saveScheduleBlockButton") ||
  document.getElementById("saveBlockButton");

const instructionalOptions =
  document.getElementById("instructionalOptions");

const splitClassCheckbox =
  document.getElementById("splitClassCheckbox");

const splitGradeArea =
  document.getElementById("splitGradeArea");

const blockType =
  document.getElementById("blockType");

const blockGrade =
  document.getElementById("blockGrade");

const blockSubject =
  document.getElementById("blockSubject");

const splitGradeChoices =
  document.getElementById("splitGradeChoices");

const blockDayChoices =
  document.getElementById("blockDayChoices");

const unplannedAlert =
  document.getElementById("unplannedAlert");

const unplannedAlertText =
  document.getElementById("unplannedAlertText");

/* ============================================================
   STORAGE
============================================================ */

function defaultData() {
  return {
    activeUserId: null,
    users: []
  };
}

function loadData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (!saved) {
      return defaultData();
    }

    const parsed = JSON.parse(saved);

    if (!Array.isArray(parsed.users)) {
      return defaultData();
    }

    return parsed;
  } catch (error) {
    console.error("Could not load saved data:", error);
    return defaultData();
  }
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
  if (crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random()
    .toString(16)
    .slice(2)}`;
}

function getActiveUser() {
  return appData.users.find(
    user => user.id === activeUserId
  ) || null;
}

function getActiveSchoolYear(user = getActiveUser()) {
  if (!user || !Array.isArray(user.schoolYears)) {
    return null;
  }

  if (user.activeSchoolYearId) {
    const selected = user.schoolYears.find(
      year => year.id === user.activeSchoolYearId
    );

    if (selected) {
      return selected;
    }
  }

  return user.schoolYears.at(-1) || null;
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

  const [year, month, day] =
    dateString.split("-").map(Number);

  const date = new Date(year, month - 1, day);

  return date.toLocaleDateString("en-CA", {
    month: "short",
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

  const gradeNumbers = grades.map(grade => {
    if (grade === "Kindergarten") {
      return "K";
    }

    return grade.replace("Grade ", "");
  });

  return `Grade ${gradeNumbers.join("/")}`;
}


/* ============================================================
   INITIALIZATION
============================================================ */

function initializeApp() {
  normalizeUsers();

  renderProfileSelection();
  renderCalendar();

  if (activeUserId && getActiveUser()) {
    showTeacherHQ();
  } else {
    showUserSelection();
  }
}

function normalizeUsers() {
  appData.users.forEach(user => {
    if (!Array.isArray(user.schoolYears)) {
      user.schoolYears = [];
    }

    if (!Array.isArray(user.customGrades)) {
      user.customGrades = [];
    }

    if (!Array.isArray(user.customSubjects)) {
      user.customSubjects = [];
    }
  });

  saveData();
}


/* ============================================================
   USER SELECTION
============================================================ */

function showUserSelection() {
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

  if (user.profileImage) {
    const image = document.createElement("img");
    image.src = user.profileImage;
    image.alt = `${user.username} profile`;

    container.appendChild(image);
  } else {
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
      selectedProfileColour =
        button.dataset.colour;

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

    const username =
      newUsername.value.trim();

    if (!username) {
      return;
    }

    const duplicate =
      appData.users.some(
        user =>
          user.username.toLowerCase() ===
          username.toLowerCase()
      );

    if (duplicate) {
      alert("That username already exists.");
      return;
    }

    let profileImage = null;

    const file =
      profileImageInput.files?.[0];

    if (file) {
      try {
        profileImage =
          await resizeImageForStorage(file);
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

      schoolYears: [],
      activeSchoolYearId: null
    };

    appData.users.push(user);

    activeUserId = user.id;

    saveData();

    closeCreateUserDialog();
    showTeacherHQ();
  }
);


/* ============================================================
   PROFILE IMAGE RESIZING
============================================================ */

function resizeImageForStorage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = reject;

    reader.onload = event => {
      const image = new Image();

      image.onerror = reject;

      image.onload = () => {
        const size = 220;

        const canvas =
          document.createElement("canvas");

        canvas.width = size;
        canvas.height = size;

        const context =
          canvas.getContext("2d");

        const sourceSize =
          Math.min(image.width, image.height);

        const sourceX =
          (image.width - sourceSize) / 2;

        const sourceY =
          (image.height - sourceSize) / 2;

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

  const schoolYear =
    getActiveSchoolYear(user);

  renderSchoolYearSummary(schoolYear);
  renderWeeklyScheduleDisplay(schoolYear);

  // Re-render the calendar whenever the active user's
  // school-year information changes.
  renderCalendar();
}


/* ============================================================
   CALENDAR PREVIEW
============================================================ */

const monthTitle =
  document.getElementById("monthTitle");

const calendarGrid =
  document.getElementById("calendarGrid");

function renderCalendar() {
  calendarGrid.innerHTML = "";

  const today = new Date();

  const year =
    visibleDate.getFullYear();

  const month =
    visibleDate.getMonth();

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
    const heading =
      document.createElement("div");

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

  for (
    let index = 0;
    index < firstWeekday;
    index++
  ) {
    const empty =
      document.createElement("div");

    empty.className = "day empty";

    calendarGrid.appendChild(empty);
  }

  const schoolYear =
    getActiveSchoolYear();

  for (
    let day = 1;
    day <= daysInMonth;
    day++
  ) {
    const cell =
      document.createElement("div");

    cell.className = "day";

    const date =
      new Date(year, month, day);

    const dayNumber =
      document.createElement("span");

    dayNumber.textContent = day;

    cell.appendChild(dayNumber);

    const weekday =
      date.getDay();

    if (weekday === 0 || weekday === 6) {
      cell.classList.add("weekend");
    }

    const isToday =
      today.getFullYear() === year &&
      today.getMonth() === month &&
      today.getDate() === day;

    if (isToday) {
      cell.classList.add("today");
    }

    const unplannedBlocks =
      getUnplannedBlocksForDate(
        date,
        schoolYear
      );

    if (unplannedBlocks.length > 0) {
      cell.classList.add("has-unplanned");

      const count =
        document.createElement("span");

      count.className =
        "unplanned-count";

      count.textContent =
        unplannedBlocks.length;

      cell.appendChild(count);

      cell.title =
        unplannedBlocks
          .map(block => {
            const grade =
              gradeDisplay(block.grades);

            const subject =
              block.subject || "";

            return (
              `${grade} ${subject}`.trim() +
              ` · ${formatTime(block.startTime)}` +
              `–${formatTime(block.endTime)}` +
              ` · Unplanned`
            );
          })
          .join("\n");
    }

    calendarGrid.appendChild(cell);
  }

  renderUnplannedAlert(schoolYear);
}


/* ============================================================
   UNPLANNED INSTRUCTIONAL BLOCKS
============================================================ */

function getUnplannedBlocksForDate(
  date,
  schoolYear
) {
  if (!schoolYear) {
    return [];
  }

  if (
    !schoolYear.startDate ||
    !schoolYear.endDate
  ) {
    return [];
  }

  const startDate =
    parseLocalDate(
      schoolYear.startDate
    );

  const endDate =
    parseLocalDate(
      schoolYear.endDate
    );

  const comparisonDate =
    new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate()
    );

  if (
    comparisonDate < startDate ||
    comparisonDate > endDate
  ) {
    return [];
  }

  const weekdayName =
    CALENDAR_WEEKDAYS[
      comparisonDate.getDay()
    ];

  const dateKey =
    getLocalDateKey(
      comparisonDate
    );

  return (
    schoolYear.scheduleBlocks || []
  ).filter(block => {

    if (
      block.weekday !== weekdayName ||
      block.blockType !==
        "Instructional Time"
    ) {
      return false;
    }

    const plannedDates =
      Array.isArray(block.plannedDates)
        ? block.plannedDates
        : [];

    return !plannedDates.includes(
      dateKey
    );
  });
}


function renderUnplannedAlert(
  schoolYear
) {
  if (!schoolYear) {
    unplannedAlert.classList.add(
      "hidden"
    );

    return;
  }

  const count =
    countUnplannedOccurrences(
      schoolYear
    );

  if (count === 0) {
    unplannedAlert.classList.add(
      "hidden"
    );

    return;
  }

  unplannedAlertText.textContent =
    count === 1
      ? "1 unplanned block needs attention"
      : `${count} unplanned blocks need attention`;

  unplannedAlert.classList.remove(
    "hidden"
  );
}


function countUnplannedOccurrences(
  schoolYear
) {
  if (
    !schoolYear ||
    !schoolYear.startDate ||
    !schoolYear.endDate
  ) {
    return 0;
  }

  const startDate =
    parseLocalDate(
      schoolYear.startDate
    );

  const endDate =
    parseLocalDate(
      schoolYear.endDate
    );

  let count = 0;

  const date =
    new Date(startDate);

  while (date <= endDate) {
    count +=
      getUnplannedBlocksForDate(
        date,
        schoolYear
      ).length;

    date.setDate(
      date.getDate() + 1
    );
  }

  return count;
}

function getLocalDateKey(date) {
  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() + 1
    ).padStart(2, "0");

  const day =
    String(
      date.getDate()
    ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function parseLocalDate(
  dateString
) {
  const [year, month, day] =
    dateString
      .split("-")
      .map(Number);

  return new Date(
    year,
    month - 1,
    day
  );
}

document
  .getElementById("previousMonth")
  .addEventListener("click", event => {
    event.stopPropagation();

    visibleDate =
      new Date(
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

    visibleDate =
      new Date(
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
   SCHOOL YEAR SETUP
============================================================ */

document
  .getElementById("startSchoolYearButton")
  .addEventListener("click", () => {
    openSchoolYearDialog(false);
  });

document
  .getElementById("editScheduleButton")
  .addEventListener("click", () => {
    openSchoolYearDialog(true);
  });

document
  .getElementById("closeSchoolYearButton")
  .addEventListener(
    "click",
    closeSchoolYearDialog
  );

document
  .getElementById("cancelSchoolYearButton")
  .addEventListener(
    "click",
    closeSchoolYearDialog
  );

function openSchoolYearDialog(editExisting) {
  const user = getActiveUser();

  if (!user) {
    return;
  }

  if (editExisting) {
    const current =
      getActiveSchoolYear(user);

    if (!current) {
      return;
    }

    editingSchoolYearId = current.id;

    workingSchoolYear =
      structuredCloneSafe(current);

    workingScheduleBlocks =
      structuredCloneSafe(
        current.scheduleBlocks || []
      );
  } else {
    editingSchoolYearId = null;

    workingSchoolYear = {
      id: makeId("school-year"),
      name: "",
      startDate: "",
      endDate: "",
      scheduleBlocks: []
    };

    workingScheduleBlocks = [];
  }

  document.getElementById(
    "schoolYearName"
  ).value = workingSchoolYear.name || "";

  document.getElementById(
    "schoolYearStart"
  ).value = workingSchoolYear.startDate || "";

  document.getElementById(
    "schoolYearEnd"
  ).value = workingSchoolYear.endDate || "";

  renderScheduleBuilder();

  schoolYearDialog.showModal();
}

function closeSchoolYearDialog() {
  schoolYearDialog.close();

  workingSchoolYear = null;
  workingScheduleBlocks = [];
  editingSchoolYearId = null;
}

document
  .getElementById("saveSchoolYearButton")
  .addEventListener("click", saveSchoolYear);

function saveSchoolYear() {
  const user = getActiveUser();

  if (!user) {
    return;
  }

  const name =
    document
      .getElementById("schoolYearName")
      .value
      .trim();

  const startDate =
    document
      .getElementById("schoolYearStart")
      .value;

  const endDate =
    document
      .getElementById("schoolYearEnd")
      .value;

  if (!name || !startDate || !endDate) {
    alert(
      "Please enter the school year name, start date and end date."
    );
    return;
  }

  if (
    new Date(`${endDate}T12:00:00`) <=
    new Date(`${startDate}T12:00:00`)
  ) {
    alert(
      "The school year end date must be after the start date."
    );
    return;
  }

  const schoolYear = {
    id:
      editingSchoolYearId ||
      workingSchoolYear?.id ||
      makeId("school-year"),

    name,
    startDate,
    endDate,

    scheduleBlocks:
      structuredCloneSafe(
        workingScheduleBlocks
      ),

    updatedAt:
      new Date().toISOString()
  };

  const existingIndex =
    user.schoolYears.findIndex(
      year => year.id === schoolYear.id
    );

  if (existingIndex >= 0) {
    user.schoolYears[existingIndex] =
      schoolYear;
  } else {
    schoolYear.createdAt =
      new Date().toISOString();

    user.schoolYears.push(schoolYear);
  }

  user.activeSchoolYearId =
    schoolYear.id;

  saveData();

  schoolYearDialog.close();

  workingSchoolYear = null;
  workingScheduleBlocks = [];
  editingSchoolYearId = null;

  renderTeacherHQ();
}

function structuredCloneSafe(value) {
  if (window.structuredClone) {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value));
}


/* ============================================================
   SCHOOL YEAR SUMMARY
============================================================ */

function renderSchoolYearSummary(schoolYear) {
  const label =
    document.getElementById(
      "activeSchoolYearLabel"
    );

  const summary =
    document.getElementById(
      "schoolYearSummary"
    );

  const weeklySection =
    document.getElementById(
      "weeklyScheduleSection"
    );

  if (!schoolYear) {
    label.textContent =
      "No school year created yet.";

    summary.classList.add("hidden");
    weeklySection.classList.add("hidden");

    return;
  }

  label.textContent = schoolYear.name;

  document.getElementById(
    "summarySchoolYearName"
  ).textContent = schoolYear.name;

  document.getElementById(
    "summaryStartDate"
  ).textContent =
    formatDate(schoolYear.startDate);

  document.getElementById(
    "summaryEndDate"
  ).textContent =
    formatDate(schoolYear.endDate);

  document.getElementById(
    "summaryBlockCount"
  ).textContent =
    schoolYear.scheduleBlocks?.length || 0;

  summary.classList.remove("hidden");
  weeklySection.classList.remove("hidden");
}


/* ============================================================
   ADD SCHEDULE BLOCK
============================================================ */

document
  .getElementById("addScheduleBlockButton")
  .addEventListener("click", () => {
    openScheduleBlockDialog();
  });

document
  .getElementById("closeScheduleBlockButton")
  .addEventListener(
    "click",
    closeScheduleBlockDialog
  );

document
  .getElementById("cancelScheduleBlockButton")
  .addEventListener(
    "click",
    closeScheduleBlockDialog
  );

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

  if (!user) {
    return;
  }

  populateGradeAndSubjectSelectors();

  scheduleBlockForm.reset();

  editingScheduleBlockId = blockId;

  document.getElementById(
    "scheduleBlockHeading"
  ).textContent =
    blockId ? "Edit Block" : "Add Block";

  // New blocks default to Monday, 8:00–9:00 AM.
  blockDayChoices
    .querySelectorAll('input[type="checkbox"]')
    .forEach(checkbox => {
      checkbox.checked =
        checkbox.value === "Monday";
    });

  document.getElementById(
    "blockStartTime"
  ).value = "08:00";

  document.getElementById(
    "blockEndTime"
  ).value = "09:00";

  if (blockId) {
    const block =
      workingScheduleBlocks.find(
        item => item.id === blockId
      );

    if (!block) {
      return;
    }

    /*
      If this block belongs to a repeating group,
      load all of the days in that group.
      Older single-day blocks still work.
    */
    const relatedBlocks =
      block.repeatGroupId
        ? workingScheduleBlocks.filter(
            item =>
              item.repeatGroupId ===
              block.repeatGroupId
          )
        : [block];

    const selectedDays =
      relatedBlocks.map(
        item => item.weekday
      );

    blockDayChoices
      .querySelectorAll(
        'input[type="checkbox"]'
      )
      .forEach(checkbox => {
        checkbox.checked =
          selectedDays.includes(
            checkbox.value
          );
      });

    document.getElementById(
      "blockStartTime"
    ).value = block.startTime;

    document.getElementById(
      "blockEndTime"
    ).value = block.endTime;

    blockType.value =
      block.blockType;

    document.getElementById(
      "blockLabel"
    ).value = block.label || "";

    blockSubject.value =
      block.subject || "";

    const grades =
      block.grades || [];

    if (grades.length > 1) {
      splitClassCheckbox.checked =
        true;

      populateSplitGradeChoices();

      splitGradeChoices
        .querySelectorAll(
          'input[type="checkbox"]'
        )
        .forEach(checkbox => {
          checkbox.checked =
            grades.includes(
              checkbox.value
            );
        });
    } else {
      splitClassCheckbox.checked =
        false;

      blockGrade.value =
        grades[0] || "";
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
    blockType.value ===
    "Instructional Time";

  instructionalOptions.classList.toggle(
    "hidden",
    !instructional
  );
}

function updateSplitGradeVisibility() {
  const split =
    splitClassCheckbox.checked;

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


/* ============================================================
   CUSTOM GRADES AND SUBJECTS
============================================================ */

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

  const currentGrade =
    blockGrade.value;

  const currentSubject =
    blockSubject.value;

  blockGrade.innerHTML =
    '<option value="">Select grade</option>';

  getAvailableGrades(user).forEach(grade => {
    const option =
      document.createElement("option");

    option.value = grade;
    option.textContent = grade;

    blockGrade.appendChild(option);
  });

  blockSubject.innerHTML =
    '<option value="">Select subject</option>';

  getAvailableSubjects(user).forEach(subject => {
    const option =
      document.createElement("option");

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

  const previouslySelected =
    Array.from(
      splitGradeChoices.querySelectorAll(
        'input[type="checkbox"]:checked'
      )
    ).map(input => input.value);

  splitGradeChoices.innerHTML = "";

  getAvailableGrades(user).forEach(grade => {
    const label =
      document.createElement("label");

    const checkbox =
      document.createElement("input");

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

    const value =
      prompt("Enter the grade or class name:");

    if (!value?.trim()) {
      return;
    }

    const cleaned = value.trim();

    const exists =
      getAvailableGrades(user).some(
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

    const value =
      prompt("Enter the subject name:");

    if (!value?.trim()) {
      return;
    }

    const cleaned = value.trim();

    const exists =
      getAvailableSubjects(user).some(
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


/* ============================================================
   SAVE SCHEDULE BLOCK
============================================================ */

/*
  blockDay used to be a single select/input. The schedule block
  dialog now uses blockDayChoices, which contains Sunday–Saturday
  checkboxes. Keep every save/edit path going through this helper
  so no code needs the old blockDay element.
*/
function getSelectedScheduleDays() {
  if (!blockDayChoices) {
    console.error(
      'Missing #blockDayChoices. The schedule block dialog cannot read selected days.'
    );

    return [];
  }

  return Array.from(
    blockDayChoices.querySelectorAll(
      'input[type="checkbox"]:checked'
    )
  ).map(checkbox => checkbox.value);
}

function saveScheduleBlock(event) {
  if (event) {
    event.preventDefault();
  }

  const selectedDays =
    getSelectedScheduleDays();

  if (selectedDays.length === 0) {
    alert(
      "Please select at least one day."
    );
    return;
  }

  const startTime =
    document.getElementById(
      "blockStartTime"
    ).value;

  const endTime =
    document.getElementById(
      "blockEndTime"
    ).value;

  const selectedBlockType =
    blockType.value;

  const label =
    document
      .getElementById("blockLabel")
      .value
      .trim();

  if (!startTime || !endTime) {
    alert(
      "Please enter a start and end time."
    );
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

  if (
    selectedBlockType ===
    "Instructional Time"
  ) {
    subject =
      blockSubject.value;

    if (
      splitClassCheckbox.checked
    ) {
      grades = Array.from(
        splitGradeChoices
          .querySelectorAll(
            'input[type="checkbox"]:checked'
          )
      ).map(
        input => input.value
      );

      if (grades.length < 2) {
        alert(
          "A split class needs at least two grades."
        );
        return;
      }
    } else if (blockGrade.value) {
      grades = [
        blockGrade.value
      ];
    }

    if (grades.length === 0) {
      alert(
        "Please select a grade."
      );
      return;
    }

    if (!subject) {
      alert(
        "Please select a subject."
      );
      return;
    }
  }

  /*
    Repeated days share one repeatGroupId.

    When editing a member of a repeating group, edit the group
    as one rule. Preserve plannedDates for weekdays that already
    existed so editing the timetable does not silently erase
    lesson-planning state.
  */
  let repeatGroupId =
    makeId("repeat");

  let preservedPlannedDatesByDay =
    new Map();

  if (editingScheduleBlockId) {
    const existingBlock =
      workingScheduleBlocks.find(
        item =>
          item.id ===
          editingScheduleBlockId
      );

    if (!existingBlock) {
      alert(
        "That block could not be found. Please close the dialog and try again."
      );
      return;
    }

    if (existingBlock.repeatGroupId) {
      repeatGroupId =
        existingBlock.repeatGroupId;

      const relatedBlocks =
        workingScheduleBlocks.filter(
          item =>
            item.repeatGroupId ===
            repeatGroupId
        );

      relatedBlocks.forEach(item => {
        preservedPlannedDatesByDay.set(
          item.weekday,
          Array.isArray(item.plannedDates)
            ? [...item.plannedDates]
            : []
        );
      });

      workingScheduleBlocks =
        workingScheduleBlocks.filter(
          item =>
            item.repeatGroupId !==
            repeatGroupId
        );
    } else {
      preservedPlannedDatesByDay.set(
        existingBlock.weekday,
        Array.isArray(existingBlock.plannedDates)
          ? [...existingBlock.plannedDates]
          : []
      );

      workingScheduleBlocks =
        workingScheduleBlocks.filter(
          item =>
            item.id !==
            editingScheduleBlockId
        );
    }
  }

  selectedDays.forEach(
    weekday => {
      const block = {
        id: makeId("block"),

        repeatGroupId,

        weekday,
        startTime,
        endTime,

        blockType:
          selectedBlockType,

        label,
        grades: [...grades],
        subject,

        plannedDates:
          preservedPlannedDatesByDay.get(
            weekday
          ) || []
      };

      workingScheduleBlocks.push(
        block
      );
    }
  );

  sortScheduleBlocks(
    workingScheduleBlocks
  );

  renderScheduleBuilder();

  scheduleBlockDialog.close();

  editingScheduleBlockId = null;
}

scheduleBlockForm.addEventListener(
  "submit",
  saveScheduleBlock
);

/*
  Some versions of index.html used a type="button" Save Block
  control instead of a submit button. Supporting both prevents
  the Save Block button from appearing dead while still keeping
  the form-submit path for Enter/keyboard use.
*/
if (saveScheduleBlockButton) {
  saveScheduleBlockButton.addEventListener(
    "click",
    event => {
      if (
        saveScheduleBlockButton.type ===
        "submit"
      ) {
        return;
      }

      saveScheduleBlock(event);
    }
  );
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
   SCHEDULE BUILDER DISPLAY
============================================================ */

function renderScheduleBuilder() {
  WEEKDAYS.forEach(day => {
    const container =
      document.getElementById(
        `${day}Blocks`
      );

    container.innerHTML = "";

    const blocks =
      workingScheduleBlocks.filter(
        block => block.weekday === day
      );

    if (blocks.length === 0) {
      const empty =
        document.createElement("p");

      empty.className =
        "section-subtitle";

      empty.style.fontSize = "12px";

      empty.textContent = "No blocks";

      container.appendChild(empty);
      return;
    }

    blocks.forEach(block => {
      container.appendChild(
        createScheduleBlockElement(
          block,
          true
        )
      );
    });
  });
}

function renderWeeklyScheduleDisplay(
  schoolYear
) {
  const display =
    document.getElementById(
      "weeklyScheduleDisplay"
    );

  display.innerHTML = "";

  if (!schoolYear) {
    return;
  }

  WEEKDAYS.forEach(day => {
    const column =
      document.createElement("div");

    column.className =
      "weekday-column";

    const title =
      document.createElement("h4");

    title.textContent = day;

    column.appendChild(title);

    const blocksContainer =
      document.createElement("div");

    blocksContainer.className =
      "weekday-blocks";

    const blocks =
      (schoolYear.scheduleBlocks || [])
        .filter(
          block =>
            block.weekday === day
        );

    if (blocks.length === 0) {
      const empty =
        document.createElement("p");

      empty.className =
        "section-subtitle";

      empty.style.fontSize =
        "12px";

      empty.textContent =
        "No blocks";

      blocksContainer.appendChild(
        empty
      );
    } else {
      blocks.forEach(block => {
        blocksContainer.appendChild(
          createScheduleBlockElement(
            block,
            false
          )
        );
      });
    }

    column.appendChild(
      blocksContainer
    );

    display.appendChild(column);
  });
}

function createScheduleBlockElement(
  block,
  editable
) {
  const element =
    document.createElement("div");

  element.className =
    "schedule-block";

  const time =
    document.createElement("div");

  time.className =
    "schedule-block-time";

  time.textContent =
    `${formatTime(block.startTime)} – ${formatTime(block.endTime)}`;

  const title =
    document.createElement("div");

  title.className =
    "schedule-block-title";

  if (
    block.blockType ===
    "Instructional Time"
  ) {
    const grade =
      gradeDisplay(block.grades);

    title.textContent =
      `${grade} ${block.subject}`.trim();
  } else {
    title.textContent =
      block.label || block.blockType;
  }

  element.appendChild(time);
  element.appendChild(title);

  if (
    block.blockType ===
      "Instructional Time" &&
    block.label
  ) {
    const detail =
      document.createElement("div");

    detail.className =
      "schedule-block-detail";

    detail.textContent =
      block.label;

    element.appendChild(detail);
  }

  if (
    block.blockType !==
      "Instructional Time" &&
    block.label
  ) {
    const detail =
      document.createElement("div");

    detail.className =
      "schedule-block-detail";

    detail.textContent =
      block.blockType;

    element.appendChild(detail);
  }

  if (editable) {
    const actions =
      document.createElement("div");

    actions.className =
      "schedule-block-actions";

    const editButton =
      document.createElement("button");

    editButton.type = "button";
    editButton.textContent = "Edit";

    editButton.addEventListener(
      "click",
      () => {
        openScheduleBlockDialog(
          block.id
        );
      }
    );

    const deleteButton =
      document.createElement("button");

    deleteButton.type = "button";
    deleteButton.textContent = "Delete";

    deleteButton.addEventListener(
      "click",
      () => {
        const confirmed =
          confirm(
            "Delete this schedule block?"
          );

        if (!confirmed) {
          return;
        }

        workingScheduleBlocks =
          workingScheduleBlocks.filter(
            item =>
              item.id !== block.id
          );

        renderScheduleBuilder();
      }
    );

    actions.appendChild(
      editButton
    );

    actions.appendChild(
      deleteButton
    );

    element.appendChild(actions);
  }

  return element;
}


/* ============================================================
   CLOSE DIALOGS WITH ESC / BACKDROP
============================================================ */

[
  createUserDialog,
  schoolYearDialog,
  scheduleBlockDialog
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