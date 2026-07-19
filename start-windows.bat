@echo off
echo === Daily Operation Control System ===
if not exist ".env" (
  echo LOI: Chua co file .env
  echo Hay tao file .env trong thu muc nay voi noi dung:
  echo DATABASE_URL="postgresql://user:password@host:5432/dbname"
  echo JWT_SECRET="mot-chuoi-ngau-nhien"
  echo Xem huong dan chi tiet trong DEPLOY.md
  pause
  exit /b 1
)
echo Buoc 1: Cai dat thu vien...
call npm install
echo Buoc 2: Khoi dong ung dung tai http://localhost:3000
call npm run dev
pause
