// API client to replace Supabase client calls
class ApiClient {
  private sessionId: string | null = null;
  private baseUrl = '/api';
  private authStateListeners: ((session: any) => void)[] = [];

  constructor() {
    this.sessionId = localStorage.getItem('sessionId');
  }

  private triggerAuthStateChange(session: any) {
    this.authStateListeners.forEach(listener => {
      listener(session);
    });
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.headers as Record<string, string>,
    };

    if (this.sessionId) {
      headers['x-session-id'] = this.sessionId;
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Network error' }));
      throw new Error(error.error || 'Request failed');
    }

    return response.json();
  }

  // Auth methods
  async signUp(username: string, password: string) {
    const result = await this.request<{ user: { id: string; username: string }; sessionId: string }>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    
    this.sessionId = result.sessionId;
    localStorage.setItem('sessionId', result.sessionId);
    
    // Trigger auth state change
    this.triggerAuthStateChange({ user: result.user });
    
    return { data: { user: result.user }, error: null };
  }

  async signIn(username: string, password: string) {
    try {
      const result = await this.request<{ user: { id: string; username: string }; sessionId: string }>('/auth/signin', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      
      this.sessionId = result.sessionId;
      localStorage.setItem('sessionId', result.sessionId);
      
      // Trigger auth state change
      this.triggerAuthStateChange({ user: result.user });
      
      return { data: { user: result.user }, error: null };
    } catch (error) {
      return { data: null, error: { message: (error as Error).message } };
    }
  }

  async signOut() {
    try {
      await this.request('/auth/signout', { method: 'POST' });
      this.sessionId = null;
      localStorage.removeItem('sessionId');
      
      // Trigger auth state change
      this.triggerAuthStateChange(null);
      
      return { error: null };
    } catch (error) {
      return { error: { message: (error as Error).message } };
    }
  }

  async getSession() {
    if (!this.sessionId) {
      return { data: { session: null } };
    }

    try {
      const result = await this.request<{ user: { id: string; username: string } }>('/auth/me');
      return { data: { session: { user: result.user } } };
    } catch (error) {
      this.sessionId = null;
      localStorage.removeItem('sessionId');
      return { data: { session: null } };
    }
  }

  // Routine methods
  async getRoutines() {
    return this.request('/routines');
  }

  async createRoutine(name: string) {
    return this.request('/routines', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  }

  async deleteRoutine(id: string) {
    return this.request(`/routines/${id}`, {
      method: 'DELETE',
    });
  }

  // Routine exercise methods
  async getRoutineExercises(routineId: string) {
    return this.request(`/routines/${routineId}/exercises`);
  }

  async createRoutineExercise(data: { routine_id: string; name: string; planned_sets: number; order_index: number }) {
    return this.request('/routine-exercises', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deleteRoutineExercise(id: string) {
    return this.request(`/routine-exercises/${id}`, {
      method: 'DELETE',
    });
  }

  // Workout methods
  async getWorkouts() {
    return this.request('/workouts');
  }

  async createWorkout(data: { routine_id?: string; routine_name: string; start_time: string }) {
    return this.request('/workouts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateWorkout(id: string, data: { end_time?: string }) {
    return this.request(`/workouts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  // Workout set methods
  async getWorkoutSets(workoutId: string) {
    return this.request(`/workouts/${workoutId}/sets`);
  }

  async createWorkoutSet(data: { workout_id: string; exercise_name: string; weight: number; reps: number; rpe: number; set_number: number }) {
    return this.request('/workout-sets', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deleteWorkoutSet(id: string) {
    return this.request(`/workout-sets/${id}`, {
      method: 'DELETE',
    });
  }

  // Auth state change simulation
  onAuthStateChange(callback: (event: string, session: any) => void) {
    // Add listener to our internal array
    const listener = (session: any) => {
      callback('SIGNED_IN', session);
    };
    this.authStateListeners.push(listener);

    // Also handle storage changes for cross-tab sync
    const handleStorageChange = () => {
      const sessionId = localStorage.getItem('sessionId');
      if (sessionId !== this.sessionId) {
        this.sessionId = sessionId;
        this.getSession().then(({ data }) => {
          callback('TOKEN_REFRESHED', data.session);
        });
      }
    };

    window.addEventListener('storage', handleStorageChange);
    
    return {
      data: {
        subscription: {
          unsubscribe: () => {
            // Remove from listeners array
            const index = this.authStateListeners.indexOf(listener);
            if (index > -1) {
              this.authStateListeners.splice(index, 1);
            }
            window.removeEventListener('storage', handleStorageChange);
          }
        }
      }
    };
  }
}

export const apiClient = new ApiClient();