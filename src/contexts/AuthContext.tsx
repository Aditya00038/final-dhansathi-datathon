'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { onAuthStateChanged, User, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

// 1. Define the context type, now including the register function
interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string, phone: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// 2. Function to send a welcome SMS
async function sendWelcomeSms(phone: string) {
  try {
    const response = await fetch('/api/send-sms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: `Welcome to DhanSathi! We're excited to have you on board.`,
        recipient: phone,
      }),
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to send welcome SMS:', errorText);
    }
  } catch (error: any) {
    console.error('An unexpected network error occurred during welcome SMS:', error.message);
  }
}

// 3. The AuthProvider component that provides all auth functionality
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // --- FULL LOGIN FUNCTION ---
  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // SMS on login can be handled here if needed in the future
    } catch (error) {
      throw error; // Propagate error to the login page
    } finally {
      setLoading(false);
    }
  };

  // --- FULL REGISTER FUNCTION ---
  const register = async (email: string, password: string, name: string, phone: string) => {
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const newUser = userCredential.user;

      // Update Firebase Auth profile
      await updateProfile(newUser, { displayName: name });

      // Store additional user details in Firestore
      await setDoc(doc(db, 'users', newUser.uid), {
        uid: newUser.uid,
        displayName: name,
        email: email,
        phoneNumber: phone,
        createdAt: new Date(),
      });

      // --- FIX: Send welcome SMS without blocking the process ---
      sendWelcomeSms(phone);

    } catch (error) {
      throw error; // Propagate error to the registration page
    } finally {
      setLoading(false);
    }
  };

  // --- FULL LOGOUT FUNCTION ---
  const logout = async () => {
    await auth.signOut();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// 4. The hook to use the auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
