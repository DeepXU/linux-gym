import { CEWSubmission } from '../types';

export interface BenchmarkCEWItem {
  benchmarkId: string;
  taskId: number;
  taskTitle: string;
  category: 'complete_accurate' | 'partial_evidence' | 'insufficient_warrant' | 'unsupported_claim' | 'misconception' | 'vague_irrelevant';
  claim: string;
  evidence: string;
  warrant: string;
  expectedScores: {
    claim: number;
    evidence: number;
    warrant: number;
  };
  evaluatorNotes: string;
}

export const BENCHMARK_CEW_DATASET: BenchmarkCEWItem[] = [
  // --- Task 1: The Beginning ---
  {
    benchmarkId: 'CEW-TC01',
    taskId: 1,
    taskTitle: 'The Beginning',
    category: 'complete_accurate',
    claim: 'The welcome file containing the flag is welcome.txt located directly in the /home/cadet home directory.',
    evidence: 'Executing "ls -la" returned welcome.txt, and "cat welcome.txt" output "Welcome! Flag: FLAG{linux_basics_mastered}".',
    warrant: 'Since cat reads and outputs the exact file contents to standard output, verifying the string confirmed the objective was satisfied.',
    expectedScores: { claim: 3, evidence: 3, warrant: 3 },
    evaluatorNotes: 'Fully articulated claim, empirical command and token citation, clear logical connection.'
  },
  {
    benchmarkId: 'CEW-TC02',
    taskId: 1,
    taskTitle: 'The Beginning',
    category: 'partial_evidence',
    claim: 'The flag was found inside welcome.txt in the cadet folder.',
    evidence: 'I saw welcome.txt in the folder listing.',
    warrant: 'Because the instructions mentioned the previous administrator left a note, reading this note yields the flag.',
    expectedScores: { claim: 3, evidence: 2, warrant: 2 },
    evaluatorNotes: 'Valid claim, but evidence only cites directory listing without the actual cat output or flag token.'
  },
  {
    benchmarkId: 'CEW-TC03',
    taskId: 1,
    taskTitle: 'The Beginning',
    category: 'insufficient_warrant',
    claim: 'The challenge is solved by cat welcome.txt.',
    evidence: 'Terminal stdout displayed: "FLAG{linux_basics_mastered}".',
    warrant: 'It worked.',
    expectedScores: { claim: 2, evidence: 3, warrant: 1 },
    evaluatorNotes: 'Minimal warrant providing no reasoning why the evidence substantiates the claim.'
  },
  {
    benchmarkId: 'CEW-TC04',
    taskId: 1,
    taskTitle: 'The Beginning',
    category: 'unsupported_claim',
    claim: 'The admin left the secret in instructions.md rather than welcome.txt.',
    evidence: 'I think it is in instructions.md.',
    warrant: 'Because admins always put important secrets inside markdown documentation.',
    expectedScores: { claim: 2, evidence: 1, warrant: 1 },
    evaluatorNotes: 'Unsupported claim with zero terminal evidence and speculative justification.'
  },
  {
    benchmarkId: 'CEW-TC05',
    taskId: 1,
    taskTitle: 'The Beginning',
    category: 'vague_irrelevant',
    claim: 'I finished the step.',
    evidence: 'Linux commands were run.',
    warrant: 'Everything is good.',
    expectedScores: { claim: 1, evidence: 1, warrant: 1 },
    evaluatorNotes: 'Completely vague across all three dimensions.'
  },

  // --- Task 2: Hidden Secrets ---
  {
    benchmarkId: 'CEW-TC06',
    taskId: 2,
    taskTitle: 'Hidden Secrets',
    category: 'complete_accurate',
    claim: 'The hidden configuration file is .secret_config and it contains the flag parameter.',
    evidence: 'Running "ls -la" revealed ".secret_config", and "cat .secret_config" displayed "FLAG=FLAG{hidden_files_revealed}".',
    warrant: 'In Linux filesystem conventions, files beginning with a dot are omitted by standard "ls" but revealed with "-a", proving this file was the hidden secret.',
    expectedScores: { claim: 3, evidence: 3, warrant: 3 },
    evaluatorNotes: 'Complete technical explanation citing dotfile behavior.'
  },
  {
    benchmarkId: 'CEW-TC07',
    taskId: 2,
    taskTitle: 'Hidden Secrets',
    category: 'misconception',
    claim: 'The file was deleted from disk because standard ls showed nothing new.',
    evidence: 'I ran ls and only public.txt was present.',
    warrant: 'Since ls displays all files on a drive, absence from output proves file deletion.',
    expectedScores: { claim: 1, evidence: 2, warrant: 1 },
    evaluatorNotes: 'Pedagogical misconception regarding dotfiles and default directory listing parameters.'
  },
  {
    benchmarkId: 'CEW-TC08',
    taskId: 2,
    taskTitle: 'Hidden Secrets',
    category: 'partial_evidence',
    claim: 'The secret is in .secret_config.',
    evidence: 'Found .secret_config using ls -a.',
    warrant: 'Because dotfiles are hidden configs in Linux.',
    expectedScores: { claim: 3, evidence: 2, warrant: 2 },
    evaluatorNotes: 'Partially complete, lacked specific token evidence and deep explanation.'
  },
  {
    benchmarkId: 'CEW-TC09',
    taskId: 2,
    taskTitle: 'Hidden Secrets',
    category: 'unsupported_claim',
    claim: 'The hidden file was in /etc instead of current directory.',
    evidence: 'None.',
    warrant: 'System configuration usually resides in /etc.',
    expectedScores: { claim: 1, evidence: 1, warrant: 1 },
    evaluatorNotes: 'Completely unsupported claim with no empirical backing.'
  },

  // --- Task 3: Environment Variable ---
  {
    benchmarkId: 'CEW-TC10',
    taskId: 3,
    taskTitle: 'Environment Variable',
    category: 'complete_accurate',
    claim: 'The secret key was stored in the active process environment variable named SECRET_KEY.',
    evidence: 'Executing "env | grep SECRET_KEY" output "SECRET_KEY=FLAG{env_vars_insecure}".',
    warrant: 'Because environment variables reside in process memory rather than storage, inspecting the env table exposed the credential without touching the disk.',
    expectedScores: { claim: 3, evidence: 3, warrant: 3 },
    evaluatorNotes: 'Exemplary reasoning distinguishing persistent storage from runtime memory.'
  },
  {
    benchmarkId: 'CEW-TC11',
    taskId: 3,
    taskTitle: 'Environment Variable',
    category: 'insufficient_warrant',
    claim: 'SECRET_KEY holds the flag.',
    evidence: 'env output showed SECRET_KEY=FLAG{env_vars_insecure}.',
    warrant: 'That is what it showed.',
    expectedScores: { claim: 3, evidence: 3, warrant: 1 },
    evaluatorNotes: 'Accurate claim and evidence, tautological warrant.'
  },
  {
    benchmarkId: 'CEW-TC12',
    taskId: 3,
    taskTitle: 'Environment Variable',
    category: 'partial_evidence',
    claim: 'The environment has a variable called SECRET_KEY.',
    evidence: 'I ran the printenv command.',
    warrant: 'Since printenv dumps memory variables, the variable was in that list.',
    expectedScores: { claim: 2, evidence: 2, warrant: 2 },
    evaluatorNotes: 'Mentions command but omits actual value or flag token.'
  },
  {
    benchmarkId: 'CEW-TC13',
    taskId: 3,
    taskTitle: 'Environment Variable',
    category: 'misconception',
    claim: 'The environment variable was stored in ~/.bashrc.',
    evidence: 'I inspected .bashrc with cat.',
    warrant: 'All environment variables must be declared in .bashrc to exist in memory.',
    expectedScores: { claim: 1, evidence: 1, warrant: 1 },
    evaluatorNotes: 'Misunderstands dynamic session variables vs shell profile startup scripts.'
  },

  // --- Task 4: Needle in a Haystack ---
  {
    benchmarkId: 'CEW-TC14',
    taskId: 4,
    taskTitle: 'Needle in a Haystack',
    category: 'complete_accurate',
    claim: 'The critical incident record was isolated in /var/logs/server.log using pattern matching on the tag CRITICAL.',
    evidence: 'Running "grep CRITICAL /var/logs/server.log" printed "CRITICAL: Flag FLAG{grep_is_powerful}".',
    warrant: 'The grep utility filters lines containing specified regex patterns; matching on the known severity tag allowed immediate extraction without manual line inspection.',
    expectedScores: { claim: 3, evidence: 3, warrant: 3 },
    evaluatorNotes: 'Strong pattern filtering rationale with full terminal citations.'
  },
  {
    benchmarkId: 'CEW-TC15',
    taskId: 4,
    taskTitle: 'Needle in a Haystack',
    category: 'partial_evidence',
    claim: 'Found the critical event in the log.',
    evidence: 'The flag is FLAG{grep_is_powerful}.',
    warrant: 'Because grep searches logs for text.',
    expectedScores: { claim: 2, evidence: 2, warrant: 2 },
    evaluatorNotes: 'Flag provided but command syntax and file path omitted from evidence.'
  },
  {
    benchmarkId: 'CEW-TC16',
    taskId: 4,
    taskTitle: 'Needle in a Haystack',
    category: 'unsupported_claim',
    claim: 'The log file has been truncated by a logrotate job.',
    evidence: 'The log file is big.',
    warrant: 'Big log files always trigger logrotate.',
    expectedScores: { claim: 1, evidence: 1, warrant: 1 },
    evaluatorNotes: 'Irrelevant claim contradictory to the task state.'
  },
  {
    benchmarkId: 'CEW-TC17',
    taskId: 4,
    taskTitle: 'Needle in a Haystack',
    category: 'vague_irrelevant',
    claim: 'I searched the server.',
    evidence: 'Looked at logs.',
    warrant: 'Search found it.',
    expectedScores: { claim: 1, evidence: 1, warrant: 1 },
    evaluatorNotes: 'Completely underspecified.'
  },

  // --- Task 5: Internal Communications ---
  {
    benchmarkId: 'CEW-TC18',
    taskId: 5,
    taskTitle: 'Internal Communications',
    category: 'complete_accurate',
    claim: 'The internal microservice running locally on port 8080 served the flag in response to an HTTP GET request.',
    evidence: 'Running "curl http://localhost:8080" returned HTTP 200 with payload "Flag: FLAG{curl_local_services}".',
    warrant: 'Services bound strictly to 127.0.0.1 cannot be reached via external network interfaces; issuing a loopback request from the local shell successfully bypassed the perimeter filter.',
    expectedScores: { claim: 3, evidence: 3, warrant: 3 },
    evaluatorNotes: 'Accurate technical understanding of loopback binding and curl client requests.'
  },
  {
    benchmarkId: 'CEW-TC19',
    taskId: 5,
    taskTitle: 'Internal Communications',
    category: 'misconception',
    claim: 'The internal web service was offline because ping localhost timed out.',
    evidence: 'ICMP ping to 127.0.0.1 failed.',
    warrant: 'If ping fails, HTTP web servers on that host are impossible to reach.',
    expectedScores: { claim: 1, evidence: 2, warrant: 1 },
    evaluatorNotes: 'Conflates network layer ICMP echo with application layer TCP socket communication.'
  },
  {
    benchmarkId: 'CEW-TC20',
    taskId: 5,
    taskTitle: 'Internal Communications',
    category: 'partial_evidence',
    claim: 'A local service on port 8080 had the flag.',
    evidence: 'curl http://localhost:8080 returned the flag.',
    warrant: 'Because curl talks to internal web servers.',
    expectedScores: { claim: 3, evidence: 2, warrant: 2 },
    evaluatorNotes: 'Acceptable claim, but evidence omitted exact payload response string.'
  },
  {
    benchmarkId: 'CEW-TC21',
    taskId: 5,
    taskTitle: 'Internal Communications',
    category: 'insufficient_warrant',
    claim: 'The flag was retrieved with curl.',
    evidence: 'Flag: FLAG{curl_local_services} was printed.',
    warrant: 'Because curl works on localhost.',
    expectedScores: { claim: 2, evidence: 3, warrant: 1 },
    evaluatorNotes: 'Tautological warrant failing to explain loopback architecture.'
  },

  // --- Task 6: Encoded Artifact ---
  {
    benchmarkId: 'CEW-TC22',
    taskId: 6,
    taskTitle: 'Encoded Artifact',
    category: 'complete_accurate',
    claim: 'The file secret.b64 contained a reversible Base64 encoded payload rather than encrypted ciphertext.',
    evidence: 'Piping the file into "cat secret.b64 | base64 -d" yielded plaintext "FLAG{pipes_and_decoding}".',
    warrant: 'Base64 is an ASCII representation scheme rather than an asymmetric or symmetric cipher; since no cryptographic key was needed, decoding the pipeline immediately restored the original string.',
    expectedScores: { claim: 3, evidence: 3, warrant: 3 },
    evaluatorNotes: 'Clear distinction between encoding schemes and cryptographic encryption.'
  },
  {
    benchmarkId: 'CEW-TC23',
    taskId: 6,
    taskTitle: 'Encoded Artifact',
    category: 'misconception',
    claim: 'The secret.b64 file was encrypted with AES-256 and cracked by base64.',
    evidence: 'The file ended with .b64 and contained random letters like RkxBR3twaXBlc19hbmRfZGVjb2Rpbmd9.',
    warrant: 'Since ciphertext looks randomized, base64 -d decrypted the private key.',
    expectedScores: { claim: 1, evidence: 2, warrant: 1 },
    evaluatorNotes: 'Major cryptographic misconception confusing base64 encoding with AES encryption.'
  },
  {
    benchmarkId: 'CEW-TC24',
    taskId: 6,
    taskTitle: 'Encoded Artifact',
    category: 'partial_evidence',
    claim: 'The file secret.b64 was decoded using base64 -d.',
    evidence: 'I used base64 -d and got the flag.',
    warrant: 'Because .b64 indicates base64 encoding.',
    expectedScores: { claim: 3, evidence: 2, warrant: 2 },
    evaluatorNotes: 'Partially complete, lacked specific token and pipeline explanation.'
  },

  // --- Task 7: Access Denied ---
  {
    benchmarkId: 'CEW-TC25',
    taskId: 7,
    taskTitle: 'Access Denied',
    category: 'complete_accurate',
    claim: 'The target file /root/flag.txt has permissions 0600 owned by root, requiring elevated privileges via sudo.',
    evidence: 'Direct "cat /root/flag.txt" returned "Permission denied", whereas "sudo cat /root/flag.txt" revealed "FLAG{sudo_power_unlocked}".',
    warrant: 'The Linux DAC model prevents standard users from reading mode 600 files owned by UID 0; sudo permits authorized users to execute binary commands with superuser privileges.',
    expectedScores: { claim: 3, evidence: 3, warrant: 3 },
    evaluatorNotes: 'Detailed explanation of DAC permissions, UID 0, and sudo elevation.'
  },
  {
    benchmarkId: 'CEW-TC26',
    taskId: 7,
    taskTitle: 'Access Denied',
    category: 'unsupported_claim',
    claim: 'The cadet account was compromised by a rootkit.',
    evidence: 'Permission denied appeared when accessing /root.',
    warrant: 'Only infected systems deny cadet access to root files.',
    expectedScores: { claim: 1, evidence: 2, warrant: 1 },
    evaluatorNotes: 'Extreme misconception interpreting standard POSIX permissions as malware compromise.'
  },
  {
    benchmarkId: 'CEW-TC27',
    taskId: 7,
    taskTitle: 'Access Denied',
    category: 'insufficient_warrant',
    claim: 'sudo cat /root/flag.txt is required.',
    evidence: 'FLAG{sudo_power_unlocked} was outputted.',
    warrant: 'Because sudo gave permission.',
    expectedScores: { claim: 3, evidence: 3, warrant: 1 },
    evaluatorNotes: 'Weak warrant with no explanation of root ownership or permission bits.'
  },

  // --- Task 8: Lost Data ---
  {
    benchmarkId: 'CEW-TC28',
    taskId: 8,
    taskTitle: 'Lost Data',
    category: 'complete_accurate',
    claim: 'The target file lost_flag.txt was nested inside /var/lib/misc/subdir/ and identified by recursive name search.',
    evidence: 'Executing "find /var -name lost_flag.txt" output "/var/lib/misc/subdir/lost_flag.txt", and catting that path revealed "FLAG{find_command_expert}".',
    warrant: 'Unlike ls which only operates on current or specified directories, find recursively walks filesystem directory trees matching on filename expressions, allowing rapid localization of deeply buried files.',
    expectedScores: { claim: 3, evidence: 3, warrant: 3 },
    evaluatorNotes: 'Complete and technically sound explanation of recursive filesystem search.'
  },
  {
    benchmarkId: 'CEW-TC29',
    taskId: 8,
    taskTitle: 'Lost Data',
    category: 'partial_evidence',
    claim: 'The file was found in /var using find.',
    evidence: 'Path was /var/lib/misc/subdir/lost_flag.txt.',
    warrant: 'Because find searches recursively.',
    expectedScores: { claim: 3, evidence: 2, warrant: 2 },
    evaluatorNotes: 'Omitted flag token from evidence and gave concise warrant.'
  },
  {
    benchmarkId: 'CEW-TC30',
    taskId: 8,
    taskTitle: 'Lost Data',
    category: 'vague_irrelevant',
    claim: 'Data was found.',
    evidence: 'Ran find.',
    warrant: 'Now the file is visible.',
    expectedScores: { claim: 1, evidence: 1, warrant: 1 },
    evaluatorNotes: 'Incomplete and vague across all components.'
  }
];

