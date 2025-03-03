import { Endpoints } from '@octokit/types';
import { CustomOctokit } from './octokit';
import { Repo } from './stream';

export class PullRequest {
  comment: string | undefined;

  constructor(
    readonly owner: string,
    readonly repo: string,
    readonly data: Endpoints['GET /repos/{owner}/{repo}/commits/{commit_sha}/pulls']['response']['data'][number],
    readonly octokit: CustomOctokit
  ) {}

  isFollowUpWaived() {
    return this.data.labels.some(label => label.name === 'follow-up-waived');
  }

  async getCommentWithFollowUps() {
    const commentID = this.getCommentID();

    if (!commentID) {
      return undefined;
    }

    this.comment = await this.getIssueComment(commentID);
    return this.comment;
  }

  getCommentID() {
    const regex = /<!-- issue-commentator = {.*"comment-id":"(\d+)".*} -->/;

    return this.data.body?.match(regex)?.[1];
  }

  async getIssueComment(commentID: string) {
    const { data } = await this.octokit.request(
      'GET /repos/{owner}/{repo}/issues/comments/{comment_id}',
      {
        owner: this.owner,
        repo: this.repo,
        comment_id: +commentID,
      }
    );

    return data?.body;
  }

  // TODO: Check if Followup was reported in PR
  wasFollowUpReported(followups: string[]) {}

  static async getPullRequest(
    sha: string,
    octokit: CustomOctokit,
    repo: Repo
  ): Promise<PullRequest | undefined> {
    let data: Endpoints['GET /repos/{owner}/{repo}/commits/{commit_sha}/pulls']['response']['data'] =
      [];

    try {
      data = (
        await octokit.request(
          'GET /repos/{owner}/{repo}/commits/{commit_sha}/pulls',
          {
            ...repo,
            commit_sha: sha,
          }
        )
      ).data;
    } catch (error) {
      return undefined;
    }

    if (data.length === 0) {
      return undefined;
    }

    return new PullRequest(repo.owner, repo.repo, data[0], octokit);
  }
}
