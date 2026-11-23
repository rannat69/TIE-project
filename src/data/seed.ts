import { Course, Project, User, WeeklyUpdate } from "./types";

export const seedUsers: User[] = [
  { id: "u-admin", name: "Dr. Eliza Hart", email: "admin@uni.edu", role: "admin", avatarColor: "217 60% 22%" },
  { id: "u-i1", name: "Prof. Marcus Bell", email: "m.bell@uni.edu", role: "instructor", avatarColor: "188 70% 38%" },
  { id: "u-i2", name: "Prof. Aisha Khan", email: "a.khan@uni.edu", role: "instructor", avatarColor: "262 55% 45%" },
  { id: "u-a1", name: "Lilly Tan", email: "lilly.tan@uni.edu", role: "instructor", avatarColor: "200 55% 34%" },
  { id: "u-s1", name: "Liam Chen", email: "liam@uni.edu", role: "student", avatarColor: "152 55% 36%" },
  { id: "u-s2", name: "Maya Okafor", email: "maya@uni.edu", role: "student", avatarColor: "35 90% 48%" },
  { id: "u-s3", name: "Noah Patel", email: "noah@uni.edu", role: "student", avatarColor: "0 70% 48%" },
  { id: "u-s4", name: "Sofia Reyes", email: "sofia@uni.edu", role: "student", avatarColor: "200 70% 40%" },
  { id: "u-s5", name: "Owen Schmidt", email: "owen@uni.edu", role: "student", avatarColor: "320 50% 45%" },
];

export const seedCourses: Course[] = [
  {
    id: "c1",
    code: "CS-490",
    name: "Senior Capstone",
    term: "Spring 2026",
    instructorIds: ["u-i1"],
    studentIds: ["u-s1", "u-s2", "u-s3", "u-s4", "u-s5"],
  },
  {
    id: "c2",
    code: "DSGN-310",
    name: "Interaction Design Studio",
    term: "Spring 2026",
    instructorIds: ["u-i2", "u-i1"],
    studentIds: ["u-s2", "u-s4"],
  },
  {
    id: "c3",
    code: "ENGR-450",
    name: "Engineering Innovation",
    term: "Spring 2026",
    instructorIds: ["u-i2"],
    studentIds: ["u-s1", "u-s5"],
  },
];

export const seedProjects: Project[] = [
  {
    id: "p1",
    courseId: "c1",
    name: "Atlas — Campus Navigation",
    description: "AR-assisted indoor wayfinding for accessibility.",
    studentIds: ["u-s1", "u-s2", "u-s3"],
    assignedAdvisorIds: ["u-a1"],
    progress: 62,
  },
  {
    id: "p2",
    courseId: "c1",
    name: "Beacon — Mental Health Companion",
    description: "Conversational journaling app with mood analytics.",
    studentIds: ["u-s4", "u-s5"],
    progress: 45,
  },
  {
    id: "p3",
    courseId: "c2",
    name: "Loom — Inclusive Onboarding",
    description: "Onboarding patterns for users with cognitive differences.",
    studentIds: ["u-s2", "u-s4"],
    progress: 30,
  },
  {
    id: "p4",
    courseId: "c3",
    name: "Tidewater Sensor Mesh",
    description: "Low-cost coastal water-quality monitoring network.",
    studentIds: ["u-s1", "u-s5"],
    progress: 18,
  },
];

const today = new Date();
const weekStart = (offset: number) => {
  const d = new Date(today);
  d.setDate(d.getDate() - offset * 7);
  d.setHours(9, 0, 0, 0);
  return d.toISOString();
};

export const seedUpdates: WeeklyUpdate[] = [
  {
    id: "w1",
    projectId: "p1",
    weekNumber: 5,
    weekStart: weekStart(2),
    authorId: "u-s1",
    thisWeekGoals: [
      { id: "g1", text: "Finalize indoor map data model", achieved: true },
      { id: "g2", text: "Prototype voice navigation", achieved: false, reason: "Speech SDK quota exhausted; awaiting upgrade." },
    ],
    nextWeekGoals: [
      { id: "g3", text: "Run accessibility usability test (n=4)", achieved: null },
      { id: "g4", text: "Migrate to new Speech SDK tier", achieved: null },
    ],
    blockers: "Procurement delay on the upgraded Speech SDK license.",
    progress: 50,
    links: [
      { id: "l1", label: "Figma — Wayfinding flows", url: "https://figma.com/example" },
      { id: "l2", label: "GitHub PR #42", url: "https://github.com/example/atlas/pull/42" },
    ],
    status: "approved",
    comments: [
      { id: "c1", authorId: "u-i1", text: "Strong week. Ping me if procurement stalls past Friday.", createdAt: weekStart(2) },
    ],
    submittedAt: weekStart(2),
  },
  {
    id: "w2",
    projectId: "p1",
    weekNumber: 6,
    weekStart: weekStart(1),
    authorId: "u-s2",
    thisWeekGoals: [
      { id: "g5", text: "Run usability test with 4 participants", achieved: true },
      { id: "g6", text: "Migrate to Speech SDK Pro", achieved: true },
      { id: "g7", text: "Draft midterm presentation", achieved: false, reason: "Test results took longer to synthesize than planned." },
    ],
    nextWeekGoals: [
      { id: "g8", text: "Finish midterm deck and rehearse", achieved: null },
      { id: "g9", text: "Iterate on voice prompts based on test feedback", achieved: null },
    ],
    blockers: "None this week.",
    progress: 62,
    links: [
      { id: "l3", label: "Usability test report", url: "https://docs.google.com/example" },
    ],
    status: "approved",
    comments: [],
    submittedAt: weekStart(1),
  },
  {
    id: "w3",
    projectId: "p2",
    weekNumber: 6,
    weekStart: weekStart(1),
    authorId: "u-s4",
    thisWeekGoals: [
      { id: "g10", text: "Sentiment analysis spike", achieved: true },
      { id: "g11", text: "First-pass journaling UI", achieved: false, reason: "Re-scoping after user interviews." },
    ],
    nextWeekGoals: [
      { id: "g12", text: "Lock journaling UI direction", achieved: null },
    ],
    blockers: "Need clearer guidance on clinical-language guardrails.",
    progress: 45,
    links: [],
    status: "needs_revision",
    comments: [
      { id: "c2", authorId: "u-i1", text: "Please add measurable acceptance criteria for the UI lock-in next week.", createdAt: weekStart(1) },
    ],
    submittedAt: weekStart(1),
  },
];
