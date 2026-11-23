export type Role = "admin" | "instructor" | "student";

export interface User {
  id: string;
  name: string;
  email: string;
  /** Optional profile details collected during sign-up. */
  hkustEmail?: string | null;
  programme?: string | null;
  role: Role;
  avatarColor: string;
}

export interface Course {
  id: string;
  code: string;
  name: string;
  term: string;
  instructorIds: string[];
  /** Optional for backward compatibility; treat missing as empty roster. */
  studentIds?: string[];
}

export interface Project {
  id: string;
  courseId: string;
  name: string;
  description: string;
  studentIds: string[];
  /** Project-scoped support staff (instructor accounts; do not imply course-wide access). */
  assignedAdvisorIds?: string[];
  progress: number; // 0-100
}

export type ApprovalStatus = "pending" | "approved" | "needs_revision";

export type PurchaseRequestStatus = "pending" | "approved" | "rejected";

/** Meeting thread key: course instructor or project `assignedAdvisorIds` user id. */
export type AdvisorThreadId = string;

export interface MeetingItem {
  id: string;
  text: string;
  createdAt: string;
  createdBy: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface MeetingComment {
  id: string;
  authorId: string;
  text: string;
  createdAt: string;
}

export type MeetingStatus = "draft" | "held";

export interface Meeting {
  id: string;
  projectId: string;
  /** Meeting thread owner (instructor / project support id). */
  advisorId: AdvisorThreadId;
  /** Backward compatibility for older docs created before advisorId existed. */
  advisorTrack?: string;
  sequence: number;
  status: MeetingStatus;
  inheritedFromMeetingId?: string | null;
  agendaItems: MeetingItem[];
  actionItems: MeetingItem[];
  comments?: MeetingComment[];
  /** Proposed meeting start (ISO). Optional until the team sets it. */
  proposedAt?: string | null;
  createdAt: string;
  createdBy: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface WeeklyGoal {
  id: string;
  text: string;
  achieved: boolean | null; // null for next-week goals
  reason?: string;
}

export interface Comment {
  id: string;
  authorId: string;
  text: string;
  createdAt: string;
}

export interface ResourceLink {
  id: string;
  label: string;
  url: string;
}

export type WeeklyUpdateEventType =
  | "submitted"
  | "edited"
  | "resubmitted"
  | "status_changed"
  | "comment_added";

export interface WeeklyUpdateEvent {
  id: string;
  type: WeeklyUpdateEventType;
  at: string; // ISO
  byUserId: string;
  note?: string;

  // optional metadata
  fields?: ("thisWeekGoals" | "nextWeekGoals" | "blockers" | "progress" | "links")[];
  statusFrom?: ApprovalStatus;
  statusTo?: ApprovalStatus;
  commentId?: string;
}

export interface WeeklyUpdate {
  id: string;
  projectId: string;
  weekNumber: number;
  weekStart: string; // ISO
  authorId: string;
  revision: number;
  lastEditedAt?: string;
  lastEditedBy?: string;
  audit: WeeklyUpdateEvent[];
  thisWeekGoals: WeeklyGoal[];
  nextWeekGoals: WeeklyGoal[];
  blockers: string;
  progress: number;
  links: ResourceLink[];
  status: ApprovalStatus;
  comments: Comment[];
  submittedAt: string;
}

export interface PurchaseRequest {
  id: string;
  projectId: string;
  requesterId: string;
  item: string;
  quantity: number;
  cost: number; // per-item or total; UI treats as total
  currency: "HKD";
  link: string;
  justification: string;
  status: PurchaseRequestStatus;
  createdAt: string;
  reviewedAt?: string;
  reviewerId?: string;
  reviewNote?: string;
}
