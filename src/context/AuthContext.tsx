import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  updatePassword,
  signOut,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  onSnapshot,
} from 'firebase/firestore';
import { auth, db, getSecondaryAuth } from '../lib/firebase.ts';
import { UserProfile, UserRole } from '../types/inventory.ts';

export const DEFAULT_ADMIN_EMAIL = 'admin@jdcontrol.es';
export const DEFAULT_ADMIN_LOGIN = 'admin';
export const OWNER_ADMIN_EMAIL = 'guillermo.barranco.zuza@gmail.com';
export const INTERNAL_USER_DOMAIN = 'jdcontrol.app';

/**
 * Converts either a plain username (e.g. "carlos", "admin") or a full email
 * into the canonical email used by Firebase Email/Password authentication.
 */
export function normalizeIdentifier(usernameOrEmail: string): {
  authEmail: string;
  username: string;
} {
  const raw = usernameOrEmail.trim().toLowerCase();
  if (raw.includes('@')) {
    return {
      authEmail: raw,
      username: raw.split('@')[0],
    };
  }
  const cleanUser = raw.replace(/[^a-z0-9._-]/g, '');
  if (cleanUser === 'admin' || cleanUser === 'jefe') {
    return {
      authEmail: DEFAULT_ADMIN_EMAIL,
      username: 'admin',
    };
  }
  return {
    authEmail: `${cleanUser}@${INTERNAL_USER_DOMAIN}`,
    username: cleanUser,
  };
}

function mapFirebaseAuthError(err: any): string {
  const code = err?.code || '';
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Usuario o contraseña incorrectos.';
    case 'auth/email-already-in-use':
      return 'Ese nombre de usuario o correo ya está registrado. Prueba a iniciar sesión o elige otro usuario.';
    case 'auth/invalid-email':
      return 'El usuario o correo no tiene un formato válido (usa letras, números, punto o guion).';
    case 'auth/weak-password':
      return 'La contraseña debe tener al menos 6 caracteres.';
    case 'auth/too-many-requests':
      return 'Demasiados intentos fallidos. Espera unos minutos e inténtalo de nuevo.';
    case 'auth/requires-recent-login':
      return 'Por seguridad, cierra sesión y vuelve a entrar antes de cambiar tu contraseña.';
    case 'auth/operation-not-allowed':
    case 'auth/configuration-not-found':
      return 'El proveedor "Correo electrónico/contraseña" aún no está activado en Firebase Console (Authentication → Sign-in method → Correo electrónico/contraseña → Habilitar).';
    default:
      return err?.message || 'Error de autenticación. Inténtalo de nuevo.';
  }
}

interface AuthContextType {
  currentUser: User | null;
  userProfile: UserProfile | null;
  isAuthenticated: boolean;
  loading: boolean;
  loginWithCredentials: (
    usernameOrEmail: string,
    pass: string
  ) => Promise<{ success: boolean; error?: string }>;
  loginWithAdminCredentials: (
    usernameOrEmail: string,
    pass: string
  ) => Promise<{ success: boolean; error?: string }>;
  registerWithCredentials: (
    name: string,
    usernameOrEmail: string,
    pass: string
  ) => Promise<{ success: boolean; error?: string; role?: UserRole }>;
  logout: () => Promise<void>;
  createRegisteredUser: (
    usernameOrEmail: string,
    name: string,
    password: string,
    role: UserRole
  ) => Promise<UserProfile>;
  updateUserRole: (userId: string, newRole: UserRole) => Promise<void>;
  deleteUser: (userId: string) => Promise<void>;
  updateOwnPassword: (newPassword: string) => Promise<void>;
  allUsers: UserProfile[];
  isAdmin: boolean;
  isWarehouseManager: boolean;
  isTechnician: boolean;
  isPending: boolean;
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

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const isAuthenticated = Boolean(currentUser);

