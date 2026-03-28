const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || process.env.MAILTRAP_HOST || "sandbox.smtp.mailtrap.io",
    port: Number(process.env.SMTP_PORT || process.env.MAILTRAP_PORT || 2525),
    secure: false,
    auth: {
        user: process.env.SMTP_USER || process.env.MAILTRAP_USER || "",
        pass: process.env.SMTP_PASS || process.env.MAILTRAP_PASS || "",
    },
});

function getMailFrom() {
    return process.env.MAIL_FROM || "admin@haha.com";
}

function ensureMailConfig() {
    if (!transporter.options.auth.user || !transporter.options.auth.pass) {
        throw new Error("Mailtrap chua duoc cau hinh. Hay set MAILTRAP_USER va MAILTRAP_PASS");
    }
}

module.exports = {
    verifyMailTransport: async () => {
        ensureMailConfig();
        await transporter.verify();
    },
    sendMail: async (to, url) => {
        ensureMailConfig();
        const info = await transporter.sendMail({
            from: getMailFrom(),
            to: to,
            subject: "RESET PASSWORD REQUEST",
            text: `Click vao link sau de doi mat khau: ${url}`,
            html: `Click vao <a href="${url}">day</a> de doi mat khau`,
        });

        console.log("Message sent:", info.messageId);
        return info;
    },
    sendInitialPasswordMail: async (to, username, password) => {
        ensureMailConfig();
        const info = await transporter.sendMail({
            from: getMailFrom(),
            to: to,
            subject: "THONG TIN TAI KHOAN MOI",
            text: `Tai khoan cua ban da duoc tao.\nUsername: ${username}\nPassword: ${password}`,
            html: `
                <p>Tai khoan cua ban da duoc tao.</p>
                <p>Username: <strong>${username}</strong></p>
                <p>Password tam thoi: <strong>${password}</strong></p>
                <p>Hay dang nhap va doi mat khau sau khi nhan duoc email nay.</p>
            `,
        });

        console.log("Message sent:", info.messageId);
        return info;
    }
}
