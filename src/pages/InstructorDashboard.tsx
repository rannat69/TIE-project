import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import { useApp } from "@/data/store";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/Avatar";
import { StatusBadge } from "@/components/StatusBadge";
import { WeeklyUpdateCard } from "@/components/WeeklyUpdateCard";
import { SegmentedTabs } from "@/components/SegmentedTabs";
import { LayoutDashboard, BookOpen, ChevronRight, ArrowLeft, Users as UsersIcon, Plus } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import type { AdvisorThreadId, Meeting, MeetingItem } from "@/data/types";
import { datetimeLocalValueToIso, formatMeetingOptionLabel, formatMeetingProposed, isoToDatetimeLocalValue } from "@/lib/meetingTime";
import {
  isInstructorProjectOnlyView,
  isProjectAdvisorWithoutCourseStaff,
  isUserCourseStaffForCourse,
  projectsVisibleOnInstructorHub,
} from "@/lib/userCapabilities";

const newMeetingItem = (text = "", byUserId = "unknown"): MeetingItem => ({
  id: `mi-${Math.random().toString(36).slice(2, 9)}`,
  text,
  createdAt: new Date().toISOString(),
  createdBy: byUserId,
});

function normalizeItems(items: MeetingItem[], byUserId: string): MeetingItem[] {
  const now = new Date().toISOString();
  return (items ?? [])
    .map((x) => ({ ...x, text: (x.text ?? "").toString() }))
    .map((x) => (x.text.trim() ? x : null))
    .filter((x): x is MeetingItem => !!x)
    .map((x) => ({
      ...x,
      text: x.text.trim(),
      updatedAt: now,
      updatedBy: byUserId,
    }));
}

type InstructorTab = "projects" | "pending" | "courses";

