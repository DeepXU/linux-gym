import { db } from '../server/db';
import { INITIAL_RESEARCH_TASKS } from '../server/serverTasks';
import { INITIAL_TEST_CASES } from '../server/testRunner';

async function main() {
  const args = process.argv.slice(2);
  const confirmIdx = args.indexOf('--confirm');
  const confirmToken = confirmIdx >= 0 ? args[confirmIdx + 1] : '';

  if (confirmToken !== 'CONFIRM_ARCHIVE_AND_RESET') {
    console.error(
      'Refusing to reset study data without explicit confirmation.\n' +
        'Usage: npx tsx scripts/archive_and_reset_study_data.ts --confirm CONFIRM_ARCHIVE_AND_RESET'
    );
    process.exit(1);
  }

  const result = await db.archiveAndResetStudyData(
    confirmToken,
    INITIAL_RESEARCH_TASKS,
    INITIAL_TEST_CASES
  );
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
