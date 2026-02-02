'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';

interface BrandAnalyticsDashboardProps {
  demographicsData: {
    gender: Record<string, number>;
    ageRange: Record<string, number>;
    location: Record<string, number>;
    education: Record<string, number>;
    culture: Record<string, number>;
  };
  totalUsers: number;
}

const COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#6366f1', '#14b8a6'];

export function BrandAnalyticsDashboard({ demographicsData, totalUsers }: BrandAnalyticsDashboardProps) {
  // Transform data for charts
  const genderData = Object.entries(demographicsData.gender).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value,
    percentage: ((value / totalUsers) * 100).toFixed(1)
  }));

  const ageData = Object.entries(demographicsData.ageRange)
    .map(([name, value]) => ({
      name,
      users: value,
      percentage: ((value / totalUsers) * 100).toFixed(1)
    }))
    .sort((a, b) => {
      const order = ['18-24', '25-34', '35-44', '45-54', '55-64', '65+'];
      return order.indexOf(a.name) - order.indexOf(b.name);
    });

  const locationData = Object.entries(demographicsData.location)
    .map(([name, value]) => ({
      name,
      users: value,
      percentage: ((value / totalUsers) * 100).toFixed(1)
    }))
    .sort((a, b) => b.users - a.users)
    .slice(0, 10);

  const educationData = Object.entries(demographicsData.education)
    .map(([name, value]) => ({
      name,
      value,
      percentage: ((value / totalUsers) * 100).toFixed(1)
    }))
    .sort((a, b) => b.value - a.value);

  const cultureData = Object.entries(demographicsData.culture)
    .map(([name, value]) => ({
      name,
      users: value,
      percentage: ((value / totalUsers) * 100).toFixed(1)
    }))
    .sort((a, b) => b.users - a.users)
    .slice(0, 8);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Gender Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Gender Distribution</CardTitle>
          <CardDescription>Breakdown of your audience by gender</CardDescription>
        </CardHeader>
        <CardContent className="h-80">
          {genderData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={genderData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.name}: ${entry.percentage}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {genderData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: any, name: any, props: any) => [
                  `${value} users (${props.payload.percentage}%)`,
                  props.payload.name
                ]} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              No gender data available
            </div>
          )}
        </CardContent>
      </Card>

      {/* Age Range Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Age Distribution</CardTitle>
          <CardDescription>Age ranges of your user base</CardDescription>
        </CardHeader>
        <CardContent className="h-80">
          {ageData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ageData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(value: any, name: any, props: any) => [
                  `${value} users (${props.payload.percentage}%)`,
                  'Users'
                ]} />
                <Legend />
                <Bar dataKey="users" fill="#8b5cf6" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              No age data available
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top Locations */}
      <Card>
        <CardHeader>
          <CardTitle>Top Locations</CardTitle>
          <CardDescription>Where your users are located (top 10)</CardDescription>
        </CardHeader>
        <CardContent className="h-80">
          {locationData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={locationData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={100} />
                <Tooltip formatter={(value: any, name: any, props: any) => [
                  `${value} users (${props.payload.percentage}%)`,
                  'Users'
                ]} />
                <Legend />
                <Bar dataKey="users" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              No location data available
            </div>
          )}
        </CardContent>
      </Card>

      {/* Education Level */}
      <Card>
        <CardHeader>
          <CardTitle>Education Level</CardTitle>
          <CardDescription>Educational background of your audience</CardDescription>
        </CardHeader>
        <CardContent className="h-80">
          {educationData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={educationData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.name}: ${entry.percentage}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {educationData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: any, name: any, props: any) => [
                  `${value} users (${props.payload.percentage}%)`,
                  props.payload.name
                ]} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              No education data available
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cultural Background */}
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>Cultural Background</CardTitle>
          <CardDescription>Top 8 cultural identities in your audience</CardDescription>
        </CardHeader>
        <CardContent className="h-80">
          {cultureData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cultureData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(value: any, name: any, props: any) => [
                  `${value} users (${props.payload.percentage}%)`,
                  'Users'
                ]} />
                <Legend />
                <Bar dataKey="users" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              No cultural background data available
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
