const sgMail = require('@sendgrid/mail');

function getMailFrom() {
    return process.env.SENDGRID_FROM_EMAIL || process.env.MAIL_FROM || 'nguyenhoanglan5000@gmail.com';
}

function ensureMailConfig() {
    if (!process.env.SENDGRID_API_KEY) {
        throw new Error('SendGrid chua duoc cau hinh. Hay set SENDGRID_API_KEY');
    }
    if (!getMailFrom()) {
        throw new Error('SendGrid chua co email gui. Hay set SENDGRID_FROM_EMAIL');
    }
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

async function sendMessage(message) {
    ensureMailConfig();
    const [response] = await sgMail.send(message);
    const messageId = response.headers['x-message-id'] || response.headers['X-Message-Id'] || null;
    const info = {
        statusCode: response.statusCode,
        messageId: messageId
    };
    console.log('Message sent:', info.messageId || info.statusCode);
    return info;
}

module.exports = {
    verifyMailTransport: async () => {
        ensureMailConfig();
        return true;
    },
    sendMail: async (to, url) => {
        return await sendMessage({
            to: to,
            from: getMailFrom(),
            subject: 'RESET PASSWORD REQUEST',
            text: `Click vao link sau de doi mat khau: ${url}`,
            html: `Click vao <a href="${url}">day</a> de doi mat khau`,
        });
    },
    sendInitialPasswordMail: async (to, username, password) => {
        return await sendMessage({
            to: to,
            from: getMailFrom(),
            subject: 'THONG TIN TAI KHOAN MOI',
            text: `Tai khoan cua ban da duoc tao.\nUsername: ${username}\nPassword: ${password}`,
            html: `
                <p>Tai khoan cua ban da duoc tao.</p>
                <p>Username: <strong>${username}</strong></p>
                <p>Password tam thoi: <strong>${password}</strong></p>
                <p>Hay dang nhap va doi mat khau sau khi nhan duoc email nay.</p>
            `,
        });
    }
}
