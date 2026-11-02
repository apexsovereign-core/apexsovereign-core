import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { event_type, resource } = req.body;

        if (event_type === 'CHECKOUT.ORDER.APPROVED') {
            const userId = resource?.custom_id;
            const amountUsd = parseFloat(resource?.amount?.total || '0');

            const { data, error } = await supabase.rpc('process_paypal_settlement', {
                p_user_id: userId,
                p_amount_usd: amountUsd,
                p_webhook_id: req.body.id || 'TEST_WH'
            });

            if (error) throw error;

            return res.status(200).json({ status: 'success', new_balance: data });
        }

        return res.status(200).json({ status: 'ignored_event' });
    } catch (err) {
        console.error('Webhook execution failure:', err);
        return res.status(500).json({ error: err.message });
    }
}
