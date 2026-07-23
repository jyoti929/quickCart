import express from 'express';
import nodemailer from 'nodemailer';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, query, where, orderBy, limit, getDocs, updateDoc, doc } from 'firebase/firestore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

const app = express();
app.use(cors());
app.use(express.json());

// Nodemailer Transporter configuration for Gmail
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.OTP_EMAIL,
    pass: process.env.OTP_PASSWORD,
  },
  debug: true,
  logger: true
});

// Endpoint to generate and send OTP
app.post('/send-otp', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ success: false, message: 'Email is required.' });
  }

  try {
    // 1. Generate 6-digit random OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // 2. Set Expiration time (5 minutes from now)
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    const createdAt = new Date().toISOString();

    // 3. Save OTP to Firestore under 'otps' collection
    const otpsRef = collection(db, 'otps');
    await addDoc(otpsRef, {
      email: email.trim().toLowerCase(),
      otp,
      createdAt,
      expiresAt,
      used: false,
    });

    // 4. Send Email via Nodemailer
    const mailOptions = {
      from: `"quickCart Support" <${process.env.OTP_EMAIL}>`,
      to: email.trim().toLowerCase(),
      subject: 'Verify Your quickCart Account',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
          <h2 style="color: #10b981; text-align: center; margin-bottom: 24px;">quickCart Verification Code</h2>
          <p style="font-size: 16px; color: #1e293b;">Thank you for registering with quickCart! To complete your signup, please verify your email address using the 6-digit code below:</p>
          <div style="font-size: 32px; font-weight: 800; text-align: center; letter-spacing: 6px; color: #1e293b; background-color: #f1f5f9; padding: 16px; margin: 24px 0; border-radius: 8px;">
            ${otp}
          </div>
          <p style="font-size: 14px; color: #64748b; text-align: center;">This code will expire in <strong>5 minutes</strong>. If you did not request this verification code, please ignore this email.</p>
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
          <p style="font-size: 12px; color: #94a3b8; text-align: center;">© 2026 quickCart Inc. All rights reserved.</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`[OTP] Sent OTP ${otp} to ${email}`);
    
    return res.status(200).json({ success: true, message: 'OTP sent successfully.' });
  } catch (error) {
    console.error('Error in send-otp:', error);
    return res.status(500).json({ success: false, message: 'Failed to send OTP. ' + error.message });
  }
});

// Endpoint to verify OTP
app.post('/verify-otp', async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) {
    return res.status(400).json({ success: false, message: 'Email and OTP are required.' });
  }

  try {
    const targetEmail = email.trim().toLowerCase();
    const enteredOtp = otp.trim();

    // Query OTPs for email
    const otpsRef = collection(db, 'otps');
    const q = query(
      otpsRef,
      where('email', '==', targetEmail)
    );

    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
      return res.status(400).json({ success: false, message: 'No verification code found for this email.' });
    }

    // Sort in-memory by createdAt descending
    const sortedDocs = querySnapshot.docs.sort((a, b) => {
      const timeA = new Date(a.data().createdAt || 0).getTime();
      const timeB = new Date(b.data().createdAt || 0).getTime();
      return timeB - timeA;
    });

    const otpDoc = sortedDocs[0];
    const otpData = otpDoc.data();

    // Check one-time use
    if (otpData.used) {
      return res.status(400).json({ success: false, message: 'This code has already been used.' });
    }

    // Check expiration
    const expiryTime = new Date(otpData.expiresAt).getTime();
    if (Date.now() > expiryTime) {
      return res.status(400).json({ success: false, message: 'This code has expired. Please request a new one.' });
    }

    // Check match
    if (otpData.otp !== enteredOtp) {
      return res.status(400).json({ success: false, message: 'Invalid verification code.' });
    }

    // Mark as used
    const docRef = doc(db, 'otps', otpDoc.id);
    await updateDoc(docRef, { used: true });

    console.log(`[OTP] Verified OTP successfully for ${email}`);
    return res.status(200).json({ success: true, message: 'OTP verified successfully.' });
  } catch (error) {
    console.error('Error in verify-otp:', error);
    return res.status(500).json({ success: false, message: 'Verification failed. ' + error.message });
  }
});

