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
};
