// Worker と SPA で共有する API の型と入力制限

export const LIMITS = {
  title: 100,
  description: 2000,
  nickname: 30,
  topic: 500,
} as const;

export const DEFAULT_NICKNAME = "名無しさん";

export type ProjectStatus =
  | "open" // お題募集中
  | "assigned" // 割当済み
  | "insufficient"; // 締切時点で参加者が2人未満のため割当なし

export interface MeResponse {
  user: { id: string } | null;
  hasTransferToken: boolean;
}

export interface ProjectInput {
  title: string;
  description: string;
  topicDeadline: number;
  workDeadline: number | null;
}

export interface EntryInput {
  nickname: string;
  topic: string;
}

export interface ProjectView {
  id: string;
  title: string;
  description: string;
  topicDeadline: number;
  workDeadline: number | null;
  status: ProjectStatus;
  isOwner: boolean;
  /** 参加者のニックネーム一覧。主催者以外には null */
  participants: string[] | null;
  myEntry: EntryInput | null;
  myAssignment: { topic: string } | null;
  now: number;
}

export interface ProjectSummary {
  id: string;
  title: string;
  topicDeadline: number;
  workDeadline: number | null;
  isOwner: boolean;
  joined: boolean;
}

export interface AssignmentRow {
  nickname: string;
  topic: string;
  topicAuthor: string;
}
