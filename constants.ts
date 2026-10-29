import { Difficulty, Level } from './types';

export const TERMINAL_WELCOME: string[] = [
  '====================================================================',
  '  SOCRATIC SHELL: GUIDED AI LINUX & CYBERSECURITY LAB (PROTOCOL V5)',
  '  Run Linux commands below, or type `ask-ai "<question>"` for guidance.',
  '===================================================================='
];

export const DEFAULT_HOW_TO_WORK =
  'Run Linux inspection commands in the terminal below, examine the output, and submit the discovered flag.';

/**
 * Canonical 8 Linux Task Contexts (Version 5 Research Protocol)
 * Each field has a distinct, non-overlapping purpose:
 * - studentTask: What the student needs to accomplish
 * - context: Background scenario explaining why this situation exists
 * - howToWork: What the student should do in the terminal
 * - successEvidence: What observable output confirms success
 * - constraints: Environment boundaries
 */
export const INITIAL_LEVELS: Level[] = [
  {
    id: 1,
    taskId: 'TASK-001',
    taskDefinitionVersion: '5.0.0',
    title: 'The Beginning',
    difficulty: Difficulty.EASY,
    description:
      'Find and read the administrator onboarding note in `/home/cadet` to retrieve your first verification flag.',
    objective: 'Identify the onboarding note in your current working directory and inspect its contents.',
    studentTask: 'Find and read the administrator onboarding note in `/home/cadet` to retrieve your first verification flag.',
    goal: 'Identify the plaintext onboarding file in `/home/cadet` and print its contents.',
    context:
      'You have logged into a newly provisioned Linux workstation as `cadet`, where system administrators leave plaintext onboarding notes in the user home directory.',
    successEvidence:
      'Directory listing and file output in the terminal, followed by flag submission.',
    howToWork:
      'List the files in your current directory, print the contents of the readable note to the terminal, and submit the token below.',
    constraints: [
      'Directory: /home/cadet',
      'Offline sandbox',
      'Standard user (no sudo)'
    ],
    hints: [
      'Which standard command lists entries in your current working directory?',
      'Which utility prints the contents of a plaintext file to standard output?'
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
    description:
      'Uncover the hidden configuration file in `/home/cadet` and read its contents to obtain the verification flag.',
    objective: 'Discover the hidden configuration entry in `/home/cadet` and inspect its contents.',
    studentTask: 'Uncover the hidden configuration file in `/home/cadet` and read its contents to obtain the verification flag.',
    goal: 'Display hidden dotfiles in `/home/cadet` and read the hidden configuration file.',
    context:
      'Linux hides configuration files starting with a dot (`.`) from standard directory listings to prevent accidental modification and keep workspaces uncluttered.',
    successEvidence:
      'Directory listing showing dotfile entries and terminal output of the hidden file.',
    howToWork:
      'Check the local manual (`man` or `--help`) for your directory listing command to find the option that includes hidden entries, then read the revealed file.',
    constraints: [
      'Directory: /home/cadet',
      'Offline sandbox (use man / --help)',
      'Standard user (no sudo)'
    ],
    hints: [
      'What kinds of entries might a default directory listing omit?',
      'Consult the local manual page for your listing utility to see how hidden entries are controlled.'
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
    description:
      'Recover the verification flag stored inside your active shell session environment variables.',
    objective: 'Inspect the current shell environment variables to locate the exported secret token.',
    studentTask: 'Recover the verification flag stored inside your active shell session environment variables.',
    goal: 'Inspect active process environment variables and identify the exported secret key.',
    context:
      'No secret file exists on disk for this task; instead, applications frequently pass configuration values and tokens through in-memory shell environment variables.',
    successEvidence:
      'Terminal output listing the exported environment variable and its verification token.',
    howToWork:
      'Run a shell command that prints active environment variables in your current session, locate the secret variable, and submit its flag value.',
    constraints: [
      'Directory: /home/cadet',
      'In-memory session variable (not on disk)',
      'Standard user (no sudo)'
    ],
    hints: [
      'Where does the shell store session-wide configuration variables when they are not in files?',
      'Which built-in or standard commands display active environment variables?'
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
    description:
      'Isolate the single critical error entry inside the system log file to extract the verification flag.',
    objective: 'Search the system log file to isolate the critical diagnostic record.',
    studentTask: 'Isolate the single critical error entry inside the system log file (`var/log` or `/var/logs`) to extract the verification flag.',
    goal: 'Filter the log file by severity keyword instead of reading every routine line manually.',
    context:
      'System logs accumulate thousands of routine status messages alongside rare failure events, requiring pattern-matching tools during incident triage.',
    successEvidence:
      'Filtered terminal output showing the matching critical log line and verification token.',
    howToWork:
      'Locate the log file and use a command-line text search utility to filter lines matching error or critical severity tags.',
    constraints: [
      'Directory: /home/cadet',
      'Offline sandbox (use man / --help)',
      'Standard user (no sudo)'
    ],
    hints: [
      'Which standard Linux text-filtering utility searches files for lines matching a pattern?',
      'How can you check the manual page for case-sensitivity or pattern options?'
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
    description:
      'Inspect or query the internal service bound to local port 8080 to retrieve its verification flag.',
    objective: 'Identify and query the internal loopback service from the command line.',
    studentTask: 'Inspect local network state or query the loopback service on port 8080 to retrieve the verification flag.',
    goal: 'Obtain the service response or socket dump from localhost port 8080.',
    context:
      'Internal administrative services are often bound exclusively to the loopback interface (`127.0.0.1` / `localhost`) so they can only be accessed locally from the host.',
    successEvidence:
      'Terminal output showing the local port 8080 service response or socket state.',
    howToWork:
      'Inspect the network dump or issue a command-line HTTP request to `localhost:8080` and read the returned payload.',
    constraints: [
      'Directory: /home/cadet',
      'Loopback interface only (no external network)',
      'Standard user (no sudo)'
    ],
    hints: [
      'Which command-line tools can inspect listening ports or send an HTTP request to a local endpoint?',
      'Check local documentation (`--help` or `man`) for how to print response output to the terminal.'
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
    description:
      'Decode the ASCII-encoded file in `/home/cadet` back into readable plaintext to recover the verification flag.',
    objective: 'Inspect the encoded artifact and decode its contents to plaintext.',
    studentTask: 'Decode the ASCII-encoded file in `/home/cadet` back into readable plaintext to recover the verification flag.',
    goal: 'Identify the encoding scheme from the file contents and reverse it using a standard CLI filter.',
    context:
      'Systems frequently encode binary or structured text into printable ASCII strings (such as Base64) for safe transmission; unlike encryption, encoding requires no secret key.',
    successEvidence:
      'Terminal output showing both the encoded string and its decoded plaintext token.',
    howToWork:
      'View the encoded file to recognize its format, check `man` or `--help` for the matching decoding utility option, and decode the file to standard output.',
    constraints: [
      'Directory: /home/cadet',
      'Offline sandbox (use man / --help)',
      'Standard user (no sudo)'
    ],
    hints: [
      'What do the filename and character pattern (such as trailing `=` padding) suggest about the encoding format?',
      'Consult the local manual page for the relevant encoding utility to find the option that decodes input.'
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
    description:
      'Audit your delegated administrative privileges and use authorized elevation to read the restricted verification flag.',
    objective: 'Inspect file permissions and authorized privilege delegation to access the restricted artifact.',
    studentTask: 'Audit your delegated administrative privileges and use authorized elevation to read the restricted verification flag.',
    goal: 'Determine why normal file access is blocked and use authorized `sudo` delegation to read the protected artifact.',
    context:
      'Linux protects sensitive files via ownership and permission bits (`chmod`/`chown`) while granting scoped administrative capabilities through `sudoers` policy.',
    successEvidence:
      'Terminal output showing permission/sudo inspection and authorized retrieval of the protected token.',
    howToWork:
      'Inspect the file permissions and `sudo` policy in your workspace, consult `man sudo` for listing or invoking delegated privileges, and read the protected target.',
    constraints: [
      'Directory: /home/cadet',
      'Offline sandbox',
      'Scoped sudo delegation enabled for user cadet'
    ],
    hints: [
      'What does the error message or permission listing tell you about who owns the restricted resource?',
      'Which option in the `sudo` manual page lists the commands your user is authorized to run?'
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
    description:
      'Search recursively through the multi-level directory tree to locate the misplaced backup file and read its verification flag.',
    objective: 'Traverse the directory hierarchy to locate the misplaced artifact and read its contents.',
    studentTask: 'Search recursively through the directory tree (`var/` or `/var`) to locate the misplaced backup file and read its verification flag.',
    goal: 'Use a recursive filesystem traversal command to find the exact path of the misplaced artifact.',
    context:
      'When files are buried inside deep directory hierarchies, manual folder-by-folder navigation is impractical; operators use recursive search utilities to match files by name or metadata.',
    successEvidence:
      'Terminal output showing the discovered file path from a recursive search and its verification token.',
    howToWork:
      'Use a recursive directory search tool (`find`), check `man find` for filename or hidden-file matching options, and display the contents of the discovered file.',
    constraints: [
      'Directory: /home/cadet',
      'Offline sandbox (use man / --help)',
      'Standard user (no sudo)'
    ],
    hints: [
      'Which Linux utility recursively traverses a starting directory to locate files matching specific criteria?',
      'Consult the manual page for that utility to see how to match by filename or file type.'
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
