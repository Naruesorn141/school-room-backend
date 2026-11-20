import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Classroom, ClassroomStudent, Gender, GradeLevel, Prefix, Student, Teacher } from './entities';
import { RosterController } from './roster.controller';
import { RosterService } from './roster.service';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), TypeOrmModule.forRootAsync({ inject: [ConfigService], useFactory: (config: ConfigService) => ({ type: 'mysql', host: config.get<string>('DB_HOST') || 'localhost', port: Number(config.get('DB_PORT') || 3306), username: config.get<string>('DB_USER'), password: config.get<string>('DB_PASSWORD'), database: config.get<string>('DB_NAME'), entities: [Student, Classroom, ClassroomStudent, Prefix, Gender, GradeLevel, Teacher], synchronize: false }) })],
  controllers: [RosterController],
  providers: [RosterService],
})
export class AppModule {}
