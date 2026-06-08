const BASE = '/api';

function getToken() { return localStorage.getItem('token'); }

async function req(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(getToken() ? { Authorization: 'Bearer ' + getToken() } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'שגיאה בשרת');
  return data;
}

export const api = {
  login: (email, password) => req('POST', '/auth/login', { email, password }),
  me: () => req('GET', '/auth/me'),
  dashboard: () => req('GET', '/dashboard'),
  contractors: { list: () => req('GET', '/contractors'), create: d => req('POST', '/contractors', d), update: (id, d) => req('PUT', `/contractors/${id}`, d), del: id => req('DELETE', `/contractors/${id}`) },
  budget: { get: () => req('GET', '/budget'), create: d => req('POST', '/budget', d), update: (id, d) => req('PUT', `/budget/${id}`, d), del: id => req('DELETE', `/budget/${id}`) },
  payments: { list: () => req('GET', '/payments'), update: (id, d) => req('PUT', `/payments/${id}`, d) },
  units: () => req('GET', '/units'),
  decisions: { list: () => req('GET', '/decisions'), create: d => req('POST', '/decisions', d), update: (id, d) => req('PUT', `/decisions/${id}`, d), del: id => req('DELETE', `/decisions/${id}`) },
  updates: { list: () => req('GET', '/updates'), create: d => req('POST', '/updates', d), update: (id, d) => req('PUT', `/updates/${id}`, d), del: id => req('DELETE', `/updates/${id}`) },
  complaints: { list: () => req('GET', '/complaints'), create: d => req('POST', '/complaints', d), update: (id, d) => req('PUT', `/complaints/${id}`, d), del: id => req('DELETE', `/complaints/${id}`) },
};
