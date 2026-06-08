import { createContext, useContext, useState, useEffect } from 'react';
import { api } from './api';

const Ctx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [building, setBuilding] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      api.me().then(u => {
        setUser(u);
        if (u.building_id) localStorage.setItem('building_id', u.building_id);
        setLoading(false);
      }).catch(() => { localStorage.removeItem('token'); setLoading(false); });
    } else setLoading(false);
  }, []);

  const login = async (email, password) => {
    const { token, user } = await api.login(email, password);
    localStorage.setItem('token', token);
    if (user.building_id) localStorage.setItem('building_id', user.building_id);
    setUser(user);
  };

  const selectBuilding = (b) => {
    localStorage.setItem('building_id', b.id);
    setBuilding(b);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('building_id');
    setUser(null);
    setBuilding(null);
  };

  return <Ctx.Provider value={{ user, building, setBuilding, selectBuilding, login, logout, loading }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
