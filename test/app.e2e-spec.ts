import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { RosterController } from './../src/roster.controller';
import { RosterService } from './../src/roster.service';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [RosterController],
      providers: [
        {
          provide: RosterService,
          useValue: {
            metadata: jest
              .fn()
              .mockResolvedValue({ prefixes: [], genders: [], gradeLevels: [], teachers: [] }),
            students: jest.fn().mockResolvedValue([]),
            student: jest.fn(),
            createStudent: jest.fn(),
            updateStudent: jest.fn(),
            deleteStudent: jest.fn(),
            classrooms: jest.fn().mockResolvedValue([]),
            classroom: jest.fn(),
            createClassroom: jest.fn(),
            updateClassroom: jest.fn(),
            deleteClassroom: jest.fn(),
            classroomStudents: jest.fn().mockResolvedValue([]),
            addStudent: jest
              .fn()
              .mockResolvedValue({ classroomId: 3, studentId: 1, academicYear: 2569 }),
            removeStudent: jest.fn(),
          },
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('exposes metadata and lists without a database connection', async () => {
    await request(app.getHttpServer())
      .get('/metadata')
      .expect(200, { prefixes: [], genders: [], gradeLevels: [], teachers: [] });
    await request(app.getHttpServer()).get('/students').expect(200, []);
    await request(app.getHttpServer()).get('/classrooms').expect(200, []);
  });

  it('returns 201 for classroom assignment', () => {
    return request(app.getHttpServer())
      .post('/classrooms/3/students')
      .send({ studentId: 1 })
      .expect(201, { classroomId: 3, studentId: 1, academicYear: 2569 });
  });

  it.each([
    ['get', '/students/0x1'],
    ['patch', '/students/0x1'],
    ['delete', '/students/0x1'],
    ['get', '/classrooms/0x1'],
    ['patch', '/classrooms/0x1'],
    ['delete', '/classrooms/0x1'],
    ['get', '/classrooms/0x1/students'],
    ['post', '/classrooms/0x1/students'],
    ['delete', '/classrooms/0x1/students/1'],
    ['delete', '/classrooms/1/students/0x1'],
  ] as const)('rejects nondecimal path ID on %s %s', async (method, path) => {
    await request(app.getHttpServer())[method](path).send({ studentId: 1 }).expect(400);
  });

  it.each(['0', '1e0', '1.0', '9007199254740992'])(
    'rejects invalid or unsafe student ID %s',
    async (value) => {
      await request(app.getHttpServer()).get(`/students/${value}`).expect(400);
    },
  );

  afterEach(async () => {
    await app.close();
  });
});
