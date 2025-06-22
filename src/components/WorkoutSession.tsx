import React, { useState, useEffect } from 'react';
import { Play, Square, Clock, Plus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

interface Exercise {
  id: string;
  name: string;
  planned_sets: number;
  order_index: number;
}

interface Routine {
  id: string;
  name: string;
  exercises: Exercise[];
}

interface WorkoutSet {
  exercise_name: string;
  weight: number;
  reps: number;
  rpe: number;
  set_number: number;
}

interface ActiveWorkout {
  id: string;
  routine_name: string;
  start_time: string;
  exercises: Exercise[];
}

export function WorkoutSession() {
  const { user } = useAuth();
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [selectedRoutineId, setSelectedRoutineId] = useState<string>('');
  const [activeWorkout, setActiveWorkout] = useState<ActiveWorkout | null>(null);
  const [workoutSets, setWorkoutSets] = useState<WorkoutSet[]>([]);
  const [currentSet, setCurrentSet] = useState<Partial<WorkoutSet>>({
    weight: 0,
    reps: 0,
    rpe: 5
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchRoutines();
    }
  }, [user]);

  const fetchRoutines = async () => {
    if (!user) return;

    try {
      const { data: routinesData, error: routinesError } = await supabase
        .from('routines')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (routinesError) throw routinesError;

      const routinesWithExercises = await Promise.all(
        (routinesData || []).map(async (routine) => {
          const { data: exercises } = await supabase
            .from('routine_exercises')
            .select('*')
            .eq('routine_id', routine.id)
            .order('order_index');

          return {
            ...routine,
            exercises: exercises || []
          };
        })
      );

      setRoutines(routinesWithExercises);
    } catch (error) {
      console.error('Error fetching routines:', error);
    } finally {
      setLoading(false);
    }
  };

  const startWorkout = async () => {
    if (!user || !selectedRoutineId) return;

    const selectedRoutine = routines.find(r => r.id === selectedRoutineId);
    if (!selectedRoutine) return;

    try {
      const { data: workout, error } = await supabase
        .from('workouts')
        .insert({
          user_id: user.id,
          routine_id: selectedRoutineId,
          routine_name: selectedRoutine.name,
          start_time: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      setActiveWorkout({
        id: workout.id,
        routine_name: selectedRoutine.name,
        start_time: workout.start_time,
        exercises: selectedRoutine.exercises
      });
      setWorkoutSets([]);
    } catch (error) {
      console.error('Error starting workout:', error);
    }
  };

  const addSet = async () => {
    if (!activeWorkout || !currentSet.exercise_name || !user) return;

    const exerciseSets = workoutSets.filter(s => s.exercise_name === currentSet.exercise_name);
    const setNumber = exerciseSets.length + 1;

    const newSet: WorkoutSet = {
      exercise_name: currentSet.exercise_name,
      weight: currentSet.weight || 0,
      reps: currentSet.reps || 0,
      rpe: currentSet.rpe || 5,
      set_number: setNumber
    };

    try {
      const { error } = await supabase
        .from('workout_sets')
        .insert({
          workout_id: activeWorkout.id,
          ...newSet
        });

      if (error) throw error;

      setWorkoutSets(prev => [...prev, newSet]);
      setCurrentSet({
        exercise_name: currentSet.exercise_name,
        weight: currentSet.weight || 0,
        reps: currentSet.reps || 0,
        rpe: 5
      });
    } catch (error) {
      console.error('Error adding set:', error);
    }
  };

  const finishWorkout = async () => {
    if (!activeWorkout) return;

    try {
      const { error } = await supabase
        .from('workouts')
        .update({
          end_time: new Date().toISOString()
        })
        .eq('id', activeWorkout.id);

      if (error) throw error;

      setActiveWorkout(null);
      setWorkoutSets([]);
      setCurrentSet({ weight: 0, reps: 0, rpe: 5 });
      setSelectedRoutineId('');
    } catch (error) {
      console.error('Error finishing workout:', error);
    }
  };

  const formatDuration = (startTime: string) => {
    const start = new Date(startTime);
    const now = new Date();
    const diff = Math.floor((now.getTime() - start.getTime()) / 1000 / 60);
    return `${diff}m`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-4 space-y-6">
      {!activeWorkout ? (
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Start Workout</h2>
            <p className="text-gray-600">Select a routine to begin your workout session</p>
          </div>

          {routines.length === 0 ? (
            <div className="text-center py-12">
              <Play className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-500 mb-2">No routines available</h3>
              <p className="text-gray-400">Create a routine first to start working out</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Choose Routine
                </label>
                <select
                  value={selectedRoutineId}
                  onChange={(e) => setSelectedRoutineId(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select a routine...</option>
                  {routines.map((routine) => (
                    <option key={routine.id} value={routine.id}>
                      {routine.name} ({routine.exercises.length} exercises)
                    </option>
                  ))}
                </select>
              </div>

              {selectedRoutineId && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-3">Preview:</h3>
                  <div className="space-y-2">
                    {routines
                      .find(r => r.id === selectedRoutineId)
                      ?.exercises.map((exercise, index) => (
                      <div key={index} className="flex justify-between items-center py-2">
                        <span className="text-gray-700">{exercise.name}</span>
                        <span className="text-sm text-gray-500">{exercise.planned_sets} sets</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={startWorkout}
                disabled={!selectedRoutineId}
                className="w-full bg-gradient-to-r from-green-500 to-blue-500 text-white py-4 px-6 rounded-lg font-semibold text-lg hover:from-green-600 hover:to-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center shadow-lg"
              >
                <Play className="w-6 h-6 mr-2" />
                Start Workout
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-green-500 to-blue-500 text-white rounded-xl p-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xl font-bold">{activeWorkout.routine_name}</h2>
              <div className="flex items-center">
                <Clock className="w-5 h-5 mr-2" />
                <span className="font-semibold">{formatDuration(activeWorkout.start_time)}</span>
              </div>
            </div>
            <p className="opacity-90">Workout in progress</p>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Log Set</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Exercise
                </label>
                <select
                  value={currentSet.exercise_name || ''}
                  onChange={(e) => setCurrentSet(prev => ({ ...prev, exercise_name: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select exercise...</option>
                  {activeWorkout.exercises.map((exercise) => (
                    <option key={exercise.id} value={exercise.name}>
                      {exercise.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Weight (lbs)
                  </label>
                  <input
                    type="number"
                    value={currentSet.weight || ''}
                    onChange={(e) => setCurrentSet(prev => ({ ...prev, weight: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center"
                    min="0"
                    step="0.5"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Reps
                  </label>
                  <input
                    type="number"
                    value={currentSet.reps || ''}
                    onChange={(e) => setCurrentSet(prev => ({ ...prev, reps: parseInt(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center"
                    min="0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    RPE
                  </label>
                  <input
                    type="number"
                    value={currentSet.rpe || 5}
                    onChange={(e) => setCurrentSet(prev => ({ ...prev, rpe: parseInt(e.target.value) || 5 }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center"
                    min="1"
                    max="10"
                  />
                </div>
              </div>

              <button
                onClick={addSet}
                disabled={!currentSet.exercise_name}
                className="w-full bg-orange-500 text-white py-3 px-4 rounded-lg font-medium hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center"
              >
                <Plus className="w-5 h-5 mr-2" />
                Add Set
              </button>
            </div>
          </div>

          {workoutSets.length > 0 && (
            <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Completed Sets</h3>
              <div className="space-y-3">
                {workoutSets.map((set, index) => (
                  <div key={index} className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded-lg">
                    <div>
                      <span className="font-medium text-gray-900">{set.exercise_name}</span>
                      <span className="text-sm text-gray-500 ml-2">Set {set.set_number}</span>
                    </div>
                    <div className="text-sm text-gray-600">
                      {set.weight}lbs × {set.reps} @ RPE {set.rpe}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={finishWorkout}
            className="w-full bg-gradient-to-r from-red-500 to-orange-500 text-white py-4 px-6 rounded-lg font-semibold text-lg hover:from-red-600 hover:to-orange-600 transition-all duration-200 flex items-center justify-center shadow-lg"
          >
            <Square className="w-6 h-6 mr-2" />
            Finish Workout
          </button>
        </div>
      )}
    </div>
  );
}