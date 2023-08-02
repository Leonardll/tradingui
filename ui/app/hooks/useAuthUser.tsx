// hooks/useAuthUser.tsx
import { useUser, UserProvider } from "@auth0/nextjs-auth0/client";
import { FC, ReactNode } from "react";

export const useAuthUser = () => {
  const { user, error, isLoading } = useUser();
  return { user, error, isLoading };
};

interface AuthUserProviderProps {
  children: ReactNode;
}

export const AuthUserProvider: FC<AuthUserProviderProps> = ({ children }) => {
  return <UserProvider>{children}</UserProvider>;
};
