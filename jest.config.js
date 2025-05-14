import * as fs from 'node:fs';
import { pathsToModuleNameMapper } from 'ts-jest';

const tsconfig = JSON.parse(
  fs.readFileSync('./tsconfig.json', { encoding: 'utf8' }),
);

/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  clearMocks: true,
  moduleFileExtensions: ['ts', 'js'],
  moduleNameMapper: {
    ...pathsToModuleNameMapper(tsconfig.compilerOptions.paths),
    '^swell-js$': '<rootDir>/src/__mocks__/swell-js.js',
    '^swell-js/(.*)$': '<rootDir>/src/__mocks__/swell-js/$1',
  },
  modulePaths: [tsconfig.compilerOptions.baseUrl],
  restoreMocks: true,
  roots: ['<rootDir>/src'],
  testEnvironment: 'node',
  transform: {
    '^.+\\.(ts|js)$': ['esbuild-jest', { sourcemap: true }],
    '^.+\\.svg$': '<rootDir>/jest/file-transformer.js',
  },
  transformIgnorePatterns: ['/node_modules/(?!lodash-es)/'],
};
