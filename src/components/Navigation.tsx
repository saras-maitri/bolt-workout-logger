import React from 'react';
import { Dumbbell, Plus, Play, LogOut } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

interface NavigationProps {
  currentView: 'routines' | 'workout';
  onViewChange: (view: 'routines' | 'workout') => void;
}

export function Navigation({ currentView, onViewChange }: NavigationProps) {
  const { signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-md mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <Dumbbell className="w-8 h-8 text-blue-500" />
            <span className="ml-2 text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Workout Logger
            </span>
          </div>
          
          <button
            onClick={handleSignOut}
            className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
            title="Sign Out"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex space-x-1 pb-4">
          <button
            onClick={() => onViewChange('routines')}
            className={`flex-1 flex items-center justify-center py-3 px-4 rounded-lg font-medium transition-all ${
              currentView === 'routines'
                ? 'bg-blue-500 text-white shadow-md'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Plus className="w-5 h-5 mr-2" />
            Routines
          </button>
          
          <button
            onClick={() => onViewChange('workout')}
            className={`flex-1 flex items-center justify-center py-3 px-4 rounded-lg font-medium transition-all ${
              currentView === 'workout'
                ? 'bg-blue-500 text-white shadow-md'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Play className="w-5 h-5 mr-2" />
            Workout
          </button>
        </div>
      </div>
    </nav>
  );
}