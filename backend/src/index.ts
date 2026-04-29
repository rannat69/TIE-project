import "dotenv/config";
import cors from "cors";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getAuth, getFirestore } from "./firebaseAdmin.js";

const app = express();
app.use(express.json());

const frontendOrigin = process.env.FRONTEND_ORIGIN ?? "http://localhost:5173";
app.use(
  cors({
    origin: frontendOrigin,
    credentials: true,
  }),
);

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

async function requireFirebaseAuth(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) {
  const header = req.header("authorization") ?? "";
  const match = header.match(/^Bearer (.+)$/i);
  if (!match) return res.status(401).json({ error: "Missing Bearer token" });

  try {
    const decoded = await getAuth().verifyIdToken(match[1]);
    (req as any).firebaseUser = decoded;
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

app.get("/me", requireFirebaseAuth, (req, res) => {
  const decoded = (req as any).firebaseUser as { uid: string; email?: string };
  res.json({ uid: decoded.uid, email: decoded.email ?? null });
});

// Ensure a Firestore "users" row exists for the signed-in Firebase user.
// New sign-ups default to "student"; admins can later promote via admin UI.
app.post("/users/ensure", requireFirebaseAuth, async (req, res) => {
  const decoded = (req as any).firebaseUser as { email?: string };
  const email = decoded.email?.trim();
  if (!email) return res.status(400).json({ error: "Missing email in token" });

  const db = getFirestore();
  const usersCol = db.collection("users");
  const snap = await usersCol.where("email", "==", email).limit(1).get();
  if (!snap.empty) return res.json({ ok: true, created: false });

  const body = (req.body ?? {}) as { name?: unknown; hkustEmail?: unknown; programme?: unknown };
  const nameFromBody = typeof body.name === "string" ? body.name.trim() : "";
  const programme = typeof body.programme === "string" ? body.programme.trim() : "";
  const hkustEmail =
    typeof body.hkustEmail === "string" && body.hkustEmail.trim() ? body.hkustEmail.trim() : "";

  const id = uid("u");
  const count = (await usersCol.count().get()).data().count;
  const avatarColor = palette[count % palette.length];
  const name = nameFromBody || email.split("@")[0]?.replace(/[._-]+/g, " ").trim() || "Student";

  await usersCol.doc(id).set({
    id,
    name,
    email,
    hkustEmail: hkustEmail || null,
    programme: programme || null,
    role: "student",
    avatarColor,
  });

  return res.json({ ok: true, created: true, id });
});

const palette = [
  "217 60% 22%",
  "188 70% 38%",
  "262 55% 45%",
  "152 55% 36%",
  "35 90% 48%",
  "0 70% 48%",
];

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

async function requireAdminRole(req: express.Request, res: express.Response, next: express.NextFunction) {
  const decoded = (req as any).firebaseUser as { email?: string };
  const email = decoded.email?.toLowerCase();
  if (!email) return res.status(403).json({ error: "Missing email in token" });

  const db = getFirestore();
  const snap = await db.collection("users").where("email", "==", email).limit(1).get();
  const doc = snap.docs[0];
  const role = doc?.get("role") as string | undefined;
  if (role !== "admin") return res.status(403).json({ error: "Admin role required" });
  return next();
}

async function getCurrentUser(req: express.Request) {
  const decoded = (req as any).firebaseUser as { email?: string };
  const email = decoded.email?.toLowerCase();
  if (!email) return null;
  const db = getFirestore();
  const snap = await db.collection("users").where("email", "==", email).limit(1).get();
  const doc = snap.docs[0];
  if (!doc) return null;
  return {
    id: doc.get("id") as string | undefined,
    email: doc.get("email") as string | undefined,
    role: doc.get("role") as string | undefined,
  };
}

async function requireInstructorOrAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  const u = await getCurrentUser(req);
  if (!u?.role) return res.status(403).json({ error: "Missing user profile" });
  if (u.role !== "admin" && u.role !== "instructor") {
    return res.status(403).json({ error: "Instructor or admin role required" });
  }
  (req as any).appUser = u;
  return next();
}

async function requireInstructorAssignedToCourse(req: express.Request, res: express.Response, next: express.NextFunction) {
  const u = (req as any).appUser as { id?: string; role?: string };
  const courseId = (req.params.courseId ?? req.params.id ?? "").toString().trim();
  if (!courseId) return res.status(400).json({ error: "Missing course id" });
  if (u.role === "admin") return next();
  if (!u.id) return res.status(403).json({ error: "Missing instructor id" });

  const db = getFirestore();
  const snap = await db.collection("courses").doc(courseId).get();
  if (!snap.exists) return res.status(404).json({ error: "Course not found" });
  const instructorIds = (snap.get("instructorIds") as string[] | undefined) ?? [];
  if (!instructorIds.includes(u.id)) return res.status(403).json({ error: "Not assigned to this course" });
  return next();
}

app.post("/admin/users", requireFirebaseAuth, requireAdminRole, async (req, res) => {
  const { name, email, role } = (req.body ?? {}) as { name?: string; email?: string; role?: string };
  if (!name?.trim() || !email?.trim() || !role?.trim()) {
    return res.status(400).json({ error: "name, email, and role are required" });
  }

  const id = uid("u");
  const db = getFirestore();
  const usersCol = db.collection("users");
  const count = (await usersCol.count().get()).data().count;
  const avatarColor = palette[count % palette.length];

  await usersCol.doc(id).set({
    id,
    name: name.trim(),
    email: email.trim(),
    role: role.trim(),
    avatarColor,
  });

  return res.json({ ok: true, id });
});

app.patch("/admin/users/:id/role", requireFirebaseAuth, requireAdminRole, async (req, res) => {
  const userId = (req.params.id ?? "").toString().trim();
  const nextRole = (req.body?.role ?? "").toString().trim();
  if (!userId || !nextRole) {
    return res.status(400).json({ error: "user id and role are required" });
  }
  if (!["admin", "instructor", "student"].includes(nextRole)) {
    return res.status(400).json({ error: "Invalid role" });
  }

  const db = getFirestore();
  const ref = db.collection("users").doc(userId);
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ error: "User not found" });
  await ref.update({ role: nextRole });

  return res.json({ ok: true });
});

