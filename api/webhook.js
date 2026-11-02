const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const event = req.body;
    
    // Ingest PayPal completed payment events
    if (event.event_type === 'CHECKOUT.ORDER.APPROVED' || event.event_type === 'PAYMENT.SALE.COMPLETED') {
      const resource = event.resource;
      const amountUsd = parseFloat(resource.amount?.total || resource.gross_amount?.value || 0);
      const userId = resource.custom_id || resource.invoice_id || 'anonymous_user';
      const webhookId = event.id;

      if (amountUsd > 0) {
        // Execute atomic Supabase RPC settlement
        const { data, error } = await supabase.rpc('process_paypal_settlement', {
          p_user_id: userId,
          p_amount_usd: amountUsd,
          p_webhook_id: webhookId
        });

        if (error) {
          console.error('Supabase RPC Settlement Error:', error);
          return res.status(500).json({ error: error.message });
        }

        return res.status(200).json({ status: 'SETTLED', cu_balance: data });
      }
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('Webhook Handler Exception:', err);
    return res.status(500).json({ error: err.message });
  }
};