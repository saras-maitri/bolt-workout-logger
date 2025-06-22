import React, { useState, useEffect } from 'react';
import { Play, Square, Clock, Edit3, Trash2, Save, X, ArrowRight } from 'lucide-react';
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
  id?: string;
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
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [currentExercise, setCurrentExercise] = useState<Exercise | null>(null);
  const [setInputs, setSetInputs] = useState<{ weight: number; reps: number; rpe: number }[]>([]);
  const [editingSetId, setEditingSetId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchRoutines();
    }
  }, [user]);

  useEffect(() => {
    if (activeWorkout && activeWorkout.exercises.length > 0) {
      const exercise = activeWorkout.exercises[currentExerciseIndex];
      setCurrentExercise(exercise);
      
      // Initialize set inputs based on planned sets
      const inputs = Array.from({ length: exercise.planned_sets }, () => ({
        weight: 0,
        reps: 0,
        rpe: 5
      }));
      setSetInputs(inputs);
    }
  }, [activeWorkout, currentExerciseIndex]);

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
      setCurrentExerciseIndex(0);
    } catch (error) {
      console.error('Error starting workout:', error);
    }
  };

  const saveAllSets = async () => {
    if (!activeWorkout || !currentExercise) return;

    const setsToSave = setInputs
      .map((input, index) => ({
        workout_id: activeWorkout.id,
        exercise_name: currentExercise.name,
        weight: input.weight,
        reps: input.reps,
        rpe: input.rpe,
        set_number: index + 1
      }))
      .filter(set => set.weight > 0 || set.reps > 0); // Only save sets with data

    if (setsToSave.length === 0) return;

    try {
      const { data, error } = await supabase
        .from('workout_sets')
        .insert(setsToSave)
        .select();

      if (error) throw error;

      const newSets = data.map(set => ({
        id: set.id,
        exercise_name: set.exercise_name,
        weight: set.weight,
        reps: set.reps,
        rpe: set.rpe,
        set_number: set.set_number
      }));

      setWorkoutSets(prev => [...prev, ...newSets]);
    } catch (error) {
      console.error('Error saving sets:', error);
    }
  };

  const goToNextExercise = async () => {
    await saveAllSets();
    
    if (currentExerciseIndex < activeWorkout!.exercises.length - 1) {
      setCurrentExerciseIndex(prev => prev + 1);
    }
  };

  const updateSetInput = (setIndex: number, field: 'weight' | 'reps' | 'rpe', value: number) => {
    setSetInputs(prev => prev.map((input, index) => 
      index === setIndex ? { ...input, [field]: value } : input
    ));
  };

  const deleteSet = async (setId: string) => {
    try {
      const { error } = await supabase
        .from('workout_sets')
        .delete()
        .eq('id', setId);

      if (error) throw error;

      setWorkoutSets(prev => prev.filter(set => set.id !== setId));
    } catch (error) {
      console.error('Error deleting set:', error);
    }
  };

  const updateSet = async (setId: string, updates: Partial<WorkoutSet>) => {
    try {
      const { error } = await supabase
        .from('workout_sets')
        .update(updates)
        .eq('id', setId);

      if (error) throw error;

      setWorkoutSets(prev => prev.map(set => 
        set.id === setId ? { ...set, ...updates } : set
      ));
      setEditingSetId(null);
    } catch (error) {
      console.error('Error updating set:', error);
    }
  };

  const finishWorkout = async () => {
    if (!activeWorkout) return;

    await saveAllSets();

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
      setCurrentExerciseIndex(0);
      setCurrentExercise(null);
      setSetInputs([]);
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

  const getCurrentExerciseSets = () => {
    return workoutSets.filter(set => set.exercise_name === currentExercise?.name);
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
            <p className="opacity-90">
              Exercise {currentExerciseIndex + 1} of {activeWorkout.exercises.length}
            </p>
          </div>

          {currentExercise && (
            <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-900">{currentExercise.name}</h3>
                <span className="text-sm text-gray-500">{currentExercise.planned_sets} sets planned</span>
              </div>

              {/* Set Input Table */}
              <div className="mb-6">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-2 px-2 text-sm font-medium text-gray-700">Set</th>
                        {setInputs.map((_, index) => (
                          <th key={index} className="text-center py-2 px-2 text-sm font-medium text-gray-700">
                            {index + 1}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-gray-100">
                        <td className="py-3 px-2 text-sm font-medium text-gray-700">Weight</td>
                        {setInputs.map((input, index) => (
                          <td key={index} className="py-2 px-1">
                            <input
                              type="number"
                              value={input.weight || ''}
                              onChange={(e) => updateSetInput(index, 'weight', parseFloat(e.target.value) || 0)}
                              className="w-full px-2 py-1 text-center border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent text-sm"
                              min="0"
                              step="0.5"
                              placeholder="0"
                            />
                          </td>
                        ))}
                      </tr>
                      <tr className="border-b border-gray-100">
                        <td className="py-3 px-2 text-sm font-medium text-gray-700">Reps</td>
                        {setInputs.map((input, index) => (
                          <td key={index} className="py-2 px-1">
                            <input
                              type="number"
                              value={input.reps || ''}
                              onChange={(e) => updateSetInput(index, 'reps', parseInt(e.target.value) || 0)}
                              className="w-full px-2 py-1 text-center border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent text-sm"
                              min="0"
                              placeholder="0"
                            />
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="py-3 px-2 text-sm font-medium text-gray-700">RPE</td>
                        {setInputs.map((input, index) => (
                          <td key={index} className="py-2 px-1">
                            <input
                              type="number"
                              value={input.rpe || 5}
                              onChange={(e) => updateSetInput(index, 'rpe', parseInt(e.target.value) || 5)}
                              className="w-full px-2 py-1 text-center border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent text-sm"
                              min="1"
                              max="10"
                            />
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Navigation Buttons */}
              <div className="flex gap-3">
                {currentExerciseIndex < activeWorkout.exercises.length - 1 ? (
                  <button
                    onClick={goToNextExercise}
                    className="flex-1 bg-blue-500 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-600 transition-all duration-200 flex items-center justify-center"
                  >
                    Next Exercise
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </button>
                ) : (
                  <button
                    onClick={saveAllSets}
                    className="flex-1 bg-green-500 text-white py-3 px-4 rounded-lg font-medium hover:bg-green-600 transition-all duration-200 flex items-center justify-center"
                  >
                    <Save className="w-5 h-5 mr-2" />
                    Save Sets
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Completed Sets for Current Exercise */}
          {getCurrentExerciseSets().length > 0 && (
            <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Completed Sets</h3>
              <div className="space-y-3">
                {getCurrentExerciseSets().map((set) => (
                  <div key={set.id} className="flex justify-between items-center py-3 px-4 bg-gray-50 rounded-lg">
                    {editingSetId === set.id ? (
                      <div className="flex-1 grid grid-cols-4 gap-2 items-center">
                        <input
                          type="number"
                          defaultValue={set.weight}
                          className="px-2 py-1 text-center border border-gray-300 rounded text-sm"
                          onBlur={(e) => updateSet(set.id!, { weight: parseFloat(e.target.value) || 0 })}
                          min="0"
                          step="0.5"
                        />
                        <input
                          type="number"
                          defaultValue={set.reps}
                          className="px-2 py-1 text-center border border-gray-300 rounded text-sm"
                          onBlur={(e) => updateSet(set.id!, { reps: parseInt(e.target.value) || 0 })}
                          min="0"
                        />
                        <input
                          type="number"
                          defaultValue={set.rpe}
                          className="px-2 py-1 text-center border border-gray-300 rounded text-sm"
                          onBlur={(e) => updateSet(set.id!, { rpe: parseInt(e.target.value) || 5 })}
                          min="1"
                          max="10"
                        />
                        <button
                          onClick={() => setEditingSetId(null)}
                          className="text-green-600 hover:text-green-800"
                        >
                          <Save className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div>
                          <span className="font-medium text-gray-900">Set {set.set_number}</span>
                          <div className="text-sm text-gray-600">
                            {set.weight}lbs × {set.reps} @ RPE {set.rpe}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setEditingSetId(set.id!)}
                            className="text-blue-600 hover:text-blue-800 p-1"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deleteSet(set.id!)}
                            className="text-red-600 hover:text-red-800 p-1"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </>
                    )}
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