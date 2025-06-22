/*
  # Workout Logging App Database Schema

  1. New Tables
    - `routines`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `name` (text)
      - `created_at` (timestamp)
    - `routine_exercises`
      - `id` (uuid, primary key)
      - `routine_id` (uuid, references routines)
      - `name` (text)
      - `planned_sets` (integer)
      - `order_index` (integer)
    - `workouts`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `routine_id` (uuid, references routines)
      - `start_time` (timestamptz)
      - `end_time` (timestamptz)
      - `created_at` (timestamp)
    - `workout_sets`
      - `id` (uuid, primary key)
      - `workout_id` (uuid, references workouts)
      - `exercise_name` (text)
      - `weight` (decimal)
      - `reps` (integer)
      - `rpe` (integer)
      - `set_number` (integer)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to manage their own data
*/

-- Create routines table
CREATE TABLE IF NOT EXISTS routines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create routine_exercises table
CREATE TABLE IF NOT EXISTS routine_exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  routine_id uuid REFERENCES routines(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  planned_sets integer NOT NULL DEFAULT 1,
  order_index integer NOT NULL DEFAULT 0
);

-- Create workouts table
CREATE TABLE IF NOT EXISTS workouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  routine_id uuid REFERENCES routines(id) ON DELETE SET NULL,
  routine_name text NOT NULL,
  start_time timestamptz NOT NULL,
  end_time timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Create workout_sets table
CREATE TABLE IF NOT EXISTS workout_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_id uuid REFERENCES workouts(id) ON DELETE CASCADE NOT NULL,
  exercise_name text NOT NULL,
  weight decimal(5,2) NOT NULL DEFAULT 0,
  reps integer NOT NULL DEFAULT 0,
  rpe integer NOT NULL DEFAULT 5,
  set_number integer NOT NULL DEFAULT 1,
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE routines ENABLE ROW LEVEL SECURITY;
ALTER TABLE routine_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_sets ENABLE ROW LEVEL SECURITY;

-- Routines policies
CREATE POLICY "Users can manage their own routines"
  ON routines
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Routine exercises policies
CREATE POLICY "Users can manage exercises for their routines"
  ON routine_exercises
  FOR ALL
  TO authenticated
  USING (
    routine_id IN (
      SELECT id FROM routines WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    routine_id IN (
      SELECT id FROM routines WHERE user_id = auth.uid()
    )
  );

-- Workouts policies
CREATE POLICY "Users can manage their own workouts"
  ON workouts
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Workout sets policies
CREATE POLICY "Users can manage sets for their workouts"
  ON workout_sets
  FOR ALL
  TO authenticated
  USING (
    workout_id IN (
      SELECT id FROM workouts WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    workout_id IN (
      SELECT id FROM workouts WHERE user_id = auth.uid()
    )
  );