app.delete("/admin/users/:id", requireFirebaseAuth, requireAdminRole, async (req, res) => {
  const userId = (req.params.id ?? "").toString().trim();
  if (!userId) return res.status(400).json({ error: "user id is required" });

  const db = getFirestore();
  const ref = db.collection("users").doc(userId);
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ error: "User not found" });
  await ref.delete();

  return res.json({ ok: true });
});

app.post("/admin/courses", requireFirebaseAuth, requireAdminRole, async (req, res) => {
  const { code, name, term } = (req.body ?? {}) as { code?: string; name?: string; term?: string };
  if (!code?.trim() || !name?.trim() || !term?.trim()) {
    return res.status(400).json({ error: "code, name, and term are required" });
  }

  const id = uid("c");
  const db = getFirestore();
  await db.collection("courses").doc(id).set({
    id,
    code: code.trim(),
    name: name.trim(),
    term: term.trim(),
    instructorIds: [],
    studentIds: [],
  });

  return res.json({ ok: true, id });
});

app.post("/admin/projects", requireFirebaseAuth, requireAdminRole, async (req, res) => {
  const { name, description, courseId, studentIds } = (req.body ?? {}) as {
    name?: string;
    description?: string;
    courseId?: string;
    studentIds?: unknown;
  };
  if (!name?.trim() || !courseId?.trim()) {
    return res.status(400).json({ error: "name and courseId are required" });
  }
  const students = Array.isArray(studentIds) ? (studentIds.filter((x) => typeof x === "string") as string[]) : [];

  const id = uid("p");
  const db = getFirestore();
  const courseSnap = await db.collection("courses").doc(courseId.trim()).get();
  if (!courseSnap.exists) return res.status(404).json({ error: "Course not found" });
  const courseRoster = (courseSnap.get("studentIds") as string[] | undefined) ?? [];
  const notInCourse = students.filter((sid) => !courseRoster.includes(sid));
  if (notInCourse.length) {
    return res.status(400).json({ error: "Add student(s) to the course first before assigning to a project." });
  }

  await db.collection("projects").doc(id).set({
    id,
    name: name.trim(),
    description: (description ?? "").toString(),
    courseId: courseId.trim(),
    studentIds: students,
    progress: 0,
  });

  return res.json({ ok: true, id });
});

