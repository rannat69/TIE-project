import { useState } from "react";
import { useApp, newGoal, newLink } from "@/data/store";
import { WeeklyUpdate } from "@/data/types";
import { Avatar } from "@/components/Avatar";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { Plus, Trash2, ExternalLink, MessageSquare, Send, Pencil, Save, X } from "lucide-react";

interface Props {
  update: WeeklyUpdate;
  /** Who is viewing — controls editable affordances. */
  viewer: "instructor" | "student" | "admin";
  defaultOpen?: boolean;
}

export const WeeklyUpdateCard = ({ update, viewer, defaultOpen = false }: Props) => {
  const reviewerEditUpdate = useApp((s) => s.reviewerEditUpdate);
  const resubmitUpdate = useApp((s) => s.resubmitUpdate);
  const setApproval = useApp((s) => s.setApproval);
  const addComment = useApp((s) => s.addComment);
  const currentUserId = useApp((s) => s.currentUserId)!;
  const project = useApp((s) => s.projects.find((p) => p.id === update.projectId));
  const lastEditor = useApp((s) => s.users.find((u) => u.id === update.lastEditedBy));

  const [editing, setEditing] = useState(false);
  const [thisWeek, setThisWeek] = useState(update.thisWeekGoals);
  const [nextWeek, setNextWeek] = useState(update.nextWeekGoals);
  const [blockers, setBlockers] = useState(update.blockers);
  const [progress, setProgress] = useState(update.progress);
  const [links, setLinks] = useState(update.links);
  const [comment, setComment] = useState("");
  const [open, setOpen] = useState(defaultOpen);

  const canEdit = viewer === "instructor" || viewer === "admin";
  const canReview = viewer === "instructor" || viewer === "admin";
  const canTeamEdit =
    viewer === "student" &&
    update.status === "needs_revision" &&
    !!project &&
    project.studentIds.includes(currentUserId);

  const saveEdits = () => {
    reviewerEditUpdate(update.id, { thisWeekGoals: thisWeek, nextWeekGoals: nextWeek, blockers, progress, links });
    setEditing(false);
  };

  const resubmit = () => {
    resubmitUpdate(update.id, { thisWeekGoals: thisWeek, nextWeekGoals: nextWeek, blockers, progress, links });
    setEditing(false);
  };

  const submitComment = () => {
    if (!comment.trim()) return;
    addComment(update.id, currentUserId, comment.trim());
    setComment("");
  };

  return (
    <Card className="academic-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 flex-col items-center justify-center rounded-md bg-secondary text-primary">
            <span className="text-[10px] font-medium uppercase leading-none">Wk</span>
            <span className="font-serif text-base font-semibold leading-none">{update.weekNumber}</span>
          </div>
          <div>
            <div className="text-sm font-semibold text-foreground">
              Week of {format(new Date(update.weekStart), "MMM d, yyyy")}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              Submitted by <Avatar userId={update.authorId} size={18} />
              <span>{format(new Date(update.submittedAt), "MMM d")}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={update.status} />
          <span className="text-xs text-muted-foreground">{open ? "Hide" : "View"}</span>
        </div>
      </button>

      {open && (
        <div className="space-y-6 border-t border-border bg-gradient-subtle px-5 py-5">
          {(update.lastEditedAt || update.revision) && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
              <span>
                Revision {update.revision ?? 1}
                {update.lastEditedAt ? ` · Last edited ${format(new Date(update.lastEditedAt), "MMM d, h:mm a")}` : ""}
              </span>
              {update.lastEditedBy ? (
                <span>
                  Edited by <span className="font-medium text-foreground">{lastEditor?.name ?? "Unknown"}</span>
                </span>
              ) : null}
            </div>
          )}
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h4 className="font-serif text-base font-semibold text-foreground">This week's goals</h4>
                {(canEdit || canTeamEdit) && !editing && (
                  <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
                    <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
                  </Button>
                )}
              </div>
              <ul className="space-y-2">
                {(editing ? thisWeek : update.thisWeekGoals).map((g, idx) => (
                  <li key={g.id} className="rounded-md border border-border bg-card p-3">
                    {editing ? (
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <Textarea
                            value={g.text}
                            onChange={(e) => {
                              const next = [...thisWeek];
                              next[idx] = { ...g, text: e.target.value };
                              setThisWeek(next);
                            }}
                            rows={2}
                            className="text-sm"
                          />
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setThisWeek(thisWeek.filter((_, i) => i !== idx))}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                        <div className="flex items-center gap-3 text-xs">
                          <label className="flex items-center gap-1.5">
                            <Checkbox
                              checked={!!g.achieved}
                              onCheckedChange={(v) => {
                                const next = [...thisWeek];
                                next[idx] = { ...g, achieved: !!v };
                                setThisWeek(next);
                              }}
                            />
                            Achieved
                          </label>
                          {!g.achieved && (
                            <Input
                              placeholder="Reason if not achieved"
                              value={g.reason ?? ""}
                              onChange={(e) => {
                                const next = [...thisWeek];
                                next[idx] = { ...g, reason: e.target.value };
                                setThisWeek(next);
                              }}
                              className="h-8 flex-1 text-xs"
                            />
                          )}
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm text-foreground">{g.text}</p>
                          <span
                            className={
                              g.achieved
                                ? "rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success"
                                : "rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive"
                            }
                          >
                            {g.achieved ? "Achieved" : "Missed"}
                          </span>
                        </div>
                        {!g.achieved && g.reason && (
                          <p className="mt-1.5 text-xs italic text-muted-foreground">Reason: {g.reason}</p>
                        )}
                      </>
                    )}
                  </li>
                ))}
              </ul>
              {editing && (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2"
                  onClick={() => setThisWeek([...thisWeek, newGoal("", false)])}
                >
                  <Plus className="mr-1 h-3.5 w-3.5" /> Add goal
                </Button>
              )}
            </div>

            <div>
              <h4 className="mb-2 font-serif text-base font-semibold text-foreground">Goals for next week</h4>
              <ul className="space-y-2">
                {(editing ? nextWeek : update.nextWeekGoals).map((g, idx) => (
                  <li key={g.id} className="rounded-md border border-border bg-card p-3">
                    {editing ? (
                      <div className="flex gap-2">
                        <Textarea
                          value={g.text}
                          onChange={(e) => {
                            const next = [...nextWeek];
                            next[idx] = { ...g, text: e.target.value };
                            setNextWeek(next);
                          }}
                          rows={2}
                          className="text-sm"
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setNextWeek(nextWeek.filter((_, i) => i !== idx))}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ) : (
                      <p className="text-sm text-foreground">{g.text}</p>
                    )}
                  </li>
                ))}
              </ul>
              {editing && (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2"
                  onClick={() => setNextWeek([...nextWeek, newGoal("")])}
                >
                  <Plus className="mr-1 h-3.5 w-3.5" /> Add goal
                </Button>
              )}
            </div>
          </div>

          {editing && (
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditing(false);
                  setThisWeek(update.thisWeekGoals);
                  setNextWeek(update.nextWeekGoals);
                  setBlockers(update.blockers);
                  setProgress(update.progress);
                  setLinks(update.links);
                }}
              >
                <X className="mr-1.5 h-4 w-4" /> Cancel
              </Button>
              {canEdit ? (
                <Button size="sm" onClick={saveEdits}>
                  <Save className="mr-1.5 h-4 w-4" /> Save changes
                </Button>
              ) : (
                <Button size="sm" onClick={resubmit}>
                  <Send className="mr-1.5 h-4 w-4" /> Resubmit
                </Button>
              )}
            </div>
          )}

          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <Label className="mb-1.5 block text-xs uppercase tracking-wider text-muted-foreground">
                Blockers
              </Label>
              {editing ? (
                <Textarea
                  value={blockers}
                  onChange={(e) => setBlockers(e.target.value)}
                  rows={3}
                  className="text-sm"
                />
              ) : (
                <p className="rounded-md border border-border bg-card p-3 text-sm text-foreground">
                  {update.blockers || <span className="text-muted-foreground">None reported.</span>}
                </p>
              )}
            </div>
            <div>
              <Label className="mb-1.5 block text-xs uppercase tracking-wider text-muted-foreground">
                Project progress
              </Label>
              <div className="rounded-md border border-border bg-card p-3">
                <div className="mb-1.5 flex items-baseline justify-between">
                  <span className="font-serif text-2xl font-semibold text-primary">{(editing ? progress : update.progress)}%</span>
                  <span className="text-xs text-muted-foreground">overall</span>
                </div>
                {editing ? (
                  <>
                    <Slider value={[progress]} onValueChange={(v) => setProgress(v[0])} min={0} max={100} step={1} />
                    <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                      <span>0%</span><span>50%</span><span>100%</span>
                    </div>
                  </>
                ) : (
                  <div className="h-2 overflow-hidden rounded-full bg-secondary">
                    <div className="h-full bg-gradient-hero transition-all" style={{ width: `${update.progress}%` }} />
                  </div>
                )}
              </div>
            </div>
          </div>

          {(editing ? links.length > 0 : update.links.length > 0) && (
            <div>
              <Label className="mb-1.5 block text-xs uppercase tracking-wider text-muted-foreground">
                Linked resources
              </Label>
              <div className="flex flex-wrap gap-2">
                {(editing ? links : update.links).map((l) =>
                  editing ? (
                    <div key={l.id} className="flex w-full gap-2">
                      <Input
                        value={l.label}
                        onChange={(e) => {
                          const next = [...links];
                          const idx = next.findIndex((x) => x.id === l.id);
                          if (idx >= 0) next[idx] = { ...next[idx], label: e.target.value };
                          setLinks(next);
                        }}
                        className="text-sm"
                      />
                      <Input
                        value={l.url}
                        onChange={(e) => {
                          const next = [...links];
                          const idx = next.findIndex((x) => x.id === l.id);
                          if (idx >= 0) next[idx] = { ...next[idx], url: e.target.value };
                          setLinks(next);
                        }}
                        className="text-sm flex-1"
                      />
                      <Button size="icon" variant="ghost" onClick={() => setLinks(links.filter((x) => x.id !== l.id))}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ) : (
                    <a
                      key={l.id}
                      href={l.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-primary hover:border-primary"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      {l.label}
                    </a>
                  ),
                )}
              </div>
              {editing && (
                <Button size="sm" variant="outline" className="mt-2" onClick={() => setLinks([...links, newLink()])}>
                  <Plus className="mr-1 h-3.5 w-3.5" /> Add link
                </Button>
              )}
            </div>
          )}

          <Separator />

          <div>
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
              <MessageSquare className="h-4 w-4 text-primary" />
              Discussion ({update.comments.length})
            </div>
            <div className="space-y-3">
              {update.comments.map((c) => (
                <div key={c.id} className="flex gap-3">
                  <Avatar userId={c.authorId} size={28} />
                  <div className="flex-1 rounded-md border border-border bg-card p-3">
                    <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">
                        <CommenterName id={c.authorId} />
                      </span>
                      <span>·</span>
                      <span>{format(new Date(c.createdAt), "MMM d, h:mm a")}</span>
                    </div>
                    <p className="text-sm text-foreground">{c.text}</p>
                  </div>
                </div>
              ))}
              {update.comments.length === 0 && (
                <p className="text-xs text-muted-foreground">No comments yet.</p>
              )}
            </div>

            <div className="mt-4 flex gap-2">
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Add a comment…"
                rows={2}
                className="text-sm"
              />
              <Button size="sm" onClick={submitComment} className="self-end">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {canReview && (
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4">
              <span className="mr-auto text-xs text-muted-foreground">Set review status:</span>
              {update.status === "approved" ? (
                <span className="text-xs text-muted-foreground">
                  Locked after approval.
                </span>
              ) : null}
              <Button
                size="sm"
                variant={update.status === "needs_revision" ? "default" : "outline"}
                onClick={() => setApproval(update.id, "needs_revision")}
                disabled={update.status === "approved"}
                className={
                  update.status === "needs_revision" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""
                }
              >
                Needs revision
              </Button>
              <Button
                size="sm"
                variant={update.status === "pending" ? "default" : "outline"}
                onClick={() => setApproval(update.id, "pending")}
                disabled={update.status === "approved"}
              >
                Pending
              </Button>
              <Button
                size="sm"
                onClick={() => setApproval(update.id, "approved")}
                disabled={update.status === "approved"}
                className={
                  update.status === "approved"
                    ? "bg-success text-success-foreground hover:bg-success/90"
                    : "bg-success/90 text-success-foreground hover:bg-success"
                }
              >
                Approve
              </Button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
};

const CommenterName = ({ id }: { id: string }) => {
  const user = useApp((s) => s.users.find((u) => u.id === id));
  return <>{user?.name ?? "Unknown"}</>;
};

// re-export helper used by submit form
export { newGoal, newLink };