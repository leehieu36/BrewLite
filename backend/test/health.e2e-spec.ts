// Example E2E test template. Configure a test database before enabling in CI.
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';

describe('BrewLite API (e2e template)', () => {
  let app: INestApplication;
  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });
  afterAll(async () => { await app?.close(); });
  it('initializes the application', () => { expect(app).toBeDefined(); });
});
