import { Level, Difficulty, TaskDomain, TaskType } from '../types';

export const INITIAL_RESEARCH_TASKS: Level[] = [
  {
    id: 1,
    taskId: 'TASK-001',
    taskDefinitionVersion: '2.0.0',
    title: 'The Beginning',
    description: 'You have dropped into a new system. Your first order of business is to get your bearings and find the welcome note left by the previous admin.',
    difficulty: Difficulty.EASY,
    objective: 'Find the welcome message file in your home directory and read it.',
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
      { level: 3, title: 'Procedural Guidance', text: 'Use `ls` to list directory contents, then locate a file named welcome.txt.' },
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
    taskDefinitionVersion: '2.0.0',
    title: 'Hidden Secrets',
    description: 'Intelligence suggests there is a config file in this directory, but a standard file listing does not reveal it.',
    difficulty: Difficulty.EASY,
    objective: 'Locate the hidden configuration file in your current directory and read its contents.',
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
      "There is a command argument that shows 'all' files.",
      'In Linux, files starting with a specific character are hidden by default.'
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
      { level: 4, title: 'Bounded Example', text: 'For example, passing `-a` to a command often stands for showing all items.' }
    ],
    prohibitedDisclosures: ['.secret_config', 'FLAG{hidden_files_revealed}', 'cat .secret_config'],
    taskType: 'training',
    aiDisabled: false,
    safeResetProcedure: 'cd /home/cadet',
    initialSignature: { files: ['.secret_config', 'public.txt'], cwd: '/home/cadet', user: 'cadet' },
    inclusionStatus: true
  },
  {
    id: 3,
    taskId: 'TASK-003',
    taskDefinitionVersion: '2.0.0',
    title: 'Environment Variable',
    description: "We cannot find the key in any file on disk. It appears the developer left the secret resident in the shell's memory.",
    difficulty: Difficulty.EASY,
    objective: 'Recover the secret key stored in the session environment.',
    flag: 'FLAG{env_vars_insecure}',
    systemContext: `
      User: cadet
      CWD: /home/cadet
      Env Vars: SECRET_KEY=FLAG{env_vars_insecure}
    `,
    hints: [
      'Where does the shell store global variables?',
      "Is there a command to print the 'env'ironment?"
    ],
    clo: 'CLO-3: Shell environment variables, session state inspection, and credential handling.',
    taskDomain: 'troubleshooting',
    expectedEvidence: 'Environment dump showing SECRET_KEY=FLAG{env_vars_insecure}.',
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
    taskDefinitionVersion: '2.0.0',
    title: 'Needle in a Haystack',
    description: "A critical event occurred, but it's buried inside the system logs. We know the event is tagged with 'CRITICAL'.",
    difficulty: Difficulty.MEDIUM,
    objective: "Locate the log entry tagged 'CRITICAL' within the system logs directory.",
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
    taskDefinitionVersion: '2.0.0',
    title: 'Internal Communications',
    description: 'There is a web service running on this machine, but it is not exposed to the outside internet. You must access it from within the server itself.',
    difficulty: Difficulty.HARD,
    objective: 'Retrieve the flag from the internal web service.',
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
      { level: 3, title: 'Procedural Guidance', text: 'Look into `curl` to issue a request to `localhost:8080`.' },
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
    taskDefinitionVersion: '2.0.0',
    title: 'Encoded Artifact',
    description: "We intercepted a suspicious file named 'secret.b64'. The content appears to be obfuscated using a common encoding scheme.",
    difficulty: Difficulty.MEDIUM,
    objective: "Decode the contents of the 'secret.b64' file.",
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
      "You might need to 'decode' it."
    ],
    clo: 'CLO-6: Standard streams, Unix pipes (|), and data transformation utilities.',
    taskDomain: 'troubleshooting',
    expectedEvidence: 'Decoded ASCII string output from base64 -d.',
    expectedWarrant: 'Base64 encoded data can be redirected or piped into base64 -d to recover plaintext.',
    acceptableAlternativePaths: ['cat secret.b64 | base64 -d', 'base64 -d secret.b64', 'base64 --decode secret.b64'],
    commonMisconceptions: ['Assuming base64 is an encryption cipher requiring a private key'],
    approvedHintProgression: [
      { level: 0, title: 'Clarification', text: 'What format is indicated by the .b64 file extension?' },
      { level: 1, title: 'Socratic Inquiry', text: 'How do Unix pipelines connect stdout of one program to stdin of another?' },
      { level: 2, title: 'Conceptual Reminder', text: 'The `base64` utility has a decode flag (-d).' },
      { level: 3, title: 'Procedural Guidance', text: 'Pipe the contents of the file into `base64 -d`.' },
      { level: 4, title: 'Bounded Example', text: 'Example: `cat file.b64 | base64 -d`.' }
    ],
    prohibitedDisclosures: ['FLAG{pipes_and_decoding}', 'base64 -d secret.b64'],
    taskType: 'training',
    aiDisabled: false,
    safeResetProcedure: 'cd /home/cadet',
    initialSignature: { file: 'secret.b64' },
    inclusionStatus: true
  },
  {
    id: 7,
    taskId: 'TASK-007',
    taskDefinitionVersion: '2.0.0',
    title: 'Access Denied',
    description: "The target file is locked down in the administrator's home directory. Your standard account cannot read it directly.",
    difficulty: Difficulty.MEDIUM,
    objective: "Read the flag located in the root user's home directory.",
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
      "Where is the root user's home directory?"
    ],
    clo: 'CLO-7: POSIX permissions, discretionary access control, and superuser delegation (sudo).',
    taskDomain: 'permissions',
    expectedEvidence: 'Output of sudo cat /root/flag.txt demonstrating permission override.',
    expectedWarrant: 'Files restricted to root (0600) require sudo privileges to read.',
    acceptableAlternativePaths: ['sudo cat /root/flag.txt', 'sudo head /root/flag.txt', 'sudo -s'],
    commonMisconceptions: ['Attempting chmod without sudo privileges'],
    approvedHintProgression: [
      { level: 0, title: 'Clarification', text: 'What error message did the operating system return when you accessed /root/flag.txt?' },
      { level: 1, title: 'Socratic Inquiry', text: 'Who owns /root/flag.txt, and how can you elevate privileges to read it?' },
      { level: 2, title: 'Conceptual Reminder', text: 'The `sudo` command executes programs with superuser security privileges.' },
      { level: 3, title: 'Procedural Guidance', text: 'Prefix your read command with `sudo`.' },
      { level: 4, title: 'Bounded Example', text: 'Example: `sudo cat /path/to/root_file`.' }
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
    taskDefinitionVersion: '2.0.0',
    title: 'Lost Data',
    description: "A file named 'lost_flag.txt' was saved somewhere inside the '/var' directory tree, but we don't know the exact subfolder.",
    difficulty: Difficulty.MEDIUM,
    objective: "Locate the file 'lost_flag.txt' hidden somewhere in the '/var' directory.",
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
      "You can search by 'name'."
    ],
    clo: 'CLO-8: Hierarchical filesystem traversal and pattern-based search using find.',
    taskDomain: 'search',
    expectedEvidence: 'find output returning /var/lib/misc/subdir/lost_flag.txt and cat output of that file.',
    expectedWarrant: 'find recursively searches directories for filenames matching specified criteria.',
    acceptableAlternativePaths: ['find /var -name lost_flag.txt', 'find /var -name "lost_flag.txt" 2>/dev/null'],
    commonMisconceptions: ['Trying to manually cd into every directory under /var'],
    approvedHintProgression: [
      { level: 0, title: 'Clarification', text: 'What command are you using to search across nested subdirectories?' },
      { level: 1, title: 'Socratic Inquiry', text: 'Which utility traverses directory hierarchies searching by filename?' },
      { level: 2, title: 'Conceptual Reminder', text: 'The `find` utility accepts a starting directory and search criteria like `-name`.' },
      { level: 3, title: 'Procedural Guidance', text: 'Run `find /var -name lost_flag.txt` to discover the exact location.' },
      { level: 4, title: 'Bounded Example', text: 'Example syntax: `find /starting/dir -name filename.ext`.' }
    ],
    prohibitedDisclosures: ['FLAG{find_command_expert}', 'find /var -name lost_flag.txt'],
    taskType: 'training',
    aiDisabled: false,
    isPostTest: false,
    safeResetProcedure: 'cd /home/cadet',
    initialSignature: { targetName: 'lost_flag.txt', root: '/var' },
    inclusionStatus: true
  }
];
