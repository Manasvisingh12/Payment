import crypto from 'crypto';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  let body = req.body;

  if (!body || Object.keys(body).length === 0) {
    try {
      const buffers = [];
      for await (const chunk of req) buffers.push(chunk);
      const rawBody = Buffer.concat(buffers).toString();
      body = JSON.parse(rawBody);
    } catch (err) {
      console.error('Invalid JSON in request body:', err);
      return res.status(400).json({ success: false, message: 'Invalid JSON in request body' });
    }
  }

  const requiredFields = [
    'merchantTransactionId',
    'merchantUserId',
    'amount',
    'redirectUrl',
    'callbackUrl',
  ];
  for (const field of requiredFields) {
    if (!body[field]) {
      return res.status(400).json({ success: false, message: `Missing required field: ${field}` });
    }
  }

  // PhonePe production credentials
  const merchantId = 'SU2505261345381642049693';
  const saltKey = '2b98b87c-425f-4258-ace8-900cc99be48f';
  const saltIndex = '1';

  // Production API details
  const baseURL = 'https://api.phonepe.com/apis/hermes';
  const path = '/pg/v1/pay';
  const phonePeURL = baseURL + path;

  // Convert amount rupees to paise
  const amountInPaise = Math.round(body.amount * 100);

  const payload = {
    merchantId,
    merchantTransactionId: body.merchantTransactionId,
    merchantUserId: body.merchantUserId,
    amount: amountInPaise,
    redirectUrl: body.redirectUrl,
    redirectMode: 'POST',
    callbackUrl: body.callbackUrl,
    paymentInstrument: {
      type: 'PAY_PAGE',
    },
  };

  if (body.mobileNumber) {
    payload.mobileNumber = body.mobileNumber;
  }

  const jsonPayload = JSON.stringify(payload);
  const base64Payload = Buffer.from(jsonPayload).toString('base64');

  const dataToHash = base64Payload + path + saltKey;
  const hash = crypto.createHash('sha256').update(dataToHash).digest('hex');
  const xVerify = `${hash}###${saltIndex}`;

  try {
    const fetchResponse = await fetch(phonePeURL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-VERIFY': xVerify,
      },
      body: JSON.stringify({ request: base64Payload }),
    });

    const responseData = await fetchResponse.json();

    console.log('PhonePe API response:', responseData);

    return res.status(fetchResponse.status).json(responseData);
  } catch (error) {
    console.error('PhonePe API call error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
}


