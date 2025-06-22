import React, { useState, useEffect } from 'react';
import { Play, Square, Clock, Edit3, Trash2, Save, X, ArrowRight } from 'lucide-react';
import { apiClient } from '../lib/api';
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
      const routinesData = await apiClient.getRoutines();

      const routinesWithExercises = await Promise.all(
        (routinesData || []).map(async (routine) => {
          const exercises = await apiClient.getRoutineExercises(routine.id);

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
      const workout = await apiClient.createWorkout({
        routine_id: selectedRoutineId,
        routine_name: selectedRoutine.name,
        start_time: new Date().toISOString()
      });

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
      const newSets = await Promise.all(setsToSave.map(set => 
        apiClient.createWorkoutSet(set)
      ));

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

  const goToPreviousExercise = async () => {
    if (currentExerciseIndex > 0) {
      await saveAllSets();
      setCurrentExerciseIndex(prev => prev - 1);
    }
  };

  const selectExercise = async (exerciseIndex: number) => {
    if (exerciseIndex !== currentExerciseIndex) {
      await saveAllSets();
      setCurrentExerciseIndex(exerciseIndex);
    }
  };

  const saveSetOnBlur = async (setIndex: number) => {
    if (!activeWorkout || !currentExercise) return;
    
    const setData = setInputs[setIndex];
    if (setData.weight > 0 || setData.reps > 0) {
      try {
        const workoutSet = await apiClient.createWorkoutSet({
          workout_id: activeWorkout.id,
          exercise_name: currentExercise.name,
          weight: setData.weight,
          reps: setData.reps,
          rpe: setData.rpe,
          set_number: setIndex + 1
        });

        setWorkoutSets(prev => {
          const filtered = prev.filter(set => 
            !(set.exercise_name === currentExercise.name && set.set_number === setIndex + 1)
          );
          return [...filtered, workoutSet];
        });
      } catch (error) {
        console.error('Error saving set:', error);
      }
    }
  };

  const deleteSet = async (setId: string) => {
    try {
      await apiClient.deleteWorkoutSet(setId);
      setWorkoutSets(prev => prev.filter(set => set.id !== setId));
    } catch (error) {
      console.error('Error deleting set:', error);
    }
  };

  const updateSet = async (setId: string, updates: Partial<WorkoutSet>) => {
    try {
      // Note: API doesn't have update set endpoint, so we'll handle it locally for now
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
      await apiClient.updateWorkout(activeWorkout.id, {
        end_time: new Date().toISOString()
      });

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
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">{activeWorkout.routine_name}</h2>
              <div className="flex items-center">
                <Clock className="w-5 h-5 mr-2" />
                <span className="font-semibold">{formatDuration(activeWorkout.start_time)}</span>
              </div>
            </div>
            
            {/* Exercise Selection Dropdown */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2 opacity-90">Current Exercise:</label>
              <select
                value={currentExerciseIndex}
                onChange={(e) => selectExercise(Number(e.target.value))}
                className="w-full bg-white/20 backdrop-blur border border-white/30 rounded-lg px-3 py-2 text-white placeholder-white/70 focus:ring-2 focus:ring-white/50 focus:border-transparent"
              >
                {activeWorkout.exercises.map((exercise, index) => (
                  <option key={exercise.id} value={index} className="text-gray-900">
                    {index + 1}. {exercise.name} ({exercise.planned_sets} sets)
                  </option>
                ))}
              </select>
            </div>

            {/* Navigation Buttons */}
            <div className="flex gap-2">
              <button
                onClick={goToPreviousExercise}
                disabled={currentExerciseIndex === 0}
                className="flex-1 bg-white/20 backdrop-blur border border-white/30 rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/30 transition-colors flex items-center justify-center"
              >
                <ArrowRight className="w-4 h-4 mr-1 rotate-180" />
                Previous
              </button>
              <button
                onClick={goToNextExercise}
                disabled={currentExerciseIndex === activeWorkout.exercises.length - 1}
                className="flex-1 bg-white/20 backdrop-blur border border-white/30 rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/30 transition-colors flex items-center justify-center"
              >
                Next
                <ArrowRight className="w-4 h-4 ml-1" />
              </button>
            </div>
          </div>

          {currentExercise && (
            <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-900">{currentExercise.name}</h3>
                <span className="text-sm text-gray-500">{currentExercise.planned_sets} sets planned</span>
              </div>

              {/* Set Input Cards */}
              <div className="mb-6 space-y-4">
                <h4 className="text-lg font-semibold text-gray-900 mb-3">Enter Your Sets</h4>
                <div className="grid gap-4">
                  {setInputs.map((input, index) => (
                    <div key={index} className="bg-gray-50 rounded-xl p-4 border-2 border-gray-200 hover:border-blue-300 transition-colors">
                      <div className="flex items-center justify-between mb-3">
                        <h5 className="font-semibold text-gray-900">Set {index + 1}</h5>
                        <span className="text-xs text-gray-500 bg-gray-200 px-2 py-1 rounded-full">
                          Planned: {currentExercise.planned_sets} sets
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-gray-700">
                            Weight (lbs)
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              value={input.weight || ''}
                              onChange={(e) => updateSetInput(index, 'weight', parseFloat(e.target.value) || 0)}
                              onBlur={() => saveSetOnBlur(index)}
                              className="w-full px-3 py-3 text-center border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg font-semibold bg-white"
                              min="0"
                              step="0.5"
                              placeholder="0"
                            />
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-gray-700">
                            Reps
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              value={input.reps || ''}
                              onChange={(e) => updateSetInput(index, 'reps', parseInt(e.target.value) || 0)}
                              onBlur={() => saveSetOnBlur(index)}
                              className="w-full px-3 py-3 text-center border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg font-semibold bg-white"
                              min="0"
                              placeholder="0"
                            />
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-gray-700">
                            RPE (1-10)
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              value={input.rpe || 5}
                              onChange={(e) => updateSetInput(index, 'rpe', parseInt(e.target.value) || 5)}
                              onBlur={() => saveSetOnBlur(index)}
                              className="w-full px-3 py-3 text-center border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg font-semibold bg-white"
                              min="1"
                              max="10"
                              placeholder="5"
                            />
                          </div>
                        </div>
                      </div>
                      
                      {/* Quick action buttons for common values */}
                      <div className="mt-3 flex gap-2">
                        <div className="flex-1">
                          <p className="text-xs text-gray-500 mb-1">Quick weight:</p>
                          <div className="flex gap-1">
                            {[135, 185, 225, 275, 315].map((weight) => (
                              <button
                                key={weight}
                                onClick={() => updateSetInput(index, 'weight', weight)}
                                className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                              >
                                {weight}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="flex-1">
                          <p className="text-xs text-gray-500 mb-1">Quick reps:</p>
                          <div className="flex gap-1">
                            {[5, 8, 10, 12, 15].map((reps) => (
                              <button
                                key={reps}
                                onClick={() => updateSetInput(index, 'reps', reps)}
                                className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors"
                              >
                                {reps}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Completed Sets Display */}
              {getCurrentExerciseSets().length > 0 && (
                <div className="mb-6">
                  <h4 className="text-lg font-semibold text-gray-900 mb-3">Completed Sets</h4>
                  <div className="space-y-2">
                    {getCurrentExerciseSets().map((set) => (
                      <div key={set.id} className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <span className="bg-green-500 text-white text-sm font-bold px-2 py-1 rounded-full min-w-[2rem] text-center">
                            {set.set_number}
                          </span>
                          <div className="text-gray-900">
                            <span className="font-semibold">{set.weight} lbs</span>
                            <span className="mx-2 text-gray-400">×</span>
                            <span className="font-semibold">{set.reps} reps</span>
                            <span className="mx-2 text-gray-400">@</span>
                            <span className="font-semibold">RPE {set.rpe}</span>
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
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Navigation Buttons */}
              <div className="flex gap-3">
                {currentExerciseIndex < activeWorkout.exercises.length - 1 ? (
                  <button
                    onClick={goToNextExercise}
                    className="flex-1 bg-gradient-to-r from-blue-500 to-blue-600 text-white py-4 px-6 rounded-xl font-semibold text-lg hover:from-blue-600 hover:to-blue-700 transition-all duration-200 flex items-center justify-center shadow-lg"
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