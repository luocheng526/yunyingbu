import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const catalogPath = join(dirname(fileURLToPath(import.meta.url)), "../../../public/academy-catalog.json");
const DATA = JSON.parse(readFileSync(catalogPath, "utf8"));

export const TRACKS = DATA.tracks;
export const COURSES = DATA.courses;

export function listCatalog() {
  const courses = COURSES.map((course) => ({
    id: course.id,
    track: course.track,
    title: course.title,
    minutes: course.minutes,
    summary: course.summary,
    lessonCount: course.lessons.length
  }));
  const lessonCount = COURSES.reduce((sum, course) => sum + course.lessons.length, 0);
  return {
    title: DATA.title || "甄选商学院",
    tracks: TRACKS,
    courses,
    stats: {
      tracks: TRACKS.length,
      courses: COURSES.length,
      lessons: lessonCount,
      minutes: COURSES.reduce((sum, course) => sum + Number(course.minutes || 0), 0)
    }
  };
}

export function getCourse(id) {
  const course = COURSES.find((item) => item.id === String(id || ""));
  return course ? structuredClone(course) : null;
}

export function listLessonIds() {
  const ids = [];
  for (const course of COURSES) {
    for (const lesson of course.lessons) {
      ids.push({ courseId: course.id, lessonId: lesson.id });
    }
  }
  return ids;
}