// Endpoint to send order confirmation email
app.post('/send-order-confirmation', async (req, res) => {
  const { email, orderId, totalAmount, deliveryCharge, items, address, paymentMethod, deliveryOption } = req.body;
  
  if (!email || !orderId) {
    return res.status(400).json({ success: false, message: 'Email and orderId are required.' });
  }

  try {
    const itemsMarkup = items.map(item => `
      <div style="padding: 8px 0; border-bottom: 1px dashed #e2e8f0; font-size: 13px;">
        <span style="font-weight: bold; color: #1e293b;">${item.name}</span>
        <span style="color: #64748b; margin-left: 8px;">Qty: ${item.quantity}</span>
        <span style="float: right; font-weight: bold; color: #1e293b;">₹${item.price * item.quantity}</span>
      </div>
    `).join('');

    const mailOptions = {
      from: `"quickCart Orders" <${process.env.OTP_EMAIL}>`,
      to: email.trim().toLowerCase(),
      subject: `Order Confirmed - #${orderId.slice(-6).toUpperCase()}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
          <div style="text-align: center; margin-bottom: 24px;">
            <h2 style="color: #2a5d4c; margin: 0;">Order Confirmed!</h2>
            <p style="font-size: 14px; color: #64748b; margin-top: 4px;">Thank you for shopping with quickCart</p>
          </div>
          <p style="font-size: 16px; color: #1e293b;">Hi,</p>
          <p style="font-size: 14px; color: #475569; line-height: 1.5;">Your order has been successfully placed. Here are your order details:</p>
          
          <div style="background-color: #f8fafc; border-radius: 8px; padding: 16px; margin: 20px 0; border: 1px solid #f1f5f9;">
            <div style="font-size: 13px; font-weight: bold; color: #1e293b; margin-bottom: 12px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px;">
              Order ID: #${orderId.slice(-6).toUpperCase()}
            </div>
            
            ${itemsMarkup}
            
            <table style="width: 100%; font-size: 13px; color: #475569; margin-top: 12px;">
              <tr>
                <td style="padding: 4px 0;">Subtotal</td>
                <td style="text-align: right; padding: 4px 0;">₹${totalAmount - deliveryCharge}</td>
              </tr>
              <tr>
                <td style="padding: 4px 0;">Delivery Fee</td>
                <td style="text-align: right; padding: 4px 0;">₹${deliveryCharge}</td>
              </tr>
              <tr style="font-weight: bold; color: #2a5d4c; font-size: 15px;">
                <td style="padding: 8px 0 0 0; border-top: 1px solid #e2e8f0;">Total Paid</td>
                <td style="text-align: right; padding: 8px 0 0 0; border-top: 1px solid #e2e8f0;">₹${totalAmount}</td>
              </tr>
            </table>
          </div>
          
          <div style="font-size: 13px; color: #475569; line-height: 1.5; margin-bottom: 20px; background-color: #f8fafc; border-radius: 8px; padding: 16px; border: 1px solid #f1f5f9;">
            <strong>Delivery Address:</strong><br />
            ${address}<br /><br />
            <strong>Payment Method:</strong> ${paymentMethod}<br />
            <strong>Delivery Option:</strong> ${deliveryOption}
          </div>
          
          <p style="font-size: 14px; color: #64748b; text-align: center; margin-top: 24px;">You can track your order status in the <strong>My Orders</strong> tab of the quickCart app.</p>
          
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
          <p style="font-size: 12px; color: #94a3b8; text-align: center;">© 2026 quickCart Inc. All rights reserved.</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`[Order] Sent order confirmation for order ${orderId} to ${email}`);
    
    return res.status(200).json({ success: true, message: 'Order confirmation email sent.' });
  } catch (error) {
    console.error('Error in send-order-confirmation:', error);
    return res.status(500).json({ success: false, message: 'Failed to send confirmation email. ' + error.message });
  }
});

// Endpoint to send order cancellation email
app.post('/send-order-cancellation', async (req, res) => {
  const { email, orderId, totalAmount } = req.body;
  if (!email || !orderId) {
    return res.status(400).json({ success: false, message: 'Email and orderId are required.' });
  }

  try {
    const mailOptions = {
      from: `"quickCart Support" <${process.env.OTP_EMAIL}>`,
      to: email.trim().toLowerCase(),
      subject: `Order Cancelled - #${orderId.slice(-6).toUpperCase()}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
          <div style="text-align: center; margin-bottom: 24px;">
            <h2 style="color: #ef4444; margin: 0;">Order Cancelled</h2>
            <p style="font-size: 14px; color: #64748b; margin-top: 4px;">Refund status: Triggered</p>
          </div>
          <p style="font-size: 16px; color: #1e293b;">Hi,</p>
          <p style="font-size: 14px; color: #475569; line-height: 1.5;">Your order <strong>#${orderId.slice(-6).toUpperCase()}</strong> has been cancelled successfully.</p>
          <p style="font-size: 14px; color: #475569; line-height: 1.5;">The total paid amount of <strong>₹${totalAmount}</strong> has been refunded to your original payment mode. It should reflect in your account within 3-5 working days.</p>
          
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
          <p style="font-size: 12px; color: #94a3b8; text-align: center;">© 2026 quickCart Inc. All rights reserved.</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`[Order] Sent cancellation email for order ${orderId} to ${email}`);
    return res.status(200).json({ success: true, message: 'Cancellation email sent successfully.' });
  } catch (error) {
    console.error('Error in send-order-cancellation:', error);
    return res.status(500).json({ success: false, message: 'Failed to send cancellation email. ' + error.message });
  }
});

