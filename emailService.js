import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const transporter = nodemailer.createTransport({
  service: 'gmail', 
  auth: {
    user: process.env.EMAIL, 
    pass: process.env.EMAIL_PASSWORD          
  }
});

export function sendMail() {
  const mailOptions = {
    from: process.env.EMAIL,
    to: process.env.EMAIL,                
    subject: 'Installment',              
    text: 'The installment amount is less than 0.'                  
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      return console.log(error);
    }
    console.log(info.response);
  });
}
