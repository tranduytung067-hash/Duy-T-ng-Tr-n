export type AppNoticeType = 'success' | 'error' | 'warning' | 'info';

export interface AppNotice {
  id: number;
  type: AppNoticeType;
  message: string;
}

export type ToastItem = AppNotice;

type NoticeListener = (notice: AppNotice) => void;

const listeners = new Set<NoticeListener>();
let nextId = 1;

function emitNotice(type: AppNoticeType, message: string) {
  const notice: AppNotice = {
    id: nextId++,
    type,
    message,
  };
  listeners.forEach((listener) => listener(notice));
}

export const notify = {
  success: (message: string) => emitNotice('success', message),
  error: (message: string) => emitNotice('error', message),
  warning: (message: string) => emitNotice('warning', message),
  info: (message: string) => emitNotice('info', message),
  subscribe: (listener: NoticeListener) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