app.patch("/admin/courses/:id/instructors", requireFirebaseAuth, requireAdminRole, async (req, res) => {
  const courseId = req.params.id;
  const { instructorId, op } = (req.body ?? {}) as { instructorId?: string; op?: "add" | "remove" };
  if (!courseId?.trim() || !instructorId?.trim() || (op !== "add" && op !== "remove")) {
    return res.status(400).json({ error: "courseId, instructorId, and op(add|remove) are required" });
  }

  const db = getFirestore();
  const ref = db.collection("courses").doc(courseId.trim());
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ error: "Course not found" });

  const instructorIds = (snap.get("instructorIds") as string[] | undefined) ?? [];
  const next =
    op === "add"
      ? Array.from(new Set([...instructorIds, instructorId.trim()]))
      : instructorIds.filter((i) => i !== instructorId.trim());

  await ref.update({ instructorIds: next });
  return res.json({ ok: true });
});

app.patch("/admin/projects/:id/students", requireFirebaseAuth, requireAdminRole, async (req, res) => {
  const projectId = req.params.id;
  const { studentId, op } = (req.body ?? {}) as { studentId?: string; op?: "add" | "remove" };
  if (!projectId?.trim() || !studentId?.trim() || (op !== "add" && op !== "remove")) {
    return res.status(400).json({ error: "projectId, studentId, and op(add|remove) are required" });
  }

  const db = getFirestore();
  const ref = db.collection("projects").doc(projectId.trim());
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ error: "Project not found" });

  const studentIds = (snap.get("studentIds") as string[] | undefined) ?? [];
  const courseId = (snap.get("courseId") as string | undefined) ?? "";
  if (!courseId.trim()) return res.status(400).json({ error: "Project missing courseId" });

  // Enforce clean flow: students must be added to course roster first.
  if (op === "add") {
    const courseSnap = await db.collection("courses").doc(courseId.trim()).get();
    if (!courseSnap.exists) return res.status(404).json({ error: "Course not found" });
    const courseRoster = (courseSnap.get("studentIds") as string[] | undefined) ?? [];
    if (!courseRoster.includes(studentId.trim())) {
      return res.status(400).json({ error: "Add student to the course first." });
    }
  }
  const next =
    op === "add"
      ? Array.from(new Set([...studentIds, studentId.trim()]))
      : studentIds.filter((i) => i !== studentId.trim());

  await ref.update({ studentIds: next });
  return res.json({ ok: true });
});

// INSTRUCTOR-SCOPED MANAGEMENT
// Instructors can manage only courses they are assigned to (admins can use these too).

