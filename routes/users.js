var express = require("express");
var router = express.Router();
let exceljs = require('exceljs');
let path = require('path');
let crypto = require('crypto');
let mongoose = require('mongoose');
let { validatedResult, CreateAnUserValidator, ModifyAnUserValidator } = require('../utils/validator');
let { uploadExcel } = require('../utils/uploadHandler');
let { CheckLogin, CheckRole } = require('../utils/authHandler');
let { sendInitialPasswordMail, verifyMailTransport } = require('../utils/mailHandler');
let { getOrCreateRoleByName } = require('../utils/roleHandler');
let userModel = require("../schemas/users");
let cartModel = require('../schemas/carts');
let userController = require('../controllers/users');

function normalizeCellValue(value) {
    if (value === null || value === undefined) {
        return '';
    }
    if (typeof value === 'object') {
        if (Array.isArray(value.richText)) {
            return value.richText.map(function (item) {
                return item.text || '';
            }).join('').trim();
        }
        if (value.text) {
            return String(value.text).trim();
        }
        if (value.result !== undefined && value.result !== null) {
            return String(value.result).trim();
        }
        if (value.hyperlink) {
            return String(value.hyperlink).trim();
        }
    }
    return String(value).trim();
}

function generateRandomPassword(length) {
    let characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let index = 0; index < length; index++) {
        password += characters[crypto.randomInt(0, characters.length)];
    }
    return password;
}

function isValidUsername(username) {
    return /^[a-zA-Z0-9]+$/.test(username);
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function buildHeaderMap(headerRow) {
    let headerMap = new Map();
    headerRow.eachCell(function (cell, columnNumber) {
        let header = normalizeCellValue(cell.value).toLowerCase();
        if (header) {
            headerMap.set(header, columnNumber);
        }
    });
    return headerMap;
}

router.get("/", CheckLogin, CheckRole("ADMIN", "USER"), async function (req, res, next) {
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
    let session = await mongoose.startSession();
    session.startTransaction();
    try {
        let newItem = await userController.CreateAnUser(
            req.body.username,
            req.body.password,
            req.body.email,
            req.body.role,
            session,
            req.body.fullName,
            req.body.avatarUrl,
            req.body.status,
            req.body.loginCount
        );
        let newCart = new cartModel({
            user: newItem._id
        });
        await newCart.save({ session });
        await session.commitTransaction();
        await newItem.populate('role');
        res.send(newItem);
    } catch (err) {
        await session.abortTransaction();
        res.status(400).send({ message: err.message });
    } finally {
        await session.endSession();
    }
});

router.post("/import", uploadExcel.single('file'), async function (req, res, next) {
    let workbook = new exceljs.Workbook();
    let pathFile = req.file ? path.join(__dirname, '../uploads', req.file.filename) : null;

    try {
        if (!req.file) {
            res.status(404).send({
                message: "file khong duoc de trong"
            });
            return;
        }

        await verifyMailTransport();
        await workbook.xlsx.readFile(pathFile);
        let worksheet = workbook.worksheets[0];
        if (!worksheet) {
            res.status(400).send({
                message: "file excel khong co du lieu"
            });
            return;
        }

        let headerMap = buildHeaderMap(worksheet.getRow(1));
        let usernameColumn = headerMap.get('username');
        let emailColumn = headerMap.get('email');
        if (!usernameColumn || !emailColumn) {
            res.status(400).send({
                message: "file excel phai co cot username va email"
            });
            return;
        }

        let userRole = await getOrCreateRoleByName('user');
        let existingUsers = await userModel.find(
            { isDeleted: false },
            { username: 1, email: 1 }
        );
        let usernameSet = new Set(existingUsers.map(function (user) {
            return String(user.username).toLowerCase();
        }));
        let emailSet = new Set(existingUsers.map(function (user) {
            return String(user.email).toLowerCase();
        }));

        let results = [];
        for (let rowIndex = 2; rowIndex <= worksheet.rowCount; rowIndex++) {
            let row = worksheet.getRow(rowIndex);
            let username = normalizeCellValue(row.getCell(usernameColumn).value);
            let email = normalizeCellValue(row.getCell(emailColumn).value).toLowerCase();

            if (!username && !email) {
                results.push({
                    row: rowIndex,
                    status: 'skipped',
                    message: 'dong trong'
                });
                continue;
            }

            let errors = [];
            if (!username) {
                errors.push('username khong duoc de trong');
            } else if (!isValidUsername(username)) {
                errors.push('username chi duoc chua chu va so');
            }

            if (!email) {
                errors.push('email khong duoc de trong');
            } else if (!isValidEmail(email)) {
                errors.push('email sai dinh dang');
            }

            if (usernameSet.has(username.toLowerCase())) {
                errors.push('username da ton tai');
            }
            if (emailSet.has(email)) {
                errors.push('email da ton tai');
            }

            if (errors.length > 0) {
                results.push({
                    row: rowIndex,
                    username: username,
                    email: email,
                    status: 'failed',
                    errors: errors
                });
                continue;
            }

            let password = generateRandomPassword(16);
            let session = await mongoose.startSession();
            session.startTransaction();

            try {
                let newUser = await userController.CreateAnUser(
                    username,
                    password,
                    email,
                    userRole._id,
                    session,
                    '',
                    undefined,
                    false,
                    0
                );
                let newCart = new cartModel({
                    user: newUser._id
                });
                await newCart.save({ session });
                await session.commitTransaction();

                usernameSet.add(username.toLowerCase());
                emailSet.add(email);

                try {
                    let mailInfo = await sendInitialPasswordMail(email, username, password);
                    results.push({
                        row: rowIndex,
                        username: username,
                        email: email,
                        status: 'success',
                        userId: newUser._id,
                        messageId: mailInfo.messageId
                    });
                } catch (mailError) {
                    results.push({
                        row: rowIndex,
                        username: username,
                        email: email,
                        status: 'partial_success',
                        userId: newUser._id,
                        message: `tao user thanh cong nhung gui mail that bai: ${mailError.message}`
                    });
                }
            } catch (error) {
                await session.abortTransaction();
                results.push({
                    row: rowIndex,
                    username: username,
                    email: email,
                    status: 'failed',
                    errors: [error.message]
                });
            } finally {
                await session.endSession();
            }
        }

        let summary = {
            totalRows: Math.max(worksheet.rowCount - 1, 0),
            success: results.filter(function (item) { return item.status === 'success'; }).length,
            partialSuccess: results.filter(function (item) { return item.status === 'partial_success'; }).length,
            failed: results.filter(function (item) { return item.status === 'failed'; }).length,
            skipped: results.filter(function (item) { return item.status === 'skipped'; }).length
        };

        res.send({
            summary: summary,
            results: results
        });
    } catch (error) {
        res.status(400).send({
            message: error.message
        });
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
