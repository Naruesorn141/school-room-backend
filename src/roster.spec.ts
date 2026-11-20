import { BadRequestException, ConflictException } from '@nestjs/common';
import { RosterService } from './roster.service';

const student = { id: 1, studentCode: 'S1', gradeLevelId: 2, deletedAt: null };
const room = { id: 3, roomNo: '1', roomName: 'A', academicYear: 2569, gradeLevelId: 2, deletedAt: null };

describe('RosterService', () => {
  let service: RosterService;
  let repositories: Record<string, any>;
  let dataSource: any;

  beforeEach(() => {
    repositories = Object.fromEntries(['Student', 'Classroom', 'ClassroomStudent', 'Prefix', 'Gender', 'GradeLevel', 'Teacher'].map(name => [name, { find: jest.fn().mockResolvedValue([]), findOne: jest.fn(), save: jest.fn(async x => ({ id: 1, ...x })), update: jest.fn() }]));
    dataSource = { getRepository: jest.fn((entity: any) => repositories[entity.name]), transaction: jest.fn(async fn => fn({ getRepository: dataSource.getRepository })) };
    service = new RosterService(dataSource);
  });

  it('excludes deleted students and filters by name', async () => {
    repositories.Student.find.mockResolvedValue([{ ...student, firstName: 'Ann', lastName: 'Lee' }, { ...student, id: 2, firstName: 'Bob', lastName: 'Ray' }]);
    expect((await service.students({ name: 'ann' })).map(x => x.id)).toEqual([1]);
    expect(repositories.Student.find).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ deletedAt: expect.anything() }) }));
  });

  it('validates student references and rejects an invalid grade', async () => {
    repositories.Prefix.findOne.mockResolvedValue({ id: 1, isActive: true });
    repositories.Gender.findOne.mockResolvedValue({ id: 1, isActive: true });
    await expect(service.createStudent({ studentCode: 'S2', prefixId: 1, firstName: 'A', lastName: 'B', genderId: 1, birthDate: '2015-01-01', gradeLevelId: 7 })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a grade change that invalidates membership', async () => {
    repositories.Student.findOne.mockResolvedValue(student);
    repositories.GradeLevel.findOne.mockResolvedValue({ id: 4 });
    repositories.ClassroomStudent.find.mockResolvedValue([{ classroomId: 3 }]);
    repositories.Classroom.findOne.mockResolvedValue(room);
    await expect(service.updateStudent(1, { gradeLevelId: 4 })).rejects.toBeInstanceOf(ConflictException);
    expect(dataSource.transaction).toHaveBeenCalled();
    expect(repositories.Student.findOne).toHaveBeenCalledWith(expect.objectContaining({ lock: { mode: 'pessimistic_write' } }));
  });

  it('requires confirmation and serializes confirmed transfer with a student lock', async () => {
    const old = { id: 8, classroomId: 2, studentId: 1, academicYear: 2569, classroom: { id: 2, roomNo: '2', roomName: 'B' } };
    repositories.Classroom.findOne.mockResolvedValue(room);
    repositories.Student.findOne.mockResolvedValue(student);
    repositories.ClassroomStudent.find.mockResolvedValue([old]);
    await expect(service.addStudent(3, { studentId: 1 })).rejects.toMatchObject({ response: { code: 'STUDENT_IN_OTHER_CLASSROOM' } });
    await service.addStudent(3, { studentId: 1, confirmTransfer: true });
    expect(repositories.Student.findOne).toHaveBeenCalledWith(expect.objectContaining({ lock: { mode: 'pessimistic_write' } }));
    expect(repositories.ClassroomStudent.update).toHaveBeenCalled();
    expect(repositories.ClassroomStudent.save).toHaveBeenCalled();
  });

  it('soft deletes a classroom and active memberships in a transaction', async () => {
    repositories.Classroom.findOne.mockResolvedValue(room);
    await service.deleteClassroom(3);
    expect(dataSource.transaction).toHaveBeenCalled();
    expect(repositories.Classroom.update).toHaveBeenCalledWith(3, expect.objectContaining({ deletedAt: expect.any(Date) }));
    expect(repositories.ClassroomStudent.update).toHaveBeenCalled();
    expect(repositories.Classroom.findOne).toHaveBeenCalledWith(expect.objectContaining({ lock: { mode: 'pessimistic_write' } }));
  });

  it('allows a classroom without a teacher and validates academic year', async () => {
    repositories.GradeLevel.findOne.mockResolvedValue({ id: 2, name: 'P2' });
    const payload = { roomNo: '1', roomName: 'A', academicYear: 2569, gradeLevelId: 2 };
    await service.createClassroom(payload);
    expect(repositories.Classroom.save).toHaveBeenCalledWith(expect.objectContaining({ homeroomTeacherId: null }));
    await expect(service.createClassroom({ ...payload, academicYear: 70000 })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects overlong student code before saving', async () => {
    await expect(service.createStudent({ studentCode: 'X'.repeat(21), prefixId: 1, firstName: 'A', lastName: 'B', genderId: 1, birthDate: '2015-01-01', gradeLevelId: 2 })).rejects.toBeInstanceOf(BadRequestException);
    expect(repositories.Student.save).not.toHaveBeenCalled();
  });

  it('returns 400 for a missing student reference on assignment', async () => {
    repositories.Student.findOne.mockResolvedValue(null);
    await expect(service.addStudent(3, { studentId: 999 })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects re-adding to the same room', async () => {
    repositories.Student.findOne.mockResolvedValue(student);
    repositories.Classroom.findOne.mockResolvedValue(room);
    repositories.ClassroomStudent.find.mockResolvedValue([{ id: 1, classroomId: 3 }]);
    await expect(service.addStudent(3, { studentId: 1, confirmTransfer: true })).rejects.toBeInstanceOf(ConflictException);
    expect(repositories.ClassroomStudent.save).not.toHaveBeenCalled();
    expect(repositories.Classroom.findOne).toHaveBeenCalledWith(expect.objectContaining({ lock: { mode: 'pessimistic_write' } }));
  });

  it('removes an active membership and returns 404 for an absent one', async () => {
    repositories.Student.findOne.mockResolvedValue(student);
    repositories.Classroom.findOne.mockResolvedValue(room);
    repositories.ClassroomStudent.findOne.mockResolvedValueOnce({ id: 5 }).mockResolvedValueOnce(null);
    await service.removeStudent(3, 1);
    expect(repositories.ClassroomStudent.update).toHaveBeenCalledWith(5, expect.objectContaining({ deletedAt: expect.any(Date) }));
    await expect(service.removeStudent(3, 1)).rejects.toMatchObject({ status: 404 });
  });

  it('omits deleted students from a classroom roster', async () => {
    repositories.Classroom.findOne.mockResolvedValue(room);
    repositories.ClassroomStudent.find.mockResolvedValue([{ studentId: 1 }, { studentId: 2 }]);
    repositories.Student.findOne.mockResolvedValueOnce(student).mockResolvedValueOnce(null);
    expect((await service.classroomStudents(3)).map(x => x.id)).toEqual([1]);
  });

  it('maps a database student-code race to 409', async () => {
    repositories.Prefix.findOne.mockResolvedValue({ id: 1, isActive: true });
    repositories.Gender.findOne.mockResolvedValue({ id: 1, isActive: true });
    repositories.GradeLevel.findOne.mockResolvedValue({ id: 2 });
    repositories.Student.save.mockRejectedValue({ code: 'ER_DUP_ENTRY' });
    await expect(service.createStudent({ studentCode: 'S9', prefixId: 1, firstName: 'A', lastName: 'B', genderId: 1, birthDate: '2015-01-01', gradeLevelId: 2 })).rejects.toBeInstanceOf(ConflictException);
  });

  it('soft deletes a student and its memberships together', async () => {
    repositories.Student.findOne.mockResolvedValue(student);
    await service.deleteStudent(1);
    expect(dataSource.transaction).toHaveBeenCalled();
    expect(repositories.Student.findOne).toHaveBeenCalledWith(expect.objectContaining({ lock: { mode: 'pessimistic_write' } }));
    expect(repositories.Student.update).toHaveBeenCalledWith(1, expect.objectContaining({ deletedAt: expect.any(Date) }));
    expect(repositories.ClassroomStudent.update).toHaveBeenCalled();
  });

  it('rejects year edits while a classroom has active members', async () => {
    repositories.Classroom.findOne.mockResolvedValue(room);
    repositories.ClassroomStudent.find.mockResolvedValue([{ id: 1 }]);
    await expect(service.updateClassroom(3, { academicYear: 2570 })).rejects.toBeInstanceOf(ConflictException);
    expect(repositories.Classroom.update).not.toHaveBeenCalled();
  });

  it('rejects grade mismatch when assigning a student', async () => {
    repositories.Student.findOne.mockResolvedValue({ ...student, gradeLevelId: 1 });
    repositories.Classroom.findOne.mockResolvedValue(room);
    await expect(service.addStudent(3, { studentId: 1 })).rejects.toBeInstanceOf(ConflictException);
    expect(repositories.ClassroomStudent.save).not.toHaveBeenCalled();
  });

  it('returns metadata and classroom search using the documented shapes', async () => {
    repositories.Prefix.find.mockResolvedValue([{ id: 1, name: 'Mr', isActive: true }]);
    repositories.Gender.find.mockResolvedValue([{ id: 1, code: 'M', name: 'Male', isActive: true }]);
    repositories.GradeLevel.find.mockResolvedValue([{ id: 2, code: 'P2', name: 'P2', fullName: 'Primary 2' }]);
    repositories.Teacher.find.mockResolvedValue([{ id: 9, firstName: 'Kim', lastName: 'Lee', prefixId: 1 }]);
    expect(await service.metadata()).toMatchObject({ teachers: [{ id: 9, prefixName: 'Mr' }] });
    repositories.Classroom.find.mockResolvedValue([room, { ...room, id: 4, roomNo: '4', roomName: 'Other', homeroomTeacherId: 9 }]);
    repositories.GradeLevel.findOne.mockResolvedValue({ id: 2, name: 'P2' });
    repositories.Teacher.findOne.mockResolvedValue({ firstName: 'Kim', lastName: 'Lee' });
    expect((await service.classrooms({ roomNo: '4', teacherName: 'kim' })).map(x => x.id)).toEqual([4]);
  });
});
