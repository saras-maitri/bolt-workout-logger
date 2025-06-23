import React, { useState, useEffect } from "react";
import {
  Calendar,
  Clock,
  ChevronDown,
  ChevronUp,
  Dumbbell,
  Trash2,
  Edit3,
  Save,
  X,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../hooks/useAuth";

interface WorkoutSet {
  id: string;
  exercise_name: string;
  weight: number;
  reps: number;
  rpe: number;
  set_number: number;
  workout_id?: string;
}

interface CompletedWorkout {
  id: string;
  routine_name: string;
  start_time: string;
  end_time: string;
  sets: WorkoutSet[];
}

export function WorkoutHistory() {
  const { user } = useAuth();
  const [workouts, setWorkouts] = useState<CompletedWorkout[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedWorkout, setExpandedWorkout] = useState<string | null>(null);
  const [editingSetId, setEditingSetId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{ weight: number; reps: number; rpe: number }>({ weight: 0, reps: 0, rpe: 0 });

  useEffect(() => {
    if (user) {
      fetchWorkouts();
    }
  }, [user]);

  const fetchWorkouts = async () => {
    if (!user) return;

    try {
      // Fetch completed workouts (those with end_time)
      const { data: workoutsData, error: workoutsError } = await supabase
        .from('workouts')
        .select('*')
        .eq('user_id', user.id)
        .not('end_time', 'is', null)
        .order('start_time', { ascending: false });

      if (workoutsError) throw workoutsError;

      // Fetch sets for each workout
      const workoutsWithSets = await Promise.all(
        (workoutsData || []).map(async (workout) => {
          const { data: sets, error: setsError } = await supabase
            .from('workout_sets')
            .select('*')
            .eq('workout_id', workout.id)
            .order('set_number', { ascending: true });

          if (setsError) throw setsError;

          return {
            ...workout,
            sets: sets || [],
          };
        }),
      );

      setWorkouts(workoutsWithSets);
    } catch (error) {
      console.error("Error fetching workouts:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const calculateDuration = (startTime: string, endTime: string) => {
    const start = new Date(startTime);
    const end = new Date(endTime);
    const diffMs = end.getTime() - start.getTime();
    const diffMins = Math.floor(diffMs / 1000 / 60);

    if (diffMins < 60) {
      return `${diffMins}m`;
    } else {
      const hours = Math.floor(diffMins / 60);
      const mins = diffMins % 60;
      return `${hours}h ${mins}m`;
    }
  };

  const getUniqueExercises = (sets: WorkoutSet[]) => {
    const exercises = new Map();
    sets.forEach((set) => {
      if (!exercises.has(set.exercise_name)) {
        exercises.set(set.exercise_name, []);
      }
      exercises.get(set.exercise_name).push(set);
    });
    return exercises;
  };

  const toggleWorkoutExpansion = (workoutId: string) => {
    setExpandedWorkout(expandedWorkout === workoutId ? null : workoutId);
  };

  const deleteWorkout = async (workoutId: string) => {
    if (!confirm('Are you sure you want to delete this workout? This action cannot be undone.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('workouts')
        .delete()
        .eq('id', workoutId)
        .eq('user_id', user!.id);

      if (error) throw error;

      // Remove from local state
      setWorkouts(prev => prev.filter(w => w.id !== workoutId));
    } catch (error) {
      console.error('Error deleting workout:', error);
    }
  };

  const startEditSet = (set: WorkoutSet) => {
    setEditingSetId(set.id);
    setEditValues({ weight: set.weight, reps: set.reps, rpe: set.rpe });
  };

  const saveEditSet = async () => {
    if (!editingSetId) return;

    try {
      const { error } = await supabase
        .from('workout_sets')
        .update({
          weight: editValues.weight,
          reps: editValues.reps,
          rpe: editValues.rpe,
        })
        .eq('id', editingSetId);

      if (error) throw error;

      // Update the local state
      setWorkouts(prev => prev.map(workout => ({
        ...workout,
        sets: workout.sets.map(s => 
          s.id === editingSetId ? { ...s, ...editValues } : s
        )
      })));

      setEditingSetId(null);
    } catch (error) {
      console.error('Error updating set:', error);
    }
  };

  const deleteSet = async (setId: string) => {
    if (!confirm('Are you sure you want to delete this set?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('workout_sets')
        .delete()
        .eq('id', setId);

      if (error) throw error;
      
      // Update local state
      setWorkouts(prev => prev.map(workout => ({
        ...workout,
        sets: workout.sets.filter(s => s.id !== setId)
      })));
    } catch (error) {
      console.error('Error deleting set:', error);
    }
  };

  const cancelEdit = () => {
    setEditingSetId(null);
    setEditValues({ weight: 0, reps: 0, rpe: 0 });
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
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Workout History
        </h2>
        <p className="text-gray-600">View your completed workouts</p>
      </div>

      {workouts.length === 0 ? (
        <div className="text-center py-12">
          <Dumbbell className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-500 mb-2">
            No completed workouts
          </h3>
          <p className="text-gray-400">
            Start and finish a workout to see it here
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {workouts.map((workout) => {
            const isExpanded = expandedWorkout === workout.id;
            const exerciseGroups = getUniqueExercises(workout.sets);

            return (
              <div
                key={workout.id}
                className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden"
              >
                <div
                  className="p-6 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => toggleWorkoutExpansion(workout.id)}
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {workout.routine_name}
                    </h3>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteWorkout(workout.id);
                        }}
                        className="text-red-600 hover:text-red-800 p-1"
                        title="Delete workout"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-sm text-gray-600">
                    <div className="flex items-center">
                      <Calendar className="w-4 h-4 mr-2" />
                      <span>{formatDate(workout.start_time)}</span>
                    </div>
                    <div className="flex items-center">
                      <Clock className="w-4 h-4 mr-2" />
                      <span>
                        {calculateDuration(
                          workout.start_time,
                          workout.end_time,
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-sm text-gray-500">
                      {formatTime(workout.start_time)} -{" "}
                      {formatTime(workout.end_time)}
                    </span>
                    <span className="text-sm font-medium text-blue-600">
                      {workout.sets.length} sets
                    </span>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-gray-200 p-6 bg-gray-50">
                    <h4 className="font-semibold text-gray-900 mb-4">
                      Exercise Details
                    </h4>
                    <div className="space-y-4">
                      {Array.from(exerciseGroups.entries()).map(
                        ([exerciseName, sets]) => (
                          <div
                            key={exerciseName}
                            className="bg-white rounded-lg p-4 border border-gray-200"
                          >
                            <h5 className="font-medium text-gray-900 mb-3">
                              {exerciseName}
                            </h5>
                            <div className="space-y-2">
                              {sets.map((set: WorkoutSet, index: number) => (
                                <div
                                  key={set.id}
                                  className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded-lg"
                                >
                                  {editingSetId === set.id ? (
                                    <div className="flex items-center space-x-3 flex-1">
                                      <span className="text-sm text-gray-600">
                                        Set {set.set_number}
                                      </span>
                                      <div className="flex space-x-2 flex-1">
                                        <input
                                          type="number"
                                          value={editValues.weight}
                                          onChange={(e) => setEditValues(prev => ({ ...prev, weight: Number(e.target.value) }))}
                                          className="w-16 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                                          placeholder="kg"
                                        />
                                        <span className="text-xs text-gray-500 self-center">×</span>
                                        <input
                                          type="number"
                                          value={editValues.reps}
                                          onChange={(e) => setEditValues(prev => ({ ...prev, reps: Number(e.target.value) }))}
                                          className="w-14 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                                          placeholder="reps"
                                        />
                                        <span className="text-xs text-gray-500 self-center">@</span>
                                        <input
                                          type="number"
                                          value={editValues.rpe}
                                          onChange={(e) => setEditValues(prev => ({ ...prev, rpe: Number(e.target.value) }))}
                                          className="w-14 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                                          placeholder="RPE"
                                          min="1"
                                          max="10"
                                        />
                                      </div>
                                      <div className="flex space-x-1">
                                        <button
                                          onClick={saveEditSet}
                                          className="text-green-600 hover:text-green-800 p-1"
                                          title="Save changes"
                                        >
                                          <Save className="w-4 h-4" />
                                        </button>
                                        <button
                                          onClick={cancelEdit}
                                          className="text-gray-600 hover:text-gray-800 p-1"
                                          title="Cancel edit"
                                        >
                                          <X className="w-4 h-4" />
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <>
                                      <span className="text-sm text-gray-600">
                                        Set {set.set_number}
                                      </span>
                                      <div className="flex items-center space-x-2">
                                        <div className="text-sm font-medium text-gray-900">
                                          {set.weight}kg × {set.reps} @ RPE {set.rpe}
                                        </div>
                                        <div className="flex space-x-1">
                                          <button
                                            onClick={() => startEditSet(set)}
                                            className="text-blue-600 hover:text-blue-800 p-1"
                                            title="Edit set"
                                          >
                                            <Edit3 className="w-4 h-4" />
                                          </button>
                                          <button
                                            onClick={() => deleteSet(set.id)}
                                            className="text-red-600 hover:text-red-800 p-1"
                                            title="Delete set"
                                          >
                                            <Trash2 className="w-4 h-4" />
                                          </button>
                                        </div>
                                      </div>
                                    </>
                                  )}
                                </div>
                              ))}
                            </div>
                            <div className="mt-3 pt-3 border-t border-gray-200">
                              <div className="flex justify-between text-sm text-gray-600">
                                <span>Total Sets: {sets.length}</span>
                                <span>
                                  Total Reps:{" "}
                                  {sets.reduce(
                                    (sum: number, set: WorkoutSet) =>
                                      sum + set.reps,
                                    0,
                                  )}
                                </span>
                              </div>
                            </div>
                          </div>
                        ),
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}