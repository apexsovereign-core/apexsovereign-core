'use strict';

const fs = require('fs');
const path = require('path');

function parseCsv(text) {
    const lines = text.trim().split(/\r?\n/);
    if (lines.length === 0) return [];
    const headers = splitCsvLine(lines[0]);
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        const cols = splitCsvLine(lines[i]);
        const row = {};
        headers.forEach((h, idx) => { row[h] = cols[idx] !== undefined ? cols[idx] : ''; });
        rows.push(row);
    }
    return rows;
}

function splitCsvLine(line) {
    const out = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (inQuotes) {
            if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
            else if (c === '"') { inQuotes = false; }
            else { cur += c; }
        } else {
            if (c === '"') { inQuotes = true; }
            else if (c === ',') { out.push(cur); cur = ''; }
            else { cur += c; }
        }
    }
    out.push(cur);
    return out.map((s) => s.trim());
}

const ROOT = path.resolve(__dirname, '..');
const TARGETS_CSV = path.join(ROOT, 'docs', 'outreach', 'targets.csv');
const TEMPLATE_PATH = path.join(ROOT, 'docs', 'outreach', '03_Email_Sequence_DC.md');
const LOG_PATH = path.join(ROOT, 'docs', 'outreach', 'dispatch_log.json');

const DRY_RUN = process.argv.includes('--dry-run');

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function loadTemplate() {
    const raw = fs.readFileSync(TEMPLATE_PATH, 'utf8');
    // Extract the first email body (between first ```text and closing ```)
    const m = raw.match(/```text\n([\s\S]*?)```/);
    return m ? m[1].trim() : raw;
}

function personalize(template, row) {
    return template
        .replace(/\[Executive Name\]/g, row.contact_name || 'there')
        .replace(/\[Target Company\]/g, row.company_name || '')
        .replace(/\[GPU Nodes\]/g, row.gpu_nodes || '');
}

function loadTargets() {
    const csv = fs.readFileSync(TARGETS_CSV, 'utf8');
    const rows = parseCsv(csv);
    return rows.filter((r) => (r.status || 'pending').toLowerCase() === 'pending');
}

function loadLog() {
    if (!fs.existsSync(LOG_PATH)) return [];
    try { return JSON.parse(fs.readFileSync(LOG_PATH, 'utf8')); } catch (_) { return []; }
}

async function sendEmail(row, body) {
    if (DRY_RUN) {
        return { dryRun: true, to: row.contact_email };
    }
    let nodemailer;
    try { nodemailer = require('nodemailer'); } catch (_) {
        throw new Error('nodemailer not installed. Run: npm install nodemailer (in repo root or services/)');
    }
    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: Number(process.env.SMTP_PORT) === 465,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });
    const info = await transporter.sendMail({
        from: '"Anton John Gajutos Intes | ApexSovereign.ai" <contact@apexsovereign.ai>',
        replyTo: 'contact@apexsovereign.ai',
        to: row.contact_email,
        subject: 'Monetizing idle H100 / B200 rack capacity (Zero integration cost)',
        text: body
    });
    return { messageId: info.messageId };
}

async function main() {
    const targets = loadTargets();
    console.log(`[dispatcher] ${targets.length} pending targets. dry-run=${DRY_RUN}`);

    const template = loadTemplate();
    const log = loadLog();

    for (const row of targets) {
        const body = personalize(template, row);
        try {
            const res = await sendEmail(row, body);
            console.log(`[dispatcher] SENT -> ${row.contact_email} (${row.company_name}) ${JSON.stringify(res)}`);
            log.push({ company: row.company_name, to: row.contact_email, status: 'sent', at: new Date().toISOString(), dryRun: DRY_RUN });
        } catch (err) {
            console.error(`[dispatcher] FAILED -> ${row.contact_email}: ${err.message}`);
            log.push({ company: row.company_name, to: row.contact_email, status: 'failed', error: err.message, at: new Date().toISOString(), dryRun: DRY_RUN });
        }
        fs.writeFileSync(LOG_PATH, JSON.stringify(log, null, 2));

        if (!DRY_RUN && targets.indexOf(row) < targets.length - 1) {
            const delay = rand(45000, 90000);
            console.log(`[dispatcher] waiting ${Math.round(delay / 1000)}s before next dispatch...`);
            await sleep(delay);
        }
    }
    console.log('[dispatcher] done.');
}

main().catch((e) => { console.error(e); process.exit(1); });