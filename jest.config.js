export default {
  roots: ['<rootDir>/test'],
  transform: {
    '^.+\\.(ts|js)$': 'esbuild-jest',
  },
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  extensionsToTreatAsEsm: ['.ts'],
  transformIgnorePatterns: ['/node_modules/(?!lodash-es)'],
};
