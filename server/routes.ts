import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertUserSchema, insertRoutineSchema, insertRoutineExerciseSchema, insertWorkoutSchema, insertWorkoutSetSchema } from "@shared/schema";
import { z } from "zod";

interface AuthenticatedRequest extends Express.Request {
  user?: { id: string; username: string };
}

// Simple session middleware - in production, use proper session management
const sessions = new Map<string, { id: string; username: string }>();

function generateSessionId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

function authenticateUser(req: AuthenticatedRequest, res: Express.Response, next: Express.NextFunction) {
  const sessionId = req.headers['x-session-id'] as string;
  
  if (!sessionId || !sessions.has(sessionId)) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  req.user = sessions.get(sessionId);
  next();
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Authentication routes
  app.post('/api/auth/signup', async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      
      // Check if user already exists
      const existingUser = await storage.getUserByUsername(userData.username);
      if (existingUser) {
        return res.status(400).json({ error: 'Username already exists' });
      }
      
      const user = await storage.createUser(userData);
      const sessionId = generateSessionId();
      sessions.set(sessionId, { id: user.id, username: user.username });
      
      res.json({ 
        user: { id: user.id, username: user.username },
        sessionId 
      });
    } catch (error) {
      console.error('Signup error:', error);
      res.status(400).json({ error: 'Invalid user data' });
    }
  });

  app.post('/api/auth/signin', async (req, res) => {
    try {
      const { username, password } = req.body;
      
      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      
      const isValid = await storage.verifyPassword(user, password);
      if (!isValid) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      
      const sessionId = generateSessionId();
      sessions.set(sessionId, { id: user.id, username: user.username });
      
      res.json({ 
        user: { id: user.id, username: user.username },
        sessionId 
      });
    } catch (error) {
      console.error('Signin error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/api/auth/signout', (req, res) => {
    const sessionId = req.headers['x-session-id'] as string;
    if (sessionId) {
      sessions.delete(sessionId);
    }
    res.json({ success: true });
  });

  app.get('/api/auth/me', authenticateUser, (req: AuthenticatedRequest, res) => {
    res.json({ user: req.user });
  });

  // Routine routes
  app.get('/api/routines', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
      const routines = await storage.getRoutinesByUserId(req.user!.id);
      res.json(routines);
    } catch (error) {
      console.error('Get routines error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/api/routines', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
      const routineData = insertRoutineSchema.parse(req.body);
      const routine = await storage.createRoutine(req.user!.id, routineData);
      res.json(routine);
    } catch (error) {
      console.error('Create routine error:', error);
      res.status(400).json({ error: 'Invalid routine data' });
    }
  });

  app.delete('/api/routines/:id', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
      await storage.deleteRoutine(req.params.id, req.user!.id);
      res.json({ success: true });
    } catch (error) {
      console.error('Delete routine error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Routine exercise routes
  app.get('/api/routines/:routineId/exercises', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
      const exercises = await storage.getRoutineExercises(req.params.routineId);
      res.json(exercises);
    } catch (error) {
      console.error('Get routine exercises error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/api/routine-exercises', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
      const exerciseData = insertRoutineExerciseSchema.parse(req.body);
      const exercise = await storage.createRoutineExercise(exerciseData);
      res.json(exercise);
    } catch (error) {
      console.error('Create routine exercise error:', error);
      res.status(400).json({ error: 'Invalid exercise data' });
    }
  });

  app.delete('/api/routine-exercises/:id', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
      await storage.deleteRoutineExercise(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error('Delete routine exercise error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Workout routes
  app.get('/api/workouts', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
      const workouts = await storage.getWorkoutsByUserId(req.user!.id);
      res.json(workouts);
    } catch (error) {
      console.error('Get workouts error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/api/workouts', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
      const workoutData = insertWorkoutSchema.parse(req.body);
      const workout = await storage.createWorkout(req.user!.id, workoutData);
      res.json(workout);
    } catch (error) {
      console.error('Create workout error:', error);
      res.status(400).json({ error: 'Invalid workout data' });
    }
  });

  app.patch('/api/workouts/:id', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
      // For updates, we don't need strict validation as it's partial data
      const updates = req.body;
      if (updates.end_time && typeof updates.end_time === 'string') {
        updates.end_time = new Date(updates.end_time);
      }
      const workout = await storage.updateWorkout(req.params.id, req.user!.id, updates);
      res.json(workout);
    } catch (error) {
      console.error('Update workout error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Workout set routes
  app.get('/api/workouts/:workoutId/sets', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
      const sets = await storage.getWorkoutSets(req.params.workoutId);
      res.json(sets);
    } catch (error) {
      console.error('Get workout sets error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/api/workout-sets', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
      const setData = insertWorkoutSetSchema.parse(req.body);
      const workoutSet = await storage.createWorkoutSet(setData);
      res.json(workoutSet);
    } catch (error) {
      console.error('Create workout set error:', error);
      res.status(400).json({ error: 'Invalid set data' });
    }
  });

  app.delete('/api/workout-sets/:id', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
      await storage.deleteWorkoutSet(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error('Delete workout set error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