// Endpoint to send out for delivery email
app.post('/send-out-for-delivery', async (req, res) => {
  const { email, orderId, address, items } = req.body;
  if (!email || !orderId) {
    return res.status(400).json({ success: false, message: 'Email and orderId are required.' });
  }

  try {
    const itemsList = items.map(item => `<li>${item.name} (Qty: ${item.quantity})</li>`).join('');

    const mailOptions = {
      from: `"quickCart Logistics" <${process.env.OTP_EMAIL}>`,
      to: email.trim().toLowerCase(),
      subject: `Out for Delivery - #${orderId.slice(-6).toUpperCase()}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
          <div style="text-align: center; margin-bottom: 24px;">
            <h2 style="color: #2a5d4c; margin: 0;">Out for Delivery!</h2>
            <p style="font-size: 14px; color: #64748b; margin-top: 4px;">Your order will arrive today</p>
          </div>
          <p style="font-size: 16px; color: #1e293b;">Hi,</p>
          <p style="font-size: 14px; color: #475569; line-height: 1.5;">Great news! Your order <strong>#${orderId.slice(-6).toUpperCase()}</strong> is out for delivery with our courier agent.</p>
          
          <div style="background-color: #f8fafc; border-radius: 8px; padding: 16px; margin: 20px 0; border: 1px solid #f1f5f9;">
            <strong style="font-size: 13px; color: #1e293b;">Items in Shipment:</strong>
            <ul style="font-size: 13px; color: #475569; padding-left: 20px; margin-top: 8px;">
              ${itemsList}
            </ul>
          </div>

          <div style="font-size: 13px; color: #475569; line-height: 1.5; margin-bottom: 20px; background-color: #f8fafc; border-radius: 8px; padding: 16px; border: 1px solid #f1f5f9;">
            <strong>Shipping Address:</strong><br />
            ${address}
          </div>

          <p style="font-size: 14px; color: #64748b; text-align: center;">Please ensure someone is available at the address to receive the delivery.</p>
          
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
          <p style="font-size: 12px; color: #94a3b8; text-align: center;">© 2026 quickCart Inc. All rights reserved.</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`[Order] Sent out for delivery email for order ${orderId} to ${email}`);
    return res.status(200).json({ success: true, message: 'Out for delivery email sent successfully.' });
  } catch (error) {
    console.error('Error in send-out-for-delivery:', error);
    return res.status(500).json({ success: false, message: 'Failed to send out for delivery email. ' + error.message });
  }
});

// Endpoint to send address update email
app.post('/send-address-update', async (req, res) => {
  const { email, orderId, oldAddress, newAddress } = req.body;
  if (!email || !orderId || !newAddress) {
    return res.status(400).json({ success: false, message: 'Email, orderId, and newAddress are required.' });
  }

  try {
    const mailOptions = {
      from: `"quickCart Support" <${process.env.OTP_EMAIL}>`,
      to: email.trim().toLowerCase(),
      subject: `Delivery Address Updated - #${orderId.slice(-6).toUpperCase()}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
          <div style="text-align: center; margin-bottom: 24px;">
            <h2 style="color: #2a5d4c; margin: 0;">Address Updated</h2>
            <p style="font-size: 14px; color: #64748b; margin-top: 4px;">Shipping destination changed successfully</p>
          </div>
          <p style="font-size: 16px; color: #1e293b;">Hi,</p>
          <p style="font-size: 14px; color: #475569; line-height: 1.5;">The delivery address for your order <strong>#${orderId.slice(-6).toUpperCase()}</strong> has been updated successfully.</p>
          
          <div style="background-color: #f8fafc; border-radius: 8px; padding: 16px; margin: 20px 0; border: 1px solid #f1f5f9;">
            <div style="margin-bottom: 12px;">
              <span style="font-size: 12px; font-weight: bold; color: #ef4444; text-transform: uppercase;">Old Delivery Address:</span>
              <p style="font-size: 13px; color: #64748b; margin: 4px 0 0 0;">${oldAddress || "N/A"}</p>
            </div>
            <hr style="border: 0; border-top: 1px dashed #cbd5e1; margin: 12px 0;" />
            <div>
              <span style="font-size: 12px; font-weight: bold; color: #16a34a; text-transform: uppercase;">New Delivery Address:</span>
              <p style="font-size: 13px; color: #1e293b; margin: 4px 0 0 0; font-weight: bold;">${newAddress}</p>
            </div>
          </div>

          <p style="font-size: 14px; color: #64748b; text-align: center;">If you did not request this change, please contact support immediately.</p>
          
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
          <p style="font-size: 12px; color: #94a3b8; text-align: center;">© 2026 quickCart Inc. All rights reserved.</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`[Order] Sent address update email for order ${orderId} to ${email}`);
    return res.status(200).json({ success: true, message: 'Address update email sent successfully.' });
  } catch (error) {
    console.error('Error in send-address-update:', error);
    return res.status(500).json({ success: false, message: 'Failed to send address update email. ' + error.message });
  }
});

