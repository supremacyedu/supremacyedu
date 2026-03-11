const PDFDocument = require("pdfkit");
const fs = require("fs");

module.exports = function generateReceipt(payment) {
  return new Promise((resolve) => {
    const filePath = `receipts/${payment.paymentId}.pdf`;
    const doc = new PDFDocument();

    doc.pipe(fs.createWriteStream(filePath));

    doc.fontSize(20).text("Payment Receipt", { align: "center" });
    doc.moveDown();

    doc.text(`Name: ${payment.name}`);
    doc.text(`Phone: ${payment.phone}`);
    doc.text(`Referrer ID: ${payment.referrerId}`);
    doc.text(`Amount Paid: ₹${payment.kitFee}`);
    doc.text(`Payment ID: ${payment.paymentId}`);
    doc.moveDown();

    doc.text("Terms & Conditions:");
    doc.text("1. This payment is non-refundable.");
    doc.text("2. Enrollment subject to approval.");
    doc.text("3. This is a system-generated receipt.");

    doc.end();

    resolve(filePath);
  });
};