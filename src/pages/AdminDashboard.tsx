import { useState } from "react";
import AppShell from "@/components/AppShell";
import { useApp } from "@/data/store";
import { Avatar } from "@/components/Avatar";
import { SegmentedTabs } from "@/components/SegmentedTabs";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { LayoutDashboard, Users as UsersIcon, BookOpen, FolderKanban, Plus, Trash2 } from "lucide-react";
import { Role } from "@/data/types";
import { toast } from "sonner";

type AdminTab = "users" | "courses" | "projects";

const Stat = ({ label, value, hint }: { label: string; value: string | number; hint?: string }) => (
  <Card className="academic-card p-5">
    <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
    <div className="mt-1 font-serif text-3xl font-semibold text-primary">{value}</div>
    {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
  </Card>
);

const AdminDashboard = () => {
  const {
    users, courses, projects, updates,
    addUser, deleteUser, updateUserRole,
    addCourse, assignInstructor, removeInstructor,
    addStudentToCourse, removeStudentFromCourse,
    addProject, assignStudentToProject, removeStudentFromProject,
  } = useApp();

  const nav = [{ to: "/admin", label: "Overview", icon: <LayoutDashboard className="h-4 w-4" /> }];
  const [activeTab, setActiveTab] = useState<AdminTab>("users");

  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<Role>("student");
  const [cCode, setCCode] = useState("");
  const [cName, setCName] = useState("");
  const [cTerm, setCTerm] = useState("Spring 2026");
  const [pName, setPName] = useState("");
  const [pDesc, setPDesc] = useState("");
  const [pCourse, setPCourse] = useState("");

  const instructors = users.filter((u) => u.role === "instructor");
  const students = users.filter((u) => u.role === "student");

  return (
    <AppShell roleLabel="Admin" nav={nav}>
      <div className="container mx-auto max-w-7xl px-6 py-8">
        <div className="mb-8">
          <h1 className="font-serif text-3xl font-semibold text-foreground">Administrator overview</h1>
          <p className="text-sm text-muted-foreground">Manage users, courses, and project teams across the program.</p>
        </div>

        <div className="mb-8 grid gap-4 md:grid-cols-4">
          <Stat label="Users" value={users.length} hint={`${instructors.length} instructors · ${students.length} students`} />
          <Stat label="Active courses" value={courses.length} />
          <Stat label="Projects" value={projects.length} />
          <Stat label="Weekly updates" value={updates.length} hint={`${updates.filter((u) => u.status === "pending").length} pending review`} />
        </div>

        <SegmentedTabs<AdminTab>
          value={activeTab}
          onChange={setActiveTab}
          tabs={[
            { value: "users", label: <><UsersIcon className="mr-1.5 h-4 w-4" />Users</> },
            { value: "courses", label: <><BookOpen className="mr-1.5 h-4 w-4" />Courses</> },
            { value: "projects", label: <><FolderKanban className="mr-1.5 h-4 w-4" />Projects & teams</> },
          ]}
        />

        {activeTab === "users" && (
          <Card className="academic-card mt-5 p-6">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="font-serif text-xl font-semibold text-foreground">Users & roles</h2>
                <p className="text-sm text-muted-foreground">Add new accounts and assign roles.</p>
              </div>
              <Dialog>
                <DialogTrigger asChild>
                  <Button><Plus className="mr-1.5 h-4 w-4" />Add user</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Add new user</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div><Label>Full name</Label><Input value={newName} onChange={(e) => setNewName(e.target.value)} /></div>
                    <div><Label>Email</Label><Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} /></div>
                    <div>
                      <Label>Role</Label>
                      <Select value={newRole} onValueChange={(v) => setNewRole(v as Role)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Administrator</SelectItem>
                          <SelectItem value="instructor">Instructor</SelectItem>
                          <SelectItem value="student">Student</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      onClick={async () => {
                        if (!newName.trim() || !newEmail.trim()) {
                          toast.error("Name and email are required.");
                          return;
                        }
                        try {
                          await addUser({ name: newName, email: newEmail, role: newRole });
                          setNewName("");
                          setNewEmail("");
                          setNewRole("student");
                          toast.success("User added.");
                        } catch (e) {
                          const msg = e instanceof Error ? e.message : "Unknown error";
                          toast.error(`Could not add user: ${msg}`);
                        }
                      }}
                    >
                      Create user
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <div className="overflow-hidden rounded-md border border-border">
              <table className="w-full text-sm">
                <thead className="bg-secondary text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 text-left">User</th>
                    <th className="px-4 py-2.5 text-left">Email</th>
                    <th className="px-4 py-2.5 text-left">Role</th>
                    <th className="px-4 py-2.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-t border-border">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar userId={u.id} size={32} />
                          <span className="font-medium text-foreground">{u.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                      <td className="px-4 py-3">
                        <Select value={u.role} onValueChange={(v) => updateUserRole(u.id, v as Role)}>
                          <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Administrator</SelectItem>
                            <SelectItem value="instructor">Instructor</SelectItem>
                            <SelectItem value="student">Student</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button size="icon" variant="ghost" onClick={() => deleteUser(u.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {activeTab === "courses" && (
          <div className="mt-5 space-y-5">
            <Card className="academic-card p-6">
              <h2 className="mb-1 font-serif text-xl font-semibold text-foreground">Create course</h2>
              <div className="mt-3 grid gap-3 md:grid-cols-4">
                <div><Label>Code</Label><Input value={cCode} onChange={(e) => setCCode(e.target.value)} placeholder="CS-490" /></div>
                <div className="md:col-span-2"><Label>Name</Label><Input value={cName} onChange={(e) => setCName(e.target.value)} placeholder="Senior Capstone" /></div>
                <div><Label>Term</Label><Input value={cTerm} onChange={(e) => setCTerm(e.target.value)} /></div>
              </div>
              <Button className="mt-4" onClick={() => {
                if (!cCode.trim() || !cName.trim()) { toast.error("Code and name required."); return; }
                addCourse({ code: cCode, name: cName, term: cTerm, instructorIds: [] });
                setCCode(""); setCName("");
                toast.success("Course created.");
              }}><Plus className="mr-1.5 h-4 w-4" />Add course</Button>
            </Card>

            <div className="grid gap-4 lg:grid-cols-2">
              {courses.map((c) => (
                <Card key={c.id} className="academic-card p-5">
                  <Badge variant="secondary" className="mb-2">{c.code}</Badge>
                  <h3 className="font-serif text-lg font-semibold text-foreground">{c.name}</h3>
                  <p className="text-xs text-muted-foreground">{c.term}</p>
                  <div className="mb-2 mt-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">Instructors</div>
                  <div className="mb-3 flex flex-wrap gap-2">
                    {c.instructorIds.map((iid) => {
                      const instructor = users.find((u) => u.id === iid);
                      if (!instructor) return null;
                      return (
                        <span key={iid} className="inline-flex items-center gap-2 rounded-full border border-border bg-card py-1 pl-1 pr-2 text-xs">
                          <Avatar userId={iid} size={20} />
                          {instructor.name}
                          <button onClick={() => removeInstructor(c.id, iid)} className="ml-1 text-muted-foreground hover:text-destructive">×</button>
                        </span>
                      );
                    })}
                    {c.instructorIds.length === 0 && <span className="text-xs text-muted-foreground">No instructors yet.</span>}
                  </div>
                  <Select onValueChange={(v) => assignInstructor(c.id, v)}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Assign instructor…" /></SelectTrigger>
                    <SelectContent>
                      {instructors.filter((i) => !c.instructorIds.includes(i.id)).map((i) => (
                        <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <div className="mb-2 mt-5 text-xs font-medium uppercase tracking-wider text-muted-foreground">Students</div>
                  <div className="mb-3 flex flex-wrap gap-2">
                    {((c.studentIds ?? []) as string[]).map((sid) => {
                      const student = users.find((u) => u.id === sid);
                      if (!student) return null;
                      return (
                        <span key={sid} className="inline-flex items-center gap-2 rounded-full border border-border bg-card py-1 pl-1 pr-2 text-xs">
                          <Avatar userId={sid} size={20} />
                          {student.name}
                          <button
                            onClick={async () => {
                              try {
                                await removeStudentFromCourse(c.id, sid);
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
                    {(c.studentIds?.length ?? 0) === 0 && <span className="text-xs text-muted-foreground">No students yet.</span>}
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
                    <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Add student to course…" /></SelectTrigger>
                    <SelectContent>
                      {students.filter((s) => !((c.studentIds ?? []) as string[]).includes(s.id)).map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Card>
              ))}
            </div>
          </div>
        )}

        {activeTab === "projects" && (
          <div className="mt-5 space-y-5">
            <Card className="academic-card p-6">
              <h2 className="mb-1 font-serif text-xl font-semibold text-foreground">Create project</h2>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div><Label>Project name</Label><Input value={pName} onChange={(e) => setPName(e.target.value)} /></div>
                <div>
                  <Label>Course</Label>
                  <Select value={pCourse} onValueChange={setPCourse}>
                    <SelectTrigger><SelectValue placeholder="Select course" /></SelectTrigger>
                    <SelectContent>
                      {courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.code} — {c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2"><Label>Description</Label><Textarea value={pDesc} onChange={(e) => setPDesc(e.target.value)} rows={2} /></div>
              </div>
              <Button className="mt-4" onClick={() => {
                if (!pName.trim() || !pCourse) { toast.error("Name and course required."); return; }
                addProject({ name: pName, description: pDesc, courseId: pCourse, studentIds: [] });
                setPName(""); setPDesc(""); setPCourse("");
                toast.success("Project created.");
              }}><Plus className="mr-1.5 h-4 w-4" />Add project</Button>
            </Card>

            <div className="grid gap-4 lg:grid-cols-2">
              {projects.map((p) => {
                const course = courses.find((c) => c.id === p.courseId);
                return (
                  <Card key={p.id} className="academic-card p-5">
                    <Badge variant="secondary" className="mb-2">{course?.code}</Badge>
                    <h3 className="font-serif text-lg font-semibold text-foreground">{p.name}</h3>
                    <p className="text-sm text-muted-foreground">{p.description}</p>
                    <div className="mb-2 mt-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">Team</div>
                    <div className="mb-3 flex flex-wrap gap-2">
                      {p.studentIds.map((sid) => {
                        const student = users.find((u) => u.id === sid);
                        if (!student) return null;
                        return (
                          <span key={sid} className="inline-flex items-center gap-2 rounded-full border border-border bg-card py-1 pl-1 pr-2 text-xs">
                            <Avatar userId={sid} size={20} />
                            {student.name}
                            <button onClick={() => removeStudentFromProject(p.id, sid)} className="ml-1 text-muted-foreground hover:text-destructive">×</button>
                          </span>
                        );
                      })}
                      {p.studentIds.length === 0 && <span className="text-xs text-muted-foreground">No students yet.</span>}
                    </div>
                    <Select onValueChange={(v) => assignStudentToProject(p.id, v)}>
                      <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Add student to team…" /></SelectTrigger>
                      <SelectContent>
                        {students.filter((s) => !p.studentIds.includes(s.id)).map((s) => (
                          <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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

export default AdminDashboard;