app.post("/instructor/projects", requireFirebaseAuth, requireInstructorOrAdmin, async (req, res) => {
  const { name, description, courseId, studentIds } = (req.body ?? {}) as {
    name?: string;
    description?: string;
    courseId?: string;
    studentIds?: unknown;
  };
  if (!name?.trim() || !courseId?.trim()) return res.status(400).json({ error: "name and courseId are required" });

  // Ensure instructor is assigned to the course (or admin).
  (req.params as any).id = courseId.trim();
  await new Promise<void>((resolve) =>
    requireInstructorAssignedToCourse(req, res, (err?: unknown) => {
      if (err) throw err;
      resolve();
    }),
  );
  if (res.headersSent) return;

  const students = Array.isArray(studentIds) ? (studentIds.filter((x) => typeof x === "string") as string[]) : [];
  const id = uid("p");
  const db = getFirestore();
  const courseSnap = await db.collection("courses").doc(courseId.trim()).get();
  if (!courseSnap.exists) return res.status(404).json({ error: "Course not found" });
  const courseRoster = (courseSnap.get("studentIds") as string[] | undefined) ?? [];
  const notInCourse = students.filter((sid) => !courseRoster.includes(sid));
  if (notInCourse.length) {
    return res.status(400).json({ error: "Add student(s) to the course first before assigning to a project." });
  }

  await db.collection("projects").doc(id).set({
    id,
    name: name.trim(),
    description: (description ?? "").toString(),
    courseId: courseId.trim(),
    studentIds: students,
    progress: 0,
  });
  return res.json({ ok: true, id });
});

app.patch(
  "/instructor/courses/:id/students",
  requireFirebaseAuth,
  requireInstructorOrAdmin,
  requireInstructorAssignedToCourse,
  async (req, res) => {
    const courseId = req.params.id;
    const { studentId, op } = (req.body ?? {}) as { studentId?: string; op?: "add" | "remove" };
    if (!courseId?.trim() || !studentId?.trim() || (op !== "add" && op !== "remove")) {
      return res.status(400).json({ error: "courseId, studentId, and op(add|remove) are required" });
    }

    const db = getFirestore();
    const ref = db.collection("courses").doc(courseId.trim());
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: "Course not found" });
    const studentIds = (snap.get("studentIds") as string[] | undefined) ?? [];
    const next =
      op === "add"
        ? Array.from(new Set([...studentIds, studentId.trim()]))
        : studentIds.filter((i) => i !== studentId.trim());
    await ref.update({ studentIds: next });
    return res.json({ ok: true });
  },
);

app.patch("/instructor/projects/:id/students", requireFirebaseAuth, requireInstructorOrAdmin, async (req, res) => {
  const projectId = req.params.id;
  const { studentId, op } = (req.body ?? {}) as { studentId?: string; op?: "add" | "remove" };
  if (!projectId?.trim() || !studentId?.trim() || (op !== "add" && op !== "remove")) {
    return res.status(400).json({ error: "projectId, studentId, and op(add|remove) are required" });
  }

  const db = getFirestore();
  const ref = db.collection("projects").doc(projectId.trim());
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ error: "Project not found" });

  const courseId = (snap.get("courseId") as string | undefined) ?? "";
  if (!courseId.trim()) return res.status(400).json({ error: "Project missing courseId" });

  // Ensure instructor is assigned to the course (or admin).
  (req.params as any).id = courseId.trim();
  await new Promise<void>((resolve) =>
    requireInstructorAssignedToCourse(req, res, (err?: unknown) => {
      if (err) throw err;
      resolve();
    }),
  );
  if (res.headersSent) return;

  const studentIds = (snap.get("studentIds") as string[] | undefined) ?? [];
  // Enforce clean flow: students must be added to course roster first.
  if (op === "add") {
    const courseSnap = await db.collection("courses").doc(courseId.trim()).get();
    if (!courseSnap.exists) return res.status(404).json({ error: "Course not found" });
    const courseRoster = (courseSnap.get("studentIds") as string[] | undefined) ?? [];
    if (!courseRoster.includes(studentId.trim())) {
      return res.status(400).json({ error: "Add student to the course first." });
    }
  }
  const next =
    op === "add"
      ? Array.from(new Set([...studentIds, studentId.trim()]))
      : studentIds.filter((i) => i !== studentId.trim());
  await ref.update({ studentIds: next });
  return res.json({ ok: true });
});

// UPDATES + PURCHASE REQUESTS
// All writes happen via backend (Admin SDK); Firestore client rules can be read-only.

