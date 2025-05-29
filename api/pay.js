export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  let body = req.body;

  // Fallback to raw parsing if body is empty or missing
  if (!body || Object.keys(body).length === 0) {
    try {
      const buffers = [];
      for await (const chunk of req) {
        buffers.push(chunk);
      }
      const rawBody = Buffer.concat(buffers).toString();
      body = JSON.parse(rawBody);
    } catch (err) {
      return res.status(400).json({ success: false, message: 'Invalid JSON in request body' });
    }
  }

  // Validate required fields
  const {
    merchantTransactionId,
    merchantUserId,
    amount,
    redirectUrl,
    callbackUrl,
    mobileNumber
  } = body;

  if (
    !merchantTransactionId || !merchantUserId ||
    !amount || typeof amount !== 'number' || amount <= 0 ||
    !redirectUrl || !callbackUrl || !mobileNumber
  ) {
    return res.status(400).json({ success: false, message: 'Missing or invalid required fields' });
  }

  const merchantId = 'SU2505261345381642049693'; // Your production merchantId
  const saltKey = '2b98b87c-425f-4258-ace8-900cc99be48f'; // Production Salt Key
  const saltIndex = '1'; // Salt index given by PhonePe

  const payload = {
    merchantId,
    merchantTransactionId,
    merchantUserId,
    amount,
    redirectUrl,
    redirectMode: 'POST',
    callbackUrl,
    mobileNumber,
    paymentInstrument: { type: 'PAY_PAGE' }
  };

  // Encode payload as base64
  const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64');
  const path = '/v3/payment/initiate';
  const phonePeURL = `https://api.phonepe.com${path}`;

  try {
    const crypto = await import('node:crypto');
    // Create HMAC SHA256 signature as per PhonePe docs
    const hash = crypto
      .createHmac('sha256', saltKey)
      .update(base64Payload + path + saltKey)
      .digest('hex');
    const xVerify = `${hash}###${saltIndex}`;

    // Call PhonePe API
    const response = await fetch(phonePeURL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-VERIFY': xVerify
      },
      body: JSON.stringify({ request: base64Payload })
    });

    const text = await response.text();
    console.log('Raw PhonePe response:', text);

    let data;
    try {
      data = JSON.parse(text);
    } catch (jsonErr) {
      console.error('Failed to parse JSON from PhonePe:', jsonErr);
      return res.status(500).json({ success: false, message: 'Invalid JSON response from PhonePe' });
    }

    if (!data || !data.success) {
      return res.status(400).json({
        success: false,
        message: data.message || `Payment initiation failed. Code: ${data.code || 'Unknown'}`
      });
    }

    // Success - forward PhonePe response to frontend
    return res.status(200).json(data);

  } catch (err) {
    console.error('Backend error:', err);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
}
