#!/usr/bin/env python3
"""Generate Aether POS Command Center Integration Guide PDF"""

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY
from reportlab.lib import colors
from reportlab.lib.units import cm, mm
from reportlab.platypus import (
    Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether
)
from reportlab.platypus.tableofcontents import TableOfContents
from reportlab.platypus import SimpleDocTemplate
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily
import os

# ── Fonts ──
pdfmetrics.registerFont(TTFont('TimesNewRoman', '/usr/share/fonts/truetype/english/Times-New-Roman.ttf'))
pdfmetrics.registerFont(TTFont('Calibri', '/usr/share/fonts/truetype/english/calibri-regular.ttf'))
pdfmetrics.registerFont(TTFont('SimHei', '/usr/share/fonts/truetype/chinese/SimHei.ttf'))
pdfmetrics.registerFont(TTFont('DejaVuSans', '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf'))
registerFontFamily('TimesNewRoman', normal='TimesNewRoman', bold='TimesNewRoman')
registerFontFamily('Calibri', normal='Calibri', bold='Calibri')
registerFontFamily('SimHei', normal='SimHei', bold='SimHei')

# ── Colors ──
PRIMARY = colors.HexColor('#1F4E79')
ACCENT = colors.HexColor('#2E86AB')
DARK = colors.HexColor('#1a1a2e')
HEADER_BG = colors.HexColor('#1F4E79')
ROW_ODD = colors.HexColor('#F5F5F5')
ROW_EVEN = colors.white
CODE_BG = colors.HexColor('#F0F4F8')
CODE_BORDER = colors.HexColor('#C5D5E4')

# ── Styles ──
cover_title = ParagraphStyle('CoverTitle', fontName='TimesNewRoman', fontSize=36, leading=44, alignment=TA_CENTER, textColor=PRIMARY, spaceAfter=12)
cover_sub = ParagraphStyle('CoverSub', fontName='TimesNewRoman', fontSize=18, leading=24, alignment=TA_CENTER, textColor=ACCENT, spaceAfter=8)
cover_info = ParagraphStyle('CoverInfo', fontName='TimesNewRoman', fontSize=13, leading=20, alignment=TA_CENTER, textColor=colors.HexColor('#555555'), spaceAfter=6)

h1 = ParagraphStyle('H1', fontName='TimesNewRoman', fontSize=20, leading=28, textColor=PRIMARY, spaceBefore=18, spaceAfter=10)
h2 = ParagraphStyle('H2', fontName='TimesNewRoman', fontSize=15, leading=22, textColor=PRIMARY, spaceBefore=14, spaceAfter=8)
h3 = ParagraphStyle('H3', fontName='TimesNewRoman', fontSize=12, leading=18, textColor=DARK, spaceBefore=10, spaceAfter=6)

body = ParagraphStyle('Body', fontName='TimesNewRoman', fontSize=10.5, leading=17, alignment=TA_JUSTIFY, spaceAfter=6)
body_left = ParagraphStyle('BodyLeft', fontName='TimesNewRoman', fontSize=10.5, leading=17, alignment=TA_LEFT, spaceAfter=6)
bullet = ParagraphStyle('Bullet', fontName='TimesNewRoman', fontSize=10.5, leading=17, alignment=TA_LEFT, leftIndent=20, bulletIndent=8, spaceAfter=4)
code = ParagraphStyle('Code', fontName='DejaVuSans', fontSize=8.5, leading=13, alignment=TA_LEFT, textColor=colors.HexColor('#333333'), backColor=CODE_BG, borderColor=CODE_BORDER, borderWidth=0.5, borderPadding=6, spaceAfter=8, spaceBefore=4)
caption = ParagraphStyle('Caption', fontName='TimesNewRoman', fontSize=9.5, leading=14, alignment=TA_CENTER, textColor=colors.HexColor('#666666'), spaceAfter=12)

tbl_header = ParagraphStyle('TblHeader', fontName='TimesNewRoman', fontSize=9.5, leading=14, alignment=TA_CENTER, textColor=colors.white)
tbl_cell = ParagraphStyle('TblCell', fontName='TimesNewRoman', fontSize=9, leading=13, alignment=TA_CENTER, textColor=colors.black)
tbl_cell_left = ParagraphStyle('TblCellLeft', fontName='TimesNewRoman', fontSize=9, leading=13, alignment=TA_LEFT, textColor=colors.black)

note_style = ParagraphStyle('Note', fontName='TimesNewRoman', fontSize=9.5, leading=15, alignment=TA_LEFT, textColor=colors.HexColor('#8B4513'), leftIndent=10, borderColor=colors.HexColor('#DEB887'), borderWidth=1, borderPadding=6, backColor=colors.HexColor('#FFF8DC'))

# ── TOC Template ──
class TocDocTemplate(SimpleDocTemplate):
    def __init__(self, *args, **kwargs):
        SimpleDocTemplate.__init__(self, *args, **kwargs)
    def afterFlowable(self, flowable):
        if hasattr(flowable, 'bookmark_name'):
            level = getattr(flowable, 'bookmark_level', 0)
            text = getattr(flowable, 'bookmark_text', '')
            self.notify('TOCEntry', (level, text, self.page))

def heading(text, style, level=0):
    p = Paragraph(text, style)
    p.bookmark_name = text
    p.bookmark_level = level
    p.bookmark_text = text.replace('<b>', '').replace('</b>', '')
    return p