app.post("/updates", requireFirebaseAuth, async (req, res) => {
  const u = await getCurrentUser(req);
  if (!u?.id) return res.status(403).json({ error: "Missing user profile" });

  const body = (req.body ?? {}) as any;
  const projectId = (body.projectId ?? "").toString().trim();
  const weekNumber = Number(body.weekNumber);
  const weekStart = (body.weekStart ?? "").toString();
  const progress = Number(body.progress);
  const blockers = (body.blockers ?? "").toString();
  const thisWeekGoals = Array.isArray(body.thisWeekGoals) ? body.thisWeekGoals : [];
  const nextWeekGoals = Array.isArray(body.nextWeekGoals) ? body.nextWeekGoals : [];
  const links = Array.isArray(body.links) ? body.links : [];

  if (!projectId) return res.status(400).json({ error: "projectId is required" });
  if (!Number.isFinite(weekNumber) || weekNumber <= 0) return res.status(400).json({ error: "weekNumber is required" });
  if (!weekStart) return res.status(400).json({ error: "weekStart is required" });

  const db = getFirestore();
  const projSnap = await db.collection("projects").doc(projectId).get();
  if (!projSnap.exists) return res.status(404).json({ error: "Project not found" });

  const studentIds = (projSnap.get("studentIds") as string[] | undefined) ?? [];
  if (!studentIds.includes(u.id)) return res.status(403).json({ error: "Only project students can submit updates" });

  const id = uid("w");
  const now = new Date().toISOString();
  const payload = {
    id,
    projectId,
    weekNumber,
    weekStart,
    authorId: u.id,
    revision: 1,
    audit: [
      {
        id: uid("evt"),
        type: "submitted",
        at: now,
        byUserId: u.id,
        fields: ["thisWeekGoals", "nextWeekGoals", "blockers", "progress", "links"],
      },
    ],
    thisWeekGoals,
    nextWeekGoals,
    blockers,
    progress: Number.isFinite(progress) ? progress : 0,
    links,
    status: "pending",
    comments: [],
    submittedAt: now,
  };

  await db.collection("updates").doc(id).set(payload);
  // Best-effort project progress update (kept consistent with existing UI expectations).
  await db.collection("projects").doc(projectId).update({ progress: payload.progress }).catch(() => {});
  return res.json({ ok: true, id });
});

app.patch("/updates/:id/resubmit", requireFirebaseAuth, async (req, res) => {
  const u = await getCurrentUser(req);
  if (!u?.id) return res.status(403).json({ error: "Missing user profile" });

  const updateId = req.params.id;
  const patch = (req.body ?? {}) as any;

  const db = getFirestore();
  const ref = db.collection("updates").doc(updateId);
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ error: "Update not found" });

  const projectId = (snap.get("projectId") as string | undefined) ?? "";
  const status = (snap.get("status") as string | undefined) ?? "pending";
  if (status !== "needs_revision") return res.status(400).json({ error: "Only updates needing revision can be resubmitted" });

  const projSnap = await db.collection("projects").doc(projectId).get();
  const studentIds = (projSnap.get("studentIds") as string[] | undefined) ?? [];
  if (!studentIds.includes(u.id)) return res.status(403).json({ error: "Only project students can resubmit updates" });

  const fields: string[] = [];
  if (patch.thisWeekGoals) fields.push("thisWeekGoals");
  if (patch.nextWeekGoals) fields.push("nextWeekGoals");
  if (patch.blockers !== undefined) fields.push("blockers");
  if (patch.progress !== undefined) fields.push("progress");
  if (patch.links) fields.push("links");

  const now = new Date().toISOString();
  const nextRevision = ((snap.get("revision") as number | undefined) ?? 1) + 1;

  await ref.update({
    ...(patch.thisWeekGoals ? { thisWeekGoals: patch.thisWeekGoals } : {}),
    ...(patch.nextWeekGoals ? { nextWeekGoals: patch.nextWeekGoals } : {}),
    ...(patch.links ? { links: patch.links } : {}),
    ...(patch.blockers !== undefined ? { blockers: (patch.blockers ?? "").toString() } : {}),
    ...(patch.progress !== undefined ? { progress: Number.isFinite(Number(patch.progress)) ? Number(patch.progress) : 0 } : {}),
    status: "pending",
    submittedAt: now,
    revision: nextRevision,
    lastEditedAt: now,
    lastEditedBy: u.id,
    audit: [
      ...(((snap.get("audit") as any[]) ?? []) as any[]),
      { id: uid("evt"), type: "resubmitted", at: now, byUserId: u.id, fields },
    ],
  });

  if (patch.progress !== undefined) {
    await db.collection("projects").doc(projectId).update({ progress: Number(patch.progress) }).catch(() => {});
  }

  return res.json({ ok: true });
});

