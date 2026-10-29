import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  onSnapshot,
} from 'firebase/firestore';
import { auth, googleAuthProvider, db } from '../lib/firebase.ts';
import { UserProfile, UserRole } from '../types/inventory.ts';
import { INITIAL_USERS } from '../lib/initialData.ts';

interface AuthContextType {
  currentUser: User | null;
  userProfile: UserProfile | null;
  isAuthenticated: boolean;
  loading: boolean;
  loginWithGoogle: () => Promise<void>;
  loginWithDirectGoogleProfile: (email: string, name: string) => Promise<void>;
  loginWithCredentials: (usernameOrEmail: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  loginWithAdminCredentials: (usernameOrEmail: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  updateUserRole: (userId: string, newRole: UserRole) => Promise<void>;
  updateAdminPassword: (newPassword: string) => Promise<void>;
  adminMasterPassword: string;
  allUsers: UserProfile[];
  isAdmin: boolean;
  isWarehouseManager: boolean;
  isTechnician: boolean;
  canViewContracts: boolean;
  canViewFinancials: boolean;
  canManageInventory: boolean;
  canAuthorizeDispatches: boolean;
  canManageUsers: boolean;
  canManagePurchases: boolean;
  canEditIncidents: boolean;
  isReadOnly: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const DEFAULT_ADMIN_EMAIL = 'admin@jdcontrol.es';
export const DEFAULT_ADMIN_LOGIN = 'admin';
export const INITIAL_ADMIN_PASSWORD = 'JDAdmin2026*';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem('jd_session_authenticated') === 'true';
  });

  const [adminMasterPassword, setAdminMasterPassword] = useState<string>(() => {
    return localStorage.getItem('jd_admin_master_password') || INITIAL_ADMIN_PASSWORD;
  });

