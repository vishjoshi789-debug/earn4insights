'use client';

import { useState } from 'react';
import { mockSurveys } from '@/lib/data';
import type { Survey } from '@/lib/data';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import CreateSurveyModal from '@/components/create-survey-modal';

export default function SurveysPage() {
  const npsSurvey = mockSurveys.find((s) => s.type === 'nps')!;
  const [customSurveys, setCustomSurveys] = useState<Survey[]>([]);

  return (
    <div className="space-y-8">
      {/* ✅ NPS SECTION */}
      <section>
        <Card>
          <CardHeader>
            <CardTitle>NPS Survey (Always On)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-medium">{npsSurvey.title}</p>
            <p className="text-sm text-muted-foreground">
              Status: {npsSurvey.isActive ? 'Active' : 'Inactive'}
            </p>
          </CardContent>
        </Card>
      </section>

      {/* ✅ CUSTOM SURVEYS */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Custom Surveys</h2>
        </div>

        <CreateSurveyModal
          onCreate={(survey: Survey) =>
            setCustomSurveys((prev) => [...prev, survey])
          }
        />

        {customSurveys.length === 0 ? (
          <p className="text-muted-foreground">
            No custom surveys yet.
          </p>
        ) : (
          customSurveys.map((survey) => (
            <Card key={survey.id}>
              <CardHeader>
                <CardTitle>{survey.title}</CardTitle>
              </CardHeader>
            </Card>
          ))
        )}
      </section>
    </div>
  );
}
