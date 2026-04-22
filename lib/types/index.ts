/**
 * Shared TypeScript types for the CometChat QA Framework.
 */

// ── Test Data Types ──

export type MediaType = 'image' | 'video' | 'audio' | 'pdf';
export type GroupType = 'Public' | 'Private' | 'Password';
export type CallType = 'voice' | 'video';
export type MessageStatus = 'sent' | 'delivered' | 'read';
export type UserStatus = 'online' | 'offline';

// ── API Response Types ──

export interface ApiResponse<T = unknown> {
  status: number;
  body: T | null;
}

export interface CometChatUser {
  uid: string;
  name: string;
  avatar?: string;
  status: UserStatus;
  lastActiveAt?: number;
  role?: string;
}

export interface CometChatGroup {
  guid: string;
  name: string;
  type: 'public' | 'private' | 'password';
  membersCount: number;
  owner: string;
  createdAt: number;
}

export interface CometChatMessage {
  id: number;
  sender: { uid: string; name: string };
  receiver: string;
  receiverType: 'user' | 'group';
  type: 'text' | 'image' | 'video' | 'audio' | 'file';
  category: 'message' | 'action' | 'call' | 'custom';
  data: { text?: string; url?: string };
  sentAt: number;
  deliveredAt?: number;
  readAt?: number;
}

export interface CometChatCallLog {
  sessionId: string;
  type: CallType;
  status: 'initiated' | 'ongoing' | 'ended' | 'cancelled' | 'rejected' | 'unanswered';
  initiator: { uid: string; name: string };
  receiver: { uid: string; name: string };
  startedAt?: number;
  endedAt?: number;
}

// ── Bug Report Types ──

export interface BugReport {
  bugId: string;
  tcId: string;
  title: string;
  module: string;
  severity: 'Critical' | 'Major' | 'Minor';
  priority: 'High' | 'Medium' | 'Low';
  reproducibility: 'Always' | 'Intermittent';
  environment: string;
  preconditions: string;
  steps: { title: string; status: string }[];
  expected: string;
  actual: string;
  error: string;
  stack: string;
  screenshotPath?: string;
  videoPath?: string;
}

// ── Test Config Types ──

export interface TestTimeouts {
  pageLoad: number;
  login: number;
  chatOpen: number;
  attachMenu: number;
  fileUpload: number;
  videoUpload: number;
  messageAppear: number;
  videoMessageAppear: number;
  errorOverlay: number;
}

export interface RuntimeError {
  timestamp: string;
  test: string;
  type: 'console-error' | 'page-error' | 'uncaught-exception' | 'network-error' | 'unhandled-rejection';
  message: string;
  stack?: string;
  url?: string;
  source?: string;
}
