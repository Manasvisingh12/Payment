export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');

  let body = req.body;
  if (!body || Object.keys(body).length === 0) {
    const buffers = [];
    for await (const chunk of req) {
      buffers.push(chunk);
    }
    const rawBody = Buffer.concat(buffers).toString();
    try {
      body = JSON.parse(rawBody);
    } catch {
      return res.status(400).json({ error: 'Invalid JSON' });
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

  const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64');
  const path = '/pg/v1/pay';
  const crypto = await import('crypto');
  const hash = crypto.createHmac('sha256', saltKey).update(base64Payload + path + saltKey).digest('hex');
  const xVerify = `${hash}###${saltIndex}`;

  try {
    const response = await fetch(`https://api.phonepe.com/apis/hermes${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-VERIFY': xVerify
      },
      body: JSON.stringify({ request: base64Payload })
    });

    const data = await response.json();
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}
