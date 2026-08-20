import { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import api from '@services/api';
import { tabGet, tabRemove, tabSet, rotateTabSessionId } from '../utils/tabStorage';

interface User {
  id: number;
  nombre: string;
  correo: string;
  rol: string;
}

interface AuthContextType {
  user: User | null;
  rol: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  passwordResetRequired: boolean;
  setPasswordResetRequired: (flag: boolean) => void;
  perfilIncompleto: boolean;
  marcarPerfilCompleto: () => void;
  login: (email: string, password: string) => Promise<void>;
  googleLogin: (credential: string) => Promise<void>;
  logout: () => void;
  refreshUserProfile: () => Promise<void>;
}

interface LoginResponse {
  access_token: string;
  refresh_token: string;
  user_type: string;
  rol?: string;
  role?: string;
  nombre?: string;
  first_name?: string;
  last_name?: string;
  id?: number;
  password_reset_required?: boolean;
  perfil_incompleto?: boolean;
}

interface ClientProfile {
  first_name: string;
  last_name: string;
  email: string;
  telefono_cliente?: number | null;
  address?: string | null;
  documento_cliente?: number | null;
  id_tipo_documento_c?: number | null;
}

interface EmployeeProfile {
  id_usuario: number;
  first_name: string;
  last_name: string;
  email: string;
  is_active?: boolean;
}

const PASSWORD_RESET_KEY = 'password_reset_required';
const PERFIL_INCOMPLETO_KEY = 'perfil_incompleto';

const ROLES_VALIDOS = ['administrador', 'admin', 'cliente', 'tecnico'];

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [rol, setRol] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [passwordResetRequired, setPasswordResetRequiredState] = useState(
    () => tabGet(PASSWORD_RESET_KEY) === '1',
  );
  const [perfilIncompleto, setPerfilIncompletoState] = useState(
    () => tabGet(PERFIL_INCOMPLETO_KEY) === '1',
  );

  const setPasswordResetRequired = (flag: boolean) => {
    setPasswordResetRequiredState(flag);
    if (flag) {
      tabSet(PASSWORD_RESET_KEY, '1');
    } else {
      tabRemove(PASSWORD_RESET_KEY);
    }
  };

  const setPerfilIncompleto = (flag: boolean) => {
    setPerfilIncompletoState(flag);
    if (flag) {
      tabSet(PERFIL_INCOMPLETO_KEY, '1');
    } else {
      tabRemove(PERFIL_INCOMPLETO_KEY);
    }
  };

  const marcarPerfilCompleto = () => {
    setPerfilIncompleto(false);
  };

  const refreshUserProfile = async () => {
    try {
      // Base: usuario almacenado (no depende del estado capturado)
      let base: User | null = null;
      const storedRaw = tabGet('user');
      if (storedRaw) {
        try {
          base = JSON.parse(storedRaw) as User;
        } catch {
          base = null;
        }
      }
      // El backend identifica a los empleados (administrador, tecnico, etc.) con
      // su rol propio; solo los clientes usan "cliente".
      const isEmployee = (base?.rol || '') !== 'cliente';

      let firstName = '';
      let lastName = '';
      let email = base?.correo || '';
      if (isEmployee) {
        const res = await api.get<EmployeeProfile>('/users/me');
        const profile = res.data;
        firstName = profile.first_name || '';
        lastName = profile.last_name || '';
        email = profile.email || email;
      } else {
        const res = await api.get<ClientProfile>('/clients/me');
        const profile = res.data;
        firstName = profile.first_name || '';
        lastName = profile.last_name || '';
        email = profile.email || email;
        // Datos obligatorios que faltan (cuentas creadas con Google)
        const incompleto = !(
          profile.id_tipo_documento_c &&
          profile.documento_cliente &&
          profile.telefono_cliente &&
          (profile.address || '').trim()
        );
        setPerfilIncompleto(incompleto);
      }
      const firstNameResolved = firstName || base?.nombre?.split(' ')[0] || '';
      const lastNameResolved = lastName || (base?.nombre?.split(' ').slice(1).join(' ') || '');
      const fullName = (firstNameResolved && lastNameResolved) ? `${firstNameResolved} ${lastNameResolved}` : (firstNameResolved || base?.nombre || '');
      const updatedUser: User = {
        id: base?.id ?? 0,
        nombre: fullName.trim(),
        correo: email,
        rol: base?.rol || '',
      };
      tabSet('user', JSON.stringify(updatedUser));
      setUser(updatedUser);
      if (updatedUser.rol) setRol(updatedUser.rol);
    } catch (error) {
      console.error('Error refreshing user profile:', error);
    }
  };

  useEffect(() => {
    const token = tabGet('access_token');
    const storedUser = tabGet('user');
    if (token && storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser) as User;
        setUser(parsedUser);
        setRol(parsedUser.rol);
        setIsAuthenticated(true);
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        // Refrescar perfil para obtener nombre real
        refreshUserProfile();
      } catch (error) {
        console.error('Error parsing user', error);
        tabRemove('access_token');
        tabRemove('user');
      }
    }
    setLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    try {
      rotateTabSessionId();
      const response = await api.post<LoginResponse>('/auth/login', { email, password });
      const data = response.data;
      const userRol = (data.rol || data.role || '').toLowerCase();
      if (!userRol || !ROLES_VALIDOS.includes(userRol)) {
        throw new Error('La cuenta no tiene un rol válido asignado. Contacta al administrador.');
      }
      tabSet('access_token', data.access_token);
      tabSet('refresh_token', data.refresh_token);
      
      // Usar first_name y last_name del API si están disponibles, sino fallback a nombre o email
      const firstName = data.first_name || '';
      const lastName = data.last_name || '';
      const fullName = (firstName && lastName) ? `${firstName} ${lastName}` : (data.nombre || email.split('@')[0]);
      
      const userData: User = {
        id: data.id || 0,
        nombre: fullName.trim(),
        correo: email,
        rol: userRol,
      };
      tabSet('user', JSON.stringify(userData));
      setUser(userData);
      setRol(userRol);
      setIsAuthenticated(true);
      setPasswordResetRequiredState(data.password_reset_required === true);
      if (data.password_reset_required === true) {
        tabSet(PASSWORD_RESET_KEY, '1');
      } else {
        tabRemove(PASSWORD_RESET_KEY);
      }
      api.defaults.headers.common['Authorization'] = `Bearer ${data.access_token}`;
      setPerfilIncompleto(Boolean(data.perfil_incompleto));
      
      // Obtener nombre real del perfil
      await refreshUserProfile();
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const googleLogin = async (credential: string) => {
    try {
      rotateTabSessionId();
      const response = await api.post<LoginResponse>('/auth/google', { credential });
      const data = response.data;
      const userRol = (data.rol || data.role || 'cliente').toLowerCase();
      if (!userRol || !ROLES_VALIDOS.includes(userRol)) {
        throw new Error('La cuenta no tiene un rol válido asignado. Contacta al administrador.');
      }
      tabSet('access_token', data.access_token);
      tabSet('refresh_token', data.refresh_token);

      const firstName = data.first_name || '';
      const lastName = data.last_name || '';
      const fullName = (firstName && lastName) ? `${firstName} ${lastName}` : (data.nombre || 'Usuario Google');

      const userData: User = {
        id: data.id || 0,
        nombre: fullName.trim(),
        correo: '',
        rol: userRol,
      };
      tabSet('user', JSON.stringify(userData));
      setUser(userData);
      setRol(userRol);
      setIsAuthenticated(true);
      setPasswordResetRequiredState(data.password_reset_required === true);
      if (data.password_reset_required === true) {
        tabSet(PASSWORD_RESET_KEY, '1');
      } else {
        tabRemove(PASSWORD_RESET_KEY);
      }
      api.defaults.headers.common['Authorization'] = `Bearer ${data.access_token}`;
      setPerfilIncompleto(Boolean(data.perfil_incompleto));
      await refreshUserProfile();
    } catch (error) {
      console.error('Google login error:', error);
      throw error;
    }
  };

  const logout = () => {
    // Rotar el id de sesión PRIMERO: si esta pestaña heredó el id de otra
    // (abierta por ctrl+click), las claves que se limpian serán las del id
    // nuevo (vacío) y la sesión de la otra pestaña queda intacta.
    rotateTabSessionId();
    tabRemove('access_token');
    tabRemove('refresh_token');
    tabRemove('user');
    tabRemove(PASSWORD_RESET_KEY);
    tabRemove(PERFIL_INCOMPLETO_KEY);
    delete api.defaults.headers.common['Authorization'];
    setUser(null);
    setRol(null);
    setIsAuthenticated(false);
    setPasswordResetRequiredState(false);
    setPerfilIncompletoState(false);
  };

  return (
    <AuthContext.Provider value={{ user, rol, isAuthenticated, loading, passwordResetRequired, setPasswordResetRequired, perfilIncompleto, marcarPerfilCompleto, login, googleLogin, logout, refreshUserProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};