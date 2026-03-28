const nodemailer = require("nodemailer");

const SMTP_FROM = process.env.SMTP_FROM || "admin@haha.com";

var transport = nodemailer.createTransport({
    host: "sandbox.smtp.mailtrap.io",
    port: 2525,
    auth: {
        user: "528f06570540c3",
        pass: "585ed7da4a3586",
    },
});

async function deliverMail(mailOptions) {
    const info = await transport.sendMail({
        from: SMTP_FROM,
        ...mailOptions
    });

    console.log("Message sent:", info.messageId);
    return info;
}

module.exports = {
    sendMail: async (to, url) => {
        return await deliverMail({
            to: to,
            subject: "RESET PASSWORD REQUEST",
            text: "click vao day de doi pass",
            html: `click vao <a href="${url}">day</a> de doi pass`,
        });
    },
    sendNewUserPasswordMail: async (to, username, password) => {
        return await deliverMail({
            to: to,
            subject: "THONG TIN TAI KHOAN MOI",
            text: `Tai khoan ${username} da duoc tao. Mat khau tam thoi: ${password}`,
            html: `Tai khoan <b>${username}</b> da duoc tao.<br/>Mat khau tam thoi: <b>${password}</b><br/>Hay dang nhap va doi mat khau sau khi nhan duoc email.`,
        });
    }
}
