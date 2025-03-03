import { Command } from 'commander';

import { Logger } from './logger';
import { getOctokit } from './octokit';
import { getDefaultValue, getOptions, tokenUnavailable } from './util';
import { Stream } from './stream';
import { PullRequest } from './pullrequest';

export function cli(): Command {
  const program = new Command();

  program
    .name('regression-sniffer')
    .description(
      '🔍 A small CLI tool is used to search for Jira issues with linked PRs and issues that are fixed in upstream projects'
    )
    .version('1.0.0');

  program
    .requiredOption(
      '-c, --component <component>',
      'component name',
      getDefaultValue('COMPONENT')
    )
    .requiredOption(
      '-d, --downstream <downstream>',
      'GitHub downstream source-git org/repo',
      getDefaultValue('DOWNSTREAM')
    )
    .option(
      '-f, --from <from>',
      'upstream version(tag) from which to start searching for backported commits'
    )
    .option(
      '-u, --upstream <upstream>',
      'GitHub upstream org/repo',
      getDefaultValue('UPSTREAM')
    )
    .option(
      '-w, --cleanup',
      'cleanup cloned repositories',
      getDefaultValue('CLEANUP')
    )
    .option('-n, --nocolor', 'disable color output', getDefaultValue('NOCOLOR'))
    .option('-x, --dry', 'dry run', getDefaultValue('DRY'));

  return program;
}

const runProgram = async () => {
  const program = cli();
  program.parse();

  const options = getOptions(program.opts());
  const logger = new Logger(!!options.nocolor);

  // const jiraToken = process.env.JIRA_API_TOKEN ?? tokenUnavailable("jira");
  // const jira = new Jira("https://issues.redhat.com", jiraToken, options.dry);

  const githubToken =
    process.env.GITHUB_API_TOKEN ?? tokenUnavailable('github');
  const octokit = getOctokit(githubToken);

  const upstreamRepo = Stream.getOwnerRepo(options.upstream) ?? {
    owner: options.component,
    repo: options.component,
  };
  const upstream = new Stream(upstreamRepo);

  const downstreamRepo = Stream.getOwnerRepo(options.downstream);
  const downstream = new Stream(downstreamRepo);

  upstream.git.clone();
  downstream.git.clone();

  // Get commits with cherry-picks
  logger.log(downstream.getBackportedCommits(upstream.git, options.from));

  downstream.removeAlreadyBackported();

  let count = 0;
  for (const commit of downstream.commits) {
    // if (commit.followUps.length > 0 || commit.reverts.length > 0) {
    //   console.log(
    //     `${commit.sha} - ${JSON.stringify(commit.followUps)} - ${JSON.stringify(commit.reverts)}`
    //   );
    // }

    if (
      commit.followUps.some(followUp => followUp?.backported === undefined) ||
      commit.reverts.some(revert => revert?.backported === undefined)
    ) {
      commit.pr = await PullRequest.getPullRequest(
        commit.sha,
        octokit,
        downstreamRepo
      );

      if (commit.pr) {
        console.log(await commit.pr.getCommentWithFollowUps());
      }

      console.log(
        `${commit.sha} - ${JSON.stringify(commit.followUps)} - ${JSON.stringify(commit.reverts)}${commit.pr ? ` - #${commit.pr.data.number} - waived: ${commit.pr?.isFollowUpWaived()}` : ''}`
      );
      count++;
    }
  }

  console.log(`Found ${count} commits with follow-ups or reverts`);

  //           // check if follow-up is backported
  //           if (
  //             downstreamCommits.some(commit => {
  //               return commit.isBackported(sha);
  //             })
  //           ) {
  //             return { sha, backported: true };
  //           }

  //   if (needsBackport.length > 0) {
  //     // Get PR that introduced commit
  //     const pr = await PullRequest.getPullRequest(
  //       commit.sha,
  //       octokit,
  //       upstreamRepo
  //     );

  //     logger.log(
  //       `${pr ? `${pr.isFollowUpWaived() ? '✅' : '🚨'}${pr.data.html_url} - ` : ''}${commit.sha} - ${JSON.stringify(needsBackport)}`
  //     );

  //     commitsWithFollowUps.push(commit);
  //   }
  // });

  // let table = `| **commit** | **follow-up** | **PR** | **JIRA** |\n`;
  // table += `|---|---|---|---|\n`;
  // commitsWithFollowUps.forEach(commit => {
  //   table += `| ${commit.sha} - _${commit.message}_ | ${commit.needsBackport().join(', ')} | | |\n`;
  // });

  // TODO:
  // - found all cherry-picks
  //   - check if cherry-pick has follow-up in upstream
  //     - YES: check if follow-up is backported
  //   - get Source git PR and check if followup was detected in PR that introduced commit and if it has follow-up waived label
  //     - YES: continue
  //     - NO: report

  // Example issue output:
  // [Regression Sniffer]: Found (4) follow-ups in upstream
  // | **commit**                                                                                                                                                 | **follow-up**                                                                      |                           **PR**                          |                          **JIRA**                         |
  // |--------------------------------------------------------------------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------|:---------------------------------------------------------:|:---------------------------------------------------------:|
  // | https://github.com/redhat-plumbers/systemd-rhel10/commit/e20fddc3c5769ad1babb24392500264de6db59b6 - _socket: fix socket activation of stopped services with_ | https://github.com/systemd/systemd/commit/ca10784ac1f846941d0137b3e3bc9f03bf2aa505 | https://github.com/redhat-plumbers/systemd-rhel10/pull/45 | [RHEL-60896](https://issues.redhat.com/browse/RHEL-60896) |
  // | https://github.com/redhat-plumbers/systemd-rhel10/commit/e20fddc3c5769ad1babb24392500264de6db59b6 - _socket: fix socket activation of stopped services with_ | https://github.com/systemd/systemd/commit/ca10784ac1f846941d0137b3e3bc9f03bf2aa505 | https://github.com/redhat-plumbers/systemd-rhel10/pull/45 | [RHEL-60896](https://issues.redhat.com/browse/RHEL-60896) |
  // | https://github.com/redhat-plumbers/systemd-rhel10/commit/e20fddc3c5769ad1babb24392500264de6db59b6 - _socket: fix socket activation of stopped services with_ | https://github.com/systemd/systemd/commit/ca10784ac1f846941d0137b3e3bc9f03bf2aa505 | https://github.com/redhat-plumbers/systemd-rhel10/pull/45 | [RHEL-60896](https://issues.redhat.com/browse/RHEL-60896) |
  // | https://github.com/redhat-plumbers/systemd-rhel10/commit/e20fddc3c5769ad1babb24392500264de6db59b6 - _socket: fix socket activation of stopped services with_ | https://github.com/systemd/systemd/commit/ca10784ac1f846941d0137b3e3bc9f03bf2aa505 | https://github.com/redhat-plumbers/systemd-rhel10/pull/45 | [RHEL-60896](https://issues.redhat.com/browse/RHEL-60896) |

  // Issue will hold information about detected and reported follow-ups
  // follow-up will be considered to be waived when JIRA issue would be closed
  // report only new follow-ups

  // Clean up
  if (options.cleanup) {
    downstream.git.removeClone();
    upstream.git.removeClone();
  }
};

export default runProgram;
