/**
 * Staff access model (keep in sync with frontend `src/lib/userCapabilities.ts`):
 *
 * - **Course staff**: user id on `courses[].instructorIds` for the project's course.
 * - **Project support**: user id on `projects[].assignedAdvisorIds` (extra staff; may overlap course list).
 * - **Instructor HTTP surface** (`requireInstructorOrAdmin`): `admin` or `instructor` role.
 *
 * Prefer **capability checks** (lists on course/project documents) over role alone.
 */

import type { DocumentSnapshot, Firestore } from "firebase-admin/firestore";

export type StaffUser = { id?: string; role?: string };

export function readInstructorIds(courseSnap: DocumentSnapshot | null | undefined): string[] {
  if (!courseSnap?.exists) return [];
  return ((courseSnap.get("instructorIds") as string[] | undefined) ?? []).filter(Boolean);
}

export function readAssignedAdvisorIds(projSnap: DocumentSnapshot | null | undefined): string[] {
  if (!projSnap?.exists) return [];
  return ((projSnap.get("assignedAdvisorIds") as string[] | undefined) ?? []).filter(Boolean);
}

/** True if this user may call instructor-scoped HTTP routes (`admin` or `instructor`). */
export async function userMayCallInstructorEndpoints(_db: Firestore, u: StaffUser): Promise<boolean> {
  if (!u?.role) return false;
  return u.role === "admin" || u.role === "instructor";
}

/**
 * Weekly-update moderation (reviewer edit / status): course staff, or instructor explicitly
 * assigned on the project via `assignedAdvisorIds`.
 */
export function staffMayModerateWeeklyUpdate(
  u: StaffUser,
  courseInstructorIds: string[],
  assignedAdvisorIds: string[],
): { ok: true } | { ok: false; error: string } {
  if (u.role === "admin") return { ok: true };
  if (!u.id) return { ok: false, error: "Missing user profile" };
  if (courseInstructorIds.includes(u.id)) return { ok: true };
  if (u.role === "instructor" && assignedAdvisorIds.includes(u.id)) {
    return { ok: true };
  }
  return { ok: false, error: "Not allowed to moderate updates for this project" };
}

/**
 * Purchase request approval: people listed on the course’s `instructorIds`, plus admin.
 */
export function staffMayReviewPurchaseRequest(
  u: StaffUser,
  courseInstructorIds: string[],
): { ok: true } | { ok: false; error: string } {
  if (u.role === "admin") return { ok: true };
  if (!u.id) return { ok: false, error: "Missing user profile" };
  if (courseInstructorIds.includes(u.id)) return { ok: true };
  return { ok: false, error: "Only course instructors may review purchase requests" };
}

/** Project read/write gates used by meetings and other project routes. */
export function userMayAccessProjectByMembership(
  userId: string,
  role: string,
  studentIds: string[],
  courseInstructorIds: string[],
  assignedAdvisorIds: string[],
): boolean {
  if (role === "admin") return true;
  if (studentIds.includes(userId)) return true;
  if (courseInstructorIds.includes(userId)) return true;
  if (role === "instructor" && assignedAdvisorIds.includes(userId)) return true;
  return false;
}

/** Comments on weekly updates: roster + course staff + anyone on `assignedAdvisorIds`. */
export function userMayCommentOnWeeklyUpdate(
  u: StaffUser,
  studentIds: string[],
  courseInstructorIds: string[],
  assignedAdvisorIds: string[],
): boolean {
  if (u.role === "admin") return true;
  if (!u.id) return false;
  return (
    studentIds.includes(u.id) ||
    courseInstructorIds.includes(u.id) ||
    assignedAdvisorIds.includes(u.id)
  );
}
