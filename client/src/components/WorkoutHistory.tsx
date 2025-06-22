import React, { useState, useEffect } from 'react';
import { Calendar, Clock, ChevronDown, ChevronUp, Dumbbell } from 'lucide-react';
import { apiClient } from '../lib/api';
import { useAuth } from '../hooks/useAuth';

interface WorkoutSet {
  id: string;
  exercise_name: string;
  weight: number;
  reps: number;
  rpe: number;
  set_number: number;
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

  useEffect(() => {
    if (user) {
      fetchWorkouts();
    }
  }, [user]);

  const fetchWorkouts = async () => {
    if (!user) return;

    try {
      // Fetch completed workouts (those with end_time)
      const workoutsData = await apiClient.getWorkouts();
      const completedWorkouts = workoutsData.filter(workout => workout.end_time);

      // Fetch sets for each workout
      const workoutsWithSets = await Promise.all(
        completedWorkouts.map(async (workout) => {
          const sets = await apiClient.getWorkoutSets(workout.id);

          return {
            ...workout,
            sets: sets || []
          };
        })
      );

      setWorkouts(workoutsWithSets);
    } catch (error) {
      console.error('Error fetching workouts:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
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
    sets.forEach(set => {
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
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Workout History</h2>
        <p className="text-gray-600">View your completed workouts</p>
      </div>

      {workouts.length === 0 ? (
        <div className="text-center py-12">
          <Dumbbell className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-500 mb-2">No completed workouts</h3>
          <p className="text-gray-400">Start and finish a workout to see it here</p>
        </div>
      ) : (
        <div className="space-y-4">
          {workouts.map((workout) => {
            const isExpanded = expandedWorkout === workout.id;
            const exerciseGroups = getUniqueExercises(workout.sets);
            
            return (
              <div key={workout.id} className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
                <div 
                  className="p-6 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => toggleWorkoutExpansion(workout.id)}
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold text-gray-900">{workout.routine_name}</h3>
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                  
                  <div className="flex items-center justify-between text-sm text-gray-600">
                    <div className="flex items-center">
                      <Calendar className="w-4 h-4 mr-2" />
                      <span>{formatDate(workout.start_time)}</span>
                    </div>
                    <div className="flex items-center">
                      <Clock className="w-4 h-4 mr-2" />
                      <span>{calculateDuration(workout.start_time, workout.end_time)}</span>
                    </div>
                  </div>
                  
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-sm text-gray-500">
                      {formatTime(workout.start_time)} - {formatTime(workout.end_time)}
                    </span>
                    <span className="text-sm font-medium text-blue-600">
                      {workout.sets.length} sets
                    </span>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-gray-200 p-6 bg-gray-50">
                    <h4 className="font-semibold text-gray-900 mb-4">Exercise Details</h4>
                    <div className="space-y-4">
                      {Array.from(exerciseGroups.entries()).map(([exerciseName, sets]) => (
                        <div key={exerciseName} className="bg-white rounded-lg p-4 border border-gray-200">
                          <h5 className="font-medium text-gray-900 mb-3">{exerciseName}</h5>
                          <div className="space-y-2">
                            {sets.map((set: WorkoutSet, index: number) => (
                              <div key={set.id} className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded-lg">
                                <span className="text-sm text-gray-600">Set {set.set_number}</span>
                                <div className="text-sm font-medium text-gray-900">
                                  {set.weight}lbs × {set.reps} @ RPE {set.rpe}
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="mt-3 pt-3 border-t border-gray-200">
                            <div className="flex justify-between text-sm text-gray-600">
                              <span>Total Sets: {sets.length}</span>
                              <span>Total Reps: {sets.reduce((sum: number, set: WorkoutSet) => sum + set.reps, 0)}</span>
                            </div>
                          </div>
                        </div>
                      ))}
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