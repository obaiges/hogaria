process.env.NODE_ENV ??= 'test';
process.env.DATABASE_URL ??= 'postgresql://hogaria:hogaria@localhost:5433/hogaria_test';
process.env.DIRECT_URL ??= process.env.DATABASE_URL;
