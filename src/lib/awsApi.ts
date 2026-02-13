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
};
