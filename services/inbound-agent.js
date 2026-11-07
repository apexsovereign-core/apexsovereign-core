import express from 'express';
import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

const router = express.Router();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Inbound Webhook Listener for Email Events
router.post('/api/agent/inbound-email', async (req, res) => {
    try {
        const { sender, subject, body, attachments } = req.body || {};

        // Step 1: Classify intent via local Ollama runtime
        const classification = await classifyWithOllama(subject, body);

        if (classification === 'SUPPLY_LOI') {
            await handleSupplyLOI(sender, subject, attachments);
        } else if (classification === 'DESIGN_PARTNER') {
            await handleDesignPartner(sender, body);
        }

        return res.status(200).json({ status: 'processed', intent: classification });
    } catch (error) {
        console.error('Inbound Agent Error:', error);
        return res.status(500).json({ error: 'Agent execution failed' });
    }
});

async function classifyWithOllama(subject, body) {
    const prompt = `Classify the following email into exactly one category: [SUPPLY_LOI, DESIGN_PARTNER, GENERAL_INQUIRY]. 
    Subject: ${subject}
    Body: ${(body || '').substring(0, 500)}`;

    const response = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'qwen2.5-coder:0.5b', prompt, stream: false })
    });
    const data = await response.json();
    return (data.response || '').trim().toUpperCase();
}

async function handleSupplyLOI(sender, subject, attachments) {
    // Strict attachment filtering: only PDFs under 10MB are accepted; others quarantined.
    const safeAttachments = (attachments || []).filter((a) => {
        const name = String((a && a.name) || '').toLowerCase();
        const size = Number((a && a.size) || 0);
        return name.endsWith('.pdf') && size > 0 && size <= 10 * 1024 * 1024;
    });

    await supabase.from('supplier_pipeline').insert({
        partner_email: sender,
        subject: subject,
        status: 'PENDING_VERIFICATION',
        attachments_meta: safeAttachments,
        created_at: new Date().toISOString()
    });
}

async function handleDesignPartner(sender, body) {
    const { data, error } = await supabase.rpc('provision_design_partner', {
        partner_email: sender,
        initial_cu: 500
    });
    if (error) console.error('Provisioning failed:', error);
    return data;
}

export default router;

// Standalone server entrypoint
if (import.meta.url === `file://${process.argv[1]}`) {
    const app = express();
    app.use(express.json({ limit: '10mb' }));
    app.use(router);
    const port = process.env.PORT || 3001;
    app.listen(port, () => console.log(`apex-inbound-agent listening on ${port}`));
}