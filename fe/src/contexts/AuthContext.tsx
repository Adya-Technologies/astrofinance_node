import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/router';
import authService, { User, LoginCredentials, AuthResponse, NavigationGroup } from '@/services/authService';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isStaff: boolean;
  isOfficeUser: boolean;
  userType: 'ADMIN' | 'STAFF' | 'USER' | null;
  login: (credentials: LoginCredentials, userType: 'ADMIN' | 'STAFF' | 'USER') => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (userData: User) => void;
  hasPermission: (permissionCode: string) => boolean;
  getNavigation: () => NavigationGroup[];
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Check if user is already logged in
    const checkAuth = async () => {
      try {
        const storedUser = authService.getCurrentUser();
        if (storedUser) {
          setUser(storedUser);
          console.log('User authenticated with type:', storedUser.userType);
        }
      } catch (error) {
        console.error('Authentication check failed:', error);
        authService.clearAuth();
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = async (credentials: LoginCredentials, userType: 'ADMIN' | 'STAFF' | 'USER' = 'USER') => {
    setIsLoading(true);
    try {
      let response: AuthResponse;

      if (userType === 'ADMIN' || userType === 'STAFF') {
        // Use the unified office login for both admin and staff
        response = await authService.officeLogin(credentials);

        // Ensure admin users get ADMIN userType
        if (response.user && response.user.roles?.some(role => role.name === 'ADMIN')) {
          response.user.userType = 'ADMIN';
        } else if (response.user && response.user.roles?.some(role => role.name === 'STAFF')) {
          response.user.userType = 'STAFF';
        }

        // Validate that the user type matches the expected login page
        if (response.user.userType !== userType) {
          throw new Error(`Access denied. This login page is for ${userType.toLowerCase()} users only.`);
        }
      } else {
        // Regular user login
        response = await authService.userLogin(credentials);
      }

      console.log('Login response:', response);

      // Check if navigation data is present
      if (response.user && !response.user.navigation) {
        console.warn('No navigation data in login response, will fetch separately');
        response.user.navigation = [];
      } else if (response.user && response.user.navigation) {
        console.log('Navigation in login response:', response.user.navigation.length, 'items');
      }

      authService.setAuth(response);
      setUser(response.user);

      // Redirect based on user type
      if (response.user.userType === 'ADMIN') {
        console.log('Redirecting to admin dashboard');
        router.push('/admin/dashboard');
      } else if (response.user.userType === 'STAFF') {
        console.log('Redirecting to staff dashboard');
        router.push('/staff/dashboard');
      } else {
        console.log('Redirecting to user dashboard');
        router.push('/dashboard');
      }
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      // Try to call logout API, but don't wait for it
      if (user) {
        try {
          const userType = authService.getUserType();
          if (userType === 'ADMIN' || userType === 'STAFF') {
            await authService.officeLogout();
          } else if (userType === 'USER') {
            await authService.userLogout();
          } else {
            console.warn('Unknown user type during logout:', userType);
            // Fallback to office logout as default
            await authService.officeLogout();
          }
        } catch (error) {
          console.error('Logout API call failed:', error);
        }
      }

      // Clear auth regardless of API success
      authService.clearAuth();
      setUser(null);
      router.push('/login');
    } finally {
      setIsLoading(false);
    }
  };

  const updateUser = (userData: User) => {
    setUser(userData);
    if (typeof window !== 'undefined') {
      localStorage.setItem('user', JSON.stringify(userData));
    }
  };

  const hasPermission = (permissionCode: string): boolean => {
    return authService.hasPermission(permissionCode);
  };

  const getNavigation = (): any[] => {
    return authService.getNavigation();
  };

  // Calculate derived state
  const isAuthenticated = !!user;
  const isAdmin = user?.userType === 'ADMIN' || authService.isAdmin();
  const isStaff = user?.userType === 'STAFF' || authService.isStaff();
  const isOfficeUser = isAdmin || isStaff;
  const userType = user?.userType || authService.getUserType();

  // Log authentication state for debugging
  useEffect(() => {
    if (user) {
      console.log('Auth state:', {
        isAuthenticated,
        isAdmin,
        isStaff,
        isOfficeUser,
        userType,
        userRoles: user.roles?.map(r => r.name).join(', ')
      });
    }
  }, [user, isAuthenticated, isAdmin, isStaff, userType]);

  const value = {
    user,
    isLoading,
    isAuthenticated,
    isAdmin,
    isStaff,
    isOfficeUser,
    userType,
    login,
    logout,
    updateUser,
    hasPermission,
    getNavigation
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;