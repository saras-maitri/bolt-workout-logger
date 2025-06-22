import { db } from "./db";
import { users, routines, routine_exercises, workouts, workout_sets } from "@shared/schema";
import type { User, InsertUser, Routine, InsertRoutine, RoutineExercise, InsertRoutineExercise, Workout, InsertWorkout, WorkoutSet, InsertWorkoutSet } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import bcrypt from "bcryptjs";

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  verifyPassword(user: User, password: string): Promise<boolean>;
  
  // Routine methods
  getRoutinesByUserId(userId: string): Promise<Routine[]>;
  createRoutine(userId: string, routine: InsertRoutine): Promise<Routine>;
  deleteRoutine(routineId: string, userId: string): Promise<void>;
  
  // Routine exercise methods
  getRoutineExercises(routineId: string): Promise<RoutineExercise[]>;
  createRoutineExercise(exercise: InsertRoutineExercise): Promise<RoutineExercise>;
  deleteRoutineExercise(exerciseId: string): Promise<void>;
  
  // Workout methods
  getWorkoutsByUserId(userId: string): Promise<Workout[]>;
  createWorkout(userId: string, workout: InsertWorkout): Promise<Workout>;
  updateWorkout(workoutId: string, userId: string, updates: Partial<Workout>): Promise<Workout>;
  
  // Workout set methods
  getWorkoutSets(workoutId: string): Promise<WorkoutSet[]>;
  createWorkoutSet(workoutSet: InsertWorkoutSet): Promise<WorkoutSet>;
  deleteWorkoutSet(setId: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
    return result[0];
  }

  async createUser(user: InsertUser): Promise<User> {
    const hashedPassword = await bcrypt.hash(user.password, 10);
    const result = await db.insert(users).values({
      username: user.username,
      password: hashedPassword,
    }).returning();
    return result[0];
  }

  async verifyPassword(user: User, password: string): Promise<boolean> {
    return bcrypt.compare(password, user.password);
  }

  async getRoutinesByUserId(userId: string): Promise<Routine[]> {
    return db.select().from(routines).where(eq(routines.user_id, userId));
  }

  async createRoutine(userId: string, routine: InsertRoutine): Promise<Routine> {
    const result = await db.insert(routines).values({
      user_id: userId,
      name: routine.name,
    }).returning();
    return result[0];
  }

  async deleteRoutine(routineId: string, userId: string): Promise<void> {
    await db.delete(routines).where(and(eq(routines.id, routineId), eq(routines.user_id, userId)));
  }

  async getRoutineExercises(routineId: string): Promise<RoutineExercise[]> {
    return db.select().from(routine_exercises).where(eq(routine_exercises.routine_id, routineId));
  }

  async createRoutineExercise(exercise: InsertRoutineExercise): Promise<RoutineExercise> {
    const result = await db.insert(routine_exercises).values(exercise).returning();
    return result[0];
  }

  async deleteRoutineExercise(exerciseId: string): Promise<void> {
    await db.delete(routine_exercises).where(eq(routine_exercises.id, exerciseId));
  }

  async getWorkoutsByUserId(userId: string): Promise<Workout[]> {
    return db.select().from(workouts).where(eq(workouts.user_id, userId));
  }

  async createWorkout(userId: string, workout: InsertWorkout): Promise<Workout> {
    const result = await db.insert(workouts).values({
      user_id: userId,
      ...workout,
    }).returning();
    return result[0];
  }

  async updateWorkout(workoutId: string, userId: string, updates: Partial<Workout>): Promise<Workout> {
    const result = await db.update(workouts)
      .set(updates)
      .where(and(eq(workouts.id, workoutId), eq(workouts.user_id, userId)))
      .returning();
    return result[0];
  }

  async getWorkoutSets(workoutId: string): Promise<WorkoutSet[]> {
    return db.select().from(workout_sets).where(eq(workout_sets.workout_id, workoutId));
  }

  async createWorkoutSet(workoutSet: InsertWorkoutSet): Promise<WorkoutSet> {
    const result = await db.insert(workout_sets).values({
      workout_id: workoutSet.workout_id,
      exercise_name: workoutSet.exercise_name,
      weight: workoutSet.weight.toString(),
      reps: workoutSet.reps,
      rpe: workoutSet.rpe,
      set_number: workoutSet.set_number,
    }).returning();
    return result[0];
  }

  async deleteWorkoutSet(setId: string): Promise<void> {
    await db.delete(workout_sets).where(eq(workout_sets.id, setId));
  }
}

export const storage = new DatabaseStorage();