const InstructorDashboard = () => {
  const user = useApp((s) => s.users.find((u) => u.id === s.currentUserId))!;
  const allCourses = useApp((s) => s.courses);
  const projects = useApp((s) => s.projects);
  const updates = useApp((s) => s.updates);
  const users = useApp((s) => s.users);
  const purchaseRequests = useApp((s) => s.purchaseRequests);
  const reviewPurchaseRequest = useApp((s) => s.reviewPurchaseRequest);
  const meetings = useApp((s) => s.meetings);
  const createMeeting = useApp((s) => s.createMeeting);
  const updateMeetingAgenda = useApp((s) => s.updateMeetingAgenda);
  const updateMeetingActionItems = useApp((s) => s.updateMeetingActionItems);
  const setMeetingStatus = useApp((s) => s.setMeetingStatus);
  const updateMeetingProposedAt = useApp((s) => s.updateMeetingProposedAt);
  const addMeetingComment = useApp((s) => s.addMeetingComment);
  const addStudentToCourse = useApp((s) => s.addStudentToCourse);
  const removeStudentFromCourse = useApp((s) => s.removeStudentFromCourse);
  const addProject = useApp((s) => s.addProject);
  const assignStudentToProject = useApp((s) => s.assignStudentToProject);
  const removeStudentFromProject = useApp((s) => s.removeStudentFromProject);
  const money = new Intl.NumberFormat("en-HK", { style: "currency", currency: "HKD" });

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<InstructorTab>("projects");
  const [advisorId, setAdvisorId] = useState<AdvisorThreadId>("");
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);
  const [agendaDraft, setAgendaDraft] = useState<MeetingItem[]>([]);
  const [actionsDraft, setActionsDraft] = useState<MeetingItem[]>([]);
  const [commentDraft, setCommentDraft] = useState("");
  const [createProposedLocal, setCreateProposedLocal] = useState("");
  const [proposedLocalDraft, setProposedLocalDraft] = useState("");
  const [prNotes, setPrNotes] = useState<Record<string, string>>({});
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDesc, setNewProjectDesc] = useState("");
  const [newProjectCourseId, setNewProjectCourseId] = useState<string>("");
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [creatingProject, setCreatingProject] = useState(false);

  const courses = allCourses.filter((c) => (c.instructorIds ?? []).includes(user.id));
  const isProjectOnlyInstructor = isInstructorProjectOnlyView(user, allCourses);
  const myProjects = useMemo(
    () => projectsVisibleOnInstructorHub(user.id, allCourses, projects),
    [projects, allCourses, user.id],
  );
  const myUpdates = updates.filter((u) => myProjects.some((p) => p.id === u.projectId));
  const pendingUpdates = myUpdates.filter((u) => u.status === "pending");
  const pending = pendingUpdates.length;
  const students = users.filter((u) => u.role === "student");

  const nav = [{ to: "/instructor", label: "Overview", icon: <LayoutDashboard className="h-4 w-4" /> }];

  const selectedProject = selectedProjectId ? projects.find((p) => p.id === selectedProjectId) : null;
  const selectedCourse = selectedProject ? allCourses.find((c) => c.id === selectedProject.courseId) : null;
  const advisors = useMemo(() => {
    const ids = [
      ...((selectedCourse?.instructorIds ?? []) as string[]),
      ...(((selectedProject?.assignedAdvisorIds ?? []) as string[]) ?? []),
    ];
    const uniq = Array.from(new Set(ids)).filter(Boolean);
    return uniq
      .map((id) => users.find((u) => u.id === id))
      .filter((u): u is NonNullable<typeof u> => !!u);
  }, [selectedCourse?.instructorIds?.join("|"), selectedProject?.assignedAdvisorIds?.join("|"), users]);

  const projectMeetings = useMemo(() => {
    if (!selectedProject) return [];
    return meetings
      .filter((m) => m.projectId === selectedProject.id && (m.advisorId || "") === advisorId)
      .sort((a, b) => (a.sequence < b.sequence ? 1 : -1));
  }, [meetings, selectedProject?.id, advisorId]);
  const selectedMeeting: Meeting | undefined =
    projectMeetings.find((m) => m.id === selectedMeetingId) ?? projectMeetings[0];
  const meetingLocked = useMemo(() => {
    if (!selectedMeeting) return false;
    const newest = projectMeetings[0];
    const hasNewer = newest ? newest.id !== selectedMeeting.id : false;
    return selectedMeeting.status === "held" || hasNewer;
  }, [projectMeetings, selectedMeeting?.id, selectedMeeting?.status]);

  useEffect(() => {
    setSelectedMeetingId(selectedMeeting?.id ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProjectId, advisorId]);

  useEffect(() => {
    if (!selectedCourse) return;
    const ids = [
      ...((selectedCourse.instructorIds ?? []) as string[]),
      ...(((selectedProject?.assignedAdvisorIds ?? []) as string[]) ?? []),
    ];
    const uniq = Array.from(new Set(ids)).filter(Boolean);
    setAdvisorId((prev) => (prev && uniq.includes(prev) ? prev : uniq[0] ?? ""));
  }, [selectedCourse?.id, selectedCourse?.instructorIds?.join("|"), selectedProject?.assignedAdvisorIds?.join("|")]);

  useEffect(() => {
    setProposedLocalDraft(isoToDatetimeLocalValue(selectedMeeting?.proposedAt ?? null));
  }, [selectedMeeting?.id, selectedMeeting?.proposedAt]);

  useEffect(() => {
    if (isProjectOnlyInstructor && activeTab === "courses") setActiveTab("projects");
  }, [isProjectOnlyInstructor, activeTab]);

  useEffect(() => {
    if (!selectedProject) return;
    setAgendaDraft(selectedMeeting?.agendaItems?.length ? selectedMeeting.agendaItems : [newMeetingItem("", user.id)]);
    setActionsDraft(selectedMeeting?.actionItems?.length ? selectedMeeting.actionItems : [newMeetingItem("", user.id)]);
    setCommentDraft("");
  }, [selectedProject?.id, selectedMeeting?.id, meetings, user.id]);

  if (selectedProjectId) {
    const project = selectedProject!;
    const course = allCourses.find((c) => c.id === project.courseId);
    const canManageCourseForThisProject = isUserCourseStaffForCourse(user.id, course);
    const projectAdvisorOnlyView = isProjectAdvisorWithoutCourseStaff(user, project, allCourses);
    const detailRoleLabel = projectAdvisorOnlyView ? "Project support" : "Instructor";
    const rosterIds = [...(course?.studentIds ?? [])];
    const projectUpdates = updates
      .filter((u) => u.projectId === project.id)
      .sort((a, b) => b.weekNumber - a.weekNumber);
    const progressNow = projectUpdates[0]?.progress ?? project.progress;
    const projectPRs = purchaseRequests
      .filter((r) => r.projectId === project.id)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

    return (
      <AppShell roleLabel={detailRoleLabel} nav={nav}>
        <div className="container mx-auto max-w-5xl px-6 py-8">
          <Button variant="ghost" size="sm" className="mb-4" onClick={() => setSelectedProjectId(null)}>
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Back to overview
          </Button>
          <div className="mb-2 flex items-center gap-2">
            <Badge variant="secondary">{course?.code}</Badge>
            <span className="text-xs text-muted-foreground">{course?.name}</span>
          </div>
          <h1 className="font-serif text-3xl font-semibold text-foreground">{project.name}</h1>
          <p className="mt-1 text-muted-foreground">{project.description}</p>

          {projectAdvisorOnlyView ? (
            <div className="mt-4 rounded-md border border-border bg-muted/35 px-4 py-3 text-sm text-muted-foreground">
              You have <span className="font-medium text-foreground">project support</span> access for this team. You can
              review weekly updates and meetings. Course setup, team roster changes, purchases, and other projects in
              this course are managed by course instructors.
            </div>
          ) : null}

          <div className="mt-5 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <UsersIcon className="h-4 w-4 text-muted-foreground" />
              <div className="flex -space-x-2">
                {project.studentIds.map((sid) => <Avatar key={sid} userId={sid} size={28} />)}
              </div>
              <span className="text-sm text-muted-foreground">
                {project.studentIds.map((sid) => users.find((u) => u.id === sid)?.name).join(", ")}
              </span>
            </div>
            <div className="ml-auto flex items-center gap-3 text-sm">
              <span className="text-muted-foreground">Progress</span>
              <div className="h-2 w-32 overflow-hidden rounded-full bg-secondary">
                <div className="h-full bg-gradient-hero" style={{ width: `${progressNow}%` }} />
              </div>
              <span className="font-serif font-semibold text-primary">{progressNow}%</span>
            </div>
          </div>

          <Card className="academic-card mt-5 p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="font-serif text-xl font-semibold text-foreground">Team</h2>
                <p className="text-sm text-muted-foreground">
                  {canManageCourseForThisProject
                    ? "Assign students to this project from the course roster."
                    : "Project team members (course instructors manage the roster)."}
                </p>
              </div>
              {canManageCourseForThisProject ? (
                <Select
                  onValueChange={async (studentId) => {
                    try {
                      await assignStudentToProject(project.id, studentId);
                      toast.success("Student added to project.");
                    } catch (e) {
                      const msg = e instanceof Error ? e.message : "Unknown error";
                      toast.error(`Could not add student: ${msg}`);
                    }
                  }}
                >
                  <SelectTrigger className="w-72">
                    <SelectValue placeholder="Add student to project…" />
                  </SelectTrigger>
                  <SelectContent>
                    {rosterIds
                      .map((sid) => students.find((s) => s.id === sid))
                      .filter((s): s is NonNullable<typeof s> => !!s)
                      .filter((s) => !project.studentIds.includes(s.id))
                      .map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2">
              {project.studentIds.map((sid) => {
                const s = users.find((u) => u.id === sid);
                if (!s) return null;
                return (
                  <span
                    key={sid}
                    className="inline-flex items-center gap-2 rounded-full border border-border bg-card py-1 pl-1 pr-2 text-xs"
                  >
                    <Avatar userId={sid} size={20} />
                    {s.name}
                    {!canManageCourseForThisProject ? null : (
                      <button
                        onClick={async () => {
                          try {
                            await removeStudentFromProject(project.id, sid);
                            toast.success("Student removed from project.");
                          } catch (e) {
                            const msg = e instanceof Error ? e.message : "Unknown error";
                            toast.error(`Could not remove student: ${msg}`);
                          }
                        }}
                        className="ml-1 text-muted-foreground hover:text-destructive"
                      >
                        ×
                      </button>
                    )}
                  </span>
                );
              })}
              {project.studentIds.length === 0 ? (
                <span className="text-xs text-muted-foreground">No students assigned yet.</span>
              ) : null}
            </div>
          </Card>

          <div className="mt-8">
            <h2 className="mb-4 font-serif text-xl font-semibold text-foreground">Weekly updates ({projectUpdates.length})</h2>
            <div className="space-y-3">
              {projectUpdates.map((u, idx) => (
                <WeeklyUpdateCard key={u.id} update={u} viewer="instructor" defaultOpen={idx === 0} />
              ))}
              {projectUpdates.length === 0 && (
                <Card className="academic-card p-8 text-center text-sm text-muted-foreground">
                  No weekly updates submitted yet.
                </Card>
              )}
            </div>
          </div>

          <div className="mt-10">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-serif text-xl font-semibold text-foreground">Meetings</h2>
                <p className="text-sm text-muted-foreground">
                  View and edit agendas/action items. Create new meetings (optionally inheriting prior action items).
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
                <div className="space-y-1.5 sm:min-w-[220px]">
                  <Label htmlFor="instructor-meeting-advisor" className="text-xs text-muted-foreground">
                    Meeting thread
                  </Label>
                  <Select value={advisorId || undefined} onValueChange={(v) => setAdvisorId(v)}>
                    <SelectTrigger id="instructor-meeting-advisor" className="h-9 w-full border-border bg-background sm:w-[260px]">
                      <SelectValue placeholder="Choose meeting lead" />
                    </SelectTrigger>
                    <SelectContent>
                      {advisors.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 sm:min-w-[200px]">
                  <Label htmlFor="instructor-new-meeting-proposed" className="text-xs text-muted-foreground">
                    Proposed time for new meetings (optional)
                  </Label>
                  <Input
                    id="instructor-new-meeting-proposed"
                    type="datetime-local"
                    value={createProposedLocal}
                    onChange={(e) => setCreateProposedLocal(e.target.value)}
                    className="h-9 w-full sm:w-[240px]"
                  />
                </div>
                <Button
                  variant="outline"
                  onClick={async () => {
                    try {
                      if (!advisorId) throw new Error("No instructor found for this course.");
                      const iso = datetimeLocalValueToIso(createProposedLocal);
                      const id = await createMeeting(project.id, advisorId, false, iso ? { proposedAt: iso } : undefined);
                      setCreateProposedLocal("");
                      toast.success("Meeting created.");
                      setSelectedMeetingId(id);
                    } catch (e) {
                      const msg = e instanceof Error ? e.message : "Unknown error";
                      toast.error(`Could not create meeting: ${msg}`);
                    }
                  }}
                >
                  New meeting
                </Button>
                <Button
                  onClick={async () => {
                    try {
                      if (!advisorId) throw new Error("No instructor found for this course.");
                      const iso = datetimeLocalValueToIso(createProposedLocal);
                      const id = await createMeeting(project.id, advisorId, true, iso ? { proposedAt: iso } : undefined);
                      setCreateProposedLocal("");
                      toast.success("Meeting created (inherited).");
                      setSelectedMeetingId(id);
                    } catch (e) {
                      const msg = e instanceof Error ? e.message : "Unknown error";
                      toast.error(`Could not create meeting: ${msg}`);
                    }
                  }}
                >
                  New (inherit)
                </Button>
              </div>
            </div>

            <Card className="academic-card p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-foreground">
                    {selectedMeeting ? `Meeting #${selectedMeeting.sequence}` : "No meetings yet"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {selectedMeeting ? `Created ${new Date(selectedMeeting.createdAt).toLocaleString()}` : "Create a meeting above."}
                  </div>
                  {selectedMeeting ? (
                    <div className="mt-1 text-xs text-foreground">
                      {selectedMeeting.proposedAt ? (
                        <>Proposed: {formatMeetingProposed(selectedMeeting.proposedAt)}</>
                      ) : (
                        <span className="text-muted-foreground">No proposed date yet — set it below.</span>
                      )}
                    </div>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {projectMeetings.length > 0 ? (
                    <select
                      className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                      value={selectedMeeting?.id ?? ""}
                      onChange={(e) => setSelectedMeetingId(e.target.value)}
                    >
                      {projectMeetings.map((m) => (
                        <option key={m.id} value={m.id}>
                          {formatMeetingOptionLabel(m)}
                        </option>
                      ))}
                    </select>
                  ) : null}
                  {selectedMeeting ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        try {
                          await setMeetingStatus(selectedMeeting.id, selectedMeeting.status === "held" ? "draft" : "held");
                          toast.success("Meeting status updated.");
                        } catch (e) {
                          const msg = e instanceof Error ? e.message : "Unknown error";
                          toast.error(`Could not update status: ${msg}`);
                        }
                      }}
                    >
                      Mark as {selectedMeeting?.status === "held" ? "draft" : "held"}
                    </Button>
                  ) : null}
                </div>
              </div>

              {selectedMeeting ? (
                <div className="mb-4 flex flex-col gap-2 rounded-md border border-border/70 bg-muted/25 p-3 sm:flex-row sm:flex-wrap sm:items-end">
                  <div className="min-w-0 flex-1 space-y-1.5 sm:max-w-md">
                    <Label htmlFor="instructor-meeting-proposed" className="text-xs">
                      Proposed meeting date & time
                    </Label>
                    <Input
                      id="instructor-meeting-proposed"
                      type="datetime-local"
                      value={proposedLocalDraft}
                      onChange={(e) => setProposedLocalDraft(e.target.value)}
                      className="h-9 w-full"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={async () => {
                        try {
                          await updateMeetingProposedAt(selectedMeeting.id, datetimeLocalValueToIso(proposedLocalDraft));
                          toast.success("Proposed time saved.");
                        } catch (e) {
                          const msg = e instanceof Error ? e.message : "Unknown error";
                          toast.error(`Could not save: ${msg}`);
                        }
                      }}
                    >
                      Save proposed time
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        try {
                          setProposedLocalDraft("");
                          await updateMeetingProposedAt(selectedMeeting.id, null);
                          toast.success("Proposed time cleared.");
                        } catch (e) {
                          const msg = e instanceof Error ? e.message : "Unknown error";
                          toast.error(`Could not clear: ${msg}`);
                        }
                      }}
                    >
                      Clear
                    </Button>
                  </div>
                </div>
              ) : null}

              {selectedMeeting ? (
                <div className="grid gap-6 lg:grid-cols-3">
                  <div>
                    <div className="mb-2 font-serif text-lg font-semibold text-foreground">Agenda</div>
                    {meetingLocked ? (
                      <div className="mb-2 text-xs text-muted-foreground">
                        Locked: this meeting is held or a newer meeting exists in this instructor thread.
                      </div>
                    ) : null}
                    <div className="space-y-2">
                      {agendaDraft.map((it, idx) => (
                        <div key={it.id} className="flex items-center gap-2">
                          <span className="w-6 text-right text-sm text-muted-foreground">{idx + 1}.</span>
                          <Input
                            value={it.text}
                            disabled={meetingLocked}
                            onChange={(e) =>
                              setAgendaDraft((xs) => xs.map((x) => (x.id === it.id ? { ...x, text: e.target.value } : x)))
                            }
                            placeholder="Agenda item…"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={meetingLocked}
                            onClick={() => setAgendaDraft((xs) => xs.filter((x) => x.id !== it.id))}
                          >
                            ×
                          </Button>
                        </div>
                      ))}
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={meetingLocked}
                          onClick={() => setAgendaDraft((xs) => [...xs, newMeetingItem("", user.id)])}
                        >
                          Add agenda item
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          disabled={meetingLocked}
                          onClick={async () => {
                            try {
                              if (meetingLocked) {
                                toast.error("Meeting is locked. Edit the latest draft meeting in this thread.");
                                return;
                              }
                              await updateMeetingAgenda(selectedMeeting.id, normalizeItems(agendaDraft, user.id));
                              toast.success("Agenda saved.");
                            } catch (e) {
                              const msg = e instanceof Error ? e.message : "Unknown error";
                              toast.error(`Could not save agenda: ${msg}`);
                            }
                          }}
                        >
                          Save agenda
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 font-serif text-lg font-semibold text-foreground">Action items</div>
                    {meetingLocked ? (
                      <div className="mb-2 text-xs text-muted-foreground">
                        Locked: this meeting is held or a newer meeting exists in this instructor thread.
                      </div>
                    ) : null}
                    <div className="space-y-2">
                      {actionsDraft.map((it, idx) => (
                        <div key={it.id} className="flex items-center gap-2">
                          <span className="w-6 text-right text-sm text-muted-foreground">{idx + 1}.</span>
                          <Input
                            value={it.text}
                            disabled={meetingLocked}
                            onChange={(e) =>
                              setActionsDraft((xs) => xs.map((x) => (x.id === it.id ? { ...x, text: e.target.value } : x)))
                            }
                            placeholder="Action item…"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={meetingLocked}
                            onClick={() => setActionsDraft((xs) => xs.filter((x) => x.id !== it.id))}
                          >
                            ×
                          </Button>
                        </div>
                      ))}
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={meetingLocked}
                          onClick={() => setActionsDraft((xs) => [...xs, newMeetingItem("", user.id)])}
                        >
                          Add action item
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          disabled={meetingLocked}
                          onClick={async () => {
                            try {
                              if (meetingLocked) {
                                toast.error("Meeting is locked. Edit the latest draft meeting in this thread.");
                                return;
                              }
                              await updateMeetingActionItems(selectedMeeting.id, normalizeItems(actionsDraft, user.id));
                              toast.success("Action items saved.");
                            } catch (e) {
                              const msg = e instanceof Error ? e.message : "Unknown error";
                              toast.error(`Could not save action items: ${msg}`);
                            }
                          }}
                        >
                          Save action items
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 font-serif text-lg font-semibold text-foreground">Comments</div>
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Textarea
                          value={commentDraft}
                          onChange={(e) => setCommentDraft(e.target.value)}
                          rows={4}
                          placeholder="Write a comment for the team…"
                        />
                        <div className="flex justify-end">
                          <Button
                            type="button"
                            size="sm"
                            disabled={!commentDraft.trim()}
                            onClick={() => {
                              try {
                                addMeetingComment(selectedMeeting.id, user.id, commentDraft);
                                setCommentDraft("");
                                toast.success("Comment posted.");
                              } catch {
                                toast.error("Could not post comment.");
                              }
                            }}
                          >
                            Post comment
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        {(selectedMeeting.comments ?? [])
                          .slice()
                          .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
                          .map((c) => {
                            const author = users.find((u) => u.id === c.authorId);
                            return (
                              <div key={c.id} className="rounded-md border border-border bg-card p-3">
                                <div className="mb-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                                  <span>{author?.name ?? "Unknown"}</span>
                                  <span>{new Date(c.createdAt).toLocaleString()}</span>
                                </div>
                                <div className="text-sm text-foreground whitespace-pre-wrap">{c.text}</div>
                              </div>
                            );
                          })}
                        {(selectedMeeting.comments ?? []).length === 0 ? (
                          <div className="text-sm text-muted-foreground">No comments yet.</div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">Create a meeting to start drafting an agenda.</div>
              )}
            </Card>
          </div>

          {canManageCourseForThisProject ? (
            <div className="mt-10">
              <h2 className="mb-2 font-serif text-xl font-semibold text-foreground">
                Purchase requests ({projectPRs.length})
              </h2>
              <p className="mb-4 text-sm text-muted-foreground">
                Review project purchase requests. Approving/rejecting is separate from weekly updates.
              </p>

              <div className="space-y-3">
                {projectPRs.map((r) => {
                  const requester = users.find((u) => u.id === r.requesterId);
                  const prNote = prNotes[r.id] ?? "";
                  const locked = r.status !== "pending";
                  return (
                    <Card key={r.id} className="academic-card p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium text-foreground">{r.item}</span>
                            <span className="text-xs text-muted-foreground">×{r.quantity}</span>
                            <StatusBadge status={r.status} />
                          </div>
                          <div className="mt-1 text-sm text-muted-foreground">
                            Requested by {requester?.name ?? "Unknown"} · Cost: {money.format(Number(r.cost) || 0)}
                          </div>
                          {r.link ? (
                            <a className="mt-2 inline-flex items-center gap-1 text-sm text-primary hover:underline" href={r.link} target="_blank" rel="noreferrer">
                              View item link
                            </a>
                          ) : null}
                          <p className="mt-3 text-sm text-foreground">{r.justification}</p>
                          {r.reviewNote ? (
                            <p className="mt-3 text-sm text-muted-foreground">Review note: {r.reviewNote}</p>
                          ) : null}
                        </div>
                        <div className="text-right text-xs text-muted-foreground">
                          {new Date(r.createdAt).toLocaleString()}
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        <div className="space-y-1.5 md:col-span-2">
                          <Label>Optional note to team</Label>
                          <Textarea
                            value={prNote}
                            onChange={(e) => setPrNotes((s) => ({ ...s, [r.id]: e.target.value }))}
                            rows={2}
                            disabled={locked}
                          />
                        </div>
                        <div className="flex items-center gap-2 md:col-span-2">
                          <Button
                            variant="outline"
                            disabled={locked}
                            onClick={() => {
                              try {
                                reviewPurchaseRequest(r.id, "rejected", prNote);
                                setPrNotes((s) => ({ ...s, [r.id]: "" }));
                                toast.success("Request rejected.");
                              } catch {
                                toast.error("Could not update request.");
                              }
                            }}
                          >
                            Reject
                          </Button>
                          <Button
                            disabled={locked}
                            onClick={() => {
                              try {
                                reviewPurchaseRequest(r.id, "approved", prNote);
                                setPrNotes((s) => ({ ...s, [r.id]: "" }));
                                toast.success("Request approved.");
                              } catch {
                                toast.error("Could not update request.");
                              }
                            }}
                          >
                            Approve
                          </Button>
                          {locked ? (
                            <span className="text-xs text-muted-foreground">Locked after decision.</span>
                          ) : null}
                        </div>
                      </div>
                    </Card>
                  );
                })}

                {projectPRs.length === 0 && (
                  <Card className="academic-card p-8 text-center text-sm text-muted-foreground">
                    No purchase requests for this project yet.
                  </Card>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell roleLabel="Instructor" nav={nav}>
      <div className="container mx-auto max-w-7xl px-6 py-8">
        <div className="mb-8">
          <h1 className="font-serif text-3xl font-semibold text-foreground">Welcome back, {user.name.split(" ")[1] ?? user.name}</h1>
          <p className="text-sm text-muted-foreground">
            {pending > 0 ? `${pending} weekly update${pending === 1 ? "" : "s"} awaiting your review.` : "All caught up — no pending reviews."}
          </p>
        </div>

        <SegmentedTabs<InstructorTab>
          value={activeTab}
          onChange={setActiveTab}
          tabs={
            isProjectOnlyInstructor
              ? [
                  { value: "projects", label: <>My projects ({myProjects.length})</> },
                  { value: "pending", label: <>Pending reviews ({pending})</> },
                ]
              : [
                  { value: "projects", label: <>My projects ({myProjects.length})</> },
                  { value: "pending", label: <>Pending reviews ({pending})</> },
                  { value: "courses", label: <>My courses ({courses.length})</> },
                ]
          }
        />

        {activeTab === "projects" && (
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {myProjects.map((p) => {
              const course = allCourses.find((c) => c.id === p.courseId);
              const lastUpdate = updates
                .filter((u) => u.projectId === p.id)
                .sort((a, b) => b.weekNumber - a.weekNumber)[0];
              const progressNow = lastUpdate?.progress ?? p.progress;
              return (
                <Card key={p.id} className="academic-card cursor-pointer p-5" onClick={() => setSelectedProjectId(p.id)}>
                  <div className="mb-3 flex items-start justify-between">
                    <div>
                      <Badge variant="secondary" className="mb-2">{course?.code}</Badge>
                      <h3 className="font-serif text-lg font-semibold text-foreground">{p.name}</h3>
                      <p className="text-sm text-muted-foreground">{p.description}</p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="mb-3 flex items-center gap-2">
                    <div className="flex -space-x-2">
                      {p.studentIds.map((sid) => <Avatar key={sid} userId={sid} size={24} />)}
                    </div>
                    <span className="text-xs text-muted-foreground">{p.studentIds.length} students</span>
                  </div>
                  <div className="mb-3">
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-medium text-primary">{progressNow}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                      <div className="h-full bg-gradient-hero" style={{ width: `${progressNow}%` }} />
                    </div>
                  </div>
                  {lastUpdate ? (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Latest: Week {lastUpdate.weekNumber}</span>
                      <StatusBadge status={lastUpdate.status} />
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">No updates yet</span>
                  )}
                </Card>
              );
            })}
          </div>
        )}

        {activeTab === "pending" && (
          <div className="mt-5 space-y-3">
            {pendingUpdates.map((u) => {
              const project = projects.find((p) => p.id === u.projectId);
              return (
                <div key={u.id}>
                  <button onClick={() => setSelectedProjectId(u.projectId)} className="mb-2 text-sm font-medium text-primary hover:underline">
                    {project?.name} →
                  </button>
                  <WeeklyUpdateCard update={u} viewer="instructor" defaultOpen />
                </div>
              );
            })}
            {pendingUpdates.length === 0 && (
              <Card className="academic-card p-8 text-center text-sm text-muted-foreground">
                Nothing waiting on you. 🎉
              </Card>
            )}
          </div>
        )}

        {activeTab === "courses" && !isProjectOnlyInstructor && (
          <div className="mt-5 space-y-5">
            <Card className="academic-card p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-serif text-xl font-semibold text-foreground">Create a new project</h2>
                  <p className="text-sm text-muted-foreground">Projects you create here will belong to your assigned courses.</p>
                </div>
                <Dialog open={createProjectOpen} onOpenChange={setCreateProjectOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="mr-1.5 h-4 w-4" /> New project
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create project</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <Label>Course</Label>
                        <Select value={newProjectCourseId} onValueChange={setNewProjectCourseId}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select course" />
                          </SelectTrigger>
                          <SelectContent>
                            {courses.map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.code} — {c.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Project name</Label>
                        <Input value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Description</Label>
                        <Textarea value={newProjectDesc} onChange={(e) => setNewProjectDesc(e.target.value)} rows={3} />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        disabled={creatingProject}
                        onClick={async () => {
                          if (!newProjectCourseId || !newProjectName.trim()) {
                            toast.error("Course and project name are required.");
                            return;
                          }
                          if (creatingProject) return;
                          try {
                            setCreatingProject(true);
                            await addProject({
                              name: newProjectName.trim(),
                              description: newProjectDesc,
                              courseId: newProjectCourseId,
                              studentIds: [],
                            });
                            setNewProjectName("");
                            setNewProjectDesc("");
                            setNewProjectCourseId("");
                            toast.success("Project created.");
                            setCreateProjectOpen(false);
                          } catch (e) {
                            const msg = e instanceof Error ? e.message : "Unknown error";
                            toast.error(`Could not create project: ${msg}`);
                          } finally {
                            setCreatingProject(false);
                          }
                        }}
                      >
                        {creatingProject ? "Creating..." : "Create project"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </Card>

            <div className="grid gap-4 lg:grid-cols-2">
              {courses.map((c) => {
                const cProjects = projects.filter((p) => p.courseId === c.id);
                const roster = (c.studentIds ?? []) as string[];
                const rosterStudents = roster.map((sid) => students.find((s) => s.id === sid)).filter(Boolean);
                const candidates = students.filter((s) => !roster.includes(s.id));

                return (
                  <Card key={c.id} className="academic-card p-5">
                    <Badge variant="secondary" className="mb-2">{c.code}</Badge>
                    <h3 className="font-serif text-lg font-semibold text-foreground">{c.name}</h3>
                    <p className="text-xs text-muted-foreground">{c.term}</p>

                    <div className="mt-4 flex items-center gap-2 text-sm">
                      <BookOpen className="h-4 w-4 text-primary" />
                      {cProjects.length} project{cProjects.length === 1 ? "" : "s"}
                      <span className="text-muted-foreground">·</span>
                      <span className="text-muted-foreground">{roster.length} students in course</span>
                    </div>

                    <div className="mt-4">
                      <div className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Course students</div>
                      <div className="mb-3 flex flex-wrap gap-2">
                        {rosterStudents.map((s) => {
                          if (!s) return null;
                          return (
                            <span
                              key={s.id}
                              className="inline-flex items-center gap-2 rounded-full border border-border bg-card py-1 pl-1 pr-2 text-xs"
                            >
                              <Avatar userId={s.id} size={20} />
                              {s.name}
                              <button
                                onClick={async () => {
                                  try {
                                    await removeStudentFromCourse(c.id, s.id);
                                    toast.success("Student removed from course.");
                                  } catch (e) {
                                    const msg = e instanceof Error ? e.message : "Unknown error";
                                    toast.error(`Could not remove student: ${msg}`);
                                  }
                                }}
                                className="ml-1 text-muted-foreground hover:text-destructive"
                              >
                                ×
                              </button>
                            </span>
                          );
                        })}
                        {roster.length === 0 ? (
                          <span className="text-xs text-muted-foreground">No students added yet.</span>
                        ) : null}
                      </div>

                      <Select
                        onValueChange={async (sid) => {
                          try {
                            await addStudentToCourse(c.id, sid);
                            toast.success("Student added to course.");
                          } catch (e) {
                            const msg = e instanceof Error ? e.message : "Unknown error";
                            toast.error(`Could not add student: ${msg}`);
                          }
                        }}
                      >
                        <SelectTrigger className="h-9 text-sm">
                          <SelectValue placeholder="Add student to course…" />
                        </SelectTrigger>
                        <SelectContent>
                          {candidates.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="mt-5">
                      <div className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Projects</div>
                      <div className="space-y-2">
                        {cProjects.map((p) => (
                          <button
                            key={p.id}
                            onClick={() => setSelectedProjectId(p.id)}
                            className="flex w-full items-center justify-between rounded-md border border-border bg-card px-3 py-2 text-left text-sm hover:border-primary"
                          >
                            <span className="font-medium text-foreground">{p.name}</span>
                            <span className="text-xs text-muted-foreground">{p.studentIds.length} students</span>
                          </button>
                        ))}
                        {cProjects.length === 0 ? (
                          <span className="text-xs text-muted-foreground">No projects yet.</span>
                        ) : null}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
};

export default InstructorDashboard;
