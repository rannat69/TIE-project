import { create } from "zustand";
import { firebaseAuth, firestore } from "@/lib/firebase";
import {
  collection,
  deleteDoc,
  doc,
  getCountFromServer,
  onSnapshot,
  arrayUnion,
  setDoc,
  updateDoc,
  type Unsubscribe,
} from "firebase/firestore";
import { onAuthStateChanged, signOut as fbSignOut } from "firebase/auth";
import {
  ApprovalStatus,
  Comment,
  Course,
  Project,
  PurchaseRequest,
  PurchaseRequestStatus,
  ResourceLink,
  Role,
  User,
  WeeklyGoal,
  WeeklyUpdateEvent,
  WeeklyUpdate,
} from "./types";
import { seedCourses, seedProjects, seedUpdates, seedUsers } from "./seed";

const uid = (p = "id") => `${p}-${Math.random().toString(36).slice(2, 9)}`;

interface AppState {
  initialized: boolean;
  authReady: boolean;
  usersReady: boolean;
  currentUserId: string | null;

  users: User[];
  courses: Course[];
  projects: Project[];
  updates: WeeklyUpdate[];
  purchaseRequests: PurchaseRequest[];

  init: () => void;
  signOut: () => Promise<void>;

  // admin
  addUser: (u: Omit<User, "id" | "avatarColor">) => Promise<void>;
  updateUserRole: (id: string, role: Role) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
  addCourse: (c: Omit<Course, "id">) => Promise<void>;
  assignInstructor: (courseId: string, instructorId: string) => Promise<void>;
  removeInstructor: (courseId: string, instructorId: string) => Promise<void>;
  addStudentToCourse: (courseId: string, studentId: string) => Promise<void>;
  removeStudentFromCourse: (courseId: string, studentId: string) => Promise<void>;
  addProject: (p: Omit<Project, "id" | "progress">) => Promise<void>;
  assignStudentToProject: (projectId: string, studentId: string) => Promise<void>;
  removeStudentFromProject: (projectId: string, studentId: string) => Promise<void>;

  // updates
  submitUpdate: (u: Omit<WeeklyUpdate, "id" | "submittedAt" | "status" | "comments">) => void;
  resubmitUpdate: (updateId: string, patch: Partial<Pick<WeeklyUpdate, "thisWeekGoals" | "nextWeekGoals" | "blockers" | "progress" | "links">>) => void;
  editUpdateGoals: (
    updateId: string,
    thisWeekGoals: WeeklyGoal[],
    nextWeekGoals: WeeklyGoal[],
  ) => void;
  setApproval: (updateId: string, status: ApprovalStatus) => void;
  addComment: (updateId: string, authorId: string, text: string) => void;
  setProjectProgress: (projectId: string, progress: number) => void;

  // purchasing (separate from weekly updates)
  submitPurchaseRequest: (p: Omit<PurchaseRequest, "id" | "createdAt" | "status">) => void;
  reviewPurchaseRequest: (id: string, status: PurchaseRequestStatus, reviewNote?: string) => void;
}

const palette = [
  "217 60% 22%",
  "188 70% 38%",
  "262 55% 45%",
  "152 55% 36%",
  "35 90% 48%",
  "0 70% 48%",
];

const backendUrlRaw = (import.meta.env.VITE_BACKEND_URL as string | undefined)?.trim() || "";
const backendUrl =
  backendUrlRaw === "." || backendUrlRaw === "/" ? window.location.origin : backendUrlRaw;

