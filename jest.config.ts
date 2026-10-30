module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>/test'],
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
    transform: {
      '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/test/tsconfig.json' }],
    },
    // Couverture (npm run test:coverage) : le moteur seulement, l'interface est couverte par Playwright
    collectCoverageFrom: ['src/**/*.ts', '!src/ui/**', '!src/**/*.d.ts', '!src/index.ts', '!src/main.tsx', '!src/ai/aiWorker.ts'],
    coverageReporters: ['text-summary', 'text', 'html'],
  };
