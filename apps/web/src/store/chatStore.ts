import { create } from "zustand";
import { v4 as uuid } from "uuid";

interface ChatState {
  sessionId: string;
  activeStream: EventSource | null;
  streamingText: string;
  isStreaming: boolean;
  setActiveStream: (es: EventSource | null) => void;
  appendStreamingText: (chunk: string) => void;
  resetStreaming: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  sessionId: uuid(),
  activeStream: null,
  streamingText: "",
  isStreaming: false,
  setActiveStream: (es) => set({ activeStream: es, isStreaming: !!es }),
  appendStreamingText: (chunk) =>
    set((s) => ({ streamingText: s.streamingText + chunk })),
  resetStreaming: () =>
    set({ activeStream: null, streamingText: "", isStreaming: false }),
}));
