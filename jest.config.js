import * as fs from 'node:fs';
import { pathsToModuleNameMapper } from 'ts-jest';

const tsconfig = JSON.parse(
  fs.readFileSync('./tsconfig.json', { encoding: 'utf8' }),
);

/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  roots: ['<rootDir>/test', '<rootDir>/src'],
  testEnvironment: 'node',
  modulePaths: [tsconfig.compilerOptions.baseUrl],
  moduleNameMapper: pathsToModuleNameMapper(tsconfig.compilerOptions.paths),
  moduleFileExtensions: ['ts', 'js'],
  transformIgnorePatterns: ['/node_modules/(?!(lodash-es)/)'],
  transform: {
    '^.+\\.(ts|js)$': ['esbuild-jest', { sourcemap: true }],
  },
};
