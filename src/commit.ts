import { filters } from './filter';
import { Git } from './git';
import { PullRequest } from './pullrequest';

export type ShaObject = { sha: string; backported?: boolean; waived?: boolean };

export class Commit {
  cherryPicks: ShaObject[] = [];

  followUps: ShaObject[] = [];
  reverts: ShaObject[] = [];

  backport: boolean = false;
  pr: PullRequest | undefined;

  constructor(
    readonly sha: string,
    readonly message: string,
    readonly upstreamGit: Git
  ) {
    this.getCherryPicks();
    this.getFollowUps();
  }

  getFollowUps() {
    this.cherryPicks.forEach(cherryPick => {
      this.followUps.push(
        ...this.toShaObject(
          this.upstreamGit.grepLog(cherryPick.sha, [
            ...filters.mention,
            ...filters.followUp,
          ])
        )
      );
      this.reverts.push(
        ...this.toShaObject(
          this.upstreamGit.grepLog(cherryPick.sha, filters.revert)
        )
      );
    });
  }

  toShaObject(sha: string[]): ShaObject[] {
    return this.removeDuplicates(sha).map(singleSha => {
      return { sha: singleSha };
    });
  }

  checkBackportedCommits(commits: Commit[]) {
    this.followUps.forEach(followUp => {
      const backported = commits.some(commit =>
        commit.cherryPicks.some(item => item.sha === followUp.sha)
      );

      if (backported) {
        followUp.backported = true;
      }
    });

    this.reverts.forEach(revert => {
      const backported = commits.some(commit =>
        commit.cherryPicks.some(item => item.sha === revert.sha)
      );

      if (backported) {
        revert.backported = true;
      }
    });
  }

  needsBackport() {
    const toBackport = [...this.followUps, ...this.reverts];

    return toBackport;
  }

  removeDuplicates(array: string[]) {
    return array.filter((value, index, self) => {
      return self.findIndex(item => item === value) === index;
    });
  }

  getCherryPicks() {
    const regexp = /\(cherry picked from commit (\b[0-9a-f]{5,40}\b)\) *\n?/g;

    const matches = [...this.message.matchAll(regexp)];
    this.cherryPicks = Array.isArray(matches)
      ? matches.map(match => {
          return { sha: match[1].toString() };
        })
      : [];
  }
}
