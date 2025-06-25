import { afterEach, describe, expect, it, vi } from 'vitest';

import { Commit } from '../../src/commit';
import { Git } from '../../src/git';

const mocks = vi.hoisted(() => {
  return {
    grepLog: vi.fn(),
  };
});

vi.mock('../../src/git.ts', () => {
  const Git = vi.fn(() => {
    return {
      grepLog: mocks.grepLog,
    };
  });

  return { Git };
});

describe('Commit class', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it('can be instantiated', () => {
    vi.mocked(mocks.grepLog)
      .mockImplementationOnce((_sha, filter) => {
        expect(filter).toMatchInlineSnapshot(`
          [
            "(https:\\/\\/github\\.com\\/systemd\\/systemd\\/commit\\/)?(%{sha}%)",
            "follow-?up *(|:|-|for|to) *(https:\\/\\/github\\.com\\/systemd\\/systemd\\/commit\\/)?(%{sha}%)",
          ]
        `);

        return ['followUpSha1', 'followUpSha2'];
      })
      .mockImplementationOnce((_sha, filter) => {
        expect(filter).toMatchInlineSnapshot(`
          [
            "(This)? *reverts? *(commit)? *(|:|-) *(https:\\/\\/github\\.com\\/systemd\\/systemd\\/commit\\/)?(%{sha}%)",
          ]
        `);

        return ['revertSha1', 'revertSha2'];
      })
      .mockImplementation(() => []);

    const commit = new Commit(
      'sha',
      'message\n(cherry picked from commit 941a12dcba57f6673230a9c413738c51374d2998)\n(cherry picked from commit 123456dcba57f6673230a9c413738c51374d2998)\n',
      new Git('owner', 'repo')
    );

    expect(commit).toBeDefined();
    expect(commit.cherryPicks).toMatchInlineSnapshot(`
      [
        {
          "sha": "941a12dcba57f6673230a9c413738c51374d2998",
        },
        {
          "sha": "123456dcba57f6673230a9c413738c51374d2998",
        },
      ]
    `);

    expect(mocks.grepLog).toHaveBeenCalledTimes(4);
    expect(commit.followUps).toMatchInlineSnapshot(`
      [
        {
          "sha": "followUpSha1",
        },
        {
          "sha": "followUpSha2",
        },
      ]
    `);
    expect(commit.reverts).toMatchInlineSnapshot(`
      [
        {
          "sha": "revertSha1",
        },
        {
          "sha": "revertSha2",
        },
      ]
    `);
  });
});
