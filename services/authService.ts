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

  private readonly ADMIN_USER = 'admin';
  private adminPass = 'admin';

  constructor() {
    this.registerStudent('demo_cadet', 'password', false);
    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        const savedToken = window.sessionStorage.getItem(TOKEN_STORAGE_KEY);
        const savedUser = window.sessionStorage.getItem(USER_STORAGE_KEY);
        if (savedToken && savedUser) {
          this.authToken = savedToken;
          this.currentUser = JSON.parse(savedUser);
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
          return data.user;
        }
      } else if (res.status === 401 || res.status === 429) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Invalid investigator credentials');
      }
    } catch (err: any) {
      if (err?.message && (err.message.includes('Invalid') || err.message.includes('Too many'))) {
        throw err;
      }
    }
    return this.loginAsAdmin(username, password);
  }

  public loginAsAdmin(username: string, password: string): User | null {
    if (username === this.ADMIN_USER && password === this.adminPass) {
      const adminUser: User = {
        id: 'admin-001',
        username: 'Administrator',
        role: 'admin'
      };
      this.persistSession(adminUser, this.authToken);
      return adminUser;
    }
    return null;
  }

  public changeAdminPassword(newPass: string): boolean {
    if (!newPass || newPass.length < 4) {
      throw new Error("Password must be at least 4 characters");
    }
    this.adminPass = newPass;
    return true;
  }

  public async initFromServer() {
    try {
      if (this.authToken) {
        const sessRes = await fetch('/api/auth/session', {
          headers: this.getAuthHeaders()
        });
        if (sessRes.ok) {
          const sessData = await sessRes.json();
          if (sessData?.authenticated && sessData?.user) {
            this.persistSession(sessData.user, this.authToken);
          }
        } else if (sessRes.status === 401) {
          this.persistSession(null, null);
        }
      }

      const res = await fetch('/api/users', { headers: this.getAuthHeaders() });
      if (res.ok) {
        const usersData = await res.json();
        const entries = Array.isArray(usersData) ? usersData : Object.values(usersData || {});
        for (const entry of entries as any[]) {
          if (entry?.user?.username) {
            this.registeredUsers.set(entry.user.username, entry);
          }
        }
      }
    } catch {
      console.warn("Failed to sync users with server");
    }
  }

  private async syncUser(username: string) {
    const record = this.registeredUsers.get(username);
    if (!record || !this.authToken) return;
    try {
      await fetch('/api/users', {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(record)
      });
    } catch {
      console.error("Failed to sync user to server");
    }
  }

  public registerStudent(username: string, password?: string, setCurrent: boolean = true): User {
    if (this.registeredUsers.has(username)) {
      throw new Error("Username already taken. Please login or choose another.");
    }

    if (!password || password.length < 4) {
      throw new Error("Password must be at least 4 characters.");
    }

    const id = 'student-' + Math.random().toString(36).substring(2, 9);
    const newUser: User = {
      id,
      username,
      role: 'student',
      condition: 'guided'
    };

    this.registeredUsers.set(username, {
      user: newUser,
      passwordHash: password
    });

    if (setCurrent) {
      this.currentUser = newUser;
      this.syncUser(username);
    }
    return newUser;
  }

  public loginStudent(username: string, password?: string): User {
    const record = this.registeredUsers.get(username);
    if (!record) {
      throw new Error("User not found. Please register first.");
    }

    if (record.passwordHash !== password) {
      throw new Error("Invalid password.");
    }

    this.currentUser = record.user;
    return record.user;
  }

  public getAllStudents(): User[] {
    return Array.from(this.registeredUsers.values()).map(r => r.user);
  }

  public resetStudentPassword(username: string, newPass: string) {
    const record = this.registeredUsers.get(username);
    if (!record) throw new Error("User not found");

    record.passwordHash = newPass;
    this.registeredUsers.set(username, record);
    this.syncUser(username);
  }

  public updateStudentCondition(username: string, condition: 'guided' | 'unguided' | 'none') {
    const record = this.registeredUsers.get(username);
    if (!record) throw new Error("User not found");

    record.user.condition = condition;
    this.registeredUsers.set(username, record);
    this.syncUser(username);
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