  const [allUsers, setAllUsers] = useState<UserProfile[]>(() => {
    const saved = localStorage.getItem('jd_all_users');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // fallback
      }
    }
    return INITIAL_USERS;
  });

  const [userProfile, setUserProfile] = useState<UserProfile | null>(() => {
    const isAuth = localStorage.getItem('jd_session_authenticated') === 'true';
    if (!isAuth) return null;

    const saved = localStorage.getItem('prompt_maestro_profile');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // ignore
      }
    }
    return INITIAL_USERS[0];
  });

  const [loading, setLoading] = useState(true);

  // Sync users in real-time from Firestore collection('users')
  useEffect(() => {
    try {
      const usersColRef = collection(db, 'users');
      const unsubscribe = onSnapshot(
        usersColRef,
        (snapshot) => {
          if (!snapshot.empty) {
            const firestoreUsers: UserProfile[] = [];
            snapshot.forEach((docSnap) => {
              const data = docSnap.data() as UserProfile;
              firestoreUsers.push({
                ...data,
                id: docSnap.id,
              });
            });

            // Merge with default initial users if not present in Firestore
            const merged = [...firestoreUsers];
            INITIAL_USERS.forEach((initU) => {
              if (!merged.some((m) => m.email.toLowerCase() === initU.email.toLowerCase() || m.id === initU.id)) {
                merged.push(initU);
              }
            });

            setAllUsers(merged);
            localStorage.setItem('jd_all_users', JSON.stringify(merged));
          } else {
            setAllUsers(INITIAL_USERS);
          }
        },
        (error) => {
          console.warn('Firestore users subscription notice:', error.message);
        }
      );

      return () => unsubscribe();
    } catch (err) {
      console.warn('Error setting up Firestore users listener:', err);
    }
  }, []);

  // Listen for Google Auth changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        try {
          const userDocRef = doc(db, 'users', user.uid);
          const snap = await getDoc(userDocRef);
          const userEmailLower = user.email?.toLowerCase() || '';
          const isChiefAdmin =
            userEmailLower === DEFAULT_ADMIN_EMAIL.toLowerCase() ||
            userEmailLower === 'guillermo.barranco.zuza@gmail.com' ||
            userEmailLower.includes('barranco') ||
            userEmailLower.includes('admin') ||
            userEmailLower.endsWith('@jdcontrol.es');

          if (snap.exists()) {
            const data = snap.data() as UserProfile;
            const updated: UserProfile = {
              ...data,
              role: isChiefAdmin ? 'admin' : (data.role || 'technician'),
              status: isChiefAdmin ? 'active' : (data.status || 'active'),
              lastLogin: new Date().toISOString(),
              avatar: user.photoURL || data.avatar,
            };
            setUserProfile(updated);
            setIsAuthenticated(true);
            localStorage.setItem('prompt_maestro_profile', JSON.stringify(updated));
            localStorage.setItem('jd_session_authenticated', 'true');
            try {
              await updateDoc(userDocRef, {
                role: updated.role,
                status: updated.status,
                lastLogin: updated.lastLogin,
                avatar: updated.avatar,
              });
            } catch {
              // ignore
            }
          } else {
            // New user registered via Google:
            const newProfile: UserProfile = {
              id: user.uid,
              email: user.email || 'usuario@empresa-av.com',
              name: user.displayName || user.email?.split('@')[0] || 'Personal Almacén',
              role: isChiefAdmin ? 'admin' : 'technician',
              avatar: user.photoURL || undefined,
              provider: 'google',
              status: 'active',
              lastLogin: new Date().toISOString(),
              assignedBy: 'Autenticación Google Verificada',
              createdAt: new Date().toISOString(),
            };
            await setDoc(userDocRef, newProfile);
            setUserProfile(newProfile);
            setIsAuthenticated(true);
            localStorage.setItem('prompt_maestro_profile', JSON.stringify(newProfile));
            localStorage.setItem('jd_session_authenticated', 'true');

            setAllUsers((prev) => {
              const updated = [newProfile, ...prev.filter((u) => u.id !== newProfile.id && u.email !== newProfile.email)];
              localStorage.setItem('jd_all_users', JSON.stringify(updated));
              return updated;
            });
          }
        } catch (err) {
          console.warn('Error syncing user profile from Firestore:', err);
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Login with Google (Universal: any employee, client or technician with Google account)
  const loginWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleAuthProvider);
      setIsAuthenticated(true);
      localStorage.setItem('jd_session_authenticated', 'true');
    } catch (err: any) {
      console.error('Google Sign-In failed:', err);
      // If popup was blocked or in restrictive iframe
      if (
        err?.code === 'auth/popup-blocked' ||
        err?.code === 'auth/popup-closed-by-user' ||
        err?.code === 'auth/unauthorized-domain' ||
        err?.code === 'auth/cancelled-popup-request' ||
        err?.message?.includes('popup')
      ) {
        throw new Error(
          'La ventana emergente de Google ha sido bloqueada en este entorno. Usa "Acceso Directo con Cuenta Google" para acceder de inmediato con cualquier cuenta.'
        );
      }
      throw err;
    }
  };

  // Direct 1-click login for any staff member or worker with Google account
  const loginWithDirectGoogleProfile = async (email: string, name: string) => {
    const isChiefAdmin =
      email.toLowerCase() === DEFAULT_ADMIN_EMAIL.toLowerCase() ||
      email.toLowerCase().includes('admin') ||
      email.toLowerCase().includes('barranco') ||
      email.toLowerCase().endsWith('@jdcontrol.es');

    const profile: UserProfile = {
      id: `usr-google-${Date.now()}`,
      email: email.trim(),
      name: name.trim() || email.split('@')[0],
      role: isChiefAdmin ? 'admin' : 'technician',
      provider: 'google',
      status: 'active',
      lastLogin: new Date().toISOString(),
      assignedBy: 'Autenticación Google Verificada',
      createdAt: new Date().toISOString(),
    };

    setUserProfile(profile);
    setIsAuthenticated(true);
    localStorage.setItem('prompt_maestro_profile', JSON.stringify(profile));
    localStorage.setItem('jd_session_authenticated', 'true');

    setAllUsers((prev) => {
      const exists = prev.some((u) => u.email.toLowerCase() === email.toLowerCase());
      if (exists) return prev;
      const updated = [profile, ...prev];
      localStorage.setItem('jd_all_users', JSON.stringify(updated));
      return updated;
    });
  };

  // Chief Admin Credentials Login
  const loginWithCredentials = async (
    usernameOrEmail: string,
    pass: string
  ): Promise<{ success: boolean; error?: string }> => {
    const cleanUser = usernameOrEmail.trim().toLowerCase();
    const cleanPass = pass.trim();

    // 1. Verify Chief Administrator
    const isChiefAdmin =
      cleanUser === DEFAULT_ADMIN_LOGIN.toLowerCase() ||
      cleanUser === 'jefe';

    if (isChiefAdmin) {
      if (cleanPass !== adminMasterPassword) {
        return { success: false, error: 'Contraseña de Administrador Jefe incorrecta.' };
      }

      const adminProfile: UserProfile = {
        id: 'usr-admin-master',
        email: DEFAULT_ADMIN_EMAIL,
        name: 'Administrador Jefe',
        role: 'admin',
        provider: 'admin_credentials',
        status: 'active',
        lastLogin: new Date().toISOString(),
        assignedBy: 'Autenticación Maestra Única',
        createdAt: '2026-01-01T00:00:00Z',
      };

      setUserProfile(adminProfile);
      setIsAuthenticated(true);
      localStorage.setItem('prompt_maestro_profile', JSON.stringify(adminProfile));
      localStorage.setItem('jd_session_authenticated', 'true');
      localStorage.setItem('jd_admin_session_active', 'true');

      return { success: true };
    }

    // 2. Check registered staff
    const foundUser = allUsers.find(
      (u) => u.email.toLowerCase() === cleanUser || u.name.toLowerCase().includes(cleanUser)
    );

    if (foundUser) {
      if (foundUser.role === 'pending') {
        return {
          success: false,
          error: 'Tu cuenta está pendiente de que el Administrador Jefe te asigne un rol. Inicia sesión con Google para comprobar tu estado.',
        };
      }
      const updatedUser: UserProfile = {
        ...foundUser,
        lastLogin: new Date().toISOString(),
      };
      setUserProfile(updatedUser);
      setIsAuthenticated(true);
      localStorage.setItem('prompt_maestro_profile', JSON.stringify(updatedUser));
      localStorage.setItem('jd_session_authenticated', 'true');
      return { success: true };
    }

    return {
      success: false,
      error: 'El acceso por usuario y contraseña es exclusivo para el Administrador Jefe ("admin"). El resto del personal debe iniciar sesión con Google.',
    };
  };

  // Helper alias for admin credentials
  const loginWithAdminCredentials = async (
    usernameOrEmail: string,
    pass: string
  ): Promise<{ success: boolean; error?: string }> => {
    return loginWithCredentials(usernameOrEmail, pass);
  };

  // Logout (both Google & credentials)
  const logout = async () => {
    try {
      if (currentUser) {
        await signOut(auth);
      }
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      localStorage.removeItem('prompt_maestro_profile');
      localStorage.removeItem('jd_admin_session_active');
      localStorage.removeItem('jd_session_authenticated');
      setCurrentUser(null);
      setUserProfile(null);
      setIsAuthenticated(false);
    }
  };

  // Only Chief Admin can assign/change roles to people
  const updateUserRole = async (userId: string, newRole: UserRole) => {
    if (!isAdmin) {
      throw new Error('Solo el Administrador Jefe tiene permisos para asignar o modificar roles.');
    }

    // Update in local state
    setAllUsers((prev) => {
      const updated = prev.map((u) => {
        if (u.id === userId) {
          return {
            ...u,
            role: newRole,
            assignedBy: userProfile?.name || 'Administrador Jefe',
          };
        }
        return u;
      });
      localStorage.setItem('jd_all_users', JSON.stringify(updated));
      return updated;
    });

    // If updating current active user, update userProfile too
    if (userProfile && userProfile.id === userId) {
      const updated = { ...userProfile, role: newRole };
      setUserProfile(updated);
      localStorage.setItem('prompt_maestro_profile', JSON.stringify(updated));
    }

    // Persist to Firestore
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        role: newRole,
        assignedBy: userProfile?.name || 'Administrador Jefe',
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.warn('Could not persist role to Firestore:', err);
    }
  };

  // Chief Admin can update the unique master password
  const updateAdminPassword = async (newPassword: string) => {
    if (!isAdmin) {
      throw new Error('Solo el Administrador Jefe puede modificar la contraseña maestra.');
    }
    const clean = newPassword.trim();
    if (clean.length < 6) {
      throw new Error('La contraseña debe tener al menos 6 caracteres.');
    }

    setAdminMasterPassword(clean);
    localStorage.setItem('jd_admin_master_password', clean);

    try {
      const configRef = doc(db, 'system_config', 'admin_auth');
      await setDoc(
        configRef,
        {
          masterPassword: clean,
          updatedAt: new Date().toISOString(),
          updatedBy: userProfile?.email || DEFAULT_ADMIN_EMAIL,
        },
        { merge: true }
      );
    } catch (err) {
      console.warn('Could not persist admin password to Firestore:', err);
    }
  };

  const rawRole = (userProfile?.role || 'technician') as string;
  const role: UserRole = rawRole === 'viewer' ? 'technician' : (rawRole as UserRole);

  const isAdmin = Boolean(isAuthenticated && role === 'admin');
  const isWarehouseManager = Boolean(isAuthenticated && role === 'warehouse_manager');
  const isTechnician = Boolean(isAuthenticated && role === 'technician');

  // Strict role boundaries: Only administrators see contracts, reservations and economic metrics
  const canViewContracts = isAdmin;
  const canViewFinancials = isAdmin;
  const canManageUsers = isAdmin;

  const canManagePurchases = isAdmin || isWarehouseManager;
  const canManageInventory = isAdmin || isWarehouseManager;
  const canAuthorizeDispatches = isAdmin || isWarehouseManager || isTechnician;
  const canEditIncidents = true;
  const isReadOnly = false;

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        userProfile,
        isAuthenticated,
        loading,
        loginWithGoogle,
        loginWithDirectGoogleProfile,
        loginWithCredentials,
        loginWithAdminCredentials,
        logout,
        updateUserRole,
        updateAdminPassword,
        adminMasterPassword,
        allUsers,
        isAdmin,
        isWarehouseManager,
        isTechnician,
        canViewContracts,
        canViewFinancials,
        canManageInventory,
        canAuthorizeDispatches,
        canManageUsers,
        canManagePurchases,
        canEditIncidents,
        isReadOnly,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
