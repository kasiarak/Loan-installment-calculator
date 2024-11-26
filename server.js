import { createServer } from 'http';
import pool from './db.js';
import dotenv from 'dotenv';
import xml2js from 'xml2js';
import { sendMail } from './emailService.js';


dotenv.config();
const PORT = process.env.PORT;

const jsonMiddleWare = (req, res, next) => {
    res.setHeader('Content-Type', 'application/json');
    next();
}
const calculateLoan = async (req, res) => {
    let body = '';
    req.on('data', (chunk) => {
        body += chunk.toString();
    });
    req.on('end', async () =>{
        try{
            const parsedBody = JSON.parse(body);
        const { totalInstallments, 
            remainingInstallments, 
            installmentAmount, 
            loanAmount,
            interestRate } = parsedBody;    
            const response = await fetch('https://static.nbp.pl/dane/stopy/stopy_procentowe.xml');
            const xml = await response.text();
            const parser = new xml2js.Parser();
            const result = await parser.parseStringPromise(xml);
            const referenceRate = parseFloat(result.stopy_procentowe.tabela[0].pozycja.find(p => p.$.id === 'ref').$.oprocentowanie.replace(',', '.'));
            const date = new Date();
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0'); 
            const year = date.getFullYear();
            const referenceRateDate = `${year}-${month}-${day}`;
            if(parsedBody.interestRate > referenceRate){
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.write(JSON.stringify({message: 'The interest rate is higher than the reference rate.'}));
                res.end();  
            }else{
                const remainingLoanValue = parseFloat((parsedBody.remainingInstallments * parsedBody.installmentAmount).toFixed(2)); 
                const newInstallmentAmount = parseFloat(((parsedBody.loanAmount * (referenceRate / 100 / 12)) / (1 - Math.pow(1 + (referenceRate / 100 / 12), -parsedBody.totalInstallments))).toFixed(2));
                await pool.query('INSERT INTO loans (id, reference_rate, reference_rate_date, remaining_loan_value, new_installment_amount) VALUES (id, ?, ?, ?, ?)', [referenceRate, referenceRateDate, remainingLoanValue, newInstallmentAmount]);
                if(newInstallmentAmount < 0) sendMail(); 
                res.writeHead(200, { 'Content-Type': 'application/json' }); 
                res.end();
            }
        }catch(error){
            res.writeHead(400, { 'Content-Type': 'application/json' }); 
            res.write(JSON.stringify({ message: 'Invalid data or server error' }));
            res.end();
        }
    });
}

const notFoundHandler = (res) => {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.write(JSON.stringify({message: 'Route not found'}));
    res.end();
}

const server = createServer((req, res) => {
    jsonMiddleWare(req, res, () => {
        if(req.url === '/calculateLoan' && req.method === 'POST'){
            calculateLoan(req, res); 
        }else{
            notFoundHandler(res); 
        }
    });
});

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
});
