import apiService from './api';

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface RegisterData {
  fullName: string;
  email: string;
  contactNumber: string;
  password: string;
}

// Navigation interfaces
export interface NavigationItem {
  id: string;
  label: string;
  icon?: string;
  url?: string;
  order: number;
  parentId?: string | null;
  groupId?: string | null;
  children?: NavigationItem[];
}

export interface NavigationGroup {
  id: string;
  name: string;
  order: number;
  items: NavigationItem[];
}

export interface User {
  id: string;
  username?: string;
  employeeId?: string;
  email: string;
  fullName: string;
  isActive: boolean;
  roles?: { id: string; name: string }[];
  permissions?: string[];
  navigation?: NavigationGroup[];
  userType: 'ADMIN' | 'STAFF' | 'USER';
  department?: string;
  position?: string;
  createdAt?: string;
  contactNumber?: string; // Adding this for compatibility with staff profile
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface PasswordChangeData {
  currentPassword: string;
  newPassword: string;
}

const authService = {
  // Office authentication (for admin and staff)
  officeLogin: (credentials: LoginCredentials) =>
    apiService.post<AuthResponse>('/office/auth/login', credentials),

  officeLogout: () =>
    apiService.post<{ message: string }>('/office/auth/logout'),

  getOfficeProfile: () =>
    apiService.get<User>('/office/auth/profile'),

  changeOfficePassword: (data: PasswordChangeData) =>
    apiService.post<{ message: string }>('/office/auth/change-password', data),

  // User authentication
  userLogin: (credentials: LoginCredentials) =>
    apiService.post<AuthResponse>('/user/auth/login', credentials),

  userLogout: () =>
    apiService.post<{ message: string }>('/user/auth/logout'),

  userRegister: (data: RegisterData) =>
    apiService.post<AuthResponse>('/user/auth/register', data),

  getUserProfile: () =>
    apiService.get<User>('/user/auth/profile'),

  updateUserProfile: (data: Partial<User>) =>
    apiService.put<User>('/user/auth/profile', data),

  changeUserPassword: (data: PasswordChangeData) =>
    apiService.post<{ message: string }>('/user/auth/change-password', data),

  // Common functions
  isAuthenticated: (): boolean => {
    if (typeof window === 'undefined') return false;
    return !!localStorage.getItem('token');
  },

  getToken: (): string | null => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('token');
  },

  getCurrentUser: (): User | null => {
    if (typeof window === 'undefined') return null;
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  },

  // Removed duplicate getUserType method

  setAuth: (response: AuthResponse): void => {
    if (typeof window === 'undefined') return;

    localStorage.setItem('token', response.token);
    localStorage.setItem('user', JSON.stringify(response.user));

    console.log('Auth set with user type:', response.user.userType);
  },

  clearAuth: (): void => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },

  isAdmin: (): boolean => {
    const user = authService.getCurrentUser();
    if (!user) return false;

    // Check both userType and roles for backward compatibility
    const hasAdminRole = user.roles?.some(role =>
      role.name === 'ADMIN' || role.name === 'admin' || role.name === 'Admin'
    ) || false;

    return user.userType === 'ADMIN' || hasAdminRole;
  },

  isStaff: (): boolean => {
    const user = authService.getCurrentUser();
    if (!user) return false;

    // Check both userType and roles for backward compatibility
    const hasStaffRole = user.roles?.some(role =>
      role.name === 'STAFF' || role.name === 'staff' || role.name === 'Staff'
    ) || false;

    return user.userType === 'STAFF' || hasStaffRole;
  },

  isOfficeUser: (): boolean => {
    return authService.isAdmin() || authService.isStaff();
  },

  isRegularUser: (): boolean => {
    const user = authService.getCurrentUser();
    return !!user && user.userType === 'USER';
  },

  getUserType: (): 'ADMIN' | 'STAFF' | 'USER' | null => {
    const user = authService.getCurrentUser();
    return user ? user.userType : null;
  },

  hasPermission: (permissionCode: string): boolean => {
    const user = authService.getCurrentUser();
    if (!user || !user.permissions) return false;
    return user.permissions.includes(permissionCode);
  },

  getNavigation: (): NavigationGroup[] => {
    const user = authService.getCurrentUser();
    console.log('User in getNavigation:', user);
    if (!user || !user.navigation) {
      console.log('No navigation found in user data');
      return [];
    }
    console.log('Navigation from user data:', user.navigation);
    return user.navigation;
  },

  // Method already defined above

  changeAdminPassword: async (passwordData: { currentPassword: string; newPassword: string }) => {
    return apiService.post('/admin/auth/change-password', passwordData);
  }
};

export default authService;