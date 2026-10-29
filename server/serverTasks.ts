import { Level, Difficulty } from '../types';
import { INITIAL_LEVELS, DEFAULT_HOW_TO_WORK } from '../constants';

const RAW_SERVER_TASKS: Level[] = [
  {
    id: 1,
    taskId: 'TASK-001',
    taskDefinitionVersion: '5.0.0',
    title: 'The Beginning',
    description: 'You have dropped into a new system. Your first order of business is to get your bearings and find the welcome note left by the previous admin.',
    difficulty: Difficulty.EASY,
    objective: 'Identify the onboarding note in your current working directory and inspect its contents.',
    studentTask: 'List the contents of your home directory and read the onboarding text file.',
    goal: 'Observe the directory listing in `/home/cadet` and display the contents of the onboarding note.',
    context: 'You have just logged into a fresh Linux terminal session. System administrators often leave plaintext onboarding notes in the user home directory. Before running unfamiliar programs, you should inspect what files exist in your current location.',
    successEvidence: 'Terminal evidence showing directory enumeration and file content inspection, followed by submitting the discovered verification flag token.',
    howToWork: DEFAULT_HOW_TO_WORK,
    constraints: [
      'Working directory: /home/cadet',
      'Offline isolated sandbox (no external internet access)',
      'Standard user account (sudo privileges disabled)'
    ],
    flag: 'FLAG{linux_basics_mastered}',
    systemContext: `
      You are a standard Linux shell (bash). 
      User: cadet
      CWD: /home/cadet
      
      File System:
      /home/cadet/
      ├── welcome.txt (Content: "Welcome! Flag: FLAG{linux_basics_mastered}")
      └── instructions.md
      
      If 'ls', list files. If 'cat welcome.txt', show content.
    `,
    hints: [
      'How do you see what is in your current folder?',
      'Once you see the file name, how do you read it?'
    ],
    clo: 'CLO-1: Command-line interface navigation, file identification, and standard file viewing.',
    taskDomain: 'navigation',
    expectedEvidence: 'Directory listing showing welcome.txt and cat output containing the flag token.',
    expectedWarrant: 'In Linux, standard files in the current working directory are revealed by ls and their plain-text content is printed with cat.',
    acceptableAlternativePaths: ['cat welcome.txt', 'more welcome.txt', 'head welcome.txt', 'less welcome.txt'],
    commonMisconceptions: ['Assuming files must be clicked to open', 'Confusing directory path with file name'],
    approvedHintProgression: [
      { level: 0, title: 'Clarification', text: 'What command have you executed to inspect what is currently in your working directory?' },
      { level: 1, title: 'Socratic Inquiry', text: 'Which core utility lists files in the current working directory?' },
      { level: 2, title: 'Conceptual Reminder', text: 'Remember that files must first be listed before their contents can be read.' },
      { level: 3, title: 'Procedural Guidance', text: 'Use a directory listing utility to inspect current directory entries, then read the discovered onboarding note.' },
      { level: 4, title: 'Bounded Example', text: 'For example, you can view file contents using `cat <filename>`.' }
    ],
    prohibitedDisclosures: ['welcome.txt', 'FLAG{linux_basics_mastered}', 'cat welcome.txt'],
    taskType: 'training',
    aiDisabled: false,
    safeResetProcedure: 'rm -f /home/cadet/user_*; cd /home/cadet',
    initialSignature: { files: ['welcome.txt', 'instructions.md'], cwd: '/home/cadet', user: 'cadet' },
    inclusionStatus: true
  },
  {
    id: 2,
    taskId: 'TASK-002',
    taskDefinitionVersion: '5.0.0',
    title: 'Hidden Secrets',
    description: 'Intelligence suggests there is a config file in this directory, but a standard file listing does not reveal it.',
    difficulty: Difficulty.EASY,
    objective: 'Discover the hidden configuration entry in `/home/cadet` and inspect its contents.',
    studentTask: 'Locate the hidden configuration file in your home directory and read its contents.',
    goal: 'Reveal hidden directory entries in `/home/cadet` and inspect the hidden configuration file without receiving the filename directly.',
    context: 'Linux utilities omit certain configuration entries from default directory listings to keep working directories tidy. You need to determine how directory listing commands handle hidden entries and inspect the local manual page to identify the appropriate option.',
    successEvidence: 'Terminal evidence showing hidden entries in `/home/cadet` and inspection of the hidden file, followed by submitting the discovered verification flag token.',
    howToWork: DEFAULT_HOW_TO_WORK,
    constraints: [
      'Working directory: /home/cadet',
      'Offline isolated sandbox (use local documentation such as man or --help)',
      'Standard user account (sudo privileges disabled)'
    ],
    flag: 'FLAG{hidden_files_revealed}',
    systemContext: `
      User: cadet
      CWD: /home/cadet
      
      File System:
      /home/cadet/
      ├── .secret_config (Content: "FLAG=FLAG{hidden_files_revealed}")
      ├── public.txt
    `,
    hints: [
      "What kinds of entries might a default directory listing omit?",
      'Consult the local manual page for your listing utility to see how hidden entries are controlled.'
    ],
    clo: 'CLO-2: Linux filesystem dotfile conventions and command-line argument mechanics.',
    taskDomain: 'navigation',
    expectedEvidence: 'Directory listing with -a flag showing .secret_config and its decoded flag.',
    expectedWarrant: 'Files prefixed with a dot (.) are hidden from standard ls and require the -a / -la flag.',
    acceptableAlternativePaths: ['ls -a', 'ls -la', 'ls -al', 'cat .secret_config'],
    commonMisconceptions: ['Thinking hidden files require root privilege', 'Thinking hidden files are encrypted'],
    approvedHintProgression: [
      { level: 0, title: 'Clarification', text: 'What flags or options did you provide to the listing command?' },
      { level: 1, title: 'Socratic Inquiry', text: 'Why might a standard `ls` command omit certain files by default?' },
      { level: 2, title: 'Conceptual Reminder', text: 'Linux treats files beginning with a dot (.) as hidden files.' },
      { level: 3, title: 'Procedural Guidance', text: 'Check the manual or help for `ls` options that display hidden entries.' },
      { level: 4, title: 'Bounded Example', text: 'Inspect `man ls` for the option that does not ignore entries starting with `.`.' }
    ],
    prohibitedDisclosures: ['.secret_config', '.secret_mission', 'FLAG{hidden_files_revealed}', 'cat .secret_config'],
    taskType: 'training',
    aiDisabled: false,
    safeResetProcedure: 'cd /home/cadet',
    initialSignature: { files: ['.secret_config', 'public.txt'], cwd: '/home/cadet', user: 'cadet' },
    inclusionStatus: true
  },
  {
    id: 3,
    taskId: 'TASK-003',
    taskDefinitionVersion: '5.0.0',
    title: 'Environment Variable',
    description: "We cannot find the key in any file on disk. It appears the developer left the secret resident in the shell's memory.",
    difficulty: Difficulty.EASY,
    objective: 'Inspect the current shell environment variables to locate the exported secret token.',
    studentTask: 'Examine the active shell environment variables in your session and recover the stored token.',
    goal: 'List the current process environment variables and identify the variable holding the verification token.',
    context: 'Processes in Linux inherit key-value environment variables from their parent shell. Developers sometimes store sensitive tokens in environment variables rather than writing them to disk files.',
    successEvidence: 'Terminal output displaying the active shell environment variables and the verification token, followed by flag submission.',
    howToWork: DEFAULT_HOW_TO_WORK,
    constraints: [
      'Working directory: /home/cadet',
      'Offline isolated sandbox (no external internet access)',
      'Standard user account (sudo privileges disabled)'
    ],
    flag: 'FLAG{env_vars_insecure}',
    systemContext: `
      User: cadet
      CWD: /home/cadet
      Env Vars: SECRET_KEY=FLAG{env_vars_insecure}
    `,
    hints: [
      'Where does the shell store global variables?',
      'Which built-in or standard commands display active environment variables?'
    ],
    clo: 'CLO-3: Shell environment variables, session state inspection, and credential handling.',
    taskDomain: 'troubleshooting',
    expectedEvidence: 'Environment dump showing the SECRET_KEY variable and its assigned token value.',
    expectedWarrant: 'Environment variables are held in process memory and can be inspected via env, printenv, or echo.',
    acceptableAlternativePaths: ['env', 'printenv', 'printenv SECRET_KEY', 'echo $SECRET_KEY'],
    commonMisconceptions: ['Searching disk files when variables exist in memory'],
    approvedHintProgression: [
      { level: 0, title: 'Clarification', text: 'Are you searching disk storage or process memory variables?' },
      { level: 1, title: 'Socratic Inquiry', text: 'How can you view variables passed into your current shell process?' },
      { level: 2, title: 'Conceptual Reminder', text: 'Environment variables are printed using commands related to the environment.' },
      { level: 3, title: 'Procedural Guidance', text: 'Try running `env` or `printenv` to view active variables.' },
      { level: 4, title: 'Bounded Example', text: 'You can query specific variables with `echo $VARIABLE_NAME`.' }
    ],
    prohibitedDisclosures: ['SECRET_KEY', 'FLAG{env_vars_insecure}', 'printenv SECRET_KEY'],
    taskType: 'training',
    aiDisabled: false,
    safeResetProcedure: 'export SECRET_KEY=FLAG{env_vars_insecure}',
    initialSignature: { envVars: ['SECRET_KEY'], cwd: '/home/cadet' },
    inclusionStatus: true
  },
  {
    id: 4,
    taskId: 'TASK-004',
    taskDefinitionVersion: '5.0.0',
    title: 'Needle in a Haystack',
    description: "A critical event occurred, but it's buried inside the system logs.",
    difficulty: Difficulty.MEDIUM,
    objective: 'Search the system log file to isolate the critical diagnostic record.',
    studentTask: 'Filter the system log file in `/var/logs` (or `var/log`) to find the critical event entry.',
    goal: 'Locate the specific log line recording a critical event without manually reading every routine line.',
    context: 'Production log files often contain thousands of routine status lines. System administrators rely on command-line pattern-matching utilities to filter text streams for specific severity tags.',
    successEvidence: 'Terminal output showing pattern-filtered log lines containing the critical entry and verification token.',
    howToWork: DEFAULT_HOW_TO_WORK,
    constraints: [
      'Working directory: /home/cadet',
      'Offline isolated sandbox (use local documentation such as man or --help)',
      'Standard user account (sudo privileges disabled)'
    ],
    flag: 'FLAG{grep_is_powerful}',
    systemContext: `
      User: cadet
      CWD: /home/cadet
      File System:
      /var/logs/server.log (Large file with random logs. Contains "CRITICAL: Flag FLAG{grep_is_powerful}")
      
      If user attempts to access /var/logs/server.log, allow it.
    `,
    hints: [
      'You need a tool to search for patterns inside files.',
      'Where are logs typically stored in Linux?'
    ],
    clo: 'CLO-4: Pattern matching, regular expressions, and administrative log analysis with grep.',
    taskDomain: 'logs',
    expectedEvidence: 'grep output filtering /var/logs/server.log matching the word CRITICAL.',
    expectedWarrant: 'grep filters input streams and files by regular expressions or substring tokens.',
    acceptableAlternativePaths: ['grep CRITICAL /var/logs/server.log', 'grep -i critical /var/logs/server.log', 'cat /var/logs/server.log | grep CRITICAL'],
    commonMisconceptions: ['Reading megabytes of log files line-by-line without filtering'],
    approvedHintProgression: [
      { level: 0, title: 'Clarification', text: 'What tool are you using to filter lines inside large text files?' },
      { level: 1, title: 'Socratic Inquiry', text: 'Which command takes a search keyword and a file path to print matching lines?' },
      { level: 2, title: 'Conceptual Reminder', text: 'Search commands allow pattern-matching directly without loading the whole file manually.' },
      { level: 3, title: 'Procedural Guidance', text: 'Use `grep <keyword> <filepath>` to filter the log.' },
      { level: 4, title: 'Bounded Example', text: 'For example: `grep ERROR /var/log/syslog` prints error lines.' }
    ],
    prohibitedDisclosures: ['FLAG{grep_is_powerful}', 'grep CRITICAL /var/logs/server.log'],
    taskType: 'training',
    aiDisabled: false,
    safeResetProcedure: 'cd /home/cadet',
    initialSignature: { logPath: '/var/logs/server.log', tag: 'CRITICAL' },
    inclusionStatus: true
  },
  {
    id: 5,
    taskId: 'TASK-005',
    taskDefinitionVersion: '5.0.0',
    title: 'Internal Communications',
    description: 'There is a web service running on this machine, but it is not exposed to the outside internet. You must access it from within the server itself.',
    difficulty: Difficulty.HARD,
    objective: 'Identify and query the internal loopback service from the command line.',
    studentTask: 'Inspect local network service bindings or query the internal loopback HTTP endpoint on port 8080.',
    goal: 'Retrieve the response payload from the internal loopback service.',
    context: 'Services bound to the loopback address (`127.0.0.1` or `localhost`) are accessible only to processes running on the same machine. Command-line HTTP and socket inspection tools allow operators to diagnose local services without a graphical browser.',
    successEvidence: 'Terminal output showing the local service response or socket state containing the verification token.',
    howToWork: DEFAULT_HOW_TO_WORK,
    constraints: [
      'Working directory: /home/cadet',
      'Loopback networking only (external internet disabled)',
      'Standard user account (sudo privileges disabled)'
    ],
    flag: 'FLAG{curl_local_services}',
    systemContext: `
      User: cadet
      CWD: /home/cadet
      Network: localhost:8080 serving "Flag: FLAG{curl_local_services}"
      Tools: curl, netstat, ping
    `,
    hints: [
      'How do you make a web request from the command line?',
      "The address is 'localhost'."
    ],
    clo: 'CLO-5: Loopback networking, port enumeration, and CLI HTTP requests using curl.',
    taskDomain: 'network',
    expectedEvidence: 'HTTP response body from curl http://localhost:8080.',
    expectedWarrant: 'Internal services bound to 127.0.0.1 or localhost are reachable through terminal HTTP clients.',
    acceptableAlternativePaths: ['curl localhost:8080', 'curl http://127.0.0.1:8080', 'wget -qO- localhost:8080'],
    commonMisconceptions: ['Attempting to ping a port instead of querying HTTP'],
    approvedHintProgression: [
      { level: 0, title: 'Clarification', text: 'What network port and protocol are you attempting to communicate with?' },
      { level: 1, title: 'Socratic Inquiry', text: 'Which CLI command allows you to transfer data from a URL or web endpoint?' },
      { level: 2, title: 'Conceptual Reminder', text: 'Web servers respond to HTTP GET requests sent to their host and port.' },
      { level: 3, title: 'Procedural Guidance', text: 'Look into `curl` to issue a request to the local loopback port.' },
      { level: 4, title: 'Bounded Example', text: 'Example syntax: `curl http://localhost:<port>`.' }
    ],
    prohibitedDisclosures: ['FLAG{curl_local_services}', 'curl localhost:8080'],
    taskType: 'transfer',
    aiDisabled: false,
    safeResetProcedure: 'cd /home/cadet',
    initialSignature: { port: 8080, host: 'localhost' },
    inclusionStatus: true
  },
  {
    id: 6,
    taskId: 'TASK-006',
    taskDefinitionVersion: '5.0.0',
    title: 'Encoded Artifact',
    description: 'An artifact in your working directory contains text that has been obfuscated using a common ASCII encoding scheme.',
    difficulty: Difficulty.MEDIUM,
    objective: 'Inspect the encoded artifact and decode its contents to plaintext.',
    studentTask: 'Examine the encoded file in your home directory and reverse its encoding to read the plaintext token.',
    goal: 'Identify the encoding format from observable file evidence and transform the encoded text back into readable ASCII.',
    context: 'Data is frequently encoded into printable ASCII characters for safe transport across text-only channels. Unlike encryption, standard encoding schemes require no secret key and can be reversed with standard command-line filters.',
    successEvidence: 'Terminal output showing inspection of the encoded artifact and its decoded plaintext verification token.',
    howToWork: DEFAULT_HOW_TO_WORK,
    constraints: [
      'Working directory: /home/cadet',
      'Offline isolated sandbox (use local documentation such as man or --help)',
      'Standard user account (sudo privileges disabled)'
    ],
    flag: 'FLAG{pipes_and_decoding}',
    systemContext: `
      User: cadet
      CWD: /home/cadet
      File System:
      /home/cadet/secret.b64 (Content: "RkxBR3twaXBlc19hbmRfZGVjb2Rpbmd9")
      
      If user runs 'cat secret.b64 | base64 -d' output "FLAG{pipes_and_decoding}".
      If user just cats it, show the encoded string.
    `,
    hints: [
      'The file extension gives a hint about the encoding.',
      "Consult the manual page for the encoding utility to see how to decode."
    ],
    clo: 'CLO-6: Standard streams, Unix pipes (|), and data transformation utilities.',
    taskDomain: 'troubleshooting',
    expectedEvidence: 'Decoded ASCII string output from base64 -d.',
    expectedWarrant: 'Base64 encoded data can be redirected or piped into base64 -d to recover plaintext.',
    acceptableAlternativePaths: ['cat secret.b64 | base64 -d', 'base64 -d secret.b64', 'base64 --decode secret.b64'],
    commonMisconceptions: ['Assuming base64 is an encryption cipher requiring a private key'],
    approvedHintProgression: [
      { level: 0, title: 'Clarification', text: 'What format is indicated by the file extension and character padding?' },
      { level: 1, title: 'Socratic Inquiry', text: 'How do Unix pipelines connect stdout of one program to stdin of another?' },
      { level: 2, title: 'Conceptual Reminder', text: 'The `base64` utility has an option to decode input.' },
      { level: 3, title: 'Procedural Guidance', text: 'Check `man base64` for the decode flag and pass the encoded file to it.' },
      { level: 4, title: 'Bounded Example', text: 'Example: `base64 <decode-option> <filename>`.' }
    ],
    prohibitedDisclosures: ['FLAG{pipes_and_decoding}', 'base64 -d secret.b64', 'cat secret.b64 | base64 -d'],
    taskType: 'training',
    aiDisabled: false,
    safeResetProcedure: 'cd /home/cadet',
    initialSignature: { file: 'secret.b64' },
    inclusionStatus: true
  },
  {
    id: 7,
    taskId: 'TASK-007',
    taskDefinitionVersion: '5.0.0',
    title: 'Access Denied',
    description: "The target file is locked down with administrative permissions. Your standard account cannot read it directly without delegated elevation.",
    difficulty: Difficulty.MEDIUM,
    objective: 'Inspect file permissions and authorized privilege delegation to access the restricted artifact.',
    studentTask: 'Determine why direct access fails, inspect your delegated administrative privileges, and read the restricted artifact.',
    goal: 'Verify ownership, permissions, or `sudo` delegation rules and use authorized privilege elevation to retrieve the token.',
    context: 'Linux enforces discretionary access control through user/group ownership and permission bits, while `sudo` allows fine-grained delegation of administrative commands. When access fails, administrators check both file permissions and their authorized `sudo` policy.',
    successEvidence: 'Terminal evidence of permission/delegation inspection and authorized retrieval of the verification token.',
    howToWork: DEFAULT_HOW_TO_WORK,
    constraints: [
      'Working directory: /home/cadet',
      'Offline isolated sandbox (no external internet access)',
      'Task-specific capability: authorized sudo delegation enabled for user cadet'
    ],
    flag: 'FLAG{sudo_power_unlocked}',
    systemContext: `
      User: cadet
      CWD: /home/cadet
      File System:
      /root/flag.txt (Content: "FLAG{sudo_power_unlocked}", Owner: root, Mode: 600)
      
      If 'cat /root/flag.txt' -> "Permission denied".
      If 'sudo cat /root/flag.txt' -> Show flag.
    `,
    hints: [
      "What prefix allows you to run a command as the 'super user'?",
      "Which option in `man sudo` lists your authorized commands?"
    ],
    clo: 'CLO-7: POSIX permissions, discretionary access control, and superuser delegation (sudo).',
    taskDomain: 'permissions',
    expectedEvidence: 'Output of sudo cat /root/flag.txt demonstrating permission override.',
    expectedWarrant: 'Files restricted to root (0600) require sudo privileges to read.',
    acceptableAlternativePaths: ['sudo cat /root/flag.txt', 'sudo head /root/flag.txt', 'sudo -s'],
    commonMisconceptions: ['Attempting chmod without sudo privileges'],
    approvedHintProgression: [
      { level: 0, title: 'Clarification', text: 'What error message did the operating system return when you accessed the target file?' },
      { level: 1, title: 'Socratic Inquiry', text: 'Who owns the restricted file, and how can you check what elevated privileges your account has?' },
      { level: 2, title: 'Conceptual Reminder', text: 'The `sudo` command executes programs with delegated administrative security privileges.' },
      { level: 3, title: 'Procedural Guidance', text: 'Inspect your delegated privileges with `sudo -l` or prefix your inspection command with `sudo`.' },
      { level: 4, title: 'Bounded Example', text: 'Example: `sudo <command> <restricted_path>`.' }
    ],
    prohibitedDisclosures: ['FLAG{sudo_power_unlocked}', 'sudo cat /root/flag.txt'],
    taskType: 'transfer',
    aiDisabled: false,
    safeResetProcedure: 'cd /home/cadet',
    initialSignature: { target: '/root/flag.txt', mode: 600 },
    inclusionStatus: true
  },
  {
    id: 8,
    taskId: 'TASK-008',
    taskDefinitionVersion: '5.0.0',
    title: 'Lost Data',
    description: 'An important backup artifact was saved somewhere inside a multi-level directory tree, and we do not know the exact subfolder.',
    difficulty: Difficulty.MEDIUM,
    objective: 'Traverse the directory hierarchy to locate the misplaced artifact and read its contents.',
    studentTask: 'Search recursively across the target directory tree to locate the misplaced artifact and inspect its contents.',
    goal: 'Use a recursive directory search utility to identify the exact file path and read the verification token.',
    context: 'Manually changing directories across deeply nested filesystem trees is slow and error-prone. Linux provides dedicated traversal utilities that search directory hierarchies by filename, file type, or metadata attributes.',
    successEvidence: 'Terminal output showing recursive search discovery of the file path and inspection of its verification token.',
    howToWork: DEFAULT_HOW_TO_WORK,
    constraints: [
      'Working directory: /home/cadet',
      'Offline isolated sandbox (use local documentation such as man or --help)',
      'Standard user account (sudo privileges disabled)'
    ],
    flag: 'FLAG{find_command_expert}',
    systemContext: `
      User: cadet
      CWD: /home/cadet
      File System:
      /var/lib/misc/subdir/lost_flag.txt (Content: "FLAG{find_command_expert}")
      
      If 'find /var -name lost_flag.txt' -> print path.
      If 'cat [path]' -> show flag.
    `,
    hints: [
      "There is a command specifically named for 'finding' things.",
      "Consult `man find` to see how to match entries by name or type."
    ],
    clo: 'CLO-8: Hierarchical filesystem traversal and pattern-based search using find.',
    taskDomain: 'search',
    expectedEvidence: 'find output returning /var/lib/misc/subdir/lost_flag.txt and cat output of that file.',
    expectedWarrant: 'find recursively searches directories for filenames matching specified criteria.',
    acceptableAlternativePaths: ['find /var -name lost_flag.txt', 'find /var -name "lost_flag.txt" 2>/dev/null'],
    commonMisconceptions: ['Trying to manually cd into every directory under /var'],
    approvedHintProgression: [
      { level: 0, title: 'Clarification', text: 'What command are you using to search across nested subdirectories?' },
      { level: 1, title: 'Socratic Inquiry', text: 'Which utility traverses directory hierarchies searching by filename or file type?' },
      { level: 2, title: 'Conceptual Reminder', text: 'The `find` utility accepts a starting directory and search expressions.' },
      { level: 3, title: 'Procedural Guidance', text: 'Consult `man find` for the expression that matches by name or file type.' },
      { level: 4, title: 'Bounded Example', text: 'Example syntax: `find <starting-dir> -name <pattern>`.' }
    ],
    prohibitedDisclosures: ['FLAG{find_command_expert}', '.shadow_copy.bak', 'find /var -name lost_flag.txt'],
    taskType: 'training',
    aiDisabled: false,
    isPostTest: false,
    safeResetProcedure: 'cd /home/cadet',
    initialSignature: { targetName: 'lost_flag.txt', root: '/var' },
    inclusionStatus: true
  }
];

export const INITIAL_RESEARCH_TASKS: Level[] = RAW_SERVER_TASKS.map(t => {
  const clientMatch = INITIAL_LEVELS.find(c => c.id === t.id);
  return {
    ...t,
    description: clientMatch?.description || t.description,
    objective: clientMatch?.objective || t.objective,
    studentTask: clientMatch?.studentTask || t.studentTask,
    goal: clientMatch?.goal || t.goal,
    context: clientMatch?.context || t.context,
    successEvidence: clientMatch?.successEvidence || t.successEvidence,
    howToWork: clientMatch?.howToWork || t.howToWork || DEFAULT_HOW_TO_WORK,
    constraints: clientMatch?.constraints || t.constraints || ['Directory: /home/cadet', 'Offline sandbox']
  };
});

export const SERVER_TASKS = INITIAL_RESEARCH_TASKS;
