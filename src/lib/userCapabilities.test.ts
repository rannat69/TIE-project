import { describe, expect, it } from "vitest";
import type { Course, Project, User } from "@/data/types";
import {
  canAccessInstructorRoute,
  getPostLoginPath,
  isInstructorProjectOnlyView,
  isProjectAdvisorWithoutCourseStaff,
  isUserCourseStaffForCourse,
  projectsVisibleOnInstructorHub,
} from "./userCapabilities";

const course = (over: Partial<Course>): Course =>
  ({
    id: "c1",
    code: "TIE1000",
    name: "Test",
    term: "Fall",
    studentIds: [],
    instructorIds: ["ins1"],
    ...over,
  }) as Course;

const project = (over: Partial<Project>): Project =>
  ({
    id: "p1",
    name: "P",
    description: "",
    courseId: "c1",
    studentIds: [],
    progress: 0,
    ...over,
  }) as Project;

const user = (over: Partial<User>): User =>
  ({
    id: "u1",
    name: "Test User",
    email: "u@test",
    role: "student",
    avatarColor: "0 0% 50%",
    ...over,
  }) as User;

describe("canAccessInstructorRoute", () => {
  it("allows instructors", () => {
    expect(canAccessInstructorRoute(user({ role: "instructor" }), [])).toBe(true);
  });

  it("denies non-instructors", () => {
    expect(canAccessInstructorRoute(user({ role: "student" }), [])).toBe(false);
  });
});

describe("getPostLoginPath", () => {
  it("sends instructors to instructor hub", () => {
    expect(getPostLoginPath(user({ role: "instructor" }), [], [])).toBe("/instructor");
  });
});

describe("isInstructorProjectOnlyView", () => {
  it("is true when instructor is not on any course instructor list", () => {
    const u = user({ role: "instructor", id: "a1" });
    expect(isInstructorProjectOnlyView(u, [course({ instructorIds: ["ins1"] })])).toBe(true);
  });

  it("is false when instructor staffs a course", () => {
    const u = user({ role: "instructor", id: "a1" });
    expect(isInstructorProjectOnlyView(u, [course({ instructorIds: ["a1"] })])).toBe(false);
  });
});

describe("projectsVisibleOnInstructorHub", () => {
  it("includes all projects in staffed courses", () => {
    const cX = course({ id: "cx", instructorIds: ["lilly"] });
    const p1 = project({ id: "p1", courseId: "cx" });
    const p2 = project({ id: "p2", courseId: "cx" });
    const cY = course({ id: "cy", instructorIds: ["other"] });
    const pA = project({ id: "pA", courseId: "cy", assignedAdvisorIds: ["lilly"] });
    const pB = project({ id: "pB", courseId: "cy" });
    const out = projectsVisibleOnInstructorHub("lilly", [cX, cY], [p1, p2, pA, pB]);
    expect(out.map((p) => p.id).sort()).toEqual(["p1", "p2", "pA"].sort());
  });

  it("includes only assigned projects in unstaffed courses", () => {
    const cY = course({ id: "cy", instructorIds: ["other"] });
    const pA = project({ id: "pA", courseId: "cy", assignedAdvisorIds: ["lilly"] });
    const pB = project({ id: "pB", courseId: "cy" });
    const out = projectsVisibleOnInstructorHub("lilly", [cY], [pA, pB]);
    expect(out.map((p) => p.id)).toEqual(["pA"]);
  });
});

describe("isProjectAdvisorWithoutCourseStaff", () => {
  it("is true when assigned on project but not course staff", () => {
    const u = user({ id: "lilly", role: "instructor" });
    const cY = course({ id: "cy", instructorIds: ["other"] });
    const pA = project({ id: "pA", courseId: "cy", assignedAdvisorIds: ["lilly"] });
    expect(isProjectAdvisorWithoutCourseStaff(u, pA, [cY])).toBe(true);
  });

  it("is false when user is course staff for that course", () => {
    const u = user({ id: "lilly", role: "instructor" });
    const cX = course({ id: "cx", instructorIds: ["lilly"] });
    const p = project({ id: "p1", courseId: "cx", assignedAdvisorIds: ["lilly"] });
    expect(isProjectAdvisorWithoutCourseStaff(u, p, [cX])).toBe(false);
  });
});

describe("isUserCourseStaffForCourse", () => {
  it("reflects course instructorIds membership", () => {
    const c = course({ instructorIds: ["u1", "u2"] });
    expect(isUserCourseStaffForCourse("u1", c)).toBe(true);
    expect(isUserCourseStaffForCourse("nope", c)).toBe(false);
    expect(isUserCourseStaffForCourse("u1", undefined)).toBe(false);
  });
});
