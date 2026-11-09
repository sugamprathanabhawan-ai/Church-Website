export interface DeviceAuditInfo {
  deviceId: string;
  deviceName: string;
  deviceModel: string;
  platform: string;
  userAgent: string;
  ip?: string;
  screenResolution?: string;
  timestamp: string;
}

export interface SlideItem {
  id: string;
  url: string;
  name: string;
  createdAt: number;
  uploadedBy?: DeviceAuditInfo;
}

export interface SectionItem {
  id: string;
  title: string;
  slides: SlideItem[];
}

export interface CurrentSlideState {
  sectionId: string;
  slideIndex: number;
  globalIndex: number;
}

export interface FlatSlide {
  globalIndex: number;
  sectionId: string;
  sectionTitle: string;
  slideIndex: number;
  slide: SlideItem;
}

export interface NoteItem {
  id: string;
  heading: string;
  headingColor?: string; // default '#ffffff'
  body: string;
  bodyColor?: string; // default '#ffffff'
  bgColor?: string; // default '#000000'
  updatedAt: number;
}

export interface NoticeItem {
  id: string;
  text: string;
  timestamp: number;
  senderName?: string;
}

export interface DirectNotification {
  id: string;
  senderName: string;
  senderRole: 'main' | 'helper' | 'sub' | 'musician';
  recipientRole: 'main' | 'helper' | 'sub' | 'musician' | 'all';
  recipientDeviceId?: string;
  text: string;
  timestamp: number;
}

export interface HelperJoinRequest {
  deviceId: string;
  helperInfo: DeviceAuditInfo;
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: number;
}

export interface RejoinRequest {
  deviceId: string;
  name: string;
  role: 'sub' | 'helper' | 'musician';
  helperInfo?: DeviceAuditInfo;
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: number;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: 'main' | 'helper' | 'sub' | 'musician';
  recipientId?: string; // 'group' or specific deviceId for DM
  recipientName?: string;
  text: string;
  timestamp: number;
  isDirect?: boolean;
}

export interface ChatParticipant {
  deviceId: string;
  name: string;
  role: 'main' | 'helper' | 'sub' | 'musician';
  lastSeen: number;
}

export interface SessionContent {
  sections: SectionItem[];
  device_info?: DeviceAuditInfo;
  main_signature?: string;
  helper_signature?: string | null;
  helper_device_info?: DeviceAuditInfo | null;
  notes?: NoteItem[];
  activeNotice?: NoticeItem | null;
  helper_request?: HelperJoinRequest | null;
  rejoin_requests?: RejoinRequest[];
  kicked_devices?: string[];
  adminPassword?: string;
  creatorToken?: string;
  admin_is_online?: boolean;
  active_admin_signature?: string | null;
  active_admin_device_name?: string;
  admin_heartbeat?: number;
  chat_messages?: ChatMessage[];
  participants?: ChatParticipant[];
}

export interface SessionData {
  code: string;
  created_at: string;
  updated_at: string;
  device_info?: DeviceAuditInfo;
  main_signature?: string;
  helper_signature?: string | null;
  helper_device_info?: DeviceAuditInfo | null;
  content: SessionContent;
  current_slide: CurrentSlideState;
}

export type ConnectionStatus = 'connected' | 'connecting' | 'reconnecting' | 'disconnected' | 'local_demo';

export type UserRole = 'home' | 'main' | 'sub' | 'helper' | 'musician';

