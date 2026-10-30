import { User, GameState } from "../types";

interface UserRecord {
  user: User;
  passwordHash?: string;
  gameState?: GameState;
}

const TOKEN_STORAGE_KEY = 'socratic_shell_auth_token';
const USER_STORAGE_KEY = 'socratic_shell_auth_user';

class AuthService {
  private currentUser: User | null = null;
  private authToken: string | null = null;
  private registeredUsers: Map<string, UserRecord> = new Map();

  constructor() {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        const savedToken = window.sessionStorage.getItem(TOKEN_STORAGE_KEY);
        if (savedToken) {
          this.authToken = savedToken;
        }
      } catch {
        // ignore storage errors
      }
    }
  }

  public getToken(): string | null {
    return this.authToken;
  }

  public getAuthHeaders(): Record<string, string> {
    return this.authToken
      ? { 'Content-Type': 'application/json', Authorization: `Bearer ${this.authToken}` }
      : { 'Content-Type': 'application/json' };
  }

  public fetchAuthenticated(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
    const headers = new Headers(this.getAuthHeaders());
    new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    return fetch(input, { ...init, headers });
  }

  private persistSession(user: User | null, token: string | null) {
    this.currentUser = user;
    this.authToken = token;
    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        if (user && token) {
          window.sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
          window.sessionStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
        } else {
          window.sessionStorage.removeItem(TOKEN_STORAGE_KEY);
          window.sessionStorage.removeItem(USER_STORAGE_KEY);
        }
      } catch {
        // ignore storage errors
      }
    }
  }

  public async loginWithServer(username: string, password: string): Promise<User | null> {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password })
      });

      if (res.ok) {
        const data = await res.json();
        if (data?.user && data?.token) {
          this.persistSession(data.user, data.token);
          void this.loadUsersFromServer().catch((error: Error) => console.warn(error.message));
          return data.user;
        }
      }

      const errData = await res.json().catch(() => ({}));
      const message = errData.error || 'Invalid investigator credentials';
      throw new Error(message);
    } catch (err: any) {
      if (err?.message) {
        throw new Error(err.message);
      }
      throw new Error('Authentication failed');
    }
  }

  public async initFromServer() {
    try {
      if (!this.authToken) {
        this.currentUser = null;
        return;
      }
      const sessRes = await fetch('/api/auth/session', {
        headers: this.getAuthHeaders()
      });
      if (!sessRes.ok) {
        this.persistSession(null, null);
        return;
      }
      const sessData = await sessRes.json();
      if (!sessData?.authenticated || !sessData?.user) {
        this.persistSession(null, null);
        return;
      }
      this.persistSession(sessData.user, this.authToken);
      await this.loadUsersFromServer();
    } catch {
      this.persistSession(null, null);
      console.warn("Failed to sync users with server");
    }
  }

  private async loadUsersFromServer() {
    const res = await fetch('/api/users', { headers: this.getAuthHeaders() });
    if (res.status === 403) return;
    if (!res.ok) throw new Error(`Failed to load users (HTTP ${res.status})`);
    const usersData = await res.json();
    const entries = Array.isArray(usersData) ? usersData : Object.values(usersData || {});
    for (const entry of entries as any[]) {
      if (entry?.user?.username) {
        this.registeredUsers.set(entry.user.username, entry);
      }
    }
  }

  private async syncUser(username: string) {
    const record = this.registeredUsers.get(username);
    if (!record || !this.authToken) return;
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          username,
          user: record.user,
          ...(record.passwordHash ? { password: record.passwordHash } : {})
        })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `User update failed (HTTP ${res.status})`);
      }
    } catch (error) {
      console.error("Failed to sync user to server");
      throw error;
    }
  }

  public getAllStudents(): User[] {
    return Array.from(this.registeredUsers.values()).map(r => r.user);
  }

  public async resetStudentPassword(username: string, newPass: string): Promise<void> {
    if (!this.authToken) throw new Error('An authenticated administrator session is required.');
    const record = this.registeredUsers.get(username);
    if (!record) throw new Error("User not found");
    if (newPass.length < 12) throw new Error("Password must be at least 12 characters.");

    record.passwordHash = newPass;
    this.registeredUsers.set(username, record);
    await this.syncUser(username);
  }

  public updateStudentCondition(username: string, condition: 'guided' | 'unguided' | 'none') {
    if (!this.authToken) throw new Error('An authenticated administrator session is required.');
    const record = this.registeredUsers.get(username);
    if (!record) throw new Error("User not found");

    record.user.condition = condition;
    this.registeredUsers.set(username, record);
    void this.syncUser(username).catch((error: Error) => console.error(error.message));
  }

  public updateGameState(username: string, state: GameState) {
    const record = this.registeredUsers.get(username);
    if (!record) return;

    record.gameState = state;
    this.registeredUsers.set(username, record);
    this.syncUser(username);
  }

  public getGameState(username: string): GameState | undefined {
    return this.registeredUsers.get(username)?.gameState;
  }

  public getCurrentUser(): User | null {
    return this.currentUser;
  }

  public logout() {
    const tokenToRevoke = this.authToken;
    this.persistSession(null, null);
    if (tokenToRevoke) {
      fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenToRevoke}`
        },
        body: JSON.stringify({ token: tokenToRevoke })
      }).catch(() => {});
    }
  }
}

export const authService = new AuthService();
