import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { RosterService } from './roster.service';

const pathId = (value: string): number => {
  if (!/^[0-9]+$/.test(value))
    throw new BadRequestException('ID must be a positive decimal integer');
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0)
    throw new BadRequestException('ID must be a positive decimal integer');
  return parsed;
};

@Controller()
export class RosterController {
  constructor(private readonly roster: RosterService) {}
  @Get('metadata') metadata() {
    return this.roster.metadata();
  }
  @Get('students') students(@Query() query: Record<string, unknown>) {
    return this.roster.students(query);
  }
  @Get('students/:id') student(@Param('id') id: string) {
    return this.roster.student(pathId(id));
  }
  @Post('students') createStudent(@Body() body: Record<string, unknown>) {
    return this.roster.createStudent(body);
  }
  @Patch('students/:id') updateStudent(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.roster.updateStudent(pathId(id), body);
  }
  @Delete('students/:id') @HttpCode(204) deleteStudent(@Param('id') id: string) {
    return this.roster.deleteStudent(pathId(id));
  }
  @Get('classrooms') classrooms(@Query() query: Record<string, unknown>) {
    return this.roster.classrooms(query);
  }
  @Get('classrooms/:id') classroom(@Param('id') id: string) {
    return this.roster.classroom(pathId(id));
  }
  @Post('classrooms') createClassroom(@Body() body: Record<string, unknown>) {
    return this.roster.createClassroom(body);
  }
  @Patch('classrooms/:id') updateClassroom(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.roster.updateClassroom(pathId(id), body);
  }
  @Delete('classrooms/:id') @HttpCode(204) deleteClassroom(@Param('id') id: string) {
    return this.roster.deleteClassroom(pathId(id));
  }
  @Get('classrooms/:id/students') classroomStudents(@Param('id') id: string) {
    return this.roster.classroomStudents(pathId(id));
  }
  @Post('classrooms/:id/students') addStudent(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.roster.addStudent(pathId(id), body);
  }
  @Delete('classrooms/:id/students/:studentId') @HttpCode(204) removeStudent(
    @Param('id') id: string,
    @Param('studentId') studentId: string,
  ) {
    return this.roster.removeStudent(pathId(id), pathId(studentId));
  }
}
