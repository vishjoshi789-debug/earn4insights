import { notFound } from 'next/navigation'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { fetchSurvey } from '@/server/surveys/surveyService'
import EmbedCodeDisplay from './EmbedCodeDisplay'

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function SurveyEmbedPage({ params }: PageProps) {
  const { id } = await params
  const survey = await fetchSurvey(id)

  if (!survey) {
    notFound()
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const surveyUrl = `${baseUrl}/survey/${survey.id}`

  // Generate embed codes
  const iframeCode = `<iframe src="${surveyUrl}" width="100%" height="600" frameborder="0" style="border: 1px solid #e5e7eb; border-radius: 8px;"></iframe>`

  const scriptCode = `<div id="survey-widget-${survey.id}"></div>
<script>
  (function() {
    const iframe = document.createElement('iframe');
    iframe.src = '${surveyUrl}';
    iframe.width = '100%';
    iframe.height = '600';
    iframe.frameBorder = '0';
    iframe.style.border = '1px solid #e5e7eb';
    iframe.style.borderRadius = '8px';
    document.getElementById('survey-widget-${survey.id}').appendChild(iframe);
  })();
</script>`

  const popupCode = `<button onclick="openSurveyPopup_${survey.id}()" style="background: #2563eb; color: white; padding: 12px 24px; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500;">
  Take Survey
</button>

<script>
  function openSurveyPopup_${survey.id}() {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 9998; display: flex; align-items: center; justify-content: center;';
    
    const container = document.createElement('div');
    container.style.cssText = 'position: relative; width: 90%; max-width: 600px; height: 80vh; background: white; border-radius: 12px; overflow: hidden;';
    
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '×';
    closeBtn.style.cssText = 'position: absolute; top: 10px; right: 10px; z-index: 1; background: white; border: 1px solid #e5e7eb; width: 32px; height: 32px; border-radius: 50%; cursor: pointer; font-size: 24px; line-height: 1;';
    closeBtn.onclick = () => document.body.removeChild(overlay);
    
    const iframe = document.createElement('iframe');
    iframe.src = '${surveyUrl}';
    iframe.style.cssText = 'width: 100%; height: 100%; border: none;';
    
    container.appendChild(closeBtn);
    container.appendChild(iframe);
    overlay.appendChild(container);
    overlay.onclick = (e) => { if (e.target === overlay) document.body.removeChild(overlay); };
    
    document.body.appendChild(overlay);
  }
</script>`

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Embed Survey</h1>
        <p className="text-muted-foreground mt-2">
          Add {survey.title} to your website using any of the methods below
        </p>
      </div>

      {/* Direct Link */}
      <Card>
        <CardHeader>
          <CardTitle>Direct Link</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Share this URL directly with users via email, social media, or messaging apps.
          </p>
          <EmbedCodeDisplay code={surveyUrl} language="text" />
        </CardContent>
      </Card>

      {/* Iframe Embed */}
      <Card>
        <CardHeader>
          <CardTitle>Iframe Embed</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Embed the survey directly into your webpage. This is the simplest method.
          </p>
          <EmbedCodeDisplay code={iframeCode} language="html" />
        </CardContent>
      </Card>

      {/* JavaScript Widget */}
      <Card>
        <CardHeader>
          <CardTitle>JavaScript Widget</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Dynamically load the survey using JavaScript. Good for content management systems.
          </p>
          <EmbedCodeDisplay code={scriptCode} language="html" />
        </CardContent>
      </Card>

      {/* Popup/Modal */}
      <Card>
        <CardHeader>
          <CardTitle>Popup Modal</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Show the survey in a popup modal when users click a button.
          </p>
          <EmbedCodeDisplay code={popupCode} language="html" />
        </CardContent>
      </Card>

      {/* Preview */}
      <Card>
        <CardHeader>
          <CardTitle>Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden">
            <iframe 
              src={surveyUrl} 
              width="100%" 
              height="600" 
              className="border-0"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
