import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit3, Save, X, Dumbbell } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

interface Exercise {
  id?: string;
  name: string;
  planned_sets: number;
  order_index: number;
}

interface Routine {
  id: string;
  name: string;
  exercises: Exercise[];
}

export function RoutineManager() {
  const { user } = useAuth();
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingRoutine, setEditingRoutine] = useState<string | null>(null);
  const [newRoutine, setNewRoutine] = useState({
    name: '',
    exercises: [{ name: '', planned_sets: 3, order_index: 0 } as Exercise]
  });

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
          const { data: exercises, error: exercisesError } = await supabase
            .from('routine_exercises')
            .select('*')
            .eq('routine_id', routine.id)
            .order('order_index', { ascending: true });

          if (exercisesError) throw exercisesError;

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

  const createRoutine = async () => {
    if (!user || !newRoutine.name.trim()) return;

    try {
      const { data: routine, error: routineError } = await supabase
        .from('routines')
        .insert({
          user_id: user.id,
          name: newRoutine.name.trim()
        })
        .select()
        .single();

      if (routineError) throw routineError;

      const exercisesToInsert = newRoutine.exercises
        .filter(ex => ex.name.trim())
        .map((exercise, index) => ({
          routine_id: routine.id,
          name: exercise.name.trim(),
          planned_sets: exercise.planned_sets,
          order_index: index
        }));

      if (exercisesToInsert.length > 0) {
        const { error: exercisesError } = await supabase
          .from('routine_exercises')
          .insert(exercisesToInsert);

        if (exercisesError) throw exercisesError;
      }

      setNewRoutine({
        name: '',
        exercises: [{ name: '', planned_sets: 3, order_index: 0 }]
      });
      setShowCreateForm(false);
      fetchRoutines();
    } catch (error) {
      console.error('Error creating routine:', error);
    }
  };

  const deleteRoutine = async (routineId: string) => {
    try {
      const { error } = await supabase
        .from('routines')
        .delete()
        .eq('id', routineId)
        .eq('user_id', user!.id);

      if (error) throw error;
      fetchRoutines();
    } catch (error) {
      console.error('Error deleting routine:', error);
    }
  };

  const addExercise = () => {
    setNewRoutine(prev => ({
      ...prev,
      exercises: [
        ...prev.exercises,
        { name: '', planned_sets: 3, order_index: prev.exercises.length }
      ]
    }));
  };

  const updateExercise = (index: number, field: keyof Exercise, value: string | number) => {
    setNewRoutine(prev => ({
      ...prev,
      exercises: prev.exercises.map((ex, i) => 
        i === index ? { ...ex, [field]: value } : ex
      )
    }));
  };

  const removeExercise = (index: number) => {
    if (newRoutine.exercises.length > 1) {
      setNewRoutine(prev => ({
        ...prev,
        exercises: prev.exercises.filter((_, i) => i !== index)
      }));
    }
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
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">My Routines</h2>
        <button
          onClick={() => setShowCreateForm(true)}
          className="bg-gradient-to-r from-blue-500 to-purple-500 text-white p-3 rounded-full shadow-lg hover:shadow-xl transition-all duration-200"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {showCreateForm && (
        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Create New Routine</h3>
            <button
              onClick={() => setShowCreateForm(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Routine Name
              </label>
              <input
                type="text"
                value={newRoutine.name}
                onChange={(e) => setNewRoutine(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Chest Day Week 1"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Exercises
              </label>
              <div className="space-y-3">
                {newRoutine.exercises.map((exercise, index) => (
                  <div key={index} className="flex gap-2 items-center">
                    <input
                      type="text"
                      value={exercise.name}
                      onChange={(e) => updateExercise(index, 'name', e.target.value)}
                      placeholder="Exercise name"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <input
                      type="number"
                      value={exercise.planned_sets}
                      onChange={(e) => updateExercise(index, 'planned_sets', parseInt(e.target.value) || 1)}
                      min="1"
                      max="10"
                      className="w-16 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center"
                    />
                    <span className="text-sm text-gray-500">sets</span>
                    {newRoutine.exercises.length > 1 && (
                      <button
                        onClick={() => removeExercise(index)}
                        className="text-red-500 hover:text-red-700 p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              
              <button
                onClick={addExercise}
                className="mt-3 flex items-center text-blue-500 hover:text-blue-600 font-medium"
              >
                <Plus className="w-4 h-4 mr-1" />
                Add Exercise
              </button>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                onClick={createRoutine}
                disabled={!newRoutine.name.trim()}
                className="flex-1 bg-gradient-to-r from-blue-500 to-purple-500 text-white py-3 px-4 rounded-lg font-medium hover:from-blue-600 hover:to-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center"
              >
                <Save className="w-4 h-4 mr-2" />
                Save Routine
              </button>
              <button
                onClick={() => setShowCreateForm(false)}
                className="px-4 py-3 text-gray-600 hover:text-gray-800 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {routines.length === 0 ? (
          <div className="text-center py-12">
            <Dumbbell className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-500 mb-2">No routines yet</h3>
            <p className="text-gray-400">Create your first workout routine to get started</p>
          </div>
        ) : (
          routines.map((routine) => (
            <div key={routine.id} className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">{routine.name}</h3>
                <button
                  onClick={() => deleteRoutine(routine.id)}
                  className="text-red-500 hover:text-red-700 p-2"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              
              <div className="space-y-2">
                {routine.exercises.map((exercise, index) => (
                  <div key={exercise.id || index} className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded-lg">
                    <span className="font-medium text-gray-700">{exercise.name}</span>
                    <span className="text-sm text-gray-500">{exercise.planned_sets} sets</span>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}