def make_table(data, col_widths, has_header=True):
    t = Table(data, colWidths=col_widths, repeatRows=1 if has_header else 0)
    style_cmds = [
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CCCCCC')),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]
    if has_header:
        style_cmds.append(('BACKGROUND', (0, 0), (-1, 0), HEADER_BG))
        style_cmds.append(('TEXTCOLOR', (0, 0), (-1, 0), colors.white))
        for i in range(1, len(data)):
            bg = ROW_ODD if i % 2 == 0 else ROW_EVEN
            style_cmds.append(('BACKGROUND', (0, i), (-1, i), bg))
    t.setStyle(TableStyle(style_cmds))
    return t

# ── Build ──
pdf_path = '/home/z/my-project/download/Aether_POS_Command_Center_Guide.pdf'
os.makedirs(os.path.dirname(pdf_path), exist_ok=True)

doc = TocDocTemplate(
    pdf_path,
    pagesize=A4,
    topMargin=2*cm, bottomMargin=2*cm, leftMargin=2.2*cm, rightMargin=2.2*cm,
    title='Aether POS Command Center Integration Guide',
    author='Z.ai',
    creator='Z.ai',
    subject='Technical integration guide for Aether POS Command Center API'
)

story = []

# ═══ COVER PAGE ═══
story.append(Spacer(1, 100))
story.append(Paragraph('<b>Aether POS</b>', cover_title))
story.append(Spacer(1, 12))
story.append(Paragraph('<b>Command Center</b>', cover_sub))
story.append(Paragraph('<b>Integration Guide</b>', cover_sub))
story.append(Spacer(1, 40))
story.append(Paragraph('Remote Plan Management, Outlet Control, and API Access', cover_info))
story.append(Spacer(1, 60))
story.append(Paragraph('Version 2.0 | April 2026', cover_info))
story.append(Paragraph('Aether POS Technical Documentation', cover_info))
story.append(PageBreak())

# ═══ TABLE OF CONTENTS ═══
toc = TableOfContents()
toc.levelStyles = [
    ParagraphStyle('TOC1', fontName='TimesNewRoman', fontSize=12, leftIndent=20, spaceBefore=6, leading=18),
    ParagraphStyle('TOC2', fontName='TimesNewRoman', fontSize=10.5, leftIndent=40, spaceBefore=3, leading=16),
]
story.append(Paragraph('<b>Table of Contents</b>', h1))
story.append(Spacer(1, 12))
story.append(toc)
story.append(PageBreak())

# ═══ 1. OVERVIEW ═══
story.append(heading('<b>1. Overview</b>', h1, 0))
story.append(Paragraph(
    'Aether POS Command Center is a secure webhook API that enables remote management of all outlet instances from a centralized control panel. '
    'Through this API, the Command Center can change subscription plans (Free, Pro, Enterprise), suspend or reactivate outlets, update outlet settings, '
    'trigger data synchronization, and broadcast messages to outlet owners. The system uses Bearer token authentication with a shared secret, '
    'and all operations are logged server-side for audit purposes.', body))
story.append(Spacer(1, 6))
story.append(Paragraph(
    'The architecture follows a client-polling model: the Command Center sends commands via POST requests to the API, and the POS client automatically '
    'detects changes by polling the plan status endpoint every 60 seconds and on every tab focus event. This means plan changes, suspensions, and setting '
    'updates propagate to the POS interface within approximately one minute without requiring a page refresh. For immediate propagation, the Command Center '
    'can send a SYNC_TRIGGER command which updates the outlet timestamp, prompting the client to re-fetch on its next poll cycle.', body))
story.append(Spacer(1, 6))

story.append(heading('<b>1.1 Key Capabilities</b>', h2, 1))
caps = [
    ['<b>SET_PLAN</b>', 'Change subscription plan (free/pro/enterprise) remotely'],
    ['<b>OUTLET_STATUS</b>', 'Suspend or reactivate outlet access (preserves original plan)'],
    ['<b>SET_SETTINGS</b>', 'Update outlet settings (payment methods, loyalty, receipt, theme)'],
    ['<b>SYNC_TRIGGER</b>', 'Force client to re-sync data from server'],
    ['<b>BROADCAST</b>', 'Send notification messages to outlets'],
]
cap_data = [[Paragraph('<b>Command</b>', tbl_header), Paragraph('<b>Description</b>', tbl_header)]]
for cmd, desc in caps:
    cap_data.append([Paragraph(cmd, tbl_cell_left), Paragraph(desc, tbl_cell_left)])
story.append(make_table(cap_data, [3.5*cm, 13*cm]))
story.append(Spacer(1, 6))
story.append(Paragraph('Table 1: Command Center Commands', caption))

# ═══ 2. AUTHENTICATION ═══
story.append(heading('<b>2. Authentication</b>', h1, 0))
story.append(Paragraph(
    'All Command Center API calls require Bearer token authentication. The token must match the <b>COMMAND_SECRET</b> environment variable '
    'configured on the Aether POS server. This secret is set during initial deployment and must be kept secure. Any request with a missing, '
    'invalid, or mismatched token will receive a 401 Unauthorized response. The token is transmitted in the standard Authorization header '
    'as shown below.', body))
story.append(Spacer(1, 6))

story.append(heading('<b>2.1 Environment Configuration</b>', h2, 1))
story.append(Paragraph(
    'The COMMAND_SECRET must be configured in the .env file on the Aether POS server. If this variable is not set, the API will return '
    'a 500 error indicating that the secret is not configured. For production deployments, use a strong random string of at least 32 characters. '
    'The same secret must be stored securely in the Command Center system to authenticate all outbound requests.', body))
story.append(Spacer(1, 6))

story.append(Paragraph('<b>Server .env configuration:</b>', body_left))
story.append(Paragraph('COMMAND_SECRET=your-very-secure-random-secret-here-min-32-chars', code))
story.append(Spacer(1, 6))

story.append(Paragraph('<b>Request header format:</b>', body_left))
story.append(Paragraph('Authorization: Bearer your-very-secure-random-secret-here-min-32-chars', code))
story.append(Spacer(1, 6))

story.append(heading('<b>2.2 Health Check (No Auth Required)</b>', h2, 1))
story.append(Paragraph(
    'A GET request to the command endpoint serves as a health check and does not require authentication. This endpoint returns a simple '
    'status object with the current server timestamp, which the Command Center can use to verify connectivity before sending commands.', body))
story.append(Spacer(1, 6))
story.append(Paragraph('GET /api/command', code))
story.append(Paragraph('Response: {"status":"ok","timestamp":"2026-04-02T20:00:00.000Z"}', code))

# ═══ 3. API ENDPOINTS ═══
story.append(heading('<b>3. API Endpoints</b>', h1, 0))
story.append(Paragraph(
    'The Command Center API is hosted at a single endpoint with different command payloads. All commands use the POST method '
    'with JSON body and Bearer token authentication. Each command requires three mandatory fields: <b>command</b> (the operation name), '
    '<b>outletId</b> (the target outlet identifier), and <b>data</b> (command-specific parameters).', body))
story.append(Spacer(1, 6))

story.append(heading('<b>3.1 Base URL and Headers</b>', h2, 1))
story.append(Paragraph('<b>Production URL:</b> https://your-domain.com/api/command', body_left))
story.append(Paragraph('<b>Development URL:</b> http://localhost:3000/api/command', body_left))
story.append(Spacer(1, 6))

headers_data = [
    [Paragraph('<b>Header</b>', tbl_header), Paragraph('<b>Value</b>', tbl_header), Paragraph('<b>Required</b>', tbl_header)],
    [Paragraph('Content-Type', tbl_cell), Paragraph('application/json', tbl_cell), Paragraph('Yes', tbl_cell)],
    [Paragraph('Authorization', tbl_cell), Paragraph('Bearer {COMMAND_SECRET}', tbl_cell), Paragraph('Yes', tbl_cell)],
]
story.append(make_table(headers_data, [3.5*cm, 8*cm, 2.5*cm]))
story.append(Paragraph('Table 2: Required Headers', caption))

# ═══ 4. COMMANDS ═══
story.append(heading('<b>4. Command Reference</b>', h1, 0))

# SET_PLAN
story.append(heading('<b>4.1 SET_PLAN - Change Subscription Plan</b>', h2, 1))
story.append(Paragraph(
    'Changes the subscription plan for a specific outlet. Valid plan values are <b>free</b>, <b>pro</b>, and <b>enterprise</b>. '
    'The plan change takes effect immediately in the database. The POS client will detect the change within 60 seconds through its '
    'automatic polling mechanism, or immediately on the next tab focus event. All feature gates, limits, and UI elements update '
    'automatically based on the new plan. When upgrading from Free to Pro, previously unavailable features such as Excel export, '
    'bulk edit, and enhanced filters become accessible. When downgrading, the outlet retains its data but cannot add new items '
    'beyond the lower plan limits until existing items are reduced.', body))
story.append(Spacer(1, 6))

plan_data = [
    [Paragraph('<b>Field</b>', tbl_header), Paragraph('<b>Type</b>', tbl_header), Paragraph('<b>Description</b>', tbl_header)],
    [Paragraph('command', tbl_cell), Paragraph('string', tbl_cell), Paragraph('"SET_PLAN"', tbl_cell_left)],
    [Paragraph('outletId', tbl_cell), Paragraph('string', tbl_cell), Paragraph('Target outlet CUID (from database)', tbl_cell_left)],
    [Paragraph('data.accountType', tbl_cell), Paragraph('string', tbl_cell), Paragraph('"free" | "pro" | "enterprise"', tbl_cell_left)],
]
story.append(make_table(plan_data, [3*cm, 2*cm, 11.5*cm]))
story.append(Paragraph('Table 3: SET_PLAN Parameters', caption))

story.append(Paragraph('<b>Request Example - Upgrade to Pro:</b>', body_left))
story.append(Paragraph('POST /api/command', code))
story.append(Paragraph('{', code))
story.append(Paragraph('  "command": "SET_PLAN",', code))
story.append(Paragraph('  "outletId": "cmnhxhljl000abcdef123456",', code))
story.append(Paragraph('  "data": { "accountType": "pro" }', code))
story.append(Paragraph('}', code))
story.append(Spacer(1, 6))

story.append(Paragraph('<b>Success Response:</b>', body_left))
story.append(Paragraph('{', code))
story.append(Paragraph('  "success": true,', code))
story.append(Paragraph('  "command": "SET_PLAN",', code))
story.append(Paragraph('  "outletId": "cmnhxhljl000abcdef123456",', code))
story.append(Paragraph('  "result": {', code))
story.append(Paragraph('    "outletId": "cmnhxhljl000abcdef123456",', code))
story.append(Paragraph('    "previousPlan": "free",', code))
story.append(Paragraph('    "newPlan": "pro"', code))
story.append(Paragraph('  },', code))
story.append(Paragraph('  "timestamp": "2026-04-02T20:00:00.000Z"', code))
story.append(Paragraph('}', code))

# OUTLET_STATUS
story.append(heading('<b>4.2 OUTLET_STATUS - Suspend/Reactivate Outlet</b>', h2, 1))
story.append(Paragraph(
    'Suspends or reactivates an outlet. When suspended, the original plan is preserved by prefixing "suspended:" to the accountType '
    'field (e.g., "suspended:pro"). This allows the system to restore the exact plan when reactivating. While suspended, the outlet '
    'owner sees a prominent red warning banner in the sidebar and cannot access POS or dashboard features. All data remains intact '
    'and the outlet can be reactivated at any time without data loss. This is useful for billing disputes, terms of service violations, '
    'or temporary account freezes during investigations.', body))
story.append(Spacer(1, 6))

suspend_data = [
    [Paragraph('<b>Field</b>', tbl_header), Paragraph('<b>Type</b>', tbl_header), Paragraph('<b>Description</b>', tbl_header)],
    [Paragraph('command', tbl_cell), Paragraph('string', tbl_cell), Paragraph('"OUTLET_STATUS"', tbl_cell_left)],
    [Paragraph('outletId', tbl_cell), Paragraph('string', tbl_cell), Paragraph('Target outlet CUID', tbl_cell_left)],
    [Paragraph('data.active', tbl_cell), Paragraph('boolean', tbl_cell), Paragraph('true = reactivate, false = suspend', tbl_cell_left)],
]
story.append(make_table(suspend_data, [3*cm, 2*cm, 11.5*cm]))
story.append(Paragraph('Table 4: OUTLET_STATUS Parameters', caption))

story.append(Paragraph('<b>Request Example - Suspend:</b>', body_left))
story.append(Paragraph('{', code))
story.append(Paragraph('  "command": "OUTLET_STATUS",', code))
story.append(Paragraph('  "outletId": "cmnhxhlkn003abcdef789012",', code))
story.append(Paragraph('  "data": { "active": false }', code))
story.append(Paragraph('}', code))
story.append(Spacer(1, 6))

story.append(Paragraph('<b>Response:</b>', body_left))
story.append(Paragraph('{', code))
story.append(Paragraph('  "success": true,', code))
story.append(Paragraph('  "result": {', code))
story.append(Paragraph('    "outletId": "cmnhxhlkn003abcdef789012",', code))
story.append(Paragraph('    "accountType": "suspended:pro",', code))
story.append(Paragraph('    "active": false', code))
story.append(Paragraph('  },', code))
story.append(Paragraph('  "timestamp": "..."', code))
story.append(Paragraph('}', code))

# SET_SETTINGS
story.append(heading('<b>4.3 SET_SETTINGS - Update Outlet Settings</b>', h2, 1))
story.append(Paragraph(
    'Updates one or more outlet settings remotely. Only known, whitelisted setting keys are accepted; any unrecognized keys in the '
    'data payload are silently ignored. This command uses an upsert pattern, meaning if the outlet does not yet have a settings record, '
    'it will be created with the provided values. If a settings record already exists, only the specified keys are updated while '
    'all other settings remain unchanged. This is the safest way to update configuration remotely without risking data overwrite.', body))
story.append(Spacer(1, 6))

settings_data = [
    [Paragraph('<b>Setting Key</b>', tbl_header), Paragraph('<b>Type</b>', tbl_header), Paragraph('<b>Example</b>', tbl_header)],
    [Paragraph('paymentMethods', tbl_cell_left), Paragraph('string', tbl_cell), Paragraph('"CASH,QRIS,DEBIT"', tbl_cell)],
    [Paragraph('loyaltyEnabled', tbl_cell_left), Paragraph('boolean', tbl_cell), Paragraph('true', tbl_cell)],
    [Paragraph('loyaltyPointsPerAmount', tbl_cell_left), Paragraph('integer', tbl_cell), Paragraph('10000', tbl_cell)],
    [Paragraph('loyaltyPointValue', tbl_cell_left), Paragraph('integer', tbl_cell), Paragraph('100', tbl_cell)],
    [Paragraph('receiptBusinessName', tbl_cell_left), Paragraph('string', tbl_cell), Paragraph('"My Store"', tbl_cell)],
    [Paragraph('receiptAddress', tbl_cell_left), Paragraph('string', tbl_cell), Paragraph('"Jl. Sudirman 123"', tbl_cell)],
    [Paragraph('receiptPhone', tbl_cell_left), Paragraph('string', tbl_cell), Paragraph('"021-1234567"', tbl_cell)],
    [Paragraph('receiptFooter', tbl_cell_left), Paragraph('string', tbl_cell), Paragraph('"Thank you!"', tbl_cell)],
    [Paragraph('themePrimaryColor', tbl_cell_left), Paragraph('string', tbl_cell), Paragraph('"emerald"', tbl_cell)],
]
story.append(make_table(settings_data, [4*cm, 2*cm, 10.5*cm]))
story.append(Paragraph('Table 5: SET_SETTINGS Allowed Keys', caption))

story.append(Paragraph('<b>Request Example:</b>', body_left))
story.append(Paragraph('{', code))
story.append(Paragraph('  "command": "SET_SETTINGS",', code))
story.append(Paragraph('  "outletId": "cmnhxhlkn003abcdef789012",', code))
story.append(Paragraph('  "data": {', code))
story.append(Paragraph('    "paymentMethods": "CASH,QRIS,DEBIT,OVO",', code))
story.append(Paragraph('    "themePrimaryColor": "violet",', code))
story.append(Paragraph('    "loyaltyPointsPerAmount": 5000', code))
story.append(Paragraph('  }', code))
story.append(Paragraph('}', code))

# SYNC_TRIGGER & BROADCAST
story.append(heading('<b>4.4 SYNC_TRIGGER - Force Client Re-sync</b>', h2, 1))
story.append(Paragraph(
    'Updates the outlet updatedAt timestamp, which causes the POS client to detect a change on its next 60-second poll cycle '
    'and re-fetch all data from the server. The optional "reason" field is logged server-side for audit purposes. This command is '
    'useful after making direct database changes or when the Command Center needs to ensure the client has the latest data without '
    'waiting for the natural polling interval. Note that this does not push data to the client; it only sets a flag that the client '
    'will detect on its next scheduled poll.', body))
story.append(Spacer(1, 6))
story.append(Paragraph('{', code))
story.append(Paragraph('  "command": "SYNC_TRIGGER",', code))
story.append(Paragraph('  "outletId": "cmnhxhljl000abcdef123456",', code))
story.append(Paragraph('  "data": { "reason": "Plan upgrade completed" }', code))
story.append(Paragraph('}', code))

story.append(heading('<b>4.5 BROADCAST - Send Message</b>', h2, 1))
story.append(Paragraph(
    'Broadcasts a message payload to the Command Center caller. Currently this command returns the message in the response, '
    'confirming delivery. Future implementations may push this message to the outlet owner via in-app notifications, Telegram, '
    'or email. The message type can be "info", "warning", or "critical" to indicate severity level. This command is designed '
    'for maintenance notifications, system announcements, and urgent alerts that need to reach outlet owners.', body))
story.append(Spacer(1, 6))
story.append(Paragraph('{', code))
story.append(Paragraph('  "command": "BROADCAST",', code))
story.append(Paragraph('  "outletId": "cmnhxhljl000abcdef123456",', code))
story.append(Paragraph('  "data": {', code))
story.append(Paragraph('    "message": "Scheduled maintenance tonight at 10 PM",', code))
story.append(Paragraph('    "type": "warning"', code))
story.append(Paragraph('  }', code))
story.append(Paragraph('}', code))

# ═══ 5. ERROR RESPONSES ═══
story.append(heading('<b>5. Error Responses</b>', h1, 0))
story.append(Paragraph(
    'The API returns standard HTTP status codes along with descriptive JSON error messages. All error responses follow a consistent '
    'format with an "error" field containing a human-readable description. The Command Center should handle these errors gracefully '
    'and log them for debugging. Below is a comprehensive list of error scenarios and their corresponding responses.', body))
story.append(Spacer(1, 6))

error_data = [
    [Paragraph('<b>HTTP Status</b>', tbl_header), Paragraph('<b>Error</b>', tbl_header), Paragraph('<b>Cause</b>', tbl_header)],
    [Paragraph('401', tbl_cell), Paragraph('Unauthorized - invalid or missing command token', tbl_cell_left), Paragraph('Wrong or missing Bearer token', tbl_cell_left)],
    [Paragraph('400', tbl_cell), Paragraph('Missing required fields: command, outletId, data', tbl_cell_left), Paragraph('Incomplete request body', tbl_cell_left)],
    [Paragraph('400', tbl_cell), Paragraph('Invalid command. Valid: SET_PLAN, ...', tbl_cell_left), Paragraph('Unknown command name', tbl_cell_left)],
    [Paragraph('400', tbl_cell), Paragraph('Invalid accountType "premium"', tbl_cell_left), Paragraph('Not free/pro/enterprise', tbl_cell_left)],
    [Paragraph('404', tbl_cell), Paragraph('Outlet "xxx" not found', tbl_cell_left), Paragraph('Invalid outletId', tbl_cell_left)],
    [Paragraph('500', tbl_cell), Paragraph('COMMAND_SECRET not configured on server', tbl_cell_left), Paragraph('Missing env variable', tbl_cell_left)],
    [Paragraph('500', tbl_cell), Paragraph('Internal server error', tbl_cell_left), Paragraph('Unexpected server error', tbl_cell_left)],
]
story.append(make_table(error_data, [2.2*cm, 7*cm, 7.3*cm]))
story.append(Paragraph('Table 6: Error Reference', caption))

# ═══ 6. PLAN FEATURE MATRIX ═══
story.append(heading('<b>6. Plan Feature Matrix</b>', h1, 0))
story.append(Paragraph(
    'The following table shows the complete feature matrix for each subscription plan. When the Command Center changes an outlet '
    'plan via SET_PLAN, all these features are automatically updated. A value of -1 means unlimited. The POS client reads this '
    'matrix to determine which features to display, which limits to enforce, and which upgrade prompts to show. Server-side API '
    'routes also enforce these limits independently, so even if a client bypasses the UI restrictions, the server will reject '
    'operations that exceed plan limits.', body))
story.append(Spacer(1, 8))

plan_matrix = [
    [Paragraph('<b>Feature</b>', tbl_header), Paragraph('<b>Free</b>', tbl_header), Paragraph('<b>Pro</b>', tbl_header), Paragraph('<b>Enterprise</b>', tbl_header)],
    [Paragraph('Max Products', tbl_cell_left), Paragraph('50', tbl_cell), Paragraph('Unlimited', tbl_cell), Paragraph('Unlimited', tbl_cell)],
    [Paragraph('Max Categories', tbl_cell_left), Paragraph('5', tbl_cell), Paragraph('Unlimited', tbl_cell), Paragraph('Unlimited', tbl_cell)],
    [Paragraph('Product Image Upload', tbl_cell_left), Paragraph('No', tbl_cell), Paragraph('Yes', tbl_cell), Paragraph('Yes', tbl_cell)],
    [Paragraph('Max Crew Members', tbl_cell_left), Paragraph('2', tbl_cell), Paragraph('Unlimited', tbl_cell), Paragraph('Unlimited', tbl_cell)],
    [Paragraph('Crew Permissions', tbl_cell_left), Paragraph('No', tbl_cell), Paragraph('Yes', tbl_cell), Paragraph('Yes', tbl_cell)],
    [Paragraph('Max Customers', tbl_cell_left), Paragraph('100', tbl_cell), Paragraph('Unlimited', tbl_cell), Paragraph('Unlimited', tbl_cell)],
    [Paragraph('Loyalty Program', tbl_cell_left), Paragraph('Yes', tbl_cell), Paragraph('Yes', tbl_cell), Paragraph('Yes', tbl_cell)],
    [Paragraph('Max Transactions/Month', tbl_cell_left), Paragraph('500', tbl_cell), Paragraph('Unlimited', tbl_cell), Paragraph('Unlimited', tbl_cell)],
    [Paragraph('Excel Export', tbl_cell_left), Paragraph('No', tbl_cell), Paragraph('Yes', tbl_cell), Paragraph('Yes', tbl_cell)],
    [Paragraph('Max Promos', tbl_cell_left), Paragraph('2', tbl_cell), Paragraph('Unlimited', tbl_cell), Paragraph('Unlimited', tbl_cell)],
    [Paragraph('Promo Types', tbl_cell_left), Paragraph('PERCENTAGE', tbl_cell), Paragraph('PCT + NOMINAL', tbl_cell), Paragraph('PCT + NOMINAL', tbl_cell)],
    [Paragraph('Audit Log', tbl_cell_left), Paragraph('Yes', tbl_cell), Paragraph('Yes', tbl_cell), Paragraph('Yes', tbl_cell)],
    [Paragraph('Stock Movement', tbl_cell_left), Paragraph('Yes', tbl_cell), Paragraph('Yes', tbl_cell), Paragraph('Yes', tbl_cell)],
    [Paragraph('Dashboard Analytics', tbl_cell_left), Paragraph('Yes', tbl_cell), Paragraph('Yes', tbl_cell), Paragraph('Yes', tbl_cell)],
    [Paragraph('Offline Mode', tbl_cell_left), Paragraph('Yes', tbl_cell), Paragraph('Yes', tbl_cell), Paragraph('Yes', tbl_cell)],
    [Paragraph('Multi Outlet', tbl_cell_left), Paragraph('No', tbl_cell), Paragraph('No', tbl_cell), Paragraph('Yes', tbl_cell)],
    [Paragraph('API Access', tbl_cell_left), Paragraph('No', tbl_cell), Paragraph('Yes', tbl_cell), Paragraph('Yes', tbl_cell)],
    [Paragraph('Priority Support', tbl_cell_left), Paragraph('No', tbl_cell), Paragraph('Yes', tbl_cell), Paragraph('Yes', tbl_cell)],
]
story.append(make_table(plan_matrix, [4*cm, 2.5*cm, 3.5*cm, 3.5*cm]))
story.append(Paragraph('Table 7: Complete Plan Feature Matrix', caption))

# ═══ 7. GETTING OUTLET IDS ═══
story.append(heading('<b>7. Obtaining Outlet IDs</b>', h1, 0))
story.append(Paragraph(
    'Every command requires a valid <b>outletId</b>. These IDs are CUIDs generated when an outlet registers through the Aether POS '
    'registration page. The Command Center needs a way to discover and map outlet IDs to owner identities. There are several methods '
    'to obtain outlet IDs depending on your deployment architecture.', body))
story.append(Spacer(1, 6))

story.append(heading('<b>7.1 Direct Database Query</b>', h2, 1))
story.append(Paragraph(
    'For systems with direct database access, outlet IDs can be queried directly. The Outlet model contains the name, accountType, '
    'createdAt, and updatedAt fields which can be used to identify and filter outlets. This method is most suitable for deployments '
    'where the Command Center has access to the same database as the POS instances.', body))
story.append(Spacer(1, 6))
story.append(Paragraph('-- SQLite (Local Development)', code))
story.append(Paragraph('SELECT id, name, accountType FROM Outlet;', code))
story.append(Spacer(1, 4))
story.append(Paragraph('-- PostgreSQL (Production / Neon)', code))
story.append(Paragraph('SELECT id, name, "accountType" FROM "Outlet";', code))

story.append(heading('<b>7.2 Owner Email Lookup</b>', h2, 1))
story.append(Paragraph(
    'If the Command Center knows the owner email address (from registration data), the User table can be joined with the Outlet table '
    'to map emails to outlet IDs. This is the recommended approach for owner-initiated support requests where the Command Center '
    'operator knows the customer email but needs to find the corresponding outlet.', body))
story.append(Spacer(1, 6))
story.append(Paragraph('-- Find outlet by owner email', code))
story.append(Paragraph('SELECT u.email, u.name, u.role, o.id, o.name, o."accountType"', code))
story.append(Paragraph('FROM "User" u JOIN "Outlet" o ON u."outletId" = o.id', code))
story.append(Paragraph('WHERE u.email = \'owner@pro.aether.com\' AND u.role = \'OWNER\';', code))

# ═══ 8. TESTING SEED ACCOUNTS ═══
story.append(heading('<b>8. Test Seed Accounts</b>', h1, 0))
story.append(Paragraph(
    'Aether POS includes a multi-plan seed script that creates three demo outlets with pre-populated data for testing the '
    'Command Center integration. Running the seed creates realistic test data including products, customers, transactions, '
    'loyalty logs, audit trails, and promo configurations scaled to each plan limits. This allows thorough testing of plan '
    'gating, suspension flows, and setting changes without manual data creation.', body))
story.append(Spacer(1, 6))

story.append(heading('<b>8.1 Running the Seed</b>', h2, 1))
story.append(Paragraph('bun run scripts/seed-multi.ts', code))
story.append(Spacer(1, 6))
story.append(Paragraph(
    'The seed script automatically detects existing data and resets the database if any outlets are found, ensuring a clean '
    'test environment every time it runs. All three outlets are created in a single transaction for data consistency.', body))
story.append(Spacer(1, 8))

seed_data = [
    [Paragraph('<b>Plan</b>', tbl_header), Paragraph('<b>Outlet Name</b>', tbl_header), Paragraph('<b>Owner Email</b>', tbl_header), Paragraph('<b>Password</b>', tbl_header)],
    [Paragraph('Free', tbl_cell), Paragraph('Warung Bahari', tbl_cell), Paragraph('owner@free.aether.com', tbl_cell), Paragraph('password123', tbl_cell)],
    [Paragraph('Pro', tbl_cell), Paragraph('Kopi Nusantara', tbl_cell), Paragraph('owner@pro.aether.com', tbl_cell), Paragraph('password123', tbl_cell)],
    [Paragraph('Enterprise', tbl_cell), Paragraph('Restoran Maharani', tbl_cell), Paragraph('owner@enterprise.aether.com', tbl_cell), Paragraph('password123', tbl_cell)],
]
story.append(make_table(seed_data, [2.2*cm, 4*cm, 5.5*cm, 3*cm]))
story.append(Paragraph('Table 8: Seed Test Accounts', caption))

story.append(heading('<b>8.2 Seed Data Volume</b>', h2, 1))
seed_vol = [
    [Paragraph('<b>Data</b>', tbl_header), Paragraph('<b>Free</b>', tbl_header), Paragraph('<b>Pro</b>', tbl_header), Paragraph('<b>Enterprise</b>', tbl_header)],
    [Paragraph('Products', tbl_cell_left), Paragraph('15', tbl_cell), Paragraph('25', tbl_cell), Paragraph('30', tbl_cell)],
    [Paragraph('Customers', tbl_cell_left), Paragraph('5', tbl_cell), Paragraph('10', tbl_cell), Paragraph('15', tbl_cell)],
    [Paragraph('Promos', tbl_cell_left), Paragraph('2', tbl_cell), Paragraph('4', tbl_cell), Paragraph('5', tbl_cell)],
    [Paragraph('Transactions', tbl_cell_left), Paragraph('5', tbl_cell), Paragraph('10', tbl_cell), Paragraph('15', tbl_cell)],
    [Paragraph('Crew Members', tbl_cell_left), Paragraph('1', tbl_cell), Paragraph('3', tbl_cell), Paragraph('5', tbl_cell)],
    [Paragraph('Crew Permissions', tbl_cell_left), Paragraph('0', tbl_cell), Paragraph('3', tbl_cell), Paragraph('5', tbl_cell)],
]
story.append(make_table(seed_vol, [3.5*cm, 2.5*cm, 3.5*cm, 3.5*cm]))
story.append(Paragraph('Table 9: Seed Data Volume per Plan', caption))

# ═══ 9. CLIENT DETECTION ═══
story.append(heading('<b>9. Client-Side Plan Detection</b>', h1, 0))
story.append(Paragraph(
    'The POS client automatically detects plan changes through a combination of polling and event-based mechanisms. The usePlan() '
    'React hook manages this process transparently. It fetches the current plan status on mount, then polls every 60 seconds, and '
    'also re-fetches whenever the browser tab regains focus. When a plan change is detected, all feature gates, limit checks, and '
    'UI elements update immediately without requiring a page refresh.', body))
story.append(Spacer(1, 6))

story.append(heading('<b>9.1 Polling Behavior</b>', h2, 1))
poll_data = [
    [Paragraph('<b>Event</b>', tbl_header), Paragraph('<b>Action</b>', tbl_header), Paragraph('<b>Interval</b>', tbl_header)],
    [Paragraph('Initial Mount', tbl_cell_left), Paragraph('Fetch /api/outlet/plan', tbl_cell_left), Paragraph('Immediate', tbl_cell)],
    [Paragraph('Periodic Poll', tbl_cell_left), Paragraph('Fetch /api/outlet/plan', tbl_cell_left), Paragraph('60 seconds', tbl_cell)],
    [Paragraph('Tab Focus', tbl_cell_left), Paragraph('Fetch /api/outlet/plan', tbl_cell_left), Paragraph('On focus event', tbl_cell)],
    [Paragraph('Manual Refresh', tbl_cell_left), Paragraph('Call refresh() from hook', tbl_cell_left), Paragraph('On demand', tbl_cell)],
]
story.append(make_table(poll_data, [3.5*cm, 6.5*cm, 3*cm]))
story.append(Paragraph('Table 10: Client Polling Events', caption))

story.append(heading('<b>9.2 Plan Status API Response</b>', h2, 1))
story.append(Paragraph(
    'The /api/outlet/plan endpoint returns the complete plan state including current plan type, suspension status, full feature '
    'matrix, usage counts against limits, and last updated timestamp. The Command Center can also call this endpoint (with session '
    'authentication) to verify that a plan change was applied correctly.', body))
story.append(Spacer(1, 6))
story.append(Paragraph('{', code))
story.append(Paragraph('  "outletId": "cmnhxhljl000...",', code))
story.append(Paragraph('  "outletName": "Warung Bahari (Free)",', code))
story.append(Paragraph('  "plan": {', code))
story.append(Paragraph('    "type": "free",', code))
story.append(Paragraph('    "label": "Free",', code))
story.append(Paragraph('    "isSuspended": false,', code))
story.append(Paragraph('    "features": { ... }', code))
story.append(Paragraph('  },', code))
story.append(Paragraph('  "usage": {', code))
story.append(Paragraph('    "products": 15, "customers": 5,', code))
story.append(Paragraph('    "crew": 1, "promos": 2,', code))
story.append(Paragraph('    "transactions": 5', code))
story.append(Paragraph('  },', code))
story.append(Paragraph('  "lastUpdated": "2026-04-02T20:00:00.000Z"', code))
story.append(Paragraph('}', code))

# ═══ 10. QUICK START ═══
story.append(heading('<b>10. Quick Start Checklist</b>', h1, 0))
story.append(Paragraph(
    'Follow this checklist to set up the Command Center integration from scratch. Each step should be completed in order, '
    'and verification should be performed before proceeding to the next step. This ensures a reliable integration with '
    'proper error handling and monitoring from the beginning.', body))
story.append(Spacer(1, 8))

checklist = [
    '1. Configure COMMAND_SECRET in .env on the Aether POS server (minimum 32 characters)',
    '2. Store the same COMMAND_SECRET securely in the Command Center system (environment variable or vault)',
    '3. Verify health check: GET /api/command returns {"status":"ok"}',
    '4. Run seed: bun run scripts/seed-multi.ts to create test outlets',
    '5. Query database to get outlet IDs: SELECT id, name, accountType FROM Outlet',
    '6. Test SET_PLAN: Send POST /api/command with SET_PLAN command to upgrade one outlet',
    '7. Test OUTLET_STATUS: Suspend the same outlet, verify "suspended:" prefix in database',
    '8. Reactivate: Send OUTLET_STATUS with active: true, verify original plan restored',
    '9. Test SET_SETTINGS: Update paymentMethods for an outlet, verify persistence',
    '10. Test SYNC_TRIGGER: Send trigger, verify updatedAt timestamp changes',
    '11. Test error handling: Send request with wrong secret (expect 401), wrong outletId (expect 404)',
    '12. Verify client detection: Log into POS as owner, observe plan badge in sidebar updates within 60s',
    '13. Test suspension UX: Suspend outlet, refresh POS page, verify red warning banner appears',
    '14. Monitor server logs: Check [COMMAND] prefix log entries for all operations',
]
for item in checklist:
    story.append(Paragraph(item, bullet))

# ═══ 11. SECURITY NOTES ═══
story.append(Spacer(1, 12))
story.append(heading('<b>11. Security Considerations</b>', h1, 0))
story.append(Paragraph(
    'The Command Center API is one of the most sensitive endpoints in the Aether POS system, as it has the power to change '
    'subscription plans, suspend outlets, and modify configurations remotely. Proper security practices are essential to prevent '
    'unauthorized access and ensure the integrity of the system. Below are the key security considerations that should be '
    'implemented in any production deployment.', body))
story.append(Spacer(1, 6))

security = [
    ['<b>Secret Management</b>', 'Never hardcode COMMAND_SECRET in source code. Use environment variables, secrets managers (AWS Secrets Manager, HashiCorp Vault), or encrypted configuration files. Rotate the secret periodically and update both the server and Command Center simultaneously.'],
    ['<b>HTTPS Only</b>', 'Always use HTTPS in production. The Bearer token is transmitted in plain text in the Authorization header, so HTTPS is mandatory to prevent token interception via man-in-the-middle attacks. The NextAuth useSecureCookies setting handles this automatically when NEXTAUTH_URL starts with "https".'],
    ['<b>IP Whitelisting</b>', 'Consider adding IP-based access control at the reverse proxy level (Caddy, Nginx) to restrict /api/command access to known Command Center IP addresses. This provides defense-in-depth even if the token is compromised.'],
    ['<b>Audit Logging</b>', 'All Command Center operations are logged server-side with the [COMMAND] prefix. Monitor these logs for suspicious activity such as rapid plan changes, repeated suspension attempts, or requests from unexpected sources.'],
    ['<b>Rate Limiting</b>', 'Implement rate limiting on the /api/command endpoint to prevent brute-force token guessing or denial-of-service attacks. A reasonable default is 100 requests per minute per IP address.'],
]
for title, desc in security:
    story.append(Paragraph(title, body_left))
    story.append(Paragraph(desc, body))

# ── Build ──
doc.multiBuild(story)
print(f'PDF generated: {pdf_path}')
