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

export interface HelperJoinRequest {
  deviceId: string;
  helperInfo: DeviceAuditInfo;
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: number;
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
  adminPassword?: string;
  creatorToken?: string;
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

export type UserRole = 'home' | 'main' | 'sub' | 'helper';

