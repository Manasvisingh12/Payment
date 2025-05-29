export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  let body = req.body;

  // Fallback for raw body parsing if body is empty
  if (!body || Object.keys(body).length === 0) {
    try {
      const buffers = [];
      for await (const chunk of req) {
        buffers.push(chunk);
      }
      const rawBody = Buffer.concat(buffers).toString();
      body = JSON.parse(rawBody);
    } catch (err) {
      return res.status(400).json({ success: false, message: 'Invalid JSON' });
    }
  }

  const merchantId  = 'SU2505261345381642049693'; // Your production merchantId
  const saltKey     = '2b98b87c-425f-4258-ace8-900cc99be48f'; // Production Salt Key
  const saltIndex   = '1'; // Salt index as given by PhonePe

  const payload = {
    merchantId,
    merchantTransactionId: body.merchantTransactionId,
    merchantUserId: body.merchantUserId,
    amount: body.amount,
    redirectUrl: body.redirectUrl,
    redirectMode: 'POST',
    callbackUrl: body.callbackUrl,
    mobileNumber: body.mobileNumber,
    paymentInstrument: { type: 'PAY_PAGE' }
  };

  const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64');
  const path = '/v3/payment/initiate';
  const phonePeURL = `https://api.phonepe.com${path}`;
  const crypto = await import('crypto');
  const hash = crypto.createHmac('sha256', saltKey).update(base64Payload + path + saltKey).digest('hex');
  const xVerify = `${hash}###${saltIndex}`;

  try {
    const response = await fetch(phonePeURL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-VERIFY': xVerify
      },
      body: JSON.stringify({ request: base64Payload })
    });

    // Log response status and headers
    console.log('Response status:', response.status);
    console.log('Response headers:', JSON.stringify([...response.headers]));

    const text = await response.text();

    // Log the raw response text
    console.log('Response text:', text);

    let data;
    try {
      data = JSON.parse(text);
    } catch (jsonErr) {
      console.error('Failed to parse JSON:', jsonErr);
      return res.status(500).json({ success: false, message: 'Invalid JSON response from PhonePe', rawResponse: text });
    }

    if (!data || !data.success) {
      return res.status(400).json({
        success: false,
        message: data.message || `Payment initiation failed. Code: ${data.code || 'Unknown'}`,
        rawResponse: data
      });
    }

    return res.status(200).json(data);

  } catch (err) {
    console.error('Backend error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}
