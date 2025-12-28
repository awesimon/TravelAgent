export interface Message {
  role: 'user' | 'model';
  text: string;
  isError?: boolean;
  groundingChunks?: GroundingChunk[];
}

export interface GroundingChunk {
  web?: {
    uri: string;
    title: string;
  };
  maps?: {
    uri: string;
    title: string;
    placeAnswerSources?: {
        reviewSnippets?: {
            reviewText: string;
        }[]
    }
  };
}

export interface Coordinates {
  lat: number;
  lng: number;
}

export type PlaceType = 'attraction' | 'hotel' | 'food' | 'transit' | 'landmark';

export interface Place {
  name: string;
  lat: number;
  lng: number;
  description: string;
  zoom?: number; 
  day?: number; // The day number this place belongs to
  order?: number; // The sequence order within the day (1, 2, 3...)
  type?: PlaceType; // The category of the place
}

export enum ViewMode {
  FULL_MAP = 'FULL_MAP',
  SPLIT = 'SPLIT',
  MOBILE_CHAT = 'MOBILE_CHAT'
}