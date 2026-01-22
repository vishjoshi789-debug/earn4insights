# Survey & Feedback System - Advanced Features

## Overview

This system now includes comprehensive survey creation, response collection, and analytics capabilities with the following advanced features:

## Features

### 1. 📊 Response Analytics Dashboard
**Location:** `/dashboard/surveys/[id]/responses`

**Features:**
- **Statistics Cards**: Total responses, NPS score, promoters/detractors count
- **Response List**: Expandable cards showing all survey responses
- **NPS Categorization**: Automatically categorizes responses as Promoters (9-10), Passives (7-8), or Detractors (0-6)
- **Sentiment Analysis**: AI-powered sentiment detection on text responses (😊 positive, 😐 neutral, 😞 negative)
- **User Details**: Display respondent name and email when provided
- **Timestamp Tracking**: Shows when each response was submitted

**How to Use:**
1. Navigate to any survey detail page
2. Click "View Responses" button
3. View aggregated statistics at the top
4. Click on any response to expand and see all answers

---

### 2. 📈 NPS Trend Chart
**Location:** `/dashboard/surveys/[id]/responses` (for NPS surveys)

**Features:**
- **Line Chart**: Visualizes NPS score trends over time
- **Daily Breakdown**: Groups responses by day and calculates daily NPS
- **Interactive Tooltips**: Hover to see detailed breakdown (promoters, passives, detractors)
- **Responsive Design**: Auto-adjusts for mobile and desktop

**Chart Data:**
- X-Axis: Date (formatted as "MMM d")
- Y-Axis: NPS Score (-100 to +100)
- Tooltip shows: Date, NPS score, promoters, passives, detractors, total responses

---

### 3. 📥 CSV Export
**Location:** Export button on `/dashboard/surveys/[id]/responses`

**Features:**
- **One-Click Export**: Download all responses as CSV file
- **Complete Data**: Includes all questions and answers
- **Proper Formatting**: Handles commas, quotes, and newlines in responses
- **Timestamped Filename**: `survey-responses-{surveyId}-{date}.csv`

**CSV Columns:**
- Response ID
- Submitted At (formatted timestamp)
- User Name
- User Email
- [Question 1 text]
- [Question 2 text]
- ... (all survey questions)

**Usage:**
```typescript
// In your component
<ExportResponsesButton surveyId={surveyId} responses={responses} />
```

---

### 4. 🔗 Embed Widget
**Location:** `/dashboard/surveys/[id]/embed`

**Embedding Options:**

#### A. Direct Link
```
https://yourdomain.com/survey/{surveyId}
```
Share via email, social media, or messaging apps.

#### B. Iframe Embed
```html
<iframe 
  src="https://yourdomain.com/survey/{surveyId}" 
  width="100%" 
  height="600" 
  frameborder="0" 
  style="border: 1px solid #e5e7eb; border-radius: 8px;">
</iframe>
```
Best for simple integration into websites.

#### C. JavaScript Widget
```html
<div id="survey-widget-{surveyId}"></div>
<script>
  (function() {
    const iframe = document.createElement('iframe');
    iframe.src = 'https://yourdomain.com/survey/{surveyId}';
    iframe.width = '100%';
    iframe.height = '600';
    // ... additional config
    document.getElementById('survey-widget-{surveyId}').appendChild(iframe);
  })();
</script>
```
Good for CMS platforms like WordPress, Webflow, etc.

#### D. Popup Modal
```html
<button onclick="openSurveyPopup_{surveyId}()">Take Survey</button>
<script>
  function openSurveyPopup_{surveyId}() {
    // Creates full-screen overlay with survey
    // Includes close button
    // Click outside to dismiss
  }
</script>
```
Best for minimal disruption to user experience.

---

### 5. 📧 Email Notifications
**Location:** Automatic on every new response

**Features:**
- **Real-Time Alerts**: Sent immediately when someone submits a response
- **Rich HTML Emails**: Beautifully formatted with branding
- **Quick Preview**: Shows rating and first text response
- **Direct Link**: One-click access to full response analytics

**Email Contains:**
- Survey title
- Respondent name (if provided)
- Rating score (if applicable)
- Preview of feedback text
- Link to view all responses

**Setup Instructions:**

**Option 1: Development (Console Logging)**
Current default - emails are logged to console for testing.

**Option 2: Production with Resend**
```bash
# 1. Install Resend
npm install resend

# 2. Get API key from resend.com

# 3. Add to .env.local
RESEND_API_KEY=re_xxxxxxxxxxxx
NOTIFICATION_EMAIL=your-email@example.com
EMAIL_FROM=notifications@yourdomain.com

# 4. Uncomment Resend code in src/server/emailService.ts
```

**Option 3: Other Email Providers**
The system is provider-agnostic. Edit `src/server/emailService.ts` to integrate:
- SendGrid
- AWS SES
- Mailgun
- Postmark
- Any SMTP service

---

### 6. 🤖 Sentiment Analysis
**Location:** Automatic on text responses in analytics dashboard

**Features:**
- **Keyword-Based Analysis**: Uses predefined positive/negative keyword lists
- **Visual Indicators**: Emoji badges (😊 😐 😞) on each response
- **Confidence Scoring**: Indicates analysis reliability
- **Non-Blocking**: Runs client-side, doesn't slow down response submission

**Sentiment Categories:**
- **Positive**: Contains words like "love", "great", "excellent", "amazing"
- **Negative**: Contains words like "hate", "bad", "terrible", "disappointed"
- **Neutral**: Balanced or no strong sentiment keywords

**Upgrade to AI-Powered Analysis:**

