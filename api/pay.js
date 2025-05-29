export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  let body = req.body;

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

  const merchantId  = 'SU2505261345381642049693';
  const saltKey     = '2b98b87c-425f-4258-ace8-900cc99be48f';
  const saltIndex   = '1';

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

  const path = '/apis/hermes/pg/v1/pay'; // Updated path here
  const phonePeURL = `https://api.phonepe.com${path}`;
  const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64');
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

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (jsonErr) {
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
    return res.status(500).json({ success: false, message: err.message });
  }
}