app.patch("/updates/:id/status", requireFirebaseAuth, requireInstructorOrAdmin, async (req, res) => {
  const u = (req as any).appUser as { id?: string; role?: string } | undefined;
  if (!u?.id) return res.status(403).json({ error: "Missing user profile" });

  const updateId = req.params.id;
  const { status } = (req.body ?? {}) as { status?: "pending" | "needs_revision" | "approved" };
  if (status !== "pending" && status !== "needs_revision" && status !== "approved") {
    return res.status(400).json({ error: "Invalid status" });
  }

  const db = getFirestore();
  const ref = db.collection("updates").doc(updateId);
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ error: "Update not found" });

  const projectId = (snap.get("projectId") as string | undefined) ?? "";
  const prev = (snap.get("status") as string | undefined) ?? "pending";
  if (prev === "approved") return res.status(400).json({ error: "Approved updates are locked" });

  const projSnap = await db.collection("projects").doc(projectId).get();
  if (!projSnap.exists) return res.status(404).json({ error: "Project not found" });
  const courseId = (projSnap.get("courseId") as string | undefined) ?? "";

  // Instructors can only review updates for courses they are assigned to.
  (req.params as any).id = courseId;
  await new Promise<void>((resolve) =>
    requireInstructorAssignedToCourse(req, res, (err?: unknown) => {
      if (err) throw err;
      resolve();
    }),
  );
  if (res.headersSent) return;

  const now = new Date().toISOString();
  await ref.update({
    status,
    lastEditedAt: now,
    lastEditedBy: u.id,
    audit: [
      ...(((snap.get("audit") as any[]) ?? []) as any[]),
      { id: uid("evt"), type: "status_changed", at: now, byUserId: u.id, statusFrom: prev, statusTo: status },
    ],
  });

  return res.json({ ok: true });
});

app.post("/updates/:id/comments", requireFirebaseAuth, async (req, res) => {
  const u = await getCurrentUser(req);
  if (!u?.id) return res.status(403).json({ error: "Missing user profile" });

  const updateId = req.params.id;
  const { text } = (req.body ?? {}) as { text?: string };
  if (!text?.trim()) return res.status(400).json({ error: "text is required" });

  const db = getFirestore();
  const ref = db.collection("updates").doc(updateId);
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ error: "Update not found" });

  const projectId = (snap.get("projectId") as string | undefined) ?? "";
  const projSnap = await db.collection("projects").doc(projectId).get();
  if (!projSnap.exists) return res.status(404).json({ error: "Project not found" });

  const studentIds = (projSnap.get("studentIds") as string[] | undefined) ?? [];
  const courseId = (projSnap.get("courseId") as string | undefined) ?? "";
  const instructorIds = ((await db.collection("courses").doc(courseId).get()).get("instructorIds") as string[] | undefined) ?? [];

  const canComment = studentIds.includes(u.id) || instructorIds.includes(u.id) || u.role === "admin";
  if (!canComment) return res.status(403).json({ error: "Not allowed to comment on this update" });

  const commentId = uid("c");
  const now = new Date().toISOString();
  const comments = ((snap.get("comments") as any[]) ?? []) as any[];
  const nextComments = [...comments, { id: commentId, authorId: u.id, text: text.trim(), createdAt: now }];

  await ref.update({
    comments: nextComments,
    audit: [
      ...(((snap.get("audit") as any[]) ?? []) as any[]),
      { id: uid("evt"), type: "comment_added", at: now, byUserId: u.id, commentId },
    ],
  });

  return res.json({ ok: true, id: commentId });
});

