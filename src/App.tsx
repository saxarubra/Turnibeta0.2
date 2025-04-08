import React, { useState, useEffect } from 'react';
import { useAuth } from './contexts/AuthContext';
import { LoginForm } from './components/auth/LoginForm';
import { SignUpForm } from './components/auth/SignUpForm';
import { PasswordResetForm } from './components/auth/PasswordResetForm';
import ShiftList from './components/shifts/ShiftList';
import { MatrixUploader } from './components/shifts/MatrixUploader';
import { LogOut, User } from 'lucide-react';
import { supabase } from './lib/supabase';

export default function App() {
  const { user, loading, signOut } = useAuth();
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [showMatrix, setShowMatrix] = useState(false);
  const [currentWeekStart, setCurrentWeekStart] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    checkAdminStatus();
  }, [user]);

  const checkAdminStatus = async () => {
    if (!user) return;

    try {
      setError(null);
      const { data, error: supabaseError } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();

      if (supabaseError) {
        throw supabaseError;
      }

      setIsAdmin(data?.role === 'admin' || false);
    } catch (err: any) {
      console.error('Error checking admin status:', err);
      setError(err.message);
      setIsAdmin(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <p className="text-gray-600">Loading...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
          {showPasswordReset ? (
            <PasswordResetForm onBack={() => setShowPasswordReset(false)} />
          ) : (
            <>
              <h2 className="text-2xl font-bold mb-6 text-center">Welcome</h2>
              <div className="space-y-6">
                <LoginForm onForgotPassword={() => setShowPasswordReset(true)} />
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white text-gray-500">Or sign up</span>
                  </div>
                </div>
                <SignUpForm />
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  const handleUploadSuccess = (date: string) => {
    setCurrentWeekStart(date);
    setShowMatrix(true);
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <h1 className="text-xl font-semibold text-gray-900">Shift Management</h1>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 px-3 py-2 bg-indigo-50 rounded-md">
                <User className="h-4 w-4 text-indigo-500" />
                <span className="text-sm font-medium text-indigo-700">{user.user_metadata.full_name}</span>
              </div>
              <button
                onClick={() => signOut()}
                className="flex items-center space-x-2 px-3 py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                <LogOut className="h-4 w-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      </header>
      {error && (
        <div className="max-w-7xl mx-auto px-4 py-2">
          <div className="bg-red-50 text-red-700 p-4 rounded-md mt-4">
            {error}
          </div>
        </div>
      )}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mt-6">
          {!showMatrix ? (
            <MatrixUploader onUploadSuccess={handleUploadSuccess} />
          ) : (
            <ShiftList initialDate={currentWeekStart} />
          )}
        </div>
      </main>
    </div>
  );
}