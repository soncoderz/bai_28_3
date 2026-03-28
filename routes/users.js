var express = require("express");
var router = express.Router();
let fs = require('fs/promises')
let path = require('path')
let exceljs = require('exceljs')
let { validatedResult, CreateAnUserValidator, ModifyAnUserValidator } = require('../utils/validator')
let userModel = require("../schemas/users");
let roleModel = require("../schemas/roles");
let userController = require('../controllers/users')
let { uploadExcel } = require('../utils/uploadHandler')
let { CheckLogin, CheckRole } = require('../utils/authHandler')
let { sendNewUserPasswordMail } = require('../utils/mailHandler')
let { generateStrongPassword } = require('../utils/passwordHandler')

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidUsername(username) {
  return /^[a-zA-Z0-9]+$/.test(username);
}

router.get("/", CheckLogin,CheckRole("ADMIN", "USER"), async function (req, res, next) {
    let users = await userModel
      .find({ isDeleted: false })
    res.send(users);
  });

router.get("/:id", async function (req, res, next) {
  try {
    let result = await userModel
      .find({ _id: req.params.id, isDeleted: false })
    if (result.length > 0) {
      res.send(result);
    }
    else {
      res.status(404).send({ message: "id not found" });
    }
  } catch (error) {
    res.status(404).send({ message: "id not found" });
  }
});

router.post("/", CreateAnUserValidator, validatedResult, async function (req, res, next) {
  try {
    let newItem = await userController.CreateAnUser(
      req.body.username, req.body.password, req.body.email, req.body.role,
      req.body.fullName, req.body.avatarUrl, req.body.status, req.body.loginCount)
    res.send(newItem);
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

router.post("/import", uploadExcel.single('file'), async function (req, res, next) {
  if (!req.file) {
    return res.status(400).send({
      message: "file khong duoc de trong"
    })
  }

  let pathFile = path.join(__dirname, '../uploads', req.file.filename)
  let workbook = new exceljs.Workbook();

  try {
    await workbook.xlsx.readFile(pathFile)
    let worksheet = workbook.worksheets[0];

    if (!worksheet || worksheet.rowCount < 2) {
      return res.status(400).send({
        message: "file excel khong co du lieu"
      })
    }

    let headerRow = worksheet.getRow(1);
    let headerMap = new Map();
    for (let columnIndex = 1; columnIndex <= headerRow.cellCount; columnIndex++) {
      let headerValue = headerRow.getCell(columnIndex).text.trim().toLowerCase();
      if (headerValue) {
        headerMap.set(headerValue, columnIndex)
      }
    }

    if (!headerMap.has('username') || !headerMap.has('email')) {
      return res.status(400).send({
        message: "file phai co cot username va email"
      })
    }

    let userRole = await roleModel.findOne({
      isDeleted: false,
      name: {
        $regex: /^user$/i
      }
    })

    if (!userRole) {
      return res.status(400).send({
        message: "khong tim thay role user"
      })
    }

    let existingUsers = await userModel.find(
      { isDeleted: false },
      { username: 1, email: 1 }
    ).lean();

    let usernameSet = new Set(existingUsers.map(user => String(user.username).toLowerCase()));
    let emailSet = new Set(existingUsers.map(user => String(user.email).toLowerCase()));
    let importedUsernameSet = new Set();
    let importedEmailSet = new Set();
    let results = [];
    let skippedEmptyRows = 0;

    for (let rowIndex = 2; rowIndex <= worksheet.rowCount; rowIndex++) {
      let row = worksheet.getRow(rowIndex);
      let username = row.getCell(headerMap.get('username')).text.trim();
      let email = row.getCell(headerMap.get('email')).text.trim().toLowerCase();

      if (!username && !email) {
        skippedEmptyRows++;
        continue;
      }

      let errors = [];
      let usernameKey = username.toLowerCase();
      let emailKey = email.toLowerCase();

      if (!username) {
        errors.push("username khong duoc de trong")
      } else if (!isValidUsername(username)) {
        errors.push("username khong duoc chua ki tu dac biet")
      }

      if (!email) {
        errors.push("email khong duoc de trong")
      } else if (!isValidEmail(email)) {
        errors.push("email sai dinh dang")
      }

      if (username && importedUsernameSet.has(usernameKey)) {
        errors.push("username bi trung trong file")
      }
      if (email && importedEmailSet.has(emailKey)) {
        errors.push("email bi trung trong file")
      }
      if (username && usernameSet.has(usernameKey)) {
        errors.push("username da ton tai")
      }
      if (email && emailSet.has(emailKey)) {
        errors.push("email da ton tai")
      }

      if (errors.length > 0) {
        results.push({
          row: rowIndex,
          username: username,
          email: email,
          status: "failed",
          errors: errors
        })
        continue;
      }

      let generatedPassword = generateStrongPassword(16);
      let newUser = null;

      try {
        newUser = await userController.CreateAnUser(
          username,
          generatedPassword,
          email,
          userRole._id
        )
        await sendNewUserPasswordMail(email, username, generatedPassword)

        usernameSet.add(usernameKey)
        emailSet.add(emailKey)
        importedUsernameSet.add(usernameKey)
        importedEmailSet.add(emailKey)

        results.push({
          row: rowIndex,
          username: username,
          email: email,
          status: "created"
        })
      } catch (error) {
        if (newUser) {
          await userModel.deleteOne({ _id: newUser._id })
        }

        results.push({
          row: rowIndex,
          username: username,
          email: email,
          status: "failed",
          errors: [error.message]
        })
      }
    }

    let createdCount = results.filter(item => item.status === 'created').length;
    let failedCount = results.length - createdCount;

    res.send({
      message: "import user hoan tat",
      summary: {
        totalRows: Math.max(worksheet.rowCount - 1, 0),
        skippedEmptyRows: skippedEmptyRows,
        createdCount: createdCount,
        failedCount: failedCount
      },
      results: results
    })
  } catch (error) {
    res.status(400).send({
      message: error.message
    })
  } finally {
    await fs.unlink(pathFile).catch(() => null)
  }
});

router.put("/:id", ModifyAnUserValidator, validatedResult, async function (req, res, next) {
  try {
    let id = req.params.id;
    let updatedItem = await userModel.findByIdAndUpdate(id, req.body, { new: true });

    if (!updatedItem) return res.status(404).send({ message: "id not found" });

    let populated = await userModel
      .findById(updatedItem._id)
    res.send(populated);
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

router.delete("/:id", async function (req, res, next) {
  try {
    let id = req.params.id;
    let updatedItem = await userModel.findByIdAndUpdate(
      id,
      { isDeleted: true },
      { new: true }
    );
    if (!updatedItem) {
      return res.status(404).send({ message: "id not found" });
    }
    res.send(updatedItem);
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

module.exports = router;