export const useApp = create<AppState>()((set, get) => {
  let unsubAuth: Unsubscribe | null = null;
  let unsubs: Unsubscribe[] = [];

  const currentRole = () => {
    const id = get().currentUserId;
    const u = id ? get().users.find((x) => x.id === id) : undefined;
    return u?.role ?? null;
  };

  const authHeader = async () => {
    const fbUser = firebaseAuth.currentUser;
    if (!fbUser) throw new Error("Not signed in.");
    const token = await fbUser.getIdToken();
    return { authorization: `Bearer ${token}` };
  };

  const ensureSeeded = async () => {
    const usersCol = collection(firestore, "users");
    const cnt = await getCountFromServer(usersCol);
    if (cnt.data().count > 0) return;

    await Promise.all(seedUsers.map((u) => setDoc(doc(firestore, "users", u.id), u, { merge: true })));
    await Promise.all(seedCourses.map((c) => setDoc(doc(firestore, "courses", c.id), c, { merge: true })));
    await Promise.all(seedProjects.map((p) => setDoc(doc(firestore, "projects", p.id), p, { merge: true })));
    await Promise.all(seedUpdates.map((w) => setDoc(doc(firestore, "updates", w.id), w, { merge: true })));
  };

  const startListeners = () => {
    unsubs.forEach((u) => u());
    unsubs = [];

    unsubs.push(
      onSnapshot(collection(firestore, "users"), (snap) => {
        const users = snap.docs.map((d) => d.data() as User);
        set({ users, usersReady: true });
        const email = firebaseAuth.currentUser?.email;
        if (email) {
          const u = users.find((x) => x.email.toLowerCase() === email.toLowerCase());
          if (u?.id !== get().currentUserId) set({ currentUserId: u?.id ?? null });
        }
      }),
    );
    unsubs.push(
      onSnapshot(collection(firestore, "courses"), (snap) => {
        set({ courses: snap.docs.map((d) => d.data() as Course) });
      }),
    );
    unsubs.push(
      onSnapshot(collection(firestore, "projects"), (snap) => {
        set({ projects: snap.docs.map((d) => d.data() as Project) });
      }),
    );
    unsubs.push(
      onSnapshot(collection(firestore, "updates"), (snap) => {
        set({ updates: snap.docs.map((d) => d.data() as WeeklyUpdate) });
      }),
    );
    unsubs.push(
      onSnapshot(collection(firestore, "purchaseRequests"), (snap) => {
        set({ purchaseRequests: snap.docs.map((d) => d.data() as PurchaseRequest) });
      }),
    );
  };

  const logUpdateEvent = (updateId: string, e: WeeklyUpdateEvent) => {
    void updateDoc(doc(firestore, "updates", updateId), {
      audit: arrayUnion(e),
      lastEditedAt: e.at,
      lastEditedBy: e.byUserId,
    });
  };

  return {
    initialized: false,
    authReady: false,
    usersReady: false,
    currentUserId: null,

    users: [],
    courses: [],
    projects: [],
    updates: [],
    purchaseRequests: [],

    init: () => {
      if (get().initialized) return;
      set({ initialized: true });

      unsubAuth?.();
      unsubAuth = onAuthStateChanged(firebaseAuth, (fbUser) => {
        set({ authReady: true });
        if (!fbUser?.email) {
          unsubs.forEach((u) => u());
          unsubs = [];
          set({ currentUserId: null, usersReady: false });
          return;
        }

        void ensureSeeded()
          .catch(() => {
            // If rules disallow seeding from the client, continue without it.
          })
          .finally(() => {
            startListeners();
          });

        const u = get().users.find((x) => x.email.toLowerCase() === fbUser.email!.toLowerCase());
        set({ currentUserId: u?.id ?? null });
      });
    },

    signOut: async () => {
      await fbSignOut(firebaseAuth);
      set({ currentUserId: null });
    },

    // admin
    addUser: async (u) => {
      const fbUser = firebaseAuth.currentUser;
      if (backendUrl && fbUser) {
        const token = await fbUser.getIdToken();
        const endpoint = `${backendUrl.replace(/\/$/, "")}/admin/users`;
        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(u),
        });
        if (!res.ok) {
          let detail = "";
          try {
            const data = (await res.json()) as { error?: string };
            detail = data?.error ? `: ${data.error}` : "";
          } catch {
            // ignore
          }
          throw new Error(`Backend user create failed (${res.status})${detail}`);
        }
        return;
      }

      // Fallback for local dev / permissive rules.
      if (!backendUrl) {
        throw new Error(
          "VITE_BACKEND_URL is not set, so the app tried a direct Firestore write (usually blocked by rules). Set VITE_BACKEND_URL and redeploy.",
        );
      }
      if (!fbUser) {
        throw new Error("Not signed in (missing Firebase Auth user).");
      }
      const id = uid("u");
      const avatarColor = palette[get().users.length % palette.length];
      await setDoc(doc(firestore, "users", id), { ...u, id, avatarColor } satisfies User);
    },
    updateUserRole: async (id, role) => {
      const fbUser = firebaseAuth.currentUser;
      if (backendUrl && fbUser) {
        const token = await fbUser.getIdToken();
        const endpoint = `${backendUrl.replace(/\/$/, "")}/admin/users/${id}/role`;
        const res = await fetch(endpoint, {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ role }),
        });
        if (!res.ok) {
          let detail = "";
          try {
            const data = (await res.json()) as { error?: string };
            detail = data?.error ? `: ${data.error}` : "";
          } catch {
            // ignore
          }
          throw new Error(`Backend user role update failed (${res.status})${detail}`);
        }
        return;
      }

      await updateDoc(doc(firestore, "users", id), { role });
    },
    deleteUser: async (id) => {
      const fbUser = firebaseAuth.currentUser;
      if (backendUrl && fbUser) {
        const token = await fbUser.getIdToken();
        const endpoint = `${backendUrl.replace(/\/$/, "")}/admin/users/${id}`;
        const res = await fetch(endpoint, {
          method: "DELETE",
          headers: {
            authorization: `Bearer ${token}`,
          },
        });
        if (!res.ok) {
          let detail = "";
          try {
            const data = (await res.json()) as { error?: string };
            detail = data?.error ? `: ${data.error}` : "";
          } catch {
            // ignore
          }
          throw new Error(`Backend user delete failed (${res.status})${detail}`);
        }
        return;
      }

      await deleteDoc(doc(firestore, "users", id));
    },

    addCourse: async (c) => {
      const fbUser = firebaseAuth.currentUser;
      if (backendUrl && fbUser) {
        const token = await fbUser.getIdToken();
        const endpoint = `${backendUrl.replace(/\/$/, "")}/admin/courses`;
        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(c),
        });
        if (!res.ok) {
          let detail = "";
          try {
            const data = (await res.json()) as { error?: string };
            detail = data?.error ? `: ${data.error}` : "";
          } catch {
            // ignore
          }
          throw new Error(`Backend course create failed (${res.status})${detail}`);
        }
        return;
      }

      const id = uid("c");
      await setDoc(doc(firestore, "courses", id), { ...c, id } satisfies Course);
    },
    assignInstructor: async (courseId, instructorId) => {
      const course = get().courses.find((c) => c.id === courseId);
      if (!course || course.instructorIds.includes(instructorId)) return;
      const fbUser = firebaseAuth.currentUser;
      if (backendUrl && fbUser) {
        const token = await fbUser.getIdToken();
        const endpoint = `${backendUrl.replace(/\/$/, "")}/admin/courses/${encodeURIComponent(courseId)}/instructors`;
        const res = await fetch(endpoint, {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ instructorId, op: "add" }),
        });
        if (!res.ok) throw new Error(`Backend assign instructor failed (${res.status})`);
        return;
      }

      await updateDoc(doc(firestore, "courses", courseId), {
        instructorIds: [...course.instructorIds, instructorId],
      });
    },
    removeInstructor: async (courseId, instructorId) => {
      const course = get().courses.find((c) => c.id === courseId);
      if (!course) return;
      const fbUser = firebaseAuth.currentUser;
      if (backendUrl && fbUser) {
        const token = await fbUser.getIdToken();
        const endpoint = `${backendUrl.replace(/\/$/, "")}/admin/courses/${encodeURIComponent(courseId)}/instructors`;
        const res = await fetch(endpoint, {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ instructorId, op: "remove" }),
        });
        if (!res.ok) throw new Error(`Backend remove instructor failed (${res.status})`);
        return;
      }

      await updateDoc(doc(firestore, "courses", courseId), {
        instructorIds: course.instructorIds.filter((i) => i !== instructorId),
      });
    },

    addStudentToCourse: async (courseId, studentId) => {
      const course = get().courses.find((c) => c.id === courseId);
      const existing = (course?.studentIds ?? []) as string[];
      if (!course || existing.includes(studentId)) return;

      const fbUser = firebaseAuth.currentUser;
      if (backendUrl && fbUser) {
        const token = await fbUser.getIdToken();
        const endpoint = `${backendUrl.replace(/\/$/, "")}/instructor/courses/${encodeURIComponent(courseId)}/students`;
        const res = await fetch(endpoint, {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ studentId, op: "add" }),
        });
        if (!res.ok) throw new Error(`Backend add student to course failed (${res.status})`);
        return;
      }

      await updateDoc(doc(firestore, "courses", courseId), {
        studentIds: Array.from(new Set([...(existing ?? []), studentId])),
      });
    },

    removeStudentFromCourse: async (courseId, studentId) => {
      const course = get().courses.find((c) => c.id === courseId);
      const existing = (course?.studentIds ?? []) as string[];
      if (!course) return;

      const fbUser = firebaseAuth.currentUser;
      if (backendUrl && fbUser) {
        const token = await fbUser.getIdToken();
        const endpoint = `${backendUrl.replace(/\/$/, "")}/instructor/courses/${encodeURIComponent(courseId)}/students`;
        const res = await fetch(endpoint, {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ studentId, op: "remove" }),
        });
        if (!res.ok) throw new Error(`Backend remove student from course failed (${res.status})`);
        return;
      }

      await updateDoc(doc(firestore, "courses", courseId), {
        studentIds: (existing ?? []).filter((i) => i !== studentId),
      });
    },

    addProject: async (p) => {
      const fbUser = firebaseAuth.currentUser;
      if (backendUrl && fbUser) {
        const token = await fbUser.getIdToken();
        const role = currentRole();
        const endpoint =
          role === "admin"
            ? `${backendUrl.replace(/\/$/, "")}/admin/projects`
            : `${backendUrl.replace(/\/$/, "")}/instructor/projects`;
        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(p),
        });
        if (!res.ok) throw new Error(`Backend project create failed (${res.status})`);
        return;
      }

      const id = uid("p");
      await setDoc(doc(firestore, "projects", id), { ...p, id, progress: 0 } satisfies Project);
    },
    assignStudentToProject: async (projectId, studentId) => {
      const project = get().projects.find((p) => p.id === projectId);
      if (!project || project.studentIds.includes(studentId)) return;
      const fbUser = firebaseAuth.currentUser;
      if (backendUrl && fbUser) {
        const token = await fbUser.getIdToken();
        const role = currentRole();
        const endpoint =
          role === "admin"
            ? `${backendUrl.replace(/\/$/, "")}/admin/projects/${encodeURIComponent(projectId)}/students`
            : `${backendUrl.replace(/\/$/, "")}/instructor/projects/${encodeURIComponent(projectId)}/students`;
        const res = await fetch(endpoint, {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ studentId, op: "add" }),
        });
        if (!res.ok) throw new Error(`Backend assign student failed (${res.status})`);
        return;
      }

      await updateDoc(doc(firestore, "projects", projectId), {
        studentIds: [...project.studentIds, studentId],
      });
    },
    removeStudentFromProject: async (projectId, studentId) => {
      const project = get().projects.find((p) => p.id === projectId);
      if (!project) return;
      const fbUser = firebaseAuth.currentUser;
      if (backendUrl && fbUser) {
        const token = await fbUser.getIdToken();
        const role = currentRole();
        const endpoint =
          role === "admin"
            ? `${backendUrl.replace(/\/$/, "")}/admin/projects/${encodeURIComponent(projectId)}/students`
            : `${backendUrl.replace(/\/$/, "")}/instructor/projects/${encodeURIComponent(projectId)}/students`;
        const res = await fetch(endpoint, {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ studentId, op: "remove" }),
        });
        if (!res.ok) throw new Error(`Backend remove student failed (${res.status})`);
        return;
      }

      await updateDoc(doc(firestore, "projects", projectId), {
        studentIds: project.studentIds.filter((i) => i !== studentId),
      });
    },

    // updates
    submitUpdate: (u) => {
      // In production, writes should go through backend.
      if (backendUrl) {
        void (async () => {
          const endpoint = `${backendUrl.replace(/\/$/, "")}/updates`;
          const res = await fetch(endpoint, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              ...(await authHeader()),
            },
            body: JSON.stringify(u),
          });
          if (!res.ok) throw new Error(`Submit update failed (${res.status})`);
        })().catch(() => {
          // UI already shows optimistic toast; realtime listener will reconcile state.
        });
        return;
      }

      const id = uid("w");
      const thisWeekGoals = (u.thisWeekGoals ?? []).map((g) => ({
        id: g.id,
        text: g.text,
        achieved: g.achieved,
        ...(g.reason?.trim() ? { reason: g.reason } : {}),
      }));
      const nextWeekGoals = (u.nextWeekGoals ?? []).map((g) => ({
        id: g.id,
        text: g.text,
        achieved: g.achieved ?? null,
        ...(g.reason?.trim() ? { reason: g.reason } : {}),
      }));
      const links = (u.links ?? []).map((l) => ({ id: l.id, label: l.label, url: l.url }));

      const payload: WeeklyUpdate = {
        ...u,
        id,
        revision: 1,
        audit: [
          {
            id: uid("evt"),
            type: "submitted",
            at: new Date().toISOString(),
            byUserId: u.authorId,
            fields: ["thisWeekGoals", "nextWeekGoals", "blockers", "progress", "links"],
          },
        ],
        blockers: (u.blockers ?? "").toString(),
        progress: Number.isFinite(u.progress) ? u.progress : 0,
        thisWeekGoals,
        nextWeekGoals,
        links,
        submittedAt: new Date().toISOString(),
        status: "pending",
        comments: [],
      };
      void setDoc(doc(firestore, "updates", id), payload);
      // Projects are write-protected in production (admin SDK only). Progress is derived from updates.
      void updateDoc(doc(firestore, "projects", u.projectId), { progress: u.progress }).catch(() => {
        // ignore
      });
    },
    resubmitUpdate: (updateId, patch) => {
      if (backendUrl) {
        void (async () => {
          const endpoint = `${backendUrl.replace(/\/$/, "")}/updates/${encodeURIComponent(updateId)}/resubmit`;
          const res = await fetch(endpoint, {
            method: "PATCH",
            headers: {
              "content-type": "application/json",
              ...(await authHeader()),
            },
            body: JSON.stringify(patch),
          });
          if (!res.ok) throw new Error(`Resubmit update failed (${res.status})`);
        })().catch(() => {});
        return;
      }

      const editorId = get().currentUserId ?? "unknown";
      const at = new Date().toISOString();
      const fields: WeeklyUpdateEvent["fields"] = [];
      if (patch.thisWeekGoals) fields.push("thisWeekGoals");
      if (patch.nextWeekGoals) fields.push("nextWeekGoals");
      if (patch.blockers !== undefined) fields.push("blockers");
      if (patch.progress !== undefined) fields.push("progress");
      if (patch.links) fields.push("links");

      const thisWeekGoals = (patch.thisWeekGoals ?? []).map((g) => ({
        id: g.id,
        text: g.text,
        achieved: g.achieved,
        ...(g.reason?.trim() ? { reason: g.reason } : {}),
      }));
      const nextWeekGoals = (patch.nextWeekGoals ?? []).map((g) => ({
        id: g.id,
        text: g.text,
        achieved: g.achieved ?? null,
        ...(g.reason?.trim() ? { reason: g.reason } : {}),
      }));
      const links = (patch.links ?? []).map((l) => ({ id: l.id, label: l.label, url: l.url }));

      void updateDoc(doc(firestore, "updates", updateId), {
        ...(patch.thisWeekGoals ? { thisWeekGoals } : {}),
        ...(patch.nextWeekGoals ? { nextWeekGoals } : {}),
        ...(patch.links ? { links } : {}),
        ...(patch.blockers !== undefined ? { blockers: (patch.blockers ?? "").toString() } : {}),
        ...(patch.progress !== undefined ? { progress: Number.isFinite(patch.progress) ? patch.progress : 0 } : {}),
        status: "pending",
        submittedAt: at,
        revision: (get().updates.find((u) => u.id === updateId)?.revision ?? 1) + 1,
      });

      logUpdateEvent(updateId, {
        id: uid("evt"),
        type: "resubmitted",
        at,
        byUserId: editorId,
        fields,
      });
    },
    editUpdateGoals: (updateId, thisWeekGoals, nextWeekGoals) => {
      if (backendUrl) {
        // Reviewers should edit via UI + status/comment flows; keep direct goal edits local-dev only.
        void (async () => {
          const endpoint = `${backendUrl.replace(/\/$/, "")}/updates/${encodeURIComponent(updateId)}/resubmit`;
          const res = await fetch(endpoint, {
            method: "PATCH",
            headers: {
              "content-type": "application/json",
              ...(await authHeader()),
            },
            body: JSON.stringify({ thisWeekGoals, nextWeekGoals }),
          });
          if (!res.ok) throw new Error(`Edit update failed (${res.status})`);
        })().catch(() => {});
        return;
      }

      const editorId = get().currentUserId ?? "unknown";
      const at = new Date().toISOString();
      void updateDoc(doc(firestore, "updates", updateId), { thisWeekGoals, nextWeekGoals });
      logUpdateEvent(updateId, {
        id: uid("evt"),
        type: "edited",
        at,
        byUserId: editorId,
        fields: ["thisWeekGoals", "nextWeekGoals"],
        note: "Edited by reviewer",
      });
    },
    setApproval: (updateId, status) => {
      const editorId = get().currentUserId ?? "unknown";
      const prev = get().updates.find((u) => u.id === updateId)?.status;

      if (backendUrl) {
        void (async () => {
          const endpoint = `${backendUrl.replace(/\/$/, "")}/updates/${encodeURIComponent(updateId)}/status`;
          const res = await fetch(endpoint, {
            method: "PATCH",
            headers: {
              "content-type": "application/json",
              ...(await authHeader()),
            },
            body: JSON.stringify({ status }),
          });
          if (!res.ok) throw new Error(`Set status failed (${res.status})`);
        })().catch(() => {});
        return;
      }

      const at = new Date().toISOString();
      void updateDoc(doc(firestore, "updates", updateId), { status });
      logUpdateEvent(updateId, {
        id: uid("evt"),
        type: "status_changed",
        at,
        byUserId: editorId,
        statusFrom: prev,
        statusTo: status,
      });
    },
    addComment: (updateId, authorId, text) => {
      const update = get().updates.find((u) => u.id === updateId);
      if (!update) return;

      if (backendUrl) {
        void (async () => {
          const endpoint = `${backendUrl.replace(/\/$/, "")}/updates/${encodeURIComponent(updateId)}/comments`;
          const res = await fetch(endpoint, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              ...(await authHeader()),
            },
            body: JSON.stringify({ text }),
          });
          if (!res.ok) throw new Error(`Add comment failed (${res.status})`);
        })().catch(() => {});
        return;
      }

      const commentId = uid("c");
      const comments: Comment[] = [
        ...update.comments,
        { id: commentId, authorId, text, createdAt: new Date().toISOString() },
      ];
      void updateDoc(doc(firestore, "updates", updateId), { comments });
      logUpdateEvent(updateId, {
        id: uid("evt"),
        type: "comment_added",
        at: new Date().toISOString(),
        byUserId: authorId,
        commentId,
      });
    },
    setProjectProgress: (projectId, progress) => {
      void updateDoc(doc(firestore, "projects", projectId), { progress });
    },

    submitPurchaseRequest: (p) => {
      if (backendUrl) {
        void (async () => {
          const endpoint = `${backendUrl.replace(/\/$/, "")}/purchaseRequests`;
          const res = await fetch(endpoint, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              ...(await authHeader()),
            },
            body: JSON.stringify(p),
          });
          if (!res.ok) throw new Error(`Submit purchase request failed (${res.status})`);
        })().catch(() => {});
        return;
      }

      const id = uid("pr");
      const payload: PurchaseRequest = {
        id,
        projectId: p.projectId,
        requesterId: p.requesterId,
        item: (p.item ?? "").toString(),
        quantity: Number.isFinite(p.quantity) ? p.quantity : 1,
        cost: Number.isFinite(p.cost) ? p.cost : 0,
        currency: "HKD",
        link: (p.link ?? "").toString(),
        justification: (p.justification ?? "").toString(),
        status: "pending",
        createdAt: new Date().toISOString(),
      };
      void setDoc(doc(firestore, "purchaseRequests", id), payload);
    },

    reviewPurchaseRequest: (id, status, reviewNote) => {
      const existing = get().purchaseRequests.find((r) => r.id === id);
      // Lock decisions after approval/rejection; only pending can be reviewed.
      if (existing && existing.status !== "pending") return;

      const reviewerId = get().currentUserId;

      if (backendUrl) {
        void (async () => {
          const endpoint = `${backendUrl.replace(/\/$/, "")}/purchaseRequests/${encodeURIComponent(id)}/review`;
          const res = await fetch(endpoint, {
            method: "PATCH",
            headers: {
              "content-type": "application/json",
              ...(await authHeader()),
            },
            body: JSON.stringify({ status, reviewNote }),
          });
          if (!res.ok) throw new Error(`Review purchase request failed (${res.status})`);
        })().catch(() => {});
        return;
      }

      void updateDoc(doc(firestore, "purchaseRequests", id), {
        status,
        reviewerId: reviewerId ?? null,
        reviewedAt: new Date().toISOString(),
        ...(reviewNote?.trim() ? { reviewNote: reviewNote.trim() } : { reviewNote: null }),
      });
    },
  };
});

export const newGoal = (text = "", achieved: boolean | null = null): WeeklyGoal => ({
  id: uid("g"),
  text,
  achieved,
});

export const newLink = (label = "", url = ""): ResourceLink => ({
  id: uid("l"),
  label,
  url,
});

export type { Comment };
