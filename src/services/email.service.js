require('dotenv').config();
const nodemailer = require('nodemailer');
//transporter communicate to smtp server 
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { //for contect smtp server 
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    },
});

// Verify the connection configuration
transporter.verify((error, success) => {
    if (error) {
        console.error('Error connecting to email server:', error);
    } else {
        console.log('Email server is ready to send messages');
    }
});

// Function to send email
const sendEmail = async (to, subject, text, html) => {
    try {
        const info = await transporter.sendMail({
            from: `"Backedn Ledger" <${process.env.EMAIL_USER}>`, // sender address
            to, // list of receivers
            subject, // Subject line
            text, // plain text body
            html, // html body
        });

        console.log('Message sent: %s', info.messageId);
        console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
    } catch (error) {
        console.error('Error sending email:', error);
    }
};
async function sendRegistrationEmail(userEmail, name) {
    const subject = "Welcome to backend ledger"
    const text = `Heallo ${name}, thank you`
    const html = `<p>Hello ${name} </p>`
    await sendEmail(userEmail, subject, text, html)
}

async function sendTransactionEmail(userEmail, name, amount, toAccount) {
    const subject = "Transaction Successful"
    const text = `Hello ${name} , \n\n Your trasaction of ${amount} to account ${toAccount} is successful   `
    const html = ` <h2>Transaction Success</h2>
    <p>Hello ${name} </p>
    <p>Your transaction of ${amount} to account ${toAccount} is successful </p>`

    await sendEmail(userEmail, subject, text, html)

}
async function sendTransactiononFail(userEmail, name, amount, toAccount, reason) {
    const subject = "Transaction Failed"
    const text = `Hello ${name} , \n\n Your trasaction of ${amount} to account ${toAccount} is failed ${reason}  `
    const html = ` <h2>Transaction Failed</h2>
    <p>Hello ${name} </p>
    <p>Your transaction of ${amount} to account ${toAccount} is failed ${reason} </p>`

    await sendEmail(userEmail, subject, text, html)
}


module.exports = {
    sendEmail, sendRegistrationEmail,
    sendTransactionEmail, sendTransactiononFail, sendTransactiononFail
}