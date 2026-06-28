import { createContext, useContext, useState, useEffect } from 'react';
import { api } from './api';

const Ctx = createContext(null);

// Default: all modules enabled
const ALL_MODULES = ['payments','complaints','updates','decisions','maintenance','professionals','tutorials'];
const DEFAULT_PERMS = Object.fromEntries(ALL_MODULES.map(m => [m, 1]));

function getCachedUser() {
  try { return JSON.parse(localStorage.getItem('cached_user') || 'null'); } catch { return null; }
}

export function AuthProvider({ children }) {
  const cachedUser = getCachedUser();
  const [user, setUser] = useState(cachedUser);       // instant render from cache
  const [building, setBuilding] = useState(null);
  const [permissions, setPermissions] = useState(DEFAULT_PERMS);
  const [loading, setLoading] = useState(!cachedUser); // no spinner if cached

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { setLoading(false); return; }

    // Verify token in background — update silently if still valid
    api.me().then(u => {
      setUser(u);
      localStorage.setItem('cached_user', JSON.stringify(u));
      if (u.building_id) localStorage.setItem('building_id', u.building_id);
      if (u.role === 'resident' && u.unit_id) {
        api.permissions.get(u.unit_id).then(setPermissions).catch(() => {});
      }
      setLoading(false);
    }).catch(() => {
      // Token expired — only log out if there was no cached session
      if (!cachedUser) {
        localStorage.removeItem('token');
        setUser(null);
      }
      setLoading(false);
    });

    // Keep-alive: ping backend every 9 minutes to prevent cold starts
    const keepAlive = setInterval(() => {
      fetch((import.meta.env.VITE_API_URL || '') + '/api/auth/me', {
        headers: { Authorization: 'Bearer ' + token },
      }).catch(() => {});
    }, 9 * 60 * 1000);
    return () => clearInterval(keepAlive);
  }, []);

  const login = async (email, password) => {
    const { token, user } = await api.login(email, password);
    localStorage.setItem('token', token);
    if (user.building_id) localStorage.setItem('building_id', user.building_id);
    if (user.role === 'resident' && user.unit_id) {
      api.permissions.get(user.unit_id).then(setPermissions).catch(() => {});
    }
    setUser(user);
  };

  const selectBuilding = (b) => {
    localStorage.setItem('building_id', b.id);
    setBuilding(b);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('building_id');
    localStorage.removeItem('onboarding_done');
    localStorage.removeItem('cached_user');
    setUser(null);
    setBuilding(null);
    setPermissions(DEFAULT_PERMS);
  };

  // Check if resident has access to a module
  const hasAccess = (module) => {
    if (!user) return false;
    if (user.role !== 'resident') return true; // committee/admin always has access
    return permissions[module] !== 0;
  };

  // ── Area model: a building can be supervision-only, maintenance-only, or both ──
  const t = building?.type;
  const buildingHasSupervision = t === 'supervision' || t === 'both' || !t; // default: supervision
  const buildingHasMaintenance = t === 'maintenance' || t === 'both';
  const isStaff = ['superadmin', 'admin'].includes(user?.role);
  const userAreas = user?.areas || 'both'; // 'maintenance' | 'supervision' | 'both'
  const userInArea = area => isStaff || userAreas === 'both' || userAreas === area;

  // Can the current user see a given area in the current building?
  const canSeeArea = area => {
    if (area === 'supervision') return buildingHasSupervision && userInArea('supervision');
    if (area === 'maintenance') return buildingHasMaintenance && userInArea('maintenance');
    return true;
  };

  // Back-compat: many modules still ask isSupervision
  const isSupervision = canSeeArea('supervision');
  const isMaintenance = canSeeArea('maintenance');
  const isCombined = buildingHasSupervision && buildingHasMaintenance;

  return (
    <Ctx.Provider value={{
      user, building, setBuilding, selectBuilding,
      permissions, setPermissions,
      login, logout, loading,
      hasAccess, isSupervision, isMaintenance, isCombined,
      canSeeArea, buildingHasSupervision, buildingHasMaintenance, userAreas, isStaff,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
