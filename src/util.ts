import { OptionValues } from 'commander';
import { Repo } from './stream';

export function raise(error: string): never {
  throw new Error(error);
}

export function tokenUnavailable(type: 'jira' | 'github'): never {
  let tokenType: string;
  switch (type) {
    case 'jira':
      tokenType = 'JIRA_API_TOKEN';
      break;
    case 'github':
      tokenType = 'GITHUB_API_TOKEN';
      break;
  }

  return raise(
    `${tokenType} not set.\nPlease set the ${tokenType} environment variable in '~/.config/regression-sniffer/.env' or '~/.env.regression-sniffer' or '~/.env.'`
  );
}

export function isDefaultValuesDisabled(): boolean {
  return process.env['NODEFAULTS'] ? true : false;
}

export function getDefaultValue(
  envName:
    | 'COMPONENT'
    | 'UPSTREAM'
    | 'DOWNSTREAM'
    | 'CLEANUP'
    | 'NOCOLOR'
    | 'DRY'
) {
  if (isDefaultValuesDisabled()) {
    return undefined;
  }

  const value = process.env[envName];

  if (
    (envName === 'NOCOLOR' || envName === 'DRY' || envName === 'CLEANUP') &&
    !value
  ) {
    return false;
  }

  return value;
}

export function getOptions(inputs: OptionValues): OptionValues {
  return {
    ...inputs,
    component: inputs.component || getDefaultValue('COMPONENT'),
    upstream: inputs.upstream || getDefaultValue('UPSTREAM'),
    downstream: inputs.downstream || getDefaultValue('DOWNSTREAM'),
  };
}

export function escapeRegex(regex: string): string {
  return regex.replace(/[/\-\\^$*+?.()|[\]{}]/g, '\\$&');
}
