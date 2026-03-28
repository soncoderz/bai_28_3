let userModel = require('../schemas/users')

function isMongoSession(value) {
    return value
        && typeof value === 'object'
        && typeof value.startTransaction === 'function'
        && typeof value.endSession === 'function'
}

module.exports = {
    CreateAnUser: async function (username, password, email, role, sessionOrFullName,
        fullNameOrAvatarUrl, avatarUrlOrStatus, statusOrLoginCount, maybeLoginCount) {
        let session = null;
        let fullName = "";
        let avatarUrl;
        let status;
        let loginCount;

        if (isMongoSession(sessionOrFullName)) {
            session = sessionOrFullName;
            fullName = fullNameOrAvatarUrl;
            avatarUrl = avatarUrlOrStatus;
            status = statusOrLoginCount;
            loginCount = maybeLoginCount;
        } else {
            fullName = sessionOrFullName;
            avatarUrl = fullNameOrAvatarUrl;
            status = avatarUrlOrStatus;
            loginCount = statusOrLoginCount;
        }

        let newItem = new userModel({
            username: username,
            password: password,
            email: email,
            fullName: fullName,
            avatarUrl: avatarUrl,
            status: status,
            role: role,
            loginCount: loginCount
        });
        let saveOptions = {};
        if (session) {
            saveOptions.session = session;
        }
        await newItem.save(saveOptions);
        return newItem;
    },
    GetAnUserByUsername: async function (username) {
        return await userModel.findOne({
            isDeleted: false,
            username: username
        })
    }, GetAnUserById: async function (id) {
        return await userModel.findOne({
            isDeleted: false,
            _id: id
        }).populate('role')
    }, GetAnUserByEmail: async function (email) {
        return await userModel.findOne({
            isDeleted: false,
            email: email
        })
    }, GetAnUserByToken: async function (token) {
        let user = await userModel.findOne({
            isDeleted: false,
            forgotPasswordToken: token
        })
        if (user.forgotPasswordTokenExp > Date.now()) {
            return user;
        }
        return false;
    }
}
