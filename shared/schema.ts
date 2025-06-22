import { pgTable, text, serial, integer, boolean, uuid, timestamp, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  created_at: timestamp("created_at").defaultNow(),
});

export const routines = pgTable("routines", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  created_at: timestamp("created_at").defaultNow(),
});

export const routine_exercises = pgTable("routine_exercises", {
  id: uuid("id").primaryKey().defaultRandom(),
  routine_id: uuid("routine_id").notNull().references(() => routines.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  planned_sets: integer("planned_sets").notNull().default(1),
  order_index: integer("order_index").notNull().default(0),
});

export const workouts = pgTable("workouts", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  routine_id: uuid("routine_id").references(() => routines.id, { onDelete: "set null" }),
  routine_name: text("routine_name").notNull(),
  start_time: timestamp("start_time").notNull(),
  end_time: timestamp("end_time"),
  created_at: timestamp("created_at").defaultNow(),
});

export const workout_sets = pgTable("workout_sets", {
  id: uuid("id").primaryKey().defaultRandom(),
  workout_id: uuid("workout_id").notNull().references(() => workouts.id, { onDelete: "cascade" }),
  exercise_name: text("exercise_name").notNull(),
  weight: decimal("weight", { precision: 5, scale: 2 }).notNull().default("0"),
  reps: integer("reps").notNull().default(0),
  rpe: integer("rpe").notNull().default(5),
  set_number: integer("set_number").notNull().default(1),
  created_at: timestamp("created_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertRoutineSchema = createInsertSchema(routines).pick({
  name: true,
});

export const insertRoutineExerciseSchema = createInsertSchema(routine_exercises).pick({
  routine_id: true,
  name: true,
  planned_sets: true,
  order_index: true,
});

export const insertWorkoutSchema = createInsertSchema(workouts).pick({
  routine_id: true,
  routine_name: true,
  start_time: true,
  end_time: true,
}).extend({
  start_time: z.string().transform((str) => new Date(str)),
  end_time: z.string().transform((str) => new Date(str)).optional(),
});

export const insertWorkoutSetSchema = createInsertSchema(workout_sets).pick({
  workout_id: true,
  exercise_name: true,
  weight: true,
  reps: true,
  rpe: true,
  set_number: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertRoutine = z.infer<typeof insertRoutineSchema>;
export type Routine = typeof routines.$inferSelect;
export type InsertRoutineExercise = z.infer<typeof insertRoutineExerciseSchema>;
export type RoutineExercise = typeof routine_exercises.$inferSelect;
export type InsertWorkout = z.infer<typeof insertWorkoutSchema>;
export type Workout = typeof workouts.$inferSelect;
export type InsertWorkoutSet = z.infer<typeof insertWorkoutSetSchema>;
export type WorkoutSet = typeof workout_sets.$inferSelect;
