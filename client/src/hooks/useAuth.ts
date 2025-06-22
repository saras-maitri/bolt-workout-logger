import { useState, useEffect } from 'react';
import { apiClient } from '../lib/api';

interface User {
  id: string;
  username: string;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    apiClient.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = apiClient.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (username: string, password: string) => {
    const { data, error } = await apiClient.signUp(username, password);
    return { data, error };
  };

  const signIn = async (username: string, password: string) => {
    const { data, error } = await apiClient.signIn(username, password);
    return { data, error };
  };

  const signOut = async () => {
    const { error } = await apiClient.signOut();
    return { error };
  };

  return {
    user,
    loading,
    signUp,
    signIn,
    signOut,
  };
}