  // Listen to Firebase Auth state & subscribe to the signed-in user's own profile in real time
  useEffect(() => {
    let unsubOwnProfile: (() => void) | undefined;

    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (unsubOwnProfile) {
        unsubOwnProfile();
        unsubOwnProfile = undefined;
      }

      setCurrentUser(user);

      if (!user) {
        setUserProfile(null);
        setAllUsers([]);
        setLoading(false);
        return;
      }

      const userEmailLower = (user.email || '').toLowerCase().trim();
      const isOwnerAdmin = userEmailLower === OWNER_ADMIN_EMAIL;
      const userDocRef = doc(db, 'users', user.uid);

      // Ensure user profile exists in Firestore
      try {
        const snap = await getDoc(userDocRef);
        if (!snap.exists()) {
          let grantBootstrapAdmin = isOwnerAdmin;

          // If this is the first-ever "admin" registration and no bootstrap lock exists yet, claim it atomically
          if (!grantBootstrapAdmin && userEmailLower === DEFAULT_ADMIN_EMAIL) {
            try {
              const bootstrapRef = doc(db, 'system_config', 'bootstrap');
              const bSnap = await getDoc(bootstrapRef);
              if (!bSnap.exists()) {
                await setDoc(bootstrapRef, {
                  adminUid: user.uid,
                  email: userEmailLower,
                  claimedAt: new Date().toISOString(),
                });
                grantBootstrapAdmin = true;
              } else if (bSnap.data()?.adminUid === user.uid) {
                grantBootstrapAdmin = true;
              }
            } catch {
              // Bootstrap already claimed by another UID
            }
          }

          const nowIso = new Date().toISOString();
          const newProfile: UserProfile = {
            id: user.uid,
            username: userEmailLower.split('@')[0],
            email: userEmailLower,
            name: user.displayName || userEmailLower.split('@')[0] || 'Usuario',
            role: grantBootstrapAdmin ? 'admin' : 'pending',
            status: grantBootstrapAdmin ? 'active' : 'pending',
            provider: 'password',
            lastLogin: nowIso,
            assignedBy: grantBootstrapAdmin
              ? 'Administrador Jefe (Configuración Inicial)'
              : 'Registro de Usuario — Pendiente de Aprobación',
            createdAt: nowIso,
            updatedAt: nowIso,
          };

          await setDoc(userDocRef, newProfile);
          setUserProfile(newProfile);
        } else {
          const data = snap.data() as UserProfile;
          const resolvedRole: UserRole = isOwnerAdmin ? 'admin' : (data.role || 'pending');
          const resolvedStatus: UserProfile['status'] =
            resolvedRole === 'pending' ? 'pending' : (data.status || 'active');

          setUserProfile({
            ...data,
            id: user.uid,
            role: resolvedRole,
            status: resolvedStatus,
          });

          try {
            await updateDoc(userDocRef, {
              lastLogin: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
          } catch {
            // Non-fatal if offline
          }
        }
      } catch (err) {
        console.warn('Error loading user profile:', err);
        setUserProfile({
          id: user.uid,
          username: userEmailLower.split('@')[0],
          email: userEmailLower,
          name: user.displayName || userEmailLower.split('@')[0],
          role: isOwnerAdmin ? 'admin' : 'pending',
          status: isOwnerAdmin ? 'active' : 'pending',
          provider: 'password',
          createdAt: new Date().toISOString(),
        });
      }

      // Real-time subscription to own profile: unlocks PendingApprovalView the instant Chief Admin assigns a role
      unsubOwnProfile = onSnapshot(
        userDocRef,
        (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data() as UserProfile;
            const resolvedRole: UserRole = isOwnerAdmin ? 'admin' : (data.role || 'pending');
            setUserProfile({
              ...data,
              id: docSnap.id,
              role: resolvedRole,
              status: resolvedRole === 'pending' ? 'pending' : (data.status || 'active'),
            });
          }
          setLoading(false);
        },
        (error) => {
          console.warn('Own profile listener notice:', error.message);
          setLoading(false);
        }
      );
    });

    return () => {
      unsubAuth();
      if (unsubOwnProfile) unsubOwnProfile();
    };
  }, []);

  const rawRole = (userProfile?.role || 'pending') as string;
  const role: UserRole = rawRole === 'viewer' ? 'technician' : (rawRole as UserRole);

  const isPending = Boolean(isAuthenticated && (role === 'pending' || userProfile?.status === 'pending'));
  const isAdmin = Boolean(isAuthenticated && !isPending && role === 'admin');
  const isWarehouseManager = Boolean(isAuthenticated && !isPending && role === 'warehouse_manager');
  const isTechnician = Boolean(isAuthenticated && !isPending && role === 'technician');

  // Sync full users directory ONLY when Chief Admin is signed in
  useEffect(() => {
    if (!isAdmin) {
      setAllUsers([]);
      return;
    }

    const usersColRef = collection(db, 'users');
    const unsubscribe = onSnapshot(
      usersColRef,
      (snapshot) => {
        const firestoreUsers: UserProfile[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as UserProfile;
          firestoreUsers.push({
            ...data,
            id: docSnap.id,
          });
        });
        firestoreUsers.sort((a, b) => {
          if (a.role === 'pending' && b.role !== 'pending') return -1;
          if (b.role === 'pending' && a.role !== 'pending') return 1;
          return (b.createdAt || '').localeCompare(a.createdAt || '');
        });
        setAllUsers(firestoreUsers);
      },
      (error) => {
        console.warn('Firestore users list notice:', error.message);
      }
    );

    return () => unsubscribe();
  }, [isAdmin]);

  // Sign in with username or email + password
  // Note: Chief Admin ("admin") signs in directly here without needing "Crear Cuenta".
  // On the very first login before admin@jdcontrol.es exists in Firebase Auth, it initializes
  // the Firebase Auth account + one-time /system_config/bootstrap lock automatically.
  const loginWithCredentials = async (
    usernameOrEmail: string,
    pass: string
  ): Promise<{ success: boolean; error?: string }> => {
    const trimmed = usernameOrEmail.trim();
    if (!trimmed) {
      return { success: false, error: 'Introduce tu usuario o correo electrónico.' };
    }
    if (!pass) {
      return { success: false, error: 'Introduce tu contraseña.' };
    }

    const { authEmail, username } = normalizeIdentifier(trimmed);

    try {
      await signInWithEmailAndPassword(auth, authEmail, pass);
      return { success: true };
    } catch (err: any) {
      const code = err?.code || '';
      const isAdminFirstRunCandidate =
        authEmail === DEFAULT_ADMIN_EMAIL &&
        (code === 'auth/user-not-found' || code === 'auth/invalid-credential');

      if (isAdminFirstRunCandidate && pass.length >= 6) {
        try {
          const cred = await createUserWithEmailAndPassword(auth, DEFAULT_ADMIN_EMAIL, pass);
          await updateProfile(cred.user, { displayName: 'Administrador Jefe' });

          const nowIso = new Date().toISOString();
          try {
            const bootstrapRef = doc(db, 'system_config', 'bootstrap');
            const bSnap = await getDoc(bootstrapRef);
            if (!bSnap.exists()) {
              await setDoc(bootstrapRef, {
                adminUid: cred.user.uid,
                email: DEFAULT_ADMIN_EMAIL,
                claimedAt: nowIso,
              });
            }
          } catch {
            // Bootstrap already claimed
          }

          const adminProfile: UserProfile = {
            id: cred.user.uid,
            username: username || 'admin',
            email: DEFAULT_ADMIN_EMAIL,
            name: 'Administrador Jefe',
            role: 'admin',
            status: 'active',
            provider: 'admin_credentials',
            lastLogin: nowIso,
            assignedBy: 'Administrador Jefe (Único)',
            createdAt: nowIso,
            updatedAt: nowIso,
          };
          await setDoc(doc(db, 'users', cred.user.uid), adminProfile, { merge: true });
          setUserProfile(adminProfile);
          return { success: true };
        } catch (createErr: any) {
          // If admin@jdcontrol.es already exists in Firebase Auth, the password was simply wrong
          if (createErr?.code === 'auth/email-already-in-use') {
            return { success: false, error: 'Contraseña de Administrador incorrecta.' };
          }
          return { success: false, error: mapFirebaseAuthError(createErr) };
        }
      }

      return { success: false, error: mapFirebaseAuthError(err) };
    }
  };

  const loginWithAdminCredentials = async (
    usernameOrEmail: string,
    pass: string
  ): Promise<{ success: boolean; error?: string }> => {
    return loginWithCredentials(usernameOrEmail, pass);
  };

  // Worker self-registration ONLY: creates a real Firebase Auth account with role='pending' until Chief Admin approves
  const registerWithCredentials = async (
    name: string,
    usernameOrEmail: string,
    pass: string
  ): Promise<{ success: boolean; error?: string; role?: UserRole }> => {
    const cleanName = name.trim();
    const { authEmail, username } = normalizeIdentifier(usernameOrEmail);

    if (cleanName.length < 2) {
      return { success: false, error: 'Introduce tu nombre y apellidos.' };
    }
    if (username.length < 3) {
      return {
        success: false,
        error: 'El nombre de usuario debe tener al menos 3 caracteres (letras o números).',
      };
    }
    if (
      username === 'admin' ||
      username === 'jefe' ||
      authEmail === DEFAULT_ADMIN_EMAIL
    ) {
      return {
        success: false,
        error:
          'El usuario "admin" está reservado exclusivamente para el Administrador Jefe. Entra desde "Iniciar Sesión" o elige otro nombre de usuario.',
      };
    }
    if (pass.length < 6) {
      return { success: false, error: 'La contraseña debe tener al menos 6 caracteres.' };
    }

    try {
      const cred = await createUserWithEmailAndPassword(auth, authEmail, pass);
      await updateProfile(cred.user, { displayName: cleanName });

      const isOwner = authEmail === OWNER_ADMIN_EMAIL;
      const assignedRole: UserRole = isOwner ? 'admin' : 'pending';
      const nowIso = new Date().toISOString();
      const newProfile: UserProfile = {
        id: cred.user.uid,
        username,
        email: authEmail,
        name: cleanName,
        role: assignedRole,
        status: isOwner ? 'active' : 'pending',
        provider: 'password',
        lastLogin: nowIso,
        assignedBy: isOwner
          ? 'Administrador Jefe'
          : 'Registro de Usuario — Pendiente de Aprobación',
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      await setDoc(doc(db, 'users', cred.user.uid), newProfile);
      setUserProfile(newProfile);

      return { success: true, role: assignedRole };
    } catch (err: any) {
      return { success: false, error: mapFirebaseAuthError(err) };
    }
  };

  // Sign out cleanly
  const logout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setCurrentUser(null);
      setUserProfile(null);
      setAllUsers([]);
    }
  };

  // Chief Admin creates a new worker account with username + password + assigned role without logging out
  const createRegisteredUser = async (
    usernameOrEmail: string,
    name: string,
    password: string,
    assignedRole: UserRole
  ): Promise<UserProfile> => {
    if (!isAdmin) {
      throw new Error('Solo el Administrador Jefe puede dar de alta usuarios.');
    }
    const cleanName = name.trim();
    const { authEmail, username } = normalizeIdentifier(usernameOrEmail);

    if (username.length < 3) {
      throw new Error('El nombre de usuario debe tener al menos 3 caracteres.');
    }
    if (!cleanName) {
      throw new Error('Introduce el nombre y apellidos del trabajador.');
    }
    if (password.length < 6) {
      throw new Error('La contraseña inicial debe tener al menos 6 caracteres.');
    }

    const secondaryAuth = getSecondaryAuth();
    let newUid: string;
    try {
      const cred = await createUserWithEmailAndPassword(secondaryAuth, authEmail, password);
      await updateProfile(cred.user, { displayName: cleanName });
      newUid = cred.user.uid;
      await signOut(secondaryAuth);
    } catch (err: any) {
      throw new Error(mapFirebaseAuthError(err));
    }

    const nowIso = new Date().toISOString();
    const newUser: UserProfile = {
      id: newUid,
      username,
      email: authEmail,
      name: cleanName,
      role: assignedRole,
      provider: 'password',
      status: assignedRole === 'pending' ? 'pending' : 'active',
      assignedBy: userProfile?.name || 'Administrador Jefe',
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    await setDoc(doc(db, 'users', newUid), newUser);
    return newUser;
  };

  // Only Chief Admin can assign/change roles to people
  const updateUserRole = async (userId: string, newRole: UserRole) => {
    if (!isAdmin) {
      throw new Error('Solo el Administrador Jefe tiene permisos para asignar o modificar roles.');
    }

    const newStatus: UserProfile['status'] = newRole === 'pending' ? 'pending' : 'active';
    const existing = allUsers.find((u) => u.id === userId);
    const nowIso = new Date().toISOString();

    const userRef = doc(db, 'users', userId);
    await setDoc(
      userRef,
      {
        id: userId,
        email: existing?.email || '',
        name: existing?.name || 'Usuario',
        createdAt: existing?.createdAt || nowIso,
        role: newRole,
        status: newStatus,
        assignedBy: userProfile?.name || 'Administrador Jefe',
        updatedAt: nowIso,
      },
      { merge: true }
    );
  };

  // Only Chief Admin can delete registered users
  const deleteUser = async (userId: string) => {
    if (!isAdmin) {
      throw new Error('Solo el Administrador Jefe puede eliminar usuarios.');
    }
    if (userProfile?.id === userId) {
      throw new Error('No puedes eliminar tu propia sesión activa.');
    }

    await deleteDoc(doc(db, 'users', userId));
  };

  // Update the currently signed-in user's password via Firebase Auth
  const updateOwnPassword = async (newPassword: string) => {
    if (!auth.currentUser) {
      throw new Error('Debes iniciar sesión para cambiar tu contraseña.');
    }
    const clean = newPassword.trim();
    if (clean.length < 6) {
      throw new Error('La contraseña debe tener al menos 6 caracteres.');
    }
    try {
      await updatePassword(auth.currentUser, clean);
    } catch (err: any) {
      throw new Error(mapFirebaseAuthError(err));
    }
  };

  // Strict role boundaries: Only administrators see contracts, reservations and economic metrics
  const canViewContracts = isAdmin;
  const canViewFinancials = isAdmin;
  const canManageUsers = isAdmin;

  const canManagePurchases = isAdmin || isWarehouseManager;
  const canManageInventory = isAdmin || isWarehouseManager;
  const canAuthorizeDispatches = isAdmin || isWarehouseManager || isTechnician;
  const canEditIncidents = !isPending && isAuthenticated;
  const isReadOnly = isPending;

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        userProfile,
        isAuthenticated,
        loading,
        loginWithCredentials,
        loginWithAdminCredentials,
        registerWithCredentials,
        logout,
        createRegisteredUser,
        updateUserRole,
        deleteUser,
        updateOwnPassword,
        allUsers,
        isAdmin,
        isWarehouseManager,
        isTechnician,
        isPending,
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
