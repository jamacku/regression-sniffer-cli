import { Commit } from './commit';
import { filters } from './filter';
import { Git } from './git';

export type Repo = { owner: string; repo: string };

export class Stream {
  readonly git: Git;

  // backportedCommits are used to story the SHA of all commits that have bee backported (has been cherry-picked)
  // it is used to check if follow-ups have been reported backported
  backportedCommits: string[] = [];

  // commits with follow-ups are stored here
  commits: Commit[] = [];

  constructor(repo: Repo) {
    this.git = new Git(
      repo.owner,
      repo.repo,
      `abc_${repo.owner}-${repo.repo}_cba`
    );
  }

  getBackportedCommits(upstreamGit: Git, from: string): void | string {
    this.backportedCommits = this.git.grepLog(`\\S+`, filters.cherryPick, from);

    if (this.backportedCommits.length === 0) {
      return 'No backported commits found.';
    }

    this.backportedCommits.forEach(sha => {
      const commitMessage = this.git.getCommitMessage(sha);
      this.commits.push(new Commit(sha, commitMessage, upstreamGit));
    });
  }

  removeAlreadyBackported() {
    this.commits.forEach(commit => {
      commit.checkBackportedCommits(this.commits);
    });
  }

  static getOwnerRepo(name: string): Repo;
  static getOwnerRepo(name: string | undefined):
    | {
        owner: string;
        repo: string;
      }
    | undefined {
    if (name === undefined) {
      return name;
    }

    const [owner, repo] = name.split('/');

    return { owner, repo };
  }
}
