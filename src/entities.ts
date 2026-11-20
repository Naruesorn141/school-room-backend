import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('students')
export class Student {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ name: 'student_code' }) studentCode!: string;
  @Column({ name: 'prefix_id' }) prefixId!: number;
  @Column({ name: 'first_name' }) firstName!: string;
  @Column({ name: 'last_name' }) lastName!: string;
  @Column({ name: 'gender_id' }) genderId!: number;
  @Column({ name: 'birth_date', type: 'date' }) birthDate!: string;
  @Column({ name: 'grade_level_id' }) gradeLevelId!: number;
  @Column({ name: 'deleted_at', type: 'datetime', nullable: true }) deletedAt!: Date | null;
}

@Entity('classrooms')
export class Classroom {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ name: 'room_no' }) roomNo!: string;
  @Column({ name: 'room_name' }) roomName!: string;
  @Column({ name: 'academic_year' }) academicYear!: number;
  @Column({ name: 'grade_level_id' }) gradeLevelId!: number;
  @Column({ name: 'homeroom_teacher_id', type: 'int', nullable: true }) homeroomTeacherId!: number | null;
  @Column({ name: 'deleted_at', type: 'datetime', nullable: true }) deletedAt!: Date | null;
}

@Entity('classroom_students')
export class ClassroomStudent {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ name: 'classroom_id' }) classroomId!: number;
  @Column({ name: 'student_id' }) studentId!: number;
  @Column({ name: 'academic_year' }) academicYear!: number;
  @Column({ name: 'added_at', type: 'datetime' }) addedAt!: Date;
  @Column({ name: 'deleted_at', type: 'datetime', nullable: true }) deletedAt!: Date | null;
}

@Entity('master_prefix')
export class Prefix {
  @PrimaryGeneratedColumn() id!: number;
  @Column() name!: string;
  @Column({ name: 'is_active' }) isActive!: boolean;
}

@Entity('master_gender')
export class Gender {
  @PrimaryGeneratedColumn() id!: number;
  @Column() code!: string;
  @Column() name!: string;
  @Column({ name: 'is_active' }) isActive!: boolean;
}

@Entity('grade_levels')
export class GradeLevel {
  @PrimaryGeneratedColumn() id!: number;
  @Column() code!: string;
  @Column() name!: string;
  @Column({ name: 'full_name' }) fullName!: string;
}

@Entity('teachers')
export class Teacher {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ name: 'first_name' }) firstName!: string;
  @Column({ name: 'last_name' }) lastName!: string;
  @Column({ name: 'prefix_id' }) prefixId!: number;
  @Column({ name: 'deleted_at', type: 'datetime', nullable: true }) deletedAt!: Date | null;
}
