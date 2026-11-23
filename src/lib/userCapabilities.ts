/**
 * Client-side mirror of `backend/src/staffCapabilities.ts`.
 *
 * Access is driven by **assignments**, not subtle role variants:
 * - **Course staff**: id on `course.instructorIds` (full course + all its projects on the hub)
 * - **Project support**: id on `project.assignedAdvisorIds` without staffing that course → that project only
 */
import type { Course, Project, User } from "@/data/types";

/** True if the user is listed as an instructor on any course. */
export function isUserCourseInstructor(userId: string, courses: Course[]): boolean {
  return courses.some((c) => (c.instructorIds ?? []).includes(userId));
}

/** Course staff for a specific course document (purchase approvals, team roster, etc.). */
export function isUserCourseStaffForCourse(userId: string, course: Course | undefined): boolean {
  if (!course) return false;
  return (course.instructorIds ?? []).includes(userId);
}

/**
 * Projects listed on the instructor hub: all projects in courses where the user is course staff,
 * plus only those projects where the user is explicitly on `assignedAdvisorIds` (not other
 * projects in courses they do not staff).
 */
export function projectsVisibleOnInstructorHub(userId: string, allCourses: Course[], projects: Project[]): Project[] {
  return projects.filter((p) => {
    const course = allCourses.find((c) => c.id === p.courseId);
    if (course && (course.instructorIds ?? []).includes(userId)) return true;
    return (p.assignedAdvisorIds ?? []).includes(userId);
  });
}

/**
 * Viewing a project with **project assignment only**: on `assignedAdvisorIds` but not on that
 * course’s `instructorIds`. Limited UI (weekly updates + meetings).
 */
export function isProjectAdvisorWithoutCourseStaff(
  user: User | undefined,
  project: Project | undefined,
  allCourses: Course[],
): boolean {
  if (!user?.id || !project) return false;
  if (!(project.assignedAdvisorIds ?? []).includes(user.id)) return false;
  const course = allCourses.find((c) => c.id === project.courseId);
  return !isUserCourseStaffForCourse(user.id, course);
}

export function canAccessInstructorRoute(user: User | undefined, _courses?: Course[]): boolean {
  return user?.role === "instructor";
}

/** Default home after sign-in (Index). */
export function getPostLoginPath(user: User | undefined, _courses: Course[], _projects: Project[]): string {
  if (!user) return "/login";
  if (user.role === "admin") return "/admin";
  if (user.role === "student") return "/student";
  if (user.role === "instructor") return "/instructor";
  return "/student";
}

/**
 * Instructor account with **no** course `instructorIds` anywhere — only project `assignedAdvisorIds`
 * (compact hub: no “My courses” tab until promoted to course staff).
 */
export function isInstructorProjectOnlyView(user: User | undefined, courses: Course[]): boolean {
  if (!user || user.role !== "instructor") return false;
  return !isUserCourseInstructor(user.id, courses);
}
