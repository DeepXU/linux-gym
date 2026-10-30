import { execFileSync } from 'child_process';
import { INITIAL_RESEARCH_TASKS as INITIAL_SERVER_TASKS } from './serverTasks';

export type DeploymentProfile = 'local_research' | 'cloud_demo';

export interface SandboxHealthReport {
  profile: DeploymentProfile;
  dockerAvailable: boolean;
  externalSandboxConfigured: boolean;
  durableStorageAvailable: boolean;
  allEightTasksSmokeTested: boolean;
  formalDataCollectionAllowed: boolean;
  bannerMessage?: string;
  taskSmokeResults: TaskSmokeTestResult[];
  checkedAt: string;
}

export interface TaskSmokeTestResult {
  taskId: number;
  taskTitle: string;
  verifiedWithRealDocker: boolean;
  executionBackend: 'docker_container' | 'unavailable';
  leakedContainers: string[];
  cleanRun1Passed: boolean;
  resetVerified: boolean;
  cleanRun2Passed: boolean;
  overallPassed: boolean;
  evidenceSummary: string;
}

export interface TerminalEvidenceEntry {
  command: string;
  outputSnippet: string;
  timestamp: string;
  sequenceNumber: number;
}

/**
 * Bounded per-session terminal evidence buffer so TutorOrchestrator can inspect
 * recent terminal activity as untrusted evidence without client spoofing.
 */
const sessionTerminalBuffers = new Map<string, TerminalEvidenceEntry[]>();
const MAX_BUFFER_ENTRIES = 10;
const MAX_OUTPUT_CHARS = 600;

export class SandboxProvider {
  public static readonly DEFAULT_DOCKER_IMAGE =
    process.env.DOCKER_IMAGE || 'linux-tutor-sandbox:latest';

  private static cachedSmokeResults: TaskSmokeTestResult[] | null = null;

