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

export interface SessionData {
  code: string;
  created_at: string;
  updated_at: string;
  device_info?: DeviceAuditInfo;
  content: {
    sections: SectionItem[];
    device_info?: DeviceAuditInfo;
  };
  current_slide: CurrentSlideState;
}

export type ConnectionStatus = 'connected' | 'reconnecting' | 'disconnected' | 'local_demo';

export type UserRole = 'home' | 'main' | 'sub' | 'helper';

