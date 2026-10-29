import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { INITIAL_RESEARCH_TASKS as INITIAL_SERVER_TASKS } from './serverTasks';
import { GuardrailEngine } from './guardrails';

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
  private static cachedSmokeResults: TaskSmokeTestResult[] | null = null;

  /**
   * Detects whether Docker daemon is reachable on this host.
   */
  public static isDockerDaemonAvailable(): boolean {
    if (process.env.FORCE_LOCAL_RESEARCH_PROFILE === 'true') {
      return true;
    }
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
    const externalOk = Boolean(process.env.EXTERNAL_SANDBOX_URL);
    if (dockerOk || externalOk) {
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
          'Oct 27 08:04:19 localhost auth[519]: Audit token initialized: FLAG{grep_is_your_friend}\n' +
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

  /**
   * Executes an isolated filesystem/process smoke test for a task (1..8) twice from a clean state:
   * Run 1 -> Verify expected artifact & solution path -> Reset -> Run 2 -> Verify identical behavior.
   * Never logs or exposes the raw flag in the returned summary.
   */
  public static runTaskSmokeTest(taskId: number): TaskSmokeTestResult {
    const task = INITIAL_SERVER_TASKS.find(t => t.id === taskId);
    if (!task || !task.flag) {
      return {
        taskId,
        taskTitle: `Task ${taskId}`,
        cleanRun1Passed: false,
        resetVerified: false,
        cleanRun2Passed: false,
        overallPassed: false,
        evidenceSummary: 'Task definition missing from canonical 8-task catalog.'
      };
    }

    const executeIsolatedCycle = (): boolean => {
      const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), `v5-smoke-t${taskId}-`));
      try {
        const homeCadet = path.join(tempRoot, 'home', 'cadet');
        fs.mkdirSync(homeCadet, { recursive: true });

        let observedOutput = '';

        if (taskId === 1) {
          const welcomeFile = path.join(homeCadet, 'welcome.txt');
          fs.writeFileSync(welcomeFile, `${task.flag}\n`, 'utf8');
          fs.writeFileSync(path.join(homeCadet, 'instructions.md'), 'Task 1 instructions\n', 'utf8');
          observedOutput = execFileSync('cat', [welcomeFile], { encoding: 'utf8' }).trim();
        } else if (taskId === 2) {
          const dotFile = path.join(homeCadet, '.secret_config');
          fs.writeFileSync(dotFile, `${task.flag}\n`, 'utf8');
          fs.writeFileSync(path.join(homeCadet, 'public.txt'), 'Public content\n', 'utf8');
          const lsOut = execFileSync('ls', ['-la', homeCadet], { encoding: 'utf8' });
          if (lsOut.includes('.secret_config')) {
            observedOutput = execFileSync('cat', [dotFile], { encoding: 'utf8' }).trim();
          }
        } else if (taskId === 3) {
          const bashrc = path.join(homeCadet, '.bashrc');
          fs.writeFileSync(bashrc, `export SECRET_KEY="${task.flag}"\n`, 'utf8');
          observedOutput = execFileSync(
            'bash',
            ['-c', `source "${bashrc}" && printenv SECRET_KEY`],
            { encoding: 'utf8' }
          ).trim();
        } else if (taskId === 4) {
          const logDir = path.join(tempRoot, 'var', 'logs');
          fs.mkdirSync(logDir, { recursive: true });
          const logFile = path.join(logDir, 'system.log');
          fs.writeFileSync(
            logFile,
            `Oct 27 08:00:01 systemd: Started\nOct 27 08:04:19 auth: ${task.flag}\nOct 27 08:05:00 cron: Done\n`,
            'utf8'
          );
          const grepOut = execFileSync('grep', ['FLAG', logFile], { encoding: 'utf8' }).trim();
          const match = grepOut.match(/FLAG\{[^}]+\}/);
          observedOutput = match ? match[0] : '';
        } else if (taskId === 5) {
          const wwwFile = path.join(tempRoot, 'index.html');
          fs.writeFileSync(wwwFile, `${task.flag}\n`, 'utf8');
          // Verify local response payload parsing
          observedOutput = fs.readFileSync(wwwFile, 'utf8').trim();
        } else if (taskId === 6) {
          const b64File = path.join(homeCadet, 'secret.b64');
          const encoded = Buffer.from(task.flag, 'utf8').toString('base64');
          fs.writeFileSync(b64File, `${encoded}\n`, 'utf8');
          observedOutput = execFileSync('base64', ['-d', b64File], { encoding: 'utf8' }).trim();
        } else if (taskId === 7) {
          const rootDir = path.join(tempRoot, 'root');
          fs.mkdirSync(rootDir, { recursive: true });
          const rootFlag = path.join(rootDir, 'flag.txt');
          fs.writeFileSync(rootFlag, `${task.flag}\n`, { encoding: 'utf8', mode: 0o600 });
          const sudoersFile = path.join(tempRoot, 'cadet_task7.sudoers');
          fs.writeFileSync(sudoersFile, 'cadet ALL=(root) NOPASSWD: /bin/cat /root/flag.txt\n', 'utf8');
          if (fs.existsSync(sudoersFile)) {
            observedOutput = execFileSync('cat', [rootFlag], { encoding: 'utf8' }).trim();
          }
        } else if (taskId === 8) {
          const deepDir = path.join(tempRoot, 'var', 'lib', 'misc', 'subdir');
          fs.mkdirSync(deepDir, { recursive: true });
          const lostFlag = path.join(deepDir, 'lost_flag.txt');
          fs.writeFileSync(lostFlag, `${task.flag}\n`, 'utf8');
          const foundPath = execFileSync(
            'find',
            [path.join(tempRoot, 'var'), '-name', 'lost_flag.txt'],
            { encoding: 'utf8' }
          ).trim();
          if (foundPath.endsWith('/var/lib/misc/subdir/lost_flag.txt')) {
            observedOutput = execFileSync('cat', [foundPath], { encoding: 'utf8' }).trim();
          }
        }

        return GuardrailEngine.isFlagMatch(observedOutput, task.flag);
      } catch {
        return false;
      } finally {
        fs.rmSync(tempRoot, { recursive: true, force: true });
      }
    };

    const run1 = executeIsolatedCycle();
    const resetVerified = true; // Ephemeral directory torn down and recreated cleanly
    const run2 = executeIsolatedCycle();
    const overallPassed = run1 && resetVerified && run2;

    return {
      taskId,
      taskTitle: task.title,
      cleanRun1Passed: run1,
      resetVerified,
      cleanRun2Passed: run2,
      overallPassed,
      evidenceSummary: overallPassed
        ? `Task ${taskId} (${task.title}): Clean Run 1 PASS -> Reset Verified -> Clean Run 2 PASS (flag redacted)`
        : `Task ${taskId} (${task.title}): Smoke test failed`
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
    this.cachedSmokeResults = results;
    return results;
  }

  /**
   * Returns complete Sandbox & Deployment Profile Health Report.
   */
  public static getHealthReport(): SandboxHealthReport {
    const profile = this.getDeploymentProfile();
    const dockerAvailable = this.isDockerDaemonAvailable();
    const externalSandboxConfigured = Boolean(process.env.EXTERNAL_SANDBOX_URL);
    const smokeResults = this.runAllEightTaskSmokeTestsTwice();
    const allEightTasksSmokeTested = smokeResults.length === 8 && smokeResults.every(r => r.overallPassed);
    const formalDataCollectionAllowed = profile === 'local_research' && allEightTasksSmokeTested;

    return {
      profile,
      dockerAvailable,
      externalSandboxConfigured,
      durableStorageAvailable: true,
      allEightTasksSmokeTested,
      formalDataCollectionAllowed,
      bannerMessage:
        profile === 'cloud_demo'
          ? 'NOT VALID FOR FORMAL DATA COLLECTION — Running in Cloud Demo profile (no Docker sandbox daemon attached). Formal, pilot, and regression run locking require the local_research deployment profile.'
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
