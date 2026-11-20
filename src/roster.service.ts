import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, IsNull, ObjectLiteral, Repository } from 'typeorm';
import {
  Classroom,
  ClassroomStudent,
  Gender,
  GradeLevel,
  Prefix,
  Student,
  Teacher,
} from './entities';

type Input = Record<string, unknown>;
const id = (value: unknown, field = 'id'): number => {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n <= 0)
    throw new BadRequestException(`${field} must be a positive integer`);
  return n;
};
const text = (value: unknown, field: string, max = 100): string => {
  if (typeof value !== 'string' || !value.trim())
    throw new BadRequestException(`${field} is required`);
  if (value.trim().length > max)
    throw new BadRequestException(`${field} exceeds ${max} characters`);
  return value.trim();
};
const date = (value: unknown): string => {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    Number.isNaN(Date.parse(`${value}T00:00:00Z`)) ||
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value
  )
    throw new BadRequestException('birthDate must be YYYY-MM-DD');
  return value;
};
const allowed = (input: Input, keys: string[]) => {
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    Object.keys(input).some((k) => !keys.includes(k))
  )
    throw new BadRequestException('Invalid request body');
};
const mapDuplicate = (error: unknown): never => {
  if (
    (error as any)?.code === 'ER_DUP_ENTRY' ||
    (error as any)?.driverError?.code === 'ER_DUP_ENTRY'
  )
    throw new ConflictException('Student code already exists');
  throw error;
};