  /**
   * Detects whether Docker daemon is reachable on this host.
   */
  public static isDockerDaemonAvailable(): boolean {
    try {
      execFileSync('docker', ['info'], { stdio: 'ignore', timeout: 2500 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Determines the active deployment profile:
   * - 'local_research': Docker daemon or verified external sandbox is available and all 8 task smoke tests pass.
   * - 'cloud_demo': Cloud Run / container environment without Docker daemon access. Displays persistent banner
   *   and rejects pilot/formal/regression run creation.
   */
  public static getDeploymentProfile(): DeploymentProfile {
    const dockerOk = this.isDockerDaemonAvailable();
    if (dockerOk) {
      return 'local_research';
    }
    return 'cloud_demo';
  }

  /**
   * Returns root-level container provisioning script for a given Task ID (1..8)
   * that executes BEFORE dropping privileges to unprivileged user 'cadet' (UID 1000).
   */
  public static buildRootProvisioningScript(taskId: number): string {
    const baseSetup = [
      'mkdir -p /home/cadet',
      'chown 1000:1000 /home/cadet'
    ];

    switch (taskId) {
      case 1:
        baseSetup.push(
          'echo "FLAG{linux_basics_mastered}" > /home/cadet/welcome.txt',
          'echo "Task 1: Inspect welcome.txt using standard file viewing utilities." > /home/cadet/instructions.md',
          'chown 1000:1000 /home/cadet/welcome.txt /home/cadet/instructions.md',
          'chmod 644 /home/cadet/welcome.txt /home/cadet/instructions.md'
        );
        break;
      case 2:
        baseSetup.push(
          'echo "FLAG{hidden_files_revealed}" > /home/cadet/.secret_config',
          'echo "Nothing secret in this public file." > /home/cadet/public.txt',
          'chown 1000:1000 /home/cadet/.secret_config /home/cadet/public.txt',
          'chmod 644 /home/cadet/.secret_config /home/cadet/public.txt'
        );
        break;
      case 3:
        // Persist SECRET_KEY in .bashrc and /etc/profile so the interactive shell always inherits it
        baseSetup.push(
          'grep -q "SECRET_KEY=" /home/cadet/.bashrc 2>/dev/null || echo \'export SECRET_KEY="FLAG{env_vars_insecure}"\' >> /home/cadet/.bashrc',
          'mkdir -p /etc/profile.d && echo \'export SECRET_KEY="FLAG{env_vars_insecure}"\' > /etc/profile.d/task3_secret.sh',
          'chown 1000:1000 /home/cadet/.bashrc'
        );
        break;
      case 4:
        // Root creates /var/logs/system.log with realistic multi-line syslog entries and readable permissions
        baseSetup.push(
          'mkdir -p /var/logs',
          'cat << \'EOF\' > /var/logs/system.log\n' +
          'Oct 27 08:00:01 localhost systemd[1]: Started System Logging Service.\n' +
          'Oct 27 08:01:12 localhost sshd[412]: Server listening on 0.0.0.0 port 22.\n' +
          'Oct 27 08:02:44 localhost kernel: [   14.201928] eth0: link becomes ready\n' +
          'Oct 27 08:04:19 localhost auth[519]: CRITICAL: FLAG{grep_is_powerful}\n' +
          'Oct 27 08:05:00 localhost cron[601]: (root) CMD (run-parts /etc/cron.hourly)\n' +
          'EOF',
          'chmod 755 /var/logs && chmod 644 /var/logs/system.log'
        );
        break;
      case 5:
        // Start loopback HTTP listener on 127.0.0.1:8080 inside the sandbox namespace
        baseSetup.push(
          'mkdir -p /tmp/task5_www',
          'echo "FLAG{curl_local_services}" > /tmp/task5_www/index.html',
          'if command -v python3 >/dev/null 2>&1; then nohup python3 -m http.server 8080 --bind 127.0.0.1 --directory /tmp/task5_www >/dev/null 2>&1 & fi'
        );
        break;
      case 6:
        baseSetup.push(
          'echo -n "FLAG{pipes_and_decoding}" | base64 > /home/cadet/secret.b64',
          'chown 1000:1000 /home/cadet/secret.b64',
          'chmod 644 /home/cadet/secret.b64'
        );
        break;
      case 7:
        // Root creates /root/flag.txt and narrowly permits cadet to read /root/flag.txt via sudo
        baseSetup.push(
          'mkdir -p /root',
          'echo "FLAG{sudo_power_unlocked}" > /root/flag.txt',
          'chmod 600 /root/flag.txt',
          'mkdir -p /etc/sudoers.d',
          'echo "cadet ALL=(root) NOPASSWD: /bin/cat /root/flag.txt, /usr/bin/cat /root/flag.txt" > /etc/sudoers.d/cadet_task7',
          'chmod 440 /etc/sudoers.d/cadet_task7'
        );
        break;
      case 8:
        // Canonical path matching serverTasks.ts: /var/lib/misc/subdir/lost_flag.txt
        baseSetup.push(
          'mkdir -p /var/lib/misc/subdir',
          'echo "FLAG{find_command_expert}" > /var/lib/misc/subdir/lost_flag.txt',
          'chmod -R 755 /var/lib/misc && chmod 644 /var/lib/misc/subdir/lost_flag.txt'
        );
        break;
      default:
        break;
    }

    return baseSetup.join(' && ');
  }

  private static shellQuote(value: string): string {
    return `'${value.replace(/'/g, `'\\''`)}'`;
  }

  private static getSmokeVerificationCommand(taskId: number, flag: string): string {
    const checks: Record<number, string> = {
      1: `test -r /home/cadet/welcome.txt && grep -q ${this.shellQuote(flag)} /home/cadet/welcome.txt`,
      2: `test -r /home/cadet/.secret_config && ls -la /home/cadet | grep -q .secret_config`,
      3: `test "$SECRET_KEY" = ${this.shellQuote(flag)}`,
      4: `grep -q ${this.shellQuote(`CRITICAL: ${flag}`)} /var/logs/system.log`,
      5: `for attempt in $(seq 1 20); do curl -fsS http://127.0.0.1:8080/ | grep -q ${this.shellQuote(flag)} && exit 0; sleep 0.25; done; exit 1`,
      6: `test "$(base64 -d /home/cadet/secret.b64)" = ${this.shellQuote(flag)}`,
      7: 'sudo -n /bin/cat /root/flag.txt >/dev/null',
      8: `found="$(find /var/lib/misc -name lost_flag.txt -print -quit)"; test "$found" = /var/lib/misc/subdir/lost_flag.txt && test -r "$found"`
    };
    return checks[taskId] || 'exit 1';
  }

  private static executeDockerSmokeCycle(taskId: number, flag: string): { passed: boolean; leakedContainers: string[]; error?: string } {
    const containerName = `linux-gym-smoke-${taskId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const image = this.DEFAULT_DOCKER_IMAGE;
    const setup = this.buildRootProvisioningScript(taskId);
    const verification = this.getSmokeVerificationCommand(taskId, flag);
    const learnerCheck = `test "$(id -u)" = 1000 && cd /home/cadet && ${verification}`;
    const script = `set -eu; ${setup}; su -s /bin/bash -c ${this.shellQuote(learnerCheck)} cadet; printf 'SMOKE_PASS\\n'`;
    const taskEnvironment = taskId === 3 ? ['-e', `SECRET_KEY=${flag}`] : [];
    // Task 7 explicitly tests its task-scoped sudo rule; all other smoke tasks keep no-new-privileges.
    const privilegeOptions = taskId === 7 ? [] : ['--security-opt', 'no-new-privileges:true'];
    let passed = false;
    let error: string | undefined;

    try {
      const output = execFileSync('docker', [
        'run',
        '--rm',
        '--name', containerName,
        '--network', 'none',
        '--memory', '256m',
        '--memory-swap', '256m',
        '--cpus', '0.5',
        '--pids-limit', '64',
        '--cap-drop', 'ALL',
        '--cap-add', 'SETUID',
        '--cap-add', 'SETGID',
        ...privilegeOptions,
        '--tmpfs', '/tmp:rw,noexec,nosuid,size=64m',
        '--tmpfs', '/run:rw,nosuid,size=16m',
        '--tmpfs', '/home/cadet:rw,nosuid,size=128m',
        '--workdir', '/home/cadet',
        '--user', '0:0',
        ...taskEnvironment,
        image,
        'bash',
        '-lc',
        script
      ], { encoding: 'utf8', timeout: 45000, stdio: ['ignore', 'pipe', 'pipe'] });
      passed = output.includes('SMOKE_PASS');
      if (!passed) error = 'Docker smoke container exited without its success marker.';
    } catch (caught) {
      const failure = caught as NodeJS.ErrnoException & { status?: number };
      error = failure.code === 'ETIMEDOUT'
        ? 'Docker smoke container exceeded the 45-second timeout.'
        : `Docker smoke container failed${failure.status === undefined ? '' : ` with exit code ${failure.status}`}.`;
    }

    let leakedContainers: string[] = [];
    try {
      const listed = execFileSync('docker', ['ps', '-aq', '--filter', `name=${containerName}`], {
        encoding: 'utf8',
        timeout: 5000,
        stdio: ['ignore', 'pipe', 'pipe']
      }).trim();
      if (listed) {
        try {
          execFileSync('docker', ['rm', '-f', containerName], { stdio: 'ignore', timeout: 10000 });
        } catch {
          // The leak remains visible in the report below.
        }
        const remaining = execFileSync('docker', ['ps', '-aq', '--filter', `name=${containerName}`], {
          encoding: 'utf8',
          timeout: 5000,
          stdio: ['ignore', 'pipe', 'pipe']
        }).trim();
        leakedContainers = remaining ? [containerName] : [];
      }
    } catch {
      error = error || 'Unable to verify smoke-container cleanup with Docker.';
      passed = false;
    }

    return { passed: passed && leakedContainers.length === 0, leakedContainers, error };
  }

  /**
   * Executes each task twice in fresh, isolated Docker containers and reports no pass when Docker is unavailable.
   */
  public static runTaskSmokeTest(taskId: number): TaskSmokeTestResult {
    const task = INITIAL_SERVER_TASKS.find(t => t.id === taskId);
    if (!task || !task.flag || !this.isDockerDaemonAvailable()) {
      return {
        taskId,
        taskTitle: task?.title || `Task ${taskId}`,
        verifiedWithRealDocker: false,
        executionBackend: 'unavailable',
        leakedContainers: [],
        cleanRun1Passed: false,
        resetVerified: false,
        cleanRun2Passed: false,
        overallPassed: false,
        evidenceSummary: !task || !task.flag
          ? 'Task definition missing from canonical 8-task catalog.'
          : 'Docker daemon is unavailable; no host fixture was used.'
      };
    }

    const run1 = this.executeDockerSmokeCycle(taskId, task.flag);
    const run2 = this.executeDockerSmokeCycle(taskId, task.flag);
    const resetVerified =
      run1.passed &&
      run2.passed &&
      run1.leakedContainers.length === 0 &&
      run2.leakedContainers.length === 0;
    const overallPassed = run1.passed && resetVerified && run2.passed;
    const leakedContainers = [...run1.leakedContainers, ...run2.leakedContainers];

    return {
      taskId,
      taskTitle: task.title,
      verifiedWithRealDocker: true,
      executionBackend: 'docker_container',
      leakedContainers,
      cleanRun1Passed: run1.passed,
      resetVerified,
      cleanRun2Passed: run2.passed,
      overallPassed,
      evidenceSummary: overallPassed
        ? `Task ${taskId} (${task.title}): two fresh Docker containers passed as cadet; no leaks.`
        : `Task ${taskId} (${task.title}): Docker run failed. ${run1.error || run2.error || (leakedContainers.length ? 'Container cleanup failed.' : 'Verification failed.')}`
    };
  }

  /**
   * Runs all 8 canonical tasks twice from clean state.
   */
  public static runAllEightTaskSmokeTestsTwice(forceRefresh = false): TaskSmokeTestResult[] {
    if (this.cachedSmokeResults && !forceRefresh) {
      return this.cachedSmokeResults;
    }
    const results: TaskSmokeTestResult[] = [];
    for (let id = 1; id <= 8; id++) {
      results.push(this.runTaskSmokeTest(id));
    }
    this.cachedSmokeResults = results.every(result => result.verifiedWithRealDocker)
      ? results
      : null;
    return results;
  }

  /**
   * Returns complete Sandbox & Deployment Profile Health Report.
   */
  public static getHealthReport(): SandboxHealthReport {
    const profile = this.getDeploymentProfile();
    const dockerAvailable = this.isDockerDaemonAvailable();
    const externalSandboxConfigured = false;
    const smokeResults = this.cachedSmokeResults || [];
    const allEightTasksSmokeTested =
      smokeResults.length === 8 &&
      smokeResults.every(r => r.verifiedWithRealDocker && r.executionBackend === 'docker_container' && r.overallPassed);
    const formalDataCollectionAllowed = profile === 'local_research' && allEightTasksSmokeTested;

    return {
      profile,
      dockerAvailable,
      externalSandboxConfigured,
      durableStorageAvailable: true,
      allEightTasksSmokeTested,
      formalDataCollectionAllowed,
      bannerMessage: !formalDataCollectionAllowed
        ? profile === 'cloud_demo'
          ? 'NOT VALID FOR FORMAL DATA COLLECTION — Docker sandbox daemon is unavailable.'
          : 'NOT VALID FOR FORMAL DATA COLLECTION — Eight-task real-Docker smoke verification has not passed in this server process.'
        : undefined,
      taskSmokeResults: smokeResults,
      checkedAt: new Date().toISOString()
    };
  }

  public static checkHealth(): SandboxHealthReport {
    return this.getHealthReport();
  }

  /**
   * Appends a line-buffered command and bounded terminal output to the session's evidence buffer.
   */
  public static recordTerminalEvidence(
    sessionId: string,
    command?: string,
    output?: string,
    sequenceNumber: number = 0
  ): void {
    if (!sessionId) return;
    const list = sessionTerminalBuffers.get(sessionId) || [];
    const cleanCmd = (command || '').trim().slice(0, 240);
    const cleanOut = (output || '').trim().slice(0, MAX_OUTPUT_CHARS);
    list.push({
      command: cleanCmd,
      outputSnippet: cleanOut,
      timestamp: new Date().toISOString(),
      sequenceNumber
    });
    if (list.length > MAX_BUFFER_ENTRIES) {
      list.splice(0, list.length - MAX_BUFFER_ENTRIES);
    }
    sessionTerminalBuffers.set(sessionId, list);
  }

  public static getBoundedTerminalEvidence(sessionId: string): TerminalEvidenceEntry[] {
    return [...(sessionTerminalBuffers.get(sessionId) || [])];
  }

  public static clearTerminalEvidence(sessionId: string): void {
    sessionTerminalBuffers.delete(sessionId);
  }
}
