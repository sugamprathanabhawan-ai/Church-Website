export interface SlideItem {
  id: string;
  url: string;
  name: string;
  createdAt: number;
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
  content: {
    sections: SectionItem[];
  };
  current_slide: CurrentSlideState;
}

export type ConnectionStatus = 'connected' | 'reconnecting' | 'disconnected' | 'local_demo';

export type UserRole = 'home' | 'main' | 'sub' | 'helper';
