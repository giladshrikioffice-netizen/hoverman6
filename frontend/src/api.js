const BASE = (import.meta.env.VITE_API_URL || '') + '/api';

function getToken() { return localStorage.getItem('token'); }
function getBid() { return localStorage.getItem('building_id') || ''; }

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

// Append building_id to GET requests
function bq(path) {
  const bid = getBid();
  return path + (bid ? (path.includes('?') ? '&' : '?') + 'building_id=' + bid : '');
}

export const api = {
  login: (email, password) => req('POST', '/auth/login', { email, password }),
  me: () => req('GET', '/auth/me'),
  auth: {
    changePassword: (old_password, new_password) => req('PUT', '/auth/change-password', { old_password, new_password }),
  },

  buildings: {
    list: () => req('GET', '/buildings'),
    create: d => req('POST', '/buildings', d),
    update: (id, d) => req('PUT', `/buildings/${id}`, d),
    del: id => req('DELETE', `/buildings/${id}`),
  },

  dashboard: () => req('GET', bq('/dashboard')),

  contractors: {
    list: () => req('GET', bq('/contractors')),
    create: d => req('POST', '/contractors', { ...d, building_id: getBid() }),
    update: (id, d) => req('PUT', `/contractors/${id}`, d),
    del: id => req('DELETE', `/contractors/${id}`),
  },

  budget: {
    get: () => req('GET', bq('/budget')),
    create: d => req('POST', '/budget', { ...d, building_id: getBid() }),
    update: (id, d) => req('PUT', `/budget/${id}`, d),
    del: id => req('DELETE', `/budget/${id}`),
  },

  payments: {
    list: () => req('GET', bq('/payments')),
    update: (id, d) => req('PUT', `/payments/${id}`, d),
    demand: (id, to_email) => req('POST', `/payments/${id}/demand`, to_email ? { to_email } : {}),
  },

  units: {
    list: () => req('GET', bq('/units')),
    update: (id, d) => req('PUT', `/units/${id}`, d),
  },

  decisions: {
    list: () => req('GET', bq('/decisions')),
    create: d => req('POST', '/decisions', { ...d, building_id: getBid() }),
    update: (id, d) => req('PUT', `/decisions/${id}`, d),
    del: id => req('DELETE', `/decisions/${id}`),
  },

  updates: {
    list: () => req('GET', bq('/updates')),
    create: d => req('POST', '/updates', { ...d, building_id: getBid() }),
    update: (id, d) => req('PUT', `/updates/${id}`, d),
    del: id => req('DELETE', `/updates/${id}`),
  },

  complaints: {
    list: () => req('GET', bq('/complaints')),
    create: d => req('POST', '/complaints', { ...d, building_id: getBid() }),
    update: (id, d) => req('PUT', `/complaints/${id}`, d),
    del: id => req('DELETE', `/complaints/${id}`),
  },

  maintenance: {
    list: () => req('GET', bq('/maintenance')),
    create: d => req('POST', '/maintenance', { ...d, building_id: getBid() }),
    update: (id, d) => req('PUT', `/maintenance/${id}`, d),
    del: id => req('DELETE', `/maintenance/${id}`),
  },

  professionals: {
    list: () => req('GET', bq('/professionals')),
    create: d => req('POST', '/professionals', { ...d, building_id: getBid() }),
    update: (id, d) => req('PUT', `/professionals/${id}`, d),
    del: id => req('DELETE', `/professionals/${id}`),
  },

  tutorials: {
    list: () => req('GET', '/tutorials'),
    create: d => req('POST', '/tutorials', d),
    del: id => req('DELETE', `/tutorials/${id}`),
  },

  feedback: {
    create: d => req('POST', '/feedback', d),
  },

  upload: (file_data, file_name) => req('POST', '/upload', { file_data, file_name }),

  bgChecks: () => req('GET', '/bg-checks'),

  alerts: {
    send: () => req('POST', '/alerts/send', {}),
  },

  documents: {
    list: () => req('GET', bq('/documents')),
    create: d => req('POST', '/documents', { ...d, building_id: getBid() }),
    update: (id, d) => req('PUT', `/documents/${id}`, d),
    del: id => req('DELETE', `/documents/${id}`),
    download: id => req('GET', `/documents/${id}/download`),
    checklist: () => req('GET', bq('/documents/checklist')),
    updateChecklist: (key, status, note) => req('PUT', `/documents/checklist/${key}?building_id=${getBid()}`, { status, note }),
  },

  permissions: {
    get: (unit_id) => req('GET', `/permissions/${unit_id}`),
    all: () => req('GET', bq('/permissions')),
    update: (unit_id, module, enabled) => req('PUT', `/permissions/${unit_id}/${module}`, { enabled }),
  },

  users: {
    list: () => req('GET', '/users'),
    create: d => req('POST', '/users', d),
    update: (id, d) => req('PUT', `/users/${id}`, d),
    resetPassword: (id, password) => req('PUT', `/users/${id}/password`, { password }),
    del: id => req('DELETE', `/users/${id}`),
    invite: d => req('POST', '/invite', d),
    setBgAccess: (id, allowed) => req('PUT', `/users/${id}/bg-access`, { allowed }),
  },
};
