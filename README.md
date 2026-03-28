# bai_28_3

API import user tu file Excel.

## Chay du an

```bash
npm install
npm start
```

## Cau hinh can thiet

Set cac bien moi truong truoc khi chay:

```bash
MONGODB_URI=mongodb://localhost:27017/NNPTUD-C4
MAILTRAP_USER=your_mailtrap_username
MAILTRAP_PASS=your_mailtrap_password
MAIL_FROM=admin@haha.com
```

Co the set tren PowerShell:

```powershell
$env:MONGODB_URI="mongodb://localhost:27017/NNPTUD-C4"
$env:MAILTRAP_USER="your_mailtrap_username"
$env:MAILTRAP_PASS="your_mailtrap_password"
$env:MAIL_FROM="admin@haha.com"
npm start
```

## Import user

Endpoint:

```text
POST /api/v1/users/import
```

Form-data:

```text
file: user.xlsx
```

Yeu cau file Excel:

- cot `username`
- cot `email`

Ket qua import:

- role mac dinh `user`
- password duoc random 16 ky tu
- tao cart cho moi user moi
- gui email password qua Mailtrap/SMTP