**Option 1: OpenAI GPT**
```bash
# 1. Install OpenAI SDK
npm install openai

# 2. Add API key to .env.local
OPENAI_API_KEY=sk-xxxxxxxxxxxx

# 3. Uncomment OpenAI code in src/server/sentimentService.ts
```

**Option 2: Other AI Services**
- Google Cloud Natural Language API
- Azure Text Analytics
- AWS Comprehend
- Hugging Face Transformers

**Response Format:**
```typescript
{
  sentiment: 'positive' | 'negative' | 'neutral',
  score: -1 to 1,        // -1 = very negative, +1 = very positive
  confidence: 0 to 1     // How confident the analysis is
}
```

---

## File Structure

```
src/
├── app/
│   └── dashboard/
│       └── surveys/
│           └── [id]/
│               ├── page.tsx                    # Survey detail page
│               ├── responses/
│               │   ├── page.tsx               # Analytics dashboard
│               │   ├── ResponsesTable.tsx     # Response list with sentiment
│               │   ├── NPSTrendChart.tsx      # Trend visualization
│               │   └── ExportResponsesButton.tsx
│               └── embed/
│                   ├── page.tsx               # Embed code generator
│                   └── EmbedCodeDisplay.tsx   # Code snippet component
│
├── server/
│   ├── emailService.ts                        # Email notification service
│   ├── sentimentService.ts                    # Sentiment analysis
│   └── surveys/
│       └── responseService.ts                 # Response actions + CSV export
│
└── components/
    └── ui/                                    # shadcn/ui components
```

---

## Usage Examples

### Creating a Survey
```typescript
// Navigate to /dashboard/surveys/create?productId={productId}
// Select survey type: NPS, CSAT, or Custom
// Add questions and configure
```

### Collecting Responses
```typescript
// Share link: /survey/{surveyId}
// Or embed on your website
// Users submit responses
// You receive email notification
```

### Analyzing Results
```typescript
// Go to /dashboard/surveys/{surveyId}/responses
// View statistics, charts, individual responses
// Export to CSV for further analysis
```

---

## Environment Variables

Required for full functionality:

```env
# App Configuration
NEXT_PUBLIC_APP_URL=https://yourdomain.com

# Email Notifications (Optional - defaults to console logging)
NOTIFICATION_EMAIL=admin@yourdomain.com
RESEND_API_KEY=re_xxxxxxxxxxxx
EMAIL_FROM=notifications@yourdomain.com

# AI Sentiment Analysis (Optional - defaults to keyword matching)
OPENAI_API_KEY=sk-xxxxxxxxxxxx
```

---

## API Reference

### Server Actions

#### `submitSurveyResponse(surveyId, answers, userName?, userEmail?)`
- Validates and stores survey response
- Sends email notification
- Revalidates cache
- Returns: SurveyResponse object

#### `calculateNPS(surveyId)`
- Calculates NPS score and breakdown
- Returns: `{ score, promoters, passives, detractors, totalResponses }`

#### `exportResponsesToCSV(surveyId)`
- Generates CSV file content
- Returns: CSV string

#### `analyzeSentiment(text)`
- Analyzes text sentiment
- Returns: `{ sentiment, score, confidence }`

---

## Performance Considerations

1. **Sentiment Analysis**: Runs client-side to avoid blocking page loads
2. **Email Sending**: Fire-and-forget async - doesn't block response submission
3. **Chart Rendering**: Uses React suspense for progressive loading
4. **CSV Export**: Server-side generation prevents browser memory issues

---

## Security Features

1. **Survey Validation**: Checks survey exists and is active before accepting responses
2. **Required Questions**: Server-side validation of required fields
3. **Input Sanitization**: CSV export properly escapes special characters
4. **Email Rate Limiting**: Consider adding rate limits in production
5. **CORS**: Embed widget works across domains safely via iframes

---

## Future Enhancements

**Planned Features:**
- [ ] Response filtering (date range, rating range)
- [ ] Bulk actions (delete, export selected)
- [ ] Response search and full-text filtering
- [ ] Custom email templates
- [ ] Webhook integrations (Slack, Discord, Zapier)
- [ ] A/B testing for surveys
- [ ] Conditional logic (skip questions based on answers)
- [ ] Multi-language support
- [ ] Response quotas and survey closing rules

**AI Enhancements:**
- [ ] Auto-generated survey insights
- [ ] Response summarization
- [ ] Theme extraction from open-ended responses
- [ ] Anomaly detection

---

## Troubleshooting

### Emails not sending
1. Check `NOTIFICATION_EMAIL` is set in `.env.local`
2. Check console logs for error messages
3. Verify email provider API key is valid
4. Ensure email service code is uncommented if using Resend

### Sentiment analysis not showing
1. Check browser console for errors
2. Verify responses have text answers
3. Text must be non-empty after trimming
4. Sentiment badges only show on expanded responses

### CSV export empty
1. Ensure survey has responses
2. Check server logs for export errors
3. Verify file downloads aren't blocked by browser

### Chart not rendering
1. Verify recharts is installed: `npm list recharts`
2. Check responses have valid dates
3. Ensure at least 1 response exists
4. Look for console errors

---

## Support

For issues or feature requests, check:
- TypeScript errors in VS Code
- Browser console for client-side errors  
- Server logs for API errors
- Network tab for failed requests

---

## Credits

Built with:
- **Next.js 15.5+** - React framework
- **TypeScript** - Type safety
- **Recharts** - Charts and visualizations
- **date-fns** - Date formatting
- **shadcn/ui** - UI components
- **Tailwind CSS** - Styling

