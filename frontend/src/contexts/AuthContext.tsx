import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { User } from "@/types/hrms";
import { authAPI, setToken, removeToken, getToken } from "@/services/api";

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (
    email: string,
    password: string,
  ) => Promise<{
    success: boolean;
    error?: string;
    requires2FA?: boolean;
    userId?: string;
  }>;
  register: (data: {
    name: string;
    email: string;
    password: string;
  }) => Promise<{ success: boolean; error?: string }>;
  completeLogin: (userData: any, token: string) => void;
  logout: () => void;
  updateUser: (data: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function mapUser(data: any): User {
  return {
    id: data._id || data.id,
    name: data.name,
    email: data.email,
    role: data.role,
    avatar: data.avatar,
    phone: data.phone,
    status: data.status,
    department: data.department,
    children: Array.isArray(data.children)
      ? data.children.map((c: any) => c._id || c)
      : undefined,
    company: data.company
      ? {
          id: data.company._id || data.company.id,
          name: data.company.name,
          email: data.company.email,
          status: data.company.status || "trial",
          subscription: data.company.subscription
            ? {
                status: data.company.subscription.status,
                plan: data.company.subscription.plan,
                paymentStatus: data.company.subscription.paymentStatus,
                isTrial: data.company.subscription.isTrial,
                renewalDate: data.company.subscription.renewalDate,
                trialEndDate: data.company.subscription.trialEndDate,
              }
            : undefined,
        }
      : undefined,
    subscription: data.company?.subscription
      ? {
          status: data.company.subscription.status,
          plan: data.company.subscription.plan,
          paymentStatus: data.company.subscription.paymentStatus,
          isTrial: data.company.subscription.isTrial,
          renewalDate: data.company.subscription.renewalDate,
          trialEndDate: data.company.subscription.trialEndDate,
        }
      : undefined,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const restore = async () => {
      const token = getToken();
      if (token) {
        try {
          const res = await authAPI.getMe();
          setUser(mapUser(res.data));
        } catch (err: any) {
          if (err.status === 401) {
            removeToken();
            setUser(null);
          }
        }
      }
      setIsLoading(false);
    };
    restore();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const res = await authAPI.login(email, password);
      if (res.data.requires2FA) {
        return { success: false, requires2FA: true, userId: res.data.userId };
      }
      const { token, ...userData } = res.data;
      setToken(token);
      setUser(mapUser(userData));
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || "Login failed" };
    }
  }, []);

  const completeLogin = useCallback((userData: any, token: string) => {
    setToken(token);
    setUser(mapUser(userData));
  }, []);

  const register = useCallback(
    async (data: { name: string; email: string; password: string }) => {
      try {
        const res = await authAPI.register(data);
        const { token, ...userData } = res.data;
        setToken(token);
        setUser(mapUser(userData));
        return { success: true };
      } catch (err: any) {
        return { success: false, error: err.message || "Registration failed" };
      }
    },
    [],
  );

  const logout = useCallback(() => {
    removeToken();
    setUser(null);
  }, []);

  const updateUser = useCallback((data: Partial<User>) => {
    setUser((prev) => (prev ? { ...prev, ...data } : null));
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        completeLogin,
        logout,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be within AuthProvider");
  return ctx;
}
