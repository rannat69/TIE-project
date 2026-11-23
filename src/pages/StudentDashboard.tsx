import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import { useApp } from "@/data/store";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/Avatar";
import { StatusBadge } from "@/components/StatusBadge";
import { WeeklyUpdateCard } from "@/components/WeeklyUpdateCard";
import { SubmitUpdateForm } from "@/components/SubmitUpdateForm";
import { LayoutDashboard, ChevronRight, ArrowLeft, Users as UsersIcon, Plus } from "lucide-react";
import { differenceInDays } from "date-fns";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ExternalLink } from "lucide-react";
import { toast } from "sonner";
import type { AdvisorThreadId, Meeting, MeetingItem } from "@/data/types";
import { datetimeLocalValueToIso, formatMeetingOptionLabel, formatMeetingProposed, isoToDatetimeLocalValue } from "@/lib/meetingTime";

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

const StudentDashboard = () => {
  const user = useApp((s) => s.users.find((u) => u.id === s.currentUserId))!;
  const allProjects = useApp((s) => s.projects);
  const courses = useApp((s) => s.courses);
  const updates = useApp((s) => s.updates);
  const users = useApp((s) => s.users);
  const purchaseRequests = useApp((s) => s.purchaseRequests);
  const submitPurchaseRequest = useApp((s) => s.submitPurchaseRequest);
  const meetings = useApp((s) => s.meetings);
  const createMeeting = useApp((s) => s.createMeeting);
  const updateMeetingAgenda = useApp((s) => s.updateMeetingAgenda);
  const updateMeetingActionItems = useApp((s) => s.updateMeetingActionItems);
  const setMeetingStatus = useApp((s) => s.setMeetingStatus);
  const updateMeetingProposedAt = useApp((s) => s.updateMeetingProposedAt);
  const addMeetingComment = useApp((s) => s.addMeetingComment);

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const [advisorId, setAdvisorId] = useState<AdvisorThreadId>("");
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);
  const [agendaDraft, setAgendaDraft] = useState<MeetingItem[]>([]);
  const [actionsDraft, setActionsDraft] = useState<MeetingItem[]>([]);
  const [commentDraft, setCommentDraft] = useState("");
  const [createProposedLocal, setCreateProposedLocal] = useState("");
  const [proposedLocalDraft, setProposedLocalDraft] = useState("");
  const [prItem, setPrItem] = useState("");
  const [prQty, setPrQty] = useState(1);
  const [prCost, setPrCost] = useState(0);
  const [prLink, setPrLink] = useState("");
  const [prWhy, setPrWhy] = useState("");
  const money = new Intl.NumberFormat("en-HK", { style: "currency", currency: "HKD" });

  const nav = [{ to: "/student", label: "Overview", icon: <LayoutDashboard className="h-4 w-4" /> }];
  const projects = allProjects.filter((p) => p.studentIds.includes(user.id));

  const selectedProject = selectedProjectId ? projects.find((p) => p.id === selectedProjectId) : null;
  const selectedCourse = selectedProject ? courses.find((c) => c.id === selectedProject.courseId) : null;
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
    // When switching projects or tracks, default to newest meeting.
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
    if (!selectedProject) return;
    setAgendaDraft(selectedMeeting?.agendaItems?.length ? selectedMeeting.agendaItems : [newMeetingItem("", user.id)]);
    setActionsDraft(selectedMeeting?.actionItems?.length ? selectedMeeting.actionItems : [newMeetingItem("", user.id)]);
    setCommentDraft("");
  }, [selectedProject?.id, selectedMeeting?.id, meetings, user.id]);

  if (selectedProjectId) {
    const project = selectedProject!;
    const course = courses.find((c) => c.id === project.courseId);
    const projectUpdates = updates
      .filter((u) => u.projectId === project.id)
      .sort((a, b) => b.weekNumber - a.weekNumber);
    const lastUpdate = projectUpdates[0];
    const progressNow = lastUpdate?.progress ?? project.progress;
    const projectPRs = purchaseRequests
      .filter((r) => r.projectId === project.id)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    const daysSince = lastUpdate ? differenceInDays(new Date(), new Date(lastUpdate.submittedAt)) : null;

    return (
      <AppShell roleLabel="Student" nav={nav}>
        <div className="container mx-auto max-w-5xl px-6 py-8">
          <Button variant="ghost" size="sm" className="mb-4" onClick={() => { setSelectedProjectId(null); setComposing(false); }}>
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Back to my projects
          </Button>
          <div className="mb-2 flex items-center gap-2">
            <Badge variant="secondary">{course?.code}</Badge>
            <span className="text-xs text-muted-foreground">{course?.name}</span>
          </div>
          <h1 className="font-serif text-3xl font-semibold text-foreground">{project.name}</h1>
          <p className="mt-1 text-muted-foreground">{project.description}</p>

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

          {!composing && (
            <Card className="academic-card mt-6 flex items-center justify-between bg-gradient-hero p-5 text-primary-foreground">
              <div>
                <h3 className="font-serif text-lg font-semibold">Time for this week's update</h3>
                <p className="text-sm text-primary-foreground/80">
                  {lastUpdate
                    ? `Last update was ${daysSince} day${daysSince === 1 ? "" : "s"} ago.`
                    : "No updates yet — submit your first one."}
                </p>
              </div>
              <Button variant="secondary" onClick={() => setComposing(true)}>
                <Plus className="mr-1.5 h-4 w-4" /> Submit update
              </Button>
            </Card>
          )}

          {composing && (
            <div className="mt-6">
              <SubmitUpdateForm project={project} onSubmitted={() => setComposing(false)} />
            </div>
          )}

          <div className="mt-8">
            <h2 className="mb-4 font-serif text-xl font-semibold text-foreground">
              Weekly history ({projectUpdates.length})
            </h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Browse previous weeks to track continuity and see instructor feedback.
            </p>
            <div className="space-y-3">
              {projectUpdates.map((u, idx) => (
                <WeeklyUpdateCard key={u.id} update={u} viewer="student" defaultOpen={idx === 0} />
              ))}
              {projectUpdates.length === 0 && (
                <Card className="academic-card p-8 text-center text-sm text-muted-foreground">
                  No updates yet — submit your first one above.
                </Card>
              )}
            </div>
          </div>

          <div className="mt-10">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-serif text-xl font-semibold text-foreground">Meetings</h2>
                <p className="text-sm text-muted-foreground">
                  Create agendas and action items. New meeting agendas can inherit last meeting action items.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
                <div className="space-y-1.5 sm:min-w-[220px]">
                  <Label htmlFor="student-meeting-advisor" className="text-xs text-muted-foreground">
                    Meeting thread
                  </Label>
                  <Select value={advisorId || undefined} onValueChange={(v) => setAdvisorId(v)}>
                    <SelectTrigger id="student-meeting-advisor" className="h-9 w-full border-border bg-background sm:w-[260px]">
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
                  <Label htmlFor="student-new-meeting-proposed" className="text-xs text-muted-foreground">
                    Proposed time for new meetings (optional)
                  </Label>
                  <Input
                    id="student-new-meeting-proposed"
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
                  New (inherit last actions)
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
                    {selectedMeeting ? `Created ${new Date(selectedMeeting.createdAt).toLocaleString()}` : "Create your first meeting above."}
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
                    <Label htmlFor="student-meeting-proposed" className="text-xs">
                      Proposed meeting date & time
                    </Label>
                    <Input
                      id="student-meeting-proposed"
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
                          placeholder="Write a comment for your team…"
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

          <div className="mt-10">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="font-serif text-xl font-semibold text-foreground">Purchase requests</h2>
                <p className="text-sm text-muted-foreground">
                  Request items for this project. Your instructor will review and approve/reject.
                </p>
              </div>
              <Dialog>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-1.5 h-4 w-4" /> New request
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Request a purchase</DialogTitle>
                  </DialogHeader>

                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label>Item</Label>
                      <Input value={prItem} onChange={(e) => setPrItem(e.target.value)} placeholder="e.g. Arduino Uno" />
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label>Quantity</Label>
                        <Input
                          type="number"
                          min={1}
                          value={prQty}
                          onChange={(e) => setPrQty(Math.max(1, Number(e.target.value || 1)))}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Cost (total, HKD)</Label>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={prCost}
                          onChange={(e) => setPrCost(Math.max(0, Number(e.target.value || 0)))}
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Link</Label>
                      <Input value={prLink} onChange={(e) => setPrLink(e.target.value)} placeholder="https://…" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Why it’s needed</Label>
                      <Textarea value={prWhy} onChange={(e) => setPrWhy(e.target.value)} rows={4} />
                    </div>
                  </div>

                  <DialogFooter>
                    <Button
                      onClick={() => {
                        if (!prItem.trim() || !prWhy.trim()) {
                          toast.error("Item and justification are required.");
                          return;
                        }
                        submitPurchaseRequest({
                          projectId: project.id,
                          requesterId: user.id,
                          item: prItem.trim(),
                          quantity: prQty,
                          cost: prCost,
                          link: prLink.trim(),
                          justification: prWhy.trim(),
                        });
                        setPrItem("");
                        setPrQty(1);
                        setPrCost(0);
                        setPrLink("");
                        setPrWhy("");
                        toast.success("Purchase request submitted.");
                      }}
                    >
                      Submit request
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <div className="space-y-3">
              {projectPRs.map((r) => (
                <Card key={r.id} className="academic-card p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-foreground">{r.item}</span>
                        <span className="text-xs text-muted-foreground">×{r.quantity}</span>
                        <StatusBadge status={r.status} />
                      </div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        Cost: {money.format(Number(r.cost) || 0)}
                      </div>
                      {r.link ? (
                        <a className="mt-2 inline-flex items-center gap-1 text-sm text-primary hover:underline" href={r.link} target="_blank" rel="noreferrer">
                          <ExternalLink className="h-4 w-4" /> View item link
                        </a>
                      ) : null}
                      <p className="mt-3 text-sm text-foreground">{r.justification}</p>
                      {r.reviewNote ? (
                        <p className="mt-3 text-sm text-muted-foreground">
                          Instructor note: {r.reviewNote}
                        </p>
                      ) : null}
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      {new Date(r.createdAt).toLocaleString()}
                    </div>
                  </div>
                </Card>
              ))}

              {projectPRs.length === 0 && (
                <Card className="academic-card p-8 text-center text-sm text-muted-foreground">
                  No purchase requests yet.
                </Card>
              )}
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell roleLabel="Student" nav={nav}>
      <div className="container mx-auto max-w-6xl px-6 py-8">
        <div className="mb-8">
          <h1 className="font-serif text-3xl font-semibold text-foreground">Hi {user.name.split(" ")[0]} 👋</h1>
          <p className="text-sm text-muted-foreground">
            You're on {projects.length} project team{projects.length === 1 ? "" : "s"}. Pick one to view or submit a weekly update.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {projects.map((p) => {
            const course = courses.find((c) => c.id === p.courseId);
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
                  <span className="text-xs text-muted-foreground">{p.studentIds.length} teammates</span>
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
                  <span className="text-xs text-muted-foreground">No updates yet — start your first one</span>
                )}
              </Card>
            );
          })}
          {projects.length === 0 && (
            <Card className="academic-card p-8 text-center text-sm text-muted-foreground md:col-span-2">
              You haven't been assigned to any projects yet. Reach out to your instructor.
            </Card>
          )}
        </div>
      </div>
    </AppShell>
  );
};

export default StudentDashboard;
