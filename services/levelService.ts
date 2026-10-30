
import { Level } from '../types';
import { LEVELS as DEFAULT_LEVELS } from '../constants';
import { authService } from './authService';

const STORAGE_KEY = 'socratic_shell_levels_v5_8tasks';
const EIGHT_CANONICAL_LEVELS = DEFAULT_LEVELS.filter(l => l.id >= 1 && l.id <= 8);

export const levelService = {
  // Get all levels (strictly bounded to the 8 canonical tasks in the Version 5 study)
  getLevels: (): Level[] => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(EIGHT_CANONICAL_LEVELS));
      return [...EIGHT_CANONICAL_LEVELS];
    }
    try {
      const parsed: Level[] = JSON.parse(stored);
      const bounded = Array.isArray(parsed)
        ? parsed
            .filter(l => l.id >= 1 && l.id <= 8)
            .map(l => {
              const canonical = EIGHT_CANONICAL_LEVELS.find(c => c.id === l.id);
              return canonical ? { ...l, ...canonical } : l;
            })
        : [...EIGHT_CANONICAL_LEVELS];
      return bounded.length === 8 ? bounded : [...EIGHT_CANONICAL_LEVELS];
    } catch (e) {
      return [...EIGHT_CANONICAL_LEVELS];
    }
  },

  // Sync to server silently
  syncToServer: (levels: Level[]) => {
      authService.fetchAuthenticated('/api/levels', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify(levels)
      }).catch(e => console.warn('Failed to sync levels to server'));
  },

  // Save or Update a single level
  saveLevel: (updatedLevel: Level): Level[] => {
    const levels = levelService.getLevels();
    const index = levels.findIndex(l => l.id === updatedLevel.id);
    
    if (index >= 0) {
      // Update existing
      levels[index] = updatedLevel;
    } else {
      // Create new: Auto-increment ID if needed
      const maxId = levels.length > 0 ? Math.max(...levels.map(l => l.id)) : 0;
      updatedLevel.id = maxId + 1;
      levels.push(updatedLevel);
    }
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(levels));
    levelService.syncToServer(levels);
    return levels;
  },

  // Import entire list (Overwrite)
  importLevels: (newLevels: Level[]): Level[] => {
     localStorage.setItem(STORAGE_KEY, JSON.stringify(newLevels));
     levelService.syncToServer(newLevels);
     return newLevels;
  },

  // Delete a level
  deleteLevel: (id: number): Level[] => {
      let levels = levelService.getLevels();
      levels = levels.filter(l => l.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(levels));
      levelService.syncToServer(levels);
      return levels;
  },

  // Reset to original hardcoded constants
  resetDefaults: (): Level[] => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_LEVELS));
    levelService.syncToServer([...DEFAULT_LEVELS]);
    return [...DEFAULT_LEVELS];
  }
};
