const nodemailer = require("nodemailer");

const pug = require('pug');
const path = require("path");

const static_folder_path = path.join(__dirname, "../static");

const transporter = nodemailer.createTransport({
    host: "smtp-relay.brevo.com",
    port: 587,
    secure: false,
    auth: {
        user: process.env.SMTP_USERNAME,
        pass: process.env.SMTP_PASSWORD,
    },
    from: "chitchat@linkup.work.gd",
});

const OTP_Mailer = async (email, otp) => {
    const mailOptions = {
        from: "LinkUp <chitchat@linkup.work.gd>",
        to: email,
        replyTo: 'chitchat@linkup.work.gd',
        subject: 'One Time Password',
        text: `Your OTP is ${otp}`,
        attachments: [
            {
                filename: 'LinkUpIconWithText.png',
                path: `${static_folder_path}/images/LinkUpIconWithText.png`,
                cid: 'linkupiconwithtext'
            }
        ],
        html: pug.renderFile(`${static_folder_path}/otp_email_template.pug`, { OTP_CODE: otp })
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent: ', info.response);
        return true;
    } catch (error) {
        console.error('There was an error: ', error);
        return false;
    }
}

module.exports = OTP_Mailer