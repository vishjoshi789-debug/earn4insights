'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import type { Survey } from '@/lib/data';

type Props = {
  onCreate: (survey: Survey) => void;
};

export default function CreateSurveyModal({ onCreate }: Props) {
  const [title, setTitle] = useState('');

  const handleCreate = () => {
    if (!title.trim()) return;

    const newSurvey: Survey = {
      id: `survey_${Date.now()}`,
      title,
      type: 'custom',
      isActive: true,
      createdAt: new Date().toISOString(),
      questions: [],
    };

    onCreate(newSurvey);
    setTitle('');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create Custom Survey</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <input
          className="w-full border rounded px-3 py-2"
          placeholder="Survey title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <Button onClick={handleCreate}>Create Survey</Button>
      </CardContent>
    </Card>
  );
}
