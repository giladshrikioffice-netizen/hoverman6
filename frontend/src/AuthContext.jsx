import { createContext, useContext, useState, useEffect } from 'react';
import { api } from './api';

const Ctx = createContext(null);

// Default: all modules enabled
const ALL_MODULES = ['payments','complaints','updates','decisions','maintenance','professionals','tutorials'];
const DEFAULT_PERMS = Object.fromEntries(ALL_MODULES.map(m => [m, 1]));

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [building, setBuilding] = useState(null);
  const [permissions, setPermissions] = useState(DEFAULT_PERMS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      api.me().then(u => {
        setUser(u);
        if (u.building_id) localStorage.setItem('building_id', u.building_id);
        // Load permissions for residents
        if (u.role === 'resident' && u.unit_id) {
          api.permissions.get(u.unit_id).then(setPermissions).catch(() => {});
        }
        setLoading(false);
      }).catch(() => { localStorage.removeItem('token'); setLoading(false); });
    } else setLoading(false);
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