// Endpoint to send order invoice email
app.post('/send-invoice-email', async (req, res) => {
  const { email, clientName, orderId, totalAmount, deliveryCharge, items, address, paymentMethod, deliveryOption } = req.body;
  if (!email || !orderId) {
    return res.status(400).json({ success: false, message: 'Email and orderId are required.' });
  }

  try {
    const itemsMarkup = items.map(item => `
      <tr style="border-bottom: 1px solid #f1f5f9;">
        <td style="padding: 12px 8px; font-size: 13px; color: #334155;">${item.name} ${item.size ? `(${item.size})` : ''}</td>
        <td style="padding: 12px 8px; font-size: 13px; color: #334155; text-align: center;">${item.quantity}</td>
        <td style="padding: 12px 8px; font-size: 13px; color: #334155; text-align: right;">₹${(item.price * item.quantity).toFixed(2)}</td>
      </tr>
    `).join('');

    const subtotal = totalAmount - deliveryCharge;

    const mailOptions = {
      from: `"quickCart Invoices" <${process.env.OTP_EMAIL}>`,
      to: email.trim().toLowerCase(),
      subject: `Tax Invoice - QC-${orderId.slice(-6).toUpperCase()}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff; color: #1e293b;">
          <div style="text-align: center; margin-bottom: 24px; border-bottom: 2px dashed #cbd5e1; padding-bottom: 16px;">
            <h2 style="color: #2a5d4c; margin: 0; font-size: 22px; font-weight: bold;">quickCart Inc.</h2>
            <p style="font-size: 12px; color: #64748b; margin: 4px 0 0 0;">Sector 62, Noida, UP - 201301</p>
            <p style="font-size: 11px; color: #94a3b8; margin: 2px 0 0 0;">GSTIN: 09AABCU8372M1Z5</p>
          </div>
          
          <div style="margin-bottom: 20px; font-size: 13px; color: #475569; line-height: 1.6;">
            <table style="width: 100%;">
              <tr>
                <td style="vertical-align: top; width: 60%;">
                  <strong style="color: #94a3b8; font-size: 11px; text-transform: uppercase;">Billed To:</strong><br />
                  <strong style="color: #1e293b;">${clientName || 'Valued Customer'}</strong><br />
                  ${address}
                </td>
                <td style="vertical-align: top; text-align: right;">
                  <strong>Invoice No:</strong> QC-${orderId.slice(-6).toUpperCase()}<br />
                  <strong>Date:</strong> ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}<br />
                  <strong>Payment Method:</strong> ${paymentMethod}<br />
                  <strong>Delivery:</strong> ${deliveryOption}
                </td>
              </tr>
            </table>
          </div>
          
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <thead>
              <tr style="background-color: #f8fafc; border-bottom: 1px solid #cbd5e1;">
                <th style="padding: 10px 8px; text-align: left; font-size: 12px; color: #475569; font-weight: bold;">Item Description</th>
                <th style="padding: 10px 8px; text-align: center; font-size: 12px; color: #475569; font-weight: bold; width: 60px;">Qty</th>
                <th style="padding: 10px 8px; text-align: right; font-size: 12px; color: #475569; font-weight: bold; width: 100px;">Price</th>
              </tr>
            </thead>
            <tbody>
              ${itemsMarkup}
            </tbody>
          </table>
          
          <div style="text-align: right; margin-top: 16px; border-top: 1px solid #e2e8f0; padding-top: 12px;">
            <table style="width: 55%; float: right; font-size: 13px; color: #475569;">
              <tr>
                <td style="padding: 4px 0;">Subtotal</td>
                <td style="text-align: right; padding: 4px 0; font-weight: bold;">₹${subtotal.toFixed(2)}</td>
              </tr>
              <tr>
                <td style="padding: 4px 0;">Delivery Charge</td>
                <td style="text-align: right; padding: 4px 0; font-weight: bold;">₹${deliveryCharge.toFixed(2)}</td>
              </tr>
              <tr style="font-weight: bold; color: #2a5d4c; font-size: 16px;">
                <td style="padding: 8px 0 0 0; border-top: 2px solid #2a5d4c;">Grand Total</td>
                <td style="text-align: right; padding: 8px 0 0 0; border-top: 2px solid #2a5d4c;">₹${totalAmount.toFixed(2)}</td>
              </tr>
            </table>
            <div style="clear: both;"></div>
          </div>
          
          <div style="margin-top: 36px; padding-top: 16px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 12px; color: #94a3b8;">
            <p>Thank you for shopping with quickCart! This is a computer-generated tax invoice and does not require a signature.</p>
            <p style="margin-top: 8px;">© 2026 quickCart Inc. All rights reserved.</p>
          </div>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`[Invoice] Sent tax invoice email for order ${orderId} to ${email}`);
    return res.status(200).json({ success: true, message: 'Invoice email sent successfully.' });
  } catch (error) {
    console.error('Error in send-invoice-email:', error);
    return res.status(500).json({ success: false, message: 'Failed to send invoice email. ' + error.message });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`OTP Backend listening at http://localhost:${PORT}`);
});
