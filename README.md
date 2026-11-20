# School Room Backend

NestJS 11, TypeORM, and MySQL API for student and classroom management. Use Node.js 22.23.2.

## Setup and run

1. Run `npm ci` in this directory.
2. Copy `.env.example` to `.env` and enter credentials for the existing seven-table MySQL database. Keep `.env` local.
3. Run `npm run start:dev`.

The API listens on `http://localhost:3000` and allows browser requests from
`http://localhost:5173`. TypeORM uses `synchronize: false`; startup does not create or
migrate tables.

## REST API

All bodies are JSON. Student dates use `YYYY-MM-DD`. List endpoints exclude logically deleted rows.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/metadata` | Active prefixes and genders, grade levels, active teachers |
| GET, POST | `/students` | List/search or create students |
| GET, PATCH, DELETE | `/students/:id` | Read, edit, or soft-delete a student |
| GET, POST | `/classrooms` | List/search or create classrooms |
| GET, PATCH, DELETE | `/classrooms/:id` | Read, edit, or soft-delete a classroom |
| GET, POST | `/classrooms/:id/students` | List or assign classroom students |
| DELETE | `/classrooms/:id/students/:studentId` | Remove an active assignment |

Student searches accept `studentCode`, `name`, and `gradeLevelId`. Student create accepts
`studentCode`, `prefixId`, `firstName`, `lastName`, `genderId`, `birthDate`, and
`gradeLevelId`. Classroom searches accept `roomNo`, `roomName`, and `teacherName`.
Classroom create accepts `roomNo`, `roomName`, `academicYear`, `gradeLevelId`, and nullable
`homeroomTeacherId`. PATCH accepts a subset of the corresponding fields.

Assign a student with `POST /classrooms/:id/students` and `{ "studentId": 1 }`. If the student
has another active room in that academic year, the API returns 409 with
`code: "STUDENT_IN_OTHER_CLASSROOM"` and `currentClassroom`. After user confirmation, retry
with `{ "studentId": 1, "confirmTransfer": true }`. The transfer is transactional and
serializes concurrent assignments for that student. Student and classroom grades must
match. Deleting a student or classroom also ends active memberships.

Validation errors and invalid references return 400; missing or deleted path resources
return 404; uniqueness and membership conflicts return 409; successful DELETE returns 204.

## Verify

```bash
npm test -- --runInBand
npm run test:e2e -- --runInBand
npm run build
```

Tests use mocked repositories or a mocked HTTP service and do not connect to MySQL. The
standalone report is [Report.sql](../Report.sql) in the parent directory; the application
does not expose a report endpoint.
