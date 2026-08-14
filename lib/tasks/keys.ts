export const taskKeys = {
  all: ['tasks'] as const,
  member: (memberId: number, status?: string) =>
    ['tasks', 'member', memberId, status ?? '*'] as const,
  detail: (id: number) => ['tasks', 'detail', id] as const,
  broadcastHistory: () => ['tasks', 'broadcast-history'] as const,
};

export const templateKeys = {
  all: ['templates'] as const,
  list: (activeOnly: boolean) => ['templates', 'list', activeOnly] as const,
  detail: (id: number) => ['templates', 'detail', id] as const,
};

export const activityKeys = {
  member: (memberId: number) => ['activity', 'member', memberId] as const,
};

export const memberKeys = {
  all: ['members'] as const,
  detail: (id: number) => ['members', id] as const,
  me: () => ['members', 'me'] as const,
};