export class CEWBenchmarkService {
  public static toCEWSubmissions(dataset: BenchmarkCEWItem[] = BENCHMARK_CEW_DATASET): CEWSubmission[] {
    return dataset.map((item, idx) => ({
      submissionId: `bench-sub-${(idx + 1).toString().padStart(3, '0')}`,
      runId: 'formal_benchmark_suite',
      sessionId: `bench-sess-${item.taskId}`,
      taskId: item.taskId,
      testCaseId: `TC-CEW-${(idx + 1).toString().padStart(2, '0')}`,
      userId: 'researcher-benchmark-author',
      attemptNumber: 1,
      confidenceRaw: item.expectedScores.claim === 3 ? 5 : item.expectedScores.claim === 2 ? 3 : 1,
      confidenceNormalized: item.expectedScores.claim === 3 ? 1.0 : item.expectedScores.claim === 2 ? 0.6 : 0.2,
      claim: item.claim,
      evidence: item.evidence,
      warrant: item.warrant,
      isCorrect: item.expectedScores.claim >= 2,
      timeToSolveMs: 120000,
      activeInteractionTimeMs: 105000,
      idleTimeMs: 15000,
      timestamp: new Date(Date.now() - (30 - idx) * 60000).toISOString(),
      flagAttempted: item.claim,
      isLocked: false,
      version: 2
    }));
  }
}
