import { SandboxProvider } from '../server/sandboxProvider';

async function main() {
  const startTime = new Date().toISOString();
  const health = SandboxProvider.checkHealth();
  const results = SandboxProvider.runAllEightTaskSmokeTestsTwice();
  const endTime = new Date().toISOString();

  const allPassed = results.length === 8 && results.every(r => r.overallPassed);
  const allVerifiedWithRealDocker = results.every(r => r.verifiedWithRealDocker);

  const summary = {
    startTime,
    endTime,
    dockerAvailable: health.dockerAvailable,
    deploymentProfile: health.profile,
    allTasksPassed: allPassed,
    verifiedWithRealDocker: allVerifiedWithRealDocker,
    verificationScope: allVerifiedWithRealDocker
      ? 'verified_with_real_docker_containers'
      : 'verified_with_host_tempdir_fixture_mock_only',
    totalExecutions: results.length * 2,
    passedExecutions: results.reduce(
      (acc, r) => acc + (r.cleanRun1Passed ? 1 : 0) + (r.cleanRun2Passed ? 1 : 0),
      0
    ),
    tasks: results
  };

  console.log(JSON.stringify(summary, null, 2));
  if (!allPassed) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
