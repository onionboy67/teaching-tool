/* ============================================================
   TEACHER HQ — CURRICULUM / PROGRESSION REGISTRY
   Keeps the application independent from the physical data-file layout.
   New curriculum files only need to publish one of the arrays below.
============================================================ */
(function () {
  "use strict";
  const arrays = [
    window.TEACHER_HQ_CURRICULUM,
    window.TEACHER_HQ_FINE_ARTS_CURRICULUM,
    window.TEACHER_HQ_SOCIAL_STUDIES_CURRICULUM,
    window.TEACHER_HQ_CAREER_CURRICULUM
  ].filter(Array.isArray);
  const curriculum = arrays.flat();
  const progressions = Array.isArray(window.TEACHER_HQ_PROGRESSIONS) ? window.TEACHER_HQ_PROGRESSIONS : [];
  const byId = new Map(curriculum.map(record => [record.id, record]));
  const progressionById = new Map(progressions.map(record => [record.id, record]));
  const subjectAliases = new Map([
    ["english language arts", "ELA"], ["language arts", "ELA"], ["ela", "ELA"],
    ["mathematics", "Math"], ["math", "Math"],
    ["physical education", "PE"], ["physical education and wellness", "PE"], ["pe", "PE"],
    ["social studies", "Social Studies"], ["social", "Social Studies"],
    ["career education and financial literacy", "Career Education & Financial Literacy"],
    ["career education & financial literacy", "Career Education & Financial Literacy"],
    ["art", "Fine Arts"], ["drama", "Fine Arts"], ["music", "Fine Arts"], ["fine arts", "Fine Arts"]
  ]);
  const canonicalSubject = value => subjectAliases.get(String(value || "").trim().toLowerCase()) || String(value || "").trim();
  window.TeacherHQRegistry = Object.freeze({
    curriculum, progressions, byId, progressionById, canonicalSubject,
    subjectsForGrade(grade) {
      return [...new Set(curriculum.filter(r => r.grade === grade).map(r => r.subject))].sort();
    },
    curriculumFor(grade, subject) {
      const wanted = canonicalSubject(subject);
      return curriculum.filter(r => r.grade === grade && canonicalSubject(r.subject) === wanted);
    },
    progressionFor(framework, grade) {
      return progressions.filter(r => r.framework === framework && (r.gradeTags || []).includes(grade));
    },
    record(id) { return byId.get(id) || progressionById.get(id) || null; }
  });
})();
