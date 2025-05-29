export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  let body = req.body;

  // Handle raw body parsing fallback if body is empty or undefined
  if (!body || Object.keys(body).length === 0) {
    try {
      const buffers = [];
      for await (const chunk of req) {
        buffers.push(chunk);
      }
      const rawBody = Buffer.concat(buffers).toString();
      body = JSON.parse(rawBody);
    } catch (err) {
      console.error('Invalid JSON in request body:', err);
      return res.status(400).json({ success: false, message: 'Invalid JSON in request body' });
    }
  }

  // Validate required fields
  const requiredFields = [
    'merchantTransactionId',
    'merchantUserId',
    'amount',
    'redirectUrl',
    'callbackUrl',
    'mobileNumber',
  ];

  for (const field of requiredFields) {
    if (!body[field]) {
      return res.status(400).json({ success: false, message: `Missing required field: ${field}` });
    }
  }

  // Constants from PhonePe dashboard (Use your real merchantId, saltKey, saltIndex)
  const merchantId = 'SU2505261345381642049693';
  const saltKey = '2b98b87c-425f-4258-ace8-900cc99be48f';
  const saltIndex = '1';

  // Prepare payload
  const payload = {
    merchantId,
    merchantTransactionId: body.merchantTransactionId,
    merchantUserId: body.merchantUserId,
    amount: body.amount,
    redirectUrl: body.redirectUrl,
    redirectMode: 'POST', // PhonePe requires either POST or REDIRECT here
    callbackUrl: body.callbackUrl,
    mobileNumber: body.mobileNumber,
    paymentInstrument: { type: 'PAY_PAGE' },
  };

  const path = '/v3/payment/initiate';
  const phonePeURL = `https://api.phonepe.com${path}`;

  // Base64 encode the JSON payload
  const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64');

  // Generate HMAC SHA256 hash for X-VERIFY header
  const crypto = await import('crypto');
  const hash = crypto.createHmac('sha256', saltKey).update(base64Payload + path + saltKey).digest('hex');
  const xVerify = `${hash}###${saltIndex}`;

  try {
    // Call PhonePe API
    const response = await fetch(phonePeURL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-VERIFY': xVerify,
      },
      body: JSON.stringify({ request: base64Payload }),
    });

    // Log response status and headers for debugging
    console.log('PhonePe Response Status:', response.status);
    console.log('PhonePe Response Headers:', JSON.stringify([...response.headers]));

    const text = await response.text();
    console.log('PhonePe Raw Response Text:', text);

    let data;
    try {
      data = JSON.parse(text);
    } catch (jsonErr) {
      console.error('Failed to parse PhonePe response JSON:', jsonErr);
      return res.status(500).json({ success: false, message: 'Invalid JSON response from PhonePe', rawResponse: text });
    }

    if (!data || !data.success) {
      console.error('PhonePe API responded with failure:', data);
      return res.status(400).json({
        success: false,
        message: data.message || `Payment initiation failed. Code: ${data.code || 'Unknown'}`,
        rawResponse: data,
      });
    }

    // Success — return PhonePe response to frontend
    return res.status(200).json(data);
  } catch (err) {
    console.error('Backend error while calling PhonePe:', err);
    return res.status(500).json({ success: false, message: 'Internal Server Error', error: err.message });
  }
}

