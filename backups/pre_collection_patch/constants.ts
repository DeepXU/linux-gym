import { Difficulty, Level } from './types';

export const TERMINAL_WELCOME: string[] = [
  '====================================================================',
  '  LINUX GYM: GUIDED AI RESEARCH EVALUATION PLATFORM (PROTOCOL V5)',
  '  8 Canonical Linux Tasks | 24 Standardized Cases | 9-Dimension Rubric',
  '===================================================================='
];

/**
 * Canonical 8 Linux Task Contexts (Version 5 Research Protocol)
 * Note: Secret flags and prohibitedDisclosures are omitted from the client bundle
 * and exist only in server-side authoritative task storage (server/serverTasks.ts).
 */
export const INITIAL_LEVELS: Level[] = [
  {
    id: 1,
    taskId: 'TASK-001',
    taskDefinitionVersion: '5.0.0',
    title: 'The Beginning',
    difficulty: Difficulty.EASY,
    description: 'Welcome, Cadet. Your first objective is simple. Explore your current directory and read the welcome file to find your first flag.',
    objective: "Find the flag inside 'welcome.txt' in your home directory.",
    hints: [
      'Use the `ls` command to list files in the current directory.',
      'Use the `cat` command followed by the filename to read its contents.'
    ],
    clo: 'CLO-1: Basic directory navigation and file inspection.',
    taskDomain: 'navigation',
    taskType: 'training',
    aiDisabled: false,
    isPostTest: false,
    inclusionStatus: true
  },
  {
    id: 2,
    taskId: 'TASK-002',
    taskDefinitionVersion: '5.0.0',
    title: 'Hidden Secrets',
    difficulty: Difficulty.EASY,
    description: 'Not everything is visible at first glance. Some files in Linux are hidden by default. Find the hidden configuration file in your home directory.',
    objective: 'Locate and read the hidden dotfile in `/home/cadet`.',
    hints: [
      'Hidden files in Linux start with a dot (`.`).',
      'Pass a flag to `ls` (such as `-a` or `-la`) to reveal hidden files.'
    ],
    clo: 'CLO-2: Identifying and inspecting hidden dotfiles and metadata.',
    taskDomain: 'navigation',
    taskType: 'training',
    aiDisabled: false,
    isPostTest: false,
    inclusionStatus: true
  },
  {
    id: 3,
    taskId: 'TASK-003',
    taskDefinitionVersion: '5.0.0',
    title: 'Environment Variable',
    difficulty: Difficulty.EASY,
    description: 'Administrators sometimes carelessly store secrets in shell environment variables. Inspect the current shell environment to recover the flag.',
    objective: "Inspect the shell's environment variables to find `SECRET_KEY`.",
    hints: [
      'Commands like `env` or `printenv` display current environment variables.',
      'You can also echo a specific variable using `$VARIABLE_NAME`.'
    ],
    clo: 'CLO-3: Inspecting shell environment variables and process context.',
    taskDomain: 'processes',
    taskType: 'training',
    aiDisabled: false,
    isPostTest: false,
    inclusionStatus: true
  },
  {
    id: 4,
    taskId: 'TASK-004',
    taskDefinitionVersion: '5.0.0',
    title: 'Needle in a Haystack',
    difficulty: Difficulty.MEDIUM,
    description: 'A large system log file at `/var/logs/system.log` contains hundreds of routine entries and one embedded flag.',
    objective: "Filter `/var/logs/system.log` to locate the line containing 'FLAG'.",
    hints: [
      'Reading the entire log manually is inefficient.',
      'Use `grep` to search for a specific text pattern inside `/var/logs/system.log`.'
    ],
    clo: 'CLO-4: Pattern matching and log filtering with grep.',
    taskDomain: 'logs',
    taskType: 'training',
    aiDisabled: false,
    isPostTest: false,
    inclusionStatus: true
  },
  {
    id: 5,
    taskId: 'TASK-005',
    taskDefinitionVersion: '5.0.0',
    title: 'Internal Communications',
    difficulty: Difficulty.MEDIUM,
    description: 'An internal HTTP service is listening only on the local loopback interface on port 8080. Query the local service from the command line.',
    objective: 'Make an HTTP request to `http://localhost:8080` to retrieve the flag.',
    hints: [
      'Command-line HTTP clients like `curl` or `wget` can query local web services.',
      'Target `http://127.0.0.1:8080` or `http://localhost:8080`.'
    ],
    clo: 'CLO-5: Inspecting and querying local network services.',
    taskDomain: 'network',
    taskType: 'training',
    aiDisabled: false,
    isPostTest: false,
    inclusionStatus: true
  },
  {
    id: 6,
    taskId: 'TASK-006',
    taskDefinitionVersion: '5.0.0',
    title: 'Encoded Artifact',
    difficulty: Difficulty.MEDIUM,
    description: 'You found `/home/cadet/secret.b64`, which contains Base64-encoded data. Decode its contents to reveal the plaintext flag.',
    objective: 'Decode `/home/cadet/secret.b64` using the `base64` utility and pipelines.',
    hints: [
      'Inspect `/home/cadet/secret.b64` first to confirm its format.',
      'Use `base64 -d` (or `--decode`) to decode Base64 text.'
    ],
    clo: 'CLO-6: Using standard I/O pipelines and encoding/decoding utilities.',
    taskDomain: 'troubleshooting',
    taskType: 'training',
    aiDisabled: false,
    isPostTest: false,
    inclusionStatus: true
  },
  {
    id: 7,
    taskId: 'TASK-007',
    taskDefinitionVersion: '5.0.0',
    title: 'Access Denied',
    difficulty: Difficulty.HARD,
    description: 'The target file `/root/flag.txt` is owned by root and unreadable by standard privileges. Use your authorized administrative privileges to inspect it.',
    objective: 'Read `/root/flag.txt` using authorized privilege elevation.',
    hints: [
      'Standard `cat /root/flag.txt` will fail with Permission denied.',
      'Check what commands you are authorized to run with elevated privileges (`sudo -l` or `sudo`).'
    ],
    clo: 'CLO-7: Understanding Linux file permissions, ownership, and least-privilege elevation.',
    taskDomain: 'permissions',
    taskType: 'training',
    aiDisabled: false,
    isPostTest: false,
    inclusionStatus: true
  },
  {
    id: 8,
    taskId: 'TASK-008',
    taskDefinitionVersion: '5.0.0',
    title: 'Lost Data',
    difficulty: Difficulty.HARD,
    description: "A critical artifact named 'lost_flag.txt' has been misplaced deep inside the `/var` directory hierarchy.",
    objective: "Locate the file 'lost_flag.txt' hidden somewhere in the '/var' directory.",
    hints: [
      "There is a command specifically named for 'finding' files across directory trees.",
      "Use `find` with the `-name` option starting at `/var`."
    ],
    clo: 'CLO-8: Hierarchical filesystem traversal and pattern-based search using find.',
    taskDomain: 'search',
    taskType: 'training',
    aiDisabled: false,
    isPostTest: false,
    inclusionStatus: true
  }
];

export const LEVELS: Level[] = INITIAL_LEVELS;

