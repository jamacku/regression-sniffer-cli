import { Version2Client } from 'jira.js';

import { raise } from './util';

export class Jira {
  readonly api: Version2Client;
  readonly fields = {};

  constructor(
    readonly instance: string,
    apiToken: string,
    readonly dry: boolean
  ) {
    this.api = new Version2Client({
      host: instance,
      authentication: {
        personalAccessToken: apiToken,
      },
    });
  }

  async getVersion(): Promise<string> {
    const response = await this.api.serverInfo.getServerInfo();
    return response.version ?? raise('Jira.getVersion(): missing version.');
  }

  getIssueURL(issue: string) {
    return `${this.instance}/browse/${issue}`;
  }
}
