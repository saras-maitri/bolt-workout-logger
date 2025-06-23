import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Database = {
  public: {
    Tables: {
      routines: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          created_at?: string | null;
        };
      };
      routine_exercises: {
        Row: {
          id: string;
          routine_id: string;
          name: string;
          planned_sets: number;
          order_index: number;
        };
        Insert: {
          id?: string;
          routine_id: string;
          name: string;
          planned_sets?: number;
          order_index?: number;
        };
        Update: {
          id?: string;
          routine_id?: string;
          name?: string;
          planned_sets?: number;
          order_index?: number;
        };
      };
      workouts: {
        Row: {
          id: string;
          user_id: string;
          routine_id: string | null;
          routine_name: string;
          start_time: string;
          end_time: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          routine_id?: string | null;
          routine_name: string;
          start_time: string;
          end_time?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          routine_id?: string | null;
          routine_name?: string;
          start_time?: string;
          end_time?: string | null;
          created_at?: string | null;
        };
      };
      workout_sets: {
        Row: {
          id: string;
          workout_id: string;
          exercise_name: string;
          weight: number;
          reps: number;
          rpe: number;
          set_number: number;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          workout_id: string;
          exercise_name: string;
          weight?: number;
          reps?: number;
          rpe?: number;
          set_number?: number;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          workout_id?: string;
          exercise_name?: string;
          weight?: number;
          reps?: number;
          rpe?: number;
          set_number?: number;
          created_at?: string | null;
        };
      };
    };
  };
};