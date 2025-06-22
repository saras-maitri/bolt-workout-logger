import React, { useState } from 'react';
import { useAuth } from './hooks/useAuth';
import { Auth } from './components/Auth';
import { Navigation } from './components/Navigation';
import { RoutineManager } from './components/RoutineManager';
import { WorkoutSession } from './components/WorkoutSession';
import { Loader2 } from 'lucide-react';

function App() {
  const { user, loading } = useAuth();
  const [currentView, setCurrentView] = useState<'routines' | 'workout'>('routines');

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Auth />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
      <Navigation currentView={currentView} onViewChange={setCurrentView} />
      
      <main className="pb-6">
        {currentView === 'routines' ? (
          <RoutineManager />
        ) : (
          <WorkoutSession />
        )}
      </main>
    </div>
  );
}

export default App;