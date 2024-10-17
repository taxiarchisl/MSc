const nodemailer = require('nodemailer');
const { errorMonitor } = require('nodemailer/lib/xoauth2');
require('dotenv').config();

module.exports = {

    transporter: function () {

        const transporter = nodemailer.createTransport({
            service: process.env.MAIL_SERVICE,
            host: process.env.MAIL_HOST,
            port: process.env.MAIL_PORT,
            secure: process.env.MAIL_SECURE, 
            auth: {
                user: process.env.MAIL_USER,
                pass: process.env.MAIL_PASSWORD,
            },
        });
        return transporter;
    },

    mailOptions: function (bodyHtml, toList) {

        const mailOptions = {
            from: {
                name: 'Voting System',
                address: "taxiarchisl@gmail.com"
            },
            to: toList, // list of receivers
            subject: "Voting 2FA", // Subject line
            html: bodyHtml, // html body
        };

        return mailOptions;
    },

    send: async function (bodyHtml, toList) {

        var transporter = this.transporter();
        var mailOptions = this.mailOptions(bodyHtml, toList);
        try {
            await transporter.sendMail(mailOptions);
            return 'Email has been sent!';
        } catch (err) {
            return err;
        }
    },
}
