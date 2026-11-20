# School Room Backend

REST API สำหรับจัดการนักเรียน ห้องเรียน และรายชื่อนักเรียนในห้อง
พัฒนาด้วย NestJS 11, TypeORM และ MySQL โดยแยกเป็น repository ฝั่ง Back-end

## ความสามารถ

- เพิ่ม แก้ไข ลบแบบซ่อน ค้นหา และดูข้อมูลนักเรียน
- เพิ่ม แก้ไข ลบแบบซ่อน ค้นหา และดูข้อมูลห้องเรียน
- เพิ่มหรือเอานักเรียนออกจากห้อง และดูรายชื่อสมาชิกห้อง
- จำกัดให้นักเรียนมีห้องที่ใช้งานได้หนึ่งห้องต่อหนึ่งปีการศึกษา
- เมื่อต้องย้ายห้องในปีเดียวกัน API แจ้งห้องเดิมและรอการยืนยันจาก Front-end
- ตรวจว่าระดับชั้นของนักเรียนตรงกับห้องก่อนเพิ่มเข้าห้อง

## สิ่งที่ต้องมี

- Node.js 22.23.2 และ npm 10.9.8 เป็นเวอร์ชันที่ใช้ตรวจโปรเจกต์นี้
- MySQL ที่มีตารางตามโจทย์อยู่แล้ว ได้แก่ `students`, `classrooms`, `classroom_students`,
  `teachers`, `grade_levels`, `master_prefix` และ `master_gender`
- Front-end เป็นอีก repository หนึ่ง ใช้งานผ่าน `http://localhost:5173` เมื่อรันแบบ local

TypeORM ตั้ง `synchronize: false` จึงไม่สร้างหรือแก้ตารางให้เอง
สามารถใช้ DBeaver เปิดดูข้อมูลใน MySQL ได้ แต่ DBeaver ไม่ได้ทำหน้าที่แทน MySQL server

## ติดตั้งและเริ่มใช้งาน

รันคำสั่งจากโฟลเดอร์ของ repository นี้:

```bash
npm ci
cp .env.example .env
npm run start:dev
```

ก่อนเริ่ม server ให้แก้ `.env` ตามข้อมูลการเชื่อมต่อ MySQL ที่ได้รับ:

```dotenv
DB_HOST=localhost
DB_PORT=3306
DB_USER=your_mysql_user
DB_PASSWORD=your_mysql_password
DB_NAME=your_db_name
```

API จะเปิดที่ `http://localhost:3000` และอนุญาต CORS จาก `http://localhost:5173`
เก็บ `.env` ไว้ในเครื่องและอย่านำรหัสผ่านจริงขึ้น Git

## API หลัก

ส่งและรับข้อมูลเป็น JSON วันที่เกิดใช้รูปแบบ `YYYY-MM-DD`
รายการค้นหาจะไม่แสดงข้อมูลที่ถูกลบแบบซ่อน

| Method | Path | การทำงาน |
| --- | --- | --- |
| GET | `/metadata` | ข้อมูลคำนำหน้า เพศ ระดับชั้น และครูสำหรับฟอร์ม |
| GET, POST | `/students` | ค้นหารายการหรือเพิ่มนักเรียน |
| GET, PATCH, DELETE | `/students/:id` | ดู แก้ไข หรือลบแบบซ่อนนักเรียน |
| GET, POST | `/classrooms` | ค้นหารายการหรือเพิ่มห้องเรียน |
| GET, PATCH, DELETE | `/classrooms/:id` | ดู แก้ไข หรือลบแบบซ่อนห้องเรียน |
| GET, POST | `/classrooms/:id/students` | ดูสมาชิกหรือเพิ่มนักเรียนเข้าห้อง |
| DELETE | `/classrooms/:id/students/:studentId` | เอานักเรียนออกจากห้อง |

ค้นหานักเรียนด้วย `studentCode`, `name`, `gradeLevelId`
และค้นหาห้องเรียนด้วย `roomNo`, `roomName`, `teacherName`
ฟิลด์ที่ใช้เพิ่มนักเรียนคือ `studentCode`, `prefixId`, `firstName`, `lastName`,
`genderId`, `birthDate`, `gradeLevelId`
ฟิลด์ที่ใช้เพิ่มห้องคือ `roomNo`, `roomName`, `academicYear`, `gradeLevelId`,
`homeroomTeacherId` โดยฟิลด์ครูประจำชั้นเป็น `null` ได้
การแก้ไขด้วย PATCH ส่งเฉพาะฟิลด์ที่ต้องการเปลี่ยนได้

### ตัวอย่างการย้ายห้อง

ส่ง `POST /classrooms/:id/students` พร้อม body:

```json
{ "studentId": 1 }
```

หากนักเรียนอยู่ห้องอื่นในปีเดียวกัน API ตอบ `409` พร้อม
`code: "STUDENT_IN_OTHER_CLASSROOM"` และ `currentClassroom`
หลังผู้ใช้ยืนยัน Front-end จึงส่งคำขออีกครั้ง:

```json
{ "studentId": 1, "confirmTransfer": true }
```

การย้ายใช้ transaction การลบนักเรียนหรือห้องจะยุติสมาชิกห้องที่ยังใช้งานอยู่ด้วย
ข้อมูลไม่ถูกลบออกจากตารางจริง

รหัสตอบกลับหลัก: `400` ข้อมูลหรือ ID ไม่ถูกต้อง, `404` ไม่พบรายการ,
`409` ข้อมูลขัดกัน และ `204` เมื่อ DELETE สำเร็จ

## โครงสร้างสำคัญ

- `src/main.ts` เปิด NestJS ที่ port 3000 และกำหนด CORS
- `src/app.module.ts` ตั้งค่าการเชื่อมต่อ MySQL และประกอบ Controller กับ Service
- `src/entities.ts` แมปตาราง MySQL เดิมเป็น TypeORM entities
- `src/roster.controller.ts` กำหนดเส้นทาง HTTP
- `src/roster.service.ts` ตรวจข้อมูล จัดการกติกา และทำ transaction
- `src/roster.spec.ts` ทดสอบกติกาของ Service
- `test/app.e2e-spec.ts` ทดสอบ HTTP routes โดยจำลอง Service

## ทดสอบและ build

```bash
npm test -- --runInBand
npm run test:e2e -- --runInBand
npm run build
```

Unit test ใช้ Jest กับ repository จำลอง ส่วน HTTP test ใช้ Jest, Supertest และ Service จำลอง
คำสั่ง test ทั้งสองชุดไม่เขียนข้อมูลลง MySQL จริง

ไฟล์ `Report.sql` เป็นงานส่งแยกจากแอป จึงไม่มีหน้ารายงานหรือ report endpoint ใน API นี้
