const API_BASE = 'https://vr21smw04e.execute-api.us-east-2.amazonaws.com';

export const awsApi = {
  getUser: async (email: string) => {
    const res = await fetch(`${API_BASE}/users?email=${email}`);
    return res.json();
  },

  createUser: async (user: { id: string; email: string; name: string }) => {
    const res = await fetch(`${API_BASE}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user),
    });
    return res.json();
  },

  connectEmail: async (userId: string, provider: 'google' | 'microsoft') => {
    const res = await fetch(`${API_BASE}/connect-email?user_id=${userId}&provider=${provider}`);
    const data = await res.json();
    return data;
  },

  getAccounts: async (userId: string) => {
    const res = await fetch(`${API_BASE}/accounts?user_id=${userId}`);
    return res.json();
  },

  getEmails: async (userId: string, page = 1, limit = 25, filter = 'inbox', search = '') => {
    const params = new URLSearchParams({ user_id: userId, page: String(page), limit: String(limit), filter, search });
    const res = await fetch(`${API_BASE}/emails?${params}`);
    return res.json();
  },

  syncEmails: async (userId: string) => {
    const res = await fetch(`${API_BASE}/sync-emails?user_id=${userId}`);
    return res.json();
  },

  updateEmail: async (emailId: string, action: string) => {
    const res = await fetch(`${API_BASE}/emails`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email_id: emailId, action }),
    });
    return res.json();
  },

  getEmail: async (emailId: string) => {
    const res = await fetch(`${API_BASE}/email?email_id=${emailId}`);
    return res.json();
  },

  storeAnalysis: async (analysis: any) => {
    const res = await fetch(`${API_BASE}/analysis`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(analysis),
    });
    return res.json();
  },

  getAnalysis: async (emailId: string) => {
    const res = await fetch(`${API_BASE}/analysis?email_id=${emailId}`);
    if (res.status === 404) return null;
    return res.json();
  },

  getAllAnalyses: async (userId: string) => {
    const res = await fetch(`${API_BASE}/analysis?user_id=${userId}`);
    return res.json();
  },

  sendEmail: async (params: {
    user_id: string;
    account_id: string;
    to: { email: string; name?: string }[];
    cc?: { email: string; name?: string }[];
    bcc?: { email: string; name?: string }[];
    subject: string;
    body: string;
    reply_to_message_id?: string;
  }) => {
    const res = await fetch(`${API_BASE}/send-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) throw new Error('Failed to send email');
    return res.json();
  },

  getBriefings: async (userId: string, date?: string) => {
    const params = new URLSearchParams({ user_id: userId });
    if (date) params.append('date', date);
    const res = await fetch(`${API_BASE}/briefings?${params}`);
    if (!res.ok) throw new Error('Failed to fetch briefings');
    const data = await res.json();
    return data.briefings;
  },

  storeBriefing: async (params: {
    user_id: string;
    date: string;
    type: string;
    content: any;
    urgent_count: number;
    pending_count: number;
  }) => {
    const res = await fetch(`${API_BASE}/briefings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) throw new Error('Failed to store briefing');
    return res.json();
  },

  // Tasks
  getTasks: async (userId: string, status?: string) => {
    const params = new URLSearchParams({ user_id: userId });
    if (status) params.append('status', status);
    const res = await fetch(`${API_BASE}/tasks?${params}`);
    return res.json();
  },

  createTask: async (params: {
    user_id: string;
    title: string;
    description?: string;
    email_id?: string;
    due_date?: string;
    priority?: string;
  }) => {
    const res = await fetch(`${API_BASE}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) throw new Error('Failed to create task');
    return res.json();
  },

  updateTask: async (params: {
    task_id: string;
    user_id: string;
    title?: string;
    description?: string;
    due_date?: string;
    priority?: string;
    status?: string;
  }) => {
    const res = await fetch(`${API_BASE}/tasks`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) throw new Error('Failed to update task');
    return res.json();
  },

  deleteTask: async (taskId: string, userId: string) => {
    const res = await fetch(`${API_BASE}/tasks?task_id=${taskId}&user_id=${userId}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete task');
    return res.json();
  },

  // Follow-ups
  getFollowups: async (userId: string, status?: string) => {
    const params = new URLSearchParams({ user_id: userId });
    if (status) params.append('status', status);
    const res = await fetch(`${API_BASE}/followups?${params}`);
    return res.json();
  },

  createFollowup: async (params: {
    user_id: string;
    email_id?: string;
    type: string;
    due_date: string;
    notes?: string;
  }) => {
    const res = await fetch(`${API_BASE}/followups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) throw new Error('Failed to create follow-up');
    return res.json();
  },

  updateFollowup: async (params: {
    followup_id: string;
    user_id: string;
    type?: string;
    due_date?: string;
    status?: string;
    notes?: string;
  }) => {
    const res = await fetch(`${API_BASE}/followups`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) throw new Error('Failed to update follow-up');
    return res.json();
  },

  deleteFollowup: async (followupId: string, userId: string) => {
    const res = await fetch(`${API_BASE}/followups?followup_id=${followupId}&user_id=${userId}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete follow-up');
    return res.json();
  },

  // Calendar
  getCalendarEvents: async (userId: string, daysAhead = 7, daysBehind = 1) => {
    const params = new URLSearchParams({
      user_id: userId,
      days_ahead: String(daysAhead),
      days_behind: String(daysBehind),
    });
    const res = await fetch(`${API_BASE}/calendar?${params}`);
    if (!res.ok) throw new Error('Failed to fetch calendar events');
    return res.json();
  },

  createCalendarEvent: async (params: {
    user_id: string;
    title: string;
    description?: string;
    location?: string;
    start_time: string;
    end_time: string;
    all_day?: boolean;
    participants?: { email: string }[];
  }) => {
    const res = await fetch(`${API_BASE}/calendar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) throw new Error('Failed to create event');
    return res.json();
  },
};