@Injectable()
export class RosterService {
  constructor(private readonly db: DataSource) {}
  private repo<T extends ObjectLiteral>(entity: new () => T): Repository<T> {
    return this.db.getRepository(entity);
  }
  private async active<T extends ObjectLiteral>(
    entity: new () => T,
    recordId: number,
    manager?: any,
    lock = false,
  ): Promise<T> {
    const value = await (manager ? manager.getRepository(entity) : this.repo(entity)).findOne({
      where: { id: recordId, deletedAt: IsNull() },
      ...(lock ? { lock: { mode: 'pessimistic_write' } } : {}),
    });
    if (!value) throw new NotFoundException(`${entity.name} not found`);
    return value;
  }
  private async reference<T extends ObjectLiteral>(
    entity: new () => T,
    recordId: number,
    activeOnly = false,
  ): Promise<T> {
    const value = await this.repo(entity).findOne({
      where: { id: recordId, ...(entity.name === 'Teacher' ? { deletedAt: IsNull() } : {}) } as any,
    });
    if (!value || (activeOnly && !(value as any).isActive))
      throw new BadRequestException(`${entity.name} is invalid or inactive`);
    return value;
  }
  async metadata() {
    const [prefixes, genders, gradeLevels, teachers] = await Promise.all([
      this.repo(Prefix).find({ where: { isActive: true } }),
      this.repo(Gender).find({ where: { isActive: true } }),
      this.repo(GradeLevel).find(),
      this.repo(Teacher).find({ where: { deletedAt: IsNull() } }),
    ]);
    const prefix = new Map(prefixes.map((x) => [x.id, x.name]));
    return {
      prefixes: prefixes.map((x) => ({ id: x.id, name: x.name })),
      genders: genders.map((x) => ({ id: x.id, code: x.code, name: x.name })),
      gradeLevels: gradeLevels.map((x) => ({
        id: x.id,
        code: x.code,
        name: x.name,
        fullName: x.fullName,
      })),
      teachers: teachers.map((x) => ({
        id: x.id,
        firstName: x.firstName,
        lastName: x.lastName,
        prefixName: prefix.get(x.prefixId) ?? null,
      })),
    };
  }
  private async studentShape(s: Student) {
    const [p, g, level] = await Promise.all([
      this.repo(Prefix).findOne({ where: { id: s.prefixId } }),
      this.repo(Gender).findOne({ where: { id: s.genderId } }),
      this.repo(GradeLevel).findOne({ where: { id: s.gradeLevelId } }),
    ]);
    return {
      id: s.id,
      studentCode: s.studentCode,
      prefixId: s.prefixId,
      prefixName: p?.name ?? null,
      firstName: s.firstName,
      lastName: s.lastName,
      genderId: s.genderId,
      genderName: g?.name ?? null,
      birthDate: s.birthDate,
      gradeLevelId: s.gradeLevelId,
      gradeLevelName: level?.name ?? null,
    };
  }
  private async roomShape(c: Classroom) {
    const [level, teacher] = await Promise.all([
      this.repo(GradeLevel).findOne({ where: { id: c.gradeLevelId } }),
      c.homeroomTeacherId
        ? this.repo(Teacher).findOne({ where: { id: c.homeroomTeacherId } })
        : null,
    ]);
    return {
      id: c.id,
      roomNo: c.roomNo,
      roomName: c.roomName,
      academicYear: c.academicYear,
      gradeLevelId: c.gradeLevelId,
      gradeLevelName: level?.name ?? null,
      homeroomTeacherId: c.homeroomTeacherId,
      homeroomTeacherName: teacher ? `${teacher.firstName} ${teacher.lastName}` : null,
    };
  }
  async students(query: Input = {}) {
    const list = await this.repo(Student).find({ where: { deletedAt: IsNull() } });
    if (query.gradeLevelId !== undefined)
      query.gradeLevelId = id(query.gradeLevelId, 'gradeLevelId');
    return Promise.all(
      list
        .filter(
          (s) =>
            (!query.studentCode ||
              s.studentCode.toLowerCase().includes(String(query.studentCode).toLowerCase())) &&
            (!query.name ||
              `${s.firstName} ${s.lastName}`
                .toLowerCase()
                .includes(String(query.name).toLowerCase())) &&
            (!query.gradeLevelId || s.gradeLevelId === query.gradeLevelId),
        )
        .map((s) => this.studentShape(s)),
    );
  }
  async student(recordId: number) {
    return this.studentShape(await this.active(Student, id(recordId)));
  }
  private async studentFields(input: Input, create: boolean) {
    const keys = [
      'studentCode',
      'prefixId',
      'firstName',
      'lastName',
      'genderId',
      'birthDate',
      'gradeLevelId',
    ];
    allowed(input, keys);
    const out: any = {};
    for (const key of keys)
      if (create || key in input) {
        if (['studentCode', 'firstName', 'lastName'].includes(key))
          out[key] = text(input[key], key, key === 'studentCode' ? 20 : 100);
        else if (key === 'birthDate') out[key] = date(input[key]);
        else out[key] = id(input[key], key);
      }
    if (out.prefixId) await this.reference(Prefix, out.prefixId, true);
    if (out.genderId) await this.reference(Gender, out.genderId, true);
    if (out.gradeLevelId) await this.reference(GradeLevel, out.gradeLevelId);
    return out;
  }
  private async uniqueCode(code: string, except?: number) {
    const existing = await this.repo(Student).findOne({ where: { studentCode: code } });
    if (existing && existing.id !== except)
      throw new ConflictException('Student code already exists');
  }
  async createStudent(input: Input) {
    const fields = await this.studentFields(input, true);
    await this.uniqueCode(fields.studentCode);
    let saved: Student;
    try {
      saved = await this.repo(Student).save({ ...fields, deletedAt: null } as Student);
    } catch (error) {
      return mapDuplicate(error);
    }
    return this.studentShape(saved);
  }
  async updateStudent(recordId: number, input: Input) {
    const fields = await this.studentFields(input, false);
    const targetId = id(recordId);
    await this.db.transaction(async (manager) => {
      const current = await this.active(Student, targetId, manager, true);
      if (fields.studentCode) await this.uniqueCode(fields.studentCode, current.id);
      if (fields.gradeLevelId && fields.gradeLevelId !== current.gradeLevelId) {
        const memberships = await manager
          .getRepository(ClassroomStudent)
          .find({ where: { studentId: current.id, deletedAt: IsNull() } });
        for (const m of memberships) {
          const room = await this.active(Classroom, m.classroomId, manager);
          if (room.gradeLevelId !== fields.gradeLevelId)
            throw new ConflictException('Grade level conflicts with active classroom');
        }
      }
      try {
        await manager.getRepository(Student).update(current.id, fields);
      } catch (error) {
        mapDuplicate(error);
      }
    });
    return this.student(targetId);
  }
  async deleteStudent(recordId: number) {
    await this.db.transaction(async (manager) => {
      const s = await this.active(Student, id(recordId), manager, true);
      const now = new Date();
      await manager
        .getRepository(ClassroomStudent)
        .update({ studentId: s.id, deletedAt: IsNull() }, { deletedAt: now });
      await manager.getRepository(Student).update(s.id, { deletedAt: now });
    });
  }
  async classrooms(query: Input = {}) {
    const list = await this.repo(Classroom).find({ where: { deletedAt: IsNull() } });
    const filtered: Awaited<ReturnType<RosterService['roomShape']>>[] = [];
    for (const c of list) {
      const shape = await this.roomShape(c);
      if (
        (!query.roomNo || c.roomNo.toLowerCase().includes(String(query.roomNo).toLowerCase())) &&
        (!query.roomName ||
          c.roomName.toLowerCase().includes(String(query.roomName).toLowerCase())) &&
        (!query.teacherName ||
          (shape.homeroomTeacherName ?? '')
            .toLowerCase()
            .includes(String(query.teacherName).toLowerCase()))
      )
        filtered.push(shape);
    }
    return filtered;
  }
  async classroom(recordId: number) {
    return this.roomShape(await this.active(Classroom, id(recordId)));
  }
  private async roomFields(input: Input, create: boolean) {
    const keys = ['roomNo', 'roomName', 'academicYear', 'gradeLevelId', 'homeroomTeacherId'];
    allowed(input, keys);
    const out: any = {};
    for (const key of keys)
      if (create || key in input) {
        if (key === 'roomNo' || key === 'roomName')
          out[key] = text(input[key], key, key === 'roomNo' ? 20 : 100);
        else if (key === 'homeroomTeacherId' && (input[key] === null || input[key] === undefined))
          out[key] = null;
        else {
          out[key] = id(input[key], key);
          if (key === 'academicYear' && out[key] > 65535)
            throw new BadRequestException('academicYear exceeds supported range');
        }
      }
    if (out.gradeLevelId) await this.reference(GradeLevel, out.gradeLevelId);
    if (out.homeroomTeacherId) await this.reference(Teacher, out.homeroomTeacherId);
    return out;
  }
  async createClassroom(input: Input) {
    const fields = await this.roomFields(input, true);
    const saved = await this.repo(Classroom).save({ ...fields, deletedAt: null });
    return this.roomShape(saved as Classroom);
  }
  async updateClassroom(recordId: number, input: Input) {
    const fields = await this.roomFields(input, false);
    const targetId = id(recordId);
    await this.db.transaction(async (manager) => {
      const current = await this.active(Classroom, targetId, manager, true);
      if (
        (fields.academicYear && fields.academicYear !== current.academicYear) ||
        (fields.gradeLevelId && fields.gradeLevelId !== current.gradeLevelId)
      ) {
        const members = await manager
          .getRepository(ClassroomStudent)
          .find({ where: { classroomId: current.id, deletedAt: IsNull() } });
        if (members.length)
          throw new ConflictException('Active memberships prevent year or grade change');
      }
      await manager.getRepository(Classroom).update(current.id, fields);
    });
    return this.classroom(targetId);
  }
  async deleteClassroom(recordId: number) {
    await this.db.transaction(async (manager) => {
      const c = await this.active(Classroom, id(recordId), manager, true);
      const now = new Date();
      await manager
        .getRepository(ClassroomStudent)
        .update({ classroomId: c.id, deletedAt: IsNull() }, { deletedAt: now });
      await manager.getRepository(Classroom).update(c.id, { deletedAt: now });
    });
  }
  async classroomStudents(recordId: number) {
    const c = await this.active(Classroom, id(recordId));
    const members = await this.repo(ClassroomStudent).find({
      where: { classroomId: c.id, deletedAt: IsNull() },
    });
    const students = await Promise.all(
      members.map((m) =>
        this.repo(Student).findOne({ where: { id: m.studentId, deletedAt: IsNull() } }),
      ),
    );
    return Promise.all(students.filter((s): s is Student => !!s).map((s) => this.studentShape(s)));
  }
  async addStudent(recordId: number, input: Input) {
    allowed(input, ['studentId', 'confirmTransfer']);
    const studentId = id(input.studentId, 'studentId');
    if (input.confirmTransfer !== undefined && typeof input.confirmTransfer !== 'boolean')
      throw new BadRequestException('confirmTransfer must be boolean');
    return this.db.transaction(async (manager) => {
      const students = manager.getRepository(Student);
      const s = await students.findOne({
        where: { id: studentId, deletedAt: IsNull() },
        lock: { mode: 'pessimistic_write' },
      });
      if (!s) throw new BadRequestException('Student reference is invalid or deleted');
      const c = await this.active(Classroom, id(recordId), manager, true);
      if (s.gradeLevelId !== c.gradeLevelId)
        throw new ConflictException('Grade level does not match classroom');
      const members = manager.getRepository(ClassroomStudent);
      const existing = await members.find({
        where: { studentId, academicYear: c.academicYear, deletedAt: IsNull() },
      });
      if (existing.some((m: ClassroomStudent) => m.classroomId === c.id))
        throw new ConflictException('Student already in classroom');
      if (existing.length && !input.confirmTransfer) {
        const previous = await this.active(Classroom, existing[0].classroomId, manager);
        throw new ConflictException({
          code: 'STUDENT_IN_OTHER_CLASSROOM',
          currentClassroom: {
            id: previous.id,
            roomNo: previous.roomNo,
            roomName: previous.roomName,
          },
        });
      }
      for (const m of existing) await members.update(m.id, { deletedAt: new Date() });
      await members.save({
        classroomId: c.id,
        studentId,
        academicYear: c.academicYear,
        addedAt: new Date(),
        deletedAt: null,
      });
      return { classroomId: c.id, studentId, academicYear: c.academicYear };
    });
  }
  async removeStudent(recordId: number, studentId: number) {
    const c = await this.active(Classroom, id(recordId));
    const s = await this.active(Student, id(studentId));
    const member = await this.repo(ClassroomStudent).findOne({
      where: { classroomId: c.id, studentId: s.id, deletedAt: IsNull() },
    });
    if (!member) throw new NotFoundException('Membership not found');
    await this.repo(ClassroomStudent).update(member.id, { deletedAt: new Date() });
  }
}