app.post("/purchaseRequests", requireFirebaseAuth, async (req, res) => {
  const u = await getCurrentUser(req);
  if (!u?.id) return res.status(403).json({ error: "Missing user profile" });

  const body = (req.body ?? {}) as any;
  const projectId = (body.projectId ?? "").toString().trim();
  const item = (body.item ?? "").toString().trim();
  const justification = (body.justification ?? "").toString().trim();

  if (!projectId) return res.status(400).json({ error: "projectId is required" });
  if (!item) return res.status(400).json({ error: "item is required" });
  if (!justification) return res.status(400).json({ error: "justification is required" });

  const db = getFirestore();
  const projSnap = await db.collection("projects").doc(projectId).get();
  if (!projSnap.exists) return res.status(404).json({ error: "Project not found" });
  const studentIds = (projSnap.get("studentIds") as string[] | undefined) ?? [];
  if (!studentIds.includes(u.id)) return res.status(403).json({ error: "Only project students can request purchases" });

  const id = uid("pr");
  const now = new Date().toISOString();
  await db.collection("purchaseRequests").doc(id).set({
    id,
    projectId,
    requesterId: u.id,
    item,
    quantity: Number.isFinite(Number(body.quantity)) ? Number(body.quantity) : 1,
    cost: Number.isFinite(Number(body.cost)) ? Number(body.cost) : 0,
    currency: "HKD",
    link: (body.link ?? "").toString(),
    justification,
    status: "pending",
    createdAt: now,
  });

  return res.json({ ok: true, id });
});

app.patch("/purchaseRequests/:id/review", requireFirebaseAuth, requireInstructorOrAdmin, async (req, res) => {
  const reviewer = (req as any).appUser as { id?: string; role?: string } | undefined;
  if (!reviewer?.id) return res.status(403).json({ error: "Missing user profile" });

  const id = req.params.id;
  const { status, reviewNote } = (req.body ?? {}) as { status?: "approved" | "rejected"; reviewNote?: string };
  if (status !== "approved" && status !== "rejected") return res.status(400).json({ error: "Invalid status" });

  const db = getFirestore();
  const ref = db.collection("purchaseRequests").doc(id);
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ error: "Purchase request not found" });
  const existingStatus = (snap.get("status") as string | undefined) ?? "pending";
  if (existingStatus !== "pending") return res.status(400).json({ error: "Locked after decision" });

  const projectId = (snap.get("projectId") as string | undefined) ?? "";
  const projSnap = await db.collection("projects").doc(projectId).get();
  if (!projSnap.exists) return res.status(404).json({ error: "Project not found" });
  const courseId = (projSnap.get("courseId") as string | undefined) ?? "";

  (req.params as any).id = courseId;
  await new Promise<void>((resolve) =>
    requireInstructorAssignedToCourse(req, res, (err?: unknown) => {
      if (err) throw err;
      resolve();
    }),
  );
  if (res.headersSent) return;

  const now = new Date().toISOString();
  await ref.update({
    status,
    reviewerId: reviewer.id,
    reviewedAt: now,
    reviewNote: reviewNote?.trim() ? reviewNote.trim() : null,
  });
  return res.json({ ok: true });
});

// Serve built frontend from the same Cloud Run service (optional but recommended).
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// When compiled, this file lives at backend/dist/index.js. The frontend build is copied to backend/public/.
const staticDir = path.resolve(__dirname, "../public");
app.use(express.static(staticDir));
app.get("*", (_req, res) => {
  res.sendFile(path.join(staticDir, "index.html"));
});

const port = Number(process.env.PORT ?? 8080);
app.listen(port, "0.0.0.0", () => {
  // eslint-disable-next-line no-console
  console.log(`Backend listening on http://0.0.0.0:${port}`);
});

